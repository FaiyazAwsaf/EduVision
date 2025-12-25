"""
Background Tasks for Content Request Processing

This module defines Celery tasks for asynchronous processing of content requests.

Phase 1 Scope:
- Stub implementation that simulates processing
- Status transitions (PENDING -> PROCESSING -> COMPLETED)
- Error handling and retry logic
- Logging for observability

Phase 2+ Extensions:
- Call actual AI generation service
- Handle file storage for generated content
- Send notifications to users
- Implement cleanup tasks

Design principles:
- Idempotent tasks (can safely retry)
- Atomic status updates
- Comprehensive error handling
- Structured logging for monitoring
"""
import time
import logging
from celery import shared_task
from uuid import UUID

from .services.content_service import get_content_request_service
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
    
    Phase 1: Stub implementation that simulates processing.
    Phase 2+: Will call AI service to generate actual content.
    
    Args:
        request_id: UUID string of the request to process
        
    Returns:
        dict: Processing result with success status
        
    Workflow:
        1. Update status to PROCESSING
        2. Simulate work (sleep)
        3. Update status to COMPLETED
        4. Handle errors by updating to FAILED
    """
    service = get_content_request_service()
    
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
        
        # Phase 1: Simulate processing work
        # Phase 2+: Call AI service here
        time.sleep(2)  # Simulate work
        
        # Update status to COMPLETED
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
            'status': 'completed'
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
