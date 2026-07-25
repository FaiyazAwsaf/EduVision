"""
Bug-based tests for CUR-003: difficulty alerts are spoofable and stale.

1. A student who flags a topic but does NOT belong to the topic's section
   still gets counted in flag_count / percentage (an "outsider" flag).
2. Unflagging a topic never re-checks the threshold, so a notification that
   is no longer justified (enough students unflagged) stays active/unread.
"""
import pytest

from apps.authentication.models import CustomUser
from apps.curriculum.models import CourseOutline, CourseTopic, TeacherNotification
from apps.curriculum.services import difficulty_service
from apps.students.models import Class as SchoolClass, Section, StudentProfile


@pytest.fixture
def course_topic_with_outline(teaching_assignment):
    outline = CourseOutline.objects.create(
        teaching_assignment=teaching_assignment,
        title="Numerical Methods",
        raw_pdf="curriculum/outlines/dummy.pdf",
        created_by=teaching_assignment.teacher,
    )
    topic = CourseTopic.objects.create(
        course_outline=outline,
        title="Bisection Method",
    )
    return topic


@pytest.mark.django_db
def test_cur_003_flag_from_a_student_outside_the_section_is_not_counted(
    course_topic_with_outline, teaching_assignment,
):
    """
    Only students actually enrolled in the topic's section should count
    towards flag_count / percentage in the teacher's difficulty report.
    """
    topic = course_topic_with_outline

    # A student who does NOT belong to the topic's section.
    other_class = SchoolClass.objects.create(
        name="9", stream="Arts", academic_year="2026-2027"
    )
    other_section = Section.objects.create(class_ref=other_class, name="Z")
    outsider = CustomUser.objects.create_user(
        username="outsider",
        email="outsider@example.com",
        password="Pass12345",
        role="student",
    )
    StudentProfile.objects.create(
        user=outsider, roll_number="OUT-1", section=other_section
    )

    difficulty_service.flag_topic(outsider, topic.id)

    report = difficulty_service.get_difficulty_report(
        topic.course_outline_id
    )
    topic_report = next(r for r in report if r["topic_id"] == str(topic.id))

    # Expected: the outsider's flag should not count against this section's total.
    assert topic_report["flag_count"] == 0