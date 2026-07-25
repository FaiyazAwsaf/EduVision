"""
Bug-based test for SCH-002: changing a user's role through the admin API does
not reconcile TeacherProfile / StudentProfile. A student demoted or promoted
via PATCH /api/auth/admin/users/<id>/ keeps their old profile in place.
"""
import pytest

from apps.authentication.models import CustomUser
from apps.students.models import TeacherProfile, StudentProfile


@pytest.mark.django_db
def test_sch_002_changing_student_role_to_teacher_leaves_stale_student_profile(
    api_client, student_profile,
):
    """
    Expected: once a student is promoted to teacher, their old StudentProfile
    should no longer exist (or the change should be rejected until it's
    cleaned up), and a TeacherProfile should exist so the account behaves like
    a real teacher.

    Actual: AdminUserDetailView.patch() only sets `user.role` and never
    touches profiles, so both fail today.
    """
    admin_user = CustomUser.objects.create_user(
        username="roleadmin",
        email="roleadmin@example.com",
        password="AdminPass123",
        role="admin",
    )
    student_user = student_profile.user
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(
        f"/api/auth/admin/users/{student_user.id}/",
        {"role": "teacher"},
        format="json",
    )

    assert response.status_code == 200
    student_user.refresh_from_db()
    assert student_user.role == "teacher"

    # The stale student profile should be gone ...
    assert not StudentProfile.objects.filter(user=student_user).exists()
    # ... and a teacher profile should now exist for the promoted user.
    assert TeacherProfile.objects.filter(user=student_user).exists()


@pytest.mark.django_db
def test_sch_002_changing_teacher_role_to_student_leaves_stale_teacher_profile(
    api_client, teaching_assignment,
):
    admin_user = CustomUser.objects.create_user(
        username="roleadmin2",
        email="roleadmin2@example.com",
        password="AdminPass123",
        role="admin",
    )
    teacher_user = teaching_assignment.teacher
    TeacherProfile.objects.create(user=teacher_user, employee_id="EMP-100")

    api_client.force_authenticate(user=admin_user)
    response = api_client.patch(
        f"/api/auth/admin/users/{teacher_user.id}/",
        {"role": "student"},
        format="json",
    )

    assert response.status_code == 200
    teacher_user.refresh_from_db()
    assert teacher_user.role == "student"

    # Expected: demoted account should no longer retain a TeacherProfile.
    assert not TeacherProfile.objects.filter(user=teacher_user).exists()
