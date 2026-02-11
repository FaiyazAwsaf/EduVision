"""
Tutoring Session Serializers

Serializers for the section-based batch tutoring API endpoints.
"""

from rest_framework import serializers
from apps.tutoring.models import TutoringSession, SessionParticipant, SessionStatus


# ─── Request Serializers ───────────────────────────────────────────────────────

class SessionCreateSerializer(serializers.Serializer):
    """Serializer for creating a tutoring session (requires section_id)."""
    section_id = serializers.IntegerField(
        required=True,
        help_text="ID of the section this session is for"
    )


class SessionJoinSerializer(serializers.Serializer):
    """Serializer for joining a tutoring session (by session_id)."""
    session_id = serializers.UUIDField(
        required=True,
        help_text="The session ID to join"
    )


# ─── Response Serializers ──────────────────────────────────────────────────────

class SessionCreateResponseSerializer(serializers.Serializer):
    """Response serializer for session creation."""
    session_id = serializers.UUIDField()
    room_id = serializers.CharField()
    token = serializers.CharField()
    status = serializers.CharField()
    livekit_ws_url = serializers.CharField(allow_null=True)
    section_id = serializers.IntegerField()
    section_name = serializers.CharField()
    class_name = serializers.CharField()


class SessionJoinResponseSerializer(serializers.Serializer):
    """Response serializer for session join."""
    session_id = serializers.UUIDField()
    token = serializers.CharField()
    status = serializers.CharField()
    teacher_name = serializers.CharField()
    room_id = serializers.CharField()
    livekit_ws_url = serializers.CharField(allow_null=True)
    section_name = serializers.CharField()
    class_name = serializers.CharField()
    participant_count = serializers.IntegerField()


# ─── Participant Serializer ────────────────────────────────────────────────────

class ParticipantSerializer(serializers.ModelSerializer):
    """Serializer for a session participant."""
    user_id = serializers.UUIDField(source='user.id')
    name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = SessionParticipant
        fields = ['user_id', 'name', 'role', 'joined_at', 'left_at']

    def get_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"

    def get_role(self, obj):
        return 'student'


# ─── Session Status Serializer ─────────────────────────────────────────────────

class SessionStatusSerializer(serializers.ModelSerializer):
    """Serializer for session status with participant list."""

    teacher_id = serializers.UUIDField(source='teacher.id')
    teacher_name = serializers.SerializerMethodField()
    section_id = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = TutoringSession
        fields = [
            'id',
            'room_id',
            'status',
            'teacher_id',
            'teacher_name',
            'section_id',
            'section_name',
            'class_name',
            'participants',
            'participant_count',
            'created_at',
            'ended_at',
        ]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"

    def get_section_id(self, obj):
        return obj.section_id if obj.section else None

    def get_section_name(self, obj):
        return obj.section.name if obj.section else None

    def get_class_name(self, obj):
        if obj.section and obj.section.class_ref:
            return obj.section.class_ref.name
        return None

    def get_participants(self, obj):
        active_participants = obj.participants.filter(left_at__isnull=True).select_related('user')
        return ParticipantSerializer(active_participants, many=True).data

    def get_participant_count(self, obj):
        return obj.participants.filter(left_at__isnull=True).count()


# ─── Available Sessions Serializer (Student discovery) ─────────────────────────

class AvailableSessionSerializer(serializers.ModelSerializer):
    """Serializer for student-facing session discovery."""

    teacher_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = TutoringSession
        fields = [
            'id',
            'room_id',
            'status',
            'teacher_name',
            'section_name',
            'class_name',
            'participant_count',
            'created_at',
        ]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"

    def get_section_name(self, obj):
        return obj.section.name if obj.section else None

    def get_class_name(self, obj):
        if obj.section and obj.section.class_ref:
            return obj.section.class_ref.name
        return None

    def get_participant_count(self, obj):
        return obj.participants.filter(left_at__isnull=True).count()


# ─── Session List Serializer ──────────────────────────────────────────────────

class SessionListSerializer(serializers.ModelSerializer):
    """Serializer for listing sessions."""

    teacher_name = serializers.SerializerMethodField()
    teacher_id = serializers.UUIDField(source='teacher.id')
    section_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()

    class Meta:
        model = TutoringSession
        fields = [
            'id',
            'room_id',
            'status',
            'teacher_id',
            'teacher_name',
            'section_name',
            'class_name',
            'participant_count',
            'created_at',
            'ended_at',
        ]

    def get_teacher_name(self, obj):
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"

    def get_section_name(self, obj):
        return obj.section.name if obj.section else None

    def get_class_name(self, obj):
        if obj.section and obj.section.class_ref:
            return obj.section.class_ref.name
        return None

    def get_participant_count(self, obj):
        return obj.participants.filter(left_at__isnull=True).count()


# ─── Error Response Serializer ────────────────────────────────────────────────

class ErrorResponseSerializer(serializers.Serializer):
    """Serializer for error responses."""
    error = serializers.CharField()
    detail = serializers.CharField()
    code = serializers.CharField()
