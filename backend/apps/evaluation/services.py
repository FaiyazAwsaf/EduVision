import os
import json
import logging
from typing import Optional
from decimal import Decimal
from datetime import datetime

from django.conf import settings
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from .ocr_service import OCRExtractionService
from .segmentation_service import AnswerSegmentationService
from .grading_service import QuestionGradingService
from .feedback_service import OverallFeedbackService

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
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
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

        self.ocr_service = OCRExtractionService(self.model, self.safety_settings)
        self.segmentation_service = AnswerSegmentationService(self.model, self.safety_settings)
        self.grading_service = QuestionGradingService(self.model, self.safety_settings)
        self.feedback_service = OverallFeedbackService(self.model, self.safety_settings)
    
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
        return self.ocr_service.extract_text_from_pages(script)
    
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
        return self.grading_service.evaluate_question(question_rubric, student_answer)
    
    def segment_answers_by_question(
        self,
        extracted_content: dict,
        question_rubrics: list
    ) -> dict:
        """
        Use AI to segment the extracted text into individual question answers.
        """
        return self.segmentation_service.segment_answers_by_question(
            extracted_content,
            question_rubrics,
        )
    
    def generate_overall_feedback(
        self,
        script: AnswerScript,
        evaluations: list
    ) -> dict:
        """
        Generate overall feedback summary for the entire script.
        """
        return self.feedback_service.generate_overall_feedback(script, evaluations)
    
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
                student_answer = segmented_answers.get(
                    str(question_rubric.question_number), 
                    segmented_answers.get(question_rubric.question_number, "")
                )
                
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
