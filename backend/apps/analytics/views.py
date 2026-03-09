"""
Analytics API Views
===================
All endpoints are read-only.  Students can only query their own data;
teachers can query any student in their assigned sections or any of
their submission forms.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.authentication.backends import CustomUserJWTAuthentication
from apps.evaluation.models import AnswerScript, ScriptSubmissionForm
from apps.rubrics.models import QuestionRubric
from apps.students.models import TeacherSubjectAssignment

from . import services


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _is_teacher(user):
    return getattr(user, "role", None) == "teacher"


def _is_student(user):
    return getattr(user, "role", None) == "student"


def _teacher_student_ids(teacher):
    """Return set of student user IDs within the teacher's assigned sections."""
    from apps.students.models import StudentProfile

    section_ids = (
        TeacherSubjectAssignment.objects.filter(teacher=teacher)
        .values_list("section_id", flat=True)
    )
    return set(
        StudentProfile.objects.filter(section_id__in=section_ids)
        .values_list("user_id", flat=True)
    )


def _teacher_owns_form(teacher, form_id):
    return ScriptSubmissionForm.objects.filter(
        id=form_id, assignment__teacher=teacher
    ).exists()


# ─── Student Analytics ────────────────────────────────────────────────────────


class StudentProgressView(APIView):
    """GET /api/analytics/student/<id>/progress"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        # Access control
        if _is_student(request.user):
            if str(request.user.id) != str(student_id):
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        elif _is_teacher(request.user):
            if str(student_id) not in {str(i) for i in _teacher_student_ids(request.user)}:
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.generate_student_progress(student_id)
        return Response({"progress": data})


class StudentSubjectsView(APIView):
    """GET /api/analytics/student/<id>/subjects"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        if _is_student(request.user):
            if str(request.user.id) != str(student_id):
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        elif _is_teacher(request.user):
            if str(student_id) not in {str(i) for i in _teacher_student_ids(request.user)}:
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.compute_student_subject_performance(student_id)
        return Response({"subjects": data})


class StudentTopicsView(APIView):
    """GET /api/analytics/student/<id>/topics"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        if _is_student(request.user):
            if str(request.user.id) != str(student_id):
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        elif _is_teacher(request.user):
            if str(student_id) not in {str(i) for i in _teacher_student_ids(request.user)}:
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.compute_topic_performance(student_id)
        return Response({"topics": data})


class StudentOverviewView(APIView):
    """GET /api/analytics/student/<id>/overview"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        if _is_student(request.user):
            if str(request.user.id) != str(student_id):
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        elif _is_teacher(request.user):
            if str(student_id) not in {str(i) for i in _teacher_student_ids(request.user)}:
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.get_student_overview(student_id)
        return Response(data)


class MyAnalyticsView(APIView):
    """
    GET /api/analytics/me/
    Convenience endpoint: returns full analytics for the logged-in student.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_student(request.user):
            return Response({"error": "Students only"}, status=status.HTTP_403_FORBIDDEN)

        student_id = str(request.user.id)
        overview = services.get_student_overview(student_id)
        progress = services.generate_student_progress(student_id)
        subjects = services.compute_student_subject_performance(student_id)
        topics = services.compute_topic_performance(student_id)

        return Response(
            {
                "overview": overview,
                "progress": progress,
                "subjects": subjects,
                "topics": topics,
            }
        )


# ─── Class / Teacher Analytics ────────────────────────────────────────────────


class ClassDistributionView(APIView):
    """GET /api/analytics/class/<assessment_id>/distribution"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, assessment_id):
        if not _is_teacher(request.user):
            return Response({"error": "Teachers only"}, status=status.HTTP_403_FORBIDDEN)
        if not _teacher_owns_form(request.user, assessment_id):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.compute_class_distribution(assessment_id)
        return Response(data)


class ClassQuestionPerformanceView(APIView):
    """GET /api/analytics/class/<assessment_id>/question-performance"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, assessment_id):
        if not _is_teacher(request.user):
            return Response({"error": "Teachers only"}, status=status.HTTP_403_FORBIDDEN)
        if not _teacher_owns_form(request.user, assessment_id):
            return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.compute_class_question_performance(assessment_id)
        return Response({"question_performance": data})


# ─── Misconception Detection ──────────────────────────────────────────────────


class MisconceptionView(APIView):
    """
    GET  /api/analytics/misconceptions/<question_rubric_id>/
         Returns cached results (fast).

    POST /api/analytics/misconceptions/<question_rubric_id>/recompute/
         Re-runs detection and refreshes the cache (slower).
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, question_rubric_id):
        if not _is_teacher(request.user):
            return Response({"error": "Teachers only"}, status=status.HTTP_403_FORBIDDEN)

        try:
            qr = QuestionRubric.objects.select_related("rubric_set").get(
                pk=question_rubric_id
            )
        except QuestionRubric.DoesNotExist:
            return Response({"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure the teacher owns the rubric (created_by matches)
        # We check via submission forms that used this rubric set
        teacher_rubric_set_ids = set(
            ScriptSubmissionForm.objects.filter(
                assignment__teacher=request.user
            ).values_list("scripts__rubric_set_id", flat=True)
        )
        if str(qr.rubric_set_id) not in {str(i) for i in teacher_rubric_set_ids if i}:
            # Fallback: allow if rubric was created by the teacher
            if str(qr.rubric_set.created_by) != str(request.user.id):
                return Response({"error": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        data = services.get_cached_misconceptions(question_rubric_id)
        return Response({"misconceptions": data, "question_rubric_id": question_rubric_id})


class MisconceptionRecomputeView(APIView):
    """POST /api/analytics/misconceptions/<question_rubric_id>/recompute/"""

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, question_rubric_id):
        if not _is_teacher(request.user):
            return Response({"error": "Teachers only"}, status=status.HTTP_403_FORBIDDEN)

        try:
            QuestionRubric.objects.get(pk=question_rubric_id)
        except QuestionRubric.DoesNotExist:
            return Response({"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND)

        data = services.detect_misconceptions(question_rubric_id)
        return Response({"misconceptions": data, "question_rubric_id": question_rubric_id})


# ─── Snapshot Rebuild Utility ─────────────────────────────────────────────────


class RebuildSnapshotsView(APIView):
    """
    POST /api/analytics/rebuild-snapshots/
    Teacher-only: rebuild StudentPerformanceSnapshot for all evaluated scripts
    in the teacher's submission forms.  Useful after first deploy.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_teacher(request.user):
            return Response({"error": "Teachers only"}, status=status.HTTP_403_FORBIDDEN)

        form_ids = ScriptSubmissionForm.objects.filter(
            assignment__teacher=request.user
        ).values_list("id", flat=True)

        scripts = AnswerScript.objects.filter(
            submission_form_id__in=form_ids,
            status="evaluated",
            student_user__isnull=False,
        ).select_related(
            "student_user", "rubric_set", "submission_form__assignment__subject"
        ).prefetch_related("question_evaluations__question_rubric")

        rebuilt = 0
        for script in scripts:
            services.rebuild_snapshot_for_script(script)
            rebuilt += 1

        return Response({"rebuilt": rebuilt})
