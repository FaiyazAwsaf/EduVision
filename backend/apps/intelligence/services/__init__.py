"""
Services layer for Phase 6: Intelligence & Adaptive Optimization.

Services orchestrate:
- Event consumption and storage
- Insight computation
- Recommendation generation

All services maintain strict separation from Module 3.
"""

from .event_service import EventService
from .insight_service import InsightService
from .recommendation_service import RecommendationService

__all__ = [
    'EventService',
    'InsightService',
    'RecommendationService',
]
