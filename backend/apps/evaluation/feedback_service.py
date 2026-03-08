import json
import logging

import google.generativeai as genai

logger = logging.getLogger(__name__)


class OverallFeedbackService:
    def __init__(self, model, safety_settings):
        self.model = model
        self.safety_settings = safety_settings

    def generate_overall_feedback(self, script, evaluations: list) -> dict:
        eval_summary = "\n".join([
            f"Q{e.question_rubric.question_number}: {e.total_marks_awarded}/{e.question_rubric.max_marks} marks"
            for e in evaluations
        ])

        feedback_prompt = f"""
        Based on the following question-by-question evaluation results,
        generate an overall feedback summary for the student.

        EVALUATION RESULTS:
        {eval_summary}

        Total Score: {script.total_score}/{script.rubric_set.total_marks}
        Percentage: {script.percentage}%

        Individual Question Feedback:
        {json.dumps([{
            'question': e.question_rubric.question_number,
            'feedback': e.overall_feedback,
            'mistakes': e.mistakes_identified
        } for e in evaluations], indent=2)}

        Generate a JSON response with:
        {{
            "feedback_summary": "2-3 paragraph overall assessment",
            "strengths": ["list", "of", "strengths"],
            "areas_for_improvement": ["list", "of", "areas", "to", "improve"],
            "study_recommendations": ["specific", "topics", "to", "review"]
        }}

        Be encouraging but honest. Focus on constructive feedback.

        Respond ONLY with valid JSON, no additional text.
        """

        try:
            response = self.model.generate_content(
                feedback_prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.4,
                ),
                safety_settings=self.safety_settings,
            )

            return json.loads(response.text)

        except Exception as e:
            logger.error(f"Error generating overall feedback: {str(e)}")
            return {
                "feedback_summary": "Unable to generate detailed feedback.",
                "strengths": [],
                "areas_for_improvement": [],
                "study_recommendations": [],
            }
