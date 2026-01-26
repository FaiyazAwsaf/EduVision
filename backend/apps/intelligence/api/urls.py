"""
URL configuration for Phase 6: Intelligence & Adaptive Optimization.

API Endpoints:
    Learning Events:
        GET     /api/intelligence/events/              - List events
        POST    /api/intelligence/events/              - Create event
        GET     /api/intelligence/events/{id}/         - Retrieve event
        POST    /api/intelligence/events/batch/        - Create batch of events
        GET     /api/intelligence/events/topics/       - Get unique topics for user
        GET     /api/intelligence/events/counts/       - Get event counts by type
    
    Learner Insights:
        GET     /api/intelligence/insights/            - List insights
        GET     /api/intelligence/insights/{id}/       - Retrieve insight
        POST    /api/intelligence/insights/compute/    - Compute new insight
        GET     /api/intelligence/insights/latest/     - Get latest insight for user
        GET     /api/intelligence/insights/history/    - Get insight history
    
    Recommendations:
        GET     /api/intelligence/recommendations/                    - List recommendations
        GET     /api/intelligence/recommendations/{id}/               - Retrieve recommendation
        POST    /api/intelligence/recommendations/generate/           - Generate new recommendations
        POST    /api/intelligence/recommendations/{id}/perform_action/ - Mark viewed/accepted/dismissed
        GET     /api/intelligence/recommendations/active/             - Get active recommendations
        GET     /api/intelligence/recommendations/high_priority/      - Get high priority recommendations
        GET     /api/intelligence/recommendations/stats/              - Get recommendation statistics
        POST    /api/intelligence/recommendations/expire_old/         - Expire old recommendations

⚠️ Phase 6 Constraints:
    - Events are immutable (no PUT/PATCH/DELETE)
    - Recommendations are advisory only (no automatic actions)
    - All operations are read or status-update only
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LearningEventViewSet,
    LearnerInsightViewSet,
    RecommendationViewSet,
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r'events', LearningEventViewSet, basename='learning-event')
router.register(r'insights', LearnerInsightViewSet, basename='learner-insight')
router.register(r'recommendations', RecommendationViewSet, basename='recommendation')

# App name for URL namespacing
app_name = 'intelligence'

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
