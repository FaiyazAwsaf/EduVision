import json
import logging
import re

import google.generativeai as genai

logger = logging.getLogger(__name__)


class AnswerSegmentationService:
    def __init__(self, model, safety_settings):
        self.model = model
        self.safety_settings = safety_settings

    def _normalize_question_key(self, key: str) -> str:
        if key is None:
            return ""
        normalized = str(key).strip().lower().replace(" ", "")
        if normalized.startswith("question"):
            normalized = normalized.replace("question", "", 1)
        if normalized.startswith("q"):
            normalized = normalized[1:]
        return normalized.strip(".:)-(")

    def _segment_answers_with_continuation(self, extracted_content: dict, question_rubrics: list) -> dict:
        question_map = {
            self._normalize_question_key(q.question_number): str(q.question_number)
            for q in question_rubrics
        }
        segmented = {str(q.question_number): "" for q in question_rubrics}
        segmented["not_identified"] = ""

        current_question = None
        full_text = extracted_content.get("full_text", "") or ""

        question_prefix_pattern = re.compile(
            r"^\s*(?:q(?:uestion)?\s*)?(\d+[a-zA-Z]?)\s*[\)\].:\-]?\s*(.*)$",
            re.IGNORECASE,
        )

        for raw_line in full_text.splitlines():
            line = raw_line.strip()
            if not line:
                if current_question and segmented[current_question]:
                    segmented[current_question] += "\n"
                continue

            if line.startswith("--- Page"):
                continue

            marker_match = question_prefix_pattern.match(line)
            if marker_match:
                detected_key = self._normalize_question_key(marker_match.group(1))
                if detected_key in question_map:
                    current_question = question_map[detected_key]
                    remaining_text = marker_match.group(2).strip()
                    if remaining_text:
                        if segmented[current_question]:
                            segmented[current_question] += "\n"
                        segmented[current_question] += remaining_text
                    continue

            if current_question:
                if segmented[current_question]:
                    segmented[current_question] += "\n"
                segmented[current_question] += line
            else:
                if segmented["not_identified"]:
                    segmented["not_identified"] += "\n"
                segmented["not_identified"] += line

        for key, value in segmented.items():
            segmented[key] = value.strip()

        return segmented

    def segment_answers_by_question(self, extracted_content: dict, question_rubrics: list) -> dict:
        question_list = "\n".join([
            f"Q{q.question_number}: {q.question_text[:100]}..."
            for q in question_rubrics
        ])

        continuation_segments = self._segment_answers_with_continuation(
            extracted_content,
            question_rubrics,
        )

        segmentation_prompt = f"""
        Given the following extracted text from a student's answer script,
        segment it into answers for each question.

        IMPORTANT CONTINUATION RULE:
        If an answer continues on the next page without a new question number,
        keep it under the same question. Do NOT split an answer only because of page breaks.

        QUESTIONS IN THIS PAPER:
        {question_list}

        EXTRACTED TEXT FROM SCRIPT:
        {extracted_content['full_text']}

        HEURISTIC PRE-SEGMENTATION (for guidance):
        {json.dumps(continuation_segments, indent=2)}

        Return a JSON object mapping question numbers to their answers:
        {{
            "1": "student's answer for question 1",
            "2a": "student's answer for question 2a",
            "2b": "student's answer for question 2b",
            ...
            "not_identified": "any text that couldn't be matched to a question"
        }}

        If a question appears unanswered, return an empty string for it.
        Include all mathematical content in LaTeX format.

        Respond ONLY with valid JSON, no additional text.
        """

        try:
            response = self.model.generate_content(
                segmentation_prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
                safety_settings=self.safety_settings,
            )

            ai_segmented = json.loads(response.text)

            normalized_ai = {
                self._normalize_question_key(key): value
                for key, value in ai_segmented.items()
            }

            merged = {}
            for question_rubric in question_rubrics:
                rubric_key = str(question_rubric.question_number)
                normalized_rubric_key = self._normalize_question_key(rubric_key)

                ai_answer = normalized_ai.get(normalized_rubric_key, "")
                if isinstance(ai_answer, str) and ai_answer.strip():
                    merged[rubric_key] = ai_answer.strip()
                else:
                    merged[rubric_key] = continuation_segments.get(rubric_key, "")

            ai_unmatched = normalized_ai.get("not_identified", "")
            heuristic_unmatched = continuation_segments.get("not_identified", "")
            merged["not_identified"] = "\n".join(
                part.strip()
                for part in [ai_unmatched, heuristic_unmatched]
                if isinstance(part, str) and part.strip()
            ).strip()

            return merged

        except Exception as e:
            logger.error(f"Error segmenting answers: {str(e)}")
            return continuation_segments
