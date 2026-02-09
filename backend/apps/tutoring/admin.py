"""
Tutoring Admin Configuration

Admin interface for managing tutoring sessions.
"""

from django.contrib import admin
from apps.tutoring.models import TutoringSession


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
    search_fields = [
        'room_id', 
        'teacher__first_name', 
        'teacher__last_name', 
        'student__first_name', 
        'student__last_name'
    ]
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

