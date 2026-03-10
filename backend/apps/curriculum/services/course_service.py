"""
Course Service — orchestrates outline creation, parsing, and queries.
"""
import logging
from uuid import UUID

from django.db import transaction

from apps.students.models import TeacherSubjectAssignment, StudentProfile
from ..models import (
    CourseOutline,
    CourseWeek,
    CourseTopic,
    ParsingStatus,
)
from .pdf_parser import extract_text_from_pdf
from .outline_extractor import extract_outline_from_text

logger = logging.getLogger(__name__)


def create_course_outline(teaching_assignment_id: UUID, pdf_file, user) -> CourseOutline:
    """
    Validate ownership, persist the PDF, and return the CourseOutline with
    PENDING status.  Caller is responsible for dispatching the Celery task.
    """
    try:
        assignment = TeacherSubjectAssignment.objects.select_related(
            "subject", "section", "section__class_ref"
        ).get(pk=teaching_assignment_id)
    except TeacherSubjectAssignment.DoesNotExist:
        raise ValueError("Teaching assignment not found")

    if assignment.teacher_id != user.id:
        raise PermissionError("You are not the assigned teacher for this course")

    # Check if outline already exists for this assignment
    if CourseOutline.objects.filter(teaching_assignment=assignment).exists():
        raise ValueError(
            "An outline already exists for this assignment. "
            "Delete it first or use the reparse endpoint."
        )

    outline = CourseOutline.objects.create(
        teaching_assignment=assignment,
        title=f"{assignment.subject.name}",
        created_by=user,
        raw_pdf=pdf_file,
        parsing_status=ParsingStatus.PENDING,
    )
    logger.info("Created CourseOutline %s for assignment %s", outline.id, assignment.id)
    return outline


def process_outline(outline_id: UUID) -> None:
    """
    Full processing pipeline: extract text → AI parse → persist topics.
    Called by the Celery task.
    """
    try:
        outline = CourseOutline.objects.get(pk=outline_id)
    except CourseOutline.DoesNotExist:
        logger.error("CourseOutline %s not found", outline_id)
        return

    outline.parsing_status = ParsingStatus.PROCESSING
    outline.save(update_fields=["parsing_status"])

    try:
        raw_text = extract_text_from_pdf(outline.raw_pdf)
        data = extract_outline_from_text(raw_text)
        _persist_parsed_data(outline, data)

        outline.title = data.get("title") or outline.title
        outline.course_code = data.get("course_code", "")
        outline.course_objectives = data.get("course_objectives", [])
        outline.parsing_status = ParsingStatus.COMPLETED
        outline.parsing_error = ""
        outline.save(
            update_fields=[
                "title",
                "course_code",
                "course_objectives",
                "parsing_status",
                "parsing_error",
            ]
        )
        logger.info("Successfully parsed outline %s", outline.id)

    except Exception as exc:
        logger.exception("Failed to parse outline %s: %s", outline.id, exc)
        outline.parsing_status = ParsingStatus.FAILED
        outline.parsing_error = str(exc)[:2000]
        outline.save(update_fields=["parsing_status", "parsing_error"])


def reparse_outline(outline_id: UUID, user) -> CourseOutline:
    """Delete existing parsed data and re-trigger parsing."""
    try:
        outline = CourseOutline.objects.get(pk=outline_id)
    except CourseOutline.DoesNotExist:
        raise ValueError("Outline not found")

    if outline.created_by_id != user.id:
        raise PermissionError("You do not own this outline")

    with transaction.atomic():
        outline.weeks.all().delete()  # cascades to topics
        outline.parsing_status = ParsingStatus.PENDING
        outline.parsing_error = ""
        outline.save(update_fields=["parsing_status", "parsing_error"])

    return outline


def get_student_courses(student_user):
    """
    Return all CourseOutline objects for courses the student is enrolled in
    (via their section's teaching assignments).
    """
    try:
        profile = StudentProfile.objects.get(user=student_user)
    except StudentProfile.DoesNotExist:
        return CourseOutline.objects.none()

    if not profile.section_id:
        return CourseOutline.objects.none()

    assignment_ids = TeacherSubjectAssignment.objects.filter(
        section=profile.section
    ).values_list("id", flat=True)

    return (
        CourseOutline.objects.filter(
            teaching_assignment__in=assignment_ids,
            parsing_status=ParsingStatus.COMPLETED,
        )
        .select_related(
            "teaching_assignment__subject",
            "teaching_assignment__section__class_ref",
            "teaching_assignment__teacher",
            "created_by",
        )
        .order_by("-created_at")
    )


# ─── Internal helpers ─────────────────────────────────────────────────────────


@transaction.atomic
def _persist_parsed_data(outline: CourseOutline, data: dict) -> None:
    """Create CourseWeek + CourseTopic records from AI-parsed JSON."""
    # Clear any existing data (for reparse)
    outline.weeks.all().delete()

    for week_data in data.get("weeks", []):
        week = CourseWeek.objects.create(
            course_outline=outline,
            week_number=week_data["week_number"],
            is_exam_week=week_data.get("is_exam_week", False),
            exam_label=week_data.get("exam_label", ""),
        )

        for idx, topic_data in enumerate(week_data.get("topics", [])):
            parent = CourseTopic.objects.create(
                course_outline=outline,
                week=week,
                title=topic_data["title"],
                description=topic_data.get("description", ""),
                order=idx,
                course_outcomes=topic_data.get("course_outcomes", []),
            )

            for sub_idx, sub_title in enumerate(topic_data.get("subtopics", [])):
                CourseTopic.objects.create(
                    course_outline=outline,
                    week=week,
                    parent_topic=parent,
                    title=sub_title if isinstance(sub_title, str) else sub_title.get("title", ""),
                    order=sub_idx,
                    course_outcomes=topic_data.get("course_outcomes", []),
                )
