"""
Difficulty Estimator Interface.

Defines the contract for estimating topic difficulty for a learner.
Current implementation is rule-based; can be swapped for ML later.

⚠️ IMPORTANT:
- Difficulty is PERSONALIZED (per learner, not inherent to topic)
- Based on OBSERVED behavior, not predictions
- Result must be explainable
"""

from abc import abstractmethod
from typing import Optional
from uuid import UUID

from .base import BaseEstimator, EstimatorResult
from ..domain.enums import TopicDifficulty
from ..domain.events import LearningEventData


class DifficultyEstimator(BaseEstimator[float]):
    """
    Abstract interface for estimating topic difficulty.
    
    Implementations must:
    - Estimate difficulty as a float (0.0 = easy, 1.0 = hard)
    - Provide confidence in the estimate
    - Explain the factors contributing to difficulty
    
    Current implementation: Rule-based (see rules/difficulty_rules.py)
    Future implementation: Can be ML-based without interface changes
    
    Example usage:
        >>> estimator = RuleBasedDifficultyEstimator()
        >>> result = estimator.estimate(
        ...     user_id=uuid4(),
        ...     topic="Python Decorators",
        ...     events=event_list
        ... )
        >>> print(result.value)  # 0.75
        >>> print(result.explanation)  # "High difficulty due to..."
    """
    
    @abstractmethod
    def estimate(
        self,
        user_id: UUID,
        topic: str,
        events: list[LearningEventData],
        baseline_difficulty: Optional[float] = None
    ) -> EstimatorResult[float]:
        """
        Estimate the difficulty of a topic for a specific learner.
        
        Args:
            user_id: The learner's ID
            topic: The topic to estimate difficulty for
            events: Relevant learning events for this user and topic
            baseline_difficulty: Optional baseline difficulty (0.0 to 1.0)
            
        Returns:
            EstimatorResult with:
            - value: Difficulty score (0.0 = very easy, 1.0 = very hard)
            - confidence: How confident we are in this estimate
            - explanation: Why we think this is the difficulty
            - factors: Contributing factors (retry_rate, time_factor, etc.)
        """
        pass
    
    @abstractmethod
    def estimate_batch(
        self,
        user_id: UUID,
        topics: list[str],
        events: list[LearningEventData]
    ) -> dict[str, EstimatorResult[float]]:
        """
        Estimate difficulty for multiple topics at once.
        
        More efficient than calling estimate() multiple times.
        
        Args:
            user_id: The learner's ID
            topics: List of topics to estimate
            events: All relevant learning events
            
        Returns:
            Dictionary mapping topic name to EstimatorResult
        """
        pass
    
    def categorize(self, score: float) -> TopicDifficulty:
        """
        Convert a numeric score to a difficulty category.
        
        This is a convenience method; implementations may override.
        
        Args:
            score: Difficulty score (0.0 to 1.0)
            
        Returns:
            TopicDifficulty enum value
        """
        return TopicDifficulty.from_score(score)
