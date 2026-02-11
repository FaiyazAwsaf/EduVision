"""
Tutoring Admin Configuration
"""

from django.contrib import admin
from apps.tutoring.models import TutoringSession, SessionParticipant


class SessionParticipantInline(admin.TabularInline):
    model = SessionParticipant
    extra = 0
    readonly_fields = ['id', 'joined_at', 'left_at']
    raw_id_fields = ['user']


@admin.register(TutoringSession)
class TutoringSessionAdmin(admin.ModelAdmin):
    list_display = [
        'room_id',
        'teacher',
        'section',
        'status',
        'participant_count',
        'created_at',
        'ended_at',
    ]
    list_filter = ['status', 'created_at']
    search_fields = [
        'room_id',
        'teacher__first_name',
        'teacher__last_name',
    ]
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['teacher', 'section']
    ordering = ['-created_at']
    inlines = [SessionParticipantInline]

    fieldsets = (
        ('Session Info', {
            'fields': ('id', 'room_id', 'status', 'section')
        }),
        ('Teacher', {
            'fields': ('teacher', 'livekit_token_teacher'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'ended_at', 'grace_expires_at')
        }),
    )

    def participant_count(self, obj):
        return obj.participants.filter(left_at__isnull=True).count()
    participant_count.short_description = 'Active Participants'


@admin.register(SessionParticipant)
class SessionParticipantAdmin(admin.ModelAdmin):
    list_display = ['user', 'session', 'joined_at', 'left_at']
    list_filter = ['joined_at']
    raw_id_fields = ['user', 'session']
    readonly_fields = ['id', 'joined_at']
