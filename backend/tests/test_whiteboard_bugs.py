"""
Bug-based tests for WB-001: archived sessions and viewer members can still
write. save_state() (backend/apps/whiteboard/views.py) only checks
"is_owner or is_member" — it never checks session.is_active or the member's
role, so an archived session or a read-only viewer can still push new
snapshots.
"""
import pytest

from apps.authentication.models import CustomUser
from apps.whiteboard.models import WhiteboardSession, SessionMember, SessionRole


@pytest.mark.django_db
def test_wb_001_archived_session_rejects_new_state_writes(api_client, teacher_user, student_user):
    session = WhiteboardSession.objects.create(
        name="Algebra Board",
        owner=teacher_user,
        is_active=False,  # archived
    )
    SessionMember.objects.create(
        session=session, user=student_user, role=SessionRole.EDITOR
    )

    api_client.force_authenticate(user=student_user)
    response = api_client.post(
        f"/api/whiteboard/sessions/{session.id}/states/",
        {"page": 1, "snapshot_json": {"objects": []}},
        format="json",
    )

    # Expected: writes to an archived (inactive) session should be rejected.
    assert response.status_code == 403


@pytest.mark.django_db
def test_wb_001_viewer_role_cannot_write_state(api_client, teacher_user, student_user):
    session = WhiteboardSession.objects.create(
        name="Algebra Board",
        owner=teacher_user,
        is_active=True,
    )
    SessionMember.objects.create(
        session=session, user=student_user, role=SessionRole.VIEWER
    )

    api_client.force_authenticate(user=student_user)
    response = api_client.post(
        f"/api/whiteboard/sessions/{session.id}/states/",
        {"page": 1, "snapshot_json": {"objects": []}},
        format="json",
    )

    # Expected: a read-only viewer should not be able to save a new state.
    assert response.status_code == 403


@pytest.mark.django_db
def test_editor_member_can_write_state_on_an_active_session(api_client, teacher_user, student_user):
    """Sanity check: the happy path (active session, editor role) still works."""
    session = WhiteboardSession.objects.create(
        name="Algebra Board",
        owner=teacher_user,
        is_active=True,
    )
    SessionMember.objects.create(
        session=session, user=student_user, role=SessionRole.EDITOR
    )

    api_client.force_authenticate(user=student_user)
    response = api_client.post(
        f"/api/whiteboard/sessions/{session.id}/states/",
        {"page": 1, "snapshot_json": {"objects": []}},
        format="json",
    )

    assert response.status_code == 201
