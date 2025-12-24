import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MinValueValidator, MaxValueValidator


class QuestionPaper(models.Model):
    """
    Represents a question paper with multiple questions.
    Teachers upload this first before evaluating scripts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    subject = models.CharField(max_length=100, default="Mathematics")
    class_level = models.CharField(
        max_length=20,
        choices=[
            ("9", "Class 9"),
            ("10", "Class 10"),
            ("11", "Class 11"),
            ("12", "Class 12"),
        ],
        default="9"
    )
    total_marks = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ["-created_at"]
    
    def __str__(self):
        return f"{self.title} - {self.subject} (Class {self.class_level})"
    
    def calculate_total_marks(self):
        """Calculate total marks from all questions."""
        return sum(q.max_marks for q in self.questions.all())


class Question(models.Model):
    """
    Individual question within a question paper.
    """
    QUESTION_TYPES = [
        ("descriptive", "Descriptive Answer"),
        ("short", "Short Answer"),
        ("mathematical", "Mathematical Problem"),
        ("proof", "Mathematical Proof"),
        ("mcq", "Multiple Choice"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question_paper = models.ForeignKey(
        QuestionPaper, 
        on_delete=models.CASCADE, 
        related_name="questions"
    )
    question_number = models.CharField(max_length=20)  # e.g., "1", "2a", "2b"
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES, default="mathematical")
    max_marks = models.PositiveIntegerField(default=5)
    
    # Optional: Store the correct answer/solution for reference
    model_answer = models.TextField(blank=True, null=True, help_text="Model answer or solution")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["question_number"]
        unique_together = ["question_paper", "question_number"]
    
    def __str__(self):
        return f"Q{self.question_number}: {self.question_text[:50]}..."


class Rubric(models.Model):
    """
    Grading rubric for a specific question.
    Defines how marks are allocated for different aspects.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.OneToOneField(
        Question, 
        on_delete=models.CASCADE, 
        related_name="rubric"
    )
    
    # Mark allocation breakdown
    method_marks = models.PositiveIntegerField(
        default=2,
        help_text="Marks for using correct method/approach"
    )
    calculation_marks = models.PositiveIntegerField(
        default=2,
        help_text="Marks for correct calculations/steps"
    )
    answer_marks = models.PositiveIntegerField(
        default=1,
        help_text="Marks for correct final answer"
    )
    
    # Key points that must be present (stored as JSON array)
    key_points = models.JSONField(
        default=list,
        blank=True,
        help_text="List of key points/steps that should be present in the answer"
    )
    
    # Common mistakes to look for
    common_mistakes = models.JSONField(
        default=list,
        blank=True,
        help_text="Common mistakes and their mark deductions"
    )
    
    # Additional grading notes
    grading_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Additional instructions for grading"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Rubric for Q{self.question.question_number}"
    
    @property
    def total_marks(self):
        return self.method_marks + self.calculation_marks + self.answer_marks


class AnswerScript(models.Model):
    """
    Represents a student's answer script (collection of page images).
    """
    STATUS_CHOICES = [
        ("pending", "Pending Evaluation"),
        ("processing", "Processing"),
        ("evaluated", "Evaluated"),
        ("error", "Error"),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question_paper = models.ForeignKey(
        QuestionPaper, 
        on_delete=models.CASCADE, 
        related_name="scripts"
    )
    
    # Student identification (optional, can be anonymous)
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
    
    def __str__(self):
        student = self.student_name or self.student_id or "Anonymous"
        return f"Script by {student} - {self.question_paper.title}"


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
    
    def __str__(self):
        return f"Page {self.page_number} of {self.script}"


class QuestionEvaluation(models.Model):
    """
    Evaluation result for a single question in an answer script.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    script = models.ForeignKey(
        AnswerScript, 
        on_delete=models.CASCADE, 
        related_name="question_evaluations"
    )
    question = models.ForeignKey(
        Question, 
        on_delete=models.CASCADE,
        related_name="evaluations"
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
        unique_together = ["script", "question"]
        ordering = ["question__question_number"]
    
    def __str__(self):
        return f"Evaluation of Q{self.question.question_number} for {self.script}"
    
    def save(self, *args, **kwargs):
        # Auto-calculate total marks
        self.total_marks_awarded = (
            self.method_marks_awarded + 
            self.calculation_marks_awarded + 
            self.answer_marks_awarded
        )
        super().save(*args, **kwargs)
