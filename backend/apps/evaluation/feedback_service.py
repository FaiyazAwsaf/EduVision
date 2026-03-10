import logging
import re

logger = logging.getLogger(__name__)


class OverallFeedbackService:
    def __init__(self, model, safety_settings):
        self.model = model
        self.safety_settings = safety_settings

    def generate_overall_feedback(self, script, evaluations: list) -> dict:
        try:
            total_awarded = sum(float(e.total_marks_awarded or 0) for e in evaluations)
            total_max = sum(float(e.question_rubric.max_marks or 0) for e in evaluations)
            full_marks = total_max > 0 and total_awarded >= (total_max - 1e-6)

            all_mistakes = []
            for evaluation in evaluations:
                mistakes = evaluation.mistakes_identified or []
                if isinstance(mistakes, list):
                    all_mistakes.extend(mistakes)

            compact_mistakes = self._unique_compact_items(all_mistakes, max_items=5)

            if full_marks:
                return {
                    "feedback_summary": "All questions answered perfectly.",
                    "strengths": ["Accurate and complete answers."],
                    "areas_for_improvement": [],
                    "study_recommendations": [],
                }

            if compact_mistakes:
                return {
                    "feedback_summary": f"Main fixes: {'; '.join(compact_mistakes)}.",
                    "strengths": [],
                    "areas_for_improvement": compact_mistakes,
                    "study_recommendations": [],
                }

            return {
                "feedback_summary": "Some marks were lost. Review each question briefly.",
                "strengths": [],
                "areas_for_improvement": ["Check method, calculations, and final answers."],
                "study_recommendations": [],
            }
        except Exception as e:
            logger.error(f"Error generating overall feedback: {str(e)}")
            return {
                "feedback_summary": "Unable to generate feedback.",
                "strengths": [],
                "areas_for_improvement": [],
                "study_recommendations": [],
            }

    def _compact_item(self, text: str, max_words: int = 10) -> str:
        cleaned = " ".join(str(text or "").strip().split())
        if not cleaned:
            return ""
        first_sentence = re.split(r"(?<=[.!?])\s+", cleaned)[0]
        words = first_sentence.split()
        if len(words) <= max_words:
            return first_sentence
        return " ".join(words[:max_words])

    def _unique_compact_items(self, items: list, max_items: int = 5) -> list:
        seen = set()
        output = []
        for item in items:
            compact = self._compact_item(item)
            if not compact:
                continue
            key = compact.lower()
            if key in seen:
                continue
            seen.add(key)
            output.append(compact)
            if len(output) >= max_items:
                break
        return output
