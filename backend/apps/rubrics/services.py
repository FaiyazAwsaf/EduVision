"""
Service module for rubric evaluation functions.

This module provides rule evaluation logic for different types of evaluation rules:
- Keyword-based evaluation
- Numeric evaluation
- Stepwise evaluation

Main functions:
- apply_rubric: Apply complete rubric to evaluate an answer
- evaluate_keyword_rule: Evaluate keyword-based rules
- evaluate_numeric_rule: Evaluate numeric value rules
- evaluate_stepwise_rule: Evaluate step-by-step work rules
"""

import re
from typing import Dict, Any, Tuple


def evaluate_keyword_rule(rule: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a keyword-based rule against student answer text.
    
    Args:
        rule: Dictionary containing rule configuration with:
            - marks: float - marks allocated to this rule
            - config: dict with:
                - required_keywords: list of keywords to match
                - scoring_mode: "proportional" or "all_or_nothing"
            - feedback: dict with on_success, on_failure, on_partial messages
        answer_text: Clean plain text of the student's answer
    
    Returns:
        Dictionary with:
            - score_awarded: float - marks awarded
            - matched: bool - True if rule was satisfied
            - feedback_message: str - feedback for the student
    """
    config = rule.get('config', {})
    marks = rule.get('marks', 0)
    feedback = rule.get('feedback', {})
    
    required_keywords = config.get('required_keywords', [])
    scoring_mode = config.get('scoring_mode', 'proportional')
    
    # Normalize answer text for matching (case-insensitive)
    answer_lower = answer_text.lower()
    
    # Find which keywords are present in the answer
    matched_keywords = []
    for keyword in required_keywords:
        # Use word boundary matching to avoid partial word matches
        keyword_pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
        if re.search(keyword_pattern, answer_lower):
            matched_keywords.append(keyword)
    
    matched_count = len(matched_keywords)
    total_keywords = len(required_keywords)
    
    # Calculate score based on scoring mode
    if scoring_mode == 'all_or_nothing':
        # Award full marks only if all keywords are matched
        if matched_count == total_keywords:
            score_awarded = marks
            matched = True
            feedback_message = feedback.get('on_success', 'All required keywords found.')
        else:
            score_awarded = 0
            matched = False
            feedback_message = feedback.get('on_failure', f'Missing keywords. Found {matched_count}/{total_keywords}.')
    else:  # proportional
        # Award marks proportional to matched keywords
        if total_keywords > 0:
            score_awarded = (matched_count / total_keywords) * marks
        else:
            score_awarded = 0
        
        if matched_count == total_keywords:
            matched = True
            feedback_message = feedback.get('on_success', 'All required keywords found.')
        elif matched_count > 0:
            matched = False  # Partial match
            feedback_message = feedback.get('on_partial', f'Partial match: {matched_count}/{total_keywords} keywords found.')
        else:
            matched = False
            feedback_message = feedback.get('on_failure', 'No required keywords found.')
    
    return {
        'score_awarded': round(score_awarded, 2),
        'matched': matched,
        'feedback_message': feedback_message
    }


def evaluate_numeric_rule(rule: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a numeric rule against student answer text.
    
    Extracts numeric values from the answer and checks if they match
    the expected value within tolerance.
    
    Args:
        rule: Dictionary containing rule configuration with:
            - marks: float - marks allocated to this rule
            - config: dict with:
                - expected_value: float - the expected numeric answer
                - tolerance: float - acceptable deviation (default 0.0)
            - feedback: dict with on_success, on_failure messages
        answer_text: Clean plain text of the student's answer
    
    Returns:
        Dictionary with:
            - score_awarded: float - marks awarded
            - matched: bool - True if numeric value matches within tolerance
            - feedback_message: str - feedback for the student
    """
    config = rule.get('config', {})
    marks = rule.get('marks', 0)
    feedback = rule.get('feedback', {})
    
    expected_value = config.get('expected_value', 0)
    tolerance = config.get('tolerance', 0.0)
    
    # Extract all numeric values from the answer text
    # Match integers and floats (including negative numbers and scientific notation)
    numeric_pattern = r'-?\d+\.?\d*(?:[eE][+-]?\d+)?'
    found_numbers = re.findall(numeric_pattern, answer_text)
    
    # Convert found strings to floats
    numeric_values = []
    for num_str in found_numbers:
        try:
            numeric_values.append(float(num_str))
        except ValueError:
            continue
    
    # Check if any found number matches the expected value within tolerance
    matched = False
    matched_value = None
    
    for value in numeric_values:
        if abs(value - expected_value) <= tolerance:
            matched = True
            matched_value = value
            break
    
    if matched:
        score_awarded = marks
        if matched_value == expected_value:
            feedback_message = feedback.get('on_success', f'Correct answer: {expected_value}')
        else:
            feedback_message = feedback.get('on_success', f'Correct answer: {matched_value} (within tolerance)')
    else:
        score_awarded = 0
        if numeric_values:
            feedback_message = feedback.get('on_failure', 
                f'Incorrect. Expected {expected_value} (±{tolerance}), found: {", ".join(map(str, numeric_values))}')
        else:
            feedback_message = feedback.get('on_failure', 
                f'No numeric value found. Expected {expected_value} (±{tolerance})')
    
    return {
        'score_awarded': round(score_awarded, 2),
        'matched': matched,
        'feedback_message': feedback_message
    }


def evaluate_stepwise_rule(rule: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a stepwise rule against student answer text.
    
    Checks if expected patterns are present in the answer, which indicates
    that the student followed the required steps or showed required work.
    
    Args:
        rule: Dictionary containing rule configuration with:
            - marks: float - marks allocated to this rule
            - config: dict with:
                - step_description: str - description of the step
                - expected_patterns: list of regex patterns to match
                - allow_partial_credit: bool - whether partial credit is allowed
            - feedback: dict with on_success, on_failure, on_partial messages
        answer_text: Clean plain text of the student's answer
    
    Returns:
        Dictionary with:
            - score_awarded: float - marks awarded
            - matched: bool - True if all patterns matched
            - feedback_message: str - feedback for the student
    """
    config = rule.get('config', {})
    marks = rule.get('marks', 0)
    feedback = rule.get('feedback', {})
    
    step_description = config.get('step_description', 'Step')
    expected_patterns = config.get('expected_patterns', [])
    allow_partial_credit = config.get('allow_partial_credit', True)
    
    # Check each pattern against the answer text
    matched_patterns = []
    for pattern in expected_patterns:
        try:
            if re.search(pattern, answer_text, re.IGNORECASE | re.MULTILINE):
                matched_patterns.append(pattern)
        except re.error:
            # Skip invalid regex patterns
            continue
    
    matched_count = len(matched_patterns)
    total_patterns = len(expected_patterns)
    
    # Determine score based on matched patterns and partial credit setting
    if matched_count == total_patterns:
        # All patterns matched - full marks
        score_awarded = marks
        matched = True
        feedback_message = feedback.get('on_success', f'{step_description}: Complete')
    elif matched_count > 0 and allow_partial_credit:
        # Some patterns matched - partial credit
        if total_patterns > 0:
            score_awarded = (matched_count / total_patterns) * marks
        else:
            score_awarded = 0
        matched = False
        feedback_message = feedback.get('on_partial', 
            f'{step_description}: Partial ({matched_count}/{total_patterns} elements found)')
    else:
        # No match or no partial credit allowed
        score_awarded = 0
        matched = False
        feedback_message = feedback.get('on_failure', 
            f'{step_description}: Incomplete or missing')
    
    return {
        'score_awarded': round(score_awarded, 2),
        'matched': matched,
        'feedback_message': feedback_message
    }


def apply_rubric(rubric: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Apply a rubric to evaluate a student's answer.
    
    This function loops through all evaluation rules in order, applies the
    correct evaluator based on rule type, accumulates scores, and generates
    a combined feedback summary.
    
    Args:
        rubric: Dictionary containing rubric data with evaluation_rules list
        answer_text: Clean plain text of the student's answer
    
    Returns:
        Dictionary with:
            - total_score: float - total marks awarded
            - max_score: float - maximum possible marks
            - rule_results: list of individual rule evaluation results
            - feedback: str - combined feedback summary
    """
    evaluation_rules = rubric.get('evaluation_rules', [])
    rule_results = []
    total_score = 0
    max_score = 0
    feedback_parts = []
    
    # Loop through evaluation rules in order
    for i, rule in enumerate(evaluation_rules, 1):
        rule_type = rule.get('type')
        marks = rule.get('marks', 0)
        max_score += marks
        
        # Apply correct evaluator based on rule type
        if rule_type == 'keyword':
            result = evaluate_keyword_rule(rule, answer_text)
        elif rule_type == 'numeric':
            result = evaluate_numeric_rule(rule, answer_text)
        elif rule_type == 'stepwise':
            result = evaluate_stepwise_rule(rule, answer_text)
        else:
            # Unknown rule type - skip
            result = {
                'score_awarded': 0,
                'matched': False,
                'feedback_message': f'Unknown rule type: {rule_type}'
            }
        
        # Add rule info to result
        result['rule_id'] = rule.get('id')
        result['rule_type'] = rule_type
        result['max_marks'] = marks
        
        # Collect rule-level results
        rule_results.append(result)
        
        # Accumulate total score
        total_score += result['score_awarded']
        
        # Build feedback summary for this rule
        feedback_parts.append(
            f"Rule {i} ({rule_type}): {result['score_awarded']}/{marks} marks - {result['feedback_message']}"
        )
    
    # Generate combined feedback summary
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    
    feedback_header = f"Overall Score: {round(total_score, 2)}/{round(max_score, 2)} ({round(percentage, 1)}%)\n"
    feedback_header += "-" * 50 + "\n"
    feedback_body = "\n".join(feedback_parts)
    combined_feedback = feedback_header + feedback_body
    
    return {
        'total_score': round(total_score, 2),
        'max_score': round(max_score, 2),
        'rule_results': rule_results,
        'feedback': combined_feedback
    }


def evaluate_answer(rubric: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
    """
    Evaluate a complete answer against a rubric's evaluation rules.
    
    This is a convenience function that applies all evaluation rules
    in a rubric to the provided answer text.
    
    Args:
        rubric: Dictionary containing rubric data with evaluation_rules list
        answer_text: Clean plain text of the student's answer
    
    Returns:
        Dictionary with:
            - total_score: float - total marks awarded
            - max_score: float - maximum possible marks
            - percentage: float - percentage score
            - rule_results: list of individual rule evaluation results
    """
    evaluation_rules = rubric.get('evaluation_rules', [])
    rule_results = []
    total_score = 0
    max_score = 0
    
    for rule in evaluation_rules:
        rule_type = rule.get('type')
        marks = rule.get('marks', 0)
        max_score += marks
        
        # Evaluate based on rule type
        if rule_type == 'keyword':
            result = evaluate_keyword_rule(rule, answer_text)
        elif rule_type == 'numeric':
            result = evaluate_numeric_rule(rule, answer_text)
        elif rule_type == 'stepwise':
            result = evaluate_stepwise_rule(rule, answer_text)
        else:
            # Unknown rule type - skip
            result = {
                'score_awarded': 0,
                'matched': False,
                'feedback_message': f'Unknown rule type: {rule_type}'
            }
        
        # Add rule info to result
        result['rule_id'] = rule.get('id')
        result['rule_type'] = rule_type
        result['max_marks'] = marks
        
        rule_results.append(result)
        total_score += result['score_awarded']
    
    # Calculate percentage
    percentage = (total_score / max_score * 100) if max_score > 0 else 0
    
    return {
        'total_score': round(total_score, 2),
        'max_score': round(max_score, 2),
        'percentage': round(percentage, 2),
        'rule_results': rule_results
    }
