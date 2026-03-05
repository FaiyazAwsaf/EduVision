"""
Tutoring Session Models

Implements section-based batch tutoring sessions.
A teacher creates a session for a specific section,
and all students from that section can join.
"""

import uuid
from django.db import models
from django.utils import timezone


class SessionStatus(models.TextChoices):
    """
    Session status state machine.

    State transitions:
    - WAITING -> ACTIVE (when first student joins)
    - WAITING -> ENDED (when teacher ends empty session)
    - ACTIVE -> GRACE (when teacher disconnects - Phase 6)
    - ACTIVE -> ENDED (when teacher ends session)
    - GRACE -> ACTIVE (when teacher reconnects - Phase 6)
    - GRACE -> ENDED (when grace period expires - Phase 6)
    """
    WAITING = 'WAITING', 'Waiting for students'
    ACTIVE = 'ACTIVE', 'Session active'
    GRACE = 'GRACE', 'Grace period (teacher absent)'
    ENDED = 'ENDED', 'Session ended'


class TutoringSession(models.Model):
    """
    Tutoring session model.

    Core concepts:
    - Every session has ONE teacher (owner)
    - A session targets a specific Section
    - Multiple students from that section can join
    - Teachers control session lifecycle
    - Student participation is tracked via SessionParticipant
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the session"
    )
    room_id = models.CharField(
        max_length=100,
        unique=True,
        help_text="LiveKit room identifier (format: tutoring_{uuid})"
    )
    teacher = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.CASCADE,
        related_name='teacher_sessions',
        help_text="Teacher who owns this session"
    )
    section = models.ForeignKey(
        'students.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tutoring_sessions',
        help_text="Section this session is for"
    )
    status = models.CharField(
        max_length=10,
        choices=SessionStatus.choices,
        default=SessionStatus.WAITING,
        help_text="Current session state"
    )
    livekit_token_teacher = models.TextField(
        null=True,
        blank=True,
        help_text="LiveKit access token for teacher"
    )
    grace_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When grace period expires (Phase 6)"
    )
    created_at = models.DateTimeField(
        default=timezone.now,
        help_text="When the session was created"
    )
    ended_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the session was ended"
    )

    class Meta:
        db_table = 'tutoring_sessions'
        verbose_name = 'Tutoring Session'
        verbose_name_plural = 'Tutoring Sessions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['room_id']),
            models.Index(fields=['status']),
            models.Index(fields=['teacher']),
            models.Index(fields=['section', 'status']),
        ]

    def __str__(self):
        section_label = f" [{self.section}]" if self.section else ""
        return f"Session {self.room_id}{section_label} ({self.status})"

    @property
    def is_waiting(self) -> bool:
        return self.status == SessionStatus.WAITING

    @property
    def is_active(self) -> bool:
        return self.status == SessionStatus.ACTIVE

    @property
    def is_ended(self) -> bool:
        return self.status == SessionStatus.ENDED

    @property
    def participant_count(self) -> int:
        """Number of students who have joined and not left."""
        return self.participants.filter(left_at__isnull=True).count()

    def activate(self) -> None:
        """Activate session when the first student joins."""
        if self.status == SessionStatus.WAITING:
            self.status = SessionStatus.ACTIVE
            self.save(update_fields=['status'])

    def end(self) -> None:
        """End the session permanently. Mark all participants as left."""
        self.status = SessionStatus.ENDED
        self.ended_at = timezone.now()
        self.save(update_fields=['status', 'ended_at'])
        # Mark all active participants as left
        self.participants.filter(left_at__isnull=True).update(left_at=timezone.now())

    def is_participant(self, user) -> bool:
        """Check if user is the teacher or an active participant."""
        if self.teacher_id == user.id:
            return True
        return self.participants.filter(user=user, left_at__isnull=True).exists()


class SessionParticipant(models.Model):
    """
    Tracks individual student participation in a tutoring session.
    Each student gets their own LiveKit token and join/leave timestamps.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    session = models.ForeignKey(
        TutoringSession,
        on_delete=models.CASCADE,
        related_name='participants',
    )
    user = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.CASCADE,
        related_name='session_participations',
    )
    livekit_token = models.TextField(
        blank=True,
        help_text="LiveKit access token for this participant"
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'tutoring_session_participants'
        ordering = ['joined_at']
        constraints = [
            models.UniqueConstraint(
                fields=['session', 'user'],
                condition=models.Q(left_at__isnull=True),
                name='unique_active_participant',
            )
        ]

    def __str__(self):
        status = "active" if self.left_at is None else "left"
        return f"{self.user} in {self.session.room_id} ({status})"
