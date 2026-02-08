"""
Tutoring Session Models

Implements the core models for Module 5: One-on-One Live Tutoring Room.
Includes User model with role-based authority and TutoringSession model
for managing tutoring room lifecycle.
"""

import uuid
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    """User role enumeration for role-based access control."""
    TEACHER = 'TEACHER', 'Teacher'
    STUDENT = 'STUDENT', 'Student'


class SessionStatus(models.TextChoices):
    """
    Session status state machine.
    
    State transitions:
    - WAITING → ACTIVE (when student joins)
    - WAITING → ENDED (when teacher ends empty session)
    - ACTIVE → GRACE (when teacher disconnects - Phase 6)
    - ACTIVE → ENDED (when either party ends session)
    - GRACE → ACTIVE (when teacher reconnects - Phase 6)
    - GRACE → ENDED (when grace period expires - Phase 6)
    """
    WAITING = 'WAITING', 'Waiting for student'
    ACTIVE = 'ACTIVE', 'Session active'
    GRACE = 'GRACE', 'Grace period (teacher absent)'
    ENDED = 'ENDED', 'Session ended'


class TutoringUser(models.Model):
    """
    User model for tutoring system.
    
    Implements role-based authority:
    - TEACHER: Can create and control sessions
    - STUDENT: Can only join existing sessions
    
    Linked to authentication.CustomUser via a OneToOneField
    so tutoring profiles map back to real auth accounts.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the user"
    )
    account = models.OneToOneField(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tutoring_profile',
        help_text="Link to the authentication account (nullable for legacy/test users)"
    )
    email = models.EmailField(
        unique=True,
        help_text="User's email address (unique identifier)"
    )
    full_name = models.CharField(
        max_length=255,
        help_text="User's full display name"
    )
    role = models.CharField(
        max_length=10,
        choices=UserRole.choices,
        help_text="User's role determining their permissions"
    )
    created_at = models.DateTimeField(
        default=timezone.now,
        help_text="When the user was created"
    )

    class Meta:
        db_table = 'tutoring_users'
        verbose_name = 'Tutoring User'
        verbose_name_plural = 'Tutoring Users'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.full_name} ({self.role})"

    @property
    def is_teacher(self) -> bool:
        """Check if user has teacher role."""
        return self.role == UserRole.TEACHER

    @property
    def is_student(self) -> bool:
        """Check if user has student role."""
        return self.role == UserRole.STUDENT


class TutoringSession(models.Model):
    """
    Tutoring session model.
    
    Core concepts:
    - Every session has ONE teacher (owner)
    - Every session can have ZERO or ONE student
    - Teachers control session lifecycle
    - Students are participants, not controllers
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
        TutoringUser,
        on_delete=models.CASCADE,
        related_name='teacher_sessions',
        help_text="Teacher who owns this session"
    )
    student = models.ForeignKey(
        TutoringUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_sessions',
        help_text="Student who joined this session (null if no student yet)"
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
    livekit_token_student = models.TextField(
        null=True,
        blank=True,
        help_text="LiveKit access token for student"
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
            models.Index(fields=['student']),
        ]

    def __str__(self):
        return f"Session {self.room_id} ({self.status})"

    @property
    def is_waiting(self) -> bool:
        """Check if session is waiting for student."""
        return self.status == SessionStatus.WAITING

    @property
    def is_active(self) -> bool:
        """Check if session is active (both participants present)."""
        return self.status == SessionStatus.ACTIVE

    @property
    def is_ended(self) -> bool:
        """Check if session has ended."""
        return self.status == SessionStatus.ENDED

    @property
    def has_student(self) -> bool:
        """Check if a student has joined."""
        return self.student is not None

    def can_student_join(self) -> bool:
        """
        Check if a student can join this session.
        
        Returns True if:
        - Session exists
        - Session is not ended
        - No student has joined yet
        """
        return not self.is_ended and not self.has_student

    def activate(self, student: TutoringUser, token: str) -> None:
        """
        Activate session when a student joins.
        
        Args:
            student: The student joining the session
            token: LiveKit access token for the student
        """
        self.student = student
        self.livekit_token_student = token
        self.status = SessionStatus.ACTIVE
        self.save()

    def end(self) -> None:
        """End the session permanently."""
        self.status = SessionStatus.ENDED
        self.ended_at = timezone.now()
        self.save()

    def is_participant(self, user: TutoringUser) -> bool:
        """
        Check if user is a participant (teacher or student) of this session.
        
        Args:
            user: The user to check
            
        Returns:
            True if user is the teacher or student of this session
        """
        return self.teacher_id == user.id or self.student_id == user.id
