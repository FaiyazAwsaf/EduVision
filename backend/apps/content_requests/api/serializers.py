"""
Content Request API Serializers.

Provides serialization and validation for content request operations:
- ContentRequestCreateSerializer: For POST requests (creation)
- ContentRequestResponseSerializer: For GET responses (detail view)
- ContentRequestListSerializer: For GET responses (list view)
- ContentRequestUpdateSerializer: For internal status updates
- GeneratedContentSerializer: For generated content responses (Phase 2)
- ErrorResponseSerializer: For error handling
"""

from rest_framework import serializers
from typing import Dict, Any

from apps.content_requests.models import ContentRequestModel, GeneratedContentModel
from apps.content_requests.domain.enums import (
    ContentType,
    Style,
    OutputFormat,
    Difficulty,
    RequestStatus
)


class ContentRequestCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a new content request.
    """
    
    topic = serializers.CharField(
        max_length=500,
        required=True,
        help_text="The topic or subject for content generation"
    )
    
    content_type = serializers.ChoiceField(
        choices=ContentType.choices(),
        required=True,
        help_text="Type of content to generate"
    )
    
    style = serializers.ChoiceField(
        choices=Style.choices(),
        required=True,
        help_text="Teaching/learning style"
    )
    
    output_format = serializers.ChoiceField(
        choices=OutputFormat.choices(),
        required=True,
        help_text="Desired output format"
    )
    
    difficulty = serializers.ChoiceField(
        choices=Difficulty.choices(),
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Content difficulty level"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
        help_text="Additional notes or requirements"
    )
    
    subject = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text="Academic subject (e.g., Mathematics)"
    )
    
    target_class_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Target class ID (for teachers)"
    )
    
    target_section_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Target section ID (for teachers)"
    )

    curriculum_topic_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Curriculum topic ID (for syllabus-aligned generation)"
    )
    
    def validate_topic(self, value: str) -> str:
        """Validate topic field."""
        if not value or not value.strip():
            raise serializers.ValidationError("Topic cannot be empty.")
        return value.strip()
    
    def validate_notes(self, value: str) -> str:
        """Validate notes field."""
        if value:
            return value.strip()
        return ""
    
    def validate(self, attrs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate the entire request data.
        
        Args:
            attrs: Dictionary of attributes
            
        Returns:
            Validated attributes
        """
        # Ensure all enum values are valid
        try:
            ContentType(attrs['content_type'])
            Style(attrs['style'])
            OutputFormat(attrs['output_format'])
            Difficulty(attrs['difficulty'])
        except ValueError as e:
            raise serializers.ValidationError(f"Invalid enum value: {str(e)}")
        
        return attrs


class ContentRequestResponseSerializer(serializers.ModelSerializer):
    """
    Serializer for content request detail responses.
    """
    created_by_id = serializers.SerializerMethodField()
    
    class Meta:
        model = ContentRequestModel
        fields = [
            'id',
            'topic',
            'content_type',
            'style',
            'output_format',
            'difficulty',
            'notes',
            'status',
            'role',
            'subject',
            'created_by_id',
            'error_message',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at', 'created_by_id', 'error_message']
    
    def get_created_by_id(self, obj):
        return str(obj.created_by.id) if obj.created_by else None


class ContentRequestListSerializer(serializers.ModelSerializer):
    """
    Serializer for content request list responses.
    """
    
    class Meta:
        model = ContentRequestModel
        fields = [
            'id',
            'topic',
            'content_type',
            'status',
            'role',
            'subject',
            'created_at',
        ]
        read_only_fields = fields


class ContentRequestUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating content request status.
    
    Used internally by tasks and services to update request state.
    """
    
    class Meta:
        model = ContentRequestModel
        fields = ['status']
    
    def validate_status(self, value: str) -> str:
        """
        Validate status transitions.
        
        Args:
            value: New status
            
        Returns:
            Validated status
            
        Raises:
            ValidationError: If status transition is invalid
        """
        instance = self.instance
        
        if instance:
            current_status = instance.status
            
            # Define valid status transitions
            valid_transitions = {
                RequestStatus.PENDING: [RequestStatus.PROCESSING, RequestStatus.FAILED],
                RequestStatus.PROCESSING: [RequestStatus.COMPLETED, RequestStatus.FAILED],
                RequestStatus.COMPLETED: [],  # Terminal state
                RequestStatus.FAILED: [RequestStatus.PENDING],  # Allow retry
            }
            
            if value not in valid_transitions.get(current_status, []):
                raise serializers.ValidationError(
                    f"Cannot transition from {current_status} to {value}."
                )
        
        return value


class GeneratedContentSerializer(serializers.ModelSerializer):
    """
    Serializer for generated content responses.
    
    Phase 2: Returns AI-generated content with metadata.
    """
    
    request_id = serializers.UUIDField(source='request.id', read_only=True)
    topic = serializers.CharField(source='request.topic', read_only=True)
    content_type = serializers.CharField(source='request.content_type', read_only=True)
    style = serializers.CharField(source='request.style', read_only=True)
    
    class Meta:
        model = GeneratedContentModel
        fields = [
            'id',
            'request_id',
            'topic',
            'content_type',
            'style',
            'content_text',
            'output_format',
            'metadata',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class ErrorResponseSerializer(serializers.Serializer):
    """
    Serializer for error responses.
    
    Provides consistent error response format across the API.
    """
    
    error = serializers.CharField()
    details = serializers.DictField(required=False)
    
    def format_error(self, error_message: str, details: Dict = None) -> Dict[str, Any]:
        """Format error response."""
        response = {'error': error_message}
        if details:
            response['details'] = details
        return response


class SharedContentListSerializer(serializers.ModelSerializer):
    """
    Serializer for content shared with a student's class/section.
    Shows completed teacher-generated content targeted at the student's class.
    """
    teacher_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()

    class Meta:
        model = ContentRequestModel
        fields = [
            'id',
            'topic',
            'content_type',
            'subject',
            'difficulty',
            'style',
            'teacher_name',
            'class_name',
            'section_name',
            'created_at',
        ]
        read_only_fields = fields

    def get_teacher_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username
        return None

    def get_class_name(self, obj):
        if obj.target_class:
            return obj.target_class.name
        return None

    def get_section_name(self, obj):
        if obj.target_section:
            return obj.target_section.name
        return None
