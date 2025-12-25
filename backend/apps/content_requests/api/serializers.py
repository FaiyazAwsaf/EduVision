"""
Content Request API Serializers.

Provides serialization and validation for content request operations:
- ContentRequestCreateSerializer: For POST requests (creation)
- ContentRequestResponseSerializer: For GET responses (detail view)
- ContentRequestListSerializer: For GET responses (list view)
- ContentRequestUpdateSerializer: For internal status updates
- ErrorResponseSerializer: For error handling
"""

from rest_framework import serializers
from typing import Dict, Any

from apps.content_requests.models import ContentRequestModel
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
    
    Accepts user input for creating educational content generation requests.
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
        required=True,
        help_text="Content difficulty level"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=2000,
        help_text="Additional notes or requirements"
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
    
    Provides complete information for a single request.
    """
    
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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class ContentRequestListSerializer(serializers.ModelSerializer):
    """
    Serializer for content request list responses.
    
    Provides summary information for multiple requests.
    """
    
    class Meta:
        model = ContentRequestModel
        fields = [
            'id',
            'topic',
            'content_type',
            'status',
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
