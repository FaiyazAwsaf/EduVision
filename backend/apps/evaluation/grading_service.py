import json
import logging

import google.generativeai as genai

logger = logging.getLogger(__name__)


class QuestionGradingService:
    def __init__(self, model, safety_settings):
        self.model = model
        self.safety_settings = safety_settings

    def evaluate_question(self, question_rubric, student_answer: str) -> dict:
        eval_rules_list = question_rubric.evaluation_rules or []

        if not isinstance(eval_rules_list, list):
            logger.warning(
                f"Question {question_rubric.question_number} has evaluation_rules as {type(eval_rules_list)}, expected list. Converting to list."
            )
            eval_rules_list = []

        rules_description = []
        total_max_marks = question_rubric.max_marks

        for rule in eval_rules_list:
            if isinstance(rule, dict):
                rule_type = rule.get("type", "unknown")
                marks = rule.get("marks", 0)
                config = rule.get("config", {})

                if rule_type == "numeric":
                    expected = config.get("expected_value", "N/A")
                    tolerance = config.get("tolerance", 0)
                    rules_description.append(f"- Numeric answer: {expected} (±{tolerance}) [{marks} marks]")
                elif rule_type == "expression":
                    expected = config.get("expected_expression", "N/A")
                    rules_description.append(f"- Expression: {expected} [{marks} marks]")
                elif rule_type == "keyword":
                    keywords = config.get("required_keywords", [])
                    rules_description.append(f"- Keywords required: {', '.join(keywords)} [{marks} marks]")

        rules_text = "\n".join(rules_description) if rules_description else "No specific automated rules defined"

        method_marks = float(total_max_marks) * 0.3
        calculation_marks = float(total_max_marks) * 0.4
        answer_marks = float(total_max_marks) * 0.3

        evaluation_prompt = f"""
        You are an expert mathematics teacher evaluating a student's answer.
        Be strict on correctness but fair in giving partial credit for effort and reasoning.

        QUESTION:
        Question Number: {question_rubric.question_number}
        Question Text: {question_rubric.question_text}
        Maximum Marks: {total_max_marks}

        EXPECTED ANSWER COMPONENTS (from automated rules):
        {rules_text}

        MARKS BREAKDOWN:
        - Method/Approach: {method_marks:.1f} marks (30%)
        - Calculation/Steps: {calculation_marks:.1f} marks (40%)
        - Final Answer: {answer_marks:.1f} marks (30%)

        STUDENT'S ANSWER:
        {student_answer}

        EVALUATION INSTRUCTIONS:
        1. If the student's answer is empty or unclear, award 0 marks but note this in feedback
        2. Be generous with partial credit for correct method even if the final answer is wrong
        3. Award partial marks for showing work and attempting the problem
        4. Check if calculations and steps are correct
        5. Verify the final answer against expected values
        6. Provide constructive and encouraging feedback

        IMPORTANT: Award partial credit generously. Even if the answer is wrong, give marks for:
        - Correct identification of the method/formula
        - Attempting calculations with correct approach
        - Showing work and reasoning

        Respond with this exact JSON format:
        {{
            "method_marks_awarded": 0.0,
            "method_feedback": "explanation of method marks",
            "calculation_marks_awarded": 0.0,
            "calculation_feedback": "explanation of calculation marks",
            "answer_marks_awarded": 0.0,
            "answer_feedback": "explanation of answer marks",
            "key_points_found": ["list", "of", "key", "points", "found"],
            "key_points_missing": ["list", "of", "missing", "points"],
            "mistakes_identified": ["list", "of", "mistakes"],
            "overall_feedback": "constructive feedback for the student",
            "confidence_score": 0.0-1.0,
            "needs_manual_review": false,
            "review_reason": "reason if needs review"
        }}

        Be precise with decimal marks (e.g., 1.5 for partial credit).
        Maximum marks for each category:
        - method_marks_awarded: max {method_marks}
        - calculation_marks_awarded: max {calculation_marks}
        - answer_marks_awarded: max {answer_marks}

        Respond ONLY with valid JSON, no additional text.
        """

        try:
            response = self.model.generate_content(
                evaluation_prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
                safety_settings=self.safety_settings,
            )

            result = json.loads(response.text)

            total_max_marks = float(question_rubric.max_marks)
            max_method = total_max_marks * 0.3
            max_calculation = total_max_marks * 0.4
            max_answer = total_max_marks * 0.3

            result["method_marks_awarded"] = min(
                float(result.get("method_marks_awarded", 0)),
                max_method,
            )
            result["calculation_marks_awarded"] = min(
                float(result.get("calculation_marks_awarded", 0)),
                max_calculation,
            )
            result["answer_marks_awarded"] = min(
                float(result.get("answer_marks_awarded", 0)),
                max_answer,
            )

            return result

        except Exception as e:
            logger.error(f"Error evaluating question {question_rubric.question_number}: {str(e)}")
            return {
                "method_marks_awarded": 0,
                "method_feedback": "Error during evaluation",
                "calculation_marks_awarded": 0,
                "calculation_feedback": "Error during evaluation",
                "answer_marks_awarded": 0,
                "answer_feedback": "Error during evaluation",
                "key_points_found": [],
                "key_points_missing": [],
                "mistakes_identified": [],
                "overall_feedback": f"Evaluation error: {str(e)}",
                "confidence_score": 0,
                "needs_manual_review": True,
                "review_reason": f"Evaluation failed: {str(e)}",
            }
