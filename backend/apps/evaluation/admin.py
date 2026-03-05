from django.contrib import admin
from .models import AnswerScript, ScriptPage, QuestionEvaluation, ScriptSubmissionForm


class ScriptPageInline(admin.TabularInline):
    model = ScriptPage
    extra = 0
    readonly_fields = ["extracted_text", "ocr_confidence"]


class QuestionEvaluationInline(admin.TabularInline):
    model = QuestionEvaluation
    extra = 0
    readonly_fields = ["question_rubric", "total_marks_awarded", "confidence_score"]


@admin.register(AnswerScript)
class AnswerScriptAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "rubric_set",
        "student_name",
        "student_id",
        "status",
        "total_score",
        "percentage",
        "created_at",
        "evaluated_at",
    ]
    list_filter = ["status", "created_at", "evaluated_at"]
    search_fields = ["student_name", "student_id", "rubric_set__title"]
    readonly_fields = [
        "total_score",
        "percentage",
        "feedback_summary",
        "strengths",
        "areas_for_improvement",
        "evaluated_at",
    ]
    inlines = [ScriptPageInline, QuestionEvaluationInline]
    date_hierarchy = "created_at"


@admin.register(ScriptPage)
class ScriptPageAdmin(admin.ModelAdmin):
    list_display = ["script", "page_number", "ocr_confidence", "created_at"]
    list_filter = ["created_at"]
    readonly_fields = ["extracted_text", "extracted_equations", "ocr_confidence"]


@admin.register(QuestionEvaluation)
class QuestionEvaluationAdmin(admin.ModelAdmin):
    list_display = [
        "script",
        "question_rubric",
        "total_marks_awarded",
        "confidence_score",
        "needs_manual_review",
    ]
    list_filter = ["needs_manual_review", "created_at"]
    readonly_fields = [
        "total_marks_awarded",
        "confidence_score",
        "key_points_found",
        "key_points_missing",
        "mistakes_identified",
    ]
    search_fields = ["script__student_name", "question_rubric__question_number"]


@admin.register(ScriptSubmissionForm)
class ScriptSubmissionFormAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "assignment",
        "status",
        "deadline",
        "created_at",
    ]
    list_filter = ["status", "created_at"]
    search_fields = ["title", "assignment__subject__name"]
