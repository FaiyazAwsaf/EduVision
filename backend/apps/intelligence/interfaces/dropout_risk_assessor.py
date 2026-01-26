"""
Dropout Risk Assessor Interface.

Defines the contract for assessing risk of learner dropout.
Current implementation is rule-based; can be swapped for ML later.

⚠️ IMPORTANT:
- Risk is ADVISORY only - no automatic intervention
- Based on OBSERVED patterns (inactivity, abandonment)
- Must be explainable and deterministic
- NO probabilistic ML inference in Phase 6
"""

from abc import abstractmethod
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from .base import BaseEstimator, EstimatorResult
from ..domain.events import LearningEventData


class DropoutRiskAssessor(BaseEstimator[float]):
    """
    Abstract interface for assessing dropout risk.
    
    Implementations must:
    - Assess risk as a float (0.0 = low risk, 1.0 = high risk)
    - Provide confidence in the assessment
    - Explain the risk factors
    - Be deterministic (same inputs = same output)
    
    Current implementation: Rule-based (see rules/dropout_rules.py)
    Future implementation: Can be ML-based without interface changes
    
    ⚠️ Phase 6 Constraint:
    This assessor provides ADVISORY output only.
    It does NOT trigger any automatic intervention.
    
    Example usage:
        >>> assessor = RuleBasedDropoutRiskAssessor()
        >>> result = assessor.assess(
        ...     user_id=uuid4(),
        ...     events=event_list,
        ...     last_activity=datetime.now() - timedelta(days=5)
        ... )
        >>> print(result.value)  # 0.65 (moderate-high risk)
        >>> print(result.explanation)  # "Risk elevated due to..."
    """
    
    @abstractmethod
    def assess(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        last_activity: Optional[datetime] = None,
        historical_pattern: Optional[dict] = None
    ) -> EstimatorResult[float]:
        """
        Assess dropout risk for a specific learner.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            last_activity: When the learner was last active
            historical_pattern: Optional historical engagement pattern
            
        Returns:
            EstimatorResult with:
            - value: Risk score (0.0 = low risk, 1.0 = high risk)
            - confidence: How confident we are in this assessment
            - explanation: Why we assess this risk level
            - factors: Contributing factors (inactivity_days, abandonment_rate, etc.)
        """
        pass
    
    @abstractmethod
    def get_risk_factors(
        self,
        user_id: UUID,
        events: list[LearningEventData]
    ) -> dict[str, float]:
        """
        Get individual risk factors and their contributions.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            
        Returns:
            Dictionary of risk factors and their weights
            Example: {"inactivity": 0.3, "abandonment_rate": 0.25, "declining_pace": 0.15}
        """
        pass
    
    @abstractmethod
    def get_risk_trend(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        period_days: int = 7
    ) -> list[EstimatorResult[float]]:
        """
        Get risk trend over time.
        
        Args:
            user_id: The learner's ID
            events: Learning events to analyze
            period_days: Number of days per period
            
        Returns:
            List of EstimatorResults, one per period (oldest first)
        """
        pass
    
    def categorize_risk(self, score: float) -> str:
        """
        Categorize risk level.
        
        Args:
            score: Risk score (0.0 to 1.0)
            
        Returns:
            Risk category string
        """
        if score < 0.2:
            return 'very_low'
        elif score < 0.4:
            return 'low'
        elif score < 0.6:
            return 'moderate'
        elif score < 0.8:
            return 'high'
        else:
            return 'critical'
    
    def needs_attention(self, score: float, threshold: float = 0.6) -> bool:
        """
        Check if risk level needs attention.
        
        Args:
            score: Risk score
            threshold: Threshold for attention
            
        Returns:
            True if risk is above threshold
        """
        return score >= threshold
