"""
Recommendation Strategy Interface.

Defines the contract for generating recommendations.
Current implementation is rule-based; can be swapped for ML later.

⚠️ CRITICAL CONSTRAINTS:
- Recommendations are ADVISORY ONLY
- NO automatic application of recommendations
- Phase 6 MUST NOT mutate study plans or content
- Recommendations suggest, they don't command
"""

from abc import abstractmethod
from typing import Optional
from uuid import UUID

from .base import BaseEstimator, EstimatorConfig
from ..domain.insights import LearnerInsightData, InsightDelta
from ..domain.recommendations import RecommendationData, RecommendationBatch
from ..domain.enums import RecommendationType


class RecommendationStrategy(BaseEstimator[list[RecommendationData]]):
    """
    Abstract interface for generating recommendations.
    
    Implementations must:
    - Generate advisory recommendations only
    - Provide justification for each recommendation
    - Assign confidence scores based on evidence
    - Never automatically apply recommendations
    
    Current implementation: Rule-based (see rules/recommendation_rules.py)
    Future implementation: Can be ML-based without interface changes
    
    ⚠️ Phase 6 Constraints:
    - Recommendations are suggestions, not commands
    - External systems MAY choose to act on recommendations
    - Phase 6 MUST NOT act on its own recommendations
    
    Example usage:
        >>> strategy = RuleBasedRecommendationStrategy()
        >>> batch = strategy.generate(
        ...     insight=learner_insight,
        ...     delta=insight_delta,
        ...     max_recommendations=5
        ... )
        >>> for rec in batch.recommendations:
        ...     print(f"{rec.recommendation_type}: {rec.justification}")
    """
    
    @abstractmethod
    def generate(
        self,
        insight: LearnerInsightData,
        delta: Optional[InsightDelta] = None,
        max_recommendations: int = 10,
        filter_types: Optional[list[RecommendationType]] = None
    ) -> RecommendationBatch:
        """
        Generate recommendations based on learner insights.
        
        Args:
            insight: Current learner insight profile
            delta: Optional change since last insight
            max_recommendations: Maximum recommendations to generate
            filter_types: Optional filter to specific recommendation types
            
        Returns:
            RecommendationBatch with prioritized recommendations
        """
        pass
    
    @abstractmethod
    def generate_for_topic(
        self,
        insight: LearnerInsightData,
        topic: str,
        max_recommendations: int = 3
    ) -> list[RecommendationData]:
        """
        Generate recommendations for a specific topic.
        
        Args:
            insight: Current learner insight profile
            topic: The topic to generate recommendations for
            max_recommendations: Maximum recommendations
            
        Returns:
            List of recommendations for the topic
        """
        pass
    
    @abstractmethod
    def evaluate_recommendation(
        self,
        recommendation: RecommendationData,
        insight: LearnerInsightData
    ) -> float:
        """
        Evaluate how relevant a recommendation still is.
        
        Used to determine if a recommendation should be refreshed.
        
        Args:
            recommendation: The recommendation to evaluate
            insight: Current learner insight
            
        Returns:
            Relevance score (0.0 = not relevant, 1.0 = highly relevant)
        """
        pass
    
    def prioritize(
        self,
        recommendations: list[RecommendationData]
    ) -> list[RecommendationData]:
        """
        Prioritize recommendations.
        
        Default implementation sorts by priority and confidence.
        Subclasses may override with more sophisticated logic.
        
        Args:
            recommendations: List of recommendations
            
        Returns:
            Prioritized list (highest priority first)
        """
        return sorted(
            recommendations,
            key=lambda r: (r.priority, -r.confidence_score)
        )
    
    def filter_actionable(
        self,
        recommendations: list[RecommendationData]
    ) -> list[RecommendationData]:
        """
        Filter to only actionable recommendations.
        
        Args:
            recommendations: List of recommendations
            
        Returns:
            List of actionable recommendations
        """
        return [r for r in recommendations if r.is_actionable]
