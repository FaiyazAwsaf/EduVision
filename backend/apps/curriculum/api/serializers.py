from rest_framework import serializers
from ..models import (
    CourseOutline,
    CourseWeek,
    CourseTopic,
    TopicProgress,
    TopicDifficultyFlag,
    TopicMaterial,
    TeacherNotification,
    ProgressStatus,
    MaterialType,
)


# ─── Topic Serializers ────────────────────────────────────────────────────────


class CourseTopicSerializer(serializers.ModelSerializer):
    subtopics = serializers.SerializerMethodField()
    materials = serializers.SerializerMethodField()

    class Meta:
        model = CourseTopic
        fields = [
            "id", "title", "description", "order",
            "course_outcomes", "parent_topic", "subtopics",
            "materials",
        ]

    def get_subtopics(self, obj):
        children = sorted(obj.subtopics.all(), key=lambda t: t.order)
        return CourseTopicSerializer(children, many=True, context=self.context).data

    def get_materials(self, obj):
        from .serializers import TopicMaterialSerializer
        return TopicMaterialSerializer(
            sorted(obj.materials.all(), key=lambda m: m.created_at, reverse=True),
            many=True, context=self.context,
        ).data


class CourseTopicWithProgressSerializer(serializers.ModelSerializer):
    """Topic with the requesting student's progress and difficulty flag status."""

    subtopics = serializers.SerializerMethodField()
    progress_status = serializers.SerializerMethodField()
    is_flagged_difficult = serializers.SerializerMethodField()
    materials_count = serializers.SerializerMethodField()

    class Meta:
        model = CourseTopic
        fields = [
            "id", "title", "description", "order",
            "course_outcomes", "parent_topic",
            "subtopics", "progress_status",
            "is_flagged_difficult", "materials_count",
        ]

    def get_subtopics(self, obj):
        children = sorted(obj.subtopics.all(), key=lambda t: t.order)
        return CourseTopicWithProgressSerializer(
            children, many=True, context=self.context
        ).data

    def get_progress_status(self, obj):
        progress_map = self.context.get("progress_map")
        if progress_map is not None:
            return progress_map.get(str(obj.id), ProgressStatus.NOT_STARTED)
        student = self.context.get("student")
        if not student:
            return ProgressStatus.NOT_STARTED
        entry = TopicProgress.objects.filter(student=student, topic=obj).first()
        return entry.status if entry else ProgressStatus.NOT_STARTED

    def get_is_flagged_difficult(self, obj):
        flag_ids = self.context.get("flag_ids")
        if flag_ids is not None:
            return str(obj.id) in flag_ids
        student = self.context.get("student")
        if not student:
            return False
        return TopicDifficultyFlag.objects.filter(
            student=student, topic=obj
        ).exists()

    def get_materials_count(self, obj):
        return len(obj.materials.all())


# ─── Week Serializer ──────────────────────────────────────────────────────────


class CourseWeekSerializer(serializers.ModelSerializer):
    topics = serializers.SerializerMethodField()

    class Meta:
        model = CourseWeek
        fields = ["id", "week_number", "is_exam_week", "exam_label", "topics"]

    def get_topics(self, obj):
        # Only parent-level topics; subtopics are nested inside
        # Use in-memory filtering on prefetched data to avoid extra queries
        parent_topics = sorted(
            [t for t in obj.topics.all() if t.parent_topic_id is None],
            key=lambda t: t.order,
        )
        serializer_class = self.context.get(
            "topic_serializer", CourseTopicSerializer
        )
        return serializer_class(
            parent_topics, many=True, context=self.context
        ).data


# ─── Outline Serializers ──────────────────────────────────────────────────────


class CourseOutlineListSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(
        source="teaching_assignment.subject.name", read_only=True
    )
    section_name = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = CourseOutline
        fields = [
            "id", "title", "course_code", "parsing_status",
            "subject_name", "section_name", "teacher_name",
            "created_at",
        ]

    def get_section_name(self, obj):
        sec = obj.teaching_assignment.section
        return f"{sec.class_ref.name}-{sec.name}"

    def get_teacher_name(self, obj):
        t = obj.teaching_assignment.teacher
        return f"{t.first_name} {t.last_name}"


class CourseOutlineDetailSerializer(serializers.ModelSerializer):
    weeks = serializers.SerializerMethodField()
    subject_name = serializers.CharField(
        source="teaching_assignment.subject.name", read_only=True
    )
    section_name = serializers.SerializerMethodField()
    teacher_name = serializers.SerializerMethodField()

    class Meta:
        model = CourseOutline
        fields = [
            "id", "title", "course_code", "course_objectives",
            "parsing_status", "parsing_error",
            "subject_name", "section_name", "teacher_name",
            "weeks",
            "created_at", "updated_at",
        ]

    def get_weeks(self, obj):
        weeks = sorted(obj.weeks.all(), key=lambda w: w.week_number)
        return CourseWeekSerializer(
            weeks, many=True, context=self.context
        ).data

    def get_section_name(self, obj):
        sec = obj.teaching_assignment.section
        return f"{sec.class_ref.name}-{sec.name}"

    def get_teacher_name(self, obj):
        t = obj.teaching_assignment.teacher
        return f"{t.first_name} {t.last_name}"


class CourseOutlineUploadSerializer(serializers.Serializer):
    teaching_assignment_id = serializers.UUIDField()
    pdf = serializers.FileField()

    def validate_pdf(self, value):
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Only PDF files are accepted.")
        if value.size > 10 * 1024 * 1024:  # 10 MB
            raise serializers.ValidationError("PDF must be under 10 MB.")
        return value


# ─── Progress Serializers ─────────────────────────────────────────────────────


class TopicProgressUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ProgressStatus.choices)


class TopicProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicProgress
        fields = ["id", "topic", "status", "completed_at", "updated_at"]


class CourseProgressSummarySerializer(serializers.Serializer):
    total_topics = serializers.IntegerField()
    completed = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    not_started = serializers.IntegerField()
    percentage = serializers.FloatField()


# ─── Difficulty Serializers ───────────────────────────────────────────────────


class DifficultyFlagCreateSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")


class DifficultyFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopicDifficultyFlag
        fields = ["id", "topic", "note", "flagged_at", "resolved"]


class DifficultyStudentSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    note = serializers.CharField()
    flagged_at = serializers.CharField()


class DifficultyReportItemSerializer(serializers.Serializer):
    topic_id = serializers.CharField()
    topic_title = serializers.CharField()
    flag_count = serializers.IntegerField()
    total_students = serializers.IntegerField()
    percentage = serializers.FloatField()
    above_threshold = serializers.BooleanField()
    students = DifficultyStudentSerializer(many=True)


# ─── Material Serializers ─────────────────────────────────────────────────────


class TopicMaterialUploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=300)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    material_type = serializers.ChoiceField(choices=MaterialType.choices)
    file = serializers.FileField(required=False)
    external_link = serializers.URLField(required=False, allow_blank=True, default="")

    def validate(self, data):
        mt = data.get("material_type")
        if mt == MaterialType.FILE and not data.get("file"):
            raise serializers.ValidationError(
                {"file": "A file is required for FILE type materials."}
            )
        if mt == MaterialType.LINK and not data.get("external_link"):
            raise serializers.ValidationError(
                {"external_link": "A link is required for LINK type materials."}
            )
        return data


class TopicMaterialSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    content_request_id = serializers.UUIDField(
        read_only=True, allow_null=True
    )

    class Meta:
        model = TopicMaterial
        fields = [
            "id", "title", "description", "material_type",
            "file_url", "external_link", "content_request_id",
            "uploaded_by_name", "created_at",
        ]

    def get_uploaded_by_name(self, obj):
        return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}"

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


# ─── Notification Serializers ─────────────────────────────────────────────────


class TeacherNotificationSerializer(serializers.ModelSerializer):
    topic_title = serializers.CharField(source="topic.title", read_only=True)
    course_title = serializers.CharField(
        source="course_outline.title", read_only=True
    )

    class Meta:
        model = TeacherNotification
        fields = [
            "id", "notification_type", "message",
            "topic_title", "course_title",
            "flag_count", "total_students", "percentage",
            "is_read", "created_at",
        ]


class MarkNotificationsReadSerializer(serializers.Serializer):
    notification_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False
    )
    mark_all = serializers.BooleanField(default=False)
