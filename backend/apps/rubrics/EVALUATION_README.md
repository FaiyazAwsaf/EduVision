# Rubric Evaluation Functions

This module provides rule evaluation functions for the EduVision rubric system. The functions evaluate student answers against different types of evaluation rules without using OCR or ML.

## Files Created

- **`services.py`**: Core evaluation functions
- **`test_services.py`**: Comprehensive test suite with 15 test cases
- **`example_usage.py`**: Usage examples and demonstrations

## Evaluation Functions

### 1. `evaluate_keyword_rule(rule, answer_text)`

Evaluates whether required keywords are present in the answer.

**Parameters:**
- `rule`: Dictionary containing:
  - `marks`: float - marks allocated to this rule
  - `config`: dict with:
    - `required_keywords`: list of keywords to match
    - `scoring_mode`: "proportional" or "all_or_nothing"
  - `feedback`: dict with on_success, on_failure, on_partial messages
- `answer_text`: Clean plain text of student's answer

**Returns:**
- `score_awarded`: float - marks awarded based on keyword matches
- `matched`: bool - True if all keywords found
- `feedback_message`: str - feedback for the student

**Features:**
- Case-insensitive matching
- Word boundary detection (avoids partial word matches)
- Two scoring modes:
  - **Proportional**: Awards marks based on percentage of keywords found
  - **All-or-nothing**: Awards full marks only if all keywords present

**Example:**
```python
rule = {
    'marks': 5,
    'config': {
        'required_keywords': ['photosynthesis', 'chlorophyll', 'glucose'],
        'scoring_mode': 'proportional'
    },
    'feedback': {
        'on_success': 'All key concepts identified.',
        'on_partial': 'Some concepts missing.',
        'on_failure': 'No key concepts found.'
    }
}

answer = "Photosynthesis uses chlorophyll to produce glucose from sunlight."
result = evaluate_keyword_rule(rule, answer)
# Returns: {'score_awarded': 5.0, 'matched': True, 'feedback_message': '...'}
```

---

### 2. `evaluate_numeric_rule(rule, answer_text)`

Evaluates whether the correct numeric value appears in the answer within an acceptable tolerance.

**Parameters:**
- `rule`: Dictionary containing:
  - `marks`: float - marks allocated to this rule
  - `config`: dict with:
    - `expected_value`: float - the expected numeric answer
    - `tolerance`: float - acceptable deviation (default 0.0)
  - `feedback`: dict with on_success, on_failure messages
- `answer_text`: Clean plain text of student's answer

**Returns:**
- `score_awarded`: float - marks awarded (full marks if match, 0 otherwise)
- `matched`: bool - True if numeric value matches within tolerance
- `feedback_message`: str - feedback for the student

**Features:**
- Extracts all numeric values from text (integers, floats, scientific notation)
- Checks if any extracted value matches expected value within tolerance
- Handles negative numbers
- Reports all found values in feedback if no match

**Example:**
```python
rule = {
    'marks': 3,
    'config': {
        'expected_value': 9.81,
        'tolerance': 0.1
    },
    'feedback': {
        'on_success': 'Correct!',
        'on_failure': 'Incorrect value.'
    }
}

answer = "The acceleration is 9.8 m/s²"
result = evaluate_numeric_rule(rule, answer)
# Returns: {'score_awarded': 3, 'matched': True, 'feedback_message': '...'}
```

---

### 3. `evaluate_stepwise_rule(rule, answer_text)`

Evaluates whether expected patterns (indicating steps or work shown) are present in the answer.

**Parameters:**
- `rule`: Dictionary containing:
  - `marks`: float - marks allocated to this rule
  - `config`: dict with:
    - `step_description`: str - description of the step
    - `expected_patterns`: list of regex patterns to match
    - `allow_partial_credit`: bool - whether partial credit is allowed
  - `feedback`: dict with on_success, on_failure, on_partial messages
- `answer_text`: Clean plain text of student's answer

**Returns:**
- `score_awarded`: float - marks awarded based on patterns matched
- `matched`: bool - True if all patterns matched
- `feedback_message`: str - feedback for the student

**Features:**
- Uses regex pattern matching (case-insensitive, multiline)
- Supports partial credit when some patterns match
- Can require all patterns to be present (no partial credit)
- Reports proportion of patterns found

**Example:**
```python
rule = {
    'marks': 6,
    'config': {
        'step_description': 'Derivation steps',
        'expected_patterns': [
            r'F\s*=\s*ma',  # Formula
            r'\d+\s*kg',     # Mass with units
            r'\d+\s*m/s'     # Acceleration with units
        ],
        'allow_partial_credit': True
    },
    'feedback': {
        'on_success': 'Complete working shown.',
        'on_partial': 'Some steps shown.',
        'on_failure': 'No working shown.'
    }
}

answer = "Using F = ma with mass of 10 kg and acceleration of 5 m/s²"
result = evaluate_stepwise_rule(rule, answer)
# Returns: {'score_awarded': 6, 'matched': True, 'feedback_message': '...'}
```

---

### 4. `evaluate_answer(rubric, answer_text)` (Bonus)

Convenience function that evaluates a complete answer against all rules in a rubric.

**Parameters:**
- `rubric`: Dictionary containing `evaluation_rules` list
- `answer_text`: Clean plain text of student's answer

**Returns:**
- `total_score`: float - total marks awarded
- `max_score`: float - maximum possible marks
- `percentage`: float - percentage score
- `rule_results`: list of individual rule evaluation results

**Example:**
```python
rubric = {
    'evaluation_rules': [
        {'type': 'keyword', 'marks': 5, 'config': {...}},
        {'type': 'numeric', 'marks': 3, 'config': {...}},
        {'type': 'stepwise', 'marks': 4, 'config': {...}}
    ]
}

result = evaluate_answer(rubric, answer_text)
# Returns: {
#     'total_score': 10.5,
#     'max_score': 12,
#     'percentage': 87.5,
#     'rule_results': [...]
# }
```

---

## Testing

All functions are thoroughly tested with 15 test cases covering:

- Keyword matching (all-or-nothing and proportional modes)
- Numeric value extraction and tolerance checking
- Stepwise pattern matching with partial credit
- Edge cases (no matches, partial matches, case sensitivity, etc.)

Run tests with:
```bash
cd backend
python manage.py test apps.rubrics.test_services
```

Expected output: **15 tests passed ✓**

---

## Implementation Details

### Design Decisions

1. **No External Dependencies**: Functions use only Python standard library (no OCR/ML)
2. **Case-Insensitive Matching**: Keywords and patterns are matched case-insensitively
3. **Word Boundaries**: Keyword matching uses `\b` regex boundaries to avoid partial matches
4. **Flexible Scoring**: Both strict and proportional scoring modes supported
5. **Regex-Based Patterns**: Stepwise rules use regex for flexible pattern matching
6. **Numeric Extraction**: Handles various number formats (integers, decimals, scientific notation)

### Text Processing

- **Keyword Rule**: Uses `re.search()` with word boundaries and case-insensitive flag
- **Numeric Rule**: Regex pattern `-?\d+\.?\d*(?:[eE][+-]?\d+)?` extracts all numbers
- **Stepwise Rule**: Direct regex pattern matching with `re.IGNORECASE | re.MULTILINE`

### Error Handling

- Invalid regex patterns in stepwise rules are silently skipped
- Division by zero is prevented with appropriate checks
- All scores are rounded to 2 decimal places

---

## Integration with EduVision

These functions integrate with the existing rubric system:

1. **Models**: Works with the `Rubric` model's `evaluation_rules` JSONB field
2. **Schemas**: Compatible with Pydantic schemas in `schemas.py`:
   - `KeywordRuleConfig`
   - `NumericRuleConfig`
   - `StepwiseRuleConfig`
3. **Views**: Can be called from rubric views to evaluate student answers

Example integration in views:
```python
from apps.rubrics.services import evaluate_answer

def evaluate_student_answer(request):
    rubric = Rubric.objects.get(id=rubric_id)
    student_answer = request.data.get('answer_text')
    
    result = evaluate_answer(
        rubric.evaluation_rules,
        student_answer
    )
    
    return Response(result)
```

---

## Example Usage

See `example_usage.py` for complete working examples. Run with:
```bash
cd backend
python apps/rubrics/example_usage.py
```

This will demonstrate all three evaluation functions with sample questions and answers.

---

## Future Enhancements

Possible improvements:
1. Add synonym matching for keywords (e.g., "H2O" = "water")
2. Support unit conversion in numeric rules
3. Add confidence scoring for partial matches
4. Support weighted keyword importance
5. Add semantic similarity checking (would require ML)

---

## License

Part of the EduVision project.
