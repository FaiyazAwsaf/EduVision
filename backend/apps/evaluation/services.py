"""
AI-powered Script Evaluation Service

This service handles:
1. OCR processing of handwritten answer scripts using Vision AI
2. Mathematical equation parsing
3. Rubric-based automated grading
4. Feedback generation

Uses Google's Gemini API for OCR and evaluation.
"""

import os
import json
import logging
from typing import Optional
from decimal import Decimal
from datetime import datetime

from django.conf import settings
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from .models import (
    AnswerScript,
    ScriptPage,
    QuestionEvaluation,
)
from apps.rubrics.models import QuestionRubric

logger = logging.getLogger(__name__)


def get_gemini_model():
    """
    Finds and returns an available Gemini model from a preference list.
    """
    api_key = os.environ.get("GEMINI_API_KEY_1")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set.")
    genai.configure(api_key=api_key)

    model_preference_list = [
        'gemini-2.0-flash-exp',
        'gemini-exp-1206',
        'gemini-2.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-pro-vision',
    ]

    for model_name in model_preference_list:
        try:
            model = genai.GenerativeModel(model_name)
            logger.info(f"Using Gemini model for evaluation service: {model_name}")
            return model
        except Exception as e:
            logger.warning(f"Model {model_name} not available for evaluation service: {e}")
            continue
    
    raise ValueError("No compatible Gemini vision model found for evaluation service.")


class ScriptEvaluationService:
    """
    Main service for evaluating handwritten student scripts.
    """
    
    def __init__(self):
        self.model = get_gemini_model()
        
        # Safety settings to allow educational content
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    
    def extract_text_from_pages(self, script: AnswerScript) -> dict:
        """
        Extract text and mathematical equations from all pages of a script
        using Gemini Vision.
        
        Returns:
            dict: {
                "pages": [{"page_number": int, "text": str, "equations": list}],
                "full_text": str
            }
        """
        pages_content = []
        
        for page in script.pages.all().order_by("page_number"):
            try:
                image_path = page.image.path
                
                extraction_prompt = """
                You are an expert at reading handwritten mathematical answers.
                Extract ALL text and mathematical content from this handwritten answer sheet.
                
                Instructions:
                1. Extract all handwritten text exactly as written
                2. For mathematical equations, describe them in plain text or use double backslashes for LaTeX (e.g., \\\\frac{1}{2})
                3. Identify question numbers if visible
                4. Note any diagrams or figures present
                5. Preserve the structure and flow of the answer
                
                IMPORTANT: In your JSON response, use double backslashes (\\\\) for any LaTeX commands to ensure valid JSON.
                For example, use \\\\frac{1}{2} not \\frac{1}{2}
                
                Return your response in this JSON format:
                {
                    "extracted_text": "full extracted text with equations",
                    "equations": ["equation1", "equation2"],
                    "question_numbers_found": ["1", "2a", etc.],
                    "has_diagrams": true/false,
                    "confidence": 0.0-1.0,
                    "notes": "any observations about legibility or issues"
                }
                
                Respond ONLY with valid JSON, no additional text.
                """
                
                # Upload image to Gemini
                image_file = genai.upload_file(image_path)
                
                # Generate response with image
                response = self.model.generate_content(
                    [extraction_prompt, image_file],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                    safety_settings=self.safety_settings
                )
                
                # Try to parse JSON, handling LaTeX escape issues
                try:
                    result = json.loads(response.text)
                except json.JSONDecodeError as json_err:
                    logger.warning(f"JSON decode error on page {page.page_number}, attempting to fix LaTeX escapes: {json_err}")
                    # Try to fix common LaTeX escape issues
                    fixed_text = response.text.replace('\\', '\\\\')
                    try:
                        result = json.loads(fixed_text)
                        logger.info(f"Successfully parsed JSON after fixing escapes on page {page.page_number}")
                    except json.JSONDecodeError:
                        # If still fails, extract text manually from response
                        logger.error(f"Could not parse JSON even after fixes on page {page.page_number}")
                        result = {
                            "extracted_text": response.text[:1000],  # Use raw response as fallback
                            "equations": [],
                            "question_numbers_found": [],
                            "has_diagrams": False,
                            "confidence": 0.3,
                            "notes": "JSON parsing failed, using raw response"
                        }
                
                # Update page with extracted content
                page.extracted_text = result.get("extracted_text", "")
                page.extracted_equations = result.get("equations", [])
                page.ocr_confidence = result.get("confidence", 0.0)
                page.processing_notes = result.get("notes", "")
                page.save()
                
                pages_content.append({
                    "page_number": page.page_number,
                    "text": result.get("extracted_text", ""),
                    "equations": result.get("equations", []),
                    "question_numbers": result.get("question_numbers_found", []),
                    "confidence": result.get("confidence", 0.0)
                })
                
            except Exception as e:
                logger.error(f"Error extracting text from page {page.page_number}: {str(e)}")
                pages_content.append({
                    "page_number": page.page_number,
                    "text": "",
                    "equations": [],
                    "error": str(e)
                })
        
        # Combine all text
        full_text = "\n\n".join([
            f"--- Page {p['page_number']} ---\n{p['text']}" 
            for p in pages_content
        ])
        
        return {
            "pages": pages_content,
            "full_text": full_text
        }
    
    def evaluate_question(
        self,
        question_rubric: QuestionRubric,
        student_answer: str
    ) -> dict:
        """
        Evaluate a single question answer against the rubric.
        QuestionRubric.evaluation_rules contains automated checking rules in JSON format.
        
        Returns detailed marks breakdown and feedback.
        """
        # Get evaluation rules - now a list of rule objects
        eval_rules_list = question_rubric.evaluation_rules or []
        
        # Handle case where evaluation_rules might not be a list
        if not isinstance(eval_rules_list, list):
            logger.warning(f"Question {question_rubric.question_number} has evaluation_rules as {type(eval_rules_list)}, expected list. Converting to list.")
            eval_rules_list = []
        
        # Build description of expected answer from rules
        rules_description = []
        total_max_marks = question_rubric.max_marks
        
        for rule in eval_rules_list:
            if isinstance(rule, dict):
                rule_type = rule.get('type', 'unknown')
                marks = rule.get('marks', 0)
                config = rule.get('config', {})
                
                if rule_type == 'numeric':
                    expected = config.get('expected_value', 'N/A')
                    tolerance = config.get('tolerance', 0)
                    rules_description.append(f"- Numeric answer: {expected} (±{tolerance}) [{marks} marks]")
                elif rule_type == 'expression':
                    expected = config.get('expected_expression', 'N/A')
                    rules_description.append(f"- Expression: {expected} [{marks} marks]")
                elif rule_type == 'keyword':
                    keywords = config.get('required_keywords', [])
                    rules_description.append(f"- Keywords required: {', '.join(keywords)} [{marks} marks]")
        
        rules_text = "\n".join(rules_description) if rules_description else "No specific automated rules defined"
        
        # For AI evaluation, divide marks into method, calculation, and answer
        # Simple heuristic: 30% method, 40% calculation, 30% answer
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
                safety_settings=self.safety_settings
            )
            
            result = json.loads(response.text)
            
            # Calculate max marks for each category based on total
            total_max_marks = float(question_rubric.max_marks)
            max_method = total_max_marks * 0.3
            max_calculation = total_max_marks * 0.4
            max_answer = total_max_marks * 0.3
            
            # Ensure marks don't exceed maximums
            result["method_marks_awarded"] = min(
                float(result.get("method_marks_awarded", 0)),
                max_method
            )
            result["calculation_marks_awarded"] = min(
                float(result.get("calculation_marks_awarded", 0)),
                max_calculation
            )
            result["answer_marks_awarded"] = min(
                float(result.get("answer_marks_awarded", 0)),
                max_answer
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
                "review_reason": f"Evaluation failed: {str(e)}"
            }
    
    def segment_answers_by_question(
        self,
        extracted_content: dict,
        question_rubrics: list
    ) -> dict:
        """
        Use AI to segment the extracted text into individual question answers.
        """
        question_list = "\n".join([
            f"Q{q.question_number}: {q.question_text[:100]}..."
            for q in question_rubrics
        ])
        
        segmentation_prompt = f"""
        Given the following extracted text from a student's answer script,
        segment it into answers for each question.
        
        QUESTIONS IN THIS PAPER:
        {question_list}
        
        EXTRACTED TEXT FROM SCRIPT:
        {extracted_content['full_text']}
        
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
                safety_settings=self.safety_settings
            )
            
            return json.loads(response.text)
            
        except Exception as e:
            logger.error(f"Error segmenting answers: {str(e)}")
            # Fallback: return full text for each question
            return {str(q.question_number): extracted_content['full_text'] for q in question_rubrics}
    
    def generate_overall_feedback(
        self,
        script: AnswerScript,
        evaluations: list
    ) -> dict:
        """
        Generate overall feedback summary for the entire script.
        """
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
                safety_settings=self.safety_settings
            )
            
            return json.loads(response.text)
            
        except Exception as e:
            logger.error(f"Error generating overall feedback: {str(e)}")
            return {
                "feedback_summary": "Unable to generate detailed feedback.",
                "strengths": [],
                "areas_for_improvement": [],
                "study_recommendations": []
            }
    
    def evaluate_script(self, script: AnswerScript) -> AnswerScript:
        """
        Main method to evaluate an entire answer script.
        
        Process:
        1. Extract text from all pages using OCR
        2. Segment answers by question
        3. Evaluate each question against its rubric
        4. Calculate total score
        5. Generate overall feedback
        """
        try:
            # Validate rubric_set exists
            if not script.rubric_set:
                script.status = "error"
                script.feedback_summary = "No rubric set associated with this script."
                script.save()
                raise ValueError("Script has no rubric_set assigned")
            
            # Update status to processing
            script.status = "processing"
            script.save()
            
            # Step 1: Extract text from all pages
            logger.info(f"Extracting text from script {script.id}")
            extracted_content = self.extract_text_from_pages(script)
            
            # Step 2: Get all questions from RubricSet
            question_rubrics = list(script.rubric_set.questions.all().order_by("question_number"))
            
            if not question_rubrics:
                script.status = "error"
                script.feedback_summary = "No questions found in the rubric set."
                script.save()
                return script
            
            # Step 3: Segment answers by question
            logger.info(f"Segmenting answers for script {script.id}")
            segmented_answers = self.segment_answers_by_question(extracted_content, question_rubrics)
            logger.info(f"Segmented answers: {list(segmented_answers.keys())}")
            
            # Step 4: Evaluate each question
            total_marks_awarded = Decimal("0")
            total_max_marks = Decimal("0")
            evaluations = []
            
            for question_rubric in question_rubrics:
                # Try exact match first
                student_answer = segmented_answers.get(
                    str(question_rubric.question_number), 
                    segmented_answers.get(question_rubric.question_number, "")
                )
                
                # If empty, try to find sub-questions (e.g., "1a", "1b" for question "1")
                if not student_answer:
                    question_num = str(question_rubric.question_number)
                    sub_answers = []
                    for key, value in segmented_answers.items():
                        # Check if key starts with the question number (e.g., "1a", "1b" for "1")
                        if str(key).startswith(question_num) and len(str(key)) > len(question_num):
                            sub_answers.append(f"Part {key}: {value}")
                    
                    if sub_answers:
                        student_answer = "\n\n".join(sub_answers)
                        logger.info(f"Combined {len(sub_answers)} sub-parts for question {question_num}")
                
                logger.info(f"Evaluating question {question_rubric.question_number}")
                logger.info(f"Student answer length: {len(student_answer)} chars")
                if len(student_answer) < 200:
                    logger.info(f"Student answer preview: {student_answer}")
                else:
                    logger.info(f"Student answer preview: {student_answer[:200]}...")
                
                eval_result = self.evaluate_question(question_rubric, student_answer)
                
                # Create QuestionEvaluation record
                evaluation = QuestionEvaluation.objects.create(
                    script=script,
                    question_rubric=question_rubric,
                    method_marks_awarded=Decimal(str(eval_result.get("method_marks_awarded", 0))),
                    calculation_marks_awarded=Decimal(str(eval_result.get("calculation_marks_awarded", 0))),
                    answer_marks_awarded=Decimal(str(eval_result.get("answer_marks_awarded", 0))),
                    student_answer_text=student_answer,
                    method_feedback=eval_result.get("method_feedback", ""),
                    calculation_feedback=eval_result.get("calculation_feedback", ""),
                    answer_feedback=eval_result.get("answer_feedback", ""),
                    key_points_found=eval_result.get("key_points_found", []),
                    key_points_missing=eval_result.get("key_points_missing", []),
                    mistakes_identified=eval_result.get("mistakes_identified", []),
                    overall_feedback=eval_result.get("overall_feedback", ""),
                    confidence_score=eval_result.get("confidence_score", 0),
                    needs_manual_review=eval_result.get("needs_manual_review", False),
                    review_reason=eval_result.get("review_reason", "")
                )
                
                evaluations.append(evaluation)
                total_marks_awarded += evaluation.total_marks_awarded
                total_max_marks += Decimal(str(question_rubric.max_marks))
            
            # Step 5: Calculate totals and generate overall feedback
            script.total_score = total_marks_awarded
            
            if total_max_marks > 0:
                script.percentage = (total_marks_awarded / total_max_marks) * 100
            else:
                script.percentage = Decimal("0")
            
            # Generate overall feedback
            overall_feedback = self.generate_overall_feedback(script, evaluations)
            script.feedback_summary = overall_feedback.get("feedback_summary", "")
            script.strengths = overall_feedback.get("strengths", [])
            script.areas_for_improvement = overall_feedback.get("areas_for_improvement", [])
            
            # Update status
            script.status = "evaluated"
            script.evaluated_at = datetime.now()
            script.save()
            
            logger.info(f"Script {script.id} evaluated successfully. Score: {script.total_score}/{total_max_marks}")
            
            return script
            
        except Exception as e:
            logger.error(f"Error evaluating script {script.id}: {str(e)}")
            script.status = "error"
            script.feedback_summary = f"Evaluation failed: {str(e)}"
            script.save()
            raise


def evaluate_script_task(script_id: str):
    """
    Task function for asynchronous script evaluation.
    Can be called from Celery or Django-Q if needed.
    """
    from .models import AnswerScript
    
    script = AnswerScript.objects.get(id=script_id)
    service = ScriptEvaluationService()
    return service.evaluate_script(script)
