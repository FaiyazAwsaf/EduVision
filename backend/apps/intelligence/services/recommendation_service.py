"""
Recommendation Service for Phase 6.

Handles:
- Generating recommendations from insights
- Managing recommendation lifecycle
- Tracking recommendation status

⚠️ CRITICAL: Recommendations are ADVISORY ONLY.
⚠️ This service DOES NOT automatically act on recommendations.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from ..models import Recommendation, RecommendationStatusChoices
from ..domain.recommendations import RecommendationData, RecommendationBatch
from ..domain.insights import LearnerInsightData, InsightDelta
from ..domain.enums import RecommendationType
from ..rules import RuleBasedRecommendationStrategy
from .insight_service import InsightService


class RecommendationService:
    """
    Service for generating and managing recommendations.
    
    Recommendations are ADVISORY OUTPUTS ONLY.
    They suggest actions but NEVER automatically apply them.
    
    ⚠️ Phase 6 MUST NOT act on recommendations.
    ⚠️ External systems MAY choose to act on them.
    """
    
    def __init__(
        self,
        insight_service: Optional[InsightService] = None,
        recommendation_strategy: Optional[RuleBasedRecommendationStrategy] = None,
    ):
        """
        Initialize the recommendation service.
        
        Args:
            insight_service: Service for computing insights
            recommendation_strategy: Strategy for generating recommendations
        """
        self.insight_service = insight_service or InsightService()
        self.recommendation_strategy = recommendation_strategy or RuleBasedRecommendationStrategy()
    
    def generate_recommendations(
        self,
        user_id: UUID,
        max_recommendations: int = 10,
        save: bool = True
    ) -> RecommendationBatch:
        """
        Generate recommendations for a learner.
        
        Computes current insight, compares with previous,
        and generates rule-based recommendations.
        
        Args:
            user_id: The learner's ID
            max_recommendations: Maximum recommendations to generate
            save: Whether to persist recommendations
            
        Returns:
            RecommendationBatch with generated recommendations
        """
        # Compute current insight
        current_insight = self.insight_service.compute_insight(
            user_id=user_id,
            save=True,
        )
        
        # Get delta from previous insight
        delta = self.insight_service.compute_insight_delta(
            user_id=user_id,
            current_insight=current_insight,
        )
        
        # Generate recommendations
        batch = self.recommendation_strategy.generate(
            insight=current_insight,
            delta=delta,
            max_recommendations=max_recommendations,
        )
        
        # Save if requested
        if save:
            # Get the saved insight for linking
            saved_insight = self.insight_service.get_latest_insight(user_id)
            self._save_recommendations(batch, saved_insight)
        
        return batch
    
    def generate_for_topic(
        self,
        user_id: UUID,
        topic: str,
        max_recommendations: int = 3
    ) -> list[RecommendationData]:
        """
        Generate recommendations for a specific topic.
        
        Args:
            user_id: The learner's ID
            topic: The topic to generate recommendations for
            max_recommendations: Maximum recommendations
            
        Returns:
            List of recommendations for the topic
        """
        # Compute current insight
        insight = self.insight_service.compute_insight(
            user_id=user_id,
            save=False,
        )
        
        return self.recommendation_strategy.generate_for_topic(
            insight=insight,
            topic=topic,
            max_recommendations=max_recommendations,
        )
    
    def get_active_recommendations(
        self,
        user_id: UUID,
        limit: int = 20
    ) -> list[Recommendation]:
        """
        Get active recommendations for a user.
        
        Args:
            user_id: The learner's ID
            limit: Maximum recommendations
            
        Returns:
            List of active Recommendation records
        """
        now = timezone.now()
        return list(
            Recommendation.objects.filter(
                user_id=user_id,
                status=RecommendationStatusChoices.ACTIVE,
            ).filter(
                # Not expired or no expiry
                expires_at__gt=now,
            ).union(
                Recommendation.objects.filter(
                    user_id=user_id,
                    status=RecommendationStatusChoices.ACTIVE,
                    expires_at__isnull=True,
                )
            ).order_by('priority', '-confidence_score')[:limit]
        )
    
    def get_high_priority_recommendations(
        self,
        user_id: UUID,
        limit: int = 5
    ) -> list[Recommendation]:
        """
        Get high priority recommendations.
        
        Args:
            user_id: The learner's ID
            limit: Maximum recommendations
            
        Returns:
            List of high priority Recommendation records
        """
        now = timezone.now()
        return list(
            Recommendation.objects.filter(
                user_id=user_id,
                status=RecommendationStatusChoices.ACTIVE,
                priority__lte=2,  # Priority 1-2 is high
            ).exclude(
                expires_at__lt=now,
            ).order_by('priority', '-confidence_score')[:limit]
        )
    
    def mark_viewed(self, recommendation_id: UUID) -> bool:
        """
        Mark a recommendation as viewed.
        
        Args:
            recommendation_id: ID of the recommendation
            
        Returns:
            True if successful, False if not found
        """
        try:
            rec = Recommendation.objects.get(id=recommendation_id)
            if rec.status == RecommendationStatusChoices.ACTIVE:
                rec.status = RecommendationStatusChoices.VIEWED
                rec.viewed_at = timezone.now()
                rec.save()
            return True
        except Recommendation.DoesNotExist:
            return False
    
    def mark_accepted(self, recommendation_id: UUID) -> bool:
        """
        Mark a recommendation as accepted.
        
        Note: This only updates the status. It does NOT
        automatically perform any action.
        
        Args:
            recommendation_id: ID of the recommendation
            
        Returns:
            True if successful, False if not found
        """
        try:
            rec = Recommendation.objects.get(id=recommendation_id)
            rec.status = RecommendationStatusChoices.ACCEPTED
            rec.actioned_at = timezone.now()
            rec.save()
            return True
        except Recommendation.DoesNotExist:
            return False
    
    def mark_dismissed(self, recommendation_id: UUID) -> bool:
        """
        Mark a recommendation as dismissed.
        
        Args:
            recommendation_id: ID of the recommendation
            
        Returns:
            True if successful, False if not found
        """
        try:
            rec = Recommendation.objects.get(id=recommendation_id)
            rec.status = RecommendationStatusChoices.DISMISSED
            rec.actioned_at = timezone.now()
            rec.save()
            return True
        except Recommendation.DoesNotExist:
            return False
    
    def expire_old_recommendations(self, user_id: Optional[UUID] = None) -> int:
        """
        Mark expired recommendations.
        
        Can be run periodically to clean up old recommendations.
        
        Args:
            user_id: Optional specific user, or all users if None
            
        Returns:
            Number of recommendations expired
        """
        now = timezone.now()
        queryset = Recommendation.objects.filter(
            status=RecommendationStatusChoices.ACTIVE,
            expires_at__lt=now,
        )
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset.update(status=RecommendationStatusChoices.EXPIRED)
    
    def get_recommendation_stats(self, user_id: UUID) -> dict:
        """
        Get statistics about recommendations for a user.
        
        Args:
            user_id: The learner's ID
            
        Returns:
            Dictionary with recommendation statistics
        """
        recs = Recommendation.objects.filter(user_id=user_id)
        
        return {
            'total': recs.count(),
            'active': recs.filter(status=RecommendationStatusChoices.ACTIVE).count(),
            'viewed': recs.filter(status=RecommendationStatusChoices.VIEWED).count(),
            'accepted': recs.filter(status=RecommendationStatusChoices.ACCEPTED).count(),
            'dismissed': recs.filter(status=RecommendationStatusChoices.DISMISSED).count(),
            'expired': recs.filter(status=RecommendationStatusChoices.EXPIRED).count(),
            'high_priority': recs.filter(priority__lte=2).count(),
            'high_confidence': recs.filter(confidence_score__gte=0.7).count(),
        }
    
    def _save_recommendations(
        self,
        batch: RecommendationBatch,
        source_insight: Optional[object] = None
    ) -> list[Recommendation]:
        """
        Persist a batch of recommendations.
        
        Args:
            batch: RecommendationBatch to save
            source_insight: LearnerInsight that generated these
            
        Returns:
            List of created Recommendation records
        """
        saved = []
        
        with transaction.atomic():
            for rec_data in batch.recommendations:
                rec = Recommendation.objects.create(
                    id=rec_data.id,
                    user_id=rec_data.user_id,
                    recommendation_type=rec_data.recommendation_type.value,
                    target_entity_type=rec_data.target_entity_type,
                    target_entity_id=rec_data.target_entity_id,
                    target_entity_name=rec_data.target_entity_name,
                    justification=rec_data.justification,
                    confidence_score=rec_data.confidence_score,
                    priority=rec_data.priority,
                    expires_at=rec_data.expires_at,
                    source_insight=source_insight,
                    metadata=rec_data.metadata,
                )
                saved.append(rec)
        
        return saved
