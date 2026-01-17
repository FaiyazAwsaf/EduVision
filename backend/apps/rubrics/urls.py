from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RubricViewSet

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'rubrics', RubricViewSet, basename='rubric')

urlpatterns = [
    path('', include(router.urls)),
]
