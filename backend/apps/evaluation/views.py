import logging

from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.files.storage import default_storage
from django.db.models import Q, Avg, Count, Case, When, IntegerField, F
from django.utils import timezone
from datetime import timedelta
import os
import tempfile

from apps.authentication.backends import CustomUserJWTAuthentication
from apps.students.models import TeacherSubjectAssignment, StudentProfile

from .models import (
    AnswerScript,
    ScriptPage,
    QuestionEvaluation,
    ScriptSubmissionForm,
)
from .serializers import (
    AnswerScriptListSerializer,
    AnswerScriptDetailSerializer,
    AnswerScriptCreateSerializer,
    ScriptPageSerializer,
    QuestionEvaluationSerializer,
    ScriptSubmissionFormSerializer,
    ScriptSubmissionFormCreateSerializer,
    AnswerScriptListEnhancedSerializer,
    StudentScriptSubmitSerializer,
)
from .services import ScriptEvaluationService

logger = logging.getLogger(__name__)



class AnswerScriptViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing answer scripts.
    
    Endpoints:
    - GET /api/evaluation/scripts/ - List all scripts (scoped to teacher's sections)
    - POST /api/evaluation/scripts/ - Upload new script (teacher manual upload)
    - GET /api/evaluation/scripts/{id}/ - Get script details
    - DELETE /api/evaluation/scripts/{id}/ - Delete script
    - POST /api/evaluation/scripts/{id}/evaluate/ - Trigger evaluation
    - GET /api/evaluation/scripts/{id}/report/ - Get evaluation report
    """
    queryset = AnswerScript.objects.all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == "list":
            return AnswerScriptListEnhancedSerializer
        elif self.action == "create":
            return AnswerScriptCreateSerializer
        return AnswerScriptDetailSerializer
    
    def get_queryset(self):
        user = self.request.user
        queryset = AnswerScript.objects.select_related(
            "rubric_set", "student_user", "submission_form"
        ).prefetch_related("pages")

        # Scope to scripts owned by this teacher only
        if user.role == "teacher":
            queryset = queryset.filter(
                Q(uploaded_by=user)
                | Q(submission_form__assignment__teacher=user)
            ).distinct()

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
        
        if not script.rubric_set:
            return Response(
                {"detail": "Cannot evaluate: No rubric set associated with this script."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
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
            import traceback
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Evaluation failed for script {script.id}: {str(e)}")
            logger.error(traceback.format_exc())
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
            # Calculate marks breakdown (30% method, 40% calculation, 30% answer)
            total_max = float(evaluation.question_rubric.max_marks)
            method_max = total_max * 0.3
            calc_max = total_max * 0.4
            answer_max = total_max * 0.3
            
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


# ─── Submission Form Views (Teacher) ─────────────────────────────────────────


class SubmissionFormListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/evaluation/forms/       → list teacher's submission forms
    POST /api/evaluation/forms/       → create a new submission form
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ScriptSubmissionFormCreateSerializer
        return ScriptSubmissionFormSerializer

    def get_queryset(self):
        # Teacher sees only their own forms
        return (
            ScriptSubmissionForm.objects.filter(
                assignment__teacher=self.request.user
            )
            .select_related(
                "assignment__subject",
                "assignment__section__class_ref",
                "assignment__teacher",
            )
            .prefetch_related("scripts")
        )

    def perform_create(self, serializer):
        serializer.save()


class SubmissionFormDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/evaluation/forms/<id>/   → form detail
    PATCH /api/evaluation/forms/<id>/   → close/reopen form (status field)
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ScriptSubmissionFormSerializer

    def get_queryset(self):
        return (
            ScriptSubmissionForm.objects.filter(
                assignment__teacher=self.request.user
            )
            .select_related(
                "assignment__subject",
                "assignment__section__class_ref",
                "assignment__teacher",
            )
            .prefetch_related("scripts")
        )

    def patch(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get("status")
        if new_status and new_status in ("open", "closed"):
            instance.status = new_status
            instance.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(instance).data)


class SubmissionFormScriptsView(generics.ListAPIView):
    """
    GET /api/evaluation/forms/<form_id>/submissions/
    List all scripts submitted to a specific form.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AnswerScriptListEnhancedSerializer
    pagination_class = None

    def get_queryset(self):
        form_id = self.kwargs["form_id"]
        form = get_object_or_404(
            ScriptSubmissionForm,
            pk=form_id,
            assignment__teacher=self.request.user,
        )
        return (
            AnswerScript.objects.filter(submission_form=form)
            .select_related("rubric_set", "student_user")
            .prefetch_related("pages")
        )


class BatchEvaluateView(APIView):
    """
    POST /api/evaluation/forms/<form_id>/evaluate-all/
    Body: { "rubric_set_id": "<uuid>" }

    Evaluates all pending scripts in this form using the given rubric.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, form_id):
        form = get_object_or_404(
            ScriptSubmissionForm,
            pk=form_id,
            assignment__teacher=request.user,
        )

        rubric_set_id = request.data.get("rubric_set_id")
        if not rubric_set_id:
            return Response(
                {"detail": "rubric_set_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.rubrics.models import RubricSet

        try:
            rubric_set = RubricSet.objects.get(pk=rubric_set_id)
        except RubricSet.DoesNotExist:
            return Response(
                {"detail": "Rubric set not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        pending_scripts = form.scripts.filter(status="pending")

        if not pending_scripts.exists():
            return Response(
                {"detail": "No pending scripts to evaluate."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Assign rubric to all pending scripts that don't have one
        pending_scripts.filter(rubric_set__isnull=True).update(rubric_set=rubric_set)

        results = {"total": pending_scripts.count(), "success": 0, "failed": 0, "errors": []}

        service = ScriptEvaluationService()
        for script in pending_scripts:
            try:
                if not script.rubric_set:
                    script.rubric_set = rubric_set
                    script.save(update_fields=["rubric_set"])
                service.evaluate_script(script)
                results["success"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(
                    {"script_id": str(script.id), "error": str(e)}
                )
                logger.error(f"Batch evaluate failed for script {script.id}: {e}")

        return Response(results, status=status.HTTP_200_OK)


# ─── Student Submission Views ────────────────────────────────────────────────


class StudentOpenFormsView(generics.ListAPIView):
    """
    GET /api/evaluation/my-forms/
    Lists open submission forms available to the logged-in student
    based on their section's teaching assignments.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ScriptSubmissionFormSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        try:
            student_profile = user.student_profile
        except StudentProfile.DoesNotExist:
            return ScriptSubmissionForm.objects.none()

        if not student_profile.section:
            return ScriptSubmissionForm.objects.none()

        return (
            ScriptSubmissionForm.objects.filter(
                status="open",
                assignment__section=student_profile.section,
            )
            .select_related(
                "assignment__subject",
                "assignment__section__class_ref",
                "assignment__teacher",
            )
            .prefetch_related("scripts")
        )


class StudentSubmitScriptView(APIView):
    """
    POST /api/evaluation/my-forms/<form_id>/submit/
    Student uploads script pages to an open submission form.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, form_id):
        user = request.user

        try:
            student_profile = user.student_profile
        except StudentProfile.DoesNotExist:
            return Response(
                {"detail": "Student profile not found."},
                status=status.HTTP_403_FORBIDDEN,
            )

        form = get_object_or_404(ScriptSubmissionForm, pk=form_id)

        # Verify the form is open
        if form.status != "open":
            return Response(
                {"detail": "This submission form is closed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify student belongs to the section
        if student_profile.section != form.assignment.section:
            return Response(
                {"detail": "You are not in the section for this form."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check for duplicate submission
        if AnswerScript.objects.filter(
            submission_form=form, student_user=user
        ).exists():
            return Response(
                {"detail": "You have already submitted to this form."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = StudentScriptSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pages_data = serializer.validated_data["pages"]

        # Create the answer script
        script = AnswerScript.objects.create(
            student_user=user,
            submission_form=form,
            student_name=f"{user.first_name} {user.last_name}",
            student_id=student_profile.roll_number,
        )

        for i, page_image in enumerate(pages_data, start=1):
            ScriptPage.objects.create(
                script=script,
                page_number=i,
                image=page_image,
            )

        # Record SCRIPT_SUBMITTED learning event (non-blocking)
        try:
            from apps.intelligence.services.event_service import EventService
            topic = None
            if form.assignment and hasattr(form.assignment, 'subject'):
                topic = form.assignment.subject.name
            EventService().record_event(
                event_type='script_submitted',
                user_id=user.id,
                topic=topic,
                metadata={'script_id': str(script.id)},
            )
        except Exception:
            pass

        return Response(
            AnswerScriptListEnhancedSerializer(script).data,
            status=status.HTTP_201_CREATED,
        )


class StudentMyScriptsView(generics.ListAPIView):
    """
    GET /api/evaluation/my-scripts/
    Student's own submitted scripts with results.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AnswerScriptListEnhancedSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            AnswerScript.objects.filter(student_user=self.request.user)
            .select_related("rubric_set", "student_user", "submission_form__assignment__subject")
            .prefetch_related("pages")
        )


# ─── Evaluation Insights (Teacher) ──────────────────────────────────────────


class EvaluationInsightsView(APIView):
    """
    GET /api/evaluation/insights/
    Returns aggregated evaluation analytics scoped to the logged-in teacher's
    assigned sections/subjects.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # All sections this teacher is assigned to
        teacher_sections = TeacherSubjectAssignment.objects.filter(
            teacher=user
        ).values_list("section_id", flat=True)

        # All scripts the teacher can see
        scripts = AnswerScript.objects.filter(
            Q(uploaded_by=user)
            | Q(submission_form__assignment__teacher=user)
            | Q(student_user__student_profile__section_id__in=teacher_sections)
        ).distinct()

        total_scripts = scripts.count()
        evaluated_scripts = scripts.filter(status="evaluated")
        pending_scripts = scripts.filter(status="pending")

        agg = evaluated_scripts.aggregate(
            avg_score=Avg("total_score"),
            avg_percentage=Avg("percentage"),
        )

        # ── Section Performance ──────────────────────────────────────────
        section_perf = (
            evaluated_scripts
            .filter(
                student_user__student_profile__section__isnull=False,
            )
            .values(
                section_name=F("student_user__student_profile__section__name"),
                class_name=F("student_user__student_profile__section__class_ref__name"),
            )
            .annotate(
                avg_percentage=Avg("percentage"),
                script_count=Count("id"),
            )
            .order_by("class_name", "section_name")
        )

        # ── Score Distribution (10 buckets) ──────────────────────────────
        buckets = []
        for lo in range(0, 100, 10):
            hi = lo + 10
            label = f"{lo}-{hi}"
            cnt = evaluated_scripts.filter(
                percentage__gte=lo,
                percentage__lt=(hi if hi < 100 else 101),
            ).count()
            buckets.append({"bucket": label, "count": cnt})

        # ── Question Analysis (from the most recent submission form) ─────
        recent_form = (
            ScriptSubmissionForm.objects.filter(assignment__teacher=user)
            .order_by("-created_at")
            .first()
        )
        question_analysis = []
        if recent_form:
            form_scripts = evaluated_scripts.filter(submission_form=recent_form)
            q_stats = (
                QuestionEvaluation.objects.filter(script__in=form_scripts)
                .values(
                    question_number=F("question_rubric__question_number"),
                    question_text=F("question_rubric__question_text"),
                    max_marks=F("question_rubric__max_marks"),
                )
                .annotate(avg_marks=Avg("total_marks_awarded"))
                .order_by("question_number")
            )
            question_analysis = list(q_stats)
            # Convert Decimal to float for JSON
            for q in question_analysis:
                q["avg_marks"] = float(q["avg_marks"]) if q["avg_marks"] else 0
                q["max_marks"] = float(q["max_marks"]) if q["max_marks"] else 0

        # ── Top / Bottom Performers ──────────────────────────────────────
        student_avgs = (
            evaluated_scripts
            .filter(student_user__isnull=False)
            .values("student_user")
            .annotate(avg_pct=Avg("percentage"), script_count=Count("id"))
            .filter(script_count__gte=1)
        )

        def _build_performer(entry):
            try:
                sp = StudentProfile.objects.select_related(
                    "user", "section__class_ref"
                ).get(user_id=entry["student_user"])
                return {
                    "user_id": str(sp.user_id),
                    "name": f"{sp.user.first_name} {sp.user.last_name}",
                    "roll_number": sp.roll_number,
                    "section": sp.section.name if sp.section else "",
                    "class_name": sp.section.class_ref.name if sp.section else "",
                    "avg_percentage": round(float(entry["avg_pct"]), 1),
                    "script_count": entry["script_count"],
                }
            except StudentProfile.DoesNotExist:
                return None

        top_entries = student_avgs.order_by("-avg_pct")[:5]
        bottom_entries = student_avgs.order_by("avg_pct")[:5]

        top_performers = [p for p in (_build_performer(e) for e in top_entries) if p]
        bottom_performers = [p for p in (_build_performer(e) for e in bottom_entries) if p]

        # ── Submission Timeline (last 30 days, weekly) ───────────────────
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        recent_scripts = scripts.filter(created_at__gte=thirty_days_ago)

        timeline = []
        for week_offset in range(4, -1, -1):
            week_start = now - timedelta(days=7 * (week_offset + 1))
            week_end = now - timedelta(days=7 * week_offset)
            submitted = recent_scripts.filter(
                created_at__gte=week_start, created_at__lt=week_end
            ).count()
            evaluated = recent_scripts.filter(
                created_at__gte=week_start,
                created_at__lt=week_end,
                status="evaluated",
            ).count()
            timeline.append({
                "week": week_start.strftime("%b %d"),
                "submitted": submitted,
                "evaluated": evaluated,
            })

        return Response({
            "overview": {
                "total_scripts": total_scripts,
                "evaluated_count": evaluated_scripts.count(),
                "pending_count": pending_scripts.count(),
                "avg_score": round(float(agg["avg_score"] or 0), 1),
                "avg_percentage": round(float(agg["avg_percentage"] or 0), 1),
            },
            "section_performance": list(section_perf),
            "score_distribution": buckets,
            "question_analysis": question_analysis,
            "top_performers": top_performers,
            "bottom_performers": bottom_performers,
            "submission_timeline": timeline,
        })
