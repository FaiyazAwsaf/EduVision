"""
Study Plan API Views for Phase 5: Manual Study Plan Integration

These views provide RESTful endpoints for manual study plan management.
Phase 5: Manual mode only - no analytics, no AI recommendations.

[MODULE 3 INTEGRATION NOTES]
When Module 3 is integrated, these views should:
- Accept mode='ai' for analytics-driven plans
- Allow auto_detect_weakness=True
- Expose endpoints for analytics to inject detected weak topics
- Support priority recalculation based on analytics
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from ..models import StudyPlan, StudyPlanItem
from .serializers_study_plan import (
    StudyPlanSerializer,
    StudyPlanCreateSerializer,
    StudyPlanItemSerializer,
    StudyPlanItemCreateSerializer,
    StudyPlanItemUpdateSerializer
)


class StudyPlanViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing study plans.
    
    Endpoints:
    - POST /study-plans/ - Create new study plan
    - GET /study-plans/ - List all study plans
    - GET /study-plans/{id}/ - Get specific study plan with items
    - PATCH /study-plans/{id}/ - Update study plan
    - DELETE /study-plans/{id}/ - Delete study plan
    - POST /study-plans/{id}/items/ - Add item to study plan
    
    Phase 5: Manual mode only
    - mode='manual' enforced
    - auto_detect_weakness=False enforced
    
    [MODULE 3 HOOKS]
    Future endpoints to add when Module 3 is active:
    - POST /study-plans/{id}/detect-weaknesses/ - Trigger analytics scan
    - POST /study-plans/{id}/suggest-topics/ - Get analytics recommendations
    - GET /study-plans/{id}/analytics/ - Get analytics data for plan
    """
    
    queryset = StudyPlan.objects.all().prefetch_related('items')
    
    def get_serializer_class(self):
        """Use different serializers for create vs other actions."""
        if self.action == 'create':
            return StudyPlanCreateSerializer
        return StudyPlanSerializer
    
    def list(self, request):
        """
        List all study plans.
        
        [FUTURE] When auth is implemented:
        - Filter by user_id from request.user
        - Implement pagination
        """
        queryset = self.get_queryset()
        serializer = StudyPlanSerializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request):
        """
        Create a new study plan in manual mode.
        
        Phase 5: Always creates with mode='manual' and auto_detect_weakness=False
        
        Request body:
        {
            "name": "Math Study Plan",
            "user_id": "optional_user_id"  // nullable until auth integration
        }
        """
        serializer = StudyPlanCreateSerializer(data=request.data)
        if serializer.is_valid():
            study_plan = serializer.save()
            response_serializer = StudyPlanSerializer(study_plan)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, pk=None):
        """Get specific study plan with all items."""
        study_plan = get_object_or_404(StudyPlan, pk=pk)
        serializer = StudyPlanSerializer(study_plan)
        return Response(serializer.data)
    
    def partial_update(self, request, pk=None):
        """
        Update study plan fields.
        
        [MODULE 3 HOOK] When Module 3 is active:
        - Allow changing mode from 'manual' to 'ai'
        - Allow enabling auto_detect_weakness
        """
        study_plan = get_object_or_404(StudyPlan, pk=pk)
        serializer = StudyPlanSerializer(study_plan, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, pk=None):
        """Delete study plan and all its items."""
        study_plan = get_object_or_404(StudyPlan, pk=pk)
        study_plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'], url_path='items')
    def add_item(self, request, pk=None):
        """
        Add a new item to the study plan.
        
        POST /study-plans/{id}/items/
        
        Request body:
        {
            "topic": "Quadratic Equations",
            "priority": 2,
            "scheduled_date": "2025-01-15",
            "status": "pending",
            "linked_request_id": "uuid-of-content-request"  // optional
        }
        
        Phase 5: All items created with source='manual'
        
        [MODULE 3 HOOK] When Module 3 is active:
        - Analytics service can call this with source='analytics'
        - Include confidence_score for analytics-detected items
        """
        study_plan = get_object_or_404(StudyPlan, pk=pk)
        
        serializer = StudyPlanItemCreateSerializer(data=request.data)
        if serializer.is_valid():
            item = serializer.save(study_plan=study_plan)
            response_serializer = StudyPlanItemSerializer(item)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StudyPlanItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing individual study plan items.
    
    Endpoints:
    - GET /study-plan-items/ - List all items (filtered by study plan)
    - GET /study-plan-items/{id}/ - Get specific item
    - PATCH /study-plan-items/{id}/ - Update item (status, priority, etc.)
    - DELETE /study-plan-items/{id}/ - Delete item
    
    [MODULE 3 HOOKS]
    Future functionality when Module 3 is active:
    - PATCH can trigger source change from 'analytics' to 'mixed' when user modifies
    - Include analytics explanation in response
    - Support bulk priority recalculation
    """
    
    queryset = StudyPlanItem.objects.all().select_related('study_plan', 'linked_request')
    serializer_class = StudyPlanItemSerializer
    
    def get_serializer_class(self):
        """Use update serializer for PATCH requests."""
        if self.action in ['update', 'partial_update']:
            return StudyPlanItemUpdateSerializer
        return StudyPlanItemSerializer
    
    def list(self, request):
        """
        List study plan items.
        Can be filtered by study_plan_id query parameter.
        
        Query params:
        - study_plan_id: Filter items by study plan
        """
        queryset = self.get_queryset()
        
        # Filter by study plan if provided
        study_plan_id = request.query_params.get('study_plan_id')
        if study_plan_id:
            queryset = queryset.filter(study_plan_id=study_plan_id)
        
        serializer = StudyPlanItemSerializer(queryset, many=True)
        return Response(serializer.data)
    
    def retrieve(self, request, pk=None):
        """Get specific study plan item."""
        item = get_object_or_404(StudyPlanItem, pk=pk)
        serializer = StudyPlanItemSerializer(item)
        return Response(serializer.data)
    
    def partial_update(self, request, pk=None):
        """
        Update study plan item.
        
        Commonly used to:
        - Update status (pending -> in_progress -> completed)
        - Change priority
        - Update scheduled_date
        - Link/unlink content request
        
        [MODULE 3 HOOK] When user modifies analytics-generated item:
        - Change source from 'analytics' to 'mixed'
        - Preserve confidence_score for reference
        """
        item = get_object_or_404(StudyPlanItem, pk=pk)
        serializer = StudyPlanItemUpdateSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            updated_item = serializer.save()
            response_serializer = StudyPlanItemSerializer(updated_item)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, pk=None):
        """Delete study plan item."""
        item = get_object_or_404(StudyPlanItem, pk=pk)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'], url_path='complete')
    def mark_complete(self, request, pk=None):
        """
        Convenience endpoint to mark an item as completed.
        
        POST /study-plan-items/{id}/complete/
        
        [MODULE 3 HOOK] When Module 3 is active:
        - Trigger analytics update on completion
        - May auto-suggest next topics based on completion
        - Update mastery level tracking
        """
        item = get_object_or_404(StudyPlanItem, pk=pk)
        item.status = 'completed'
        item.save()
        
        serializer = StudyPlanItemSerializer(item)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], url_path='link-request')
    def link_request(self, request, pk=None):
        """
        Link a content request to this study plan item.
        
        POST /study-plan-items/{id}/link-request/
        
        Request body:
        {
            "request_id": "uuid-of-content-request"
        }
        """
        from ..models import ContentRequestModel
        
        item = get_object_or_404(StudyPlanItem, pk=pk)
        request_id = request.data.get('request_id')
        
        if not request_id:
            return Response(
                {"error": "request_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            content_request = ContentRequestModel.objects.get(id=request_id)
            item.linked_request = content_request
            item.save()
            
            serializer = StudyPlanItemSerializer(item)
            return Response(serializer.data)
        except ContentRequestModel.DoesNotExist:
            return Response(
                {"error": f"Content request with id {request_id} not found"},
                status=status.HTTP_404_NOT_FOUND
            )


# ============================================================================
# [MODULE 3 HOOKS] - Placeholder endpoints for future analytics integration
# ============================================================================
# 
# The following endpoints should be implemented when Module 3 is integrated:
#
# 1. POST /study-plans/{id}/detect-weaknesses/
#    - Trigger Module 3 weakness detection
#    - Automatically add weak topics as items with source='analytics'
#    - Set confidence_score based on analytics
#
# 2. GET /study-plans/{id}/analytics/
#    - Return analytics data for the study plan
#    - Topic mastery levels
#    - Weakness confidence scores
#    - Suggested priorities
#
# 3. POST /study-plans/{id}/recalculate-priorities/
#    - Trigger Module 3 priority recalculation
#    - Update item priorities based on:
#      - Current performance
#      - Topic dependencies
#      - Time constraints
#
# 4. GET /study-plan-items/{id}/analytics/
#    - Get analytics justification for this item
#    - Why it was suggested
#    - Performance data
#    - Related topics
#
# Example implementation structure (DO NOT IMPLEMENT YET):
#
# @action(detail=True, methods=['post'], url_path='detect-weaknesses')
# def detect_weaknesses(self, request, pk=None):
#     """
#     Trigger Module 3 weakness detection and inject topics.
#     Requires Module 3 integration.
#     """
#     study_plan = get_object_or_404(StudyPlan, pk=pk)
#     
#     if not study_plan.auto_detect_weakness:
#         return Response(
#             {"error": "auto_detect_weakness must be enabled"},
#             status=status.HTTP_400_BAD_REQUEST
#         )
#     
#     # Call Module 3 analytics service
#     # analytics_service.detect_weaknesses(study_plan)
#     
#     return Response({"message": "Weakness detection triggered"})
