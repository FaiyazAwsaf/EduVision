"""
Enums for Phase 6: Intelligence & Adaptive Optimization.

All enums are designed for:
- Deterministic behavior
- Clear semantics
- Extensibility (new values can be added without breaking existing code)
"""

from enum import Enum


class EventType(str, Enum):
    """
    Types of learning events that can be consumed.
    
    Events are immutable facts, not commands.
    Each event represents something that HAS happened.
    """
    # Content lifecycle events
    CONTENT_STARTED = 'content_started'
    CONTENT_COMPLETED = 'content_completed'
    CONTENT_ABANDONED = 'content_abandoned'
    CONTENT_REGENERATED = 'content_regenerated'
    
    # Topic interaction events
    TOPIC_VIEWED = 'topic_viewed'
    TOPIC_RETRIED = 'topic_retried'
    TOPIC_MASTERED = 'topic_mastered'
    
    # Plan interaction events
    PLAN_VIEWED = 'plan_viewed'
    PLAN_ITEM_STARTED = 'plan_item_started'
    PLAN_ITEM_COMPLETED = 'plan_item_completed'
    PLAN_ITEM_SKIPPED = 'plan_item_skipped'
    
    # Session events
    SESSION_STARTED = 'session_started'
    SESSION_ENDED = 'session_ended'
    
    # Feedback events
    FEEDBACK_SUBMITTED = 'feedback_submitted'

    # Evaluation pipeline events (Phase 7)
    SCRIPT_SUBMITTED = 'script_submitted'
    SCRIPT_EVALUATED = 'script_evaluated'
    CONTENT_GENERATED = 'content_generated'
    CONTENT_VIEWED = 'content_viewed'
    SESSION_JOINED = 'session_joined'

    @classmethod
    def content_events(cls) -> list['EventType']:
        """Events related to content interaction."""
        return [
            cls.CONTENT_STARTED,
            cls.CONTENT_COMPLETED,
            cls.CONTENT_ABANDONED,
            cls.CONTENT_REGENERATED,
        ]
    
    @classmethod
    def topic_events(cls) -> list['EventType']:
        """Events related to topic interaction."""
        return [
            cls.TOPIC_VIEWED,
            cls.TOPIC_RETRIED,
            cls.TOPIC_MASTERED,
        ]
    
    @classmethod
    def plan_events(cls) -> list['EventType']:
        """Events related to study plan interaction."""
        return [
            cls.PLAN_VIEWED,
            cls.PLAN_ITEM_STARTED,
            cls.PLAN_ITEM_COMPLETED,
            cls.PLAN_ITEM_SKIPPED,
        ]


class InsightType(str, Enum):
    """
    Types of learner insights that can be computed.
    
    Insights are derived observations, not predictions.
    Each insight represents an OBSERVED pattern.
    """
    # Topic-level insights
    TOPIC_DIFFICULTY = 'topic_difficulty'
    TOPIC_MASTERY = 'topic_mastery'
    TOPIC_STRUGGLE = 'topic_struggle'
    
    # Pace insights
    LEARNING_PACE = 'learning_pace'
    COMPLETION_RATE = 'completion_rate'
    
    # Behavior insights
    RETRY_FREQUENCY = 'retry_frequency'
    CONSISTENCY_SCORE = 'consistency_score'
    ENGAGEMENT_LEVEL = 'engagement_level'
    
    # Aggregate insights
    WEAK_TOPICS = 'weak_topics'
    STRONG_TOPICS = 'strong_topics'
    LEARNING_PATTERN = 'learning_pattern'


class RecommendationType(str, Enum):
    """
    Types of recommendations that can be generated.
    
    Recommendations are ADVISORY ONLY - they suggest actions
    but NEVER automatically apply them.
    
    ⚠️ Phase 6 MUST NOT act on these recommendations.
    External systems MAY choose to act on them.
    """
    # Review recommendations
    RECOMMEND_REVIEW = 'recommend_review'
    RECOMMEND_RETRY = 'recommend_retry'
    RECOMMEND_REINFORCE = 'recommend_reinforce'
    
    # Pace recommendations
    RECOMMEND_SLOW_DOWN = 'recommend_slow_down'
    RECOMMEND_SPEED_UP = 'recommend_speed_up'
    RECOMMEND_BREAK = 'recommend_break'
    
    # Order recommendations (advisory only)
    RECOMMEND_REORDER = 'recommend_reorder'
    RECOMMEND_PRIORITIZE = 'recommend_prioritize'
    RECOMMEND_DEFER = 'recommend_defer'
    
    # Content recommendations
    RECOMMEND_SIMPLIFY = 'recommend_simplify'
    RECOMMEND_ELABORATE = 'recommend_elaborate'
    RECOMMEND_ALTERNATIVE = 'recommend_alternative'
    
    # General recommendations
    RECOMMEND_FOCUS = 'recommend_focus'
    RECOMMEND_PRACTICE = 'recommend_practice'


class ConfidenceLevel(str, Enum):
    """
    Confidence levels for recommendations.
    
    Based on rule-derived scores, NOT probabilistic inference.
    The numeric ranges are configurable thresholds.
    """
    VERY_LOW = 'very_low'      # 0.0 - 0.2
    LOW = 'low'                 # 0.2 - 0.4
    MEDIUM = 'medium'           # 0.4 - 0.6
    HIGH = 'high'               # 0.6 - 0.8
    VERY_HIGH = 'very_high'     # 0.8 - 1.0
    
    @classmethod
    def from_score(cls, score: float) -> 'ConfidenceLevel':
        """
        Convert a numeric confidence score to a level.
        
        Args:
            score: A value between 0.0 and 1.0
            
        Returns:
            The corresponding confidence level
        """
        if score < 0.2:
            return cls.VERY_LOW
        elif score < 0.4:
            return cls.LOW
        elif score < 0.6:
            return cls.MEDIUM
        elif score < 0.8:
            return cls.HIGH
        else:
            return cls.VERY_HIGH


class LearningPace(str, Enum):
    """
    Categorization of learner pace.
    
    Derived from observable metrics, not predictions.
    """
    VERY_SLOW = 'very_slow'
    SLOW = 'slow'
    MODERATE = 'moderate'
    FAST = 'fast'
    VERY_FAST = 'very_fast'
    
    @classmethod
    def from_percentile(cls, percentile: float) -> 'LearningPace':
        """
        Convert a pace percentile to a category.
        
        Args:
            percentile: A value between 0.0 and 1.0 representing
                       where the learner falls relative to baseline
                       
        Returns:
            The corresponding pace category
        """
        if percentile < 0.2:
            return cls.VERY_SLOW
        elif percentile < 0.4:
            return cls.SLOW
        elif percentile < 0.6:
            return cls.MODERATE
        elif percentile < 0.8:
            return cls.FAST
        else:
            return cls.VERY_FAST


class TopicDifficulty(str, Enum):
    """
    Categorization of topic difficulty for a learner.
    
    This is PERSONALIZED difficulty based on observed behavior,
    not inherent topic complexity.
    """
    VERY_EASY = 'very_easy'
    EASY = 'easy'
    MODERATE = 'moderate'
    HARD = 'hard'
    VERY_HARD = 'very_hard'
    
    @classmethod
    def from_score(cls, score: float) -> 'TopicDifficulty':
        """
        Convert a difficulty score to a category.
        
        Args:
            score: A value between 0.0 (easiest) and 1.0 (hardest)
            
        Returns:
            The corresponding difficulty category
        """
        if score < 0.2:
            return cls.VERY_EASY
        elif score < 0.4:
            return cls.EASY
        elif score < 0.6:
            return cls.MODERATE
        elif score < 0.8:
            return cls.HARD
        else:
            return cls.VERY_HARD
