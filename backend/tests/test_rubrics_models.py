"""
Normal, beginner-style tests for the rubrics app models and evaluators.
"""
import pytest

from apps.rubrics.models import RubricSet, QuestionRubric
from apps.rubrics.services import evaluate_keyword_rule, evaluate_numeric_rule


@pytest.mark.django_db
def test_new_rubric_set_starts_as_draft_at_version_one():
    rubric_set = RubricSet.objects.create(
        title="Algebra Quiz",
        subject="Mathematics",
        total_marks=20,
    )

    assert rubric_set.state == RubricSet.STATE_DRAFT
    assert rubric_set.version == 1


@pytest.mark.django_db
def test_rubric_set_string_representation_includes_version_and_state():
    rubric_set = RubricSet.objects.create(
        title="Algebra Quiz",
        subject="Mathematics",
        total_marks=20,
    )

    assert str(rubric_set) == "Algebra Quiz (v1) - draft"


@pytest.mark.django_db
def test_question_rubric_string_includes_question_number():
    rubric_set = RubricSet.objects.create(
        title="Algebra Quiz", subject="Mathematics", total_marks=20
    )
    question = QuestionRubric.objects.create(
        rubric_set=rubric_set,
        question_number=1,
        question_text="Solve for x",
        max_marks=10,
    )

    assert str(question) == "Algebra Quiz - Q1"


@pytest.mark.django_db
def test_publishing_a_rubric_set_bumps_its_version():
    rubric_set = RubricSet.objects.create(
        title="Algebra Quiz", subject="Mathematics", total_marks=20
    )

    rubric_set.state = RubricSet.STATE_PUBLISHED
    rubric_set.save()

    assert rubric_set.version == 2


def test_keyword_rule_awards_full_marks_when_all_keywords_are_present():
    rule = {
        "id": "rule-1",
        "marks": 10,
        "config": {
            "required_keywords": ["mitosis", "cell division"],
            "scoring_mode": "proportional",
        },
    }

    result = evaluate_keyword_rule(rule, "Mitosis is a type of cell division.")

    assert result["score_awarded"] == 10


def test_keyword_rule_awards_zero_when_no_keywords_are_present():
    rule = {
        "id": "rule-1",
        "marks": 10,
        "config": {
            "required_keywords": ["photosynthesis"],
            "scoring_mode": "proportional",
        },
    }

    result = evaluate_keyword_rule(rule, "The mitochondria is the powerhouse of the cell.")

    assert result["score_awarded"] == 0


def test_numeric_rule_matches_a_value_within_tolerance():
    rule = {
        "id": "rule-1",
        "marks": 5,
        "config": {"expected_value": 9.8, "tolerance": 0.2},
    }

    result = evaluate_numeric_rule(rule, "The acceleration is approximately 9.9 m/s^2.")

    assert result["matched"] is True
    assert result["score_awarded"] == 5


def test_numeric_rule_does_not_match_a_value_outside_tolerance():
    rule = {
        "id": "rule-1",
        "marks": 5,
        "config": {"expected_value": 9.8, "tolerance": 0.2},
    }

    result = evaluate_numeric_rule(rule, "The acceleration is approximately 5 m/s^2.")

    assert result["matched"] is False
    assert result["score_awarded"] == 0
