"""
URL Configuration for Content Requests API

Defines URL routing for the content requests module.
Uses Django REST Framework's router for automatic URL generation.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContentRequestViewSet, HealthCheckViewSet


# Create a router and register viewsets
router = DefaultRouter()
router.register(r'requests', ContentRequestViewSet, basename='content-request')
router.register(r'', HealthCheckViewSet, basename='health')

# App name for namespacing
app_name = 'content_requests'

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
