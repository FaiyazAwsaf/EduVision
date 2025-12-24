"""
Django Admin Configuration for Content Requests Module

Provides administrative interface for managing content requests,
generated content, and user feedback.
"""
from django.contrib import admin
from .models import ContentRequest, GeneratedContent, UserFeedback


@admin.register(ContentRequest)
class ContentRequestAdmin(admin.ModelAdmin):
    """Admin interface for ContentRequest model"""
    
    list_display = ('id', 'topic', 'style', 'format', 'status', 'created_at', 'updated_at')
    list_filter = ('status', 'format', 'style', 'created_at')
    search_fields = ('topic', 'metadata')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Request Information', {
            'fields': ('topic', 'style', 'format', 'status')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(GeneratedContent)
class GeneratedContentAdmin(admin.ModelAdmin):
    """Admin interface for GeneratedContent model"""
    
    list_display = ('id', 'request', 'format', 'created_at')
    list_filter = ('format', 'created_at')
    search_fields = ('content_text', 'metadata')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    raw_id_fields = ('request',)
    
    fieldsets = (
        ('Content Information', {
            'fields': ('request', 'format', 'content_text')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )


@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
    """Admin interface for UserFeedback model"""
    
    list_display = ('id', 'request', 'feedback_type', 'created_at')
    list_filter = ('feedback_type', 'created_at')
    search_fields = ('notes',)
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)
    raw_id_fields = ('request',)
    
    fieldsets = (
        ('Feedback Information', {
            'fields': ('request', 'feedback_type', 'notes')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
