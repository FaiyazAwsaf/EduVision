"""
Learning Context Repository - Phase 4

Persistence layer for manual learning context data.
This handles user-provided personalization inputs.

IMPORTANT: This is NOT automated or inferred data.
All context is explicitly provided by users.

Extension Points (Module 3):
- Auto-populate from performance analytics
- Infer weaknesses from error patterns
- Suggest optimal settings based on history
"""
import logging
from typing import Optional, List
from django.db import IntegrityError
from ..models import LearningContextModel

logger = logging.getLogger(__name__)


class LearningContextRepository:
    """
    Repository for learning context persistence.
    
    Handles CRUD operations for user-provided learning context.
    All operations are manual - no inference or automation.
    """
    
    @staticmethod
    def create_or_update_context(
        content_request_id: str,
        target_goal: Optional[str] = None,
        self_reported_weaknesses: Optional[List[str]] = None,
        preferred_depth: Optional[str] = None,
        time_constraint: Optional[str] = None,
        notes: Optional[str] = None
    ) -> LearningContextModel:
        """
        Create or update learning context for a content request.
        
        Uses get_or_create pattern to handle both new and existing contexts.
        All fields are optional - graceful degradation if minimal context provided.
        
        Args:
            content_request_id: UUID of the content request
            target_goal: Learning goal (REVISION, CONCEPT_CLARITY, etc.)
            self_reported_weaknesses: List of topic strings user wants to focus on
            preferred_depth: Explanation depth (SHALLOW, NORMAL, DEEP)
            time_constraint: Available study time (QUICK, NORMAL, EXTENSIVE)
            notes: Additional free-text context
            
        Returns:
            Created or updated LearningContextModel instance
            
        Raises:
            ValueError: If content request doesn't exist
            
        Extension Points:
        - Add user_id when auth is implemented
        - Add analytics-driven field population
        - Add validation against performance history
        """
        from ..models import ContentRequestModel
        
        try:
            # Verify request exists
            request = ContentRequestModel.objects.get(id=content_request_id)
            
            # Get or create context
            context, created = LearningContextModel.objects.get_or_create(
                content_request=request,
                defaults={
                    'target_goal': target_goal,
                    'self_reported_weaknesses': self_reported_weaknesses or [],
                    'preferred_depth': preferred_depth or 'NORMAL',
                    'time_constraint': time_constraint or 'NORMAL',
                    'notes': notes,
                }
            )
            
            # Update if already exists
            if not created:
                if target_goal is not None:
                    context.target_goal = target_goal
                if self_reported_weaknesses is not None:
                    context.self_reported_weaknesses = self_reported_weaknesses
                if preferred_depth is not None:
                    context.preferred_depth = preferred_depth
                if time_constraint is not None:
                    context.time_constraint = time_constraint
                if notes is not None:
                    context.notes = notes
                context.save()
            
            action = "created" if created else "updated"
            logger.info(
                f"Learning context {action} for request {content_request_id}: "
                f"goal={target_goal}, depth={preferred_depth}, "
                f"weaknesses={len(self_reported_weaknesses or [])}"
            )
            
            return context
            
        except ContentRequestModel.DoesNotExist:
            logger.error(f"Cannot create context - request {content_request_id} not found")
            raise ValueError(f"Content request {content_request_id} does not exist")
    
    @staticmethod
    def get_by_request_id(content_request_id: str) -> Optional[LearningContextModel]:
        """
        Retrieve learning context for a content request.
        
        Args:
            content_request_id: UUID of the content request
            
        Returns:
            LearningContextModel instance or None if not found
        """
        try:
            return LearningContextModel.objects.select_related('content_request').get(
                content_request_id=content_request_id
            )
        except LearningContextModel.DoesNotExist:
            return None
    
    @staticmethod
    def exists_for_request(content_request_id: str) -> bool:
        """
        Check if learning context exists for a content request.
        
        Args:
            content_request_id: UUID of the content request
            
        Returns:
            True if context exists, False otherwise
        """
        return LearningContextModel.objects.filter(
            content_request_id=content_request_id
        ).exists()
    
    @staticmethod
    def delete_context(content_request_id: str) -> bool:
        """
        Delete learning context for a content request.
        
        Args:
            content_request_id: UUID of the content request
            
        Returns:
            True if context was deleted, False if didn't exist
        """
        try:
            context = LearningContextModel.objects.get(content_request_id=content_request_id)
            context.delete()
            logger.info(f"Learning context deleted for request {content_request_id}")
            return True
        except LearningContextModel.DoesNotExist:
            return False
    
    @staticmethod
    def get_all_contexts():
        """
        Retrieve all learning contexts (for future analytics).
        
        Extension Point: This will be used by Module 3 for:
        - Analyzing common weakness patterns
        - Understanding learning goal distributions
        - Optimizing default depth/time settings
        """
        return LearningContextModel.objects.select_related('content_request').all()
