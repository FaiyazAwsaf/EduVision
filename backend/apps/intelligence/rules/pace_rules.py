"""
Rule-Based Pace Evaluator.

Evaluates learning pace using deterministic rules based on:
- Content completion rate
- Time per topic
- Session frequency
- Progress velocity

⚠️ This is a RULE-BASED implementation.
⚠️ Can be swapped for ML implementation without interface changes.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from ..interfaces.base import EstimatorConfig, EstimatorResult
from ..interfaces.pace_evaluator import PaceEvaluator
from ..domain.events import LearningEventData
from ..domain.enums import EventType


class RuleBasedPaceEvaluator(PaceEvaluator):
    """
    Rule-based implementation of pace evaluation.
    
    Rules:
    1. Higher completion rate → faster pace
    2. Shorter time per topic → faster pace
    3. More frequent sessions → faster pace
    4. Steady progress → moderate pace
    
    Pace is normalized to 0.0-1.0 where 0.5 is "expected" pace.
    """
    
    def _default_config(self) -> EstimatorConfig:
        """Default configuration with rule parameters."""
        return EstimatorConfig(
            name="RuleBased Pace Evaluator",
            version="1.0.0",
            parameters={
                # Expected completions per week
                "expected_completions_per_week": 5,
                # Expected time per topic (seconds)
                "expected_time_per_topic": 1800,  # 30 min
                # Expected sessions per week
                "expected_sessions_per_week": 3,
                # Weight for completion rate factor
                "completion_rate_weight": 0.35,
                # Weight for time factor
                "time_factor_weight": 0.35,
                # Weight for session frequency
                "session_frequency_weight": 0.30,
                # Default time window (days)
                "default_time_window_days": 14,
                # Minimum events for confident evaluation
                "min_events_for_confidence": 5,
            },
            fallback_value=0.5,  # Moderate pace as fallback
        )
    
    def evaluate(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        time_window: Optional[timedelta] = None,
        expected_pace: Optional[float] = None
    ) -> EstimatorResult[float]:
        """
        Evaluate learning pace based on events.
        """
        # Apply time window filter
        window_days = self.config.get_param("default_time_window_days", 14)
        if time_window is None:
            time_window = timedelta(days=window_days)
        
        cutoff = datetime.now() - time_window
        filtered_events = [e for e in events if e.timestamp >= cutoff]
        
        if not filtered_events:
            return self._fallback_result("No events in time window")
        
        # Calculate factors
        completion_factor = self._calculate_completion_factor(filtered_events, time_window)
        time_factor = self._calculate_time_factor(filtered_events)
        session_factor = self._calculate_session_factor(filtered_events, time_window)
        
        # Get weights
        comp_weight = self.config.get_param("completion_rate_weight", 0.35)
        time_weight = self.config.get_param("time_factor_weight", 0.35)
        session_weight = self.config.get_param("session_frequency_weight", 0.30)
        
        # Calculate weighted pace score
        pace_score = (
            completion_factor * comp_weight +
            time_factor * time_weight +
            session_factor * session_weight
        )
        
        # Apply expected pace adjustment if provided
        if expected_pace is not None:
            # Score relative to expectation
            deviation = pace_score - expected_pace
            pace_score = 0.5 + deviation  # Center around 0.5
        
        pace_score = max(0.0, min(1.0, pace_score))
        
        # Calculate confidence
        min_events = self.config.get_param("min_events_for_confidence", 5)
        confidence = min(1.0, len(filtered_events) / max(min_events, 1))
        
        # Build explanation
        explanation = self._build_explanation(
            completion_factor, time_factor, session_factor, pace_score
        )
        
        return self._create_result(
            value=pace_score,
            confidence=confidence,
            explanation=explanation,
            factors={
                "completion_factor": completion_factor,
                "time_factor": time_factor,
                "session_factor": session_factor,
            },
            raw_inputs={
                "event_count": len(filtered_events),
                "time_window_days": time_window.days,
            }
        )
    
    def evaluate_for_topic(
        self,
        user_id: UUID,
        topic: str,
        events: list[LearningEventData],
        expected_duration: Optional[int] = None
    ) -> EstimatorResult[float]:
        """
        Evaluate pace for a specific topic.
        """
        topic_events = [e for e in events if e.topic == topic]
        
        if not topic_events:
            return self._fallback_result(f"No events for topic: {topic}")
        
        # Calculate time spent on this topic
        total_time = sum(e.duration_seconds or 0 for e in topic_events)
        
        if expected_duration is None:
            expected_duration = self.config.get_param("expected_time_per_topic", 1800)
        
        # Calculate pace as ratio (faster = higher score)
        if total_time == 0:
            pace_score = 0.5
        else:
            ratio = expected_duration / total_time
            # Normalize: 1.0 ratio = 0.5 score
            pace_score = max(0.0, min(1.0, ratio / 2))
        
        # Calculate confidence based on event count
        confidence = min(1.0, len(topic_events) / 3)
        
        if pace_score > 0.7:
            explanation = f"Fast pace on {topic}: completed in less time than expected"
        elif pace_score < 0.3:
            explanation = f"Slow pace on {topic}: taking more time than expected"
        else:
            explanation = f"Moderate pace on {topic}: aligned with expectations"
        
        return self._create_result(
            value=pace_score,
            confidence=confidence,
            explanation=explanation,
            factors={
                "time_ratio": expected_duration / max(total_time, 1),
            },
            raw_inputs={
                "topic": topic,
                "total_time_seconds": total_time,
                "expected_duration": expected_duration,
            }
        )
    
    def get_pace_trend(
        self,
        user_id: UUID,
        events: list[LearningEventData],
        period_days: int = 7
    ) -> list[EstimatorResult[float]]:
        """
        Get pace trend over time.
        """
        if not events:
            return []
        
        # Sort events by timestamp
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        
        # Find date range
        min_date = sorted_events[0].timestamp
        max_date = sorted_events[-1].timestamp
        
        results = []
        current_start = min_date
        
        while current_start < max_date:
            current_end = current_start + timedelta(days=period_days)
            period_events = [
                e for e in sorted_events
                if current_start <= e.timestamp < current_end
            ]
            
            if period_events:
                result = self.evaluate(
                    user_id=user_id,
                    events=period_events,
                    time_window=timedelta(days=period_days)
                )
                results.append(result)
            
            current_start = current_end
        
        return results
    
    def _calculate_completion_factor(
        self, 
        events: list[LearningEventData],
        time_window: timedelta
    ) -> float:
        """Calculate pace factor from completion rate."""
        completions = sum(
            1 for e in events 
            if e.event_type == EventType.CONTENT_COMPLETED
        )
        
        weeks = max(1, time_window.days / 7)
        completions_per_week = completions / weeks
        
        expected = self.config.get_param("expected_completions_per_week", 5)
        
        # Normalize to 0-1 range
        ratio = completions_per_week / expected
        return max(0.0, min(1.0, ratio))
    
    def _calculate_time_factor(self, events: list[LearningEventData]) -> float:
        """Calculate pace factor from time per topic."""
        completed_events = [
            e for e in events 
            if e.event_type == EventType.CONTENT_COMPLETED and e.duration_seconds
        ]
        
        if not completed_events:
            return 0.5  # Neutral
        
        avg_time = sum(e.duration_seconds for e in completed_events) / len(completed_events)
        expected_time = self.config.get_param("expected_time_per_topic", 1800)
        
        # Faster = higher score (inverted ratio)
        ratio = expected_time / max(avg_time, 1)
        return max(0.0, min(1.0, ratio))
    
    def _calculate_session_factor(
        self, 
        events: list[LearningEventData],
        time_window: timedelta
    ) -> float:
        """Calculate pace factor from session frequency."""
        # Count unique session IDs
        session_ids = {e.session_id for e in events if e.session_id}
        
        # If no session IDs, estimate from event clustering
        if not session_ids:
            # Count unique days as proxy for sessions
            unique_days = {e.timestamp.date() for e in events}
            session_count = len(unique_days)
        else:
            session_count = len(session_ids)
        
        weeks = max(1, time_window.days / 7)
        sessions_per_week = session_count / weeks
        
        expected = self.config.get_param("expected_sessions_per_week", 3)
        
        ratio = sessions_per_week / expected
        return max(0.0, min(1.0, ratio))
    
    def _build_explanation(
        self,
        completion_factor: float,
        time_factor: float,
        session_factor: float,
        pace_score: float
    ) -> str:
        """Build human-readable explanation."""
        if pace_score >= 0.7:
            pace_desc = "Fast learning pace"
        elif pace_score >= 0.4:
            pace_desc = "Moderate learning pace"
        else:
            pace_desc = "Slow learning pace"
        
        factors = []
        if completion_factor >= 0.7:
            factors.append("high completion rate")
        elif completion_factor <= 0.3:
            factors.append("low completion rate")
        
        if time_factor >= 0.7:
            factors.append("quick topic completion")
        elif time_factor <= 0.3:
            factors.append("extended time on topics")
        
        if session_factor >= 0.7:
            factors.append("frequent sessions")
        elif session_factor <= 0.3:
            factors.append("infrequent sessions")
        
        if factors:
            return f"{pace_desc}: {', '.join(factors)}."
        else:
            return f"{pace_desc}: balanced factors across all metrics."
