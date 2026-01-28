"""
Event Service for Phase 6.

Handles:
- Event ingestion (creating immutable event records)
- Event querying (for insight computation)
- Event validation

⚠️ Events are immutable facts - no updates allowed.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from ..models import LearningEvent, EventTypeChoices
from ..domain.events import LearningEventData
from ..domain.enums import EventType


class EventService:
    """
    Service for managing learning events.
    
    Events are immutable facts representing things that have happened.
    This service handles ingestion and querying, but NOT modification.
    """
    
    def record_event(
        self,
        event_type: str,
        user_id: UUID,
        timestamp: Optional[datetime] = None,
        topic: Optional[str] = None,
        content_request_id: Optional[UUID] = None,
        study_plan_id: Optional[UUID] = None,
        study_plan_item_id: Optional[UUID] = None,
        session_id: Optional[UUID] = None,
        duration_seconds: Optional[int] = None,
        metadata: Optional[dict] = None
    ) -> LearningEvent:
        """
        Record a new learning event.
        
        Events are append-only and immutable.
        
        Args:
            event_type: Type of event (from EventTypeChoices)
            user_id: ID of the learner
            timestamp: When the event occurred (defaults to now)
            topic: Topic involved (if applicable)
            content_request_id: Related content request
            study_plan_id: Related study plan
            study_plan_item_id: Related study plan item
            session_id: Learning session identifier
            duration_seconds: Duration of activity
            metadata: Additional event data
            
        Returns:
            The created LearningEvent record
        """
        if timestamp is None:
            timestamp = timezone.now()
        
        event = LearningEvent.objects.create(
            event_type=event_type,
            user_id=user_id,
            timestamp=timestamp,
            topic=topic,
            content_request_id=content_request_id,
            study_plan_id=study_plan_id,
            study_plan_item_id=study_plan_item_id,
            session_id=session_id,
            duration_seconds=duration_seconds,
            metadata=metadata or {},
        )
        
        return event
    
    def record_event_from_data(self, event_data: LearningEventData) -> LearningEvent:
        """
        Record an event from a domain data object.
        
        Args:
            event_data: LearningEventData domain object
            
        Returns:
            The created LearningEvent record
        """
        return self.record_event(
            event_type=event_data.event_type.value,
            user_id=event_data.user_id,
            timestamp=event_data.timestamp,
            topic=event_data.topic,
            content_request_id=event_data.content_request_id,
            study_plan_id=event_data.study_plan_id,
            study_plan_item_id=event_data.study_plan_item_id,
            session_id=event_data.session_id,
            duration_seconds=event_data.duration_seconds,
            metadata=event_data.metadata,
        )
    
    def record_batch(self, events: list[LearningEventData]) -> list[LearningEvent]:
        """
        Record multiple events in a single transaction.
        
        Args:
            events: List of LearningEventData to record
            
        Returns:
            List of created LearningEvent records
        """
        with transaction.atomic():
            return [self.record_event_from_data(e) for e in events]
    
    def get_events_for_user(
        self,
        user_id: UUID,
        event_types: Optional[list[str]] = None,
        topic: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> list[LearningEvent]:
        """
        Query events for a specific user.
        
        Args:
            user_id: The learner's ID
            event_types: Filter to specific event types
            topic: Filter to specific topic
            since: Start of time range
            until: End of time range
            limit: Maximum number of events
            
        Returns:
            List of matching LearningEvent records
        """
        queryset = LearningEvent.objects.filter(user_id=user_id)
        
        if event_types:
            queryset = queryset.filter(event_type__in=event_types)
        
        if topic:
            queryset = queryset.filter(topic=topic)
        
        if since:
            queryset = queryset.filter(timestamp__gte=since)
        
        if until:
            queryset = queryset.filter(timestamp__lte=until)
        
        queryset = queryset.order_by('-timestamp')
        
        if limit:
            queryset = queryset[:limit]
        
        return list(queryset)
    
    def get_events_as_domain(
        self,
        user_id: UUID,
        event_types: Optional[list[str]] = None,
        topic: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> list[LearningEventData]:
        """
        Query events and return as domain objects.
        
        Useful for feeding events into estimators.
        
        Args:
            user_id: The learner's ID
            event_types: Filter to specific event types
            topic: Filter to specific topic
            since: Start of time range
            until: End of time range
            limit: Maximum number of events
            
        Returns:
            List of LearningEventData domain objects
        """
        db_events = self.get_events_for_user(
            user_id=user_id,
            event_types=event_types,
            topic=topic,
            since=since,
            until=until,
            limit=limit,
        )
        
        return [self._to_domain(e) for e in db_events]
    
    def get_recent_events(
        self,
        user_id: UUID,
        days: int = 30,
        limit: Optional[int] = None
    ) -> list[LearningEvent]:
        """
        Get recent events for a user.
        
        Convenience method for common time-windowed queries.
        
        Args:
            user_id: The learner's ID
            days: Number of days to look back
            limit: Maximum number of events
            
        Returns:
            List of recent LearningEvent records
        """
        since = timezone.now() - timedelta(days=days)
        return self.get_events_for_user(
            user_id=user_id,
            since=since,
            limit=limit,
        )
    
    def get_topic_events(
        self,
        user_id: UUID,
        topic: str,
        limit: Optional[int] = 100
    ) -> list[LearningEvent]:
        """
        Get all events for a specific topic.
        
        Args:
            user_id: The learner's ID
            topic: The topic to query
            limit: Maximum number of events
            
        Returns:
            List of LearningEvent records for the topic
        """
        return self.get_events_for_user(
            user_id=user_id,
            topic=topic,
            limit=limit,
        )
    
    def get_unique_topics(self, user_id: UUID, days: int = 90) -> list[str]:
        """
        Get all unique topics a user has interacted with.
        
        Args:
            user_id: The learner's ID
            days: Number of days to look back
            
        Returns:
            List of unique topic names
        """
        since = timezone.now() - timedelta(days=days)
        topics = LearningEvent.objects.filter(
            user_id=user_id,
            timestamp__gte=since,
            topic__isnull=False,
        ).values_list('topic', flat=True).distinct()
        
        return list(topics)
    
    def get_event_counts(
        self,
        user_id: UUID,
        since: Optional[datetime] = None
    ) -> dict[str, int]:
        """
        Get counts of events by type for a user.
        
        Args:
            user_id: The learner's ID
            since: Start of time range
            
        Returns:
            Dictionary mapping event type to count
        """
        queryset = LearningEvent.objects.filter(user_id=user_id)
        
        if since:
            queryset = queryset.filter(timestamp__gte=since)
        
        from django.db.models import Count
        counts = queryset.values('event_type').annotate(count=Count('id'))
        
        return {item['event_type']: item['count'] for item in counts}
    
    def _to_domain(self, event: LearningEvent) -> LearningEventData:
        """
        Convert a database model to a domain object.
        
        Args:
            event: LearningEvent database model
            
        Returns:
            LearningEventData domain object
        """
        return LearningEventData(
            event_type=EventType(event.event_type),
            user_id=event.user_id,
            timestamp=event.timestamp,
            topic=event.topic,
            content_request_id=event.content_request_id,
            study_plan_id=event.study_plan_id,
            study_plan_item_id=event.study_plan_item_id,
            session_id=event.session_id,
            duration_seconds=event.duration_seconds,
            metadata=event.metadata,
        )
