"""
Learner Insight data structures for Phase 6.

Insights are DERIVED OBSERVATIONS based on event analysis.
They represent patterns that HAVE BEEN observed, not predictions.

Design principles:
- Insights are computed from events
- Insights are deterministic (same events = same insights)
- Insights are explainable (traceable to source events)
- Insights can be recomputed at any time
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from .enums import (
    InsightType,
    LearningPace,
    TopicDifficulty,
    ConfidenceLevel,
)


@dataclass(frozen=True)
class TopicMetrics:
    """
    Computed metrics for a specific topic and learner.
    
    All values are derived from observed events using
    deterministic rule-based computation.
    
    Attributes:
        topic: The topic these metrics are for
        difficulty_score: 0.0 (easy) to 1.0 (hard), based on retry/time patterns
        mastery_score: 0.0 (no mastery) to 1.0 (full mastery), based on completions
        retry_count: Number of times topic was retried
        total_time_seconds: Total time spent on this topic
        completion_count: Number of successful completions
        last_interaction: When the learner last interacted with this topic
        
    Example:
        >>> metrics = TopicMetrics(
        ...     topic="Python Decorators",
        ...     difficulty_score=0.75,
        ...     mastery_score=0.4,
        ...     retry_count=3,
        ...     total_time_seconds=5400,
        ...     completion_count=1,
        ...     last_interaction=datetime.now()
        ... )
        >>> metrics.difficulty_level
        TopicDifficulty.HARD
    """
    topic: str
    difficulty_score: float  # 0.0 to 1.0
    mastery_score: float  # 0.0 to 1.0
    retry_count: int
    total_time_seconds: int
    completion_count: int
    last_interaction: datetime
    
    def __post_init__(self):
        """Validate metric values."""
        if not 0.0 <= self.difficulty_score <= 1.0:
            raise ValueError(f"difficulty_score must be between 0.0 and 1.0, got {self.difficulty_score}")
        if not 0.0 <= self.mastery_score <= 1.0:
            raise ValueError(f"mastery_score must be between 0.0 and 1.0, got {self.mastery_score}")
        if self.retry_count < 0:
            raise ValueError("retry_count cannot be negative")
        if self.total_time_seconds < 0:
            raise ValueError("total_time_seconds cannot be negative")
        if self.completion_count < 0:
            raise ValueError("completion_count cannot be negative")
    
    @property
    def difficulty_level(self) -> TopicDifficulty:
        """Get the categorical difficulty level."""
        return TopicDifficulty.from_score(self.difficulty_score)
    
    @property
    def is_struggling(self) -> bool:
        """
        Determine if the learner is struggling with this topic.
        
        Rule-based: high difficulty + low mastery + multiple retries
        """
        return (
            self.difficulty_score > 0.6 and
            self.mastery_score < 0.4 and
            self.retry_count >= 2
        )
    
    @property
    def is_mastered(self) -> bool:
        """
        Determine if the learner has mastered this topic.
        
        Rule-based: high mastery + low difficulty (for them)
        """
        return self.mastery_score >= 0.8 and self.difficulty_score < 0.4
    
    @property
    def average_time_per_attempt(self) -> float:
        """Average time spent per attempt in seconds."""
        total_attempts = self.completion_count + self.retry_count
        if total_attempts == 0:
            return 0.0
        return self.total_time_seconds / total_attempts
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'topic': self.topic,
            'difficulty_score': self.difficulty_score,
            'difficulty_level': self.difficulty_level.value,
            'mastery_score': self.mastery_score,
            'retry_count': self.retry_count,
            'total_time_seconds': self.total_time_seconds,
            'completion_count': self.completion_count,
            'last_interaction': self.last_interaction.isoformat(),
            'is_struggling': self.is_struggling,
            'is_mastered': self.is_mastered,
            'average_time_per_attempt': self.average_time_per_attempt,
        }


@dataclass
class LearnerInsightData:
    """
    Comprehensive insight profile for a learner.
    
    This aggregates all computed insights and metrics
    for a single learner at a point in time.
    
    Attributes:
        user_id: The learner this insight is for
        computed_at: When this insight was computed
        learning_pace: Overall pace categorization
        pace_score: Numeric pace score (0.0 to 1.0)
        consistency_score: How consistent the learner is (0.0 to 1.0)
        retry_frequency: Overall retry frequency score
        topic_metrics: Per-topic metrics
        weak_topics: Topics where learner struggles
        strong_topics: Topics where learner excels
        total_events_analyzed: Number of events used for computation
        computation_rules_version: Version of rules used
        
    Example:
        >>> insight = LearnerInsightData(
        ...     user_id=uuid4(),
        ...     computed_at=datetime.now(),
        ...     learning_pace=LearningPace.MODERATE,
        ...     pace_score=0.55,
        ...     consistency_score=0.72,
        ...     retry_frequency=0.25,
        ...     topic_metrics={"Python Decorators": topic_metrics},
        ...     weak_topics=["Metaclasses"],
        ...     strong_topics=["List Comprehensions"],
        ...     total_events_analyzed=150,
        ...     computation_rules_version="1.0.0"
        ... )
    """
    user_id: UUID
    computed_at: datetime
    learning_pace: LearningPace
    pace_score: float
    consistency_score: float
    retry_frequency: float
    topic_metrics: dict[str, TopicMetrics]
    weak_topics: list[str]
    strong_topics: list[str]
    total_events_analyzed: int
    computation_rules_version: str
    
    # Optional extended metrics (for future ML compatibility)
    extended_metrics: dict[str, Any] = field(default_factory=dict)
    
    @property
    def topic_count(self) -> int:
        """Number of topics the learner has interacted with."""
        return len(self.topic_metrics)
    
    @property
    def average_difficulty(self) -> float:
        """Average difficulty across all topics."""
        if not self.topic_metrics:
            return 0.0
        total = sum(m.difficulty_score for m in self.topic_metrics.values())
        return total / len(self.topic_metrics)
    
    @property
    def average_mastery(self) -> float:
        """Average mastery across all topics."""
        if not self.topic_metrics:
            return 0.0
        total = sum(m.mastery_score for m in self.topic_metrics.values())
        return total / len(self.topic_metrics)
    
    @property
    def overall_health_score(self) -> float:
        """
        Overall learning health score.
        
        Rule-based computation combining:
        - Consistency (weight: 0.3)
        - Mastery progress (weight: 0.4)
        - Pace appropriateness (weight: 0.3)
        
        Returns a value between 0.0 (concerning) and 1.0 (excellent).
        """
        # Consistency component
        consistency_component = self.consistency_score * 0.3
        
        # Mastery component
        mastery_component = self.average_mastery * 0.4
        
        # Pace component (moderate pace scores highest)
        pace_deviation = abs(self.pace_score - 0.5) * 2  # 0 at moderate, 1 at extremes
        pace_component = (1 - pace_deviation * 0.5) * 0.3
        
        return consistency_component + mastery_component + pace_component
    
    def get_topic_metrics(self, topic: str) -> Optional[TopicMetrics]:
        """Get metrics for a specific topic."""
        return self.topic_metrics.get(topic)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'user_id': str(self.user_id),
            'computed_at': self.computed_at.isoformat(),
            'learning_pace': self.learning_pace.value,
            'pace_score': self.pace_score,
            'consistency_score': self.consistency_score,
            'retry_frequency': self.retry_frequency,
            'topic_metrics': {
                topic: metrics.to_dict()
                for topic, metrics in self.topic_metrics.items()
            },
            'weak_topics': self.weak_topics,
            'strong_topics': self.strong_topics,
            'total_events_analyzed': self.total_events_analyzed,
            'computation_rules_version': self.computation_rules_version,
            'topic_count': self.topic_count,
            'average_difficulty': self.average_difficulty,
            'average_mastery': self.average_mastery,
            'overall_health_score': self.overall_health_score,
        }


@dataclass(frozen=True)
class InsightDelta:
    """
    Represents a change in insights over time.
    
    Useful for tracking learning progress and
    generating time-based recommendations.
    """
    user_id: UUID
    previous_insight: Optional[LearnerInsightData]
    current_insight: LearnerInsightData
    delta_period_days: int
    
    @property
    def pace_change(self) -> float:
        """Change in pace score."""
        if self.previous_insight is None:
            return 0.0
        return self.current_insight.pace_score - self.previous_insight.pace_score
    
    @property
    def consistency_change(self) -> float:
        """Change in consistency score."""
        if self.previous_insight is None:
            return 0.0
        return self.current_insight.consistency_score - self.previous_insight.consistency_score
    
    @property
    def mastery_change(self) -> float:
        """Change in average mastery."""
        if self.previous_insight is None:
            return 0.0
        return self.current_insight.average_mastery - self.previous_insight.average_mastery
    
    @property
    def new_weak_topics(self) -> list[str]:
        """Topics that became weak since last insight."""
        if self.previous_insight is None:
            return self.current_insight.weak_topics
        prev_weak = set(self.previous_insight.weak_topics)
        return [t for t in self.current_insight.weak_topics if t not in prev_weak]
    
    @property
    def new_strong_topics(self) -> list[str]:
        """Topics that became strong since last insight."""
        if self.previous_insight is None:
            return self.current_insight.strong_topics
        prev_strong = set(self.previous_insight.strong_topics)
        return [t for t in self.current_insight.strong_topics if t not in prev_strong]
    
    @property
    def is_improving(self) -> bool:
        """Overall improvement indicator."""
        return self.mastery_change > 0 and self.consistency_change >= 0
    
    @property
    def is_declining(self) -> bool:
        """Overall decline indicator."""
        return self.mastery_change < 0 or self.consistency_change < -0.1
