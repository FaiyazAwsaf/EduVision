"""
Progress Tracking Service — manage student topic progress.
"""
from uuid import UUID
from django.utils import timezone

from ..models import CourseTopic, TopicProgress, ProgressStatus, CourseOutline


def update_topic_progress(student_user, topic_id: UUID, status: str) -> TopicProgress:
    """Create or update a student's progress on a topic."""
    topic = CourseTopic.objects.get(pk=topic_id)

    progress, _ = TopicProgress.objects.update_or_create(
        student=student_user,
        topic=topic,
        defaults={
            "status": status,
            "completed_at": timezone.now() if status == ProgressStatus.COMPLETED else None,
        },
    )
    return progress


def get_student_progress(student_user, outline_id: UUID) -> dict:
    """
    Return progress for all topics in a course outline.
    Returns dict keyed by topic_id → status.
    Single query using FK traversal instead of subquery.
    """
    entries = TopicProgress.objects.filter(
        student=student_user,
        topic__course_outline_id=outline_id,
    )
    return {str(entry.topic_id): entry.status for entry in entries}


def get_completion_summary(student_user, outline_id: UUID) -> dict:
    """Return completion stats for a course. Uses 2 queries instead of 4."""
    from django.db.models import Count, Q as DQ

    total = CourseTopic.objects.filter(
        course_outline_id=outline_id,
        parent_topic__isnull=True,
    ).count()

    if total == 0:
        return {
            "total_topics": 0,
            "completed": 0,
            "in_progress": 0,
            "not_started": 0,
            "percentage": 0,
        }

    counts = TopicProgress.objects.filter(
        student=student_user,
        topic__course_outline_id=outline_id,
        topic__parent_topic__isnull=True,
    ).aggregate(
        completed=Count("id", filter=DQ(status=ProgressStatus.COMPLETED)),
        in_progress=Count("id", filter=DQ(status=ProgressStatus.IN_PROGRESS)),
    )

    completed = counts["completed"]
    in_progress = counts["in_progress"]
    not_started = total - completed - in_progress

    return {
        "total_topics": total,
        "completed": completed,
        "in_progress": in_progress,
        "not_started": not_started,
        "percentage": round((completed / total) * 100, 1) if total else 0,
    }
