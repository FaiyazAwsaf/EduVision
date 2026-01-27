from rest_framework import serializers
from .models import (
    AnswerScript, 
    ScriptPage, 
    QuestionEvaluation
)
from apps.rubrics.models import RubricSet, QuestionRubric
from apps.rubrics.serializers import RubricSetSerializer


class ScriptPageSerializer(serializers.ModelSerializer):
    """Serializer for script pages."""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = ScriptPage
        fields = [
            "id",
            "page_number",
            "image",
            "image_url",
            "extracted_text",
            "extracted_equations",
            "ocr_confidence",
        ]
        read_only_fields = ["extracted_text", "extracted_equations", "ocr_confidence"]
    
    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class QuestionEvaluationSerializer(serializers.ModelSerializer):
    """Serializer for question evaluations."""
    question_number = serializers.CharField(source="question_rubric.question_number", read_only=True)
    question_text = serializers.CharField(source="question_rubric.question_text", read_only=True)
    max_marks = serializers.DecimalField(source="question_rubric.max_marks", max_digits=10, decimal_places=2, read_only=True)
    
    class Meta:
        model = QuestionEvaluation
        fields = [
            "id",
            "question_number",
            "question_text",
            "max_marks",
            "method_marks_awarded",
            "calculation_marks_awarded",
            "answer_marks_awarded",
            "total_marks_awarded",
            "student_answer_text",
            "method_feedback",
            "calculation_feedback",
            "answer_feedback",
            "key_points_found",
            "key_points_missing",
            "mistakes_identified",
            "overall_feedback",
            "confidence_score",
            "needs_manual_review",
            "review_reason",
        ]


class AnswerScriptListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing answer scripts."""
    rubric_set_title = serializers.CharField(source="rubric_set.title", read_only=True)
    page_count = serializers.SerializerMethodField()
    
    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "rubric_set_title",
            "status",
            "total_score",
            "percentage",
            "page_count",
            "created_at",
            "evaluated_at",
        ]
    
    def get_page_count(self, obj):
        return obj.pages.count()


class AnswerScriptDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for answer scripts with evaluations."""
    rubric_set = RubricSetSerializer(read_only=True)
    pages = ScriptPageSerializer(many=True, read_only=True)
    question_evaluations = QuestionEvaluationSerializer(many=True, read_only=True)
    
    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "rubric_set",
            "status",
            "total_score",
            "percentage",
            "feedback_summary",
            "strengths",
            "areas_for_improvement",
            "pages",
            "question_evaluations",
            "created_at",
            "evaluated_at",
        ]


class AnswerScriptCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating answer scripts."""
    pages = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=True
    )
    
    class Meta:
        model = AnswerScript
        fields = [
            "rubric_set",
            "student_name",
            "student_id",
            "pages",
        ]
    
    def validate_pages(self, value):
        if len(value) > 10:
            raise serializers.ValidationError("Maximum 10 pages allowed per script.")
        if len(value) == 0:
            raise serializers.ValidationError("At least one page is required.")
        return value
    
    def create(self, validated_data):
        pages_data = validated_data.pop("pages")
        script = AnswerScript.objects.create(**validated_data)
        
        for i, page_image in enumerate(pages_data, start=1):
            ScriptPage.objects.create(
                script=script,
                page_number=i,
                image=page_image
            )
        
        return script


class EvaluationReportSerializer(serializers.Serializer):
    """Serializer for the complete evaluation report."""
    script = AnswerScriptDetailSerializer()
    summary = serializers.DictField()
    
    class Meta:
        fields = ["script", "summary"]
