"""
Feedback Repository - Phase 3

Persistence layer for feedback data.
Follows repository pattern used in content_requests module.

Extension Points:
- Add user-scoped queries when auth is implemented
- Add batch operations for analytics ingestion
- Add soft-delete support for data retention policies
"""
import logging
from typing import Optional
from django.db import IntegrityError
from ..models import FeedbackModel

logger = logging.getLogger(__name__)


class FeedbackRepository:
    """
    Repository for feedback persistence operations.
    
    Encapsulates all database access for feedback data.
    Business logic should NOT live here.
    """
    
    @staticmethod
    def create_feedback(
        generated_content_id: str,
        usefulness_rating: int,
        difficulty_rating: str,
        correctness_flag: bool,
        missing_topics: Optional[str] = None,
        freeform_comment: Optional[str] = None
    ) -> FeedbackModel:
        """
        Create new feedback for generated content.
        
        Args:
            generated_content_id: UUID of the generated content
            usefulness_rating: Rating 1-5
            difficulty_rating: TOO_EASY, APPROPRIATE, or TOO_HARD
            correctness_flag: Whether content was correct
            missing_topics: Optional text about missing topics
            freeform_comment: Optional additional comments
            
        Returns:
            Created FeedbackModel instance
            
        Raises:
            IntegrityError: If feedback already exists for this content
            ValueError: If generated content doesn't exist
            
        Extension Points:
        - Add user_id parameter when auth is added
        - Add validation hooks for custom business rules
        """
        from ..models import GeneratedContentModel
        
        try:
            # Verify content exists
            content = GeneratedContentModel.objects.get(id=generated_content_id)
            
            feedback = FeedbackModel.objects.create(
                generated_content=content,
                usefulness_rating=usefulness_rating,
                difficulty_rating=difficulty_rating,
                correctness_flag=correctness_flag,
                missing_topics=missing_topics,
                freeform_comment=freeform_comment
            )
            
            logger.info(
                f"Feedback created for content {generated_content_id}: "
                f"usefulness={usefulness_rating}/5, "
                f"difficulty={difficulty_rating}, "
                f"correct={correctness_flag}"
            )
            
            return feedback
            
        except GeneratedContentModel.DoesNotExist:
            logger.error(f"Cannot create feedback - content {generated_content_id} not found")
            raise ValueError(f"Generated content {generated_content_id} does not exist")
            
        except IntegrityError as e:
            logger.warning(f"Duplicate feedback submission for content {generated_content_id}")
            raise IntegrityError("Feedback already exists for this content") from e
    
    @staticmethod
    def get_feedback_by_content_id(generated_content_id: str) -> Optional[FeedbackModel]:
        """
        Retrieve feedback for a specific generated content.
        
        Args:
            generated_content_id: UUID of the generated content
            
        Returns:
            FeedbackModel instance or None if not found
        """
        try:
            return FeedbackModel.objects.select_related('generated_content').get(
                generated_content_id=generated_content_id
            )
        except FeedbackModel.DoesNotExist:
            return None
    
    @staticmethod
    def exists_for_content(generated_content_id: str) -> bool:
        """
        Check if feedback exists for generated content.
        
        Args:
            generated_content_id: UUID of the generated content
            
        Returns:
            True if feedback exists, False otherwise
        """
        return FeedbackModel.objects.filter(
            generated_content_id=generated_content_id
        ).exists()
    
    @staticmethod
    def get_all_feedback():
        """
        Retrieve all feedback (for future analytics).
        
        Extension Point: This will be used by analytics module.
        Consider adding pagination, filtering, and aggregation.
        """
        return FeedbackModel.objects.select_related('generated_content').all()
