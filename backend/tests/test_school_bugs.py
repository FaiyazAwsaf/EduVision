import pytest

from apps.authentication.models import CustomUser
from apps.students.models import TeacherProfile, StudentProfile


# Checks that promoting a student to teacher (via admin PATCH) removes their
# old StudentProfile and gives them a TeacherProfile, instead of leaving a
# stale student record behind.
@pytest.mark.django_db
def test_sch_002_changing_student_role_to_teacher_leaves_stale_student_profile(
    api_client, student_profile,
):
    """
    Expected: once a student is promoted to teacher, their old StudentProfile
    should no longer exist, and a TeacherProfile should exist so the account behaves like
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

