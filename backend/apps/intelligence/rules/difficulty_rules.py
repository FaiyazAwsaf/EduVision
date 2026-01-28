"""
Rule-Based Difficulty Estimator.

Estimates topic difficulty using deterministic rules based on:
- Retry frequency
- Time spent on topic
- Completion rate
- Content regeneration requests

⚠️ This is a RULE-BASED implementation.
⚠️ Can be swapped for ML implementation without interface changes.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from ..interfaces.base import EstimatorConfig, EstimatorResult
from ..interfaces.difficulty_estimator import DifficultyEstimator
from ..domain.events import LearningEventData
from ..domain.enums import EventType


class RuleBasedDifficultyEstimator(DifficultyEstimator):
    """
    Rule-based implementation of difficulty estimation.
    
    Rules:
    1. High retry count → higher difficulty
    2. Long time per completion → higher difficulty
    3. Low completion rate → higher difficulty
    4. Content regeneration requests → higher difficulty
    
    All weights are configurable.
    """
    
    def _default_config(self) -> EstimatorConfig:
        """Default configuration with rule weights."""
        return EstimatorConfig(
            name="RuleBased Difficulty Estimator",
            version="1.0.0",
            parameters={
                # Weight for retry factor (0.0 to 1.0)
                "retry_weight": 0.35,
                # Weight for time factor
                "time_weight": 0.25,
                # Weight for completion factor
                "completion_weight": 0.25,
                # Weight for regeneration factor
                "regeneration_weight": 0.15,
                # Baseline expected time per topic (seconds)
                "expected_time_seconds": 1800,  # 30 minutes
                # Maximum retries before max difficulty
                "max_retries_threshold": 5,
                # Minimum events needed for confident estimate
                "min_events_for_confidence": 3,
            },
            fallback_value=0.5,  # Moderate difficulty as fallback
        )
    
    def estimate(
        self,
        user_id: UUID,
        topic: str,
        events: list[LearningEventData],
        baseline_difficulty: Optional[float] = None
    ) -> EstimatorResult[float]:
        """
        Estimate difficulty based on learning events.
        
        Applies weighted combination of rule-derived factors.
        """
        # Filter events for this topic
        topic_events = [e for e in events if e.topic == topic]
        
        if not topic_events:
            return self._fallback_result(f"No events found for topic: {topic}")
        
        # Calculate individual factors
        retry_factor = self._calculate_retry_factor(topic_events)
        time_factor = self._calculate_time_factor(topic_events)
        completion_factor = self._calculate_completion_factor(topic_events)
        regeneration_factor = self._calculate_regeneration_factor(topic_events)
        
        # Get weights from config
        retry_weight = self.config.get_param("retry_weight", 0.35)
        time_weight = self.config.get_param("time_weight", 0.25)
        completion_weight = self.config.get_param("completion_weight", 0.25)
        regeneration_weight = self.config.get_param("regeneration_weight", 0.15)
        
        # Calculate weighted difficulty score
        difficulty = (
            retry_factor * retry_weight +
            time_factor * time_weight +
            completion_factor * completion_weight +
            regeneration_factor * regeneration_weight
        )
        
        # Apply baseline adjustment if provided
        if baseline_difficulty is not None:
            # Blend with baseline (30% baseline, 70% computed)
            difficulty = baseline_difficulty * 0.3 + difficulty * 0.7
        
        # Ensure in valid range
        difficulty = max(0.0, min(1.0, difficulty))
        
        # Calculate confidence based on event count
        min_events = self.config.get_param("min_events_for_confidence", 3)
        confidence = min(1.0, len(topic_events) / max(min_events, 1))
        
        # Build explanation
        explanation = self._build_explanation(
            retry_factor, time_factor, completion_factor, 
            regeneration_factor, difficulty
        )
        
        return self._create_result(
            value=difficulty,
            confidence=confidence,
            explanation=explanation,
            factors={
                "retry_factor": retry_factor,
                "time_factor": time_factor,
                "completion_factor": completion_factor,
                "regeneration_factor": regeneration_factor,
            },
            raw_inputs={
                "topic": topic,
                "event_count": len(topic_events),
                "baseline_difficulty": baseline_difficulty,
            }
        )
    
    def estimate_batch(
        self,
        user_id: UUID,
        topics: list[str],
        events: list[LearningEventData]
    ) -> dict[str, EstimatorResult[float]]:
        """Estimate difficulty for multiple topics."""
        results = {}
        for topic in topics:
            results[topic] = self.estimate(user_id, topic, events)
        return results
    
    def _calculate_retry_factor(self, events: list[LearningEventData]) -> float:
        """
        Calculate difficulty factor from retries.
        
        More retries → higher difficulty factor.
        """
        retry_count = sum(
            1 for e in events 
            if e.event_type == EventType.TOPIC_RETRIED
        )
        max_threshold = self.config.get_param("max_retries_threshold", 5)
        
        # Normalize to 0-1 range
        return min(1.0, retry_count / max_threshold)
    
    def _calculate_time_factor(self, events: list[LearningEventData]) -> float:
        """
        Calculate difficulty factor from time spent.
        
        More time than expected → higher difficulty factor.
        """
        total_time = sum(
            e.duration_seconds or 0
            for e in events
            if e.event_type in (EventType.CONTENT_COMPLETED, EventType.CONTENT_STARTED)
        )
        
        expected_time = self.config.get_param("expected_time_seconds", 1800)
        
        if total_time == 0:
            return 0.5  # Neutral if no time data
        
        # Ratio of actual to expected time
        ratio = total_time / expected_time
        
        # Normalize: 1.0 expected = 0.5 difficulty
        # >2x expected = 1.0 difficulty
        # <0.5x expected = 0.0 difficulty
        if ratio <= 0.5:
            return 0.0
        elif ratio >= 2.0:
            return 1.0
        else:
            return (ratio - 0.5) / 1.5
    
    def _calculate_completion_factor(self, events: list[LearningEventData]) -> float:
        """
        Calculate difficulty factor from completion rate.
        
        Lower completion rate → higher difficulty factor.
        """
        starts = sum(1 for e in events if e.event_type == EventType.CONTENT_STARTED)
        completions = sum(1 for e in events if e.event_type == EventType.CONTENT_COMPLETED)
        
        if starts == 0:
            return 0.5  # Neutral if no data
        
        completion_rate = completions / starts
        
        # Invert: high completion = low difficulty
        return 1.0 - completion_rate
    
    def _calculate_regeneration_factor(self, events: list[LearningEventData]) -> float:
        """
        Calculate difficulty factor from content regeneration.
        
        More regenerations → content might be unclear → higher difficulty.
        """
        regenerations = sum(
            1 for e in events 
            if e.event_type == EventType.CONTENT_REGENERATED
        )
        
        # 0 regenerations = 0.0, 3+ = 1.0
        return min(1.0, regenerations / 3.0)
    
    def _build_explanation(
        self,
        retry_factor: float,
        time_factor: float,
        completion_factor: float,
        regeneration_factor: float,
        final_difficulty: float
    ) -> str:
        """Build human-readable explanation of the difficulty assessment."""
        parts = []
        
        # Identify dominant factors
        factors = [
            ("retries", retry_factor),
            ("time spent", time_factor),
            ("incomplete attempts", completion_factor),
            ("content regenerations", regeneration_factor),
        ]
        
        # Sort by contribution
        factors.sort(key=lambda x: x[1], reverse=True)
        
        # Build explanation
        if final_difficulty < 0.3:
            parts.append("Low difficulty indicated by")
        elif final_difficulty < 0.7:
            parts.append("Moderate difficulty indicated by")
        else:
            parts.append("High difficulty indicated by")
        
        # Add top contributing factors
        significant_factors = [f for f in factors if f[1] > 0.3]
        if significant_factors:
            factor_strs = [f"{f[0]} ({f[1]:.0%})" for f in significant_factors[:2]]
            parts.append(", ".join(factor_strs))
        else:
            parts.append("balanced factors")
        
        return " ".join(parts) + "."
