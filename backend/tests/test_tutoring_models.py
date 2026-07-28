import pytest

from apps.tutoring.models import TutoringSession, SessionParticipant, SessionStatus


@pytest.fixture
def waiting_session(teacher_user, school_section):
    return TutoringSession.objects.create(
        room_id="tutoring_room_1",
        teacher=teacher_user,
        section=school_section,
    )


# Checks that a newly created tutoring session starts in "waiting" status.
@pytest.mark.django_db
def test_new_session_starts_in_waiting_status(waiting_session):
    assert waiting_session.status == SessionStatus.WAITING
    assert waiting_session.is_waiting is True
    assert waiting_session.is_active is False


# Checks that calling activate() on a waiting session moves it to "active" status.
@pytest.mark.django_db
def test_activate_moves_a_waiting_session_to_active(waiting_session):
    waiting_session.activate()

    assert waiting_session.status == SessionStatus.ACTIVE


# Checks that calling activate() on an already-active session is a harmless no-op, not an error.
@pytest.mark.django_db
def test_activate_does_nothing_if_session_is_already_active(waiting_session):
    waiting_session.activate()
    waiting_session.status = SessionStatus.ACTIVE
    waiting_session.save()

    waiting_session.activate()  # should be a no-op, not raise

    assert waiting_session.status == SessionStatus.ACTIVE


# Checks that calling end() sets the session status to "ended" and records an end timestamp.
@pytest.mark.django_db
def test_end_marks_the_session_as_ended(waiting_session):
    waiting_session.end()

    assert waiting_session.status == SessionStatus.ENDED
    assert waiting_session.ended_at is not None


# Checks that ending a session also marks all of its active participants as having left.
@pytest.mark.django_db
def test_end_marks_all_active_participants_as_left(waiting_session, student_user):
    SessionParticipant.objects.create(session=waiting_session, user=student_user)

    waiting_session.end()

    participant = SessionParticipant.objects.get(
        session=waiting_session, user=student_user
    )
    assert participant.left_at is not None


# Checks that participant_count only counts participants who haven't left yet, not ones who already left.
@pytest.mark.django_db
def test_participant_count_only_counts_active_participants(waiting_session, student_user):
    participant = SessionParticipant.objects.create(
        session=waiting_session, user=student_user
    )

    assert waiting_session.participant_count == 1

    participant.left_at = participant.joined_at
    participant.save()

    assert waiting_session.participant_count == 0


# Checks that the session's teacher is always considered a participant, even without an explicit join record.
@pytest.mark.django_db
def test_teacher_is_always_a_participant(waiting_session, teacher_user):
    assert waiting_session.is_participant(teacher_user) is True


# Checks that a student who never joined the session is correctly reported as not a participant.
@pytest.mark.django_db
def test_a_student_who_never_joined_is_not_a_participant(waiting_session, student_user):
    assert waiting_session.is_participant(student_user) is False


# Checks that a student who joined the session is correctly reported as a participant.
@pytest.mark.django_db
def test_a_student_who_joined_is_a_participant(waiting_session, student_user):
    SessionParticipant.objects.create(session=waiting_session, user=student_user)

    assert waiting_session.is_participant(student_user) is True
