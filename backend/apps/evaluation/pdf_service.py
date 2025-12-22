"""
PDF Question Paper Extraction Service

This service handles extraction of questions and rubrics from uploaded PDF files
using Google's Gemini API.
"""

import os
import json
import logging
from typing import Optional
from decimal import Decimal

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from .models import QuestionPaper, Question, Rubric

logger = logging.getLogger(__name__)


def get_gemini_model():
    """
    Finds and returns an available Gemini model from a preference list.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set.")
    genai.configure(api_key=api_key)

    model_preference_list = [
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-pro-vision',
    ]

    for model_name in model_preference_list:
        try:
            model = genai.GenerativeModel(model_name)
            logger.info(f"Using Gemini model for PDF service: {model_name}")
            return model
        except Exception as e:
            logger.warning(f"Model {model_name} not available for PDF service: {e}")
            continue
    
    raise ValueError("No compatible Gemini vision model found for PDF service.")


class PDFExtractionService:
    """
    Service for extracting questions and rubrics from PDF files.
    """
    
    def __init__(self):
        self.model = get_gemini_model()
        
        # Safety settings
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }
    
    def extract_from_pdf(self, pdf_path: str, paper_type: str = "question") -> dict:
        """
        Extract questions and/or rubrics from a PDF file.
        
        Args:
            pdf_path: Path to the uploaded PDF file
            paper_type: Type of PDF - "question", "rubric", or "combined" (question + solution/rubric)
        
        Returns:
            dict with extracted questions and rubrics
        """
        
        if paper_type == "question":
            prompt = self._get_question_extraction_prompt()
        elif paper_type == "rubric":
            prompt = self._get_rubric_extraction_prompt()
        else:  # combined - question paper with solutions/marking scheme
            prompt = self._get_combined_extraction_prompt()
        
        try:
            # Upload PDF to Gemini
            pdf_file = genai.upload_file(pdf_path)
            
            # Generate response
            response = self.model.generate_content(
                [prompt, pdf_file],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
                safety_settings=self.safety_settings
            )
            
            result = json.loads(response.text)
            return result
            
        except Exception as e:
            logger.error(f"Error extracting from PDF: {str(e)}")
            raise ValueError(f"Failed to extract from PDF: {str(e)}")
    
    def _get_question_extraction_prompt(self) -> str:
        return """
        You are an expert at extracting questions from examination papers.
        Analyze this PDF and extract ALL questions with their details.
        
        For each question, identify:
        1. Question number (e.g., "1", "2a", "2b", "3(i)")
        2. Full question text (including any sub-parts)
        3. Question type (mathematical, short, descriptive, proof, mcq)
        4. Maximum marks allocated
        
        Return your response in this exact JSON format:
        {
            "title": "Extracted paper title or 'Untitled Question Paper'",
            "subject": "Mathematics or detected subject",
            "class_level": "9", "10", "11", or "12" (best guess based on content),
            "description": "Any instructions or notes from the paper",
            "questions": [
                {
                    "question_number": "1",
                    "question_text": "Full question text with any mathematical notation in LaTeX",
                    "question_type": "mathematical",
                    "max_marks": 5,
                    "model_answer": null
                },
                {
                    "question_number": "2a",
                    "question_text": "Question text...",
                    "question_type": "short",
                    "max_marks": 3,
                    "model_answer": null
                }
            ],
            "total_marks": 50,
            "extraction_notes": "Any issues or observations during extraction"
        }
        
        Important:
        - Convert all mathematical expressions to LaTeX format
        - If marks are not specified, estimate based on question complexity
        - Preserve the exact question numbering scheme used
        - Include ALL questions, including sub-parts
        
        Respond ONLY with valid JSON, no additional text.
        """
    
    def _get_rubric_extraction_prompt(self) -> str:
        return """
        You are an expert at extracting marking schemes and rubrics from examination papers.
        Analyze this PDF and extract the rubric/marking scheme for each question.
        
        For each question's rubric, identify:
        1. Question number it applies to
        2. Marks for correct method/approach
        3. Marks for correct calculations
        4. Marks for correct final answer
        5. Key points that must be present
        6. Common mistakes to watch for
        7. Any grading notes
        
        Return your response in this exact JSON format:
        {
            "rubrics": [
                {
                    "question_number": "1",
                    "method_marks": 2,
                    "calculation_marks": 2,
                    "answer_marks": 1,
                    "key_points": [
                        "Must use quadratic formula",
                        "Show discriminant calculation",
                        "Simplify final answer"
                    ],
                    "common_mistakes": [
                        "Forgetting to consider both roots",
                        "Sign errors in discriminant"
                    ],
                    "grading_notes": "Accept equivalent forms of answer",
                    "model_answer": "Step by step solution if provided"
                }
            ],
            "extraction_notes": "Any issues or observations"
        }
        
        Important:
        - If specific mark breakdown isn't given, estimate reasonably
        - Extract step-by-step solutions as model_answer
        - Identify key mathematical concepts being tested
        
        Respond ONLY with valid JSON, no additional text.
        """
    
    def _get_combined_extraction_prompt(self) -> str:
        return """
        You are an expert at extracting questions, solutions, and marking schemes from examination papers.
        This PDF contains questions along with their solutions and/or marking scheme.
        
        Extract EVERYTHING: questions, model answers, and rubric details.
        
        Return your response in this exact JSON format:
        {
            "title": "Paper title or 'Question Paper with Solutions'",
            "subject": "Mathematics or detected subject",
            "class_level": "9", "10", "11", or "12",
            "description": "Any instructions or notes",
            "questions": [
                {
                    "question_number": "1",
                    "question_text": "Full question text with LaTeX math",
                    "question_type": "mathematical",
                    "max_marks": 5,
                    "model_answer": "Complete step-by-step solution in LaTeX",
                    "rubric": {
                        "method_marks": 2,
                        "calculation_marks": 2,
                        "answer_marks": 1,
                        "key_points": [
                            "Key step 1",
                            "Key step 2"
                        ],
                        "common_mistakes": [
                            "Common error 1"
                        ],
                        "grading_notes": "Additional grading instructions"
                    }
                }
            ],
            "total_marks": 50,
            "extraction_notes": "Any issues during extraction"
        }
        
        Important:
        - Extract BOTH questions AND their solutions
        - Convert ALL math to LaTeX format
        - If mark breakdown isn't explicit, divide marks logically:
          * ~40% for method
          * ~40% for calculation  
          * ~20% for final answer
        - Include every question and sub-question
        
        Respond ONLY with valid JSON, no additional text.
        """
    
    def create_question_paper_from_extraction(
        self,
        extracted_data: dict,
        title_override: str = None,
        subject_override: str = None,
        class_level_override: str = None
    ) -> QuestionPaper:
        """
        Create a QuestionPaper with Questions and Rubrics from extracted data.
        """
        # Create the question paper
        question_paper = QuestionPaper.objects.create(
            title=title_override or extracted_data.get("title", "Uploaded Question Paper"),
            subject=subject_override or extracted_data.get("subject", "Mathematics"),
            class_level=class_level_override or extracted_data.get("class_level", "9"),
            description=extracted_data.get("description", ""),
            total_marks=extracted_data.get("total_marks", 0)
        )
        
        total_marks = 0
        
        # Create questions and rubrics
        for q_data in extracted_data.get("questions", []):
            question = Question.objects.create(
                question_paper=question_paper,
                question_number=q_data.get("question_number", ""),
                question_text=q_data.get("question_text", ""),
                question_type=q_data.get("question_type", "mathematical"),
                max_marks=q_data.get("max_marks", 5),
                model_answer=q_data.get("model_answer", "")
            )
            
            total_marks += question.max_marks
            
            # Create rubric if provided
            rubric_data = q_data.get("rubric", {})
            if rubric_data:
                Rubric.objects.create(
                    question=question,
                    method_marks=rubric_data.get("method_marks", 2),
                    calculation_marks=rubric_data.get("calculation_marks", 2),
                    answer_marks=rubric_data.get("answer_marks", 1),
                    key_points=rubric_data.get("key_points", []),
                    common_mistakes=rubric_data.get("common_mistakes", []),
                    grading_notes=rubric_data.get("grading_notes", "")
                )
            else:
                # Create default rubric
                max_m = question.max_marks
                Rubric.objects.create(
                    question=question,
                    method_marks=int(max_m * 0.4),
                    calculation_marks=int(max_m * 0.4),
                    answer_marks=max_m - int(max_m * 0.4) - int(max_m * 0.4),
                    key_points=[],
                    common_mistakes=[],
                    grading_notes=""
                )
        
        # Update total marks
        question_paper.total_marks = total_marks
        question_paper.save()
        
        return question_paper
    
    def update_rubrics_from_extraction(
        self,
        question_paper: QuestionPaper,
        rubric_data: dict
    ) -> QuestionPaper:
        """
        Update existing question paper with rubric data from a separate rubric PDF.
        """
        rubrics = rubric_data.get("rubrics", [])
        
        for r_data in rubrics:
            q_number = r_data.get("question_number")
            try:
                question = question_paper.questions.get(question_number=q_number)
                
                # Update model answer if provided
                if r_data.get("model_answer"):
                    question.model_answer = r_data.get("model_answer")
                    question.save()
                
                # Update or create rubric
                rubric, created = Rubric.objects.update_or_create(
                    question=question,
                    defaults={
                        "method_marks": r_data.get("method_marks", 2),
                        "calculation_marks": r_data.get("calculation_marks", 2),
                        "answer_marks": r_data.get("answer_marks", 1),
                        "key_points": r_data.get("key_points", []),
                        "common_mistakes": r_data.get("common_mistakes", []),
                        "grading_notes": r_data.get("grading_notes", ""),
                    }
                )
            except Question.DoesNotExist:
                logger.warning(f"Question {q_number} not found for rubric update")
                continue
        
        return question_paper
