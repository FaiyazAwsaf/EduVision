"""
Domain layer for Phase 6: Intelligence & Adaptive Optimization.

Contains:
- Event types and schemas (immutable facts)
- Insight value objects
- Recommendation structures
- Enums for all domain concepts
"""

from .enums import (
    EventType,
    InsightType,
    RecommendationType,
    ConfidenceLevel,
    LearningPace,
    TopicDifficulty,
)
from .events import LearningEventData
from .insights import LearnerInsightData, TopicMetrics
from .recommendations import RecommendationData

__all__ = [
    # Enums
    'EventType',
    'InsightType',
    'RecommendationType',
    'ConfidenceLevel',
    'LearningPace',
    'TopicDifficulty',
    # Data classes
    'LearningEventData',
    'LearnerInsightData',
    'TopicMetrics',
    'RecommendationData',
]
