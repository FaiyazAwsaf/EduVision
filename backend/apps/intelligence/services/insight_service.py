"""
Insight Service for Phase 6.

Handles:
- Computing learner insights from events
- Storing insight snapshots
- Tracking insight history

Uses rule-based estimators (extensible to ML).
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from ..models import LearnerInsight, LearningPaceChoices
from ..domain.insights import LearnerInsightData, TopicMetrics, InsightDelta
from ..domain.enums import LearningPace, EventType
from ..rules import (
    RuleBasedDifficultyEstimator,
    RuleBasedPaceEvaluator,
    RuleBasedConsistencyAnalyzer,
)
from .event_service import EventService


class InsightService:
    """
    Service for computing and managing learner insights.
    
    Insights are derived from events using deterministic rules.
    They represent observed patterns, not predictions.
    
    ⚠️ All computation is rule-based.
    ⚠️ ML implementations can be swapped via estimator interfaces.
    """
    
    RULES_VERSION = "1.0.0"
    
    def __init__(
        self,
        event_service: Optional[EventService] = None,
        difficulty_estimator: Optional[RuleBasedDifficultyEstimator] = None,
        pace_evaluator: Optional[RuleBasedPaceEvaluator] = None,
        consistency_analyzer: Optional[RuleBasedConsistencyAnalyzer] = None,
    ):
        """
        Initialize the insight service.
        
        Estimators can be injected for testing or to swap implementations.
        
        Args:
            event_service: Service for querying events
            difficulty_estimator: Estimator for topic difficulty
            pace_evaluator: Evaluator for learning pace
            consistency_analyzer: Analyzer for consistency patterns
        """
        self.event_service = event_service or EventService()
        self.difficulty_estimator = difficulty_estimator or RuleBasedDifficultyEstimator()
        self.pace_evaluator = pace_evaluator or RuleBasedPaceEvaluator()
        self.consistency_analyzer = consistency_analyzer or RuleBasedConsistencyAnalyzer()
    
    def compute_insight(
        self,
        user_id: UUID,
        time_window_days: int = 30,
        save: bool = True
    ) -> LearnerInsightData:
        """
        Compute a comprehensive insight profile for a learner.
        
        Args:
            user_id: The learner's ID
            time_window_days: Days of events to analyze
            save: Whether to persist the insight
            
        Returns:
            Computed LearnerInsightData
        """
        # Get events for analysis
        events = self.event_service.get_events_as_domain(
            user_id=user_id,
            since=timezone.now() - timedelta(days=time_window_days),
        )
        
        if not events:
            # Return minimal insight if no events
            return self._create_minimal_insight(user_id, 0)
        
        # Get unique topics
        topics = list({e.topic for e in events if e.topic})
        
        # Compute pace
        pace_result = self.pace_evaluator.evaluate(
            user_id=user_id,
            events=events,
            time_window=timedelta(days=time_window_days),
        )
        
        # Compute consistency
        consistency_result = self.consistency_analyzer.analyze(
            user_id=user_id,
            events=events,
            time_window=timedelta(days=time_window_days),
        )
        
        # Compute per-topic metrics
        topic_metrics = {}
        for topic in topics:
            metrics = self._compute_topic_metrics(user_id, topic, events)
            if metrics:
                topic_metrics[topic] = metrics
        
        # Identify weak and strong topics
        weak_topics = [
            topic for topic, metrics in topic_metrics.items()
            if metrics.is_struggling
        ]
        strong_topics = [
            topic for topic, metrics in topic_metrics.items()
            if metrics.is_mastered
        ]
        
        # Compute retry frequency
        retry_events = [e for e in events if e.event_type == EventType.TOPIC_RETRIED]
        total_topic_events = [e for e in events if e.topic is not None]
        retry_frequency = len(retry_events) / max(len(total_topic_events), 1)
        
        # Build insight data
        insight_data = LearnerInsightData(
            user_id=user_id,
            computed_at=timezone.now(),
            learning_pace=LearningPace.from_percentile(pace_result.value),
            pace_score=pace_result.value,
            consistency_score=consistency_result.value,
            retry_frequency=retry_frequency,
            topic_metrics=topic_metrics,
            weak_topics=weak_topics,
            strong_topics=strong_topics,
            total_events_analyzed=len(events),
            computation_rules_version=self.RULES_VERSION,
        )
        
        # Save if requested
        if save:
            self._save_insight(insight_data)
        
        return insight_data
    
    def get_latest_insight(self, user_id: UUID) -> Optional[LearnerInsight]:
        """
        Get the most recent insight for a user.
        
        Args:
            user_id: The learner's ID
            
        Returns:
            Most recent LearnerInsight or None
        """
        return LearnerInsight.objects.filter(user_id=user_id).first()
    
    def get_insight_history(
        self,
        user_id: UUID,
        limit: int = 10
    ) -> list[LearnerInsight]:
        """
        Get insight history for a user.
        
        Args:
            user_id: The learner's ID
            limit: Maximum number of insights
            
        Returns:
            List of LearnerInsight records (newest first)
        """
        return list(
            LearnerInsight.objects.filter(user_id=user_id)
            .order_by('-computed_at')[:limit]
        )
    
    def compute_insight_delta(
        self,
        user_id: UUID,
        current_insight: Optional[LearnerInsightData] = None
    ) -> Optional[InsightDelta]:
        """
        Compute the change between current and previous insights.
        
        Args:
            user_id: The learner's ID
            current_insight: Current insight (computed if not provided)
            
        Returns:
            InsightDelta or None if no previous insight
        """
        # Get current insight if not provided
        if current_insight is None:
            current_insight = self.compute_insight(user_id, save=False)
        
        # Get previous insight
        previous_db = LearnerInsight.objects.filter(user_id=user_id).first()
        if not previous_db:
            return InsightDelta(
                user_id=user_id,
                previous_insight=None,
                current_insight=current_insight,
                delta_period_days=0,
            )
        
        # Convert previous to domain object
        previous_insight = self._db_to_domain(previous_db)
        
        # Calculate delta period
        delta_days = (current_insight.computed_at - previous_insight.computed_at).days
        
        return InsightDelta(
            user_id=user_id,
            previous_insight=previous_insight,
            current_insight=current_insight,
            delta_period_days=delta_days,
        )
    
    def refresh_insight(self, user_id: UUID) -> LearnerInsightData:
        """
        Force refresh of a user's insight.
        
        Computes new insight and saves it.
        
        Args:
            user_id: The learner's ID
            
        Returns:
            Newly computed LearnerInsightData
        """
        return self.compute_insight(user_id, save=True)
    
    def _compute_topic_metrics(
        self,
        user_id: UUID,
        topic: str,
        events: list,
    ) -> Optional[TopicMetrics]:
        """
        Compute metrics for a specific topic.
        
        Args:
            user_id: The learner's ID
            topic: The topic to analyze
            events: All events for the user
            
        Returns:
            TopicMetrics or None if insufficient data
        """
        topic_events = [e for e in events if e.topic == topic]
        
        if not topic_events:
            return None
        
        # Get difficulty estimate
        difficulty_result = self.difficulty_estimator.estimate(
            user_id=user_id,
            topic=topic,
            events=topic_events,
        )
        
        # Calculate metrics from events
        retry_count = sum(1 for e in topic_events if e.event_type == EventType.TOPIC_RETRIED)
        completion_count = sum(1 for e in topic_events if e.event_type == EventType.CONTENT_COMPLETED)
        total_time = sum(e.duration_seconds or 0 for e in topic_events)
        last_interaction = max(e.timestamp for e in topic_events)
        
        # Compute mastery score (simple rule-based)
        mastery_score = self._compute_mastery_score(topic_events)
        
        return TopicMetrics(
            topic=topic,
            difficulty_score=difficulty_result.value,
            mastery_score=mastery_score,
            retry_count=retry_count,
            total_time_seconds=total_time,
            completion_count=completion_count,
            last_interaction=last_interaction,
        )
    
    def _compute_mastery_score(self, events: list) -> float:
        """
        Compute mastery score for a topic based on events.
        
        Rule-based computation:
        - More completions → higher mastery
        - Fewer retries → higher mastery
        - Recent completions → higher mastery
        
        Args:
            events: Events for the topic
            
        Returns:
            Mastery score (0.0 to 1.0)
        """
        completions = sum(1 for e in events if e.event_type == EventType.CONTENT_COMPLETED)
        retries = sum(1 for e in events if e.event_type == EventType.TOPIC_RETRIED)
        mastered = sum(1 for e in events if e.event_type == EventType.TOPIC_MASTERED)
        
        # If explicitly marked as mastered, high score
        if mastered > 0:
            return 0.9
        
        # Calculate based on completion ratio
        if completions == 0:
            return 0.0
        
        # More completions = higher base score
        base_score = min(0.6, completions * 0.2)
        
        # Penalize for retries
        retry_penalty = min(0.3, retries * 0.1)
        
        # Recent completion bonus
        recent_completion = any(
            e.event_type == EventType.CONTENT_COMPLETED
            and (timezone.now() - e.timestamp).days < 7
            for e in events
        )
        recency_bonus = 0.2 if recent_completion else 0
        
        return min(1.0, max(0.0, base_score - retry_penalty + recency_bonus))
    
    def _create_minimal_insight(
        self, 
        user_id: UUID, 
        event_count: int
    ) -> LearnerInsightData:
        """
        Create a minimal insight when there's insufficient data.
        
        Args:
            user_id: The learner's ID
            event_count: Number of events analyzed
            
        Returns:
            Minimal LearnerInsightData
        """
        return LearnerInsightData(
            user_id=user_id,
            computed_at=timezone.now(),
            learning_pace=LearningPace.MODERATE,
            pace_score=0.5,
            consistency_score=0.5,
            retry_frequency=0.0,
            topic_metrics={},
            weak_topics=[],
            strong_topics=[],
            total_events_analyzed=event_count,
            computation_rules_version=self.RULES_VERSION,
        )
    
    def _save_insight(self, insight_data: LearnerInsightData) -> LearnerInsight:
        """
        Persist an insight to the database.
        
        Args:
            insight_data: LearnerInsightData to save
            
        Returns:
            Created LearnerInsight record
        """
        # Convert topic metrics to dict
        topic_metrics_dict = {
            topic: metrics.to_dict()
            for topic, metrics in insight_data.topic_metrics.items()
        }
        
        return LearnerInsight.objects.create(
            user_id=insight_data.user_id,
            computation_rules_version=insight_data.computation_rules_version,
            events_analyzed_count=insight_data.total_events_analyzed,
            learning_pace=insight_data.learning_pace.value,
            pace_score=insight_data.pace_score,
            consistency_score=insight_data.consistency_score,
            retry_frequency=insight_data.retry_frequency,
            average_difficulty=insight_data.average_difficulty,
            average_mastery=insight_data.average_mastery,
            overall_health_score=insight_data.overall_health_score,
            weak_topics=insight_data.weak_topics,
            strong_topics=insight_data.strong_topics,
            topic_metrics=topic_metrics_dict,
        )
    
    def _db_to_domain(self, db_insight: LearnerInsight) -> LearnerInsightData:
        """
        Convert a database insight to domain object.
        
        Args:
            db_insight: LearnerInsight database model
            
        Returns:
            LearnerInsightData domain object
        """
        # Reconstruct topic metrics
        topic_metrics = {}
        for topic, metrics_dict in db_insight.topic_metrics.items():
            topic_metrics[topic] = TopicMetrics(
                topic=topic,
                difficulty_score=metrics_dict['difficulty_score'],
                mastery_score=metrics_dict['mastery_score'],
                retry_count=metrics_dict['retry_count'],
                total_time_seconds=metrics_dict['total_time_seconds'],
                completion_count=metrics_dict['completion_count'],
                last_interaction=datetime.fromisoformat(metrics_dict['last_interaction']),
            )
        
        return LearnerInsightData(
            user_id=db_insight.user_id,
            computed_at=db_insight.computed_at,
            learning_pace=LearningPace(db_insight.learning_pace),
            pace_score=db_insight.pace_score,
            consistency_score=db_insight.consistency_score,
            retry_frequency=db_insight.retry_frequency,
            topic_metrics=topic_metrics,
            weak_topics=db_insight.weak_topics,
            strong_topics=db_insight.strong_topics,
            total_events_analyzed=db_insight.events_analyzed_count,
            computation_rules_version=db_insight.computation_rules_version,
        )
