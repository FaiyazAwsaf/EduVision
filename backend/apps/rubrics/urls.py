from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RubricViewSet
from .rubric_set_views import RubricSetViewSet

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'rubrics', RubricViewSet, basename='rubric')
router.register(r'rubric-sets', RubricSetViewSet, basename='rubric-set')

urlpatterns = [
    path('', include(router.urls)),
]
