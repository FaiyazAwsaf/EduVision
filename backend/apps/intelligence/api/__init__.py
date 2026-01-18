"""
API layer for Phase 6: Intelligence & Adaptive Optimization.
"""

from .serializers import (
    LearningEventSerializer,
    LearningEventCreateSerializer,
    LearningEventBatchSerializer,
    TopicMetricsSerializer,
    LearnerInsightSerializer,
    LearnerInsightSummarySerializer,
    RecommendationSerializer,
    RecommendationActionSerializer,
    GenerateRecommendationsSerializer,
    RecommendationStatsSerializer,
)
from .views import (
    LearningEventViewSet,
    LearnerInsightViewSet,
    RecommendationViewSet,
)

__all__ = [
    # Serializers
    'LearningEventSerializer',
    'LearningEventCreateSerializer',
    'LearningEventBatchSerializer',
    'TopicMetricsSerializer',
    'LearnerInsightSerializer',
    'LearnerInsightSummarySerializer',
    'RecommendationSerializer',
    'RecommendationActionSerializer',
    'GenerateRecommendationsSerializer',
    'RecommendationStatsSerializer',
    # ViewSets
    'LearningEventViewSet',
    'LearnerInsightViewSet',
    'RecommendationViewSet',
]
