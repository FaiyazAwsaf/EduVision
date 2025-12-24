"""
Celery Tasks for Content Requests Module

This module defines asynchronous background tasks for content generation.
Tasks are executed by Celery workers and communicate via Redis.

Task Types:
- Content generation tasks (primary)
- Batch processing tasks (future)
- Cleanup tasks (future)
"""
import logging
from celery import shared_task
from django.core.exceptions import ValidationError

from .services.content_service import ContentRequestService
from .models import ContentRequest


logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name='content_requests.generate_content',
    max_retries=3,
    default_retry_delay=60
)
def generate_content_task(self, request_id: int):
    """
    Asynchronous task to generate content for a request.
    
    This task is triggered when a new content request is created.
    It processes the request in the background to avoid blocking
    the API response.
    
    Args:
        request_id (int): The ContentRequest ID to process
        
    Returns:
        dict: Task result with success status and generated content ID
        
    Raises:
        Exception: If generation fails after retries
    """
    try:
        logger.info(f"Starting content generation task for request #{request_id}")
        
        # Initialize service
        service = ContentRequestService()
        
        # Generate content synchronously (within the async task)
        generated_content = service.generate_content_sync(request_id)
        
        logger.info(
            f"Successfully generated content #{generated_content.id} "
            f"for request #{request_id}"
        )
        
        return {
            'success': True,
            'request_id': request_id,
            'content_id': generated_content.id,
            'message': 'Content generated successfully'
        }
        
    except ValidationError as e:
        logger.error(
            f"Validation error generating content for request #{request_id}: {str(e)}"
        )
        
        # Don't retry validation errors
        return {
            'success': False,
            'request_id': request_id,
            'error': str(e)
        }
    
    except Exception as exc:
        logger.error(
            f"Error generating content for request #{request_id}: {str(exc)}"
        )
        
        # Retry the task with exponential backoff
        try:
            # Exponential backoff: 1min, 2min, 4min
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(exc=exc, countdown=countdown)
        except self.MaxRetriesExceededError:
            logger.error(
                f"Max retries exceeded for request #{request_id}. "
                f"Marking as failed."
            )
            
            # Mark request as failed
            try:
                request = ContentRequest.objects.get(id=request_id)
                request.mark_failed()
            except ContentRequest.DoesNotExist:
                pass
            
            return {
                'success': False,
                'request_id': request_id,
                'error': 'Max retries exceeded'
            }


@shared_task(
    name='content_requests.batch_generate',
    bind=True
)
def batch_generate_content_task(self, request_ids: list):
    """
    Batch process multiple content requests.
    
    This task is useful for processing multiple requests efficiently,
    such as when importing bulk requests or scheduled processing.
    
    Args:
        request_ids (list): List of ContentRequest IDs to process
        
    Returns:
        dict: Batch processing results
    """
    logger.info(f"Starting batch content generation for {len(request_ids)} requests")
    
    results = {
        'total': len(request_ids),
        'successful': 0,
        'failed': 0,
        'details': []
    }
    
    for request_id in request_ids:
        try:
            # Trigger individual generation task
            result = generate_content_task.delay(request_id)
            results['successful'] += 1
            results['details'].append({
                'request_id': request_id,
                'status': 'queued',
                'task_id': result.id
            })
        except Exception as e:
            logger.error(f"Failed to queue request #{request_id}: {str(e)}")
            results['failed'] += 1
            results['details'].append({
                'request_id': request_id,
                'status': 'failed',
                'error': str(e)
            })
    
    logger.info(
        f"Batch processing complete. "
        f"Successful: {results['successful']}, Failed: {results['failed']}"
    )
    
    return results


@shared_task(
    name='content_requests.cleanup_old_requests',
    bind=True
)
def cleanup_old_requests_task(self, days: int = 90):
    """
    Cleanup old completed requests (scheduled task).
    
    This task can be scheduled to run periodically to clean up
    old requests and free up database space.
    
    Args:
        days (int): Delete requests older than this many days
        
    Returns:
        dict: Cleanup statistics
    """
    from django.utils import timezone
    from datetime import timedelta
    
    logger.info(f"Starting cleanup of requests older than {days} days")
    
    cutoff_date = timezone.now() - timedelta(days=days)
    
    # Find old completed requests
    old_requests = ContentRequest.objects.filter(
        status=ContentRequest.StatusChoices.COMPLETED,
        updated_at__lt=cutoff_date
    )
    
    count = old_requests.count()
    
    # Delete old requests (cascade will delete related content)
    old_requests.delete()
    
    logger.info(f"Deleted {count} old requests")
    
    return {
        'deleted_count': count,
        'cutoff_date': cutoff_date.isoformat()
    }


@shared_task(
    name='content_requests.retry_failed_requests',
    bind=True
)
def retry_failed_requests_task(self):
    """
    Retry failed content requests (scheduled task).
    
    This task finds requests that failed due to transient errors
    and retries them automatically.
    
    Returns:
        dict: Retry statistics
    """
    logger.info("Starting retry of failed requests")
    
    # Find failed requests (could add time-based filtering)
    failed_requests = ContentRequest.objects.filter(
        status=ContentRequest.StatusChoices.FAILED
    )[:50]  # Limit to avoid overwhelming the system
    
    results = {
        'total_failed': ContentRequest.objects.filter(
            status=ContentRequest.StatusChoices.FAILED
        ).count(),
        'retried': 0,
        'queued_ids': []
    }
    
    for request in failed_requests:
        try:
            # Reset status to pending
            request.status = ContentRequest.StatusChoices.PENDING
            request.save()
            
            # Queue for processing
            generate_content_task.delay(request.id)
            
            results['retried'] += 1
            results['queued_ids'].append(request.id)
            
        except Exception as e:
            logger.error(f"Failed to retry request #{request.id}: {str(e)}")
    
    logger.info(f"Queued {results['retried']} failed requests for retry")
    
    return results


# Periodic task schedule (configure in Django settings)
# Example configuration to add to settings.py:
"""
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'cleanup-old-requests': {
        'task': 'content_requests.cleanup_old_requests',
        'schedule': crontab(hour=2, minute=0),  # Run daily at 2 AM
        'args': (90,)  # Delete requests older than 90 days
    },
    'retry-failed-requests': {
        'task': 'content_requests.retry_failed_requests',
        'schedule': crontab(minute='*/30'),  # Run every 30 minutes
    },
}
"""
