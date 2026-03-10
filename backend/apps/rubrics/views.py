"""
ViewSet for RubricSet with CRUD operations and custom actions.
"""

import os
import tempfile
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import RubricSet, QuestionRubric
from .serializers import (
    RubricSetSerializer, RubricSetListSerializer,
    RubricSetVersionSerializer, RubricSetPublishSerializer,
    QuestionRubricSerializer
)
from .pdf_parser import parse_rubric_document
from .services import evaluate_answer


class RubricSetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing RubricSets (multi-question assessments).
    
    Endpoints:
    - POST /api/rubric-sets/ → create draft rubric set
    - GET /api/rubric-sets/ → list rubric sets
    - GET /api/rubric-sets/{id}/ → retrieve rubric set
    - PUT /api/rubric-sets/{id}/ → update rubric set
    - PATCH /api/rubric-sets/{id}/ → partial update rubric set
    - DELETE /api/rubric-sets/{id}/ → delete rubric set (only if state=draft)
    - POST /api/rubric-sets/{id}/publish/ → publish rubric set
    - POST /api/rubric-sets/{id}/archive/ → archive rubric set
    - GET /api/rubric-sets/{id}/versions/ → get version history
    - POST /api/rubric-sets/parse_document/ → parse rubric from uploaded PDF
    """
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    def get_queryset(self):
        """Return rubric sets, optionally filtered by state and/or subject."""
        qs = RubricSet.objects.all().prefetch_related('questions', 'versions')
        state = self.request.query_params.get('state')
        subject = self.request.query_params.get('subject')
        if state:
            qs = qs.filter(state=state)
        if subject:
            qs = qs.filter(subject__iexact=subject)
        return qs
    
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
        """Update a rubric set. All rubric sets can be updated."""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
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
    
    @action(detail=True, methods=['post'])
    def create_draft_copy(self, request, pk=None):
        """
        Create a draft copy of an existing rubric set for editing.
        This allows editing of published rubrics by creating a new draft version.
        """
        original = self.get_object()
        
        # Create a new draft rubric set based on the original
        draft_data = {
            'title': f"{original.title} (Copy)",
            'subject': original.subject,
            'total_marks': original.total_marks,
            'metadata': original.metadata or {},
        }
        
        # Create the new draft rubric set
        draft_rubric = RubricSet.objects.create(**draft_data)
        
        # Copy all questions with their evaluation rules
        for question in original.questions.all():
            QuestionRubric.objects.create(
                rubric_set=draft_rubric,
                question_number=question.question_number,
                question_text=question.question_text,
                max_marks=question.max_marks,
                evaluation_rules=question.evaluation_rules
            )
        
        serializer = RubricSetSerializer(draft_rubric)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a rubric set."""
        instance = self.get_object()
        versions = instance.versions.all()
        serializer = RubricSetVersionSerializer(versions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='test')
    def test(self, request):
        """
        Test rubric evaluation logic against sample answers without saving.

        Request body:
        {
            "rubric_set": {
                "questions": [
                    {
                        "question_number": 1,
                        "question_text": "...",
                        "max_marks": 10.0,
                        "evaluation_rules": [...]
                    }
                ]
            },
            "answers": { "1": "Student answer for question 1." }
        }

        Response:
        {
            "total_score": 7.5,
            "max_score": 10.0,
            "percentage": 75.0,
            "question_results": [
                {
                    "question_number": 1,
                    "question_text": "...",
                    "score": 7.5,
                    "max_marks": 10.0,
                    "percentage": 75.0,
                    "rule_results": [...],
                    "feedback": "..."
                }
            ],
            "feedback": "Overall Score: ..."
        }
        """
        rubric_set = request.data.get("rubric_set")
        answers = request.data.get("answers", {})

        if not rubric_set:
            return Response(
                {"detail": "Missing required field: 'rubric_set'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        questions = rubric_set.get("questions")
        if not isinstance(questions, list) or not questions:
            return Response(
                {"detail": "'rubric_set.questions' must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(answers, dict):
            return Response(
                {"detail": "'answers' must be an object mapping question_number to answer text."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            question_results = []
            total_score = 0.0
            max_score = 0.0

            for question in questions:
                q_num = question.get("question_number", 0)
                q_text = question.get("question_text", "")
                q_max = float(question.get("max_marks", 0))
                rules = question.get("evaluation_rules", [])

                # Look up the answer by question_number (may be int or str key)
                answer_text = answers.get(q_num) or answers.get(str(q_num)) or ""

                rubric_dict = {
                    "evaluation_rules": rules,
                    "total_marks": q_max,
                }
                result = evaluate_answer(rubric_dict, answer_text)

                question_results.append({
                    "question_number": q_num,
                    "question_text": q_text,
                    "score": result["total_score"],
                    "max_marks": q_max,
                    "percentage": result["percentage"],
                    "rule_results": result["rule_results"],
                    "feedback": result["feedback"],
                })
                total_score += result["total_score"]
                max_score += q_max

            total_score = round(total_score, 2)
            max_score = round(max_score, 2)
            overall_percentage = round((total_score / max_score * 100), 1) if max_score > 0 else 0.0

            return Response({
                "total_score": total_score,
                "max_score": max_score,
                "percentage": overall_percentage,
                "question_results": question_results,
                "feedback": f"Overall Score: {total_score}/{max_score} ({overall_percentage}%)",
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"detail": f"Evaluation error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def parse_document(self, request):
        """
        Parse a rubric document (PDF) to extract questions and marking schemes.
        
        Request:
        - file: PDF file containing rubric/marking scheme
        
        Response:
        {
            "title": "Document title",
            "subject": "Subject area",
            "total_marks": 100,
            "questions": [
                {
                    "question_number": 1,
                    "question_text": "...",
                    "max_marks": 10,
                    "evaluation_rules": [...]
                },
                ...
            ]
        }
        """
        if 'file' not in request.FILES:
            return Response(
                {"detail": "No file uploaded. Please provide a PDF file."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['file']
        
        # Validate file type
        if not uploaded_file.name.endswith('.pdf'):
            return Response(
                {"detail": "Only PDF files are supported."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save file temporarily
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_path = temp_file.name
            
            # Parse the document
            rubric_data = parse_rubric_document(temp_path)
            
            # Clean up temp file
            os.unlink(temp_path)
            
            return Response(rubric_data, status=status.HTTP_200_OK)
            
        except ValueError as e:
            # Clean up temp file if it exists
            if 'temp_path' in locals():
                try:
                    os.unlink(temp_path)
                except:
                    pass
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Clean up temp file if it exists
            if 'temp_path' in locals():
                try:
                    os.unlink(temp_path)
                except:
                    pass
            return Response(
                {"detail": f"Error processing document: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
