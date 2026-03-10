"""
Difficulty Flag Service — handle student difficulty signals and teacher notifications.

When ≥40% of students in a section flag a topic, a TeacherNotification is created.
"""
import logging
from decimal import Decimal
from uuid import UUID

from django.db import IntegrityError

from apps.students.models import StudentProfile
from ..models import (
    CourseTopic,
    CourseOutline,
    TopicDifficultyFlag,
    TeacherNotification,
    NotificationType,
)

logger = logging.getLogger(__name__)

DIFFICULTY_THRESHOLD = 0.40  # 40%


def flag_topic(student_user, topic_id: UUID, note: str = "") -> TopicDifficultyFlag:
    """
    Flag a topic as difficult.  Idempotent — returns existing flag if already set.
    After flagging, checks the threshold and creates a notification if needed.
    """
    topic = CourseTopic.objects.select_related(
        "course_outline__teaching_assignment__section",
        "course_outline__teaching_assignment__teacher",
    ).get(pk=topic_id)

    flag, created = TopicDifficultyFlag.objects.get_or_create(
        student=student_user,
        topic=topic,
        defaults={"note": note},
    )

    if not created and note:
        flag.note = note
        flag.save(update_fields=["note"])

    if created:
        _check_threshold(topic)

    return flag


def unflag_topic(student_user, topic_id: UUID) -> bool:
    """Remove a difficulty flag. Returns True if a flag was deleted."""
    deleted, _ = TopicDifficultyFlag.objects.filter(
        student=student_user, topic_id=topic_id
    ).delete()
    return deleted > 0


def get_difficulty_report(outline_id: UUID):
    """
    Per-topic difficulty report for a course outline.
    Returns list of dicts with flag_count, total_students, percentage, and students.
    """
    outline = CourseOutline.objects.select_related(
        "teaching_assignment__section"
    ).get(pk=outline_id)

    section = outline.teaching_assignment.section
    total_students = StudentProfile.objects.filter(section=section).count()

    topics = CourseTopic.objects.filter(
        course_outline=outline,
        parent_topic__isnull=True,  # report on parent topics
    ).prefetch_related("difficulty_flags__student")

    report = []
    for topic in topics:
        flags = topic.difficulty_flags.all()
        flag_count = flags.count()
        percentage = round((flag_count / total_students) * 100, 1) if total_students else 0

        report.append({
            "topic_id": str(topic.id),
            "topic_title": topic.title,
            "flag_count": flag_count,
            "total_students": total_students,
            "percentage": percentage,
            "above_threshold": percentage >= DIFFICULTY_THRESHOLD * 100,
            "students": [
                {
                    "id": str(f.student_id),
                    "name": f"{f.student.first_name} {f.student.last_name}",
                    "note": f.note,
                    "flagged_at": f.flagged_at.isoformat(),
                }
                for f in flags
            ],
        })

    return report


def get_teacher_notifications(teacher_user, unread_only: bool = False):
    """List notifications for a teacher."""
    qs = TeacherNotification.objects.filter(teacher=teacher_user).select_related("topic")
    if unread_only:
        qs = qs.filter(is_read=False)
    return qs


def mark_notification_read(teacher_user, notification_id: UUID) -> bool:
    updated = TeacherNotification.objects.filter(
        pk=notification_id, teacher=teacher_user
    ).update(is_read=True)
    return updated > 0


def mark_all_notifications_read(teacher_user) -> int:
    return TeacherNotification.objects.filter(
        teacher=teacher_user, is_read=False
    ).update(is_read=True)


# ─── Internal ─────────────────────────────────────────────────────────────────


def _check_threshold(topic: CourseTopic) -> None:
    """
    Check if the flag count for this topic exceeds the threshold and
    create a notification if needed.
    """
    outline = topic.course_outline
    section = outline.teaching_assignment.section
    teacher = outline.teaching_assignment.teacher

    total_students = StudentProfile.objects.filter(section=section).count()
    if total_students == 0:
        return

    flag_count = TopicDifficultyFlag.objects.filter(topic=topic).count()
    percentage = flag_count / total_students

    if percentage < DIFFICULTY_THRESHOLD:
        return

    pct_display = round(percentage * 100, 1)

    # Prevent duplicate unread notifications for the same topic
    existing = TeacherNotification.objects.filter(
        topic=topic,
        notification_type=NotificationType.DIFFICULTY_THRESHOLD,
        is_read=False,
    ).exists()

    if existing:
        return

    TeacherNotification.objects.create(
        teacher=teacher,
        topic=topic,
        course_outline=outline,
        notification_type=NotificationType.DIFFICULTY_THRESHOLD,
        message=(
            f"{pct_display}% of students in Section {section.name} "
            f"are finding '{topic.title}' difficult "
            f"({flag_count}/{total_students} students flagged)"
        ),
        flag_count=flag_count,
        total_students=total_students,
        percentage=Decimal(str(pct_display)),
    )
    logger.info(
        "Created threshold notification for topic '%s' (%.1f%%)",
        topic.title,
        pct_display,
    )
