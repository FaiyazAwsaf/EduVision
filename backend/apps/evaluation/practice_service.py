import json
import logging
import re
import uuid

from django.core.cache import cache

from .services import get_gemini_model
from .ocr_service import OCRExtractionService

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

logger = logging.getLogger(__name__)

PRACTICE_CACHE_TTL = 7200  # 2 hours


def _get_safety_settings():
    return {
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }


def _strip_json_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


def _parse_json_response(raw: str) -> dict | list:
    cleaned = _strip_json_fences(raw)
    # Try full parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Extract first JSON object/array
    start = cleaned.find("[") if cleaned.find("[") != -1 else cleaned.find("{")
    obj_start = cleaned.find("{")
    arr_start = cleaned.find("[")
    if arr_start != -1 and (obj_start == -1 or arr_start < obj_start):
        start = arr_start
        end = cleaned.rfind("]")
    else:
        start = obj_start
        end = cleaned.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Could not parse Gemini JSON response: {raw[:200]}")


class PracticeService:
    """
    Service for generating AI practice questions and grading answers.

    Uses Django cache (no DB) with a UUID session_id for ephemeral storage.
    TTL: 2 hours.
    """

    def __init__(self):
        self.model = get_gemini_model()
        self.safety_settings = _get_safety_settings()
        self.ocr_service = OCRExtractionService(self.model, self.safety_settings)

    # ─────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────

    def generate_questions(self, subject: str, num_questions: int) -> dict:
        """
        Generate exam-style questions + marking scheme for a given subject.

        Returns:
            {
                session_id: str,
                subject: str,
                questions: [{id, number, text, marks}],
                total_marks: int,
            }
        """
        prompt = self._build_generation_prompt(subject, num_questions)

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.7,
                ),
                safety_settings=self.safety_settings,
            )
            raw = response.text
        except Exception as exc:
            logger.exception("Gemini question generation failed")
            raise RuntimeError(f"Question generation failed: {exc}") from exc

        try:
            data = _parse_json_response(raw)
        except ValueError as exc:
            logger.error("Failed to parse question generation response: %s", raw[:500])
            raise RuntimeError("Could not parse generated questions") from exc

        # Normalise: expect list or {"questions": [...]}
        if isinstance(data, list):
            questions_raw = data
        elif isinstance(data, dict):
            questions_raw = data.get("questions", data.get("Questions", []))
        else:
            questions_raw = []

        session_id = str(uuid.uuid4())
        questions = []
        marking_schemes = {}

        for idx, q in enumerate(questions_raw, start=1):
            q_id = str(uuid.uuid4())
            questions.append(
                {
                    "id": q_id,
                    "number": idx,
                    "text": q.get("question", q.get("text", q.get("Question", ""))),
                    "marks": int(q.get("marks", q.get("Marks", 5))),
                }
            )
            marking_schemes[q_id] = {
                "model_answer": q.get(
                    "model_answer",
                    q.get("answer", q.get("marking_scheme", q.get("ModelAnswer", ""))),
                ),
                "marking_guidance": q.get(
                    "marking_guidance",
                    q.get("guidance", q.get("MarkingGuidance", "")),
                ),
            }

        total_marks = sum(q["marks"] for q in questions)

        # Persist in cache
        cache.set(
            f"practice_session:{session_id}",
            {
                "subject": subject,
                "questions": questions,
                "marking_schemes": marking_schemes,
                "total_marks": total_marks,
            },
            timeout=PRACTICE_CACHE_TTL,
        )

        return {
            "session_id": session_id,
            "subject": subject,
            "questions": questions,
            "total_marks": total_marks,
        }

    def grade_typed_answers(self, session_id: str, answers: list) -> dict:
        """
        Grade a list of typed answers.

        answers: [{question_id, answer_text}]

        Returns the full results payload.
        """
        session = self._load_session(session_id)
        return self._grade_answers(session, answers)

    def grade_image_answer(self, session_id: str, question_id: str, image_bytes: bytes) -> dict:
        """
        Grade a single image-based answer (OCR first, then grade).

        Returns results for all questions with only the image question graded
        (remaining treated as blank).
        """
        session = self._load_session(session_id)

        # Extract text via OCR
        ocr_text = self._ocr_image(image_bytes)

        # Build answers list — image question gets OCR text, others are blank
        answers = []
        for q in session["questions"]:
            if q["id"] == question_id:
                answers.append({"question_id": q["id"], "answer_text": ocr_text})
            else:
                answers.append({"question_id": q["id"], "answer_text": ""})

        return self._grade_answers(session, answers)

    # ─────────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────────

    def _load_session(self, session_id: str) -> dict:
        session = cache.get(f"practice_session:{session_id}")
        if session is None:
            raise ValueError(f"Practice session '{session_id}' not found or expired.")
        return session

    def _ocr_image(self, image_bytes: bytes) -> str:
        """Run OCR on raw image bytes; returns extracted text string."""
        import tempfile, os

        try:
            # Write bytes to temp file then upload to Gemini
            suffix = ".png"
            fd, temp_path = tempfile.mkstemp(suffix=suffix)
            os.close(fd)
            with open(temp_path, "wb") as f:
                f.write(image_bytes)

            image_file = genai.upload_file(temp_path)
            prompt = (
                "You are an OCR assistant. Extract all text from this handwritten answer image. "
                "Keep line breaks. Return only plain text."
            )
            response = self.model.generate_content(
                [prompt, image_file],
                generation_config=genai.GenerationConfig(
                    response_mime_type="text/plain",
                    temperature=0.0,
                ),
                safety_settings=self.safety_settings,
            )
            return (response.text or "").strip()
        except Exception as exc:
            logger.warning("OCR extraction failed: %s", exc)
            return ""
        finally:
            try:
                os.unlink(temp_path)
            except Exception:
                pass

    def _grade_answers(self, session: dict, answers: list) -> dict:
        """Core grading logic. answers: [{question_id, answer_text}]."""
        questions = session["questions"]
        marking_schemes = session["marking_schemes"]
        subject = session["subject"]

        answer_map = {a["question_id"]: a.get("answer_text", "") for a in answers}

        results = []
        total_score = 0

        for q in questions:
            q_id = q["id"]
            student_answer = answer_map.get(q_id, "")
            scheme = marking_schemes.get(q_id, {})

            graded = self._grade_single_question(
                question_text=q["text"],
                max_marks=q["marks"],
                model_answer=scheme.get("model_answer", ""),
                marking_guidance=scheme.get("marking_guidance", ""),
                student_answer=student_answer,
                subject=subject,
            )

            marks_awarded = graded.get("marks_awarded", 0)
            total_score += marks_awarded

            results.append(
                {
                    "question_id": q_id,
                    "number": q["number"],
                    "text": q["text"],
                    "marks_awarded": marks_awarded,
                    "max_marks": q["marks"],
                    "model_answer": scheme.get("model_answer", ""),
                    "feedback": graded.get("feedback", ""),
                }
            )

        max_score = session["total_marks"]
        percentage = round((total_score / max_score) * 100, 1) if max_score > 0 else 0

        return {
            "total_score": total_score,
            "max_score": max_score,
            "percentage": percentage,
            "subject": subject,
            "results": results,
        }

    def _grade_single_question(
        self,
        question_text: str,
        max_marks: int,
        model_answer: str,
        marking_guidance: str,
        student_answer: str,
        subject: str,
    ) -> dict:
        """Call Gemini to grade one question. Returns {marks_awarded, feedback}."""

        if not student_answer.strip():
            return {"marks_awarded": 0, "feedback": "No answer provided."}

        prompt = f"""
You are an expert {subject} examiner. Grade the student's answer below.

QUESTION:
{question_text}

MAXIMUM MARKS: {max_marks}

MODEL ANSWER:
{model_answer}

MARKING GUIDANCE:
{marking_guidance or "Award marks proportionally to correctness and completeness."}

STUDENT'S ANSWER:
{student_answer}

Instructions:
- Award marks out of {max_marks} (decimals allowed, e.g. 1.5)
- Give concise feedback (1-2 sentences) explaining the marks
- Be fair: award partial credit for correct reasoning even if final answer is wrong

Respond ONLY with valid JSON in this exact format:
{{
  "marks_awarded": 0.0,
  "feedback": "Short feedback here."
}}
"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
                safety_settings=self.safety_settings,
            )
            data = _parse_json_response(response.text)
            marks_awarded = min(float(data.get("marks_awarded", 0)), max_marks)
            marks_awarded = max(0.0, marks_awarded)
            return {
                "marks_awarded": marks_awarded,
                "feedback": data.get("feedback", ""),
            }
        except Exception as exc:
            logger.exception("Gemini grading failed for question: %s", question_text[:80])
            return {"marks_awarded": 0, "feedback": "Grading could not be completed."}

    def _build_generation_prompt(self, subject: str, num_questions: int) -> str:
        return f"""
You are an expert {subject} examiner creating an end-of-year exam.

Generate exactly {num_questions} exam-style questions for the subject: {subject}.

Requirements:
- Mix difficulty levels (some straightforward, some challenging)
- Each question should be answerable in a short exam setting
- Assign marks (2–10 per question) based on difficulty
- Provide a clear model answer and brief marking guidance

Respond ONLY with a valid JSON array in this exact format (no markdown, no extra text):
[
  {{
    "question": "Full question text here",
    "marks": 5,
    "model_answer": "Expected answer here",
    "marking_guidance": "What to look for when marking"
  }},
  ...
]

Generate exactly {num_questions} questions for {subject}.
"""
