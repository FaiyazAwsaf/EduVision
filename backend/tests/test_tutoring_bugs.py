import pytest
from django.db import IntegrityError, transaction

from apps.tutoring.models import TutoringSession, SessionParticipant, SessionStatus


# Checks that the database rejects adding the same user twice as an active
# participant in the same session.
@pytest.mark.django_db
def test_session_participant_unique_constraint_blocks_two_active_rows_for_same_user(
    teacher_user, student_user, school_section,
):
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

