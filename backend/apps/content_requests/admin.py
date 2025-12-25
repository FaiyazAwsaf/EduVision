"""
Django Admin Configuration for Content Requests Module - Phase 1

Provides administrative interface for managing content requests.
Future phases will add more models (GeneratedContent, UserFeedback, etc.)
"""
from django.contrib import admin
from .models import ContentRequestModel


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


# Phase 2+ admin interfaces will be added here
# Examples:
# - GeneratedContentAdmin: for managing generated content
# - UserFeedbackAdmin: for reviewing user feedback

    
    fieldsets = (
        ('Feedback Information', {
            'fields': ('request', 'feedback_type', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
