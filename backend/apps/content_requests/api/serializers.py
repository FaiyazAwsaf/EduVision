"""
Django REST Framework Serializers for Content Requests Module

This module provides serializers for validating API requests and
formatting API responses. Follows DRF best practices for input validation,
output formatting, and nested relationships.
"""
from rest_framework import serializers
from ..models import ContentRequest, GeneratedContent, UserFeedback


class GeneratedContentSerializer(serializers.ModelSerializer):
    """
    Serializer for GeneratedContent model.
    
    Handles serialization of AI-generated content, including
    the content text, format, and metadata.
    """
    
    class Meta:
        model = GeneratedContent
        fields = [
            'id',
            'format',
            'content_text',
            'metadata',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class UserFeedbackSerializer(serializers.ModelSerializer):
    """
    Serializer for UserFeedback model.
    
    Validates and serializes user feedback on generated content.
    """
    
    class Meta:
        model = UserFeedback
        fields = [
            'id',
            'feedback_type',
            'notes',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate_notes(self, value):
        """
        Validate feedback notes.
        
        Args:
            value (str): The feedback notes text
            
        Returns:
            str: Validated notes
            
        Raises:
            ValidationError: If notes exceed maximum length
        """
        if len(value) > 2000:
            raise serializers.ValidationError(
                "Feedback notes cannot exceed 2000 characters."
            )
        return value


class ContentRequestListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing content requests.
    
    Used for list views where we don't need full nested relationships.
    """
    
    class Meta:
        model = ContentRequest
        fields = [
            'id',
            'topic',
            'style',
            'format',
            'status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class ContentRequestDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for ContentRequest with nested relationships.
    
    Includes generated contents and feedbacks when retrieving
    a specific request.
    """
    
    generated_contents = GeneratedContentSerializer(many=True, read_only=True)
    feedbacks = UserFeedbackSerializer(many=True, read_only=True)
    
    class Meta:
        model = ContentRequest
        fields = [
            'id',
            'topic',
            'style',
            'format',
            'status',
            'metadata',
            'created_at',
            'updated_at',
            'generated_contents',
            'feedbacks'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class ContentRequestCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new content requests.
    
    Validates input data and provides detailed error messages.
    Metadata field is optional and can contain custom parameters.
    """
    
    class Meta:
        model = ContentRequest
        fields = [
            'topic',
            'style',
            'format',
            'metadata'
        ]
    
    def validate_topic(self, value):
        """
        Validate the topic field.
        
        Args:
            value (str): The topic text
            
        Returns:
            str: Validated and cleaned topic
            
        Raises:
            ValidationError: If topic is invalid
        """
        # Strip whitespace
        value = value.strip()
        
        # Minimum length check
        if len(value) < 3:
            raise serializers.ValidationError(
                "Topic must be at least 3 characters long."
            )
        
        # Maximum length check
        if len(value) > 500:
            raise serializers.ValidationError(
                "Topic cannot exceed 500 characters."
            )
        
        return value
    
    def validate_metadata(self, value):
        """
        Validate metadata field.
        
        Args:
            value (dict): Metadata dictionary
            
        Returns:
            dict: Validated metadata
            
        Raises:
            ValidationError: If metadata structure is invalid
        """
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "Metadata must be a valid JSON object."
            )
        
        # Add validation for specific metadata keys if needed
        # For now, accept any valid dict
        
        return value
    
    def create(self, validated_data):
        """
        Create a new ContentRequest instance.
        
        Args:
            validated_data (dict): Validated request data
            
        Returns:
            ContentRequest: Created instance
        """
        # Set initial status to pending
        validated_data['status'] = ContentRequest.StatusChoices.PENDING
        
        # Future: Add user from request context when auth is implemented
        # validated_data['user'] = self.context['request'].user
        
        return super().create(validated_data)


class FeedbackCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating user feedback.
    
    Validates feedback submission and links it to a content request.
    """
    
    class Meta:
        model = UserFeedback
        fields = [
            'feedback_type',
            'notes'
        ]
    
    def validate(self, attrs):
        """
        Validate feedback data.
        
        Args:
            attrs (dict): Feedback attributes
            
        Returns:
            dict: Validated attributes
            
        Raises:
            ValidationError: If validation fails
        """
        # Ensure notes are provided for certain feedback types
        feedback_type = attrs.get('feedback_type')
        notes = attrs.get('notes', '').strip()
        
        if feedback_type in ['report_issue', 'suggestion'] and not notes:
            raise serializers.ValidationError({
                'notes': f'Notes are required for {feedback_type} feedback.'
            })
        
        return attrs


class ContentRequestUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating content request status.
    
    Used internally by tasks and services to update request state.
    """
    
    class Meta:
        model = ContentRequest
        fields = ['status']
    
    def validate_status(self, value):
        """
        Validate status transitions.
        
        Args:
            value (str): New status
            
        Returns:
            str: Validated status
            
        Raises:
            ValidationError: If status transition is invalid
        """
        instance = self.instance
        
        if instance:
            current_status = instance.status
            
            # Define valid status transitions
            valid_transitions = {
                'pending': ['processing', 'cancelled'],
                'processing': ['completed', 'failed'],
                'completed': [],  # Terminal state
                'failed': ['pending'],  # Allow retry
                'cancelled': []  # Terminal state
            }
            
            if value not in valid_transitions.get(current_status, []):
                raise serializers.ValidationError(
                    f"Cannot transition from {current_status} to {value}."
                )
        
        return value
