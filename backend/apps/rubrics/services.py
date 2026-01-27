"""
Evaluation services for rubric-based grading.
Includes functions for evaluating different rule types and complete rubrics.
"""

import re
from typing import Dict, Any, List


def evaluate_keyword_rule(rule: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a keyword-based rule.
    
    Args:
        rule: Dictionary with marks, config (required_keywords, scoring_mode), feedback
        answer_text: Student's answer text
        
    Returns:
        Dictionary with score_awarded, matched, feedback_message
    """
    marks = rule['marks']
    config = rule['config']
    feedback = rule.get('feedback', {})
    
    required_keywords = config.get('required_keywords', [])
    scoring_mode = config.get('scoring_mode', 'proportional')
    
    # Count matching keywords (case-insensitive, word boundaries)
    matched_count = 0
    for keyword in required_keywords:
        pattern = r'\b' + re.escape(keyword) + r'\b'
        if re.search(pattern, answer_text, re.IGNORECASE):
            matched_count += 1
    
    # Calculate score based on mode
    total_keywords = len(required_keywords)
    if total_keywords == 0:
        return {
            'score_awarded': 0,
            'matched': False,
            'feedback_message': feedback.get('on_failure', '')
        }
    
    all_matched = matched_count == total_keywords
    
    if scoring_mode == 'all_or_nothing':
        score = marks if all_matched else 0
        feedback_message = feedback.get('on_success' if all_matched else 'on_failure', '')
    else:  # proportional
        proportion = matched_count / total_keywords
        score = round(marks * proportion, 2)
        
        if all_matched:
            feedback_message = feedback.get('on_success', '')
        elif matched_count > 0:
            feedback_message = feedback.get('on_partial', '')
        else:
            feedback_message = feedback.get('on_failure', '')
    
    return {
        'score_awarded': score,
        'matched': all_matched,
        'feedback_message': feedback_message
    }


def evaluate_numeric_rule(rule: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a numeric rule.
    
    Args:
        rule: Dictionary with marks, config (expected_value, tolerance), feedback
        answer_text: Student's answer text
        
    Returns:
        Dictionary with score_awarded, matched, feedback_message
    """
    marks = rule['marks']
    config = rule['config']
    feedback = rule.get('feedback', {})
    
    expected_value = float(config.get('expected_value', 0))
    tolerance = float(config.get('tolerance', 0))
    
    # Extract all numeric values from answer
    number_pattern = r'-?\d+\.?\d*(?:[eE][+-]?\d+)?'
    found_numbers = re.findall(number_pattern, answer_text)
    
    # Check if any number matches expected value within tolerance
    matched = False
    for num_str in found_numbers:
        try:
            num_value = float(num_str)
            if abs(num_value - expected_value) <= tolerance:
                matched = True
                break
        except ValueError:
            continue
    
    score = marks if matched else 0
    feedback_message = feedback.get('on_success' if matched else 'on_failure', '')
    
    return {
        'score_awarded': score,
        'matched': matched,
        'feedback_message': feedback_message
    }


def evaluate_stepwise_rule(rule: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a stepwise rule using pattern matching.
    
    Args:
        rule: Dictionary with marks, config (step_description, expected_patterns, allow_partial_credit), feedback
        answer_text: Student's answer text
        
    Returns:
        Dictionary with score_awarded, matched, feedback_message
    """
    marks = rule['marks']
    config = rule['config']
    feedback = rule.get('feedback', {})
    
    expected_patterns = config.get('expected_patterns', [])
    allow_partial_credit = config.get('allow_partial_credit', False)
    
    if not expected_patterns:
        return {
            'score_awarded': 0,
            'matched': False,
            'feedback_message': feedback.get('on_failure', '')
        }
    
    # Count matching patterns
    matched_count = 0
    for pattern in expected_patterns:
        try:
            if re.search(pattern, answer_text, re.IGNORECASE | re.MULTILINE):
                matched_count += 1
        except re.error:
            # Invalid regex pattern, skip it
            continue
    
    total_patterns = len(expected_patterns)
    all_matched = matched_count == total_patterns
    
    # Calculate score
    if all_matched:
        score = marks
        feedback_message = feedback.get('on_success', '')
    elif matched_count > 0 and allow_partial_credit:
        proportion = matched_count / total_patterns
        score = round(marks * proportion, 2)
        feedback_message = feedback.get('on_partial', '')
    else:
        score = 0
        feedback_message = feedback.get('on_failure', '')
    
    return {
        'score_awarded': score,
        'matched': all_matched,
        'feedback_message': feedback_message
    }


def evaluate_answer(rubric: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a complete answer against all rules in a rubric.
    
    Args:
        rubric: Dictionary containing evaluation_rules list
        answer_text: Student's answer text
        
    Returns:
        Dictionary with total_score, max_score, percentage, rule_results
    """
    evaluation_rules = rubric.get('evaluation_rules', [])
    
    total_score = 0
    max_score = 0
    rule_results = []
    
    for rule in evaluation_rules:
        rule_type = rule.get('type', '')
        max_score += rule.get('marks', 0)
        
        if rule_type == 'keyword':
            result = evaluate_keyword_rule(rule, answer_text)
        elif rule_type == 'numeric':
            result = evaluate_numeric_rule(rule, answer_text)
        elif rule_type == 'stepwise':
            result = evaluate_stepwise_rule(rule, answer_text)
        else:
            result = {
                'score_awarded': 0,
                'matched': False,
                'feedback_message': f'Unknown rule type: {rule_type}'
            }
        
        total_score += result['score_awarded']
        rule_results.append(result)
    
    percentage = round((total_score / max_score * 100) if max_score > 0 else 0, 2)
    
    return {
        'total_score': round(total_score, 2),
        'max_score': round(max_score, 2),
        'percentage': percentage,
        'rule_results': rule_results
    }


def apply_rubric(rubric: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Apply a complete rubric to evaluate a student's answer.
    
    This function processes all evaluation rules in order, applies the appropriate
    evaluator for each rule type, accumulates scores, and generates detailed feedback.
    
    Args:
        rubric: Dictionary containing evaluation_rules list
        answer_text: Clean plain text of the student's answer
        
    Returns:
        Dictionary with:
            - total_score: Total marks awarded across all rules
            - max_score: Maximum possible marks
            - rule_results: List of individual rule evaluation results
            - feedback: Combined feedback summary with overall score and rule breakdown
    """
    evaluation_rules = rubric.get('evaluation_rules', [])
    
    total_score = 0
    max_score = 0
    rule_results = []
    feedback_parts = []
    
    # Evaluate each rule
    for idx, rule in enumerate(evaluation_rules, 1):
        rule_type = rule.get('type', '')
        rule_id = rule.get('id', f'rule-{idx}')
        rule_marks = rule.get('marks', 0)
        max_score += rule_marks
        
        # Apply appropriate evaluator
        if rule_type == 'keyword':
            result = evaluate_keyword_rule(rule, answer_text)
        elif rule_type == 'numeric':
            result = evaluate_numeric_rule(rule, answer_text)
        elif rule_type == 'stepwise':
            result = evaluate_stepwise_rule(rule, answer_text)
        else:
            result = {
                'score_awarded': 0,
                'matched': False,
                'feedback_message': f'Unknown rule type: {rule_type}'
            }
        
        total_score += result['score_awarded']
        
        # Add detailed rule result
        rule_result = {
            'rule_id': rule_id,
            'rule_type': rule_type,
            'score_awarded': result['score_awarded'],
            'max_marks': rule_marks,
            'matched': result['matched'],
            'feedback_message': result['feedback_message']
        }
        rule_results.append(rule_result)
        
        # Build feedback for this rule
        match_status = "✓" if result['matched'] else "✗"
        feedback_parts.append(
            f"Rule {idx} ({rule_type}): {match_status} {result['score_awarded']:.2f}/{rule_marks} marks\n"
            f"  {result['feedback_message']}\n"
        )
    
    # Calculate percentage
    percentage = round((total_score / max_score * 100) if max_score > 0 else 0, 2)
    
    # Generate combined feedback
    feedback_header = f"Overall Score: {total_score:.2f}/{max_score:.2f} ({percentage:.1f}%)\n\n"
    feedback_header += "Rule-by-Rule Breakdown:\n"
    feedback_header += "-" * 60 + "\n"
    
    combined_feedback = feedback_header + "".join(feedback_parts)
    
    return {
        'total_score': round(total_score, 2),
        'max_score': round(max_score, 2),
        'rule_results': rule_results,
        'feedback': combined_feedback
    }


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
