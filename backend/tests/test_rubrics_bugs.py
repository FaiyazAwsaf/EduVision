"""
Bug-based test for RUB-005: PDF-generated stepwise rules always score zero.

The publish validator (RubricSetPublishSerializer.validate, in
backend/apps/rubrics/serializers.py) checks that a question has non-empty
evaluation_rules and that rule marks sum to the question's max_marks, but it
never checks that a "stepwise" rule actually has expected_patterns configured.
A rubric imported from a PDF that lost its expected_patterns (a common AI
extraction gap) can therefore be published even though it can never award any
marks — evaluate_stepwise_rule() will always return 0 for it.
"""
import pytest

from apps.rubrics.models import RubricSet, QuestionRubric
from apps.rubrics.serializers import RubricSetPublishSerializer
from apps.rubrics.services import evaluate_stepwise_rule


def test_stepwise_rule_with_no_expected_patterns_always_scores_zero():
    """Sanity check confirming the actual runtime effect of the gap."""
    rule = {
        "id": "rule-1",
        "type": "stepwise",
        "marks": 10,
        "config": {
            "step_description": "State the quadratic formula",
            "expected_patterns": [],
            "allow_partial_credit": True,
        },
    }

    result = evaluate_stepwise_rule(rule, "x = (-b +/- sqrt(b^2-4ac)) / 2a")

    assert result["score_awarded"] == 0.0


@pytest.mark.django_db
def test_rub_005_publish_validation_should_reject_a_stepwise_rule_with_no_patterns():
    rubric_set = RubricSet.objects.create(
        title="Algebra Quiz",
        subject="Mathematics",
        total_marks=10,
        state=RubricSet.STATE_DRAFT,
    )
    QuestionRubric.objects.create(
        rubric_set=rubric_set,
        question_number=1,
        question_text="State the quadratic formula.",
        max_marks=10,
        evaluation_rules=[
            {
                "id": "rule-1",
                "type": "stepwise",
                "marks": 10,
                "config": {
                    "step_description": "State the formula",
                    "expected_patterns": [],  # lost during PDF import
                    "allow_partial_credit": True,
                },
            }
        ],
    )

    serializer = RubricSetPublishSerializer(
        data={}, context={"rubric_set": rubric_set}
    )

    # Expected: publishing a rubric that can never award marks should be rejected.
    assert serializer.is_valid() is False
