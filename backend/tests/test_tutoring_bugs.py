"""
Bug-based tests for TUT-005: concurrent requests can create multiple active
sessions/participations because there's no database-level constraint
preventing a teacher from owning two simultaneously-active sessions.

(SessionParticipant *does* have a correct partial-unique constraint for a
single session; the gap is at the TutoringSession level: nothing stops one
teacher from having two rows with status in {WAITING, ACTIVE, GRACE} at once.)
"""
import pytest
from django.db import IntegrityError, transaction

from apps.tutoring.models import TutoringSession, SessionParticipant, SessionStatus


@pytest.mark.django_db
def test_session_participant_unique_constraint_blocks_two_active_rows_for_same_user(
    teacher_user, student_user, school_section,
):
    """Sanity check: the existing partial-unique constraint on
    SessionParticipant does correctly prevent two *active* rows for the same
    (session, user) pair."""
    session = TutoringSession.objects.create(
        room_id="tutoring_room_1",
        teacher=teacher_user,
        section=school_section,
        status=SessionStatus.ACTIVE,
    )
    SessionParticipant.objects.create(session=session, user=student_user)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            SessionParticipant.objects.create(session=session, user=student_user)


@pytest.mark.django_db
def test_tut_005_a_teacher_cannot_own_two_simultaneously_active_sessions(
    teacher_user, school_section,
):
    """
    Expected: the database should prevent a second WAITING/ACTIVE/GRACE
    session from being created for a teacher who already has one, so a race
    between two "Start Session" clicks can't create duplicates.

    Actual: TutoringSession has no such constraint, so this succeeds today
    (the API-level check in SessionCreateView is a race-prone
    check-then-create, not enforced by the database).
    """
    TutoringSession.objects.create(
        room_id="tutoring_room_a",
        teacher=teacher_user,
        section=school_section,
        status=SessionStatus.ACTIVE,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            TutoringSession.objects.create(
                room_id="tutoring_room_b",
                teacher=teacher_user,
                section=school_section,
                status=SessionStatus.WAITING,
            )
