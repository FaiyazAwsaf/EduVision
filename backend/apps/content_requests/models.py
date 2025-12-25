"""
Database Models for Content Requests Module

This module defines the persistence layer for the AI-Assisted Content Request System.
It maps domain models to database tables using Django ORM.

The model is designed to be extensible for future phases (e.g., user associations,
analytics, versioning) without requiring schema migrations.
"""
import uuid
from django.db import models
from django.core.validators import MinLengthValidator, MaxLengthValidator
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
    
    # Extension point for future phases
    # When authentication is implemented, add:
    # user = models.ForeignKey('user.User', on_delete=models.CASCADE, null=True, blank=True)
    
    # When content generation is implemented, add:
    # generated_content_url = models.URLField(null=True, blank=True)
    # error_message = models.TextField(null=True, blank=True)
    
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


# Phase 2+ models will be added here when content generation is implemented
# Examples:
# - GeneratedContentModel: stores AI-generated content
# - UserFeedbackModel: stores user feedback on content quality
# - ContentVersionModel: tracks content revisions
