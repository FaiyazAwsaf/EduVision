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


# Checks that a newly created course outline starts with PENDING parsing status.
@pytest.mark.django_db
def test_new_course_outline_defaults_to_pending_status(course_outline):
    assert course_outline.parsing_status == ParsingStatus.PENDING


# Checks that a material marked as type FILE fails validation if no file is actually attached.
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


# Checks that a material marked as type LINK passes validation when it has an external link.
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

    material.clean()
