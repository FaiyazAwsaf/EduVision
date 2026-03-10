"""
Analytics Signals
=================
Django signals that automatically trigger analytics updates when evaluation
data changes, so snapshots stay current without manual intervention.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _rebuild_snapshot(script) -> None:
    """Safe wrapper around rebuild_snapshot_for_script."""
    try:
        from .services import rebuild_snapshot_for_script
        rebuild_snapshot_for_script(script)
    except Exception as exc:
        logger.warning(
            f"[analytics.signals] Snapshot rebuild failed for script {script.pk}: {exc}"
        )


@receiver(post_save, sender='evaluation.AnswerScript')
def on_answer_script_saved(sender, instance, created, **kwargs):
    """
    Trigger a snapshot rebuild whenever an AnswerScript is saved with
    status == 'evaluated'.  This covers both the direct-evaluation path
    and any manual status updates made through the admin or API.
    """
    if instance.status == 'evaluated' and instance.student_user_id:
        _rebuild_snapshot(instance)
