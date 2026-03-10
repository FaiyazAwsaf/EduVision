"""
Rule-Based Dropout Risk Assessor.

Assesses dropout risk using deterministic rules based on:
- Days since last activity
- Abandonment rate
- Declining engagement
- Session pattern changes

⚠️ This is a RULE-BASED implementation.
⚠️ ADVISORY ONLY - no automatic intervention.
⚠️ Can be swapped for ML implementation without interface changes.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from ..interfaces.base import EstimatorConfig, EstimatorResult
from ..interfaces.dropout_risk_assessor import DropoutRiskAssessor
from ..domain.events import LearningEventData
from ..domain.enums import EventType


class RuleBasedDropoutRiskAssessor(DropoutRiskAssessor):
    """
    Rule-based implementation of dropout risk assessment.
    
    Rules:
    1. More days inactive → higher risk
    2. Higher abandonment rate → higher risk
    3. Declining session frequency → higher risk
    4. Decreasing completion rate → higher risk
    
    ⚠️ This assessor provides ADVISORY output only.
    ⚠️ It does NOT trigger any automatic intervention.
    """
    
    def _default_config(self) -> EstimatorConfig:
        """Default configuration with risk thresholds."""
        return EstimatorConfig(
            name="RuleBased Dropout Risk Assessor",
            version="1.0.0",
            parameters={
                # Days of inactivity thresholds
                "inactivity_low_risk_days": 3,
                "inactivity_medium_risk_days": 7,
                "inactivity_high_risk_days": 14,
                # Weight for inactivity factor
                "inactivity_weight": 0.40,
                # Weight for abandonment factor
                "abandonment_weight": 0.30,
                # Weight for trend factor
                "trend_weight": 0.30,
                # Abandonment threshold (starts/completions ratio)
                "abandonment_concern_threshold": 0.5,
                # Minimum events for confident assessment
                "min_events_for_confidence": 5,
                # Trend analysis window (days)
                "trend_window_days": 14,
            },
            fallback_value=0.5,  # Moderate risk as fallback
        )
    
    def assess(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        last_activity: Optional[datetime] = None,
        historical_pattern: Optional[dict] = None
    ) -> EstimatorResult[float]:
        """
        Assess dropout risk based on learning events.
        """
        if not events:
            return self._fallback_result("No events to analyze")
        
        # Determine last activity
        if last_activity is None:
            last_activity = max(e.timestamp for e in events)
        
        # Calculate individual risk factors
        inactivity_factor = self._calculate_inactivity_factor(last_activity)
        abandonment_factor = self._calculate_abandonment_factor(events)
        trend_factor = self._calculate_trend_factor(events)
        
        # Get weights
        inactivity_weight = self.config.get_param("inactivity_weight", 0.40)
        abandonment_weight = self.config.get_param("abandonment_weight", 0.30)
        trend_weight = self.config.get_param("trend_weight", 0.30)
        
        # Calculate weighted risk score
        risk_score = (
            inactivity_factor * inactivity_weight +
            abandonment_factor * abandonment_weight +
            trend_factor * trend_weight
        )
        
        risk_score = max(0.0, min(1.0, risk_score))
        
        # Calculate confidence
        min_events = self.config.get_param("min_events_for_confidence", 5)
        confidence = min(1.0, len(events) / max(min_events, 1))
        
        # Build explanation
        explanation = self._build_explanation(
            inactivity_factor, abandonment_factor, trend_factor,
            risk_score, last_activity
        )
        
        return self._create_result(
            value=risk_score,
            confidence=confidence,
            explanation=explanation,
            factors={
                "inactivity_factor": inactivity_factor,
                "abandonment_factor": abandonment_factor,
                "trend_factor": trend_factor,
            },
            raw_inputs={
                "event_count": len(events),
                "days_since_activity": (datetime.now() - last_activity).days,
            }
        )
    
    def get_risk_factors(
        self,
        user_id: UUID,
        events: list[LearningEventData]
    ) -> dict[str, float]:
        """
        Get individual risk factors and their contributions.
        """
        if not events:
            return {}
        
        last_activity = max(e.timestamp for e in events)
        
        return {
            "inactivity": self._calculate_inactivity_factor(last_activity),
            "abandonment_rate": self._calculate_abandonment_factor(events),
            "declining_engagement": self._calculate_trend_factor(events),
        }
    
    def get_risk_trend(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        period_days: int = 7
    ) -> list[EstimatorResult[float]]:
        """
        Get risk trend over time.
        """
        if not events:
            return []
        
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        min_date = sorted_events[0].timestamp
        max_date = sorted_events[-1].timestamp
        
        results = []
        current_start = min_date
        
        while current_start <= max_date:
            current_end = current_start + timedelta(days=period_days)
            period_events = [
                e for e in sorted_events
                if e.timestamp < current_end
            ]
            
            if period_events:
                # Assess risk as of end of this period
                result = self.assess(
                    user_id=user_id,
                    events=period_events,
                    last_activity=min(current_end, max_date)
                )
                results.append(result)
            
            current_start = current_end
        
        return results
    
    def _calculate_inactivity_factor(self, last_activity: datetime) -> float:
        """
        Calculate risk factor from inactivity duration.
        
        More days inactive → higher risk factor.
        """
        days_inactive = (datetime.now(timezone.utc) - last_activity).days
        
        low_threshold = self.config.get_param("inactivity_low_risk_days", 3)
        medium_threshold = self.config.get_param("inactivity_medium_risk_days", 7)
        high_threshold = self.config.get_param("inactivity_high_risk_days", 14)
        
        if days_inactive <= low_threshold:
            return 0.0
        elif days_inactive <= medium_threshold:
            # Linear interpolation between low and medium
            progress = (days_inactive - low_threshold) / (medium_threshold - low_threshold)
            return 0.3 * progress
        elif days_inactive <= high_threshold:
            # Linear interpolation between medium and high
            progress = (days_inactive - medium_threshold) / (high_threshold - medium_threshold)
            return 0.3 + 0.4 * progress
        else:
            # Beyond high threshold
            extra_days = days_inactive - high_threshold
            return min(1.0, 0.7 + 0.3 * (extra_days / 7))
    
    def _calculate_abandonment_factor(self, events: list[LearningEventData]) -> float:
        """
        Calculate risk factor from abandonment rate.
        
        Higher ratio of starts to completions → higher risk.
        """
        starts = sum(1 for e in events if e.event_type == EventType.CONTENT_STARTED)
        completions = sum(1 for e in events if e.event_type == EventType.CONTENT_COMPLETED)
        abandonments = sum(1 for e in events if e.event_type == EventType.CONTENT_ABANDONED)
        
        if starts == 0:
            return 0.0  # No data
        
        completion_rate = completions / starts
        
        # Also factor in explicit abandonments
        abandonment_rate = abandonments / starts if starts > 0 else 0
        
        # Combine: low completion and high abandonment = high risk
        risk = (1 - completion_rate) * 0.6 + abandonment_rate * 0.4
        
        return max(0.0, min(1.0, risk))
    
    def _calculate_trend_factor(self, events: list[LearningEventData]) -> float:
        """
        Calculate risk factor from engagement trend.
        
        Declining engagement → higher risk.
        """
        if len(events) < 2:
            return 0.5  # Neutral if insufficient data
        
        trend_window = self.config.get_param("trend_window_days", 14)
        now = datetime.now(timezone.utc)
        
        # Split events into two halves of the trend window
        midpoint = now - timedelta(days=trend_window // 2)
        cutoff = now - timedelta(days=trend_window)
        
        first_half = [e for e in events if cutoff <= e.timestamp < midpoint]
        second_half = [e for e in events if midpoint <= e.timestamp <= now]
        
        # Count activities in each half
        first_count = len(first_half)
        second_count = len(second_half)
        
        if first_count == 0 and second_count == 0:
            return 0.5  # No recent activity
        elif first_count == 0:
            return 0.0  # Activity only recently started (good sign)
        elif second_count == 0:
            return 0.8  # Activity dropped off (concerning)
        
        # Calculate trend
        ratio = second_count / first_count
        
        if ratio >= 1.0:
            return 0.0  # Stable or increasing (low risk)
        elif ratio >= 0.5:
            return 0.3  # Slight decline (moderate risk)
        else:
            return 0.6 + 0.4 * (1 - ratio * 2)  # Significant decline (high risk)
    
    def _build_explanation(
        self,
        inactivity_factor: float,
        abandonment_factor: float,
        trend_factor: float,
        risk_score: float,
        last_activity: datetime
    ) -> str:
        """Build human-readable explanation."""
        category = self.categorize_risk(risk_score)
        days_inactive = (datetime.now(timezone.utc) - last_activity).days
        
        parts = [f"{category.replace('_', ' ').title()} dropout risk"]
        
        concerns = []
        if inactivity_factor > 0.5:
            concerns.append(f"{days_inactive} days inactive")
        if abandonment_factor > 0.5:
            concerns.append("high content abandonment rate")
        if trend_factor > 0.5:
            concerns.append("declining engagement trend")
        
        if concerns:
            parts.append(f": {', '.join(concerns)}")
        else:
            parts.append(": no significant concerns identified")
        
        return "".join(parts) + "."
