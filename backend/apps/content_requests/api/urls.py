"""
URL Configuration for Content Request API

Defines URL routing for content request endpoints.
Uses Django URL patterns for explicit routing.

Endpoints:
- POST   /api/content-requests/                       - Create new request
- GET    /api/content-requests/                       - List all requests
- GET    /api/content-requests/<id>/                  - Retrieve request details
- GET    /api/content-requests/<id>/content/          - Retrieve generated content (Phase 2)
- GET    /api/content-requests/<id>/content/download/ - Download as PDF
- POST   /api/content-requests/<id>/context/          - Create/update learning context (Phase 4)
- GET    /api/content-requests/<id>/context/          - Retrieve learning context (Phase 4)
- POST   /api/generated-content/<id>/feedback/        - Submit feedback (Phase 3)
- GET    /api/generated-content/<id>/feedback/        - Retrieve feedback (Phase 3)
"""
from django.urls import path
from .views import (
    ContentRequestListCreateView,
    ContentRequestDetailView,
    GeneratedContentView,
    download_generated_content_view
)
from .views_feedback import FeedbackView
from .views_learning_context import LearningContextView


app_name = 'content_requests'

urlpatterns = [
    # List and create content requests
    path(
        '',
        ContentRequestListCreateView.as_view(),
        name='content-request-list-create'
    ),
    
    # Retrieve content request details
    path(
        '<str:request_id>/',
        ContentRequestDetailView.as_view(),
        name='content-request-detail'
    ),
    
    # Retrieve generated content (Phase 2)
    path(
        '<str:request_id>/content/',
        GeneratedContentView.as_view(),
        name='generated-content'
    ),
    
    # Download formatted content (PDF/Worksheet)
    path(
        '<str:request_id>/content/download/',
        download_generated_content_view,
        name='download-content'
    ),
    
    # Learning context endpoints (Phase 4)
    path(
        '<str:request_id>/context/',
        LearningContextView.as_view(),
        name='learning-context'
    ),
]

# Feedback endpoints (Phase 3) - separate base URL
# These use generated_content_id, not request_id
feedback_urlpatterns = [
    # Submit and retrieve feedback for generated content
    path(
        'generated-content/<str:content_id>/feedback/',
        FeedbackView.as_view(),
        name='feedback'
    ),
]

# Combine all URL patterns
urlpatterns = urlpatterns + feedback_urlpatterns
