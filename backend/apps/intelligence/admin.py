"""
Django Admin configuration for Phase 6: Intelligence & Adaptive Optimization.

Provides admin interface for:
- Viewing learning events (read-only - events are immutable)
- Viewing learner insights
- Managing recommendations
"""

from django.contrib import admin
from django.utils.html import format_html

from .models import (
    LearningEvent,
    LearnerInsight,
    Recommendation,
    EventTypeChoices,
    RecommendationStatusChoices,
)


@admin.register(LearningEvent)
class LearningEventAdmin(admin.ModelAdmin):
    """
    Admin for learning events.
    
    Events are IMMUTABLE - they can only be viewed, never modified.
    """
    list_display = [
        'id',
        'event_type',
        'user_id_short',
        'topic',
        'timestamp',
        'duration_display',
    ]
    list_filter = [
        'event_type',
        'timestamp',
    ]
    search_fields = [
        'user_id',
        'topic',
        'content_request_id',
    ]
    readonly_fields = [
        'id',
        'event_type',
        'user_id',
        'topic',
        'content_request_id',
        'study_plan_id',
        'study_plan_item_id',
        'session_id',
        'timestamp',
        'duration_seconds',
        'metadata',
    ]
    ordering = ['-timestamp']
    date_hierarchy = 'timestamp'
    
    def has_add_permission(self, request):
        """Events should be created via API only."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Events are immutable."""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Events should never be deleted."""
        return False
    
    def user_id_short(self, obj):
        """Display shortened user ID."""
        return str(obj.user_id)[:8] + '...'
    user_id_short.short_description = 'User'
    
    def duration_display(self, obj):
        """Display duration in human-readable format."""
        if obj.duration_seconds is None:
            return '-'
        minutes = obj.duration_seconds // 60
        seconds = obj.duration_seconds % 60
        return f'{minutes}m {seconds}s'
    duration_display.short_description = 'Duration'


@admin.register(LearnerInsight)
class LearnerInsightAdmin(admin.ModelAdmin):
    """
    Admin for learner insights.
    
    Insights are computed snapshots - they should not be manually edited.
    """
    list_display = [
        'id',
        'user_id_short',
        'learning_pace',
        'pace_score_display',
        'consistency_score_display',
        'computed_at',
        'events_analyzed',
    ]
    list_filter = [
        'learning_pace',
        'computed_at',
    ]
    search_fields = [
        'user_id',
    ]
    readonly_fields = [
        'id',
        'user_id',
        'computed_at',
        'learning_pace',
        'pace_score',
        'consistency_score',
        'retry_frequency',
        'weak_topics',
        'strong_topics',
        'topic_metrics',
        'events_analyzed_count',
        'computation_rules_version',
    ]
    ordering = ['-computed_at']
    date_hierarchy = 'computed_at'
    
    def has_add_permission(self, request):
        """Insights should be computed via API."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Insights should not be manually edited."""
        return False
    
    def user_id_short(self, obj):
        """Display shortened user ID."""
        return str(obj.user_id)[:8] + '...'
    user_id_short.short_description = 'User'
    
    def pace_score_display(self, obj):
        """Display pace score as percentage bar."""
        score = obj.pace_score or 0
        color = 'green' if score >= 0.7 else 'orange' if score >= 0.4 else 'red'
        return format_html(
            '<div style="width:100px;background:#eee;">'
            '<div style="width:{}%;background:{};height:10px;"></div>'
            '</div>{}%',
            int(score * 100), color, int(score * 100)
        )
    pace_score_display.short_description = 'Pace'
    
    def consistency_score_display(self, obj):
        """Display consistency score as percentage bar."""
        score = obj.consistency_score or 0
        color = 'green' if score >= 0.7 else 'orange' if score >= 0.4 else 'red'
        return format_html(
            '<div style="width:100px;background:#eee;">'
            '<div style="width:{}%;background:{};height:10px;"></div>'
            '</div>{}%',
            int(score * 100), color, int(score * 100)
        )
    consistency_score_display.short_description = 'Consistency'
    
    def events_analyzed(self, obj):
        """Display event count."""
        return obj.events_analyzed_count or 0
    events_analyzed.short_description = 'Events'


@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    """
    Admin for recommendations.
    
    Recommendations can have their status updated but content should not change.
    """
    list_display = [
        'id',
        'user_id_short',
        'recommendation_type',
        'status_badge',
        'priority',
        'confidence_display',
        'created_at',
        'expires_at',
    ]
    list_filter = [
        'status',
        'recommendation_type',
        'priority',
        'created_at',
    ]
    search_fields = [
        'user_id',
        'justification',
        'target_entity_name',
    ]
    readonly_fields = [
        'id',
        'user_id',
        'recommendation_type',
        'target_entity_type',
        'target_entity_id',
        'target_entity_name',
        'justification',
        'confidence_score',
        'priority',
        'created_at',
        'expires_at',
        'source_insight',
        'metadata',
    ]
    ordering = ['priority', '-confidence_score', '-created_at']
    date_hierarchy = 'created_at'
    
    fieldsets = [
        ('Recommendation', {
            'fields': [
                'id',
                'user_id',
                'recommendation_type',
                'justification',
            ]
        }),
        ('Target', {
            'fields': [
                'target_entity_type',
                'target_entity_id',
                'target_entity_name',
            ]
        }),
        ('Metrics', {
            'fields': [
                'confidence_score',
                'priority',
            ]
        }),
        ('Status', {
            'fields': [
                'status',
                'viewed_at',
                'actioned_at',
            ]
        }),
        ('Timing', {
            'fields': [
                'created_at',
                'expires_at',
            ]
        }),
        ('Source', {
            'fields': [
                'source_insight',
                'metadata',
            ]
        }),
    ]
    
    def has_add_permission(self, request):
        """Recommendations should be generated via API."""
        return False
    
    def user_id_short(self, obj):
        """Display shortened user ID."""
        return str(obj.user_id)[:8] + '...'
    user_id_short.short_description = 'User'
    
    def status_badge(self, obj):
        """Display status as colored badge."""
        colors = {
            RecommendationStatusChoices.ACTIVE: '#28a745',
            RecommendationStatusChoices.VIEWED: '#17a2b8',
            RecommendationStatusChoices.ACCEPTED: '#007bff',
            RecommendationStatusChoices.DISMISSED: '#6c757d',
            RecommendationStatusChoices.EXPIRED: '#dc3545',
        }
        color = colors.get(obj.status, '#6c757d')
        return format_html(
            '<span style="background:{};color:white;padding:3px 8px;'
            'border-radius:3px;font-size:11px;">{}</span>',
            color, obj.status
        )
    status_badge.short_description = 'Status'
    
    def confidence_display(self, obj):
        """Display confidence as percentage."""
        score = obj.confidence_score or 0
        color = 'green' if score >= 0.7 else 'orange' if score >= 0.4 else 'red'
        return format_html(
            '<span style="color:{};">{}%</span>',
            color, int(score * 100)
        )
    confidence_display.short_description = 'Confidence'
    
    actions = ['mark_as_expired']
    
    @admin.action(description='Mark selected recommendations as expired')
    def mark_as_expired(self, request, queryset):
        """Bulk action to expire recommendations."""
        count = queryset.filter(
            status=RecommendationStatusChoices.ACTIVE
        ).update(status=RecommendationStatusChoices.EXPIRED)
        self.message_user(request, f'{count} recommendations marked as expired.')
