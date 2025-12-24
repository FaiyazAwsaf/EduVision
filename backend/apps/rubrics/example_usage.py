"""
Example usage of rubric evaluation functions.

This file demonstrates how to use the evaluation functions for different rule types.
"""

import sys
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from apps.rubrics.services import (
    evaluate_keyword_rule,
    evaluate_numeric_rule,
    evaluate_stepwise_rule,
    evaluate_answer,
    apply_rubric
)


def example_keyword_evaluation():
    """Example of evaluating a keyword-based rule."""
    print("=" * 60)
    print("KEYWORD RULE EVALUATION EXAMPLE")
    print("=" * 60)
    
    rule = {
        'marks': 5,
        'config': {
            'required_keywords': ['photosynthesis', 'chlorophyll', 'sunlight', 'glucose'],
            'scoring_mode': 'proportional'
        },
        'feedback': {
            'on_success': 'Excellent! All key concepts mentioned.',
            'on_partial': 'Good, but some key concepts are missing.',
            'on_failure': 'No key concepts identified.'
        }
    }
    
    answer = """
    Photosynthesis is the process by which plants use sunlight to produce glucose.
    The green pigment chlorophyll in plant cells captures light energy.
    """
    
    result = evaluate_keyword_rule(rule, answer)
    
    print(f"Answer: {answer.strip()}")
    print(f"\nRequired keywords: {rule['config']['required_keywords']}")
    print(f"Scoring mode: {rule['config']['scoring_mode']}")
    print(f"\nResult:")
    print(f"  Score awarded: {result['score_awarded']}/{rule['marks']}")
    print(f"  Fully matched: {result['matched']}")
    print(f"  Feedback: {result['feedback_message']}")
    print()


def example_numeric_evaluation():
    """Example of evaluating a numeric rule."""
    print("=" * 60)
    print("NUMERIC RULE EVALUATION EXAMPLE")
    print("=" * 60)
    
    rule = {
        'marks': 3,
        'config': {
            'expected_value': 9.81,
            'tolerance': 0.1
        },
        'feedback': {
            'on_success': 'Correct value for acceleration due to gravity!',
            'on_failure': 'Incorrect value for g.'
        }
    }
    
    answer = "The acceleration due to gravity on Earth is approximately 9.8 m/s²."
    
    result = evaluate_numeric_rule(rule, answer)
    
    print(f"Answer: {answer}")
    print(f"\nExpected value: {rule['config']['expected_value']} (±{rule['config']['tolerance']})")
    print(f"\nResult:")
    print(f"  Score awarded: {result['score_awarded']}/{rule['marks']}")
    print(f"  Fully matched: {result['matched']}")
    print(f"  Feedback: {result['feedback_message']}")
    print()


def example_stepwise_evaluation():
    """Example of evaluating a stepwise rule."""
    print("=" * 60)
    print("STEPWISE RULE EVALUATION EXAMPLE")
    print("=" * 60)
    
    rule = {
        'marks': 6,
        'config': {
            'step_description': 'Quadratic formula derivation',
            'expected_patterns': [
                r'ax\^?2\s*\+\s*bx\s*\+\s*c\s*=\s*0',  # Standard form
                r'x\s*=\s*.*[-+].*sqrt',  # Solution with square root
                r'discriminant|b\^?2\s*-\s*4ac'  # Mention of discriminant
            ],
            'allow_partial_credit': True
        },
        'feedback': {
            'on_success': 'Complete derivation with all steps shown.',
            'on_partial': 'Some steps present, but derivation incomplete.',
            'on_failure': 'Derivation steps not shown.'
        }
    }
    
    answer = """
    Starting with the standard form: ax^2 + bx + c = 0
    We complete the square and arrive at the solution:
    x = (-b ± sqrt(b^2 - 4ac)) / (2a)
    The discriminant b^2 - 4ac determines the nature of roots.
    """
    
    result = evaluate_stepwise_rule(rule, answer)
    
    print(f"Answer: {answer.strip()}")
    print(f"\nExpected patterns: {len(rule['config']['expected_patterns'])} patterns")
    print(f"Partial credit allowed: {rule['config']['allow_partial_credit']}")
    print(f"\nResult:")
    print(f"  Score awarded: {result['score_awarded']}/{rule['marks']}")
    print(f"  Fully matched: {result['matched']}")
    print(f"  Feedback: {result['feedback_message']}")
    print()


def example_complete_rubric_evaluation():
    """Example of evaluating a complete answer against a rubric."""
    print("=" * 60)
    print("COMPLETE RUBRIC EVALUATION EXAMPLE")
    print("=" * 60)
    
    rubric = {
        'evaluation_rules': [
            {
                'id': 'rule-1',
                'type': 'keyword',
                'marks': 4,
                'config': {
                    'required_keywords': ['Newton', 'force', 'acceleration', 'mass'],
                    'scoring_mode': 'proportional'
                },
                'feedback': {
                    'on_success': 'All key terms identified.',
                    'on_partial': 'Some key terms missing.',
                    'on_failure': 'Key terms not identified.'
                }
            },
            {
                'id': 'rule-2',
                'type': 'stepwise',
                'marks': 3,
                'config': {
                    'step_description': 'Formula application',
                    'expected_patterns': [r'F\s*=\s*ma', r'units?'],
                    'allow_partial_credit': True
                },
                'feedback': {
                    'on_success': 'Correct formula and units.',
                    'on_partial': 'Formula or units missing.',
                    'on_failure': 'No formula shown.'
                }
            },
            {
                'id': 'rule-3',
                'type': 'numeric',
                'marks': 3,
                'config': {
                    'expected_value': 100,
                    'tolerance': 2
                },
                'feedback': {
                    'on_success': 'Correct final answer.',
                    'on_failure': 'Incorrect final answer.'
                }
            }
        ]
    }
    
    answer = """
    According to Newton's second law of motion, force equals mass times acceleration.
    Using the formula F = ma, where mass is 10 kg and acceleration is 10 m/s²:
    F = 10 × 10 = 100 N (Newtons)
    """
    
    result = evaluate_answer(rubric, answer)
    
    print(f"Answer: {answer.strip()}")
    print(f"\nNumber of evaluation rules: {len(rubric['evaluation_rules'])}")
    print(f"\nOverall Result:")
    print(f"  Total score: {result['total_score']}/{result['max_score']}")
    print(f"  Percentage: {result['percentage']}%")
    print(f"\nDetailed Results:")
    for i, rule_result in enumerate(result['rule_results'], 1):
        print(f"  Rule {i} ({rule_result['rule_type']}):")
        print(f"    Score: {rule_result['score_awarded']}/{rule_result['max_marks']}")
        print(f"    Matched: {rule_result['matched']}")
        print(f"    Feedback: {rule_result['feedback_message']}")
    print()


def example_apply_rubric():
    """Example of applying a complete rubric with combined feedback."""
    print("=" * 60)
    print("APPLY_RUBRIC FUNCTION EXAMPLE")
    print("=" * 60)
    
    rubric = {
        'evaluation_rules': [
            {
                'id': 'rule-1',
                'type': 'keyword',
                'marks': 4,
                'config': {
                    'required_keywords': ['Newton', 'force', 'acceleration', 'mass'],
                    'scoring_mode': 'proportional'
                },
                'feedback': {
                    'on_success': 'All key terms identified.',
                    'on_partial': 'Some key terms missing.',
                    'on_failure': 'Key terms not identified.'
                }
            },
            {
                'id': 'rule-2',
                'type': 'stepwise',
                'marks': 3,
                'config': {
                    'step_description': 'Formula application',
                    'expected_patterns': [r'F\s*=\s*ma', r'units?'],
                    'allow_partial_credit': True
                },
                'feedback': {
                    'on_success': 'Correct formula and units.',
                    'on_partial': 'Formula or units missing.',
                    'on_failure': 'No formula shown.'
                }
            },
            {
                'id': 'rule-3',
                'type': 'numeric',
                'marks': 3,
                'config': {
                    'expected_value': 100,
                    'tolerance': 2
                },
                'feedback': {
                    'on_success': 'Correct final answer.',
                    'on_failure': 'Incorrect final answer.'
                }
            }
        ]
    }
    
    answer = """
    According to Newton's second law of motion, force equals mass times acceleration.
    Using the formula F = ma, where mass is 10 kg and acceleration is 10 m/s²:
    F = 10 × 10 = 100 N (Newtons)
    """
    
    result = apply_rubric(rubric, answer)
    
    print(f"Answer: {answer.strip()}")
    print(f"\nNumber of evaluation rules: {len(rubric['evaluation_rules'])}")
    print(f"\nResult:")
    print(f"  Total score: {result['total_score']}/{result['max_score']}")
    print(f"\nRule Results:")
    for i, rule_result in enumerate(result['rule_results'], 1):
        print(f"  Rule {i}:")
        print(f"    Type: {rule_result['rule_type']}")
        print(f"    Score: {rule_result['score_awarded']}/{rule_result['max_marks']}")
        print(f"    Matched: {rule_result['matched']}")
        print(f"    Feedback: {rule_result['feedback_message']}")
    
    print(f"\n{'='*60}")
    print("COMBINED FEEDBACK:")
    print(f"{'='*60}")
    print(result['feedback'])
    print()


if __name__ == '__main__':
    example_keyword_evaluation()
    example_numeric_evaluation()
    example_stepwise_evaluation()
    example_complete_rubric_evaluation()
    example_apply_rubric()
