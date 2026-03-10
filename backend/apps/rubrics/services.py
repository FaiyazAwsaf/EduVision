"""
Evaluation services for the Rubric Builder system.

Provides rule-based evaluation functions for scoring student answers
against keyword, numeric, and stepwise evaluation rules.
"""

import re
import logging

logger = logging.getLogger(__name__)


def evaluate_keyword_rule(rule: dict, answer_text: str) -> dict:
    """
    Evaluate a keyword-based rule against the student's answer.

    Supports two scoring modes:
    - proportional: (matched / total) * marks
    - all_or_nothing: full marks or zero
    """
    config = rule.get("config", {})
    required_keywords = config.get("required_keywords", [])
    scoring_mode = config.get("scoring_mode", "proportional")
    max_marks = float(rule.get("marks", 0))
    feedback_cfg = rule.get("feedback", {})
    rule_id = str(rule.get("id", ""))

    if not required_keywords:
        return {
            "rule_id": rule_id,
            "rule_type": "keyword",
            "max_marks": max_marks,
            "score_awarded": 0.0,
            "matched": False,
            "feedback_message": "No keywords configured for this rule.",
        }

    matched_keywords = []
    for keyword in required_keywords:
        pattern = r"\b" + re.escape(keyword.strip()) + r"\b"
        if re.search(pattern, answer_text, re.IGNORECASE):
            matched_keywords.append(keyword)

    total = len(required_keywords)
    matched_count = len(matched_keywords)
    all_matched = matched_count == total

    if scoring_mode == "all_or_nothing":
        score = max_marks if all_matched else 0.0
    else:
        score = round((matched_count / total) * max_marks, 2) if total > 0 else 0.0

    if all_matched:
        message = feedback_cfg.get("on_success", f"All {total} keyword(s) found.")
    elif matched_count == 0:
        message = feedback_cfg.get("on_failure", f"None of the required keywords found.")
    else:
        partial_msg = feedback_cfg.get("on_partial")
        message = partial_msg if partial_msg else (
            f"Partial match: {matched_count}/{total} keywords found "
            f"({', '.join(matched_keywords)})."
        )

    return {
        "rule_id": rule_id,
        "rule_type": "keyword",
        "max_marks": max_marks,
        "score_awarded": score,
        "matched": all_matched,
        "matched_keywords": matched_keywords,
        "feedback_message": message,
    }


def evaluate_numeric_rule(rule: dict, answer_text: str) -> dict:
    """
    Evaluate a numeric-based rule against the student's answer.

    Extracts all numeric values from the text and checks whether any
    fall within the configured tolerance of the expected value.
    """
    config = rule.get("config", {})
    expected = float(config.get("expected_value", 0.0))
    tolerance = float(config.get("tolerance", 0.0))
    max_marks = float(rule.get("marks", 0))
    feedback_cfg = rule.get("feedback", {})
    rule_id = str(rule.get("id", ""))

    # Extract all numeric values (int, float, scientific notation, negatives)
    number_pattern = r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?"
    found_values = [float(m) for m in re.findall(number_pattern, answer_text)]

    matched = any(abs(v - expected) <= tolerance for v in found_values)
    score = max_marks if matched else 0.0

    if matched:
        message = feedback_cfg.get("on_success", f"Correct numeric answer found (expected {expected} ± {tolerance}).")
    else:
        if found_values:
            found_str = ", ".join(str(v) for v in found_values)
            message = feedback_cfg.get(
                "on_failure",
                f"Expected {expected} (± {tolerance}), but found: {found_str}.",
            )
        else:
            message = feedback_cfg.get("on_failure", f"No numeric value found. Expected {expected} (± {tolerance}).")

    return {
        "rule_id": rule_id,
        "rule_type": "numeric",
        "max_marks": max_marks,
        "score_awarded": score,
        "matched": matched,
        "found_values": found_values,
        "feedback_message": message,
    }


def evaluate_stepwise_rule(rule: dict, answer_text: str) -> dict:
    """
    Evaluate a stepwise rule by matching regex patterns against the student's answer.

    Supports optional partial credit for partially completed steps.
    """
    config = rule.get("config", {})
    step_description = config.get("step_description", "")
    expected_patterns = config.get("expected_patterns", [])
    allow_partial = config.get("allow_partial_credit", True)
    max_marks = float(rule.get("marks", 0))
    feedback_cfg = rule.get("feedback", {})
    rule_id = str(rule.get("id", ""))

    if not expected_patterns:
        return {
            "rule_id": rule_id,
            "rule_type": "stepwise",
            "max_marks": max_marks,
            "score_awarded": 0.0,
            "matched": False,
            "feedback_message": "No patterns configured for this step.",
        }

    matched_patterns = []
    for pattern in expected_patterns:
        try:
            if re.search(pattern, answer_text, re.IGNORECASE | re.MULTILINE):
                matched_patterns.append(pattern)
        except re.error:
            logger.warning(f"Invalid regex pattern in stepwise rule {rule_id}: {pattern!r}")

    total = len(expected_patterns)
    matched_count = len(matched_patterns)
    all_matched = matched_count == total

    if allow_partial:
        score = round((matched_count / total) * max_marks, 2) if total > 0 else 0.0
    else:
        score = max_marks if all_matched else 0.0

    step_label = f"Step '{step_description}'" if step_description else "Step"

    if all_matched:
        message = feedback_cfg.get("on_success", f"{step_label}: all {total} pattern(s) matched.")
    elif matched_count == 0:
        message = feedback_cfg.get("on_failure", f"{step_label}: no patterns matched.")
    else:
        partial_msg = feedback_cfg.get("on_partial")
        message = partial_msg if partial_msg else (
            f"{step_label}: {matched_count}/{total} pattern(s) matched."
        )

    return {
        "rule_id": rule_id,
        "rule_type": "stepwise",
        "max_marks": max_marks,
        "score_awarded": score,
        "matched": all_matched,
        "matched_patterns": matched_patterns,
        "feedback_message": message,
    }


_RULE_EVALUATORS = {
    "keyword": evaluate_keyword_rule,
    "numeric": evaluate_numeric_rule,
    "stepwise": evaluate_stepwise_rule,
}


def apply_rubric(rubric: dict, answer_text: str) -> dict:
    """
    Apply all evaluation rules in a rubric to the given answer text.

    Returns a structured result with per-rule breakdown, total score,
    and combined feedback.
    """
    evaluation_rules = rubric.get("evaluation_rules", [])
    max_score = float(rubric.get("total_marks", 0))

    total_score = 0.0
    rule_results = []
    feedback_lines = []

    for i, rule in enumerate(evaluation_rules, start=1):
        rule_type = rule.get("type", "")
        evaluator = _RULE_EVALUATORS.get(rule_type)

        if evaluator is None:
            result = {
                "rule_id": str(rule.get("id", "")),
                "rule_type": rule_type,
                "max_marks": float(rule.get("marks", 0)),
                "score_awarded": 0.0,
                "matched": False,
                "feedback_message": f"Unknown rule type: '{rule_type}'.",
            }
        else:
            result = evaluator(rule, answer_text)

        total_score += result["score_awarded"]
        rule_results.append(result)
        feedback_lines.append(
            f"Rule {i} ({result['rule_type']}): "
            f"{result['score_awarded']}/{result['max_marks']} marks — "
            f"{result['feedback_message']}"
        )

    total_score = round(total_score, 2)
    percentage = round((total_score / max_score * 100), 1) if max_score > 0 else 0.0

    feedback_lines.insert(0, "-" * 50)
    feedback_lines.insert(0, f"Overall Score: {total_score}/{max_score} ({percentage}%)")
    feedback = "\n".join(feedback_lines)

    return {
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
        "rule_results": rule_results,
        "feedback": feedback,
    }


def evaluate_answer(rubric: dict, answer_text: str) -> dict:
    """Convenience wrapper around apply_rubric."""
    return apply_rubric(rubric, answer_text)
