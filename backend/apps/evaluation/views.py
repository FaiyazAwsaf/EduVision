from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
import os
import tempfile

from .models import (
    AnswerScript,
    ScriptPage,
    QuestionEvaluation,
)
from .serializers import (
    AnswerScriptListSerializer,
    AnswerScriptDetailSerializer,
    AnswerScriptCreateSerializer,
    ScriptPageSerializer,
    QuestionEvaluationSerializer,
)
from .services import ScriptEvaluationService



class AnswerScriptViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing answer scripts.
    
    Endpoints:
    - GET /api/evaluation/scripts/ - List all scripts
    - POST /api/evaluation/scripts/ - Upload new script
    - GET /api/evaluation/scripts/{id}/ - Get script details
    - DELETE /api/evaluation/scripts/{id}/ - Delete script
    - POST /api/evaluation/scripts/{id}/evaluate/ - Trigger evaluation
    - GET /api/evaluation/scripts/{id}/report/ - Get evaluation report
    """
    queryset = AnswerScript.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_serializer_class(self):
        if self.action == "list":
            return AnswerScriptListSerializer
        elif self.action == "create":
            return AnswerScriptCreateSerializer
        return AnswerScriptDetailSerializer
    
    def get_queryset(self):
        queryset = AnswerScript.objects.all()
        
        # Filter by rubric set
        rubric_set_id = self.request.query_params.get("rubric_set")
        if rubric_set_id:
            queryset = queryset.filter(rubric_set_id=rubric_set_id)
        
        # Filter by status
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    @action(detail=True, methods=["post"])
    def evaluate(self, request, pk=None):
        """
        Trigger evaluation of an answer script.
        
        This endpoint starts the AI-powered evaluation process.
        """
        script = self.get_object()
        
        if script.status == "processing":
            return Response(
                {"detail": "Script is already being processed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if script.status == "evaluated":
            # Allow re-evaluation
            # Clear existing evaluations
            script.question_evaluations.all().delete()
        
        try:
            service = ScriptEvaluationService()
            evaluated_script = service.evaluate_script(script)
            
            serializer = AnswerScriptDetailSerializer(
                evaluated_script,
                context={"request": request}
            )
            return Response(serializer.data)
            
        except Exception as e:
            return Response(
                {"detail": f"Evaluation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        """
        Get a detailed evaluation report for a script.
        """
        script = self.get_object()
        
        if script.status != "evaluated":
            return Response(
                {"detail": "Script has not been evaluated yet."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build comprehensive report
        evaluations = script.question_evaluations.all()
        
        report = {
            "script_id": str(script.id),
            "student_name": script.student_name,
            "student_id": script.student_id,
            "rubric_set": {
                "id": str(script.rubric_set.id),
                "title": script.rubric_set.title,
                "subject": script.rubric_set.subject,
                "total_marks": float(script.rubric_set.total_marks),
            },
            "evaluation_summary": {
                "total_score": float(script.total_score) if script.total_score else 0,
                "max_score": float(script.rubric_set.total_marks),
                "percentage": float(script.percentage) if script.percentage else 0,
                "status": script.status,
                "evaluated_at": script.evaluated_at.isoformat() if script.evaluated_at else None,
            },
            "question_results": [],
            "overall_feedback": {
                "summary": script.feedback_summary,
                "strengths": script.strengths,
                "areas_for_improvement": script.areas_for_improvement,
            }
        }
        
        # Add detailed question results
        for evaluation in evaluations:
            # Extract marking scheme from evaluation_rules
            eval_rules = evaluation.question_rubric.evaluation_rules or {}
            method_max = float(eval_rules.get('method_marks', 0))
            calc_max = float(eval_rules.get('calculation_marks', 0))
            answer_max = float(eval_rules.get('answer_marks', 0))
            
            question_result = {
                "question_number": evaluation.question_rubric.question_number,
                "question_text": evaluation.question_rubric.question_text,
                "marks": {
                    "method": {
                        "awarded": float(evaluation.method_marks_awarded),
                        "max": method_max,
                        "feedback": evaluation.method_feedback,
                    },
                    "calculation": {
                        "awarded": float(evaluation.calculation_marks_awarded),
                        "max": calc_max,
                        "feedback": evaluation.calculation_feedback,
                    },
                    "answer": {
                        "awarded": float(evaluation.answer_marks_awarded),
                        "max": answer_max,
                        "feedback": evaluation.answer_feedback,
                    },
                    "total": float(evaluation.total_marks_awarded),
                    "max_total": float(evaluation.question_rubric.max_marks),
                },
                "student_answer": evaluation.student_answer_text,
                "key_points_found": evaluation.key_points_found,
                "key_points_missing": evaluation.key_points_missing,
                "mistakes_identified": evaluation.mistakes_identified,
                "overall_feedback": evaluation.overall_feedback,
                "confidence_score": evaluation.confidence_score,
                "needs_manual_review": evaluation.needs_manual_review,
                "review_reason": evaluation.review_reason,
            }
            report["question_results"].append(question_result)
        
        return Response(report)
    
    @action(detail=True, methods=["post"])
    def add_page(self, request, pk=None):
        """Add an additional page to an existing script."""
        script = self.get_object()
        
        if script.pages.count() >= 10:
            return Response(
                {"detail": "Maximum 10 pages allowed per script."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if "image" not in request.FILES:
            return Response(
                {"detail": "No image provided."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        next_page_number = script.pages.count() + 1
        page = ScriptPage.objects.create(
            script=script,
            page_number=next_page_number,
            image=request.FILES["image"]
        )
        
        # Reset status if already evaluated
        if script.status == "evaluated":
            script.status = "pending"
            script.save()
        
        serializer = ScriptPageSerializer(page, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuestionEvaluationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing question evaluations (read-only).
    """
    queryset = QuestionEvaluation.objects.all()
    serializer_class = QuestionEvaluationSerializer
    
    def get_queryset(self):
        queryset = QuestionEvaluation.objects.all()
        
        # Filter by script
        script_id = self.request.query_params.get("script")
        if script_id:
            queryset = queryset.filter(script_id=script_id)
        
        # Filter by needs_manual_review
        needs_review = self.request.query_params.get("needs_review")
        if needs_review is not None:
            queryset = queryset.filter(needs_manual_review=needs_review.lower() == "true")
        
        return queryset
    
    @action(detail=True, methods=["patch"])
    def override_marks(self, request, pk=None):
        """
        Allow manual override of marks by a teacher.
        """
        evaluation = self.get_object()
        
        # Update marks if provided
        if "method_marks_awarded" in request.data:
            evaluation.method_marks_awarded = request.data["method_marks_awarded"]
        if "calculation_marks_awarded" in request.data:
            evaluation.calculation_marks_awarded = request.data["calculation_marks_awarded"]
        if "answer_marks_awarded" in request.data:
            evaluation.answer_marks_awarded = request.data["answer_marks_awarded"]
        if "overall_feedback" in request.data:
            evaluation.overall_feedback = request.data["overall_feedback"]
        
        # Mark as manually reviewed
        evaluation.needs_manual_review = False
        evaluation.review_reason = "Manually reviewed and adjusted"
        evaluation.save()
        
        # Recalculate script totals
        script = evaluation.script
        total = sum(
            e.total_marks_awarded
            for e in script.question_evaluations.all()
        )
        script.total_score = total
        if script.rubric_set.total_marks > 0:
            script.percentage = (total / script.rubric_set.total_marks) * 100
        script.save()
        
        return Response(QuestionEvaluationSerializer(evaluation).data)
