from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RubricSetViewSet

# Create a router and register viewsets
router = DefaultRouter()
# Multi-question rubric builder is now the primary implementation
router.register(r'rubrics', RubricSetViewSet, basename='rubric')

urlpatterns = [
    path('', include(router.urls)),
]
