import pytest
from django.db import IntegrityError

from apps.whiteboard.models import WhiteboardSession, SessionMember, SessionRole


# Checks that a newly created whiteboard session is active by default and starts with one page.
@pytest.mark.django_db
def test_new_whiteboard_session_is_active_by_default(teacher_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)

    assert session.is_active is True
    assert session.page_count == 1


# Checks that is_owner() returns true when checked with the user who owns the session.
@pytest.mark.django_db
def test_is_owner_returns_true_for_the_session_owner(teacher_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)

    assert session.is_owner(teacher_user) is True


# Checks that is_owner() returns false when checked with a user who does not own the session.
@pytest.mark.django_db
def test_is_owner_returns_false_for_a_different_user(teacher_user, student_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)

    assert session.is_owner(student_user) is False


# Checks that a new session member defaults to the "student" role when no role is specified.
@pytest.mark.django_db
def test_session_member_defaults_to_student_role(teacher_user, student_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)
    member = SessionMember.objects.create(session=session, user=student_user)

    assert member.role == SessionRole.STUDENT


# Checks that the database rejects adding the same user as a member of the same session more than once.
@pytest.mark.django_db
def test_a_user_cannot_be_added_as_a_member_of_the_same_session_twice(
    teacher_user, student_user
):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)
    SessionMember.objects.create(session=session, user=student_user)

    with pytest.raises(IntegrityError):
        SessionMember.objects.create(session=session, user=student_user)


# Checks that printing a session member shows their username, role, and session name.
@pytest.mark.django_db
def test_session_member_string_representation_includes_role(teacher_user, student_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)
    member = SessionMember.objects.create(
        session=session, user=student_user, role=SessionRole.VIEWER
    )

    assert str(member) == f"{student_user.username} as viewer in Algebra Board"
