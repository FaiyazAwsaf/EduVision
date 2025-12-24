"""
Tests for rubric evaluation services.

Run with: python manage.py test apps.rubrics.test_services
"""

from django.test import TestCase
from apps.rubrics.services import (
    evaluate_keyword_rule,
    evaluate_numeric_rule,
    evaluate_stepwise_rule,
    evaluate_answer,
    apply_rubric
)


class KeywordRuleEvaluationTests(TestCase):
    """Tests for keyword-based rule evaluation."""
    
    def test_keyword_all_or_nothing_full_match(self):
        """Test all-or-nothing mode with all keywords present."""
        rule = {
            'marks': 5,
            'config': {
                'required_keywords': ['photosynthesis', 'chlorophyll', 'glucose'],
                'scoring_mode': 'all_or_nothing'
            },
            'feedback': {
                'on_success': 'Excellent!',
                'on_failure': 'Missing keywords'
            }
        }
        answer = "Photosynthesis is the process where chlorophyll captures light to produce glucose."
        
        result = evaluate_keyword_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 5)
        self.assertTrue(result['matched'])
        self.assertEqual(result['feedback_message'], 'Excellent!')
    
    def test_keyword_all_or_nothing_partial_match(self):
        """Test all-or-nothing mode with some keywords missing."""
        rule = {
            'marks': 5,
            'config': {
                'required_keywords': ['photosynthesis', 'chlorophyll', 'glucose'],
                'scoring_mode': 'all_or_nothing'
            },
            'feedback': {
                'on_success': 'Excellent!',
                'on_failure': 'Missing keywords'
            }
        }
        answer = "Photosynthesis uses chlorophyll to make food."
        
        result = evaluate_keyword_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 0)
        self.assertFalse(result['matched'])
        self.assertEqual(result['feedback_message'], 'Missing keywords')
    
    def test_keyword_proportional_full_match(self):
        """Test proportional mode with all keywords present."""
        rule = {
            'marks': 6,
            'config': {
                'required_keywords': ['DNA', 'RNA', 'protein'],
                'scoring_mode': 'proportional'
            },
            'feedback': {
                'on_success': 'Complete',
                'on_partial': 'Partial',
                'on_failure': 'None found'
            }
        }
        answer = "DNA is transcribed to RNA which translates to protein."
        
        result = evaluate_keyword_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 6)
        self.assertTrue(result['matched'])
        self.assertEqual(result['feedback_message'], 'Complete')
    
    def test_keyword_proportional_partial_match(self):
        """Test proportional mode with partial keywords."""
        rule = {
            'marks': 6,
            'config': {
                'required_keywords': ['DNA', 'RNA', 'protein'],
                'scoring_mode': 'proportional'
            },
            'feedback': {
                'on_success': 'Complete',
                'on_partial': 'Partial',
                'on_failure': 'None found'
            }
        }
        answer = "DNA contains genetic information and RNA helps in the process."
        
        result = evaluate_keyword_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 4)  # 2/3 * 6 = 4
        self.assertFalse(result['matched'])
        self.assertEqual(result['feedback_message'], 'Partial')
    
    def test_keyword_case_insensitive(self):
        """Test that keyword matching is case-insensitive."""
        rule = {
            'marks': 3,
            'config': {
                'required_keywords': ['newton', 'gravity'],
                'scoring_mode': 'all_or_nothing'
            },
            'feedback': {}
        }
        answer = "NEWTON discovered GRAVITY affects all objects."
        
        result = evaluate_keyword_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 3)
        self.assertTrue(result['matched'])


class NumericRuleEvaluationTests(TestCase):
    """Tests for numeric rule evaluation."""
    
    def test_numeric_exact_match(self):
        """Test numeric match with exact value."""
        rule = {
            'marks': 4,
            'config': {
                'expected_value': 9.8,
                'tolerance': 0.0
            },
            'feedback': {
                'on_success': 'Correct!',
                'on_failure': 'Wrong answer'
            }
        }
        answer = "The acceleration due to gravity is 9.8 m/s²."
        
        result = evaluate_numeric_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 4)
        self.assertTrue(result['matched'])
    
    def test_numeric_within_tolerance(self):
        """Test numeric match within tolerance."""
        rule = {
            'marks': 4,
            'config': {
                'expected_value': 9.8,
                'tolerance': 0.2
            },
            'feedback': {
                'on_success': 'Correct!',
                'on_failure': 'Wrong answer'
            }
        }
        answer = "The value is approximately 9.75 m/s²."
        
        result = evaluate_numeric_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 4)
        self.assertTrue(result['matched'])
    
    def test_numeric_outside_tolerance(self):
        """Test numeric value outside tolerance."""
        rule = {
            'marks': 4,
            'config': {
                'expected_value': 9.8,
                'tolerance': 0.1
            },
            'feedback': {
                'on_success': 'Correct!',
                'on_failure': 'Wrong answer'
            }
        }
        answer = "The value is 10.5 m/s²."
        
        result = evaluate_numeric_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 0)
        self.assertFalse(result['matched'])
    
    def test_numeric_no_value_found(self):
        """Test when no numeric value is found in answer."""
        rule = {
            'marks': 4,
            'config': {
                'expected_value': 9.8,
                'tolerance': 0.0
            },
            'feedback': {
                'on_success': 'Correct!',
                'on_failure': 'No value found'
            }
        }
        answer = "The acceleration is very high."
        
        result = evaluate_numeric_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 0)
        self.assertFalse(result['matched'])
    
    def test_numeric_multiple_values(self):
        """Test extraction when multiple numbers are present."""
        rule = {
            'marks': 3,
            'config': {
                'expected_value': 100,
                'tolerance': 0
            },
            'feedback': {}
        }
        answer = "First we have 25, then 50, and finally 100 as the result."
        
        result = evaluate_numeric_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 3)
        self.assertTrue(result['matched'])


class StepwiseRuleEvaluationTests(TestCase):
    """Tests for stepwise rule evaluation."""
    
    def test_stepwise_all_patterns_match(self):
        """Test stepwise rule with all patterns matching."""
        rule = {
            'marks': 5,
            'config': {
                'step_description': 'Equation derivation',
                'expected_patterns': [r'F\s*=\s*ma', r'a\s*=\s*F/m'],
                'allow_partial_credit': True
            },
            'feedback': {
                'on_success': 'Complete derivation',
                'on_failure': 'Missing steps',
                'on_partial': 'Partial steps shown'
            }
        }
        answer = "Starting with F = ma, we can rearrange to get a = F/m."
        
        result = evaluate_stepwise_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 5)
        self.assertTrue(result['matched'])
        self.assertEqual(result['feedback_message'], 'Complete derivation')
    
    def test_stepwise_partial_with_credit(self):
        """Test stepwise rule with partial match and partial credit allowed."""
        rule = {
            'marks': 6,
            'config': {
                'step_description': 'Solution steps',
                'expected_patterns': [r'step\s*1', r'step\s*2', r'step\s*3'],
                'allow_partial_credit': True
            },
            'feedback': {
                'on_success': 'All steps shown',
                'on_failure': 'No steps shown',
                'on_partial': 'Some steps shown'
            }
        }
        answer = "First, step 1 is done. Then step 2 follows."
        
        result = evaluate_stepwise_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 4)  # 2/3 * 6 = 4
        self.assertFalse(result['matched'])
        self.assertEqual(result['feedback_message'], 'Some steps shown')
    
    def test_stepwise_partial_no_credit(self):
        """Test stepwise rule with partial match but no partial credit."""
        rule = {
            'marks': 6,
            'config': {
                'step_description': 'Critical steps',
                'expected_patterns': [r'step\s*1', r'step\s*2', r'step\s*3'],
                'allow_partial_credit': False
            },
            'feedback': {
                'on_success': 'All steps shown',
                'on_failure': 'Incomplete',
                'on_partial': 'Some steps shown'
            }
        }
        answer = "First, step 1 is done. Then step 2 follows."
        
        result = evaluate_stepwise_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 0)
        self.assertFalse(result['matched'])
        self.assertEqual(result['feedback_message'], 'Incomplete')
    
    def test_stepwise_no_patterns_match(self):
        """Test stepwise rule with no patterns matching."""
        rule = {
            'marks': 5,
            'config': {
                'step_description': 'Working',
                'expected_patterns': [r'calculate', r'solve', r'result'],
                'allow_partial_credit': True
            },
            'feedback': {
                'on_success': 'Complete',
                'on_failure': 'No work shown',
                'on_partial': 'Partial work'
            }
        }
        answer = "The answer is correct."
        
        result = evaluate_stepwise_rule(rule, answer)
        
        self.assertEqual(result['score_awarded'], 0)
        self.assertFalse(result['matched'])
        self.assertEqual(result['feedback_message'], 'No work shown')


class FullAnswerEvaluationTests(TestCase):
    """Tests for complete answer evaluation."""
    
    def test_evaluate_complete_answer(self):
        """Test evaluation of a complete answer against multiple rules."""
        rubric = {
            'evaluation_rules': [
                {
                    'id': 'rule1',
                    'type': 'keyword',
                    'marks': 3,
                    'config': {
                        'required_keywords': ['mitochondria', 'ATP'],
                        'scoring_mode': 'proportional'
                    },
                    'feedback': {'on_success': 'Good keywords'}
                },
                {
                    'id': 'rule2',
                    'type': 'numeric',
                    'marks': 2,
                    'config': {
                        'expected_value': 38,
                        'tolerance': 2
                    },
                    'feedback': {'on_success': 'Correct number'}
                }
            ]
        }
        answer = "Mitochondria produce ATP through cellular respiration, generating 38 molecules."
        
        result = evaluate_answer(rubric, answer)
        
        self.assertEqual(result['total_score'], 5)  # 3 + 2
        self.assertEqual(result['max_score'], 5)
        self.assertEqual(result['percentage'], 100)
        self.assertEqual(len(result['rule_results']), 2)


class ApplyRubricTests(TestCase):
    """Tests for apply_rubric function."""
    
    def test_apply_rubric_complete(self):
        """Test applying a complete rubric to an answer."""
        rubric = {
            'evaluation_rules': [
                {
                    'id': 'rule1',
                    'type': 'keyword',
                    'marks': 4,
                    'config': {
                        'required_keywords': ['Newton', 'force', 'mass'],
                        'scoring_mode': 'proportional'
                    },
                    'feedback': {'on_success': 'Good concepts'}
                },
                {
                    'id': 'rule2',
                    'type': 'numeric',
                    'marks': 3,
                    'config': {
                        'expected_value': 100,
                        'tolerance': 0
                    },
                    'feedback': {'on_success': 'Correct answer'}
                },
                {
                    'id': 'rule3',
                    'type': 'stepwise',
                    'marks': 3,
                    'config': {
                        'step_description': 'Formula',
                        'expected_patterns': [r'F\s*=\s*ma'],
                        'allow_partial_credit': False
                    },
                    'feedback': {'on_success': 'Formula shown'}
                }
            ]
        }
        
        answer = "Newton's law states that force equals mass times acceleration. Using F = ma with m=10 kg and a=10 m/s², we get F = 100 N."
        
        result = apply_rubric(rubric, answer)
        
        # Check structure
        self.assertIn('total_score', result)
        self.assertIn('max_score', result)
        self.assertIn('rule_results', result)
        self.assertIn('feedback', result)
        
        # Check scores
        self.assertEqual(result['max_score'], 10)
        self.assertGreater(result['total_score'], 0)
        
        # Check rule results
        self.assertEqual(len(result['rule_results']), 3)
        for rule_result in result['rule_results']:
            self.assertIn('score_awarded', rule_result)
            self.assertIn('matched', rule_result)
            self.assertIn('feedback_message', rule_result)
            self.assertIn('rule_type', rule_result)
            self.assertIn('max_marks', rule_result)
        
        # Check feedback is a string with content
        self.assertIsInstance(result['feedback'], str)
        self.assertIn('Overall Score', result['feedback'])
        self.assertIn('Rule 1', result['feedback'])
        self.assertIn('Rule 2', result['feedback'])
        self.assertIn('Rule 3', result['feedback'])
    
    def test_apply_rubric_with_partial_credit(self):
        """Test rubric application with partial credit scenarios."""
        rubric = {
            'evaluation_rules': [
                {
                    'id': 'r1',
                    'type': 'keyword',
                    'marks': 6,
                    'config': {
                        'required_keywords': ['A', 'B', 'C'],
                        'scoring_mode': 'proportional'
                    },
                    'feedback': {
                        'on_success': 'All found',
                        'on_partial': 'Some found',
                        'on_failure': 'None found'
                    }
                }
            ]
        }
        
        answer = "This answer contains A and B but not the third one."
        result = apply_rubric(rubric, answer)
        
        self.assertEqual(result['max_score'], 6)
        self.assertEqual(result['total_score'], 4)  # 2/3 * 6
        self.assertIn('Some found', result['feedback'])
    
    def test_apply_rubric_empty_rules(self):
        """Test rubric with no evaluation rules."""
        rubric = {'evaluation_rules': []}
        answer = "Any answer"
        
        result = apply_rubric(rubric, answer)
        
        self.assertEqual(result['total_score'], 0)
        self.assertEqual(result['max_score'], 0)
        self.assertEqual(len(result['rule_results']), 0)
        self.assertIn('Overall Score', result['feedback'])
    
    def test_apply_rubric_feedback_format(self):
        """Test that feedback includes all required information."""
        rubric = {
            'evaluation_rules': [
                {
                    'id': 'test1',
                    'type': 'keyword',
                    'marks': 5,
                    'config': {
                        'required_keywords': ['test'],
                        'scoring_mode': 'all_or_nothing'
                    },
                    'feedback': {'on_success': 'Found it', 'on_failure': 'Missing'}
                }
            ]
        }
        
        answer = "This is a test answer."
        result = apply_rubric(rubric, answer)
        
        feedback = result['feedback']
        
        # Check feedback contains score
        self.assertIn('5', feedback)
        self.assertIn('5/5', feedback)
        
        # Check feedback contains rule info
        self.assertIn('Rule 1', feedback)
        self.assertIn('keyword', feedback)
        self.assertIn('Found it', feedback)
