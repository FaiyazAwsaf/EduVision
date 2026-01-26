import uuid
from django.db import models
from django.core.validators import MinValueValidator


class Rubric(models.Model):
    """
    Main rubric model for storing evaluation rubrics.
    Optimized for PostgreSQL with JSONB fields and proper indexing.
    """
    
    # Rubric state choices
    STATE_DRAFT = 'draft'
    STATE_PUBLISHED = 'published'
    STATE_ARCHIVED = 'archived'
    
    STATE_CHOICES = [
        (STATE_DRAFT, 'Draft'),
        (STATE_PUBLISHED, 'Published'),
        (STATE_ARCHIVED, 'Archived'),
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the rubric"
    )
    version = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Current version number of the rubric"
    )
    state = models.CharField(
        max_length=20,
        choices=STATE_CHOICES,
        default=STATE_DRAFT,
        help_text="Current state of the rubric"
    )
    
    # Metadata fields
    title = models.TextField(
        help_text="Title of the rubric"
    )
    subject = models.TextField(
        db_index=True,
        help_text="Subject area of the rubric"
    )
    
    # Question fields
    question_text = models.TextField(
        help_text="The question text"
    )
    reference_answer = models.TextField(
        help_text="Model/reference answer for the question"
    )
    total_marks = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Total marks for the question"
    )
    
    # Evaluation rules stored as JSONB
    evaluation_rules = models.JSONField(
        default=list,
        help_text="List of evaluation rules in JSON format"
    )
    
    # Audit fields
    created_by = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID of the user who created this rubric"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the rubric was created"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the rubric was last updated"
    )
    
    class Meta:
        db_table = 'rubrics'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_by', 'state']),
            models.Index(fields=['subject', 'state']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name = 'Rubric'
        verbose_name_plural = 'Rubrics'
    
    def __str__(self):
        return f"{self.title} (v{self.version}) - {self.state}"
    
    def save(self, *args, **kwargs):
        """Override save to create version snapshot on updates."""
        is_update = self.pk is not None and Rubric.objects.filter(pk=self.pk).exists()
        
        if is_update:
            # Get the old version before saving
            old_rubric = Rubric.objects.get(pk=self.pk)
            
            # Check if there are actual changes that warrant a version bump
            if self._has_significant_changes(old_rubric):
                self.version += 1
        
        super().save(*args, **kwargs)
        
        # Create version snapshot after save
        if is_update:
            self._create_version_snapshot()
    
    def _has_significant_changes(self, old_rubric):
        """Check if there are significant changes that warrant a version bump."""
        # Compare significant fields including state changes (draft->published)
        return (
            self.state != old_rubric.state or
            self.question_text != old_rubric.question_text or
            self.reference_answer != old_rubric.reference_answer or
            self.total_marks != old_rubric.total_marks or
            self.evaluation_rules != old_rubric.evaluation_rules
        )
    
    def _create_version_snapshot(self):
        """Create a snapshot of the current rubric state."""
        snapshot_data = {
            'version': self.version,
            'state': self.state,
            'title': self.title,
            'subject': self.subject,
            'question_text': self.question_text,
            'reference_answer': self.reference_answer,
            'total_marks': str(self.total_marks),
            'evaluation_rules': self.evaluation_rules,
            'created_by': str(self.created_by),
            'updated_at': self.updated_at.isoformat(),
        }
        
        RubricVersion.objects.create(
            rubric=self,
            version_number=self.version,
            snapshot=snapshot_data
        )


class RubricVersion(models.Model):
    """
    Version history model for tracking changes to rubrics.
    Each significant change to a rubric creates a new version snapshot.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the version"
    )
    rubric = models.ForeignKey(
        Rubric,
        on_delete=models.CASCADE,
        related_name='versions',
        help_text="Reference to the parent rubric"
    )
    version_number = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Version number of this snapshot"
    )
    snapshot = models.JSONField(
        help_text="Complete snapshot of the rubric at this version"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when this version was created"
    )
    
    class Meta:
        db_table = 'rubric_versions'
        ordering = ['-version_number']
        indexes = [
            models.Index(fields=['rubric', '-version_number']),
            models.Index(fields=['-created_at']),
        ]
        unique_together = [['rubric', 'version_number']]
        verbose_name = 'Rubric Version'
        verbose_name_plural = 'Rubric Versions'
    
    def __str__(self):
        return f"{self.rubric.title} - Version {self.version_number}"


class RubricSet(models.Model):
    """
    RubricSet represents a complete assessment with multiple questions.
    This is the parent model that contains versioning and state management.
    """
    
    # State choices (same as original Rubric)
    STATE_DRAFT = 'draft'
    STATE_PUBLISHED = 'published'
    STATE_ARCHIVED = 'archived'
    
    STATE_CHOICES = [
        (STATE_DRAFT, 'Draft'),
        (STATE_PUBLISHED, 'Published'),
        (STATE_ARCHIVED, 'Archived'),
    ]
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the rubric set"
    )
    title = models.TextField(
        help_text="Title of the assessment/rubric set"
    )
    subject = models.TextField(
        db_index=True,
        help_text="Subject area of the assessment"
    )
    total_marks = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Total marks for the entire assessment"
    )
    version = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Current version number of the rubric set"
    )
    state = models.CharField(
        max_length=20,
        choices=STATE_CHOICES,
        default=STATE_DRAFT,
        help_text="Current state of the rubric set"
    )
    
    # Optional metadata stored as JSON
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (duration, instructions, etc.)"
    )
    
    # Audit fields
    created_by = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID of the user who created this rubric set"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the rubric set was created"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the rubric set was last updated"
    )
    
    class Meta:
        db_table = 'rubric_sets'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_by', 'state']),
            models.Index(fields=['subject', 'state']),
            models.Index(fields=['-created_at']),
        ]
        verbose_name = 'Rubric Set'
        verbose_name_plural = 'Rubric Sets'
    
    def __str__(self):
        return f"{self.title} (v{self.version}) - {self.state}"
    
    def save(self, *args, **kwargs):
        """Override save to create version snapshot on updates."""
        is_update = self.pk is not None and RubricSet.objects.filter(pk=self.pk).exists()
        version_changed = False
        
        if is_update:
            old_rubric_set = RubricSet.objects.get(pk=self.pk)
            
            if self._has_significant_changes(old_rubric_set):
                self.version += 1
                version_changed = True
        
        super().save(*args, **kwargs)
        
        # Only create version snapshot if version number changed or it's the initial creation
        if version_changed or not is_update:
            self._create_version_snapshot()
    
    def _has_significant_changes(self, old_rubric_set):
        """Check if there are significant changes that warrant a version bump."""
        return (
            self.state != old_rubric_set.state or
            self.title != old_rubric_set.title or
            self.subject != old_rubric_set.subject or
            self.total_marks != old_rubric_set.total_marks or
            self.metadata != old_rubric_set.metadata
        )
    
    def _create_version_snapshot(self):
        """Create a snapshot of the current rubric set state."""
        # Check if snapshot already exists for this version
        if RubricSetVersion.objects.filter(rubric_set=self, version_number=self.version).exists():
            return
        
        # Get all questions with their rules
        questions_data = []
        for question in self.questions.all().order_by('question_number'):
            questions_data.append({
                'question_number': question.question_number,
                'question_text': question.question_text,
                'max_marks': str(question.max_marks),
                'evaluation_rules': question.evaluation_rules,
            })
        
        snapshot_data = {
            'version': self.version,
            'state': self.state,
            'title': self.title,
            'subject': self.subject,
            'total_marks': str(self.total_marks),
            'metadata': self.metadata,
            'questions': questions_data,
            'created_by': str(self.created_by) if self.created_by else None,
            'updated_at': self.updated_at.isoformat(),
        }
        
        RubricSetVersion.objects.create(
            rubric_set=self,
            version_number=self.version,
            snapshot=snapshot_data
        )


class QuestionRubric(models.Model):
    """
    QuestionRubric represents a single question within a RubricSet.
    Contains question text, marks, and evaluation rules (JSONB).
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the question rubric"
    )
    rubric_set = models.ForeignKey(
        RubricSet,
        on_delete=models.CASCADE,
        related_name='questions',
        help_text="Reference to the parent rubric set"
    )
    question_number = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Question number within the assessment (1, 2, 3, ...)"
    )
    question_text = models.TextField(
        help_text="The question text"
    )
    max_marks = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Maximum marks for this question"
    )
    
    # Evaluation rules stored as JSONB (same format as original Rubric)
    evaluation_rules = models.JSONField(
        default=list,
        help_text="List of evaluation rules in JSON format"
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the question was created"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp when the question was last updated"
    )
    
    class Meta:
        db_table = 'question_rubrics'
        ordering = ['rubric_set', 'question_number']
        indexes = [
            models.Index(fields=['rubric_set', 'question_number']),
        ]
        unique_together = [['rubric_set', 'question_number']]
        verbose_name = 'Question Rubric'
        verbose_name_plural = 'Question Rubrics'
    
    def __str__(self):
        return f"{self.rubric_set.title} - Q{self.question_number}"


class RubricSetVersion(models.Model):
    """
    Version history model for tracking changes to rubric sets.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the version"
    )
    rubric_set = models.ForeignKey(
        RubricSet,
        on_delete=models.CASCADE,
        related_name='versions',
        help_text="Reference to the parent rubric set"
    )
    version_number = models.IntegerField(
        validators=[MinValueValidator(1)],
        help_text="Version number of this snapshot"
    )
    snapshot = models.JSONField(
        help_text="Complete snapshot of the rubric set at this version"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when this version was created"
    )
    
    class Meta:
        db_table = 'rubric_set_versions'
        ordering = ['-version_number']
        indexes = [
            models.Index(fields=['rubric_set', '-version_number']),
            models.Index(fields=['-created_at']),
        ]
        unique_together = [['rubric_set', 'version_number']]
        verbose_name = 'Rubric Set Version'
        verbose_name_plural = 'Rubric Set Versions'
    
    def __str__(self):
        return f"{self.rubric_set.title} - Version {self.version_number}"
