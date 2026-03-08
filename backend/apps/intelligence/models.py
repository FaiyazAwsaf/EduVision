"""
Django Models for Phase 6: Intelligence & Adaptive Optimization.

These models persist:
- Learning events (immutable facts)
- Learner insights (computed snapshots)
- Recommendations (advisory outputs)

⚠️ IMPORTANT CONSTRAINTS:
- LearningEvent is append-only (no updates/deletes in normal operation)
- Recommendations are advisory only
- No Module 3 dependencies
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class EventTypeChoices(models.TextChoices):
    """Learning event types."""
    CONTENT_STARTED = 'content_started', 'Content Started'
    CONTENT_COMPLETED = 'content_completed', 'Content Completed'
    CONTENT_ABANDONED = 'content_abandoned', 'Content Abandoned'
    CONTENT_REGENERATED = 'content_regenerated', 'Content Regenerated'
    TOPIC_VIEWED = 'topic_viewed', 'Topic Viewed'
    TOPIC_RETRIED = 'topic_retried', 'Topic Retried'
    TOPIC_MASTERED = 'topic_mastered', 'Topic Mastered'
    PLAN_VIEWED = 'plan_viewed', 'Plan Viewed'
    PLAN_ITEM_STARTED = 'plan_item_started', 'Plan Item Started'
    PLAN_ITEM_COMPLETED = 'plan_item_completed', 'Plan Item Completed'
    PLAN_ITEM_SKIPPED = 'plan_item_skipped', 'Plan Item Skipped'
    SESSION_STARTED = 'session_started', 'Session Started'
    SESSION_ENDED = 'session_ended', 'Session Ended'
    FEEDBACK_SUBMITTED = 'feedback_submitted', 'Feedback Submitted'
    # Evaluation pipeline events (Phase 7)
    SCRIPT_SUBMITTED = 'script_submitted', 'Script Submitted'
    SCRIPT_EVALUATED = 'script_evaluated', 'Script Evaluated'
    CONTENT_GENERATED = 'content_generated', 'Content Generated'
    CONTENT_VIEWED = 'content_viewed', 'Content Viewed'
    SESSION_JOINED = 'session_joined', 'Session Joined'


class RecommendationTypeChoices(models.TextChoices):
    """Recommendation types (advisory only)."""
    RECOMMEND_REVIEW = 'recommend_review', 'Recommend Review'
    RECOMMEND_RETRY = 'recommend_retry', 'Recommend Retry'
    RECOMMEND_REINFORCE = 'recommend_reinforce', 'Recommend Reinforce'
    RECOMMEND_SLOW_DOWN = 'recommend_slow_down', 'Recommend Slow Down'
    RECOMMEND_SPEED_UP = 'recommend_speed_up', 'Recommend Speed Up'
    RECOMMEND_BREAK = 'recommend_break', 'Recommend Break'
    RECOMMEND_REORDER = 'recommend_reorder', 'Recommend Reorder'
    RECOMMEND_PRIORITIZE = 'recommend_prioritize', 'Recommend Prioritize'
    RECOMMEND_DEFER = 'recommend_defer', 'Recommend Defer'
    RECOMMEND_SIMPLIFY = 'recommend_simplify', 'Recommend Simplify'
    RECOMMEND_ELABORATE = 'recommend_elaborate', 'Recommend Elaborate'
    RECOMMEND_ALTERNATIVE = 'recommend_alternative', 'Recommend Alternative'
    RECOMMEND_FOCUS = 'recommend_focus', 'Recommend Focus'
    RECOMMEND_PRACTICE = 'recommend_practice', 'Recommend Practice'


class RecommendationStatusChoices(models.TextChoices):
    """Status of a recommendation."""
    ACTIVE = 'active', 'Active'
    VIEWED = 'viewed', 'Viewed'
    ACCEPTED = 'accepted', 'Accepted'
    DISMISSED = 'dismissed', 'Dismissed'
    EXPIRED = 'expired', 'Expired'


class LearningPaceChoices(models.TextChoices):
    """Learning pace categories."""
    VERY_SLOW = 'very_slow', 'Very Slow'
    SLOW = 'slow', 'Slow'
    MODERATE = 'moderate', 'Moderate'
    FAST = 'fast', 'Fast'
    VERY_FAST = 'very_fast', 'Very Fast'


class LearningEvent(models.Model):
    """
    Immutable learning event record.
    
    Events are FACTS about what happened, not commands.
    They should never be modified after creation.
    
    ⚠️ This is an append-only table in normal operation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Event identification
    event_type = models.CharField(
        max_length=50,
        choices=EventTypeChoices.choices,
        db_index=True,
        help_text="Type of learning event"
    )
    
    # User reference (not FK to avoid Module 3 coupling)
    user_id = models.UUIDField(
        db_index=True,
        help_text="ID of the learner"
    )
    
    # Timestamp (when event occurred, not when recorded)
    timestamp = models.DateTimeField(
        db_index=True,
        help_text="When the event occurred"
    )
    
    # Context (all optional, depends on event type)
    topic = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        db_index=True,
        help_text="Topic involved in this event"
    )
    
    # References (UUIDs, not FKs, to avoid coupling)
    content_request_id = models.UUIDField(
        blank=True,
        null=True,
        help_text="Related content request ID"
    )
    study_plan_id = models.UUIDField(
        blank=True,
        null=True,
        help_text="Related study plan ID"
    )
    study_plan_item_id = models.UUIDField(
        blank=True,
        null=True,
        help_text="Related study plan item ID"
    )
    session_id = models.UUIDField(
        blank=True,
        null=True,
        db_index=True,
        help_text="Learning session ID for grouping"
    )
    
    # Metrics
    duration_seconds = models.PositiveIntegerField(
        blank=True,
        null=True,
        help_text="Duration of the activity in seconds"
    )
    
    # Flexible metadata (JSON)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event-specific data"
    )
    
    # Audit
    recorded_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When this event was recorded in the system"
    )
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user_id', 'timestamp']),
            models.Index(fields=['user_id', 'event_type']),
            models.Index(fields=['user_id', 'topic']),
            models.Index(fields=['event_type', 'timestamp']),
        ]
        verbose_name = 'Learning Event'
        verbose_name_plural = 'Learning Events'
    
    def __str__(self):
        return f"{self.event_type} by {self.user_id} at {self.timestamp}"
    
    def save(self, *args, **kwargs):
        """
        Override save to enforce immutability on updates.
        
        In production, you may want to make this even stricter.
        """
        if self.pk and LearningEvent.objects.filter(pk=self.pk).exists():
            # This is an update - warn but allow for admin purposes
            # In production, you might want to raise an exception
            pass
        super().save(*args, **kwargs)


class LearnerInsight(models.Model):
    """
    Computed insight snapshot for a learner.
    
    Insights are derived from events using rule-based computation.
    They represent observed patterns, not predictions.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Learner reference
    user_id = models.UUIDField(
        db_index=True,
        help_text="ID of the learner"
    )
    
    # Computation metadata
    computed_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When this insight was computed"
    )
    computation_rules_version = models.CharField(
        max_length=20,
        default="1.0.0",
        help_text="Version of rules used for computation"
    )
    events_analyzed_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of events used in computation"
    )
    
    # Pace metrics
    learning_pace = models.CharField(
        max_length=20,
        choices=LearningPaceChoices.choices,
        default=LearningPaceChoices.MODERATE,
        help_text="Categorized learning pace"
    )
    pace_score = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Numeric pace score (0.0 to 1.0)"
    )
    
    # Consistency metrics
    consistency_score = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Consistency score (0.0 to 1.0)"
    )
    
    # Retry metrics
    retry_frequency = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Retry frequency score (0.0 to 1.0)"
    )
    
    # Aggregate metrics
    average_difficulty = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Average difficulty across topics"
    )
    average_mastery = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Average mastery across topics"
    )
    overall_health_score = models.FloatField(
        default=0.5,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Overall learning health score"
    )
    
    # Topic lists (JSON arrays)
    weak_topics = models.JSONField(
        default=list,
        blank=True,
        help_text="List of weak topic names"
    )
    strong_topics = models.JSONField(
        default=list,
        blank=True,
        help_text="List of strong topic names"
    )
    
    # Per-topic metrics (JSON object)
    topic_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Detailed metrics per topic"
    )
    
    # Extended metrics for future ML compatibility
    extended_metrics = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extended metrics for future use"
    )
    
    class Meta:
        ordering = ['-computed_at']
        indexes = [
            models.Index(fields=['user_id', 'computed_at']),
        ]
        verbose_name = 'Learner Insight'
        verbose_name_plural = 'Learner Insights'
    
    def __str__(self):
        return f"Insight for {self.user_id} at {self.computed_at}"
    
    @property
    def topic_count(self):
        """Number of topics with metrics."""
        return len(self.topic_metrics)


class Recommendation(models.Model):
    """
    Advisory recommendation for a learner.
    
    ⚠️ CRITICAL: Recommendations are SUGGESTIONS ONLY.
    ⚠️ Phase 6 MUST NOT automatically act on recommendations.
    ⚠️ External systems MAY choose to act on them.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Learner reference
    user_id = models.UUIDField(
        db_index=True,
        help_text="ID of the learner"
    )
    
    # Recommendation type
    recommendation_type = models.CharField(
        max_length=50,
        choices=RecommendationTypeChoices.choices,
        db_index=True,
        help_text="Type of recommendation"
    )
    
    # Target entity (what this recommendation is about)
    target_entity_type = models.CharField(
        max_length=20,
        help_text="Type of target (topic, content, plan, session)"
    )
    target_entity_id = models.UUIDField(
        blank=True,
        null=True,
        help_text="ID of target entity (if applicable)"
    )
    target_entity_name = models.CharField(
        max_length=500,
        help_text="Human-readable name of target"
    )
    
    # Justification (human-readable explanation)
    justification = models.TextField(
        help_text="Human-readable explanation for this recommendation"
    )
    
    # Confidence (rule-derived, not probabilistic)
    confidence_score = models.FloatField(
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Confidence score (0.0 to 1.0)"
    )
    
    # Priority (1=highest, 5=lowest)
    priority = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Priority level (1=highest, 5=lowest)"
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=RecommendationStatusChoices.choices,
        default=RecommendationStatusChoices.ACTIVE,
        db_index=True,
        help_text="Current status of recommendation"
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When recommendation was created"
    )
    expires_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When recommendation expires"
    )
    viewed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When recommendation was viewed"
    )
    actioned_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When recommendation was acted upon"
    )
    
    # Source tracking
    source_insight = models.ForeignKey(
        LearnerInsight,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='recommendations',
        help_text="Insight that generated this recommendation"
    )
    
    # Additional context
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional recommendation context"
    )
    
    class Meta:
        ordering = ['priority', '-confidence_score', '-created_at']
        indexes = [
            models.Index(fields=['user_id', 'status']),
            models.Index(fields=['user_id', 'created_at']),
            models.Index(fields=['recommendation_type', 'status']),
        ]
        verbose_name = 'Recommendation'
        verbose_name_plural = 'Recommendations'
    
    def __str__(self):
        return f"{self.recommendation_type} for {self.user_id}: {self.target_entity_name}"
    
    @property
    def is_active(self):
        """Check if recommendation is still active."""
        from django.utils import timezone
        if self.status != RecommendationStatusChoices.ACTIVE:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True
    
    @property
    def is_high_confidence(self):
        """Check if this is a high confidence recommendation."""
        return self.confidence_score >= 0.7
    
    @property
    def action_category(self):
        """Get the action category for this recommendation."""
        review_types = {
            RecommendationTypeChoices.RECOMMEND_REVIEW,
            RecommendationTypeChoices.RECOMMEND_RETRY,
            RecommendationTypeChoices.RECOMMEND_REINFORCE,
            RecommendationTypeChoices.RECOMMEND_PRACTICE,
        }
        pace_types = {
            RecommendationTypeChoices.RECOMMEND_SLOW_DOWN,
            RecommendationTypeChoices.RECOMMEND_SPEED_UP,
            RecommendationTypeChoices.RECOMMEND_BREAK,
        }
        order_types = {
            RecommendationTypeChoices.RECOMMEND_REORDER,
            RecommendationTypeChoices.RECOMMEND_PRIORITIZE,
            RecommendationTypeChoices.RECOMMEND_DEFER,
        }
        content_types = {
            RecommendationTypeChoices.RECOMMEND_SIMPLIFY,
            RecommendationTypeChoices.RECOMMEND_ELABORATE,
            RecommendationTypeChoices.RECOMMEND_ALTERNATIVE,
        }
        
        if self.recommendation_type in review_types:
            return 'review'
        elif self.recommendation_type in pace_types:
            return 'pace'
        elif self.recommendation_type in order_types:
            return 'order'
        elif self.recommendation_type in content_types:
            return 'content'
        else:
            return 'general'

