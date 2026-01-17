# apply_rubric Function - Quick Reference

## Function Signature

```python
def apply_rubric(rubric: Dict[str, Any], answer_text: str) -> Dict[str, Any]:
```

## Description

Applies a complete rubric to evaluate a student's answer. This function:
1. Loops through all evaluation rules in order
2. Applies the correct evaluator based on rule type (keyword/numeric/stepwise)
3. Accumulates the total score across all rules
4. Collects detailed results for each rule
5. Generates a combined feedback summary

## Parameters

- **rubric** (Dict): Dictionary containing rubric data with `evaluation_rules` list
- **answer_text** (str): Clean plain text of the student's answer (no OCR needed)

## Returns

Dictionary with four keys:

- **total_score** (float): Total marks awarded across all rules
- **max_score** (float): Maximum possible marks
- **rule_results** (list): List of individual rule evaluation results, each containing:
  - `score_awarded`: Marks awarded for this rule
  - `matched`: Boolean indicating full match
  - `feedback_message`: Feedback text for this rule
  - `rule_id`: ID of the rule
  - `rule_type`: Type of rule (keyword/numeric/stepwise)
  - `max_marks`: Maximum marks for this rule
- **feedback** (str): Combined feedback summary with:
  - Overall score and percentage
  - Individual feedback for each rule
  - Rule-by-rule breakdown

## Example Usage

```python
from apps.rubrics.services import apply_rubric

# Define a rubric with multiple rule types
rubric = {
    'evaluation_rules': [
        {
            'id': 'rule-1',
            'type': 'keyword',
            'marks': 4,
            'config': {
                'required_keywords': ['Newton', 'force', 'mass', 'acceleration'],
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
        },
        {
            'id': 'rule-3',
            'type': 'stepwise',
            'marks': 3,
            'config': {
                'step_description': 'Formula shown',
                'expected_patterns': [r'F\s*=\s*ma'],
                'allow_partial_credit': False
            },
            'feedback': {
                'on_success': 'Formula correctly shown.',
                'on_failure': 'Formula not shown.'
            }
        }
    ]
}

# Student's answer
answer = """
Newton's second law states that force equals mass times acceleration.
Using F = ma, with m=10kg and a=10m/s², we calculate F = 100 N.
"""

# Apply the rubric
result = apply_rubric(rubric, answer)

print(f"Score: {result['total_score']}/{result['max_score']}")
print(f"\nFeedback:\n{result['feedback']}")
```

## Output Example

```
Score: 10.0/10

Feedback:
Overall Score: 10.0/10 (100.0%)
--------------------------------------------------
Rule 1 (keyword): 4.0/4 marks - All key terms identified.
Rule 2 (numeric): 3/3 marks - Correct final answer.
Rule 3 (stepwise): 3/3 marks - Formula correctly shown.
```

## Integration with Views

Example of using `apply_rubric` in a Django view:

```python
from rest_framework.decorators import api_view
from rest_framework.response import Response
from apps.rubrics.models import Rubric
from apps.rubrics.services import apply_rubric

@api_view(['POST'])
def evaluate_student_answer(request, rubric_id):
    """
    Evaluate a student's answer against a rubric.
    
    Request body:
    {
        "answer_text": "Student's answer as plain text"
    }
    """
    # Get the rubric
    rubric = Rubric.objects.get(id=rubric_id)
    
    # Get the answer text from request
    answer_text = request.data.get('answer_text', '')
    
    # Apply the rubric
    result = apply_rubric(
        rubric={'evaluation_rules': rubric.evaluation_rules},
        answer_text=answer_text
    )
    
    # Return the evaluation result
    return Response({
        'rubric_id': rubric_id,
        'rubric_title': rubric.title,
        'total_score': result['total_score'],
        'max_score': result['max_score'],
        'percentage': round(result['total_score'] / result['max_score'] * 100, 1),
        'feedback': result['feedback'],
        'rule_results': result['rule_results']
    })
```

## Rule Evaluation Logic

The function processes rules in the order they appear in `evaluation_rules`:

1. **Keyword Rules**: 
   - Checks for presence of required keywords (case-insensitive)
   - Supports proportional or all-or-nothing scoring

2. **Numeric Rules**:
   - Extracts all numeric values from the answer
   - Matches against expected value within tolerance
   - Awards full marks if match found, zero otherwise

3. **Stepwise Rules**:
   - Checks if expected regex patterns are present
   - Supports partial credit based on matched patterns
   - Can require all patterns for credit

## Key Features

✓ **Sequential Processing**: Rules are evaluated in order  
✓ **Type-Safe**: Correct evaluator is selected based on rule type  
✓ **Accumulative Scoring**: Scores are summed across all rules  
✓ **Detailed Results**: Individual results preserved for each rule  
✓ **Combined Feedback**: Automatic generation of formatted feedback summary  
✓ **Error Handling**: Unknown rule types are handled gracefully  
✓ **No ML/OCR**: Pure text-based evaluation  

## Testing

Run the test suite:
```bash
python manage.py test apps.rubrics.test_services.ApplyRubricTests
```

All tests should pass, covering:
- Complete rubric application
- Partial credit scenarios
- Empty rule lists
- Feedback formatting
- Score calculations

## See Also

- `evaluate_keyword_rule()` - Individual keyword evaluation
- `evaluate_numeric_rule()` - Individual numeric evaluation
- `evaluate_stepwise_rule()` - Individual stepwise evaluation
- `evaluate_answer()` - Alternative function that returns percentage instead of feedback
