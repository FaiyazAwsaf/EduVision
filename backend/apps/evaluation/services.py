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
import re
import tempfile
from typing import Optional
from decimal import Decimal
from datetime import datetime

from django.conf import settings
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from .image_processing import preprocess_script_image

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

    def _strip_code_fences(self, text: str) -> str:
        text = (text or "").strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    def _extract_json_block(self, text: str) -> str:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return text[start:end + 1]
        return text

    def _parse_ocr_json(self, raw_text: str) -> dict:
        cleaned = self._strip_code_fences(raw_text)
        candidates = [cleaned, self._extract_json_block(cleaned)]

        for candidate in candidates:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

            repaired = re.sub(r'(?<!\\)\\(?!["\\/bfnrtu])', r"\\\\", candidate)
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass

        raise ValueError("Could not parse OCR JSON response")

    def _preprocess_image_for_ocr(self, image_path: str) -> str:
        """
        Run shared preprocessing pipeline and write to a temporary PNG for OCR.
        Returns processed file path; falls back to original on failure.
        """
        try:
            with open(image_path, "rb") as image_file:
                original_bytes = image_file.read()

            processed_bytes = preprocess_script_image(
                original_bytes,
                sharpen=True,
                equalize=True,
                equalize_method="clahe",
                denoise=True,
                binarize=True,
                binarization_method="adaptive",
                adaptive_block_size=15,
                adaptive_c=3,
            )

            fd, temp_path = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            with open(temp_path, "wb") as output_file:
                output_file.write(processed_bytes)
            return temp_path
        except Exception as e:
            logger.warning(f"Image preprocessing failed, using original image: {e}")
            return image_path

    def _fallback_plain_text_ocr(self, image_path: str) -> dict:
        image_file = genai.upload_file(image_path)
        prompt = """
        You are an OCR assistant.
        Extract all visible text exactly as written.
        Keep line breaks.
        If unreadable, write [illegible].
        Return ONLY plain text.
        """
        response = self.model.generate_content(
            [prompt, image_file],
            generation_config=genai.GenerationConfig(
                response_mime_type="text/plain",
                temperature=0.0,
            ),
            safety_settings=self.safety_settings,
        )

        text = (response.text or "").strip()
        return {
            "extracted_text": text,
            "equations": [],
            "question_numbers_found": [],
            "has_diagrams": False,
            "confidence": 0.5 if text else 0.0,
            "notes": "Fallback plain-text OCR used",
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
            processed_path = None
            try:
                image_path = page.image.path
                processed_path = self._preprocess_image_for_ocr(image_path)
                
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
                image_file = genai.upload_file(processed_path)
                
                # Generate response with image
                response = self.model.generate_content(
                    [extraction_prompt, image_file],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                    safety_settings=self.safety_settings
                )
                
                try:
                    result = self._parse_ocr_json(response.text)
                except Exception as parse_err:
                    logger.warning(
                        f"OCR JSON parse failed on page {page.page_number}: {parse_err}. Using fallback OCR."
                    )
                    result = self._fallback_plain_text_ocr(processed_path)

                extracted_text = result.get("extracted_text", "") or ""
                equations = result.get("equations", []) or []
                question_numbers = result.get("question_numbers_found", []) or []

                try:
                    confidence = float(result.get("confidence", 0.0))
                except (TypeError, ValueError):
                    confidence = 0.0
                confidence = max(0.0, min(1.0, confidence))
                
                # Update page with extracted content
                page.extracted_text = extracted_text
                page.extracted_equations = equations
                page.ocr_confidence = confidence
                page.processing_notes = result.get("notes", "")
                page.save()
                
                pages_content.append({
                    "page_number": page.page_number,
                    "text": extracted_text,
                    "equations": equations,
                    "question_numbers": question_numbers,
                    "confidence": confidence
                })
                
            except Exception as e:
                logger.error(f"Error extracting text from page {page.page_number}: {str(e)}")
                pages_content.append({
                    "page_number": page.page_number,
                    "text": "",
                    "equations": [],
                    "error": str(e)
                })
            finally:
                if processed_path and processed_path != page.image.path and os.path.exists(processed_path):
                    try:
                        os.unlink(processed_path)
                    except Exception:
                        pass
        
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

    def _normalize_question_key(self, key: str) -> str:
        if key is None:
            return ""
        normalized = str(key).strip().lower().replace(" ", "")
        if normalized.startswith("question"):
            normalized = normalized.replace("question", "", 1)
        if normalized.startswith("q"):
            normalized = normalized[1:]
        return normalized.strip(".:)-(")

    def _segment_answers_with_continuation(
        self,
        extracted_content: dict,
        question_rubrics: list,
    ) -> dict:
        """
        Heuristic segmentation that keeps answer flow across page boundaries.
        Text continues under the current question until a new question marker appears.
        """
        question_map = {
            self._normalize_question_key(q.question_number): str(q.question_number)
            for q in question_rubrics
        }
        segmented = {str(q.question_number): "" for q in question_rubrics}
        segmented["not_identified"] = ""

        current_question = None
        full_text = extracted_content.get("full_text", "") or ""

        # Matches: Q1, 1., 2a), Question 3:, etc.
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
                safety_settings=self.safety_settings
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
