"""
Aggregated evaluation service for RubricSet with multiple questions.
Uses existing apply_rubric logic per question and aggregates results.
"""

from typing import Dict, Any, List
from .services import apply_rubric


def evaluate_rubric_set(rubric_set_data: Dict[str, Any], answers: Dict[int, str]) -> Dict[str, Any]:
    """
    Evaluate a complete assessment (RubricSet) with multiple questions.
    
    Args:
        rubric_set_data: Dictionary containing rubric set data with questions list
        answers: Dictionary mapping question_number to answer_text
                 e.g., {1: "answer for q1", 2: "answer for q2"}
    
    Returns:
        Dictionary with:
            - total_score: float - total marks awarded across all questions
            - max_score: float - maximum possible marks
            - percentage: float - overall percentage score
            - question_results: list - individual question evaluation results
            - feedback: str - combined feedback for all questions
    """
    questions = rubric_set_data.get('questions', [])
    
    if not questions:
        return {
            'total_score': 0.0,
            'max_score': 0.0,
            'percentage': 0.0,
            'question_results': [],
            'feedback': 'No questions found in rubric set'
        }
    
    question_results = []
    total_score = 0.0
    max_score = 0.0
    feedback_parts = []
    
    # Evaluate each question
    for question in questions:
        question_number = question.get('question_number')
        max_marks = float(question.get('max_marks', 0))
        max_score += max_marks
        
        # Get answer for this question
        answer_text = answers.get(question_number, '')
        
        # Prepare rubric data for this question (compatible with existing apply_rubric)
        question_rubric = {
            'evaluation_rules': question.get('evaluation_rules', []),
            'total_marks': max_marks
        }
        
        # Apply existing evaluation logic
        if answer_text.strip():
            result = apply_rubric(question_rubric, answer_text)
        else:
            # No answer provided
            result = {
                'total_score': 0.0,
                'max_score': max_marks,
                'rule_results': [],
                'feedback': 'No answer provided'
            }
        
        # Add question metadata to result
        question_result = {
            'question_number': question_number,
            'question_text': question.get('question_text', ''),
            'score': result['total_score'],
            'max_marks': max_marks,
            'percentage': (result['total_score'] / max_marks * 100) if max_marks > 0 else 0,
            'rule_results': result.get('rule_results', []),
            'feedback': result.get('feedback', '')
        }
        
        question_results.append(question_result)
        total_score += result['total_score']
        
        # Build feedback for this question
        feedback_parts.append(
            f"\nQuestion {question_number}: {question_result['score']:.2f}/{max_marks} marks "
            f"({question_result['percentage']:.1f}%)\n"
            f"{result.get('feedback', '')}"
        )
    
    # Calculate overall percentage
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    
    # Generate combined feedback
    feedback_header = f"Assessment Results\n"
    feedback_header += f"==================\n"
    feedback_header += f"Total Score: {total_score:.2f}/{max_score:.2f} ({percentage:.1f}%)\n"
    feedback_header += f"\nQuestion Breakdown:\n"
    feedback_header += "-" * 80
    
    combined_feedback = feedback_header + "".join(feedback_parts)
    
    return {
        'total_score': round(total_score, 2),
        'max_score': round(max_score, 2),
        'percentage': round(percentage, 2),
        'question_results': question_results,
        'feedback': combined_feedback
    }


def evaluate_question(question_data: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a single question within a rubric set.
    
    This is a convenience function that wraps apply_rubric for a single question.
    
    Args:
        question_data: Dictionary containing question data with evaluation_rules
        answer_text: Clean plain text of the student's answer
    
    Returns:
        Dictionary with evaluation results for the question
    """
    max_marks = float(question_data.get('max_marks', 0))
    
    question_rubric = {
        'evaluation_rules': question_data.get('evaluation_rules', []),
        'total_marks': max_marks
    }
    
    result = apply_rubric(question_rubric, answer_text)
    
    return {
        'question_number': question_data.get('question_number'),
        'question_text': question_data.get('question_text', ''),
        'score': result['total_score'],
        'max_marks': max_marks,
        'percentage': (result['total_score'] / max_marks * 100) if max_marks > 0 else 0,
        'rule_results': result.get('rule_results', []),
        'feedback': result.get('feedback', '')
    }
