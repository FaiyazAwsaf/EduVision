"""
Rule-Based Recommendation Strategy.

Generates recommendations using deterministic rules based on:
- Topic difficulty patterns
- Learning pace analysis
- Consistency observations
- Insight deltas (changes over time)

⚠️ CRITICAL CONSTRAINTS:
- Recommendations are ADVISORY ONLY
- NO automatic application of recommendations
- Phase 6 MUST NOT mutate study plans or content
- Each recommendation includes full justification
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from ..interfaces.base import EstimatorConfig, EstimatorResult
from ..interfaces.recommendation_strategy import RecommendationStrategy
from ..domain.insights import LearnerInsightData, InsightDelta, TopicMetrics
from ..domain.recommendations import RecommendationData, RecommendationBatch
from ..domain.enums import RecommendationType, LearningPace


class RuleBasedRecommendationStrategy(RecommendationStrategy):
    """
    Rule-based implementation of recommendation generation.
    
    Rules are organized by category:
    - Review rules: Based on difficulty and retry patterns
    - Pace rules: Based on learning speed
    - Order rules: Based on topic difficulty progression
    - Content rules: Based on engagement and feedback
    
    ⚠️ Recommendations are suggestions only.
    ⚠️ External systems MAY choose to act on them.
    ⚠️ Phase 6 MUST NOT act on its own recommendations.
    """
    
    def _default_config(self) -> EstimatorConfig:
        """Default configuration with recommendation thresholds."""
        return EstimatorConfig(
            name="RuleBased Recommendation Strategy",
            version="1.0.0",
            parameters={
                # Thresholds for review recommendations
                "high_difficulty_threshold": 0.7,
                "low_mastery_threshold": 0.4,
                "high_retry_threshold": 3,
                # Thresholds for pace recommendations
                "slow_pace_threshold": 0.3,
                "fast_pace_threshold": 0.8,
                # Thresholds for consistency recommendations
                "low_consistency_threshold": 0.3,
                # Default recommendation expiry (hours)
                "default_expiry_hours": 72,
                # Minimum confidence to include recommendation
                "min_confidence_threshold": 0.3,
            },
            fallback_value=[],
        )
    
    def estimate(self, *args, **kwargs) -> EstimatorResult[list[RecommendationData]]:
        """Required by BaseEstimator but we use generate() instead."""
        insight = kwargs.get('insight')
        if insight:
            batch = self.generate(insight)
            return self._create_result(
                value=batch.recommendations,
                confidence=0.8,
                explanation=f"Generated {len(batch.recommendations)} recommendations",
                factors={},
            )
        return self._fallback_result("No insight provided")
    
    def generate(
        self,
        insight: LearnerInsightData,
        delta: Optional[InsightDelta] = None,
        max_recommendations: int = 10,
        filter_types: Optional[list[RecommendationType]] = None
    ) -> RecommendationBatch:
        """
        Generate recommendations based on learner insights.
        """
        recommendations: list[RecommendationData] = []
        
        # Generate review recommendations
        recommendations.extend(self._generate_review_recommendations(insight))
        
        # Generate pace recommendations
        recommendations.extend(self._generate_pace_recommendations(insight))
        
        # Generate consistency recommendations
        recommendations.extend(self._generate_consistency_recommendations(insight))
        
        # Generate delta-based recommendations if available
        if delta:
            recommendations.extend(self._generate_delta_recommendations(delta))
        
        # Filter by type if specified
        if filter_types:
            recommendations = [
                r for r in recommendations 
                if r.recommendation_type in filter_types
            ]
        
        # Filter by minimum confidence
        min_conf = self.config.get_param("min_confidence_threshold", 0.3)
        recommendations = [r for r in recommendations if r.confidence_score >= min_conf]
        
        # Prioritize and limit
        recommendations = self.prioritize(recommendations)[:max_recommendations]
        
        return RecommendationBatch(
            user_id=insight.user_id,
            recommendations=recommendations,
            generated_at=datetime.now(),
            insight_version=insight.computation_rules_version,
        )
    
    def generate_for_topic(
        self,
        insight: LearnerInsightData,
        topic: str,
        max_recommendations: int = 3
    ) -> list[RecommendationData]:
        """
        Generate recommendations for a specific topic.
        """
        recommendations: list[RecommendationData] = []
        
        metrics = insight.get_topic_metrics(topic)
        if not metrics:
            return recommendations
        
        expiry = datetime.now() + timedelta(
            hours=self.config.get_param("default_expiry_hours", 72)
        )
        
        # Check if struggling
        if metrics.is_struggling:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_REVIEW,
                user_id=insight.user_id,
                target_entity_type="topic",
                target_entity_name=topic,
                justification=self._build_struggle_justification(metrics),
                confidence_score=self._calculate_struggle_confidence(metrics),
                priority=1,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # Check for slow pace
        if metrics.average_time_per_attempt > 2700:  # > 45 min
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_SIMPLIFY,
                user_id=insight.user_id,
                target_entity_type="topic",
                target_entity_name=topic,
                justification=f"Average time ({metrics.average_time_per_attempt // 60} min) is high. Consider breaking down into smaller subtopics.",
                confidence_score=min(1.0, metrics.average_time_per_attempt / 3600),
                priority=2,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # Check for potential mastery
        if metrics.mastery_score > 0.7 and metrics.difficulty_score < 0.3:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_SPEED_UP,
                user_id=insight.user_id,
                target_entity_type="topic",
                target_entity_name=topic,
                justification=f"High mastery ({metrics.mastery_score:.0%}) with low difficulty. Consider advancing to more challenging material.",
                confidence_score=metrics.mastery_score,
                priority=3,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        return recommendations[:max_recommendations]
    
    def evaluate_recommendation(
        self,
        recommendation: RecommendationData,
        insight: LearnerInsightData
    ) -> float:
        """
        Evaluate how relevant a recommendation still is.
        """
        # Check if expired
        if recommendation.is_expired:
            return 0.0
        
        # Check if target still exists in insights
        if recommendation.target_entity_type == "topic":
            metrics = insight.get_topic_metrics(recommendation.target_entity_name)
            if not metrics:
                return 0.2  # Topic not in recent activity
            
            # Check if underlying condition still applies
            if recommendation.recommendation_type == RecommendationType.RECOMMEND_REVIEW:
                if metrics.is_struggling:
                    return 0.9  # Still relevant
                else:
                    return 0.3  # Less relevant
            
            if recommendation.recommendation_type == RecommendationType.RECOMMEND_SPEED_UP:
                if metrics.is_mastered:
                    return 0.9
                else:
                    return 0.4
        
        # Default relevance decay based on age
        age_hours = (datetime.now() - recommendation.created_at).total_seconds() / 3600
        return max(0.2, 1.0 - age_hours / 168)  # Week decay
    
    def _generate_review_recommendations(
        self, 
        insight: LearnerInsightData
    ) -> list[RecommendationData]:
        """Generate review-type recommendations."""
        recommendations = []
        expiry = datetime.now() + timedelta(
            hours=self.config.get_param("default_expiry_hours", 72)
        )
        
        high_diff_threshold = self.config.get_param("high_difficulty_threshold", 0.7)
        low_mastery_threshold = self.config.get_param("low_mastery_threshold", 0.4)
        high_retry_threshold = self.config.get_param("high_retry_threshold", 3)
        
        for topic in insight.weak_topics:
            metrics = insight.get_topic_metrics(topic)
            if not metrics:
                continue
            
            # High difficulty + low mastery = recommend review
            if metrics.difficulty_score >= high_diff_threshold and metrics.mastery_score < low_mastery_threshold:
                recommendations.append(RecommendationData(
                    recommendation_type=RecommendationType.RECOMMEND_REVIEW,
                    user_id=insight.user_id,
                    target_entity_type="topic",
                    target_entity_name=topic,
                    justification=self._build_struggle_justification(metrics),
                    confidence_score=self._calculate_struggle_confidence(metrics),
                    priority=1,
                    created_at=datetime.now(),
                    expires_at=expiry,
                ))
            
            # High retries = recommend retry with different approach
            if metrics.retry_count >= high_retry_threshold:
                recommendations.append(RecommendationData(
                    recommendation_type=RecommendationType.RECOMMEND_ALTERNATIVE,
                    user_id=insight.user_id,
                    target_entity_type="topic",
                    target_entity_name=topic,
                    justification=f"Topic retried {metrics.retry_count} times. Consider alternative learning resources or a different approach.",
                    confidence_score=min(1.0, metrics.retry_count / 5),
                    priority=2,
                    created_at=datetime.now(),
                    expires_at=expiry,
                ))
        
        # Reinforce near-mastery topics
        for topic in insight.strong_topics:
            metrics = insight.get_topic_metrics(topic)
            if metrics and 0.6 <= metrics.mastery_score < 0.9:
                recommendations.append(RecommendationData(
                    recommendation_type=RecommendationType.RECOMMEND_REINFORCE,
                    user_id=insight.user_id,
                    target_entity_type="topic",
                    target_entity_name=topic,
                    justification=f"Near mastery ({metrics.mastery_score:.0%}). Light reinforcement can solidify understanding.",
                    confidence_score=metrics.mastery_score,
                    priority=4,
                    created_at=datetime.now(),
                    expires_at=expiry,
                ))
        
        return recommendations
    
    def _generate_pace_recommendations(
        self, 
        insight: LearnerInsightData
    ) -> list[RecommendationData]:
        """Generate pace-type recommendations."""
        recommendations = []
        expiry = datetime.now() + timedelta(
            hours=self.config.get_param("default_expiry_hours", 72)
        )
        
        slow_threshold = self.config.get_param("slow_pace_threshold", 0.3)
        fast_threshold = self.config.get_param("fast_pace_threshold", 0.8)
        
        # Slow pace recommendation
        if insight.pace_score < slow_threshold:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_SLOW_DOWN,
                user_id=insight.user_id,
                target_entity_type="session",
                target_entity_name="Learning Pace",
                justification=f"Current pace ({insight.learning_pace.value}) may be challenging. Consider focusing on fewer topics at a time.",
                confidence_score=1.0 - insight.pace_score,
                priority=2,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # Fast pace - might be skimming
        if insight.pace_score > fast_threshold and insight.average_mastery < 0.6:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_SLOW_DOWN,
                user_id=insight.user_id,
                target_entity_type="session",
                target_entity_name="Learning Pace",
                justification=f"Fast pace but moderate mastery ({insight.average_mastery:.0%}). Slowing down may improve retention.",
                confidence_score=insight.pace_score * (1 - insight.average_mastery),
                priority=3,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # Good pace with good mastery - encourage
        if 0.4 <= insight.pace_score <= 0.7 and insight.average_mastery > 0.7:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_SPEED_UP,
                user_id=insight.user_id,
                target_entity_type="session",
                target_entity_name="Learning Pace",
                justification=f"Strong mastery ({insight.average_mastery:.0%}) at moderate pace. Ready for more challenging material.",
                confidence_score=insight.average_mastery,
                priority=4,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        return recommendations
    
    def _generate_consistency_recommendations(
        self, 
        insight: LearnerInsightData
    ) -> list[RecommendationData]:
        """Generate consistency-type recommendations."""
        recommendations = []
        expiry = datetime.now() + timedelta(
            hours=self.config.get_param("default_expiry_hours", 72)
        )
        
        low_consistency_threshold = self.config.get_param("low_consistency_threshold", 0.3)
        
        if insight.consistency_score < low_consistency_threshold:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_FOCUS,
                user_id=insight.user_id,
                target_entity_type="session",
                target_entity_name="Study Schedule",
                justification=f"Irregular study pattern ({insight.consistency_score:.0%} consistency). Regular sessions improve retention.",
                confidence_score=1.0 - insight.consistency_score,
                priority=3,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # High retry frequency
        if insight.retry_frequency > 0.5:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_PRACTICE,
                user_id=insight.user_id,
                target_entity_type="session",
                target_entity_name="Practice Strategy",
                justification=f"High retry frequency ({insight.retry_frequency:.0%}). Consider spaced repetition for better retention.",
                confidence_score=insight.retry_frequency,
                priority=3,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        return recommendations
    
    def _generate_delta_recommendations(
        self, 
        delta: InsightDelta
    ) -> list[RecommendationData]:
        """Generate recommendations based on insight changes."""
        recommendations = []
        expiry = datetime.now() + timedelta(
            hours=self.config.get_param("default_expiry_hours", 72)
        )
        
        # New weak topics
        for topic in delta.new_weak_topics:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_REVIEW,
                user_id=delta.user_id,
                target_entity_type="topic",
                target_entity_name=topic,
                justification=f"Recently became a weak topic. Early intervention can prevent further struggle.",
                confidence_score=0.75,
                priority=1,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # Declining overall performance
        if delta.is_declining:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_BREAK,
                user_id=delta.user_id,
                target_entity_type="session",
                target_entity_name="Study Schedule",
                justification=f"Performance declining ({delta.mastery_change:+.0%} mastery, {delta.consistency_change:+.0%} consistency). Consider a short break or pace adjustment.",
                confidence_score=min(1.0, abs(delta.mastery_change) + abs(delta.consistency_change)),
                priority=2,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        # Improving - positive reinforcement
        if delta.is_improving and delta.new_strong_topics:
            recommendations.append(RecommendationData(
                recommendation_type=RecommendationType.RECOMMEND_PRIORITIZE,
                user_id=delta.user_id,
                target_entity_type="plan",
                target_entity_name="Study Progress",
                justification=f"Good progress! Mastered {len(delta.new_strong_topics)} new topic(s). Consider advancing to related advanced topics.",
                confidence_score=0.8,
                priority=4,
                created_at=datetime.now(),
                expires_at=expiry,
            ))
        
        return recommendations
    
    def _build_struggle_justification(self, metrics: TopicMetrics) -> str:
        """Build justification for struggling topic recommendation."""
        parts = []
        
        if metrics.retry_count >= 2:
            parts.append(f"{metrics.retry_count} retry attempts")
        
        if metrics.difficulty_score >= 0.7:
            parts.append(f"high difficulty ({metrics.difficulty_score:.0%})")
        
        if metrics.mastery_score < 0.4:
            parts.append(f"low mastery ({metrics.mastery_score:.0%})")
        
        if metrics.average_time_per_attempt > 2400:  # > 40 min
            parts.append(f"extended study time ({metrics.average_time_per_attempt // 60} min avg)")
        
        if parts:
            return f"Review recommended: {', '.join(parts)}."
        return "Review recommended based on learning patterns."
    
    def _calculate_struggle_confidence(self, metrics: TopicMetrics) -> float:
        """Calculate confidence for struggling topic recommendation."""
        # Combine multiple signals
        signals = [
            min(1.0, metrics.retry_count / 3) * 0.3,
            metrics.difficulty_score * 0.35,
            (1 - metrics.mastery_score) * 0.35,
        ]
        return sum(signals)
