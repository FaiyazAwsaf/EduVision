"""
Learning Context Serializers - Phase 4

Data validation and transformation for learning context API.
Handles user-provided personalization inputs.
"""
from rest_framework import serializers
from ..models import LearningContextModel, TargetGoal, PreferredDepth, TimeConstraint


class LearningContextSerializer(serializers.ModelSerializer):
    """
    Serializer for learning context retrieval and creation.
    
    All fields are optional to support graceful degradation.
    AI generation works with or without context.
    """
    
    # Read-only fields
    id = serializers.UUIDField(read_only=True)
    content_request_id = serializers.UUIDField(source='content_request.id', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    # Write fields (all optional)
    target_goal = serializers.ChoiceField(
        choices=TargetGoal.choices,
        required=False,
        allow_null=True,
        help_text="Primary learning goal for this content"
    )
    
    self_reported_weaknesses = serializers.ListField(
        child=serializers.CharField(max_length=200),
        required=False,
        allow_empty=True,
        help_text="Topics/concepts to focus on (user-provided)"
    )
    
    preferred_depth = serializers.ChoiceField(
        choices=PreferredDepth.choices,
        required=False,
        default='NORMAL',
        help_text="How detailed should explanations be?"
    )
    
    time_constraint = serializers.ChoiceField(
        choices=TimeConstraint.choices,
        required=False,
        default='NORMAL',
        help_text="Available time for studying"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
        help_text="Additional context (optional)"
    )
    
    class Meta:
        model = LearningContextModel
        fields = [
            'id',
            'content_request_id',
            'target_goal',
            'self_reported_weaknesses',
            'preferred_depth',
            'time_constraint',
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'content_request_id', 'created_at', 'updated_at']
    
    def validate_self_reported_weaknesses(self, value):
        """Validate weaknesses list"""
        if value and len(value) > 10:
            raise serializers.ValidationError(
                "Maximum 10 weakness topics allowed"
            )
        # Clean empty strings
        return [w.strip() for w in value if w.strip()] if value else []
    
    def validate_notes(self, value):
        """Validate notes length"""
        if value and len(value) > 1000:
            raise serializers.ValidationError(
                "Notes must be 1000 characters or less"
            )
        return value


class LearningContextCreateSerializer(serializers.Serializer):
    """
    Serializer for learning context creation/update requests.
    
    Separate from LearningContextSerializer to avoid exposing
    the content_request foreign key in the request body.
    The request ID comes from the URL path.
    """
    
    target_goal = serializers.ChoiceField(
        choices=TargetGoal.choices,
        required=False,
        allow_null=True,
        help_text="Primary learning goal"
    )
    
    self_reported_weaknesses = serializers.ListField(
        child=serializers.CharField(max_length=200),
        required=False,
        allow_empty=True,
        default=list,
        help_text="Topics to focus on"
    )
    
    preferred_depth = serializers.ChoiceField(
        choices=PreferredDepth.choices,
        required=False,
        default='NORMAL',
        help_text="Explanation depth"
    )
    
    time_constraint = serializers.ChoiceField(
        choices=TimeConstraint.choices,
        required=False,
        default='NORMAL',
        help_text="Study time available"
    )
    
    notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
        help_text="Additional context"
    )
    
    def validate_self_reported_weaknesses(self, value):
        """Validate and clean weaknesses"""
        if value and len(value) > 10:
            raise serializers.ValidationError(
                "Maximum 10 weakness topics allowed"
            )
        return [w.strip() for w in value if w.strip()] if value else []
