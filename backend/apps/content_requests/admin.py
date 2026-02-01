"""
Django Admin Configuration for Content Requests Module

Provides administrative interface for managing content requests and generated content.
"""
from django.contrib import admin
from .models import ContentRequestModel, GeneratedContentModel, FeedbackModel, LearningContextModel


@admin.register(ContentRequestModel)
class ContentRequestAdmin(admin.ModelAdmin):
    """Admin interface for ContentRequestModel"""
    
    list_display = (
        'id', 
        'topic_preview', 
        'content_type', 
        'style', 
        'output_format', 
        'status', 
        'created_at'
    )
    list_filter = ('status', 'content_type', 'style', 'output_format', 'difficulty', 'created_at')
    search_fields = ('id', 'topic', 'notes')
    readonly_fields = ('id', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Request Information', {
            'fields': ('id', 'topic', 'content_type', 'style', 'output_format', 'difficulty')
        }),
        ('Additional Details', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def topic_preview(self, obj):
        """Display truncated topic for list view"""
        return obj.topic[:50] + '...' if len(obj.topic) > 50 else obj.topic
    topic_preview.short_description = 'Topic'
    
    def has_delete_permission(self, request, obj=None):
        """Allow deletion in admin"""
        return True


@admin.register(GeneratedContentModel)
class GeneratedContentAdmin(admin.ModelAdmin):
    """Admin interface for GeneratedContentModel (Phase 2)"""
    
    list_display = (
        'id',
        'request_link',
        'output_format',
        'content_length',
        'created_at'
    )
    list_filter = ('output_format', 'created_at')
    search_fields = ('id', 'request__id', 'request__topic', 'content_text')
    readonly_fields = ('id', 'created_at', 'updated_at', 'metadata_display')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Content Information', {
            'fields': ('id', 'request', 'output_format')
        }),
        ('Generated Content', {
            'fields': ('content_text',)
        }),
        ('Metadata', {
            'fields': ('metadata_display',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def request_link(self, obj):
        """Display link to related request"""
        return f"{obj.request.topic[:30]}... ({obj.request_id})"
    request_link.short_description = 'Request'
    
    def content_length(self, obj):
        """Display content length"""
        return f"{len(obj.content_text)} characters"
    content_length.short_description = 'Content Length'
    
    def metadata_display(self, obj):
        """Display formatted metadata"""
        import json
        return json.dumps(obj.metadata, indent=2)
    metadata_display.short_description = 'Metadata (JSON)'
    
    def has_delete_permission(self, request, obj=None):
        """Allow deletion in admin"""
        return True


@admin.register(FeedbackModel)
class FeedbackAdmin(admin.ModelAdmin):
    """Admin interface for FeedbackModel (Phase 3)"""
    
    list_display = (
        'id',
        'content_topic',
        'usefulness_rating',
        'difficulty_rating',
        'correctness_flag',
        'submitted_at'
    )
    list_filter = (
        'usefulness_rating',
        'difficulty_rating',
        'correctness_flag',
        'submitted_at'
    )
    search_fields = (
        'id',
        'generated_content__content_request__topic',
        'missing_topics',
        'freeform_comment'
    )
    readonly_fields = ('id', 'generated_content', 'submitted_at')
    ordering = ('-submitted_at',)
    
    fieldsets = (
        ('Feedback Information', {
            'fields': (
                'id',
                'generated_content',
                'usefulness_rating',
                'difficulty_rating',
                'correctness_flag'
            )
        }),
        ('Additional Feedback', {
            'fields': ('missing_topics', 'freeform_comment'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('submitted_at',),
            'classes': ('collapse',)
        }),
    )
    
    def content_topic(self, obj):
        """Display the topic of the related content request"""
        return obj.generated_content.content_request.topic[:50]
    content_topic.short_description = 'Content Topic'
    
    def has_add_permission(self, request):
        """Prevent adding feedback through admin (should use API)"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Allow deletion for data management"""
        return True


@admin.register(LearningContextModel)
class LearningContextAdmin(admin.ModelAdmin):
    """Admin interface for LearningContextModel (Phase 4)"""
    
    list_display = (
        'id',
        'request_topic',
        'target_goal',
        'preferred_depth',
        'time_constraint',
        'weakness_count',
        'created_at'
    )
    list_filter = (
        'target_goal',
        'preferred_depth',
        'time_constraint',
        'created_at'
    )
    search_fields = (
        'id',
        'content_request__topic',
        'self_reported_weaknesses',
        'notes'
    )
    readonly_fields = ('id', 'content_request', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Context Information', {
            'fields': (
                'id',
                'content_request',
                'target_goal',
                'preferred_depth',
                'time_constraint'
            )
        }),
        ('Learning Focus', {
            'fields': ('self_reported_weaknesses', 'notes'),
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def request_topic(self, obj):
        """Display the topic of the related content request"""
        return obj.content_request.topic[:50]
    request_topic.short_description = 'Request Topic'
    
    def weakness_count(self, obj):
        """Display count of weaknesses"""
        return len(obj.self_reported_weaknesses) if obj.self_reported_weaknesses else 0
    weakness_count.short_description = '# Weaknesses'
    
    def has_add_permission(self, request):
        """Prevent adding context through admin (should use API)"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Allow deletion for data management"""
        return True


# Phase 5+ admin interfaces will be added here
# Examples:
# - ContentVersionAdmin: for managing content versions
# - PerformanceHistoryAdmin: for Module 3 analytics


