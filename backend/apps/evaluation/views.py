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
    QuestionPaper,
    Question,
    Rubric,
    AnswerScript,
    ScriptPage,
    QuestionEvaluation,
)
from .serializers import (
    QuestionPaperListSerializer,
    QuestionPaperDetailSerializer,
    QuestionPaperCreateSerializer,
    QuestionSerializer,
    QuestionCreateSerializer,
    RubricSerializer,
    AnswerScriptListSerializer,
    AnswerScriptDetailSerializer,
    AnswerScriptCreateSerializer,
    ScriptPageSerializer,
    QuestionEvaluationSerializer,
)
from .services import ScriptEvaluationService
from .pdf_service import PDFExtractionService


class QuestionPaperViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing question papers.
    
    Endpoints:
    - GET /api/evaluation/question-papers/ - List all question papers
    - POST /api/evaluation/question-papers/ - Create new question paper
    - GET /api/evaluation/question-papers/{id}/ - Get question paper details
    - PUT /api/evaluation/question-papers/{id}/ - Update question paper
    - DELETE /api/evaluation/question-papers/{id}/ - Delete question paper
    - POST /api/evaluation/question-papers/{id}/add-question/ - Add question to paper
    """
    queryset = QuestionPaper.objects.all()
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    
    def get_serializer_class(self):
        if self.action == "list":
            return QuestionPaperListSerializer
        elif self.action in ["create"]:
            return QuestionPaperCreateSerializer
        return QuestionPaperDetailSerializer
    
    @action(detail=True, methods=["post"])
    def add_question(self, request, pk=None):
        """Add a new question to an existing question paper."""
        question_paper = self.get_object()
        serializer = QuestionCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            question = serializer.save(question_paper=question_paper)
            
            # Update total marks
            question_paper.total_marks = question_paper.calculate_total_marks()
            question_paper.save()
            
            return Response(
                QuestionSerializer(question).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=["get"])
    def questions(self, request, pk=None):
        """Get all questions for a question paper."""
        question_paper = self.get_object()
        questions = question_paper.questions.all()
        serializer = QuestionSerializer(questions, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_pdf(self, request):
        """
        Upload a PDF file containing questions and/or rubrics.
        
        Parameters:
        - pdf: The PDF file
        - paper_type: "question", "rubric", or "combined" (default: "combined")
        - title: Optional title override
        - subject: Optional subject override  
        - class_level: Optional class level override ("9", "10", "11", "12")
        """
        if "pdf" not in request.FILES:
            return Response(
                {"detail": "No PDF file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        pdf_file = request.FILES["pdf"]
        paper_type = request.data.get("paper_type", "combined")
        
        # Validate file type
        if not pdf_file.name.lower().endswith('.pdf'):
            return Response(
                {"detail": "File must be a PDF"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save temporarily
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, pdf_file.name)
        
        try:
            with open(temp_path, 'wb+') as destination:
                for chunk in pdf_file.chunks():
                    destination.write(chunk)
            
            # Extract using Gemini
            pdf_service = PDFExtractionService()
            extracted_data = pdf_service.extract_from_pdf(temp_path, paper_type)
            
            # Create question paper
            question_paper = pdf_service.create_question_paper_from_extraction(
                extracted_data,
                title_override=request.data.get("title"),
                subject_override=request.data.get("subject"),
                class_level_override=request.data.get("class_level")
            )
            
            serializer = QuestionPaperDetailSerializer(question_paper)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {"detail": f"Failed to process PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)
    
    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_rubric_pdf(self, request, pk=None):
        """
        Upload a rubric/marking scheme PDF for an existing question paper.
        
        This updates the rubrics for existing questions.
        """
        question_paper = self.get_object()
        
        if "pdf" not in request.FILES:
            return Response(
                {"detail": "No PDF file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        pdf_file = request.FILES["pdf"]
        
        if not pdf_file.name.lower().endswith('.pdf'):
            return Response(
                {"detail": "File must be a PDF"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, pdf_file.name)
        
        try:
            with open(temp_path, 'wb+') as destination:
                for chunk in pdf_file.chunks():
                    destination.write(chunk)
            
            # Extract rubrics
            pdf_service = PDFExtractionService()
            rubric_data = pdf_service.extract_from_pdf(temp_path, "rubric")
            
            # Update question paper with rubrics
            updated_paper = pdf_service.update_rubrics_from_extraction(
                question_paper, rubric_data
            )
            
            serializer = QuestionPaperDetailSerializer(updated_paper)
            return Response(serializer.data)
            
        except Exception as e:
            return Response(
                {"detail": f"Failed to process rubric PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if os.path.exists(temp_dir):
                os.rmdir(temp_dir)


class QuestionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing individual questions.
    """
    queryset = Question.objects.all()
    parser_classes = [JSONParser]
    
    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return QuestionCreateSerializer
        return QuestionSerializer
    
    @action(detail=True, methods=["get", "put", "patch"])
    def rubric(self, request, pk=None):
        """Get or update the rubric for a question."""
        question = self.get_object()
        
        try:
            rubric = question.rubric
        except Rubric.DoesNotExist:
            if request.method == "GET":
                return Response(
                    {"detail": "No rubric defined for this question."},
                    status=status.HTTP_404_NOT_FOUND
                )
            rubric = None
        
        if request.method == "GET":
            serializer = RubricSerializer(rubric)
            return Response(serializer.data)
        
        elif request.method in ["PUT", "PATCH"]:
            if rubric:
                serializer = RubricSerializer(
                    rubric,
                    data=request.data,
                    partial=(request.method == "PATCH")
                )
            else:
                serializer = RubricSerializer(data=request.data)
            
            if serializer.is_valid():
                if rubric:
                    serializer.save()
                else:
                    serializer.save(question=question)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
        
        # Filter by question paper
        question_paper_id = self.request.query_params.get("question_paper")
        if question_paper_id:
            queryset = queryset.filter(question_paper_id=question_paper_id)
        
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
            "question_paper": {
                "title": script.question_paper.title,
                "subject": script.question_paper.subject,
                "class_level": script.question_paper.class_level,
                "total_marks": script.question_paper.total_marks,
            },
            "evaluation_summary": {
                "total_score": float(script.total_score) if script.total_score else 0,
                "max_score": script.question_paper.total_marks,
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
            question_result = {
                "question_number": evaluation.question.question_number,
                "question_text": evaluation.question.question_text,
                "question_type": evaluation.question.question_type,
                "marks": {
                    "method": {
                        "awarded": float(evaluation.method_marks_awarded),
                        "max": evaluation.question.rubric.method_marks if hasattr(evaluation.question, 'rubric') else 0,
                        "feedback": evaluation.method_feedback,
                    },
                    "calculation": {
                        "awarded": float(evaluation.calculation_marks_awarded),
                        "max": evaluation.question.rubric.calculation_marks if hasattr(evaluation.question, 'rubric') else 0,
                        "feedback": evaluation.calculation_feedback,
                    },
                    "answer": {
                        "awarded": float(evaluation.answer_marks_awarded),
                        "max": evaluation.question.rubric.answer_marks if hasattr(evaluation.question, 'rubric') else 0,
                        "feedback": evaluation.answer_feedback,
                    },
                    "total": float(evaluation.total_marks_awarded),
                    "max_total": evaluation.question.max_marks,
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
        if script.question_paper.total_marks > 0:
            script.percentage = (total / script.question_paper.total_marks) * 100
        script.save()
        
        return Response(QuestionEvaluationSerializer(evaluation).data)
