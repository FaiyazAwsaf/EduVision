import pytest
from rest_framework.test import APIClient

from apps.authentication.models import CustomUser
from apps.students.models import (
    Class as SchoolClass,
    Section,
    StudentProfile,
    Subject,
    TeacherSubjectAssignment,
)


def _grpc_importable() -> bool:
    """
    Some local machines block grpc's native extension via Windows Application
    Control policy (see tests/README.md). google-generativeai depends on grpc
    and several apps import it at module load time, so on such machines any
    test that resolves Django's URL conf (i.e. uses api_client) crashes with
    an unrelated ImportError/TypeError regardless of what it's testing.
    """
    try:
        import grpc  # noqa: F401
        return True
    except Exception:
        return False


GRPC_IMPORTABLE = _grpc_importable()


@pytest.fixture
def api_client():
    """A fresh API client for every test."""
    if not GRPC_IMPORTABLE:
        pytest.skip(
            "grpc is not importable on this machine (Application Control policy "
            "or protobuf/Python version mismatch) — see tests/README.md. This "
            "test is expected to pass on a machine/CI without that restriction."
        )
    return APIClient()


@pytest.fixture
def student_user():
    return CustomUser.objects.create_user(
        username="student1",
        email="student1@example.com",
        password="StudentPass123",
        first_name="Student",
        last_name="One",
        role="student",
    )


@pytest.fixture
def teacher_user():
    return CustomUser.objects.create_user(
        username="teacher1",
        email="teacher1@example.com",
        password="TeacherPass123",
        first_name="Teacher",
        last_name="One",
        role="teacher",
    )


@pytest.fixture
def school_section():
    school_class = SchoolClass.objects.create(
        name="10",
        stream="Science",
        academic_year="2026-2027",
    )
    return Section.objects.create(class_ref=school_class, name="A", capacity=1)


@pytest.fixture
def student_profile(student_user, school_section):
    return StudentProfile.objects.create(
        user=student_user,
        roll_number="S-001",
        section=school_section,
    )


@pytest.fixture
def teaching_assignment(teacher_user, school_section):
    subject = Subject.objects.create(name="Mathematics", code="MATH")
    return TeacherSubjectAssignment.objects.create(
        teacher=teacher_user,
        subject=subject,
        section=school_section,
    )
