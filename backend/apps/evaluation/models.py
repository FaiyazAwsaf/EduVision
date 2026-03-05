import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator


class ScriptSubmissionForm(models.Model):
    """
    A submission window opened by a teacher for students to upload scripts.
    Links to a TeacherSubjectAssignment (teacher + subject + section).
    """
    STATUS_CHOICES = [
        ("open", "Open"),
        ("closed", "Closed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(
        "students.TeacherSubjectAssignment",
        on_delete=models.CASCADE,
        related_name="submission_forms",
        help_text="The teaching assignment this form belongs to",
    )
    title = models.CharField(max_length=255, help_text="e.g. 'Mid-term ICT Exam'")
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="open")
    deadline = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "evaluation_submission_forms"

    def __str__(self):
        return f"{self.title} ({self.assignment})"


class AnswerScript(models.Model):
    """
    Represents a student's answer script (collection of page images).
    Links to RubricSet from rubrics module.
    """
    STATUS_CHOICES = [
        ("pending", "Pending Evaluation"),
        ("processing", "Processing"),
        ("evaluated", "Evaluated"),
        ("error", "Error"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Reference to RubricSet from rubrics module (now optional — assigned at evaluation time)
    rubric_set = models.ForeignKey(
        'rubrics.RubricSet',
        on_delete=models.CASCADE,
        related_name="evaluated_scripts",
        help_text="The rubric set used for evaluation",
        null=True,
        blank=True,
    )

    # ── Student linkage (new) ────────────────────────────────────────────────
    student_user = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.CASCADE,
        related_name="answer_scripts",
        null=True,
        blank=True,
        help_text="The student who owns this script",
    )
    submission_form = models.ForeignKey(
        ScriptSubmissionForm,
        on_delete=models.CASCADE,
        related_name="scripts",
        null=True,
        blank=True,
        help_text="The submission form this script was submitted through (null for teacher uploads)",
    )
    uploaded_by = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        related_name="uploaded_scripts",
        null=True,
        blank=True,
        help_text="The teacher who manually uploaded this script (null for student submissions)",
    )
    
    # Legacy student identification (kept for backward compat)
    student_name = models.CharField(max_length=255, blank=True, null=True)
    student_id = models.CharField(max_length=50, blank=True, null=True)
    
    # Processing status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    
    # Evaluation results
    total_score = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        null=True, 
        blank=True
    )
    percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Overall feedback
    feedback_summary = models.TextField(blank=True, null=True)
    strengths = models.JSONField(default=list, blank=True)
    areas_for_improvement = models.JSONField(default=list, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    evaluated_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ["-created_at"]
        db_table = "evaluation_answer_scripts"
    
    def __str__(self):
        student = self.student_name or self.student_id or "Anonymous"
        rubric_title = self.rubric_set.title if self.rubric_set else "No Rubric Set"
        return f"Script by {student} - {rubric_title}"


class ScriptPage(models.Model):
    """
    Individual page image from an answer script.
    Maximum 10 pages per script.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    script = models.ForeignKey(
        AnswerScript, 
        on_delete=models.CASCADE, 
        related_name="pages"
    )
    page_number = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    image = models.ImageField(upload_to="script_pages/%Y/%m/%d/")
    
    # OCR extracted text (populated after processing)
    extracted_text = models.TextField(blank=True, null=True)
    extracted_equations = models.JSONField(default=list, blank=True)
    
    # Processing metadata
    ocr_confidence = models.FloatField(null=True, blank=True)
    processing_notes = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["page_number"]
        unique_together = ["script", "page_number"]
        db_table = "evaluation_script_pages"
    
    def __str__(self):
        return f"Page {self.page_number} of {self.script}"


class QuestionEvaluation(models.Model):
    """
    Evaluation result for a single question in an answer script.
    Links to QuestionRubric from rubrics module.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    script = models.ForeignKey(
        AnswerScript, 
        on_delete=models.CASCADE, 
        related_name="question_evaluations"
    )
    
    # Reference to QuestionRubric from rubrics module
    question_rubric = models.ForeignKey(
        'rubrics.QuestionRubric',
        on_delete=models.CASCADE,
        related_name="evaluations",
        help_text="The question rubric being evaluated against",
        null=True,  # Nullable - validation handled by serializer
        blank=True
    )
    
    # Marks breakdown
    method_marks_awarded = models.DecimalField(
        max_digits=4, 
        decimal_places=2, 
        default=0
    )
    calculation_marks_awarded = models.DecimalField(
        max_digits=4, 
        decimal_places=2, 
        default=0
    )
    answer_marks_awarded = models.DecimalField(
        max_digits=4, 
        decimal_places=2, 
        default=0
    )
    
    # Total marks for this question
    total_marks_awarded = models.DecimalField(
        max_digits=4, 
        decimal_places=2, 
        default=0
    )
    
    # Extracted student answer
    student_answer_text = models.TextField(blank=True, null=True)
    
    # Detailed feedback
    method_feedback = models.TextField(blank=True, null=True)
    calculation_feedback = models.TextField(blank=True, null=True)
    answer_feedback = models.TextField(blank=True, null=True)
    
    # Key points analysis
    key_points_found = models.JSONField(default=list, blank=True)
    key_points_missing = models.JSONField(default=list, blank=True)
    
    # Mistakes identified
    mistakes_identified = models.JSONField(default=list, blank=True)
    
    # Overall feedback for this question
    overall_feedback = models.TextField(blank=True, null=True)
    
    # Confidence score of the AI evaluation
    confidence_score = models.FloatField(
        null=True, 
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)]
    )
    
    # Flag for manual review if needed
    needs_manual_review = models.BooleanField(default=False)
    review_reason = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ["script", "question_rubric"]
        ordering = ["question_rubric__question_number"]
        db_table = "evaluation_question_evaluations"
    
    def __str__(self):
        return f"Evaluation of Q{self.question_rubric.question_number} for {self.script}"
    
    def save(self, *args, **kwargs):
        # Auto-calculate total marks
        self.total_marks_awarded = (
            self.method_marks_awarded + 
            self.calculation_marks_awarded + 
            self.answer_marks_awarded
        )
        super().save(*args, **kwargs)
