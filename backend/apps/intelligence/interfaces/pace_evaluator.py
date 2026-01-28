"""
Pace Evaluator Interface.

Defines the contract for evaluating a learner's learning pace.
Current implementation is rule-based; can be swapped for ML later.

⚠️ IMPORTANT:
- Pace is RELATIVE to baseline/expected pace
- Based on OBSERVED completion times and patterns
- No prescriptive judgments (fast/slow is not good/bad)
"""

from abc import abstractmethod
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from .base import BaseEstimator, EstimatorResult
from ..domain.enums import LearningPace
from ..domain.events import LearningEventData


class PaceEvaluator(BaseEstimator[float]):
    """
    Abstract interface for evaluating learning pace.
    
    Implementations must:
    - Evaluate pace as a float (0.0 = very slow, 1.0 = very fast)
    - Provide confidence in the evaluation
    - Explain the factors contributing to pace assessment
    
    Current implementation: Rule-based (see rules/pace_rules.py)
    Future implementation: Can be ML-based without interface changes
    
    Example usage:
        >>> evaluator = RuleBasedPaceEvaluator()
        >>> result = evaluator.evaluate(
        ...     user_id=uuid4(),
        ...     events=event_list,
        ...     time_window=timedelta(days=7)
        ... )
        >>> print(result.value)  # 0.55 (moderate pace)
        >>> print(LearningPace.from_percentile(result.value))  # MODERATE
    """
    
    @abstractmethod
    def evaluate(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        time_window: Optional[timedelta] = None,
        expected_pace: Optional[float] = None
    ) -> EstimatorResult[float]:
        """
        Evaluate the learning pace for a specific learner.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            time_window: Optional time window to consider
            expected_pace: Optional expected pace for comparison
            
        Returns:
            EstimatorResult with:
            - value: Pace score (0.0 = very slow, 1.0 = very fast)
            - confidence: How confident we are in this evaluation
            - explanation: Description of the pace assessment
            - factors: Contributing factors (completion_rate, time_per_topic, etc.)
        """
        pass
    
    @abstractmethod
    def evaluate_for_topic(
        self,
        user_id: UUID,
        topic: str,
        events: list[LearningEventData],
        expected_duration: Optional[int] = None
    ) -> EstimatorResult[float]:
        """
        Evaluate pace for a specific topic.
        
        Args:
            user_id: The learner's ID
            topic: The topic to evaluate pace for
            events: Relevant learning events
            expected_duration: Optional expected duration in seconds
            
        Returns:
            EstimatorResult with topic-specific pace evaluation
        """
        pass
    
    @abstractmethod
    def get_pace_trend(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        period_days: int = 7
    ) -> list[EstimatorResult[float]]:
        """
        Get pace trend over time.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            period_days: Number of days per period
            
        Returns:
            List of EstimatorResults, one per period (oldest first)
        """
        pass
    
    def categorize(self, score: float) -> LearningPace:
        """
        Convert a numeric score to a pace category.
        
        Args:
            score: Pace score (0.0 to 1.0)
            
        Returns:
            LearningPace enum value
        """
        return LearningPace.from_percentile(score)
    
    def is_concerning(self, score: float, threshold: float = 0.2) -> bool:
        """
        Check if pace is concerningly slow.
        
        Args:
            score: Pace score
            threshold: Threshold below which pace is concerning
            
        Returns:
            True if pace is below threshold
        """
        return score < threshold
    
    def is_rushed(self, score: float, threshold: float = 0.85) -> bool:
        """
        Check if pace is potentially too fast (might indicate skimming).
        
        Args:
            score: Pace score
            threshold: Threshold above which pace might be rushed
            
        Returns:
            True if pace is above threshold
        """
        return score > threshold
