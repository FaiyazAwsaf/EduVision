"""
ViewSet for RubricSet with CRUD operations and custom actions.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import RubricSet, QuestionRubric
from .rubric_set_serializers import (
    RubricSetSerializer, RubricSetListSerializer,
    RubricSetVersionSerializer, RubricSetPublishSerializer,
    QuestionRubricSerializer
)
from .rubric_set_services import evaluate_rubric_set


class RubricSetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing RubricSets (multi-question assessments).
    
    Endpoints:
    - POST /api/rubric-sets/ → create draft rubric set
    - GET /api/rubric-sets/ → list rubric sets
    - GET /api/rubric-sets/{id}/ → retrieve rubric set
    - PUT /api/rubric-sets/{id}/ → update rubric set (only if state=draft)
    - PATCH /api/rubric-sets/{id}/ → partial update rubric set (only if state=draft)
    - DELETE /api/rubric-sets/{id}/ → delete rubric set (only if state=draft)
    - POST /api/rubric-sets/{id}/publish/ → publish rubric set
    - POST /api/rubric-sets/{id}/archive/ → archive rubric set
    - GET /api/rubric-sets/{id}/versions/ → get version history
    - POST /api/rubric-sets/test/ → test rubric set without saving
    """
    
    def get_queryset(self):
        """Return all rubric sets with prefetched questions."""
        return RubricSet.objects.all().prefetch_related('questions', 'versions')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'list':
            return RubricSetListSerializer
        elif self.action == 'publish':
            return RubricSetPublishSerializer
        return RubricSetSerializer
    
    def perform_create(self, serializer):
        """Save the rubric set. Ownership (created_by) is handled in the serializer."""
        serializer.save()
    
    def update(self, request, *args, **kwargs):
        """Update a rubric set. Only draft rubric sets can be updated."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Check if rubric set is editable
        if instance.state != RubricSet.STATE_DRAFT:
            return Response(
                {"detail": f"Cannot edit {instance.state} rubric sets. Only draft rubric sets can be modified."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Delete a rubric set. Only draft rubric sets can be deleted."""
        instance = self.get_object()
        
        # Only allow deletion of draft rubric sets
        if instance.state != RubricSet.STATE_DRAFT:
            return Response(
                {"detail": f"Cannot delete {instance.state} rubric sets. Only draft rubric sets can be deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """
        Publish a draft rubric set. Published rubric sets become read-only.
        
        Logic:
        - Validate that sum of question marks == total_marks
        - Validate that each question has rules and rule marks == max_marks
        - Change state from draft → published
        - Increment version
        - Save full rubric set snapshot into rubric_set_versions
        """
        instance = self.get_object()
        
        # Check if rubric set is in draft state
        if instance.state != RubricSet.STATE_DRAFT:
            return Response(
                {"detail": f"Cannot publish {instance.state} rubric sets. Only draft rubric sets can be published."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Use publish serializer for validation
        serializer = RubricSetPublishSerializer(
            data={},
            context={'rubric_set': instance}
        )
        
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Change state to published (version bump will be handled by model's save method)
        instance.state = RubricSet.STATE_PUBLISHED
        instance.save()
        
        response_serializer = RubricSetSerializer(instance)
        return Response(response_serializer.data)
    
    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        """Archive a published rubric set."""
        instance = self.get_object()
        
        # Only published rubric sets can be archived
        if instance.state != RubricSet.STATE_PUBLISHED:
            return Response(
                {"detail": f"Cannot archive {instance.state} rubric sets. Only published rubric sets can be archived."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update state to archived
        instance.state = RubricSet.STATE_ARCHIVED
        instance.save()
        
        serializer = RubricSetSerializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a rubric set."""
        instance = self.get_object()
        versions = instance.versions.all()
        serializer = RubricSetVersionSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def test(self, request):
        """
        Test a rubric set against sample answers without saving.
        
        Request body:
        {
            "rubric_set": {
                "questions": [
                    {
                        "question_number": 1,
                        "question_text": "...",
                        "max_marks": 5.0,
                        "evaluation_rules": [...]
                    },
                    ...
                ]
            },
            "answers": {
                "1": "answer for question 1",
                "2": "answer for question 2",
                ...
            }
        }
        
        Response:
        {
            "total_score": 15.5,
            "max_score": 20.0,
            "percentage": 77.5,
            "question_results": [...],
            "feedback": "..."
        }
        """
        rubric_set_data = request.data.get('rubric_set')
        answers_data = request.data.get('answers', {})
        
        if not rubric_set_data:
            return Response(
                {"detail": "'rubric_set' is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not rubric_set_data.get('questions'):
            return Response(
                {"detail": "Rubric set must contain at least one question"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Convert string keys to integers
        answers = {}
        for key, value in answers_data.items():
            try:
                answers[int(key)] = value
            except (ValueError, TypeError):
                return Response(
                    {"detail": f"Invalid question number in answers: {key}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            # Apply the rubric set evaluation
            result = evaluate_rubric_set(rubric_set_data, answers)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"Error evaluating answers: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
