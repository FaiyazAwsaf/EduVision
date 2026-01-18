"""
Celery Configuration for EduVision Backend

This module configures Celery for asynchronous task processing.
Uses Redis as the message broker and result backend.

Task Categories:
- Content generation tasks
- Batch processing tasks
- Scheduled tasks (future)
"""
import os
from celery import Celery
from django.conf import settings


# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create Celery app
app = Celery('eduvision')

# Load configuration from Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

# Explicitly include tasks (ensures they are discovered)
app.autodiscover_tasks(['apps.content_requests'])


# Task routing configuration (optional, for advanced use)
app.conf.task_routes = {
    'content_requests.process_request': {'queue': 'celery'},
    # Add more routes as other modules are implemented
}

# Task priority configuration
app.conf.task_acks_late = True
app.conf.task_reject_on_worker_lost = True
app.conf.worker_prefetch_multiplier = 1


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """
    Debug task for testing Celery configuration.
    
    Usage:
        from config.celery import debug_task
        debug_task.delay()
    """
    print(f'Request: {self.request!r}')
