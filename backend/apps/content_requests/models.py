"""
Database Models for Content Requests Module

This module defines the persistence layer for the AI-Assisted Content Request System.
It maps domain models to database tables using Django ORM.

The model is designed to be extensible for future phases (e.g., user associations,
analytics, versioning) without requiring schema migrations.
"""
import uuid
from django.db import models
from django.core.validators import MinLengthValidator, MaxLengthValidator, MinValueValidator, MaxValueValidator
from django.utils.translation import gettext_lazy as _

from .domain.enums import ContentType, Style, OutputFormat, Difficulty, RequestStatus


class ContentRequestModel(models.Model):
    """
    ORM model for persisting ContentRequest domain entities.
    
    This is a thin persistence layer that stores domain model data.
    Business logic should NOT live here - it belongs in domain models and services.
    
    The model uses domain enums for consistency across the system.
    All status transitions must follow domain rules enforced in the service layer.
    
    Extension points:
    - user_id field can be added when authentication is implemented
    - metadata JSON field can store additional context for future features
    - generated_content_url can link to stored artifacts
    
    Indexing strategy:
    - Primary key (id) is UUID for distributed systems compatibility
    - status indexed for efficient filtering of pending/processing requests
    - created_at indexed for time-based queries
    """
    
    # Primary key - UUID for distributed system friendliness
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_("Unique identifier for the request")
    )
    
    # Required fields
    topic = models.CharField(
        max_length=500,
        validators=[MinLengthValidator(1)],
        help_text=_("Subject matter for content generation")
    )
    
    content_type = models.CharField(
        max_length=50,
        choices=ContentType.choices(),
        help_text=_("Type of content to generate")
    )
    
    style = models.CharField(
        max_length=50,
        choices=Style.choices(),
        help_text=_("Generation style preference")
    )
    
    output_format = models.CharField(
        max_length=50,
        choices=OutputFormat.choices(),
        help_text=_("Desired output format")
    )
    
    # Optional fields
    difficulty = models.CharField(
        max_length=50,
        choices=Difficulty.choices(),
        null=True,
        blank=True,
        help_text=_("Optional difficulty level")
    )
    
    notes = models.TextField(
        max_length=2000,
        null=True,
        blank=True,
        help_text=_("Optional additional instructions or context")
    )
    
    # System-managed fields
    status = models.CharField(
        max_length=50,
        choices=RequestStatus.choices(),
        default=RequestStatus.PENDING.value,
        db_index=True,
        help_text=_("Current lifecycle status (system-managed)")
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text=_("Timestamp when request was created")
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text=_("Timestamp when request was last updated")
    )
    
    # User ownership
    created_by = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_requests',
        help_text=_('User who created this request')
    )
    
    # Role that created this request (enables role-specific features)
    role = models.CharField(
        max_length=10,
        choices=[('student', 'Student'), ('teacher', 'Teacher')],
        default='student',
        help_text=_('Role of the user who created this request')
    )
    
    # Academic subject (separate from topic — e.g. "Mathematics" vs "Quadratic Equations")
    subject = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text=_('Academic subject for this content')
    )
    
    # Target audience (for teachers)
    target_class = models.ForeignKey(
        'students.Class',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text=_('Target class for this content')
    )
    
    target_section = models.ForeignKey(
        'students.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text=_('Target section for this content')
    )
    
    # Regeneration lineage
    regenerated_from = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='regenerations',
        help_text=_('Original request this was regenerated from')
    )
    
    # Failure reason (set by background task when processing fails)
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text=_('Human-readable error message when request fails')
    )
    
    class Meta:
        db_table = 'content_requests'
        verbose_name = _('Content Request')
        verbose_name_plural = _('Content Requests')
        ordering = ['-created_at']
        indexes = [
            # Efficient querying for pending requests
            models.Index(fields=['status', 'created_at'], name='cr_status_created_idx'),
            # Time-based queries
            models.Index(fields=['-created_at'], name='cr_created_idx'),
        ]
    
    def __str__(self):
        return f"ContentRequest({self.id}): {self.topic[:50]} [{self.status}]"
    
    def __repr__(self):
        return (
            f"<ContentRequestModel id={self.id} status={self.status} "
            f"topic='{self.topic[:30]}...'>"
        )


class GeneratedContentModel(models.Model):
    """
    ORM model for storing AI-generated content.
    
    This model stores the actual content generated by AI providers in response
    to content requests. Each request can have one or more generated content items
    (for versioning or regeneration scenarios).
    
    The content is stored as text, and formatting is applied on retrieval based
    on the output_format field.
    
    Extension points:
    - version field can be added for content versioning
    - quality_score field can store AI confidence or user ratings
    - file_url can point to cloud storage for large files
    """
    
    # Primary key - UUID for distributed system friendliness
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_("Unique identifier for generated content")
    )
    
    # Foreign key to content request
    request = models.ForeignKey(
        ContentRequestModel,
        on_delete=models.CASCADE,
        related_name='generated_contents',
        help_text=_("The content request this content fulfills")
    )
    
    # Generated content
    content_text = models.TextField(
        help_text=_("The raw generated content from AI")
    )
    
    # Output format (stored for retrieval purposes)
    output_format = models.CharField(
        max_length=50,
        choices=OutputFormat.choices(),
        help_text=_("Format of the generated content")
    )
    
    # Metadata about generation
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text=_(
            "Metadata about content generation: "
            "AI model, tokens used, generation params, etc."
        )
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text=_("Timestamp when content was generated")
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text=_("Timestamp when content was last updated")
    )
    
    class Meta:
        db_table = 'generated_content'
        verbose_name = _('Generated Content')
        verbose_name_plural = _('Generated Contents')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['request', 'created_at'], name='gc_request_created_idx'),
        ]
    
    def __str__(self):
        return f"GeneratedContent({self.id}): Request {self.request_id}"
    
    def __repr__(self):
        return (
            f"<GeneratedContentModel id={self.id} request_id={self.request_id} "
            f"format={self.output_format}>"
        )


# ============================================================================
# Phase 3: Feedback Models
# ============================================================================

class DifficultyRating(models.TextChoices):
    """Perceived difficulty level of generated content"""
    TOO_EASY = 'TOO_EASY', 'Too Easy'
    APPROPRIATE = 'APPROPRIATE', 'Appropriate'
    TOO_HARD = 'TOO_HARD', 'Too Hard'


class FeedbackModel(models.Model):
    """
    Structured feedback for generated content (Phase 3).
    
    Captures user feedback on AI-generated content quality.
    This data will be consumed by analytics modules in future phases.
    
    Design decisions:
    - One feedback per generated content (enforced at DB level)
    - All fields except comment are required for data quality
    - Cascade delete when content is deleted
    Future extensions:
    - Add feedback_version for schema evolution
    - Add moderation_status for quality control
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    generated_content = models.OneToOneField(
        'GeneratedContentModel',
        on_delete=models.CASCADE,
        related_name='feedback',
        help_text='The generated content being rated'
    )
    
    usefulness_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='How useful was this content? (1-5)'
    )
    
    difficulty_rating = models.CharField(
        max_length=20,
        choices=DifficultyRating.choices,
        help_text='Was the difficulty level appropriate?'
    )
    
    correctness_flag = models.BooleanField(
        help_text='Was the content factually correct?'
    )
    
    missing_topics = models.TextField(
        blank=True,
        null=True,
        help_text='Topics that should have been included (optional)'
    )
    
    freeform_comment = models.TextField(
        blank=True,
        null=True,
        help_text='Additional feedback or suggestions (optional)'
    )
    
    created_by = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='content_feedback',
        help_text='User who submitted this feedback'
    )
    
    submitted_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When feedback was submitted'
    )
    
    class Meta:
        db_table = 'feedback'
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['generated_content']),
            models.Index(fields=['submitted_at']),
            models.Index(fields=['usefulness_rating']),
        ]
        # Enforce one feedback per content at database level
        constraints = [
            models.UniqueConstraint(
                fields=['generated_content'],
                name='unique_feedback_per_content'
            )
        ]
    
    def __str__(self):
        return f"Feedback for {self.generated_content_id} - {self.usefulness_rating}/5"
    
    @property
    def is_positive(self):
        """Helper to determine if feedback is generally positive"""
        return self.usefulness_rating >= 4 and self.correctness_flag


# ============================================================================
# Phase 4: Learning Context Models
# ============================================================================

class TargetGoal(models.TextChoices):
    """Learning goal for content generation"""
    REVISION = 'REVISION', 'Revision/Review'
    CONCEPT_CLARITY = 'CONCEPT_CLARITY', 'Concept Clarity'
    EXAM_PREP = 'EXAM_PREP', 'Exam Preparation'
    PRACTICE = 'PRACTICE', 'Practice/Application'


class PreferredDepth(models.TextChoices):
    """Depth of explanation preference"""
    SHALLOW = 'SHALLOW', 'Quick Overview'
    NORMAL = 'NORMAL', 'Standard Detail'
    DEEP = 'DEEP', 'In-Depth Explanation'


class TimeConstraint(models.TextChoices):
    """Time availability for studying"""
    QUICK = 'QUICK', 'Quick (10-15 min)'
    NORMAL = 'NORMAL', 'Normal (30-45 min)'
    EXTENSIVE = 'EXTENSIVE', 'Extensive (60+ min)'


class LearningContextModel(models.Model):
    """
    Manual learning context for personalized content generation (Phase 4).
    
    IMPORTANT: This is USER-PROVIDED data, not inferred or automated.
    This phase captures manual inputs to prepare for Module 3 (analytics).
    
    Purpose:
    - Enable context-aware AI generation
    - Store structured personalization data
    - Prepare for future analytics integration
    
    Design decisions:
    - One context per content request (optional, one-to-one)
    - All fields are optional (graceful degradation)
    - Manual inputs only (no inference)
    - No feedback integration (separate concern)
    
    Future extensions (Module 3):
    - Auto-populate from performance history
    - Infer weaknesses from past errors
    - Suggest optimal depth/time settings
    - Replace manual with analytics-driven context
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    content_request = models.OneToOneField(
        'ContentRequestModel',
        on_delete=models.CASCADE,
        related_name='learning_context',
        help_text='The content request this context applies to'
    )
    
    target_goal = models.CharField(
        max_length=20,
        choices=TargetGoal.choices,
        blank=True,
        null=True,
        help_text='Primary learning goal for this content'
    )
    
    self_reported_weaknesses = models.JSONField(
        default=list,
        blank=True,
        help_text='Topics/concepts the user wants to focus on (manual input)'
    )
    
    preferred_depth = models.CharField(
        max_length=10,
        choices=PreferredDepth.choices,
        default=PreferredDepth.NORMAL,
        help_text='How detailed should explanations be?'
    )
    
    time_constraint = models.CharField(
        max_length=10,
        choices=TimeConstraint.choices,
        default=TimeConstraint.NORMAL,
        help_text='Available time for studying this content'
    )
    
    notes = models.TextField(
        blank=True,
        null=True,
        max_length=1000,
        help_text='Additional context or requirements (optional)'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When context was provided'
    )
    
    created_by = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='learning_contexts',
        help_text='User who provided this context'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='Last update to context'
    )
    
    class Meta:
        db_table = 'learning_context'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['content_request']),
            models.Index(fields=['target_goal']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['content_request'],
                name='unique_context_per_request'
            )
        ]
    
    def __str__(self):
        goal = self.target_goal or 'No goal'
        return f"Context for {self.content_request_id} - {goal}"
    
    def has_weaknesses(self):
        """Check if user provided any specific weaknesses"""
        return bool(self.self_reported_weaknesses)
    
    def get_weaknesses_list(self):
        """Return weaknesses as a clean list (handles both list and None)"""
        if not self.self_reported_weaknesses:
            return []
        return self.self_reported_weaknesses


# ============================================================================
# Phase 5: Study Plan Models (Manual Mode Only)
# ============================================================================
# These models support manual study plan creation with hooks for future
# Module 3 (Smart Analytics Dashboard) integration.
#
# IMPORTANT: Phase 5 is MANUAL MODE ONLY
# - No analytics logic implemented
# - No automatic weakness detection
# - Fields marked [MODULE 3 HOOK] are placeholders for future integration


class StudyPlanMode(models.TextChoices):
    """
    Study plan creation mode.
    
    MANUAL: User creates and manages all topics manually (Phase 5)
    AI: Module 3 automatically detects weaknesses and suggests topics (Future)
    """
    MANUAL = 'manual', _('Manual')
    AI = 'ai', _('AI-Driven')  # [MODULE 3 HOOK] Will be enabled when Module 3 is active


class StudyPlanItemSource(models.TextChoices):
    """
    Tracks the origin of a study plan item for analytics attribution.
    
    MANUAL: User manually added this topic
    ANALYTICS: Module 3 automatically detected and added (Future)
    MIXED: Module 3 suggested, but user modified priority/date (Future)
    """
    MANUAL = 'manual', _('Manually Added')
    ANALYTICS = 'analytics', _('Auto-detected by Analytics')  # [MODULE 3 HOOK]
    MIXED = 'mixed', _('Analytics Suggested, User Modified')  # [MODULE 3 HOOK]


class StudyPlanItemStatus(models.TextChoices):
    """Status of a study plan item."""
    PENDING = 'pending', _('Pending')
    IN_PROGRESS = 'in_progress', _('In Progress')
    COMPLETED = 'completed', _('Completed')


class StudyPlan(models.Model):
    """
    A study plan containing multiple topics/items to study.
    
    Phase 5: Manual mode only - users create and manage plans
    Future: Module 3 will enable AI mode with automatic topic detection
    
    Design Decisions:
    - user_id is nullable now but will be required after auth integration
    - mode defaults to 'manual' for Phase 5
    - auto_detect_weakness defaults to False (no analytics yet)
    - analytics_snapshot_id is a placeholder for future Module 3 linking
    
    [MODULE 3 INTEGRATION NOTES]
    When Module 3 is integrated:
    1. Set mode='ai' to enable automatic topic detection
    2. Set auto_detect_weakness=True to inject weak topics automatically
    3. Link analytics_snapshot_id to the analytics state that generated recommendations
    4. Module 3 will populate study plan items with source='analytics'
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_("Unique identifier for the study plan")
    )
    
    # User ownership (FK to CustomUser)
    user = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='study_plans',
        db_index=True,
        help_text=_("User who owns this study plan")
    )
    
    name = models.CharField(
        max_length=200,
        help_text=_("Name of the study plan")
    )
    
    mode = models.CharField(
        max_length=20,
        choices=StudyPlanMode.choices,
        default=StudyPlanMode.MANUAL,
        help_text=_("Plan creation mode: manual or AI-driven")
    )
    
    # [MODULE 3 HOOK]
    # When True, Module 3 will automatically inject topics based on weakness detection
    auto_detect_weakness = models.BooleanField(
        default=False,
        help_text=_("Enable automatic weak topic detection (requires Module 3)")
    )
    
    # [MODULE 3 HOOK]
    # Links to the analytics snapshot that generated this plan's recommendations
    analytics_snapshot_id = models.UUIDField(
        null=True,
        blank=True,
        help_text=_("Reference to Module 3 analytics snapshot (future)")
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'study_plans'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['mode']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_mode_display()})"


class StudyPlanItem(models.Model):
    """
    Individual topic/item within a study plan.
    
    Phase 5: All items have source='manual' (user-created)
    Future: Module 3 will add items with source='analytics'
    
    Design Decisions:
    - linked_request_id allows associating content generation with study items
    - source tracks whether user or analytics created this item
    - confidence_score is reserved for Module 3's weakness detection confidence
    - scheduled_date is manual now, will be auto-calculated by Module 3 later
    
    [MODULE 3 INTEGRATION NOTES]
    When Module 3 detects a weak topic:
    1. Create item with source='analytics'
    2. Set confidence_score based on weakness detection algorithm
    3. Calculate priority and scheduled_date based on:
       - Topic importance
       - Current mastery level
       - Prerequisite dependencies
       - User's study schedule
    4. Link to analytics data for explanation/justification
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_("Unique identifier for the study plan item")
    )
    
    study_plan = models.ForeignKey(
        StudyPlan,
        on_delete=models.CASCADE,
        related_name='items',
        help_text=_("Study plan this item belongs to")
    )
    
    topic = models.CharField(
        max_length=500,
        help_text=_("Topic or concept to study")
    )
    
    priority = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=3,
        help_text=_("Priority level (1=highest, 5=lowest)")
    )
    
    scheduled_date = models.DateField(
        null=True,
        blank=True,
        help_text=_("Target date to study this topic")
    )
    
    status = models.CharField(
        max_length=20,
        choices=StudyPlanItemStatus.choices,
        default=StudyPlanItemStatus.PENDING,
        help_text=_("Current status of this item")
    )
    
    # Links to content generation system
    linked_request = models.ForeignKey(
        ContentRequestModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='study_plan_items',
        help_text=_("Optional link to generated content request")
    )
    
    source = models.CharField(
        max_length=20,
        choices=StudyPlanItemSource.choices,
        default=StudyPlanItemSource.MANUAL,
        help_text=_("How this item was added: manual, analytics, or mixed")
    )
    
    # [MODULE 3 HOOK]
    # Confidence score from weakness detection algorithm (0.0 to 1.0)
    # Higher score = higher confidence that this is a weak topic
    confidence_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text=_("Analytics confidence score for weakness detection (0.0-1.0, requires Module 3)")
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'study_plan_items'
        ordering = ['priority', 'scheduled_date', '-created_at']
        indexes = [
            models.Index(fields=['study_plan', 'status']),
            models.Index(fields=['study_plan', 'priority']),
            models.Index(fields=['source']),
        ]
    
    def __str__(self):
        return f"{self.topic} - {self.get_status_display()}"


# Future Phase models will be added here
# Examples:
# - ContentVersionModel: tracks content revisions
# - PerformanceHistoryModel: for Module 3 analytics

