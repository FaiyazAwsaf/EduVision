"""
Tutoring Session Serializers

Serializers for the tutoring API endpoints.
"""

from rest_framework import serializers
from apps.tutoring.models import TutoringSession, SessionStatus


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
    teacher_name = serializers.SerializerMethodField()
    student_id = serializers.UUIDField(source='student.id', allow_null=True)
    student_name = serializers.SerializerMethodField()
    
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
    
    def get_teacher_name(self, obj):
        """Get teacher's full name from first_name and last_name."""
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"
    
    def get_student_name(self, obj):
        """Get student's full name from first_name and last_name."""
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return None


class SessionListSerializer(serializers.ModelSerializer):
    """Serializer for listing sessions."""
    
    teacher_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    teacher_id = serializers.UUIDField(source='teacher.id')
    student_id = serializers.UUIDField(source='student.id', allow_null=True)
    
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
    
    def get_teacher_name(self, obj):
        """Get teacher's full name from first_name and last_name."""
        return f"{obj.teacher.first_name} {obj.teacher.last_name}"
    
    def get_student_name(self, obj):
        """Get student's full name from first_name and last_name."""
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return None


class ErrorResponseSerializer(serializers.Serializer):
    """Serializer for error responses."""
    error = serializers.CharField()
    detail = serializers.CharField()
    code = serializers.CharField()
