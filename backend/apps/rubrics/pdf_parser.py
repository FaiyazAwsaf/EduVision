"""
PDF Rubric Document Parser Service

This service handles extraction of rubrics from uploaded PDF documents
using Google's Gemini API.
"""

import os
import json
import logging
from typing import Dict, List, Any

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

logger = logging.getLogger(__name__)


def get_gemini_model():
    """
    Finds and returns an available Gemini model from a preference list.
    Supports multiple API keys (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
    with fallback to single GEMINI_API_KEY.
    """
    # Try multiple API keys first
    api_keys = []
    for i in range(1, 4):
        key = os.environ.get(f'GEMINI_API_KEY_{i}')
        if key:
            api_keys.append(key)
    
    # Fallback to single GEMINI_API_KEY
    if not api_keys:
        single_key = os.environ.get("GEMINI_API_KEY")
        if single_key:
            api_keys.append(single_key)
    
    if not api_keys:
        raise ValueError("No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.")
    
    # Use the first available key
    api_key = api_keys[0]
    genai.configure(api_key=api_key)

    model_preference_list = [
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
    ]

    for model_name in model_preference_list:
        try:
            model = genai.GenerativeModel(model_name)
            logger.info(f"Using Gemini model for rubric parsing: {model_name}")
            return model
        except Exception as e:
            logger.warning(f"Model {model_name} not available: {e}")
            continue
    
    raise ValueError("No compatible Gemini vision model found for rubric parsing.")


def parse_rubric_document(pdf_path: str) -> Dict[str, Any]:
    """
    Parse a PDF document to extract rubric information including questions,
    marks, and evaluation criteria.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary containing structured rubric data
    """
    try:
        model = get_gemini_model()
        
        # Upload the PDF file
        uploaded_file = genai.upload_file(pdf_path)
        logger.info(f"Uploaded file: {uploaded_file.name}")
        
        # Create the prompt for rubric extraction
        prompt = """
Analyze this document and extract rubric information. This is likely a quiz/exam solution document with questions and marking schemes.

Extract the following information in JSON format:
{
  "title": "Document title or assessment name",
  "subject": "Subject area (e.g., Mathematics, Physics, etc.)",
  "total_marks": "Total marks for all questions",
  "questions": [
    {
      "question_number": 1,
      "question_text": "The complete question text",
      "max_marks": "Maximum marks for this question",
      "evaluation_rules": [
        {
          "type": "keyword|numeric|stepwise",
          "marks": "Marks for this rule",
          "config": {
            // For keyword type:
            "required_keywords": ["keyword1", "keyword2"],
            "scoring_mode": "proportional|all_or_nothing"
            
            // For numeric type:
            "expected_value": "numeric answer",
            "tolerance": "acceptable error range"
            
            // For stepwise type:
            "step_description": "Description of the step",
            "allow_partial_credit": true/false
          },
          "feedback": {
            "on_success": "Feedback for correct answer",
            "on_partial": "Feedback for partial credit",
            "on_failure": "Feedback for incorrect answer"
          }
        }
      ]
    }
  ]
}

Guidelines:
1. Extract ALL questions from the document
2. For each question, identify the marking scheme/rubric criteria
3. Classify each criterion as:
   - "keyword": If looking for specific terms/concepts
   - "numeric": If expecting a numerical answer
   - "stepwise": If marking involves steps in a solution
4. Extract marks allocation for each criterion
5. Infer appropriate feedback messages based on the marking scheme
6. If multiple questions, ensure question_number is sequential
7. Ensure total_marks equals the sum of all question max_marks

Return ONLY valid JSON, no additional text.
"""
        
        # Generate content with safety settings
        response = model.generate_content(
            [uploaded_file, prompt],
            safety_settings={
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )
        
        # Parse the response
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Parse JSON
        rubric_data = json.loads(response_text)
        
        logger.info(f"Successfully parsed rubric with {len(rubric_data.get('questions', []))} questions")
        
        return rubric_data
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response text: {response_text}")
        raise ValueError(f"Invalid JSON response from AI: {str(e)}")
    except Exception as e:
        logger.error(f"Error parsing rubric document: {e}", exc_info=True)
        raise ValueError(f"Failed to parse rubric document: {str(e)}")
