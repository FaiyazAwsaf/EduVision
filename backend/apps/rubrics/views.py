from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Rubric, RubricVersion
from .serializers import (
    RubricSerializer, RubricListSerializer,
    RubricVersionSerializer, RubricPublishSerializer
)
from .services import apply_rubric


class RubricViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Rubrics.
    
    Endpoints:
    - POST /api/rubrics/ → create draft rubric
    - GET /api/rubrics/ → list rubrics created by current user
    - GET /api/rubrics/{id}/ → retrieve rubric
    - PUT /api/rubrics/{id}/ → update rubric (only if state=draft)
    - PATCH /api/rubrics/{id}/ → partial update rubric (only if state=draft)
    - DELETE /api/rubrics/{id}/ → delete rubric (only if state=draft)
    """
    
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """
        Filter rubrics to only show those created by the current user.
        """
        user = self.request.user
        
        # Convert user ID to UUID format if needed
        if hasattr(user, 'id'):
            user_id = user.id
        else:
            # For testing or when user ID is not available
            return Rubric.objects.none()
        
        return Rubric.objects.filter(created_by=user_id).select_related().prefetch_related('versions')
    
    def get_serializer_class(self):
        """
        Return appropriate serializer based on action.
        """
        if self.action == 'list':
            return RubricListSerializer
        elif self.action == 'publish':
            return RubricPublishSerializer
        return RubricSerializer
    
    def perform_create(self, serializer):
        """
        Save the rubric. Ownership (created_by) is handled in the serializer.
        """
        serializer.save()
    
    def create(self, request, *args, **kwargs):
        """
        Create a new draft rubric.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )
    
    def update(self, request, *args, **kwargs):
        """
        Update a rubric. Only draft rubrics can be updated.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check ownership - compare UUID's integer value with user ID
        if instance.created_by.int != request.user.id:
            return Response(
                {"detail": "You do not have permission to edit this rubric."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if rubric is editable
        if instance.state != Rubric.STATE_DRAFT:
            return Response(
                {"detail": f"Cannot edit {instance.state} rubrics. Only draft rubrics can be modified."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a rubric. Only draft rubrics can be deleted.
        """
        instance = self.get_object()
        
        # Check ownership - compare UUID's integer value with user ID
        if instance.created_by.int != request.user.id:
            return Response(
                {"detail": "You do not have permission to delete this rubric."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only allow deletion of draft rubrics
        if instance.state != Rubric.STATE_DRAFT:
            return Response(
                {"detail": f"Cannot delete {instance.state} rubrics. Only draft rubrics can be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """
        Publish a draft rubric. Published rubrics become read-only.
        
        Logic:
        - Validate sum of rule marks == total_marks
        - Change state from draft → published
        - Increment version
        - Save full rubric snapshot into rubric_versions
        - Prevent further edits after publishing
        """
        instance = self.get_object()
        
        # Check ownership - compare UUID's integer value with user ID
        if instance.created_by.int != request.user.id:
            return Response(
                {"detail": "You do not have permission to publish this rubric."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if rubric is in draft state
        if instance.state != Rubric.STATE_DRAFT:
            return Response(
                {"detail": f"Cannot publish {instance.state} rubrics. Only draft rubrics can be published."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate that sum of rule marks equals total_marks
        if instance.evaluation_rules:
            rules_total = sum(float(rule.get('marks', 0)) for rule in instance.evaluation_rules)
            total_marks = float(instance.total_marks)
            
            if abs(rules_total - total_marks) > 0.01:  # Allow small floating point differences
                return Response(
                    {
                        "detail": f"Cannot publish: Sum of rule marks ({rules_total}) must equal total marks ({total_marks})"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            return Response(
                {"detail": "Cannot publish: At least one evaluation rule is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Change state to published (version bump will be handled by model's save method)
        instance.state = Rubric.STATE_PUBLISHED
        instance.save()
        
        serializer = RubricSerializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """
        Archive a published rubric.
        """
        instance = self.get_object()
        
        # Check ownership - compare UUID's integer value with user ID
        if instance.created_by.int != request.user.id:
            return Response(
                {"detail": "You do not have permission to archive this rubric."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only published rubrics can be archived
        if instance.state != Rubric.STATE_PUBLISHED:
            return Response(
                {"detail": f"Cannot archive {instance.state} rubrics. Only published rubrics can be archived."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update state to archived
        instance.state = Rubric.STATE_ARCHIVED
        instance.save()
        
        serializer = RubricSerializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """
        Get all versions of a rubric.
        """
        instance = self.get_object()
        versions = instance.versions.all()
        serializer = RubricVersionSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], permission_classes=[])
    def test(self, request):
        """
        Test a rubric against a sample answer without saving.
        
        This endpoint allows testing evaluation rules before creating/publishing a rubric.
        No authentication required for testing.
        
        Request body:
        {
            "rubric": {
                "evaluation_rules": [...],
                "total_marks": 10.0
            },
            "answer_text": "Student's answer text"
        }
        
        Response:
        {
            "total_score": 7.5,
            "max_score": 10.0,
            "rule_results": [...],
            "feedback": "Combined feedback summary"
        }
        """
        rubric_data = request.data.get('rubric')
        answer_text = request.data.get('answer_text')
        
        if not rubric_data or not answer_text:
            return Response(
                {"detail": "Both 'rubric' and 'answer_text' are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not rubric_data.get('evaluation_rules'):
            return Response(
                {"detail": "Rubric must contain 'evaluation_rules'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Apply the rubric to the answer text
            result = apply_rubric(rubric_data, answer_text)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"Error evaluating answer: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
