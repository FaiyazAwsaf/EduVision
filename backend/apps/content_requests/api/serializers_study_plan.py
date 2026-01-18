"""
Study Plan Serializers for Phase 5: Manual Study Plan Integration

These serializers handle API input/output for manual study plan management.
They enforce Phase 5 constraints (manual mode only) and prepare for Module 3 integration.
"""

from rest_framework import serializers
from ..models import (
    StudyPlan, 
    StudyPlanItem, 
    StudyPlanMode, 
    StudyPlanItemSource, 
    StudyPlanItemStatus,
    ContentRequestModel
)


class StudyPlanItemSerializer(serializers.ModelSerializer):
    """
    Serializer for study plan items.
    
    Phase 5: Manual mode only
    - Enforces source='manual' for all new items
    - confidence_score is read-only (will be set by Module 3)
    - Allows linking to content requests
    
    [MODULE 3 NOTES]
    When Module 3 is integrated:
    - confidence_score will be writable by analytics service
    - source='analytics' will be allowed
    - Priority and scheduled_date may be auto-calculated
    """
    
    # Read-only fields
    id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    # [MODULE 3 HOOK] Read-only in Phase 5, will be set by analytics
    confidence_score = serializers.FloatField(
        read_only=True,
        required=False,
        help_text="Analytics confidence score (set by Module 3)"
    )
    
    # Foreign key representation
    linked_request_id = serializers.UUIDField(
        source='linked_request.id',
        read_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = StudyPlanItem
        fields = [
            'id',
            'topic',
            'priority',
            'scheduled_date',
            'status',
            'linked_request_id',
            'source',
            'confidence_score',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'confidence_score']
    
    def validate_source(self, value):
        """
        Phase 5: Only 'manual' source is allowed.
        [MODULE 3 HOOK] Will allow 'analytics' and 'mixed' when Module 3 is active.
        """
        if value != StudyPlanItemSource.MANUAL:
            raise serializers.ValidationError(
                "Phase 5 only supports manual mode. "
                "Analytics and mixed sources require Module 3 integration."
            )
        return value
    
    def validate_priority(self, value):
        """Ensure priority is between 1 (highest) and 5 (lowest)."""
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Priority must be between 1 (highest) and 5 (lowest)")
        return value


class StudyPlanItemCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating study plan items.
    Allows linking to existing content requests via linked_request_id.
    """
    
    linked_request_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of content request to link to this item"
    )
    
    class Meta:
        model = StudyPlanItem
        fields = [
            'topic',
            'priority',
            'scheduled_date',
            'status',
            'linked_request_id',
        ]
    
    def validate_linked_request_id(self, value):
        """Validate that the content request exists."""
        if value is not None:
            try:
                ContentRequestModel.objects.get(id=value)
            except ContentRequestModel.DoesNotExist:
                raise serializers.ValidationError(f"Content request with id {value} does not exist")
        return value
    
    def create(self, validated_data):
        """
        Create study plan item with manual source.
        Handle linked_request_id properly.
        """
        linked_request_id = validated_data.pop('linked_request_id', None)
        
        # Phase 5: Always set source to manual
        validated_data['source'] = StudyPlanItemSource.MANUAL
        
        # Set default status if not provided
        if 'status' not in validated_data:
            validated_data['status'] = StudyPlanItemStatus.PENDING
        
        # Link content request if provided
        if linked_request_id:
            validated_data['linked_request'] = ContentRequestModel.objects.get(id=linked_request_id)
        
        return super().create(validated_data)


class StudyPlanSerializer(serializers.ModelSerializer):
    """
    Serializer for study plans.
    
    Phase 5: Manual mode only
    - Enforces mode='manual'
    - auto_detect_weakness defaults to False
    - analytics_snapshot_id is read-only
    
    [MODULE 3 NOTES]
    When Module 3 is integrated:
    - mode='ai' will be allowed
    - auto_detect_weakness can be set to True
    - analytics_snapshot_id will link to analytics data
    """
    
    # Nested items (read-only for GET requests)
    items = StudyPlanItemSerializer(many=True, read_only=True)
    
    # Read-only fields
    id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    # [MODULE 3 HOOK] Read-only in Phase 5
    analytics_snapshot_id = serializers.UUIDField(
        read_only=True,
        required=False,
        allow_null=True,
        help_text="Reference to Module 3 analytics snapshot (future)"
    )
    
    class Meta:
        model = StudyPlan
        fields = [
            'id',
            'user_id',
            'name',
            'mode',
            'auto_detect_weakness',
            'analytics_snapshot_id',
            'items',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'analytics_snapshot_id']
    
    def validate_mode(self, value):
        """
        Phase 5: Only 'manual' mode is allowed.
        [MODULE 3 HOOK] Will allow 'ai' mode when Module 3 is active.
        """
        if value != StudyPlanMode.MANUAL:
            raise serializers.ValidationError(
                "Phase 5 only supports manual mode. "
                "AI-driven mode requires Module 3 (Smart Analytics Dashboard) integration."
            )
        return value
    
    def validate_auto_detect_weakness(self, value):
        """
        Phase 5: auto_detect_weakness must be False.
        [MODULE 3 HOOK] Will allow True when Module 3 is active.
        """
        if value:
            raise serializers.ValidationError(
                "Automatic weakness detection requires Module 3 integration. "
                "Set to False for Phase 5 manual mode."
            )
        return value
    
    def validate(self, data):
        """
        Cross-field validation.
        Ensure mode and auto_detect_weakness are consistent.
        """
        mode = data.get('mode', StudyPlanMode.MANUAL)
        auto_detect = data.get('auto_detect_weakness', False)
        
        if mode == StudyPlanMode.MANUAL and auto_detect:
            raise serializers.ValidationError(
                "Manual mode cannot have auto_detect_weakness enabled."
            )
        
        return data


class StudyPlanCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating study plans.
    Phase 5: Enforces manual mode constraints.
    """
    
    class Meta:
        model = StudyPlan
        fields = ['user_id', 'name']
    
    def create(self, validated_data):
        """
        Create study plan with Phase 5 constraints.
        Always set mode='manual' and auto_detect_weakness=False.
        """
        # Phase 5: Force manual mode
        validated_data['mode'] = StudyPlanMode.MANUAL
        validated_data['auto_detect_weakness'] = False
        
        return super().create(validated_data)


class StudyPlanItemUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for updating study plan items.
    Allows updating status, priority, scheduled_date, and linking requests.
    """
    
    linked_request_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID of content request to link to this item"
    )
    
    class Meta:
        model = StudyPlanItem
        fields = [
            'topic',
            'priority',
            'scheduled_date',
            'status',
            'linked_request_id',
        ]
    
    def validate_linked_request_id(self, value):
        """Validate that the content request exists."""
        if value is not None:
            try:
                ContentRequestModel.objects.get(id=value)
            except ContentRequestModel.DoesNotExist:
                raise serializers.ValidationError(f"Content request with id {value} does not exist")
        return value
    
    def update(self, instance, validated_data):
        """
        Update study plan item.
        Handle linked_request_id properly.
        
        [MODULE 3 HOOK]
        When Module 3 is active and user modifies an analytics-suggested item:
        - Change source from 'analytics' to 'mixed'
        - Keep confidence_score for reference
        """
        linked_request_id = validated_data.pop('linked_request_id', None)
        
        # Handle linked request
        if linked_request_id is not None:
            if linked_request_id:
                instance.linked_request = ContentRequestModel.objects.get(id=linked_request_id)
            else:
                instance.linked_request = None
        
        # [MODULE 3 HOOK] If this item was analytics-generated and user modifies it,
        # change source to 'mixed' (future implementation)
        # if instance.source == StudyPlanItemSource.ANALYTICS:
        #     instance.source = StudyPlanItemSource.MIXED
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance
