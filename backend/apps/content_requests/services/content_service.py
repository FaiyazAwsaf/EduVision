"""
Content Request Service

This module implements business logic for handling content requests.
It follows the Service Layer pattern to separate business logic from
API controllers and maintain clean separation of concerns.

The service orchestrates:
- Content request creation and management
- AI content generation coordination
- Status tracking and updates
- Integration with background tasks
"""
import logging
from typing import Dict, Any, Optional, List
from django.db import transaction
from django.core.exceptions import ValidationError

from ..models import ContentRequest, GeneratedContent, UserFeedback
from .ai_generator import get_ai_generator, AIGenerationError, ContentType


logger = logging.getLogger(__name__)


class ContentRequestService:
    """
    Service class for managing content requests.
    
    This service handles all business logic related to content requests,
    including creation, status management, and coordination with AI services.
    
    Design Principles:
    - Single Responsibility: Focuses only on content request business logic
    - Dependency Injection: AI generator can be injected for testing
    - Transaction Management: Uses database transactions for data consistency
    """
    
    def __init__(self, ai_generator=None):
        """
        Initialize the content request service.
        
        Args:
            ai_generator: Optional AI generator instance (useful for testing)
        """
        self.ai_generator = ai_generator or get_ai_generator('mock')
    
    def create_request(
        self,
        topic: str,
        style: str,
        format: str,
        metadata: Optional[Dict[str, Any]] = None,
        user=None
    ) -> ContentRequest:
        """
        Create a new content request.
        
        Args:
            topic (str): The subject/topic for content generation
            style (str): Content style (brief, detailed, step_by_step)
            format (str): Output format (text, pdf, worksheet)
            metadata (dict): Additional request parameters
            user: User instance (when auth is implemented)
            
        Returns:
            ContentRequest: The created request instance
            
        Raises:
            ValidationError: If input validation fails
        """
        try:
            # Create the request
            request = ContentRequest.objects.create(
                topic=topic,
                style=style,
                format=format,
                metadata=metadata or {},
                # user=user  # Uncomment when auth is implemented
            )
            
            logger.info(f"Created content request #{request.id} for topic: {topic}")
            return request
            
        except Exception as e:
            logger.error(f"Failed to create content request: {str(e)}")
            raise ValidationError(f"Failed to create request: {str(e)}")
    
    def get_request(self, request_id: int) -> Optional[ContentRequest]:
        """
        Retrieve a content request by ID.
        
        Args:
            request_id (int): The request ID
            
        Returns:
            ContentRequest: The request instance or None
        """
        try:
            return ContentRequest.objects.prefetch_related(
                'generated_contents',
                'feedbacks'
            ).get(id=request_id)
        except ContentRequest.DoesNotExist:
            logger.warning(f"Content request #{request_id} not found")
            return None
    
    def list_requests(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[ContentRequest]:
        """
        List content requests with optional filtering.
        
        Args:
            status (str): Filter by status (optional)
            limit (int): Maximum number of results
            offset (int): Offset for pagination
            
        Returns:
            List[ContentRequest]: List of content requests
        """
        queryset = ContentRequest.objects.all()
        
        if status:
            queryset = queryset.filter(status=status)
        
        return list(queryset[offset:offset + limit])
    
    @transaction.atomic
    def generate_content_sync(self, request_id: int) -> GeneratedContent:
        """
        Generate content synchronously for a request.
        
        This method should typically be called from a background task
        to avoid blocking the API response.
        
        Args:
            request_id (int): The content request ID
            
        Returns:
            GeneratedContent: The generated content instance
            
        Raises:
            ValidationError: If request not found or generation fails
        """
        # Fetch the request
        request = self.get_request(request_id)
        if not request:
            raise ValidationError(f"Content request #{request_id} not found")
        
        # Check if already processed
        if request.status == ContentRequest.StatusChoices.COMPLETED:
            logger.info(f"Request #{request_id} already completed")
            return request.generated_contents.first()
        
        try:
            # Update status to processing
            request.mark_processing()
            logger.info(f"Started processing request #{request_id}")
            
            # Determine content type and generate
            content_data = self._generate_content_by_type(request)
            
            # Create generated content record
            generated_content = GeneratedContent.objects.create(
                request=request,
                content_text=content_data['content'],
                format=self._map_to_content_format(request.format),
                metadata=content_data['metadata']
            )
            
            # Update request status to completed
            request.mark_completed()
            logger.info(f"Completed processing request #{request_id}")
            
            return generated_content
            
        except AIGenerationError as e:
            logger.error(f"AI generation failed for request #{request_id}: {str(e)}")
            request.mark_failed()
            raise ValidationError(f"Content generation failed: {str(e)}")
        
        except Exception as e:
            logger.error(f"Unexpected error processing request #{request_id}: {str(e)}")
            request.mark_failed()
            raise ValidationError(f"Failed to generate content: {str(e)}")
    
    def _generate_content_by_type(self, request: ContentRequest) -> Dict[str, Any]:
        """
        Generate content based on request parameters.
        
        Args:
            request (ContentRequest): The content request
            
        Returns:
            dict: Generated content data
        """
        topic = request.topic
        style = request.style
        metadata = request.metadata
        
        # Map request format to content type
        # This is a simplified mapping - extend as needed
        content_type = self._map_to_content_format(request.format)
        
        # Generate based on content type
        if content_type == GeneratedContent.FormatChoices.SUMMARY:
            return self.ai_generator.generate_summary(topic, style, metadata)
        
        elif content_type == GeneratedContent.FormatChoices.WORKED_EXAMPLE:
            return self.ai_generator.generate_worked_example(topic, metadata)
        
        elif content_type == GeneratedContent.FormatChoices.FORMULA_SHEET:
            return self.ai_generator.generate_formula_sheet(topic, metadata)
        
        elif content_type == GeneratedContent.FormatChoices.STUDY_PLAN:
            return self.ai_generator.generate_study_plan(topic, metadata)
        
        elif content_type == GeneratedContent.FormatChoices.CONCEPT_EXPLANATION:
            return self.ai_generator.generate_concept_explanation(topic, style, metadata)
        
        else:
            # Default to summary
            return self.ai_generator.generate_summary(topic, style, metadata)
    
    def _map_to_content_format(self, request_format: str) -> str:
        """
        Map request format to generated content format.
        
        Args:
            request_format (str): Request format from user
            
        Returns:
            str: GeneratedContent format choice
        """
        # This mapping can be extended based on business requirements
        format_mapping = {
            'text': GeneratedContent.FormatChoices.SUMMARY,
            'pdf': GeneratedContent.FormatChoices.SUMMARY,
            'worksheet': GeneratedContent.FormatChoices.WORKED_EXAMPLE,
        }
        
        return format_mapping.get(request_format, GeneratedContent.FormatChoices.SUMMARY)
    
    def add_feedback(
        self,
        request_id: int,
        feedback_type: str,
        notes: str = "",
        user=None
    ) -> UserFeedback:
        """
        Add user feedback for a content request.
        
        Args:
            request_id (int): The content request ID
            feedback_type (str): Type of feedback
            notes (str): Feedback notes
            user: User instance (when auth is implemented)
            
        Returns:
            UserFeedback: The created feedback instance
            
        Raises:
            ValidationError: If request not found or validation fails
        """
        # Verify request exists
        request = self.get_request(request_id)
        if not request:
            raise ValidationError(f"Content request #{request_id} not found")
        
        try:
            feedback = UserFeedback.objects.create(
                request=request,
                feedback_type=feedback_type,
                notes=notes,
                # user=user  # Uncomment when auth is implemented
            )
            
            logger.info(
                f"Added {feedback_type} feedback for request #{request_id}"
            )
            
            return feedback
            
        except Exception as e:
            logger.error(f"Failed to add feedback: {str(e)}")
            raise ValidationError(f"Failed to add feedback: {str(e)}")
    
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
