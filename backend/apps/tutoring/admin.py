"""
Tutoring Admin Configuration

Admin interface for managing tutoring users and sessions.
"""

from django.contrib import admin
from apps.tutoring.models import TutoringUser, TutoringSession


@admin.register(TutoringUser)
class TutoringUserAdmin(admin.ModelAdmin):
    """Admin for TutoringUser model."""
    
    list_display = ['full_name', 'email', 'role', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['full_name', 'email']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']


@admin.register(TutoringSession)
class TutoringSessionAdmin(admin.ModelAdmin):
    """Admin for TutoringSession model."""
    
    list_display = [
        'room_id', 
        'teacher', 
        'student', 
        'status', 
        'created_at',
        'ended_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['room_id', 'teacher__full_name', 'student__full_name']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['teacher', 'student']
    ordering = ['-created_at']
    
    fieldsets = (
        ('Session Info', {
            'fields': ('id', 'room_id', 'status')
        }),
        ('Participants', {
            'fields': ('teacher', 'student')
        }),
        ('Tokens', {
            'fields': ('livekit_token_teacher', 'livekit_token_student'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'ended_at', 'grace_expires_at')
        }),
    )
