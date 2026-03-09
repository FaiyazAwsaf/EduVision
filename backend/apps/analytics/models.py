import uuid
from django.db import models


class StudentPerformanceSnapshot(models.Model):
    """
    Stores a summary of a student's performance after each assessed script.
    Updated whenever a script is evaluated so analytics queries stay fast.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    student = models.ForeignKey(
        "authentication.CustomUser",
        on_delete=models.CASCADE,
        related_name="performance_snapshots",
        limit_choices_to={"role": "student"},
    )
    script = models.OneToOneField(
        "evaluation.AnswerScript",
        on_delete=models.CASCADE,
        related_name="performance_snapshot",
    )

    # Context
    subject = models.CharField(max_length=200, blank=True, default="")
    assessment_title = models.CharField(max_length=255, blank=True, default="")

    # Scores
    total_score = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    max_score = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Per-question breakdown stored as JSON list:
    # [{"question_number": 1, "marks_awarded": 8, "max_marks": 10, "percentage": 80}]
    question_breakdown = models.JSONField(default=list, blank=True)

    timestamp = models.DateTimeField()  # Copy of script.evaluated_at for easy ordering

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "analytics_student_performance_snapshots"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["student", "-timestamp"]),
            models.Index(fields=["student", "subject"]),
        ]

    def __str__(self):
        return f"{self.student} – {self.assessment_title} ({self.percentage}%)"


class MisconceptionRecord(models.Model):
    """
    Stores a detected misconception cluster for a question, derived from
    rule-level failure patterns in QuestionEvaluation records.
    """

    MISCONCEPTION_TYPES = [
        ("sign_error", "Sign Error"),
        ("formula_misuse", "Formula Misuse"),
        ("missing_keyword", "Missing Keyword"),
        ("calculation_error", "Calculation Error"),
        ("conceptual_error", "Conceptual Error"),
        ("incorrect_steps", "Incorrect Solution Steps"),
        ("unit_error", "Incorrect Unit Usage"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    question_rubric = models.ForeignKey(
        "rubrics.QuestionRubric",
        on_delete=models.CASCADE,
        related_name="misconception_records",
    )
    misconception_type = models.CharField(max_length=30, choices=MISCONCEPTION_TYPES)
    description = models.TextField(help_text="Human-readable description of the pattern")
    frequency = models.PositiveIntegerField(
        default=0, help_text="Number of students exhibiting this misconception"
    )
    percentage_affected = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text="Percentage of evaluated students with this misconception",
    )
    example_answers = models.JSONField(
        default=list,
        blank=True,
        help_text="Up to 3 anonymised example student answers",
    )
    timestamp = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "analytics_misconception_records"
        ordering = ["-frequency"]
        indexes = [
            models.Index(fields=["question_rubric", "-frequency"]),
        ]

    def __str__(self):
        return f"{self.get_misconception_type_display()} – Q{self.question_rubric.question_number} (×{self.frequency})"
