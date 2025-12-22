from rest_framework import serializers
from .models import (
    QuestionPaper, 
    Question, 
    Rubric, 
    AnswerScript, 
    ScriptPage, 
    QuestionEvaluation
)


class RubricSerializer(serializers.ModelSerializer):
    """Serializer for grading rubrics."""
    total_marks = serializers.ReadOnlyField()
    
    class Meta:
        model = Rubric
        fields = [
            "id",
            "method_marks",
            "calculation_marks", 
            "answer_marks",
            "total_marks",
            "key_points",
            "common_mistakes",
            "grading_notes",
        ]


class QuestionSerializer(serializers.ModelSerializer):
    """Serializer for questions."""
    rubric = RubricSerializer(read_only=True)
    
    class Meta:
        model = Question
        fields = [
            "id",
            "question_number",
            "question_text",
            "question_type",
            "max_marks",
            "model_answer",
            "rubric",
        ]


class QuestionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating questions with rubrics."""
    rubric = RubricSerializer(required=False)
    
    class Meta:
        model = Question
        fields = [
            "question_number",
            "question_text",
            "question_type",
            "max_marks",
            "model_answer",
            "rubric",
        ]
    
    def create(self, validated_data):
        rubric_data = validated_data.pop("rubric", None)
        question = Question.objects.create(**validated_data)
        
        if rubric_data:
            Rubric.objects.create(question=question, **rubric_data)
        else:
            # Create default rubric
            Rubric.objects.create(
                question=question,
                method_marks=2,
                calculation_marks=2,
                answer_marks=1,
            )
        
        return question


class QuestionPaperListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing question papers."""
    question_count = serializers.SerializerMethodField()
    
    class Meta:
        model = QuestionPaper
        fields = [
            "id",
            "title",
            "subject",
            "class_level",
            "total_marks",
            "question_count",
            "created_at",
        ]
    
    def get_question_count(self, obj):
        return obj.questions.count()


class QuestionPaperDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for question papers with questions."""
    questions = QuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = QuestionPaper
        fields = [
            "id",
            "title",
            "subject",
            "class_level",
            "total_marks",
            "description",
            "questions",
            "created_at",
            "updated_at",
        ]


class QuestionPaperCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating question papers with questions."""
    questions = QuestionCreateSerializer(many=True, required=False)
    
    class Meta:
        model = QuestionPaper
        fields = [
            "title",
            "subject",
            "class_level",
            "description",
            "questions",
        ]
    
    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        question_paper = QuestionPaper.objects.create(**validated_data)
        
        total_marks = 0
        for question_data in questions_data:
            rubric_data = question_data.pop("rubric", None)
            question = Question.objects.create(
                question_paper=question_paper,
                **question_data
            )
            total_marks += question.max_marks
            
            if rubric_data:
                Rubric.objects.create(question=question, **rubric_data)
            else:
                Rubric.objects.create(
                    question=question,
                    method_marks=2,
                    calculation_marks=2,
                    answer_marks=1,
                )
        
        question_paper.total_marks = total_marks
        question_paper.save()
        
        return question_paper


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
    question_number = serializers.CharField(source="question.question_number", read_only=True)
    question_text = serializers.CharField(source="question.question_text", read_only=True)
    max_marks = serializers.IntegerField(source="question.max_marks", read_only=True)
    
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
    question_paper_title = serializers.CharField(source="question_paper.title", read_only=True)
    page_count = serializers.SerializerMethodField()
    
    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "question_paper_title",
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
    question_paper = QuestionPaperDetailSerializer(read_only=True)
    pages = ScriptPageSerializer(many=True, read_only=True)
    question_evaluations = QuestionEvaluationSerializer(many=True, read_only=True)
    
    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "question_paper",
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
            "question_paper",
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
