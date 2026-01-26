"""
Tutoring Session Serializers

Serializers for the tutoring API endpoints.
"""

from rest_framework import serializers
from apps.tutoring.models import TutoringUser, TutoringSession, UserRole, SessionStatus


class TutoringUserSerializer(serializers.ModelSerializer):
    """Serializer for TutoringUser model."""
    
    class Meta:
        model = TutoringUser
        fields = ['id', 'email', 'full_name', 'role', 'created_at']
        read_only_fields = ['id', 'created_at']


class TutoringUserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a TutoringUser."""
    
    role = serializers.ChoiceField(choices=UserRole.choices)
    
    class Meta:
        model = TutoringUser
        fields = ['email', 'full_name', 'role']
    
    def validate_email(self, value):
        """Validate email is unique."""
        if TutoringUser.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class SessionCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a tutoring session.
    
    No input required - session is created by the authenticated teacher.
    """
    pass  # No input fields needed


class SessionCreateResponseSerializer(serializers.Serializer):
    """Response serializer for session creation."""
    session_id = serializers.UUIDField()
    room_id = serializers.CharField()
    token = serializers.CharField()
    status = serializers.CharField()
    join_url = serializers.CharField()
    livekit_ws_url = serializers.CharField(allow_null=True)


class SessionJoinSerializer(serializers.Serializer):
    """Serializer for joining a tutoring session."""
    room_id = serializers.CharField(
        required=True,
        help_text="The room ID to join"
    )


class SessionJoinResponseSerializer(serializers.Serializer):
    """Response serializer for session join."""
    session_id = serializers.UUIDField()
    token = serializers.CharField()
    status = serializers.CharField()
    teacher_name = serializers.CharField()
    room_id = serializers.CharField()
    livekit_ws_url = serializers.CharField(allow_null=True)


class SessionStatusSerializer(serializers.ModelSerializer):
    """Serializer for session status."""
    
    teacher_id = serializers.UUIDField(source='teacher.id')
    teacher_name = serializers.CharField(source='teacher.full_name')
    student_id = serializers.UUIDField(source='student.id', allow_null=True)
    student_name = serializers.CharField(
        source='student.full_name', 
        allow_null=True,
        default=None
    )
    
    class Meta:
        model = TutoringSession
        fields = [
            'id',
            'room_id',
            'status',
            'teacher_id',
            'teacher_name',
            'student_id',
            'student_name',
            'created_at',
            'ended_at',
        ]


class SessionListSerializer(serializers.ModelSerializer):
    """Serializer for listing sessions."""
    
    teacher_name = serializers.CharField(source='teacher.full_name')
    student_name = serializers.CharField(
        source='student.full_name',
        allow_null=True,
        default=None
    )
    
    class Meta:
        model = TutoringSession
        fields = [
            'id',
            'room_id',
            'status',
            'teacher_name',
            'student_name',
            'created_at',
        ]


class ErrorResponseSerializer(serializers.Serializer):
    """Serializer for error responses."""
    error = serializers.CharField()
    detail = serializers.CharField()
    code = serializers.CharField()
