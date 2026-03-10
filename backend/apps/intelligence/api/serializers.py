"""
DRF Serializers for Phase 6: Intelligence & Adaptive Optimization.

Serializers handle:
- Event creation (immutable)
- Insight reading
- Recommendation viewing and status updates
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model

from ..models import (
    LearningEvent,
    LearnerInsight,
    Recommendation,
    EventTypeChoices,
    RecommendationTypeChoices,
    RecommendationStatusChoices,
)


class LearningEventSerializer(serializers.ModelSerializer):
    """
    Serializer for reading learning events.
    
    Events are immutable, so this is read-only for most fields.
    """
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    
    class Meta:
        model = LearningEvent
        fields = [
            'id',
            'event_type',
            'event_type_display',
            'user_id',
            'timestamp',
            'topic',
            'content_request_id',
            'study_plan_id',
            'study_plan_item_id',
            'session_id',
            'duration_seconds',
            'metadata',
            'recorded_at',
        ]
        read_only_fields = ['id', 'recorded_at']


class LearningEventCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating learning events.
    
    ⚠️ Events are immutable - once created, they cannot be modified.
    """
    event_type = serializers.ChoiceField(choices=EventTypeChoices.choices)
    
    class Meta:
        model = LearningEvent
        fields = [
            'event_type',
            'user_id',
            'timestamp',
            'topic',
            'content_request_id',
            'study_plan_id',
            'study_plan_item_id',
            'session_id',
            'duration_seconds',
            'metadata',
        ]
    
    def validate_duration_seconds(self, value):
        """Validate duration is positive."""
        if value is not None and value < 0:
            raise serializers.ValidationError("Duration cannot be negative.")
        return value
    
    def create(self, validated_data):
        """Create an immutable event."""
        return LearningEvent.objects.create(**validated_data)


class LearningEventBatchSerializer(serializers.Serializer):
    """
    Serializer for batch event creation.
    """
    events = LearningEventCreateSerializer(many=True)
    
    def create(self, validated_data):
        """Create multiple events."""
        events_data = validated_data.get('events', [])
        return [LearningEvent.objects.create(**data) for data in events_data]


class TopicMetricsSerializer(serializers.Serializer):
    """
    Serializer for topic metrics within insights.
    """
    topic = serializers.CharField()
    difficulty_score = serializers.FloatField()
    difficulty_level = serializers.CharField()
    mastery_score = serializers.FloatField()
    retry_count = serializers.IntegerField()
    total_time_seconds = serializers.IntegerField()
    completion_count = serializers.IntegerField()
    last_interaction = serializers.DateTimeField()
    is_struggling = serializers.BooleanField()
    is_mastered = serializers.BooleanField()
    average_time_per_attempt = serializers.FloatField()


class LearnerInsightSerializer(serializers.ModelSerializer):
    """
    Serializer for reading learner insights.
    
    Insights are computed snapshots and are read-only.
    """
    learning_pace_display = serializers.CharField(source='get_learning_pace_display', read_only=True)
    topic_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = LearnerInsight
        fields = [
            'id',
            'user_id',
            'computed_at',
            'computation_rules_version',
            'events_analyzed_count',
            'learning_pace',
            'learning_pace_display',
            'pace_score',
            'consistency_score',
            'retry_frequency',
            'average_difficulty',
            'average_mastery',
            'overall_health_score',
            'weak_topics',
            'strong_topics',
            'topic_metrics',
            'topic_count',
        ]
        read_only_fields = fields


class LearnerInsightSummarySerializer(serializers.ModelSerializer):
    """
    Summary serializer for insight listing (teacher class view).
    Includes all fields required by the frontend intelligence dashboard.
    """
    user_display_name = serializers.SerializerMethodField()

    def get_user_display_name(self, obj):
        User = get_user_model()
        try:
            user = User.objects.get(pk=obj.user_id)
            full = f"{user.first_name} {user.last_name}".strip()
            return full or user.username
        except User.DoesNotExist:
            return str(obj.user_id)

    class Meta:
        model = LearnerInsight
        fields = [
            'id',
            'user_id',
            'user_display_name',
            'computed_at',
            'learning_pace',
            'pace_score',
            'consistency_score',
            'retry_frequency',
            'average_difficulty',
            'average_mastery',
            'overall_health_score',
            'weak_topics',
            'strong_topics',
            'topic_metrics',
            'events_analyzed_count',
        ]
        read_only_fields = fields


class RecommendationSerializer(serializers.ModelSerializer):
    """
    Serializer for reading recommendations.
    
    Recommendations are advisory outputs.
    ⚠️ Phase 6 does NOT automatically act on recommendations.
    """
    recommendation_type_display = serializers.CharField(
        source='get_recommendation_type_display', 
        read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    is_high_confidence = serializers.BooleanField(read_only=True)
    action_category = serializers.CharField(read_only=True)
    
    class Meta:
        model = Recommendation
        fields = [
            'id',
            'user_id',
            'recommendation_type',
            'recommendation_type_display',
            'target_entity_type',
            'target_entity_id',
            'target_entity_name',
            'justification',
            'confidence_score',
            'priority',
            'status',
            'status_display',
            'created_at',
            'expires_at',
            'viewed_at',
            'actioned_at',
            'is_active',
            'is_high_confidence',
            'action_category',
            'metadata',
        ]
        read_only_fields = fields


class RecommendationActionSerializer(serializers.Serializer):
    """
    Serializer for recommendation actions (view, accept, dismiss).
    
    ⚠️ Actions only update status - they don't perform any automatic behavior.
    """
    action = serializers.ChoiceField(choices=['view', 'accept', 'dismiss'])
    
    def validate_action(self, value):
        """Validate action is allowed."""
        allowed = ['view', 'accept', 'dismiss']
        if value not in allowed:
            raise serializers.ValidationError(
                f"Action must be one of: {', '.join(allowed)}"
            )
        return value


class GenerateRecommendationsSerializer(serializers.Serializer):
    """
    Serializer for recommendation generation request.
    """
    user_id = serializers.UUIDField()
    max_recommendations = serializers.IntegerField(default=10, min_value=1, max_value=50)
    filter_types = serializers.ListField(
        child=serializers.ChoiceField(choices=RecommendationTypeChoices.choices),
        required=False,
    )


class RecommendationStatsSerializer(serializers.Serializer):
    """
    Serializer for recommendation statistics.
    """
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    viewed = serializers.IntegerField()
    accepted = serializers.IntegerField()
    dismissed = serializers.IntegerField()
    expired = serializers.IntegerField()
    high_priority = serializers.IntegerField()
    high_confidence = serializers.IntegerField()
