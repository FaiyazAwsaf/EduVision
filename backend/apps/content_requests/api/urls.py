"""
URL Configuration for Content Request API - Phase 1

Defines URL routing for content request endpoints.
Uses Django URL patterns for explicit routing.

Endpoints:
- POST   /api/content-requests/        - Create new request
- GET    /api/content-requests/        - List all requests
- GET    /api/content-requests/<id>/   - Retrieve request details
"""
from django.urls import path
from .views import ContentRequestListCreateView, ContentRequestDetailView


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
]
