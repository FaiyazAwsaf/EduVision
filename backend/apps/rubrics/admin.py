from django.contrib import admin
from .models import Rubric, RubricVersion


@admin.register(Rubric)
class RubricAdmin(admin.ModelAdmin):
    """Admin interface for Rubric model."""
    
    list_display = ['title', 'subject', 'state', 'version', 'total_marks', 'created_by', 'created_at']
    list_filter = ['state', 'subject', 'created_at']
    search_fields = ['title', 'subject', 'question_text']
    readonly_fields = ['id', 'version', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'title', 'subject', 'state', 'version')
        }),
        ('Question Details', {
            'fields': ('question_text', 'reference_answer', 'total_marks')
        }),
        ('Evaluation Rules', {
            'fields': ('evaluation_rules',),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RubricVersion)
class RubricVersionAdmin(admin.ModelAdmin):
    """Admin interface for RubricVersion model."""
    
    list_display = ['rubric', 'version_number', 'created_at']
    list_filter = ['created_at']
    search_fields = ['rubric__title']
    readonly_fields = ['id', 'rubric', 'version_number', 'snapshot', 'created_at']
    
    def has_add_permission(self, request):
        """Prevent manual creation of versions."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Prevent editing of versions."""
        return False
