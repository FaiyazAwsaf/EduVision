"""
Material Service — handle teacher uploads of topic resources.
"""
import logging
from uuid import UUID

from ..models import TopicMaterial, CourseTopic, MaterialType

logger = logging.getLogger(__name__)


def upload_material(
    teacher_user,
    topic_id: UUID,
    title: str,
    material_type: str,
    file=None,
    external_link: str = "",
    description: str = "",
) -> TopicMaterial:
    """
    Create a material for a topic.
    Validates that the teacher owns the course outline.
    """
    topic = CourseTopic.objects.select_related(
        "course_outline__teaching_assignment"
    ).get(pk=topic_id)

    if topic.course_outline.teaching_assignment.teacher_id != teacher_user.id:
        raise PermissionError("You do not own this course outline")

    material = TopicMaterial(
        topic=topic,
        uploaded_by=teacher_user,
        title=title,
        description=description,
        material_type=material_type,
    )

    if material_type == MaterialType.FILE:
        if not file:
            raise ValueError("A file is required for FILE type materials")
        material.file = file
    elif material_type == MaterialType.LINK:
        if not external_link:
            raise ValueError("An external link is required for LINK type materials")
        material.external_link = external_link

    material.full_clean()
    material.save()

    logger.info("Uploaded material '%s' for topic '%s'", title, topic.title)
    return material


def list_materials(topic_id: UUID):
    """List all materials for a topic."""
    return TopicMaterial.objects.filter(topic_id=topic_id).select_related("uploaded_by")


def delete_material(teacher_user, material_id: UUID) -> bool:
    """Delete a material — only the uploader can delete."""
    deleted, _ = TopicMaterial.objects.filter(
        pk=material_id, uploaded_by=teacher_user
    ).delete()
    return deleted > 0
