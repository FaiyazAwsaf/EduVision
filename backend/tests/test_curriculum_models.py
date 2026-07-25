"""
Normal, beginner-style tests for the curriculum app models.
"""
import pytest
from django.core.exceptions import ValidationError

from apps.curriculum.models import (
    CourseOutline,
    CourseTopic,
    CourseWeek,
    TopicMaterial,
    MaterialType,
    ParsingStatus,
)


@pytest.fixture
def course_outline(teaching_assignment):
    return CourseOutline.objects.create(
        teaching_assignment=teaching_assignment,
        title="Numerical Methods",
        raw_pdf="curriculum/outlines/dummy.pdf",
        created_by=teaching_assignment.teacher,
    )


@pytest.mark.django_db
def test_new_course_outline_defaults_to_pending_status(course_outline):
    assert course_outline.parsing_status == ParsingStatus.PENDING


@pytest.mark.django_db
def test_course_outline_string_shows_title_and_status(course_outline):
    assert str(course_outline) == "Numerical Methods [PENDING]"


@pytest.mark.django_db
def test_course_week_string_includes_week_number(course_outline):
    week = CourseWeek.objects.create(course_outline=course_outline, week_number=3)

    assert str(week) == "Week 3"


@pytest.mark.django_db
def test_exam_week_string_includes_the_exam_label(course_outline):
    week = CourseWeek.objects.create(
        course_outline=course_outline,
        week_number=7,
        is_exam_week=True,
        exam_label="Midterm Examinations",
    )

    assert str(week) == "Week 7 (Midterm Examinations)"


@pytest.mark.django_db
def test_course_topic_string_is_its_title(course_outline):
    topic = CourseTopic.objects.create(
        course_outline=course_outline, title="Bisection Method"
    )

    assert str(topic) == "Bisection Method"


@pytest.mark.django_db
def test_link_material_requires_a_file(course_outline, teacher_user):
    topic = CourseTopic.objects.create(
        course_outline=course_outline, title="Bisection Method"
    )
    material = TopicMaterial(
        topic=topic,
        uploaded_by=teacher_user,
        title="Lecture Notes",
        material_type=MaterialType.FILE,
    )

    with pytest.raises(ValidationError):
        material.clean()


@pytest.mark.django_db
def test_link_material_with_external_link_type_is_valid(course_outline, teacher_user):
    topic = CourseTopic.objects.create(
        course_outline=course_outline, title="Bisection Method"
    )
    material = TopicMaterial(
        topic=topic,
        uploaded_by=teacher_user,
        title="Extra Reading",
        material_type=MaterialType.LINK,
        external_link="https://example.com/reading",
    )

    material.clean()  # should not raise
