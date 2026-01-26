"""
Consistency Analyzer Interface.

Defines the contract for analyzing learner consistency.
Current implementation is rule-based; can be swapped for ML later.

⚠️ IMPORTANT:
- Consistency measures regularity of learning activity
- Based on OBSERVED patterns (session frequency, duration variance)
- No value judgment (consistency != better learning)
"""

from abc import abstractmethod
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from .base import BaseEstimator, EstimatorResult
from ..domain.events import LearningEventData


class ConsistencyAnalyzer(BaseEstimator[float]):
    """
    Abstract interface for analyzing learning consistency.
    
    Implementations must:
    - Measure consistency as a float (0.0 = very inconsistent, 1.0 = very consistent)
    - Provide confidence in the analysis
    - Explain the consistency patterns observed
    - Be deterministic
    
    Current implementation: Rule-based (see rules/consistency_rules.py)
    Future implementation: Can be ML-based without interface changes
    
    Example usage:
        >>> analyzer = RuleBasedConsistencyAnalyzer()
        >>> result = analyzer.analyze(
        ...     user_id=uuid4(),
        ...     events=event_list,
        ...     time_window=timedelta(days=30)
        ... )
        >>> print(result.value)  # 0.72
        >>> print(result.explanation)  # "Consistent activity pattern..."
    """
    
    @abstractmethod
    def analyze(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        time_window: Optional[timedelta] = None
    ) -> EstimatorResult[float]:
        """
        Analyze consistency for a specific learner.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            time_window: Optional time window to consider
            
        Returns:
            EstimatorResult with:
            - value: Consistency score (0.0 = inconsistent, 1.0 = consistent)
            - confidence: How confident we are in this analysis
            - explanation: Description of consistency patterns
            - factors: Contributing factors (frequency_score, duration_variance, etc.)
        """
        pass
    
    @abstractmethod
    def get_session_pattern(
        self,
        user_id: UUID,
        events: list[LearningEventData]
    ) -> dict[str, any]:
        """
        Get the learner's session pattern.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            
        Returns:
            Dictionary with session pattern info:
            - avg_sessions_per_week: float
            - avg_session_duration: int (seconds)
            - preferred_times: list[str] (e.g., ["morning", "evening"])
            - active_days: list[str] (e.g., ["monday", "wednesday"])
            - session_regularity: float (0.0 to 1.0)
        """
        pass
    
    @abstractmethod
    def detect_pattern_change(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        baseline_window: timedelta,
        comparison_window: timedelta
    ) -> EstimatorResult[float]:
        """
        Detect if there's been a change in consistency pattern.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            baseline_window: Time window for baseline pattern
            comparison_window: Time window for comparison
            
        Returns:
            EstimatorResult with:
            - value: Change magnitude (-1.0 to 1.0, negative = declining)
            - explanation: Description of the change
        """
        pass
    
    def is_irregular(self, score: float, threshold: float = 0.3) -> bool:
        """
        Check if consistency is below acceptable threshold.
        
        Args:
            score: Consistency score
            threshold: Minimum acceptable consistency
            
        Returns:
            True if consistency is below threshold
        """
        return score < threshold
    
    def categorize(self, score: float) -> str:
        """
        Categorize consistency level.
        
        Args:
            score: Consistency score (0.0 to 1.0)
            
        Returns:
            Consistency category string
        """
        if score < 0.2:
            return 'very_irregular'
        elif score < 0.4:
            return 'irregular'
        elif score < 0.6:
            return 'moderate'
        elif score < 0.8:
            return 'consistent'
        else:
            return 'very_consistent'
