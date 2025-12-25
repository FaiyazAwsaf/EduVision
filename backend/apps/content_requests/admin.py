"""
Django Admin Configuration for Content Requests Module

Provides administrative interface for managing content requests and generated content.
"""
from django.contrib import admin
from .models import ContentRequestModel, GeneratedContentModel


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


# Phase 3+ admin interfaces will be added here
# Examples:
# - UserFeedbackAdmin: for reviewing user feedback
# - ContentVersionAdmin: for managing content versions
