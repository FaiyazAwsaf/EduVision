from rest_framework import serializers
from .models import (
    AnswerScript,
    ScriptPage,
    QuestionEvaluation,
    ScriptSubmissionForm,
)
from apps.rubrics.models import RubricSet, QuestionRubric
from apps.rubrics.serializers import RubricSetSerializer
from apps.students.models import TeacherSubjectAssignment, StudentProfile
from apps.authentication.models import CustomUser


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
    max_marks = serializers.FloatField(source="question_rubric.max_marks", read_only=True)
    method_marks_awarded = serializers.FloatField(read_only=True)
    calculation_marks_awarded = serializers.FloatField(read_only=True)
    answer_marks_awarded = serializers.FloatField(read_only=True)
    total_marks_awarded = serializers.FloatField(read_only=True)
    
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
    rubric_set_title = serializers.CharField(source="rubric_set.title", read_only=True, default="")
    page_count = serializers.SerializerMethodField()
    total_score = serializers.FloatField(read_only=True)
    percentage = serializers.FloatField(read_only=True)
    student_full_name = serializers.SerializerMethodField()
    student_roll_number = serializers.SerializerMethodField()
    
    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "student_full_name",
            "student_roll_number",
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

    def get_student_full_name(self, obj):
        if obj.student_user:
            return f"{obj.student_user.first_name} {obj.student_user.last_name}"
        return obj.student_name or ""

    def get_student_roll_number(self, obj):
        if obj.student_user:
            try:
                return obj.student_user.student_profile.roll_number
            except StudentProfile.DoesNotExist:
                pass
        return obj.student_id or ""


class AnswerScriptDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for answer scripts with evaluations."""
    rubric_set = RubricSetSerializer(read_only=True)
    pages = ScriptPageSerializer(many=True, read_only=True)
    question_evaluations = QuestionEvaluationSerializer(many=True, read_only=True)
    total_score = serializers.FloatField(read_only=True)
    percentage = serializers.FloatField(read_only=True)
    student_full_name = serializers.SerializerMethodField()
    student_roll_number = serializers.SerializerMethodField()
    student_section = serializers.SerializerMethodField()
    student_class = serializers.SerializerMethodField()
    submission_form_title = serializers.CharField(
        source="submission_form.title", read_only=True, default=""
    )
    
    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "student_full_name",
            "student_roll_number",
            "student_section",
            "student_class",
            "rubric_set",
            "submission_form",
            "submission_form_title",
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

    def get_student_full_name(self, obj):
        if obj.student_user:
            return f"{obj.student_user.first_name} {obj.student_user.last_name}"
        return obj.student_name or ""

    def get_student_roll_number(self, obj):
        if obj.student_user:
            try:
                return obj.student_user.student_profile.roll_number
            except StudentProfile.DoesNotExist:
                pass
        return obj.student_id or ""

    def get_student_section(self, obj):
        if obj.student_user:
            try:
                sec = obj.student_user.student_profile.section
                return sec.name if sec else ""
            except StudentProfile.DoesNotExist:
                pass
        return ""

    def get_student_class(self, obj):
        if obj.student_user:
            try:
                sec = obj.student_user.student_profile.section
                return sec.class_ref.name if sec and sec.class_ref else ""
            except StudentProfile.DoesNotExist:
                pass
        return ""


class AnswerScriptCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating answer scripts (teacher manual upload)."""
    pages = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=True
    )
    student_user_id = serializers.UUIDField(
        write_only=True, required=True,
        help_text="UUID of the student user to link this script to.",
    )
    roll_number = serializers.CharField(
        write_only=True, required=False, allow_blank=True,
        help_text="Student roll number (legacy, optional if student_user_id is provided).",
    )
    
    class Meta:
        model = AnswerScript
        fields = [
            "rubric_set",
            "student_name",
            "student_id",
            "student_user_id",
            "roll_number",
            "submission_form",
            "pages",
        ]
    
    def validate_pages(self, value):
        if len(value) > 10:
            raise serializers.ValidationError("Maximum 10 pages allowed per script.")
        if len(value) == 0:
            raise serializers.ValidationError("At least one page is required.")
        return value

    def validate_student_user_id(self, value):
        try:
            user = CustomUser.objects.get(id=value, role="student")
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError("Student not found.")
        return value
    
    def create(self, validated_data):
        pages_data = validated_data.pop("pages")
        student_user_id = validated_data.pop("student_user_id", None)
        roll_number = validated_data.pop("roll_number", None)
        request = self.context.get("request")

        # Link student by user ID (primary method)
        if student_user_id:
            try:
                student_user = CustomUser.objects.get(id=student_user_id, role="student")
                validated_data["student_user"] = student_user
                validated_data.setdefault(
                    "student_name",
                    f"{student_user.first_name} {student_user.last_name}",
                )
                try:
                    profile = student_user.student_profile
                    validated_data.setdefault("student_id", profile.roll_number)
                except StudentProfile.DoesNotExist:
                    pass
            except CustomUser.DoesNotExist:
                pass
        elif roll_number:
            # Fallback: look up by roll number
            try:
                student_profile = StudentProfile.objects.select_related("user").get(
                    roll_number=roll_number
                )
                validated_data["student_user"] = student_profile.user
                validated_data.setdefault(
                    "student_name",
                    f"{student_profile.user.first_name} {student_profile.user.last_name}",
                )
                validated_data.setdefault("student_id", roll_number)
            except StudentProfile.DoesNotExist:
                pass

        # Record who uploaded
        if request and request.user and request.user.is_authenticated:
            if request.user.role == "teacher":
                validated_data["uploaded_by"] = request.user

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


# ─── Submission Form Serializers ─────────────────────────────────────────────


class ScriptSubmissionFormSerializer(serializers.ModelSerializer):
    """Read serializer with nested assignment details."""

    subject_name = serializers.CharField(
        source="assignment.subject.name", read_only=True
    )
    subject_code = serializers.CharField(
        source="assignment.subject.code", read_only=True
    )
    section_name = serializers.CharField(
        source="assignment.section.name", read_only=True
    )
    class_name = serializers.CharField(
        source="assignment.section.class_ref.name", read_only=True
    )
    teacher_name = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    evaluated_count = serializers.SerializerMethodField()

    class Meta:
        model = ScriptSubmissionForm
        fields = [
            "id",
            "assignment",
            "title",
            "description",
            "status",
            "deadline",
            "subject_name",
            "subject_code",
            "section_name",
            "class_name",
            "teacher_name",
            "submission_count",
            "pending_count",
            "evaluated_count",
            "created_at",
            "updated_at",
        ]

    def get_teacher_name(self, obj):
        t = obj.assignment.teacher
        return f"{t.first_name} {t.last_name}"

    def get_submission_count(self, obj):
        return obj.scripts.count()

    def get_pending_count(self, obj):
        return obj.scripts.filter(status="pending").count()

    def get_evaluated_count(self, obj):
        return obj.scripts.filter(status="evaluated").count()


class ScriptSubmissionFormCreateSerializer(serializers.ModelSerializer):
    """Create serializer — validates the teacher owns the assignment."""

    class Meta:
        model = ScriptSubmissionForm
        fields = ["assignment", "title", "description", "deadline"]

    def validate_assignment(self, value):
        request = self.context.get("request")
        if request and value.teacher != request.user:
            raise serializers.ValidationError(
                "You can only create forms for your own teaching assignments."
            )
        return value


# ─── Enhanced Answer Script Serializers (with student info) ──────────────────


class AnswerScriptListEnhancedSerializer(serializers.ModelSerializer):
    """Script list with student profile info for teacher views."""

    rubric_set_title = serializers.CharField(
        source="rubric_set.title", read_only=True, default=""
    )
    submission_form_title = serializers.CharField(
        source="submission_form.title", read_only=True, default=""
    )
    page_count = serializers.SerializerMethodField()
    total_score = serializers.FloatField(read_only=True)
    percentage = serializers.FloatField(read_only=True)

    # Student info from FK
    student_full_name = serializers.SerializerMethodField()
    student_roll_number = serializers.SerializerMethodField()
    student_section = serializers.SerializerMethodField()
    student_class = serializers.SerializerMethodField()

    class Meta:
        model = AnswerScript
        fields = [
            "id",
            "student_name",
            "student_id",
            "student_full_name",
            "student_roll_number",
            "student_section",
            "student_class",
            "rubric_set",
            "rubric_set_title",
            "submission_form",
            "submission_form_title",
            "status",
            "total_score",
            "percentage",
            "page_count",
            "created_at",
            "evaluated_at",
        ]

    def get_page_count(self, obj):
        return obj.pages.count()

    def get_student_full_name(self, obj):
        if obj.student_user:
            return f"{obj.student_user.first_name} {obj.student_user.last_name}"
        return obj.student_name or ""

    def get_student_roll_number(self, obj):
        if obj.student_user:
            try:
                return obj.student_user.student_profile.roll_number
            except StudentProfile.DoesNotExist:
                pass
        return obj.student_id or ""

    def get_student_section(self, obj):
        if obj.student_user:
            try:
                sec = obj.student_user.student_profile.section
                return sec.name if sec else ""
            except StudentProfile.DoesNotExist:
                pass
        return ""

    def get_student_class(self, obj):
        if obj.student_user:
            try:
                sec = obj.student_user.student_profile.section
                return sec.class_ref.name if sec and sec.class_ref else ""
            except StudentProfile.DoesNotExist:
                pass
        return ""


class StudentScriptSubmitSerializer(serializers.Serializer):
    """Serializer for student submitting scripts to a form."""

    pages = serializers.ListField(
        child=serializers.ImageField(),
        required=True,
    )

    def validate_pages(self, value):
        if len(value) > 10:
            raise serializers.ValidationError("Maximum 10 pages allowed per script.")
        if len(value) == 0:
            raise serializers.ValidationError("At least one page is required.")
        return value
