"""
DRF ViewSets for Phase 6: Intelligence & Adaptive Optimization.

ViewSets provide REST API endpoints for:
- Recording learning events (POST only - events are immutable)
- Querying learner insights
- Managing recommendations

⚠️ Phase 6 is strictly advisory - no automatic actions.
"""

from uuid import UUID
from datetime import timedelta

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.authentication.backends import CustomUserJWTAuthentication

from ..models import LearningEvent, LearnerInsight, Recommendation
from ..services import EventService, InsightService, RecommendationService
from .serializers import (
    LearningEventSerializer,
    LearningEventCreateSerializer,
    LearningEventBatchSerializer,
    LearnerInsightSerializer,
    LearnerInsightSummarySerializer,
    RecommendationSerializer,
    RecommendationActionSerializer,
    GenerateRecommendationsSerializer,
    RecommendationStatsSerializer,
)


class LearningEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet for learning events.
    
    Events are IMMUTABLE FACTS:
    - POST: Create new events (allowed)
    - GET: Read events (allowed)
    - PUT/PATCH/DELETE: NOT allowed
    
    ⚠️ Events should never be modified or deleted in normal operation.
    """
    queryset = LearningEvent.objects.all()
    serializer_class = LearningEventSerializer
    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    # Disable mutation operations
    http_method_names = ['get', 'post', 'head', 'options']
    
    def get_serializer_class(self):
        """Use different serializers for create vs read."""
        if self.action == 'create':
            return LearningEventCreateSerializer
        return LearningEventSerializer
    
    def get_queryset(self):
        """Filter events by query parameters."""
        queryset = super().get_queryset()
        
        # Filter by user_id
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by event_type
        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        
        # Filter by topic
        topic = self.request.query_params.get('topic')
        if topic:
            queryset = queryset.filter(topic=topic)
        
        # Filter by time range
        since = self.request.query_params.get('since')
        if since:
            queryset = queryset.filter(timestamp__gte=since)
        
        until = self.request.query_params.get('until')
        if until:
            queryset = queryset.filter(timestamp__lte=until)
        
        return queryset.order_by('-timestamp')
    
    @action(detail=False, methods=['post'])
    def batch(self, request):
        """
        Create multiple events in a single request.
        
        POST /api/learning-events/batch/
        {
            "events": [
                {"event_type": "content_started", "user_id": "...", ...},
                {"event_type": "content_completed", "user_id": "...", ...}
            ]
        }
        """
        serializer = LearningEventBatchSerializer(data=request.data)
        if serializer.is_valid():
            events = serializer.save()
            return Response(
                LearningEventSerializer(events, many=True).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def topics(self, request):
        """
        Get unique topics for a user.
        
        GET /api/learning-events/topics/?user_id=...
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        days = int(request.query_params.get('days', 90))
        
        event_service = EventService()
        topics = event_service.get_unique_topics(UUID(user_id), days=days)
        
        return Response({"topics": topics})
    
    @action(detail=False, methods=['get'])
    def counts(self, request):
        """
        Get event counts by type for a user.
        
        GET /api/learning-events/counts/?user_id=...
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        days = request.query_params.get('days')
        since = None
        if days:
            since = timezone.now() - timedelta(days=int(days))
        
        event_service = EventService()
        counts = event_service.get_event_counts(UUID(user_id), since=since)
        
        return Response({"counts": counts})


class LearnerInsightViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for learner insights.
    
    Insights are COMPUTED SNAPSHOTS:
    - GET: Read insights (allowed)
    - POST compute: Trigger new insight computation (allowed)
    - PUT/PATCH/DELETE: NOT allowed
    
    Insights are derived from events using rule-based computation.
    """
    queryset = LearnerInsight.objects.all()
    serializer_class = LearnerInsightSerializer
    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter insights by user_id."""
        queryset = super().get_queryset()
        
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset.order_by('-computed_at')
    
    def get_serializer_class(self):
        """Use summary serializer for list."""
        if self.action == 'list':
            return LearnerInsightSummarySerializer
        return LearnerInsightSerializer
    
    @action(detail=False, methods=['post'])
    def compute(self, request):
        """
        Compute a new insight for a user.
        
        POST /api/learner-insights/compute/
        {"user_id": "..."}
        """
        user_id = request.data.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        time_window_days = int(request.data.get('time_window_days', 30))
        
        insight_service = InsightService()
        insight_data = insight_service.compute_insight(
            user_id=UUID(user_id),
            time_window_days=time_window_days,
            save=True,
        )
        
        # Fetch the saved insight
        saved_insight = insight_service.get_latest_insight(UUID(user_id))
        
        return Response(
            LearnerInsightSerializer(saved_insight).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """
        Get the latest insight for a user.
        
        GET /api/learner-insights/latest/?user_id=...
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        insight_service = InsightService()
        insight = insight_service.get_latest_insight(UUID(user_id))
        
        if not insight:
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        return Response(LearnerInsightSerializer(insight).data)
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        Get insight history for a user.
        
        GET /api/learner-insights/history/?user_id=...&limit=10
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        limit = int(request.query_params.get('limit', 10))
        
        insight_service = InsightService()
        insights = insight_service.get_insight_history(UUID(user_id), limit=limit)
        
        return Response(LearnerInsightSummarySerializer(insights, many=True).data)


class RecommendationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for recommendations.
    
    Recommendations are ADVISORY OUTPUTS:
    - GET: Read recommendations (allowed)
    - POST generate: Trigger new recommendations (allowed)
    - POST action: View/Accept/Dismiss (allowed - only updates status)
    
    ⚠️ CRITICAL: Recommendations suggest actions but NEVER auto-apply.
    ⚠️ Phase 6 MUST NOT mutate study plans or content based on recommendations.
    """
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer
    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter recommendations by user_id and status."""
        queryset = super().get_queryset()
        
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority__lte=int(priority))
        
        return queryset.order_by('priority', '-confidence_score', '-created_at')
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Generate new recommendations for a user.
        
        POST /api/recommendations/generate/
        {"user_id": "...", "max_recommendations": 10}
        
        ⚠️ This generates ADVISORY recommendations.
        ⚠️ No automatic actions are taken.
        """
        serializer = GenerateRecommendationsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        recommendation_service = RecommendationService()
        batch = recommendation_service.generate_recommendations(
            user_id=serializer.validated_data['user_id'],
            max_recommendations=serializer.validated_data['max_recommendations'],
            save=True,
        )
        
        # Fetch saved recommendations
        recs = recommendation_service.get_active_recommendations(
            user_id=serializer.validated_data['user_id'],
            limit=serializer.validated_data['max_recommendations'],
        )
        
        return Response({
            "count": len(recs),
            "recommendations": RecommendationSerializer(recs, many=True).data,
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def perform_action(self, request, pk=None):
        """
        Perform an action on a recommendation.
        
        POST /api/recommendations/{id}/perform_action/
        {"action": "view|accept|dismiss"}
        
        ⚠️ Actions only update status.
        ⚠️ No automatic behavior is triggered.
        """
        serializer = RecommendationActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        action = serializer.validated_data['action']
        recommendation_service = RecommendationService()
        
        if action == 'view':
            success = recommendation_service.mark_viewed(UUID(pk))
        elif action == 'accept':
            success = recommendation_service.mark_accepted(UUID(pk))
        elif action == 'dismiss':
            success = recommendation_service.mark_dismissed(UUID(pk))
        else:
            return Response(
                {"error": f"Unknown action: {action}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not success:
            return Response(
                {"error": "Recommendation not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Return updated recommendation
        rec = Recommendation.objects.get(pk=pk)
        return Response(RecommendationSerializer(rec).data)
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """
        Get active recommendations for a user.
        
        GET /api/recommendations/active/?user_id=...
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        limit = int(request.query_params.get('limit', 20))
        
        recommendation_service = RecommendationService()
        recs = recommendation_service.get_active_recommendations(
            user_id=UUID(user_id),
            limit=limit,
        )
        
        return Response(RecommendationSerializer(recs, many=True).data)
    
    @action(detail=False, methods=['get'])
    def high_priority(self, request):
        """
        Get high priority recommendations for a user.
        
        GET /api/recommendations/high_priority/?user_id=...
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        limit = int(request.query_params.get('limit', 5))
        
        recommendation_service = RecommendationService()
        recs = recommendation_service.get_high_priority_recommendations(
            user_id=UUID(user_id),
            limit=limit,
        )
        
        return Response(RecommendationSerializer(recs, many=True).data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get recommendation statistics for a user.
        
        GET /api/recommendations/stats/?user_id=...
        """
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        recommendation_service = RecommendationService()
        stats = recommendation_service.get_recommendation_stats(UUID(user_id))
        
        return Response(RecommendationStatsSerializer(stats).data)
    
    @action(detail=False, methods=['post'])
    def expire_old(self, request):
        """
        Expire old recommendations.
        
        POST /api/recommendations/expire_old/
        {"user_id": "..."} (optional)
        
        This is an admin/maintenance endpoint.
        """
        user_id = request.data.get('user_id')
        
        recommendation_service = RecommendationService()
        count = recommendation_service.expire_old_recommendations(
            user_id=UUID(user_id) if user_id else None
        )
        
        return Response({"expired_count": count})
