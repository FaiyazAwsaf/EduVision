from django.contrib import admin
from .models import (
    QuestionPaper, 
    Question, 
    Rubric, 
    AnswerScript, 
    ScriptPage, 
    QuestionEvaluation
)


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1


class RubricInline(admin.StackedInline):
    model = Rubric
    extra = 0


class ScriptPageInline(admin.TabularInline):
    model = ScriptPage
    extra = 0
    readonly_fields = ["extracted_text", "ocr_confidence"]


class QuestionEvaluationInline(admin.TabularInline):
    model = QuestionEvaluation
    extra = 0
    readonly_fields = [
        "method_marks_awarded", 
        "calculation_marks_awarded", 
        "answer_marks_awarded",
        "total_marks_awarded"
    ]


@admin.register(QuestionPaper)
class QuestionPaperAdmin(admin.ModelAdmin):
    list_display = ["title", "subject", "class_level", "total_marks", "created_at"]
    list_filter = ["subject", "class_level"]
    search_fields = ["title", "description"]
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["question_number", "question_paper", "question_type", "max_marks"]
    list_filter = ["question_type", "question_paper"]
    search_fields = ["question_text"]
    inlines = [RubricInline]


@admin.register(Rubric)
class RubricAdmin(admin.ModelAdmin):
    list_display = ["question", "method_marks", "calculation_marks", "answer_marks", "total_marks"]
    list_filter = ["question__question_paper"]


@admin.register(AnswerScript)
class AnswerScriptAdmin(admin.ModelAdmin):
    list_display = ["id", "student_name", "question_paper", "status", "total_score", "created_at"]
    list_filter = ["status", "question_paper"]
    search_fields = ["student_name", "student_id"]
    inlines = [ScriptPageInline, QuestionEvaluationInline]
    readonly_fields = ["total_score", "percentage", "evaluated_at"]


@admin.register(ScriptPage)
class ScriptPageAdmin(admin.ModelAdmin):
    list_display = ["script", "page_number", "ocr_confidence", "created_at"]
    list_filter = ["script__status"]


@admin.register(QuestionEvaluation)
class QuestionEvaluationAdmin(admin.ModelAdmin):
    list_display = [
        "script", 
        "question", 
        "total_marks_awarded", 
        "confidence_score", 
        "needs_manual_review"
    ]
    list_filter = ["needs_manual_review", "script__question_paper"]
    readonly_fields = ["total_marks_awarded"]
