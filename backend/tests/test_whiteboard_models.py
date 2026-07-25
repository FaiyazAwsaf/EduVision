"""
Normal, beginner-style tests for the whiteboard app models.
"""
import pytest
from django.db import IntegrityError

from apps.whiteboard.models import WhiteboardSession, SessionMember, SessionRole


@pytest.mark.django_db
def test_new_whiteboard_session_is_active_by_default(teacher_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)

    assert session.is_active is True
    assert session.page_count == 1


@pytest.mark.django_db
def test_is_owner_returns_true_for_the_session_owner(teacher_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)

    assert session.is_owner(teacher_user) is True


@pytest.mark.django_db
def test_is_owner_returns_false_for_a_different_user(teacher_user, student_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)

    assert session.is_owner(student_user) is False


@pytest.mark.django_db
def test_session_member_defaults_to_student_role(teacher_user, student_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)
    member = SessionMember.objects.create(session=session, user=student_user)

    assert member.role == SessionRole.STUDENT


@pytest.mark.django_db
def test_a_user_cannot_be_added_as_a_member_of_the_same_session_twice(
    teacher_user, student_user
):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)
    SessionMember.objects.create(session=session, user=student_user)

    with pytest.raises(IntegrityError):
        SessionMember.objects.create(session=session, user=student_user)


@pytest.mark.django_db
def test_session_member_string_representation_includes_role(teacher_user, student_user):
    session = WhiteboardSession.objects.create(name="Algebra Board", owner=teacher_user)
    member = SessionMember.objects.create(
        session=session, user=student_user, role=SessionRole.VIEWER
    )

    assert str(member) == f"{student_user.username} as viewer in Algebra Board"
