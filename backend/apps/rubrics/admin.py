from django.contrib import admin
from .models import Rubric, RubricVersion, RubricSet, QuestionRubric, RubricSetVersion


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


class QuestionRubricInline(admin.TabularInline):
    """Inline admin for QuestionRubric."""
    model = QuestionRubric
    extra = 0
    fields = ['question_number', 'question_text', 'max_marks', 'created_at']
    readonly_fields = ['created_at']
    ordering = ['question_number']


@admin.register(RubricSet)
class RubricSetAdmin(admin.ModelAdmin):
    """Admin interface for RubricSet model."""
    
    list_display = ['title', 'subject', 'state', 'version', 'total_marks', 'created_by', 'created_at']
    list_filter = ['state', 'subject', 'created_at']
    search_fields = ['title', 'subject']
    readonly_fields = ['id', 'version', 'created_at', 'updated_at']
    inlines = [QuestionRubricInline]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'title', 'subject', 'state', 'version')
        }),
        ('Assessment Details', {
            'fields': ('total_marks', 'metadata')
        }),
        ('Audit Information', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(QuestionRubric)
class QuestionRubricAdmin(admin.ModelAdmin):
    """Admin interface for QuestionRubric model."""
    
    list_display = ['rubric_set', 'question_number', 'max_marks', 'created_at']
    list_filter = ['rubric_set__subject', 'created_at']
    search_fields = ['rubric_set__title', 'question_text']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Question Information', {
            'fields': ('id', 'rubric_set', 'question_number')
        }),
        ('Question Content', {
            'fields': ('question_text', 'max_marks')
        }),
        ('Evaluation Rules', {
            'fields': ('evaluation_rules',),
            'classes': ('collapse',)
        }),
        ('Audit Information', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(RubricSetVersion)
class RubricSetVersionAdmin(admin.ModelAdmin):
    """Admin interface for RubricSetVersion model."""
    
    list_display = ['rubric_set', 'version_number', 'created_at']
    list_filter = ['created_at']
    search_fields = ['rubric_set__title']
    readonly_fields = ['id', 'rubric_set', 'version_number', 'snapshot', 'created_at']
    
    def has_add_permission(self, request):
        """Prevent manual creation of versions."""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Prevent editing of versions."""
        return False
