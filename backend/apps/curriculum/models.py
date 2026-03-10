import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


# ─── Enums ────────────────────────────────────────────────────────────────────


class ParsingStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class ProgressStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "Not Started"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"


class MaterialType(models.TextChoices):
    FILE = "FILE", "File"
    LINK = "LINK", "External Link"
    GENERATED = "GENERATED", "AI-Generated Content"


class NotificationType(models.TextChoices):
    DIFFICULTY_THRESHOLD = "DIFFICULTY_THRESHOLD", "Difficulty Threshold Exceeded"


# ─── Course Outline ───────────────────────────────────────────────────────────


class CourseOutline(models.Model):
    """
    A parsed course outline uploaded by a teacher for a specific
    TeacherSubjectAssignment (teacher + subject + section).
    One outline per assignment.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    teaching_assignment = models.OneToOneField(
        "students.TeacherSubjectAssignment",
        on_delete=models.CASCADE,
        related_name="course_outline",
        help_text=_("The teaching assignment this outline belongs to"),
    )

    title = models.CharField(
        max_length=300,
        help_text=_("Course title, e.g. 'Numerical Methods - Math 4543'"),
    )
    course_code = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text=_("Course code extracted from PDF"),
    )
    course_objectives = models.JSONField(
        default=list,
        blank=True,
        help_text=_("List of course objective strings"),
    )

    raw_pdf = models.FileField(
        upload_to="curriculum/outlines/",
        help_text=_("Original uploaded course outline PDF"),
    )

    parsing_status = models.CharField(
        max_length=20,
        choices=ParsingStatus.choices,
        default=ParsingStatus.PENDING,
        db_index=True,
    )
    parsing_error = models.TextField(
        blank=True,
        default="",
        help_text=_("Error message if parsing failed"),
    )

    created_by = models.ForeignKey(
        "authentication.CustomUser",
        on_delete=models.CASCADE,
        related_name="course_outlines",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "course_outlines"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_by"], name="co_creator_idx"),
        ]

    def __str__(self):
        return f"{self.title} [{self.parsing_status}]"


# ─── Course Week ──────────────────────────────────────────────────────────────


class CourseWeek(models.Model):
    """A week entry in the course's weekly plan."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    course_outline = models.ForeignKey(
        CourseOutline,
        on_delete=models.CASCADE,
        related_name="weeks",
    )
    week_number = models.PositiveIntegerField()
    is_exam_week = models.BooleanField(default=False)
    exam_label = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text=_("e.g. 'Midterm Examinations'"),
    )

    class Meta:
        db_table = "course_weeks"
        ordering = ["course_outline", "week_number"]
        unique_together = ("course_outline", "week_number")

    def __str__(self):
        label = f"Week {self.week_number}"
        if self.is_exam_week:
            label += f" ({self.exam_label or 'Exam'})"
        return label


# ─── Course Topic ─────────────────────────────────────────────────────────────


class CourseTopic(models.Model):
    """
    A topic within a course outline.  Supports hierarchy via parent_topic
    (e.g. 'Nonlinear Equations' → 'Bisection Method').
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    course_outline = models.ForeignKey(
        CourseOutline,
        on_delete=models.CASCADE,
        related_name="topics",
    )
    week = models.ForeignKey(
        CourseWeek,
        on_delete=models.CASCADE,
        related_name="topics",
        null=True,
        blank=True,
        help_text=_("Week this topic is taught in"),
    )
    parent_topic = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subtopics",
        help_text=_("Parent topic for hierarchical nesting"),
    )

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    order = models.PositiveIntegerField(
        default=0,
        help_text=_("Display order within week or parent"),
    )
    course_outcomes = models.JSONField(
        default=list,
        blank=True,
        help_text=_('e.g. ["CO1", "CO2", "CO3"]'),
    )

    class Meta:
        db_table = "course_topics"
        ordering = ["course_outline", "order"]
        indexes = [
            models.Index(fields=["course_outline", "week"], name="ct_outline_week_idx"),
            models.Index(fields=["parent_topic"], name="ct_parent_idx"),
        ]

    def __str__(self):
        return self.title


# ─── Topic Progress ───────────────────────────────────────────────────────────


class TopicProgress(models.Model):
    """Tracks a student's progress on a specific topic."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        "authentication.CustomUser",
        on_delete=models.CASCADE,
        related_name="topic_progress",
        limit_choices_to={"role": "student"},
    )
    topic = models.ForeignKey(
        CourseTopic,
        on_delete=models.CASCADE,
        related_name="progress_entries",
    )

    status = models.CharField(
        max_length=20,
        choices=ProgressStatus.choices,
        default=ProgressStatus.NOT_STARTED,
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "topic_progress"
        unique_together = ("student", "topic")

    def __str__(self):
        return f"{self.student} – {self.topic.title}: {self.status}"


# ─── Topic Difficulty Flag ────────────────────────────────────────────────────


class TopicDifficultyFlag(models.Model):
    """
    A student signals that they find a topic hard to understand.
    One flag per student per topic (enforced by unique_together).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        "authentication.CustomUser",
        on_delete=models.CASCADE,
        related_name="difficulty_flags",
        limit_choices_to={"role": "student"},
    )
    topic = models.ForeignKey(
        CourseTopic,
        on_delete=models.CASCADE,
        related_name="difficulty_flags",
    )
    note = models.TextField(
        blank=True,
        default="",
        help_text=_("Optional detail on what is hard"),
    )
    flagged_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "topic_difficulty_flags"
        unique_together = ("student", "topic")

    def __str__(self):
        return f"Flag: {self.student} – {self.topic.title}"


# ─── Topic Material ───────────────────────────────────────────────────────────


class TopicMaterial(models.Model):
    """Teacher-uploaded resource for a topic (file or external link)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    topic = models.ForeignKey(
        CourseTopic,
        on_delete=models.CASCADE,
        related_name="materials",
    )
    uploaded_by = models.ForeignKey(
        "authentication.CustomUser",
        on_delete=models.CASCADE,
        related_name="uploaded_materials",
    )

    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, default="")
    material_type = models.CharField(
        max_length=10,
        choices=MaterialType.choices,
    )

    file = models.FileField(
        upload_to="curriculum/materials/",
        blank=True,
        null=True,
    )
    external_link = models.URLField(
        max_length=2000,
        blank=True,
        default="",
    )
    content_request = models.ForeignKey(
        'content_requests.ContentRequestModel',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='topic_materials',
        help_text=_("Linked content request for AI-generated materials"),
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "topic_materials"
        ordering = ["-created_at"]

    def clean(self):
        if self.material_type == MaterialType.FILE and not self.file:
            raise ValidationError(_("A file must be provided for FILE type materials."))
        if self.material_type == MaterialType.LINK and not self.external_link:
            raise ValidationError(_("An external link must be provided for LINK type materials."))
        if self.material_type == MaterialType.GENERATED and not self.content_request:
            raise ValidationError(_("A content request must be linked for GENERATED type materials."))

    def __str__(self):
        return f"{self.title} ({self.material_type})"


# ─── Teacher Notification ─────────────────────────────────────────────────────


class TeacherNotification(models.Model):
    """
    Stored notification for teachers — primarily used for difficulty threshold
    alerts (>40% of students flagged a topic).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    teacher = models.ForeignKey(
        "authentication.CustomUser",
        on_delete=models.CASCADE,
        related_name="curriculum_notifications",
        limit_choices_to={"role": "teacher"},
    )
    topic = models.ForeignKey(
        CourseTopic,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    course_outline = models.ForeignKey(
        CourseOutline,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.DIFFICULTY_THRESHOLD,
    )
    message = models.TextField()
    flag_count = models.PositiveIntegerField()
    total_students = models.PositiveIntegerField()
    percentage = models.DecimalField(max_digits=5, decimal_places=2)

    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "teacher_notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["teacher", "is_read"], name="tn_teacher_read_idx"),
            models.Index(fields=["teacher", "created_at"], name="tn_teacher_time_idx"),
        ]

    def __str__(self):
        return f"Notification: {self.topic.title} ({self.percentage}%)"
