"""
Content Request Service - Phase 1

This service orchestrates business logic for content request lifecycle:
- Request creation and validation
- Status management
- Background queue integration
- Request retrieval and listing

Extension points:
- Phase 2: Add AI generation integration
- Phase 3: Add user association when authentication exists
- Phase 4: Add analytics and personalization

Design principles:
- Business logic is centralized here, not in controllers or models
- Domain rules are enforced through domain entities
- Service is stateless and can be easily tested
- No direct dependency on HTTP layer or framework
"""
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID

from ..domain.content_request import ContentRequest
from ..domain.enums import ContentType, Style, OutputFormat, Difficulty, RequestStatus
from ..domain.exceptions import InvalidStatusTransitionError
from ..persistence.repository import ContentRequestRepository
from .validators import ContentRequestValidator, ValidationError


logger = logging.getLogger(__name__)


class ContentRequestService:
    """
    Service for content request business logic.
    
    This service coordinates between:
    - Validation layer (input validation)
    - Domain layer (business rules)
    - Persistence layer (data access)
    - Queue layer (background processing)
    
    All business operations go through this service.
    """
    
    def __init__(self, repository: Optional[ContentRequestRepository] = None):
        """
        Initialize the service with optional repository injection.
        
        Args:
            repository: ContentRequestRepository instance (for testing/DI)
        """
        self.repository = repository or ContentRequestRepository()
        self.validator = ContentRequestValidator()
    
    def create_request(
        self,
        topic: str,
        content_type: str,
        style: str,
        output_format: str,
        difficulty: Optional[str] = None,
        notes: Optional[str] = None,
        user=None,
        subject: Optional[str] = None,
        target_class_id=None,
        target_section_id=None,
    ) -> ContentRequest:
        """
        Create a new content request.
        
        Args:
            topic: Subject matter for content generation
            content_type: Type of content (from ContentType enum)
            style: Generation style (from Style enum)
            output_format: Desired output format (from OutputFormat enum)
            difficulty: Optional difficulty level (from Difficulty enum)
            notes: Optional additional instructions
            user: Optional authenticated user
            subject: Optional academic subject
            target_class_id: Optional target class UUID (for teachers)
            target_section_id: Optional target section UUID (for teachers)
            
        Returns:
            Created ContentRequest domain entity
        """
        # Prepare data for validation
        data = {
            'topic': topic,
            'content_type': content_type,
            'style': style,
            'output_format': output_format,
            'difficulty': difficulty,
            'notes': notes,
        }
        
        # Sanitize and validate input
        sanitized = self.validator.sanitize_input(data)
        self.validator.validate_and_raise(sanitized)
        
        # Create domain entity
        try:
            request = ContentRequest(
                topic=sanitized['topic'],
                content_type=ContentType(sanitized['content_type']),
                style=Style(sanitized['style']),
                output_format=OutputFormat(sanitized['output_format']),
                difficulty=Difficulty(sanitized['difficulty']) if sanitized.get('difficulty') else None,
                notes=sanitized.get('notes'),
                status=RequestStatus.PENDING,  # Initial status
            )
        except ValueError as e:
            logger.error(f"Domain validation failed: {str(e)}")
            raise ValidationError({'domain': [str(e)]})
        
        # Persist the request
        persisted = self.repository.create(
            request, 
            user=user,
            subject=subject or '',
            target_class_id=target_class_id,
            target_section_id=target_section_id,
        )
        
        logger.info(
            f"Created content request {persisted.id} - "
            f"topic: {persisted.topic[:50]}, type: {persisted.content_type.value}"
        )
        
        # Enqueue for background processing
        # Import here to avoid circular dependency
        from ..tasks import process_content_request
        try:
            process_content_request.delay(str(persisted.id))
            logger.info(f"Enqueued content request {persisted.id} for processing")
        except Exception as e:
            logger.error(
                f"Failed to enqueue request {persisted.id} for processing: {str(e)}"
            )
            # Don't fail the request creation if queueing fails
            # Worker can pick up pending requests later
        
        return persisted
    
    def get_request_by_id(self, request_id: UUID) -> Optional[ContentRequest]:
        """
        Retrieve a content request by ID.
        
        Args:
            request_id: UUID of the request
            
        Returns:
            ContentRequest if found, None otherwise
        """
        request = self.repository.get_by_id(request_id)
        if request:
            logger.debug(f"Retrieved content request {request_id}")
        else:
            logger.warning(f"Content request {request_id} not found")
        return request
    
    def list_requests(
        self,
        status: Optional[RequestStatus] = None,
        limit: int = 100,
        offset: int = 0,
        user=None,
    ) -> List[ContentRequest]:
        """
        List content requests with optional filtering.
        
        Args:
            status: Optional status filter
            limit: Maximum number of results (default: 100)
            offset: Number of results to skip (default: 0)
            user: Optional user to filter by (only their requests)
            
        Returns:
            List of ContentRequest entities
        """
        if status:
            requests = self.repository.list_by_status(status, limit, offset, user=user)
            logger.debug(
                f"Listed {len(requests)} requests with status {status.value}"
            )
        else:
            requests = self.repository.list_all(limit, offset, user=user)
            logger.debug(f"Listed {len(requests)} requests (all statuses)")
        
        return requests
    
    def update_request_status(
        self,
        request_id: UUID,
        new_status: RequestStatus
    ) -> Optional[ContentRequest]:
        """
        Update the status of a content request.
        
        This enforces domain rules for valid status transitions.
        
        Args:
            request_id: UUID of the request
            new_status: New status to transition to
            
        Returns:
            Updated ContentRequest if successful, None if not found
            
        Raises:
            InvalidStatusTransitionError: If transition is not valid
        """
        try:
            updated = self.repository.update_status(request_id, new_status)
            if updated:
                logger.info(
                    f"Updated request {request_id} status to {new_status.value}"
                )
            else:
                logger.warning(
                    f"Cannot update status: request {request_id} not found"
                )
            return updated
        except InvalidStatusTransitionError as e:
            logger.error(f"Invalid status transition for {request_id}: {str(e)}")
            raise
    
    def count_by_status(self, status: RequestStatus) -> int:
        """
        Count requests by status.
        
        Useful for monitoring and dashboard metrics.
        
        Args:
            status: Status to count
            
        Returns:
            Number of requests with the specified status
        """
        count = self.repository.count_by_status(status)
        logger.debug(f"Counted {count} requests with status {status.value}")
        return count
    
    def request_exists(self, request_id: UUID) -> bool:
        """
        Check if a request exists.
        
        Args:
            request_id: UUID of the request
            
        Returns:
            True if request exists, False otherwise
        """
        return self.repository.exists(request_id)


# Singleton instance for application use
_service_instance = None


def get_content_request_service() -> ContentRequestService:
    """
    Get or create singleton ContentRequestService instance.
    
    This provides a consistent service instance across the application
    while allowing dependency injection for testing.
    
    Returns:
        ContentRequestService instance
    """
    global _service_instance
    if _service_instance is None:
        _service_instance = ContentRequestService()
    return _service_instance

    
    def get_request_content(self, request_id: int) -> Optional[GeneratedContent]:
        """
        Retrieve generated content for a request.
        
        Args:
            request_id (int): The content request ID
            
        Returns:
            GeneratedContent: The generated content or None
        """
        try:
            return GeneratedContent.objects.filter(
                request_id=request_id
            ).latest('created_at')
        except GeneratedContent.DoesNotExist:
            logger.info(f"No content found for request #{request_id}")
            return None
    
    def cancel_request(self, request_id: int) -> bool:
        """
        Cancel a pending content request.
        
        Args:
            request_id (int): The request ID to cancel
            
        Returns:
            bool: True if cancelled successfully
            
        Raises:
            ValidationError: If request cannot be cancelled
        """
        request = self.get_request(request_id)
        if not request:
            raise ValidationError(f"Content request #{request_id} not found")
        
        if request.status not in [
            ContentRequest.StatusChoices.PENDING,
            ContentRequest.StatusChoices.PROCESSING
        ]:
            raise ValidationError(
                f"Cannot cancel request in {request.status} status"
            )
        
        request.status = ContentRequest.StatusChoices.CANCELLED
        request.save(update_fields=['status', 'updated_at'])
        
        logger.info(f"Cancelled content request #{request_id}")
        return True


class FeedbackAnalyticsService:
    """
    Service for analyzing user feedback patterns.
    
    This service will be extended in future phases to provide:
    - Feedback aggregation
    - Quality metrics
    - Improvement recommendations
    """
    
    def get_feedback_summary(self, request_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Get feedback summary statistics.
        
        Args:
            request_id (int): Optional request ID to filter by
            
        Returns:
            dict: Feedback statistics
        """
        queryset = UserFeedback.objects.all()
        
        if request_id:
            queryset = queryset.filter(request_id=request_id)
        
        total = queryset.count()
        
        feedback_counts = {
            'total': total,
            'positive': queryset.filter(
                feedback_type=UserFeedback.FeedbackTypeChoices.POSITIVE
            ).count(),
            'negative': queryset.filter(
                feedback_type=UserFeedback.FeedbackTypeChoices.NEGATIVE
            ).count(),
            'issues': queryset.filter(
                feedback_type=UserFeedback.FeedbackTypeChoices.REPORT_ISSUE
            ).count(),
            'suggestions': queryset.filter(
                feedback_type=UserFeedback.FeedbackTypeChoices.SUGGESTION
            ).count(),
        }
        
        return feedback_counts
