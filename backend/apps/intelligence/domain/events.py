"""
Learning Event data structures for Phase 6.

Events are IMMUTABLE FACTS representing things that have happened.
They are never commands or instructions.

Design principles:
- Events are append-only
- Events cannot be modified after creation
- Events carry all context needed for processing
- Events are schema-stable for extensibility
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from .enums import EventType


@dataclass(frozen=True)
class LearningEventData:
    """
    Immutable data structure representing a learning event.
    
    This is a domain value object, not a database model.
    It represents the essential data of an event.
    
    Attributes:
        event_type: The type of event that occurred
        user_id: The user who triggered the event
        timestamp: When the event occurred
        topic: The topic involved (if applicable)
        content_request_id: Related content request (if applicable)
        study_plan_id: Related study plan (if applicable)
        study_plan_item_id: Related study plan item (if applicable)
        session_id: Learning session identifier (for grouping)
        duration_seconds: Duration of the activity (if applicable)
        metadata: Additional context-specific data
        
    Example:
        >>> event = LearningEventData(
        ...     event_type=EventType.CONTENT_COMPLETED,
        ...     user_id=uuid4(),
        ...     timestamp=datetime.now(),
        ...     topic="Python Decorators",
        ...     content_request_id=uuid4(),
        ...     duration_seconds=1800,
        ...     metadata={"difficulty_rating": 4, "completed_sections": 5}
        ... )
    """
    event_type: EventType
    user_id: UUID
    timestamp: datetime
    topic: Optional[str] = None
    content_request_id: Optional[UUID] = None
    study_plan_id: Optional[UUID] = None
    study_plan_item_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    duration_seconds: Optional[int] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate event data after initialization."""
        if not isinstance(self.event_type, EventType):
            raise ValueError(f"Invalid event_type: {self.event_type}")
        if self.duration_seconds is not None and self.duration_seconds < 0:
            raise ValueError("duration_seconds cannot be negative")
    
    @property
    def is_content_event(self) -> bool:
        """Check if this is a content-related event."""
        return self.event_type in EventType.content_events()
    
    @property
    def is_topic_event(self) -> bool:
        """Check if this is a topic-related event."""
        return self.event_type in EventType.topic_events()
    
    @property
    def is_plan_event(self) -> bool:
        """Check if this is a plan-related event."""
        return self.event_type in EventType.plan_events()
    
    def with_metadata(self, key: str, value: Any) -> 'LearningEventData':
        """
        Create a new event with additional metadata.
        
        Since events are immutable, this returns a new instance.
        
        Args:
            key: Metadata key
            value: Metadata value
            
        Returns:
            New LearningEventData with updated metadata
        """
        new_metadata = {**self.metadata, key: value}
        return LearningEventData(
            event_type=self.event_type,
            user_id=self.user_id,
            timestamp=self.timestamp,
            topic=self.topic,
            content_request_id=self.content_request_id,
            study_plan_id=self.study_plan_id,
            study_plan_item_id=self.study_plan_item_id,
            session_id=self.session_id,
            duration_seconds=self.duration_seconds,
            metadata=new_metadata,
        )
    
    def to_dict(self) -> dict[str, Any]:
        """
        Convert to dictionary representation.
        
        Useful for serialization and logging.
        """
        return {
            'event_type': self.event_type.value,
            'user_id': str(self.user_id),
            'timestamp': self.timestamp.isoformat(),
            'topic': self.topic,
            'content_request_id': str(self.content_request_id) if self.content_request_id else None,
            'study_plan_id': str(self.study_plan_id) if self.study_plan_id else None,
            'study_plan_item_id': str(self.study_plan_item_id) if self.study_plan_item_id else None,
            'session_id': str(self.session_id) if self.session_id else None,
            'duration_seconds': self.duration_seconds,
            'metadata': self.metadata,
        }


@dataclass(frozen=True)
class EventBatch:
    """
    A batch of related events for bulk processing.
    
    Useful for:
    - Efficient insight computation
    - Session-based analysis
    - Time-window aggregations
    """
    events: tuple[LearningEventData, ...]
    user_id: UUID
    start_time: datetime
    end_time: datetime
    
    def __post_init__(self):
        """Validate batch data."""
        if not self.events:
            raise ValueError("EventBatch must contain at least one event")
        if self.start_time > self.end_time:
            raise ValueError("start_time must be before or equal to end_time")
    
    @property
    def event_count(self) -> int:
        """Total number of events in the batch."""
        return len(self.events)
    
    @property
    def duration_seconds(self) -> int:
        """Total duration of the batch in seconds."""
        return int((self.end_time - self.start_time).total_seconds())
    
    def filter_by_type(self, event_type: EventType) -> tuple[LearningEventData, ...]:
        """Get all events of a specific type."""
        return tuple(e for e in self.events if e.event_type == event_type)
    
    def filter_by_topic(self, topic: str) -> tuple[LearningEventData, ...]:
        """Get all events for a specific topic."""
        return tuple(e for e in self.events if e.topic == topic)
    
    @property
    def unique_topics(self) -> set[str]:
        """Get all unique topics in this batch."""
        return {e.topic for e in self.events if e.topic is not None}
    
    @property
    def event_type_counts(self) -> dict[EventType, int]:
        """Count of events by type."""
        counts: dict[EventType, int] = {}
        for event in self.events:
            counts[event.event_type] = counts.get(event.event_type, 0) + 1
        return counts
