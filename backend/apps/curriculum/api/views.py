"""
Curriculum API Views

Teacher endpoints — outline upload, detail, reparse, difficulty report,
                    material management, notifications.
Student endpoints — my courses, topics, progress, difficulty flags, materials.
Shared           — topic search for content generation autocomplete.
"""
import logging
from uuid import UUID

from django.db.models import Q, Prefetch
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    CourseOutline,
    CourseTopic,
    TopicProgress,
    TopicDifficultyFlag,
    TopicMaterial,
    ProgressStatus,
    ParsingStatus,
)
from ..services import (
    course_service,
    progress_service,
    difficulty_service,
    material_service,
)
from ..tasks import parse_course_outline_task
from .serializers import (
    CourseOutlineUploadSerializer,
    CourseOutlineListSerializer,
    CourseOutlineDetailSerializer,
    CourseTopicWithProgressSerializer,
    CourseWeekSerializer,
    TopicProgressUpdateSerializer,
    TopicProgressSerializer,
    CourseProgressSummarySerializer,
    DifficultyFlagCreateSerializer,
    DifficultyFlagSerializer,
    DifficultyReportItemSerializer,
    TopicMaterialUploadSerializer,
    TopicMaterialSerializer,
    TeacherNotificationSerializer,
    MarkNotificationsReadSerializer,
    CourseTopicSerializer,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Teacher Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


class CourseOutlineUploadView(APIView):
    """POST — upload a course outline PDF, trigger async parsing."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = CourseOutlineUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            outline = course_service.create_course_outline(
                teaching_assignment_id=serializer.validated_data[
                    "teaching_assignment_id"
                ],
                pdf_file=serializer.validated_data["pdf"],
                user=request.user,
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST
            )
        except PermissionError as exc:
            return Response(
                {"error": str(exc)}, status=status.HTTP_403_FORBIDDEN
            )

        # Dispatch Celery task — fall back to synchronous if broker unavailable
        try:
            parse_course_outline_task.delay(str(outline.id))
        except Exception:
            logger.warning(
                "Celery broker unavailable, parsing outline %s synchronously",
                outline.id,
            )
            try:
                course_service.process_outline(outline.id)
                outline.refresh_from_db()
            except Exception:
                logger.exception("Synchronous parse failed for %s", outline.id)

        return Response(
            CourseOutlineListSerializer(outline).data,
            status=status.HTTP_201_CREATED,
        )


class CourseOutlineListView(APIView):
    """GET — list all outlines owned by the requesting teacher."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        outlines = (
            CourseOutline.objects.filter(created_by=request.user)
            .select_related(
                "teaching_assignment__subject",
                "teaching_assignment__section__class_ref",
                "teaching_assignment__teacher",
            )
            .order_by("-created_at")
        )
        return Response(CourseOutlineListSerializer(outlines, many=True).data)


class CourseOutlineDetailView(APIView):
    """GET — full outline with weeks and topics."""

    permission_classes = [IsAuthenticated]

    def get(self, request, outline_id):
        materials_qs = TopicMaterial.objects.select_related("uploaded_by")
        try:
            outline = CourseOutline.objects.select_related(
                "teaching_assignment__subject",
                "teaching_assignment__section__class_ref",
                "teaching_assignment__teacher",
            ).prefetch_related(
                Prefetch("weeks__topics__subtopics__materials", queryset=materials_qs),
                Prefetch("weeks__topics__materials", queryset=materials_qs),
            ).get(pk=outline_id)
        except CourseOutline.DoesNotExist:
            return Response(
                {"error": "Outline not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Access: owner teacher OR student enrolled in that section
        if not _can_view_outline(request.user, outline):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        context = {"request": request}

        # If student, inject progress context
        if request.user.role == "student":
            context["topic_serializer"] = CourseTopicWithProgressSerializer
            progress_map = progress_service.get_student_progress(
                request.user, outline.id
            )
            flag_ids = set(
                TopicDifficultyFlag.objects.filter(
                    student=request.user,
                    topic__course_outline=outline,
                ).values_list("topic_id", flat=True)
            )
            context["student"] = request.user
            context["progress_map"] = progress_map
            context["flag_ids"] = {str(fid) for fid in flag_ids}

        serializer = CourseOutlineDetailSerializer(outline, context=context)
        data = serializer.data

        # Include progress summary for students so frontend doesn't need a separate call
        if request.user.role == "student":
            data["progress_summary"] = progress_service.get_completion_summary(
                request.user, outline.id
            )

        return Response(data)

    def delete(self, request, outline_id):
        """DELETE — delete an outline (teacher only)."""
        try:
            outline = CourseOutline.objects.get(pk=outline_id)
        except CourseOutline.DoesNotExist:
            return Response(
                {"error": "Outline not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if outline.created_by_id != request.user.id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        outline.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CourseOutlineReparseView(APIView):
    """POST — re-trigger AI parsing on an existing outline."""

    permission_classes = [IsAuthenticated]

    def post(self, request, outline_id):
        try:
            outline = course_service.reparse_outline(outline_id, request.user)
        except (ValueError, PermissionError) as exc:
            code = (
                status.HTTP_403_FORBIDDEN
                if isinstance(exc, PermissionError)
                else status.HTTP_400_BAD_REQUEST
            )
            return Response({"error": str(exc)}, status=code)

        try:
            parse_course_outline_task.delay(str(outline.id))
        except Exception:
            logger.warning(
                "Celery broker unavailable, re-parsing outline %s synchronously",
                outline.id,
            )
            try:
                course_service.process_outline(outline.id)
            except Exception:
                logger.exception("Synchronous reparse failed for %s", outline.id)
        return Response({"status": "reparse_queued", "outline_id": str(outline.id)})


class TopicDifficultyReportView(APIView):
    """GET — difficulty analytics for an outline."""

    permission_classes = [IsAuthenticated]

    def get(self, request, outline_id):
        try:
            outline = CourseOutline.objects.get(pk=outline_id)
        except CourseOutline.DoesNotExist:
            return Response(
                {"error": "Outline not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if outline.created_by_id != request.user.id:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        report = difficulty_service.get_difficulty_report(outline_id)
        return Response(DifficultyReportItemSerializer(report, many=True).data)


class TopicMaterialUploadView(APIView):
    """POST — upload a material for a topic."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, topic_id):
        serializer = TopicMaterialUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            material = material_service.upload_material(
                teacher_user=request.user,
                topic_id=topic_id,
                title=data["title"],
                material_type=data["material_type"],
                file=data.get("file"),
                external_link=data.get("external_link", ""),
                description=data.get("description", ""),
            )
        except (ValueError, PermissionError) as exc:
            code = (
                status.HTTP_403_FORBIDDEN
                if isinstance(exc, PermissionError)
                else status.HTTP_400_BAD_REQUEST
            )
            return Response({"error": str(exc)}, status=code)

        return Response(
            TopicMaterialSerializer(material, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class TopicMaterialDeleteView(APIView):
    """DELETE — remove a material (uploader only)."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, material_id):
        deleted = material_service.delete_material(request.user, material_id)
        if not deleted:
            return Response(
                {"error": "Material not found or access denied"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationListView(APIView):
    """GET — teacher's curriculum notifications."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        unread = request.query_params.get("unread_only", "").lower() == "true"
        notifications = difficulty_service.get_teacher_notifications(
            request.user, unread_only=unread
        )
        return Response(
            TeacherNotificationSerializer(notifications, many=True).data
        )


class NotificationMarkReadView(APIView):
    """POST — mark notifications as read."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = MarkNotificationsReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data.get("mark_all"):
            count = difficulty_service.mark_all_notifications_read(request.user)
            return Response({"marked_read": count})

        ids = serializer.validated_data.get("notification_ids", [])
        count = 0
        for nid in ids:
            if difficulty_service.mark_notification_read(request.user, nid):
                count += 1
        return Response({"marked_read": count})


# ═══════════════════════════════════════════════════════════════════════════════
# Student Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


class MyCoursesListView(APIView):
    """GET — courses the student is enrolled in (via section)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        outlines = course_service.get_student_courses(request.user)
        data = CourseOutlineListSerializer(outlines, many=True).data

        # Add progress summary for each course
        for item in data:
            summary = progress_service.get_completion_summary(
                request.user, item["id"]
            )
            item["progress"] = summary

        return Response(data)


class CourseTopicsView(APIView):
    """GET — topics with progress for a course (student view)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, outline_id):
        materials_qs = TopicMaterial.objects.select_related("uploaded_by")
        try:
            outline = CourseOutline.objects.select_related(
                "teaching_assignment__subject",
                "teaching_assignment__section__class_ref",
                "teaching_assignment__teacher",
            ).prefetch_related(
                Prefetch("weeks__topics__subtopics__materials", queryset=materials_qs),
                Prefetch("weeks__topics__materials", queryset=materials_qs),
            ).get(pk=outline_id)
        except CourseOutline.DoesNotExist:
            return Response(
                {"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if not _can_view_outline(request.user, outline):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        progress_map = progress_service.get_student_progress(
            request.user, outline_id
        )
        flag_ids = set(
            TopicDifficultyFlag.objects.filter(
                student=request.user,
                topic__course_outline=outline,
            ).values_list("topic_id", flat=True)
        )

        context = {
            "student": request.user,
            "request": request,
            "topic_serializer": CourseTopicWithProgressSerializer,
            "progress_map": progress_map,
            "flag_ids": {str(fid) for fid in flag_ids},
        }

        weeks = outline.weeks.order_by("week_number")
        weeks_data = CourseWeekSerializer(weeks, many=True, context=context).data

        return Response(
            {
                "outline_id": str(outline.id),
                "title": outline.title,
                "weeks": weeks_data,
            }
        )


class TopicProgressUpdateView(APIView):
    """POST — update a student's progress on a topic."""

    permission_classes = [IsAuthenticated]

    def post(self, request, topic_id):
        serializer = TopicProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            progress = progress_service.update_topic_progress(
                request.user,
                topic_id,
                serializer.validated_data["status"],
            )
        except CourseTopic.DoesNotExist:
            return Response(
                {"error": "Topic not found"}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(TopicProgressSerializer(progress).data)


class TopicDifficultyFlagView(APIView):
    """POST — flag a topic as difficult. DELETE — unflag."""

    permission_classes = [IsAuthenticated]

    def post(self, request, topic_id):
        serializer = DifficultyFlagCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            flag = difficulty_service.flag_topic(
                request.user,
                topic_id,
                note=serializer.validated_data.get("note", ""),
            )
        except CourseTopic.DoesNotExist:
            return Response(
                {"error": "Topic not found"}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            DifficultyFlagSerializer(flag).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, topic_id):
        deleted = difficulty_service.unflag_topic(request.user, topic_id)
        if not deleted:
            return Response(
                {"error": "Flag not found"}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopicMaterialsListView(APIView):
    """GET — list materials for a topic (accessible to enrolled students)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, topic_id):
        try:
            topic = CourseTopic.objects.select_related(
                "course_outline__teaching_assignment__section"
            ).get(pk=topic_id)
        except CourseTopic.DoesNotExist:
            return Response(
                {"error": "Topic not found"}, status=status.HTTP_404_NOT_FOUND
            )

        if not _can_view_outline(request.user, topic.course_outline):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        materials = material_service.list_materials(topic_id)
        return Response(
            TopicMaterialSerializer(
                materials, many=True, context={"request": request}
            ).data
        )


class CourseProgressSummaryView(APIView):
    """GET — progress summary for a course outline."""

    permission_classes = [IsAuthenticated]

    def get(self, request, outline_id):
        summary = progress_service.get_completion_summary(
            request.user, outline_id
        )
        return Response(CourseProgressSummarySerializer(summary).data)


# ═══════════════════════════════════════════════════════════════════════════════
# Shared Endpoints
# ═══════════════════════════════════════════════════════════════════════════════


class TopicSearchView(APIView):
    """
    GET /api/curriculum/topics/search/?q=bisection
    Search topics across a student's enrolled courses.
    Used by content generation form for autocomplete.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response([])

        # Get courses for the user
        outlines = course_service.get_student_courses(request.user)
        if not outlines.exists():
            # Fallback: if teacher, search their own outlines
            outlines = CourseOutline.objects.filter(
                created_by=request.user,
                parsing_status=ParsingStatus.COMPLETED,
            )

        topics = (
            CourseTopic.objects.filter(
                course_outline__in=outlines,
                title__icontains=query,
            )
            .select_related("course_outline")
            .order_by("course_outline__title", "order")[:20]
        )

        results = [
            {
                "id": str(t.id),
                "title": t.title,
                "course_title": t.course_outline.title,
                "course_id": str(t.course_outline.id),
                "parent_topic": str(t.parent_topic_id) if t.parent_topic_id else None,
            }
            for t in topics
        ]
        return Response(results)


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _can_view_outline(user, outline: CourseOutline) -> bool:
    """Check if a user can view an outline (owner or enrolled student)."""
    if outline.created_by_id == user.id:
        return True

    if user.role == "student":
        from apps.students.models import StudentProfile

        try:
            profile = StudentProfile.objects.get(user=user)
            return (
                profile.section_id
                == outline.teaching_assignment.section_id
            )
        except StudentProfile.DoesNotExist:
            pass

    return False
