"""
Background Tasks for Content Request Processing

This module defines Celery tasks for asynchronous processing of content requests.

Phase 1: Stub implementation
Phase 2: Actual AI generation using configured provider

Design principles:
- Idempotent tasks (can safely retry)
- Atomic status updates
- Comprehensive error handling
- Structured logging for monitoring
"""
import logging
import os
from celery import shared_task
from uuid import UUID

from .services.content_service import get_content_request_service
from .services.ai_provider import get_ai_provider, AIProviderError, AIProviderRateLimitError
from .services.content_formatter import get_content_formatter, ContentFormatterError
from .persistence.repository import GeneratedContentRepository
from .domain.enums import RequestStatus

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='content_requests.process_request',
    max_retries=3,
    default_retry_delay=60,  # 60 seconds
)
def process_content_request(self, request_id: str):
    """
    Process a content generation request asynchronously.
    
    Phase 2: Calls AI provider to generate actual content.
    
    Args:
        request_id: UUID string of the request to process
        
    Returns:
        dict: Processing result with success status
        
    Workflow:
        1. Update status to PROCESSING
        2. Fetch request details
        3. Call AI provider to generate content
        4. Format content according to output_format
        5. Persist generated content
        6. Update status to COMPLETED
        7. Handle errors by updating to FAILED
    """
    service = get_content_request_service()
    content_repo = GeneratedContentRepository()
    
    try:
        request_uuid = UUID(request_id)
        logger.info(f"[Task] Starting processing for request {request_id}")
        
        # Update status to PROCESSING
        success = service.update_request_status(request_uuid, RequestStatus.PROCESSING)
        if not success:
            logger.error(f"[Task] Failed to update status to PROCESSING for {request_id}")
            return {
                'success': False,
                'request_id': request_id,
                'error': 'Failed to update status to PROCESSING'
            }
        
        logger.info(f"[Task] Request {request_id} status updated to PROCESSING")
        
        # Fetch the request details
        request = service.get_request_by_id(request_uuid)
        if not request:
            logger.error(f"[Task] Request {request_id} not found")
            service.update_request_status(request_uuid, RequestStatus.FAILED)
            return {
                'success': False,
                'request_id': request_id,
                'error': 'Request not found'
            }
        
        # Get AI provider (from environment or config)
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            logger.error("[Task] GEMINI_API_KEY not configured")
            service.update_request_status(request_uuid, RequestStatus.FAILED)
            return {
                'success': False,
                'request_id': request_id,
                'error': 'AI provider not configured'
            }
        
        try:
            # Initialize AI provider
            ai_provider = get_ai_provider('gemini', api_key=api_key)
            
            # Generate content
            logger.info(f"[Task] Generating content for request {request_id}")
            generated = ai_provider.generate_content(request)
            
            logger.info(
                f"[Task] Content generated successfully "
                f"({len(generated.content_text)} chars)"
            )
            
            # Add request metadata to generation metadata
            generation_metadata = {
                **generated.metadata,
                'topic': request.topic,
                'content_type': request.content_type.value,
                'style': request.style.value,
                'difficulty': request.difficulty.value if request.difficulty else None,
            }
            
            # Persist generated content
            content_model = content_repo.create(
                request_id=request_uuid,
                content_text=generated.content_text,
                output_format=request.output_format,
                metadata=generation_metadata
            )
            
            logger.info(
                f"[Task] Generated content persisted with ID {content_model.id}"
            )
            
            # Update status to COMPLETED after content is saved
            success = service.update_request_status(request_uuid, RequestStatus.COMPLETED)
            if not success:
                logger.error(f"[Task] Failed to update status to COMPLETED for {request_id}")
                return {
                    'success': False,
                    'request_id': request_id,
                    'error': 'Failed to update status to COMPLETED'
                }
            
            logger.info(f"[Task] Request {request_id} processing completed successfully")
            
            return {
                'success': True,
                'request_id': request_id,
                'content_id': str(content_model.id),
                'status': 'completed'
            }
            
        except AIProviderRateLimitError as e:
            logger.warning(f"[Task] Rate limit hit for request {request_id}: {str(e)}")
            # Retry with exponential backoff
            raise self.retry(exc=e, countdown=120)  # 2 minutes
            
        except AIProviderError as e:
            logger.error(f"[Task] AI provider error for request {request_id}: {str(e)}")
            service.update_request_status(request_uuid, RequestStatus.FAILED)
            return {
                'success': False,
                'request_id': request_id,
                'error': f'AI generation failed: {str(e)}'
            }
        
    except ValueError as e:
        # Invalid UUID
        logger.error(f"[Task] Invalid request ID format: {request_id} - {str(e)}")
        return {
            'success': False,
            'request_id': request_id,
            'error': f'Invalid UUID: {str(e)}'
        }
        
    except Exception as e:
        logger.exception(f"[Task] Error processing request {request_id}: {str(e)}")
        
        # Update status to FAILED
        try:
            request_uuid = UUID(request_id)
            service.update_request_status(request_uuid, RequestStatus.FAILED)
            logger.info(f"[Task] Request {request_id} marked as FAILED")
        except Exception as status_error:
            logger.error(
                f"[Task] Failed to update status to FAILED for {request_id}: "
                f"{str(status_error)}"
            )
        
        # Retry the task if we haven't exceeded max retries
        if self.request.retries < self.max_retries:
            logger.info(
                f"[Task] Retrying request {request_id} "
                f"(attempt {self.request.retries + 1}/{self.max_retries})"
            )
            raise self.retry(exc=e, countdown=60)
        
        logger.error(
            f"[Task] Max retries exceeded for request {request_id}"
        )
        
        return {
            'success': False,
            'request_id': request_id,
            'error': str(e),
            'max_retries_exceeded': True
        }


@shared_task(name='content_requests.cleanup_old_requests')
def cleanup_old_requests(days: int = 90):
    """
    Periodic task to clean up old completed/failed requests.
    
    Phase 1: Not implemented (stub)
    Phase 2+: Archive old requests, cleanup file storage
    
    This task can be scheduled with Celery Beat to run periodically.
    
    Args:
        days: Number of days to retain requests (default: 90)
        
    Returns:
        dict: Cleanup result summary
    """
    logger.info(f"[Task] Cleanup task called (not implemented in Phase 1) - days={days}")
    return {
        'message': 'Cleanup not implemented in Phase 1',
        'days': days
    }


# Extension point for Phase 2+
@shared_task(name='content_requests.generate_content')
def generate_content(request_id: str):
    """
    Generate actual content using AI service.
    
    Phase 1: Not implemented
    Phase 2+: Call OpenAI/other AI service to generate content
    
    Args:
        request_id: UUID string of the request
        
    Returns:
        dict: Generation result
    """
    logger.info(f"[Task] Content generation called for {request_id} (not implemented)")
    return {
        'message': 'AI generation not implemented in Phase 1',
        'request_id': request_id
    }
