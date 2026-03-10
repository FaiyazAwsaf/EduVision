"""
Celery tasks for the Curriculum module.

Handles async parsing of uploaded course outline PDFs.
"""
import logging
from celery import shared_task
from uuid import UUID

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    name="curriculum.parse_course_outline",
    max_retries=2,
    default_retry_delay=30,
)
def parse_course_outline_task(self, outline_id: str):
    """
    Async wrapper for course outline processing pipeline.

    1. Extract text from PDF (pdfplumber)
    2. Send text to Gemini for structured extraction
    3. Persist parsed weeks and topics

    Retries up to 2 times on transient failures.
    """
    from .services.course_service import process_outline

    try:
        logger.info("[Curriculum] Starting parse for outline %s", outline_id)
        process_outline(UUID(outline_id))
        logger.info("[Curriculum] Successfully parsed outline %s", outline_id)
        return {"success": True, "outline_id": outline_id}

    except Exception as exc:
        logger.exception(
            "[Curriculum] Failed to parse outline %s: %s", outline_id, exc
        )
        # Retry on transient failures
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(
                "[Curriculum] Max retries exceeded for outline %s", outline_id
            )
            return {"success": False, "outline_id": outline_id, "error": str(exc)}
