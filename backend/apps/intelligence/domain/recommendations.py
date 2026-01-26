"""
Recommendation data structures for Phase 6.

Recommendations are ADVISORY OUTPUTS ONLY.
They suggest actions but NEVER automatically apply them.

⚠️ CRITICAL CONSTRAINTS:
- Recommendations are suggestions, not commands
- Phase 6 MUST NOT act on recommendations
- External systems MAY choose to act on them
- Each recommendation must be fully justified

Design principles:
- Recommendations are traceable (linked to insights)
- Recommendations are explainable (human-readable justification)
- Recommendations include confidence (rule-derived)
- Recommendations are deterministic
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from .enums import RecommendationType, ConfidenceLevel


@dataclass(frozen=True)
class RecommendationData:
    """
    Immutable recommendation structure.
    
    This is an ADVISORY OUTPUT - it suggests an action
    but NEVER automatically applies it.
    
    Attributes:
        id: Unique identifier for this recommendation
        recommendation_type: Type of recommendation
        user_id: The learner this recommendation is for
        target_entity_type: Type of entity (topic/content/plan)
        target_entity_id: ID of the target entity (optional)
        target_entity_name: Human-readable name of target
        justification: Human-readable explanation
        confidence_score: Rule-derived confidence (0.0 to 1.0)
        priority: Priority level (1=highest, 5=lowest)
        created_at: When recommendation was generated
        expires_at: When recommendation should be reconsidered
        source_insight_id: ID of the insight that generated this
        metadata: Additional context
        
    Example:
        >>> rec = RecommendationData(
        ...     recommendation_type=RecommendationType.RECOMMEND_REVIEW,
        ...     user_id=uuid4(),
        ...     target_entity_type="topic",
        ...     target_entity_name="Python Decorators",
        ...     justification="Multiple retries (3) with high completion time (avg 45min). Consider reviewing fundamentals.",
        ...     confidence_score=0.81,
        ...     priority=2,
        ...     created_at=datetime.now()
        ... )
    """
    recommendation_type: RecommendationType
    user_id: UUID
    target_entity_type: str  # 'topic', 'content', 'plan', 'plan_item'
    target_entity_name: str
    justification: str
    confidence_score: float
    priority: int  # 1=highest, 5=lowest
    created_at: datetime
    id: UUID = field(default_factory=uuid4)
    target_entity_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None
    source_insight_id: Optional[UUID] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate recommendation data."""
        if not isinstance(self.recommendation_type, RecommendationType):
            raise ValueError(f"Invalid recommendation_type: {self.recommendation_type}")
        if not 0.0 <= self.confidence_score <= 1.0:
            raise ValueError(f"confidence_score must be between 0.0 and 1.0, got {self.confidence_score}")
        if not 1 <= self.priority <= 5:
            raise ValueError(f"priority must be between 1 and 5, got {self.priority}")
        if self.target_entity_type not in ('topic', 'content', 'plan', 'plan_item', 'session'):
            raise ValueError(f"Invalid target_entity_type: {self.target_entity_type}")
    
    @property
    def confidence_level(self) -> ConfidenceLevel:
        """Get the categorical confidence level."""
        return ConfidenceLevel.from_score(self.confidence_score)
    
    @property
    def is_high_confidence(self) -> bool:
        """Check if this is a high confidence recommendation."""
        return self.confidence_score >= 0.7
    
    @property
    def is_expired(self) -> bool:
        """Check if this recommendation has expired."""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at
    
    @property
    def is_actionable(self) -> bool:
        """
        Check if this recommendation should be shown.
        
        A recommendation is actionable if:
        - It's not expired
        - It has reasonable confidence
        """
        return not self.is_expired and self.confidence_score >= 0.3
    
    @property
    def action_category(self) -> str:
        """Categorize the type of action suggested."""
        review_types = {
            RecommendationType.RECOMMEND_REVIEW,
            RecommendationType.RECOMMEND_RETRY,
            RecommendationType.RECOMMEND_REINFORCE,
            RecommendationType.RECOMMEND_PRACTICE,
        }
        pace_types = {
            RecommendationType.RECOMMEND_SLOW_DOWN,
            RecommendationType.RECOMMEND_SPEED_UP,
            RecommendationType.RECOMMEND_BREAK,
        }
        order_types = {
            RecommendationType.RECOMMEND_REORDER,
            RecommendationType.RECOMMEND_PRIORITIZE,
            RecommendationType.RECOMMEND_DEFER,
        }
        content_types = {
            RecommendationType.RECOMMEND_SIMPLIFY,
            RecommendationType.RECOMMEND_ELABORATE,
            RecommendationType.RECOMMEND_ALTERNATIVE,
        }
        
        if self.recommendation_type in review_types:
            return 'review'
        elif self.recommendation_type in pace_types:
            return 'pace'
        elif self.recommendation_type in order_types:
            return 'order'
        elif self.recommendation_type in content_types:
            return 'content'
        else:
            return 'general'
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'id': str(self.id),
            'recommendation_type': self.recommendation_type.value,
            'user_id': str(self.user_id),
            'target_entity_type': self.target_entity_type,
            'target_entity_id': str(self.target_entity_id) if self.target_entity_id else None,
            'target_entity_name': self.target_entity_name,
            'justification': self.justification,
            'confidence_score': self.confidence_score,
            'confidence_level': self.confidence_level.value,
            'priority': self.priority,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'source_insight_id': str(self.source_insight_id) if self.source_insight_id else None,
            'action_category': self.action_category,
            'is_high_confidence': self.is_high_confidence,
            'is_actionable': self.is_actionable,
            'metadata': self.metadata,
        }


@dataclass
class RecommendationBatch:
    """
    A batch of recommendations for a learner.
    
    Useful for presenting multiple recommendations
    in a prioritized manner.
    """
    user_id: UUID
    recommendations: list[RecommendationData]
    generated_at: datetime
    insight_version: str
    
    def __post_init__(self):
        """Sort recommendations by priority and confidence."""
        self.recommendations = sorted(
            self.recommendations,
            key=lambda r: (r.priority, -r.confidence_score)
        )
    
    @property
    def count(self) -> int:
        """Total number of recommendations."""
        return len(self.recommendations)
    
    @property
    def actionable_count(self) -> int:
        """Number of actionable recommendations."""
        return sum(1 for r in self.recommendations if r.is_actionable)
    
    @property
    def high_priority(self) -> list[RecommendationData]:
        """Get high priority recommendations (priority 1-2)."""
        return [r for r in self.recommendations if r.priority <= 2]
    
    @property
    def high_confidence(self) -> list[RecommendationData]:
        """Get high confidence recommendations."""
        return [r for r in self.recommendations if r.is_high_confidence]
    
    def filter_by_type(self, rec_type: RecommendationType) -> list[RecommendationData]:
        """Get recommendations of a specific type."""
        return [r for r in self.recommendations if r.recommendation_type == rec_type]
    
    def filter_by_category(self, category: str) -> list[RecommendationData]:
        """Get recommendations in a specific category."""
        return [r for r in self.recommendations if r.action_category == category]
    
    def filter_by_target(self, target_name: str) -> list[RecommendationData]:
        """Get recommendations for a specific target."""
        return [r for r in self.recommendations if r.target_entity_name == target_name]
    
    @property
    def top_recommendation(self) -> Optional[RecommendationData]:
        """Get the highest priority, highest confidence recommendation."""
        actionable = [r for r in self.recommendations if r.is_actionable]
        if not actionable:
            return None
        return actionable[0]  # Already sorted
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            'user_id': str(self.user_id),
            'generated_at': self.generated_at.isoformat(),
            'insight_version': self.insight_version,
            'count': self.count,
            'actionable_count': self.actionable_count,
            'recommendations': [r.to_dict() for r in self.recommendations],
        }
