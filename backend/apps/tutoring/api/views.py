"""
Tutoring Session API Views

Section-based batch tutoring endpoints:
- POST /api/tutoring/sessions/create/ - Teacher creates session (for a section)
- POST /api/tutoring/sessions/join/ - Student joins session (by session_id)
- GET /api/tutoring/sessions/{session_id}/status/ - Get session status
- POST /api/tutoring/sessions/{session_id}/end/ - End session
- GET /api/tutoring/sessions/available/ - Student discovers joinable sessions
- POST /api/tutoring/sessions/{session_id}/leave/ - Student leaves session
- GET /api/tutoring/sessions/ - List sessions for current user
"""

import uuid
import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from apps.tutoring.models import (
    TutoringSession,
    SessionParticipant,
    SessionStatus as SessionStatusEnum,
)
from apps.tutoring.api.serializers import (
    SessionCreateSerializer,
    SessionJoinSerializer,
    SessionStatusSerializer,
    SessionListSerializer,
    AvailableSessionSerializer,
)
from apps.tutoring.utils import (
    generate_livekit_token,
    get_livekit_ws_url,
    broadcast_session_status_change,
    broadcast_session_ended,
    broadcast_participant_update,
)

logger = logging.getLogger(__name__)


def _get_user(request):
    """Get authenticated user from request."""
    return getattr(request, 'tutoring_user', None)


def _auth_error():
    return Response(
        {'error': 'Authentication required', 'detail': 'User not authenticated', 'code': 'auth_required'},
        status=status.HTTP_401_UNAUTHORIZED,
    )


# ─── Session Create ────────────────────────────────────────────────────────────

class SessionCreateView(APIView):
    """
    POST /api/tutoring/sessions/create/

    Teacher creates a session for a specific section.
    Validates teacher has a TeacherSubjectAssignment for that section.
    """

    def post(self, request):
        user = _get_user(request)
        if not user:
            return _auth_error()

        if user.role != 'teacher':
            return Response(
                {'error': 'Forbidden', 'detail': 'Only teachers can create sessions', 'code': 'teacher_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SessionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request', 'detail': serializer.errors, 'code': 'validation_error'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        section_id = serializer.validated_data['section_id']

        # Validate teacher is assigned to this section
        from apps.students.models import TeacherSubjectAssignment, Section
        try:
            section = Section.objects.select_related('class_ref').get(id=section_id)
        except Section.DoesNotExist:
            return Response(
                {'error': 'Not found', 'detail': 'Section not found', 'code': 'section_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        has_assignment = TeacherSubjectAssignment.objects.filter(
            teacher=user, section=section
        ).exists()

        if not has_assignment:
            return Response(
                {'error': 'Forbidden', 'detail': 'You are not assigned to this section', 'code': 'not_assigned'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if teacher already has an active session
        active = TutoringSession.objects.filter(
            teacher=user,
            status__in=[SessionStatusEnum.WAITING, SessionStatusEnum.ACTIVE, SessionStatusEnum.GRACE],
        ).first()
        if active:
            return Response(
                {'error': 'Already active', 'detail': 'You already have an active session', 'code': 'already_active'},
                status=status.HTTP_409_CONFLICT,
            )

        room_id = f"tutoring_{uuid.uuid4()}"

        try:
            token = generate_livekit_token(
                room_id=room_id,
                user_id=str(user.id),
                user_name=f"{user.first_name} {user.last_name}",
                role='TEACHER',
            )
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {e}")
            return Response(
                {'error': 'Token generation failed', 'detail': str(e), 'code': 'token_generation_failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        session = TutoringSession.objects.create(
            room_id=room_id,
            teacher=user,
            section=section,
            status=SessionStatusEnum.WAITING,
            livekit_token_teacher=token,
        )

        logger.info(f"Session {session.id} created by teacher {user.id} for section {section}")

        return Response(
            {
                'session_id': str(session.id),
                'room_id': room_id,
                'token': token,
                'status': session.status,
                'livekit_ws_url': get_livekit_ws_url(),
                'teacher_id': str(user.id),
                'section_id': section.id,
                'section_name': section.name,
                'class_name': section.class_ref.name,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Session Join ──────────────────────────────────────────────────────────────

class SessionJoinView(APIView):
    """
    POST /api/tutoring/sessions/join/

    Student joins session by session_id.
    Validates student belongs to the session's section.
    """

    def post(self, request):
        user = _get_user(request)
        if not user:
            return _auth_error()

        if user.role != 'student':
            return Response(
                {'error': 'Forbidden', 'detail': 'Only students can join sessions', 'code': 'student_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SessionJoinSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request', 'detail': serializer.errors, 'code': 'validation_error'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session_id = serializer.validated_data['session_id']

        try:
            session = TutoringSession.objects.select_related('teacher', 'section', 'section__class_ref').get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {'error': 'Not found', 'detail': 'Session not found', 'code': 'session_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.is_ended:
            return Response(
                {'error': 'Session ended', 'detail': 'This session has already ended', 'code': 'session_ended'},
                status=status.HTTP_410_GONE,
            )

        # Validate student is in the session's section
        from apps.students.models import StudentProfile
        try:
            profile = StudentProfile.objects.get(user=user)
        except StudentProfile.DoesNotExist:
            return Response(
                {'error': 'No profile', 'detail': 'Student profile not found', 'code': 'no_profile'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if session.section and profile.section_id != session.section_id:
            return Response(
                {'error': 'Wrong section', 'detail': 'This session is not for your section', 'code': 'wrong_section'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if student already has an active participation in this session
        existing = SessionParticipant.objects.filter(session=session, user=user, left_at__isnull=True).first()
        if existing:
            # Return existing token for reconnection
            return Response(
                {
                    'session_id': str(session.id),
                    'token': existing.livekit_token,
                    'status': session.status,
                    'teacher_name': f"{session.teacher.first_name} {session.teacher.last_name}",
                    'room_id': session.room_id,
                    'livekit_ws_url': get_livekit_ws_url(),
                    'section_name': session.section.name if session.section else '',
                    'class_name': session.section.class_ref.name if session.section else '',
                    'participant_count': session.participant_count,
                },
                status=status.HTTP_200_OK,
            )

        # Check if student is in another active session
        other_active = SessionParticipant.objects.filter(
            user=user,
            left_at__isnull=True,
            session__status__in=[SessionStatusEnum.WAITING, SessionStatusEnum.ACTIVE, SessionStatusEnum.GRACE],
        ).exclude(session=session).exists()

        if other_active:
            return Response(
                {'error': 'Already in session', 'detail': 'You are already in another active session', 'code': 'already_in_session'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = generate_livekit_token(
                room_id=session.room_id,
                user_id=str(user.id),
                user_name=f"{user.first_name} {user.last_name}",
                role='STUDENT',
            )
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {e}")
            return Response(
                {'error': 'Token generation failed', 'detail': str(e), 'code': 'token_generation_failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Create participant record
        SessionParticipant.objects.create(
            session=session,
            user=user,
            livekit_token=token,
        )

        # Activate session on first join
        previous_status = session.status
        session.activate()

        logger.info(f"Student {user.id} joined session {session.id}")

        # Broadcast WebSocket events
        try:
            if previous_status != session.status:
                broadcast_session_status_change(
                    session_id=str(session.id),
                    status=session.status,
                    previous_status=previous_status,
                    metadata={
                        'student_id': str(user.id),
                        'student_name': f"{user.first_name} {user.last_name}",
                        'event': 'student_joined',
                    },
                )
            broadcast_participant_update(
                session_id=str(session.id),
                user_id=str(user.id),
                role='student',
                user_name=f"{user.first_name} {user.last_name}",
                event_type='participant_joined',
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast join event: {e}")

        return Response(
            {
                'session_id': str(session.id),
                'token': token,
                'status': session.status,
                'teacher_name': f"{session.teacher.first_name} {session.teacher.last_name}",
                'room_id': session.room_id,
                'livekit_ws_url': get_livekit_ws_url(),
                'section_name': session.section.name if session.section else '',
                'class_name': session.section.class_ref.name if session.section else '',
                'participant_count': session.participant_count,
            },
            status=status.HTTP_200_OK,
        )


# ─── Session Rejoin (teacher) ──────────────────────────────────────────────────

class SessionRejoinView(APIView):
    """
    POST /api/tutoring/sessions/{session_id}/rejoin/

    Teacher rejoins their own active session and gets a fresh LiveKit token.
    """

    def post(self, request, session_id):
        user = _get_user(request)
        if not user:
            return _auth_error()

        if user.role != 'teacher':
            return Response(
                {'error': 'Forbidden', 'detail': 'Only teachers can rejoin sessions', 'code': 'teacher_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            session = TutoringSession.objects.select_related(
                'teacher', 'section', 'section__class_ref'
            ).get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {'error': 'Not found', 'detail': 'Session not found', 'code': 'session_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.teacher_id != user.id:
            return Response(
                {'error': 'Forbidden', 'detail': 'You are not the teacher of this session', 'code': 'teacher_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if session.is_ended:
            return Response(
                {'error': 'Session ended', 'detail': 'This session has already ended', 'code': 'session_ended'},
                status=status.HTTP_410_GONE,
            )

        try:
            token = generate_livekit_token(
                room_id=session.room_id,
                user_id=str(user.id),
                user_name=f"{user.first_name} {user.last_name}",
                role='TEACHER',
            )
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {e}")
            return Response(
                {'error': 'Token generation failed', 'detail': str(e), 'code': 'token_generation_failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        session.livekit_token_teacher = token
        session.save(update_fields=['livekit_token_teacher'])

        logger.info(f"Teacher {user.id} rejoined session {session.id}")

        return Response(
            {
                'session_id': str(session.id),
                'room_id': session.room_id,
                'token': token,
                'status': session.status,
                'livekit_ws_url': get_livekit_ws_url(),
                'teacher_id': str(user.id),
                'section_id': session.section_id,
                'section_name': session.section.name if session.section else '',
                'class_name': session.section.class_ref.name if session.section else '',
            },
            status=status.HTTP_200_OK,
        )


# ─── Session Status ────────────────────────────────────────────────────────────

class SessionStatusView(APIView):
    """
    GET /api/tutoring/sessions/{session_id}/status/

    Returns session status with participant list.
    User must be teacher or an active participant.
    """

    def get(self, request, session_id):
        user = _get_user(request)
        if not user:
            return _auth_error()

        try:
            session = TutoringSession.objects.select_related(
                'teacher', 'section', 'section__class_ref'
            ).get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {'error': 'Not found', 'detail': 'Session not found', 'code': 'session_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not session.is_participant(user):
            return Response(
                {'error': 'Forbidden', 'detail': 'You are not a participant', 'code': 'not_participant'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SessionStatusSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ─── Session End ───────────────────────────────────────────────────────────────

class SessionEndView(APIView):
    """
    POST /api/tutoring/sessions/{session_id}/end/

    Only the teacher can end a session. Marks all participants as left.
    """

    def post(self, request, session_id):
        user = _get_user(request)
        if not user:
            return _auth_error()

        try:
            session = TutoringSession.objects.select_related(
                'teacher', 'section', 'section__class_ref'
            ).get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {'error': 'Not found', 'detail': 'Session not found', 'code': 'session_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.teacher_id != user.id:
            return Response(
                {'error': 'Forbidden', 'detail': 'Only the teacher can end this session', 'code': 'teacher_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if session.is_ended:
            return Response(
                {'error': 'Already ended', 'detail': 'Session already ended', 'code': 'already_ended'},
                status=status.HTTP_410_GONE,
            )

        session.end()

        logger.info(f"Session {session.id} ended by teacher {user.id}")

        try:
            broadcast_session_ended(
                session_id=str(session.id),
                reason="Session ended by teacher",
                ended_by="teacher",
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast session end: {e}")

        serializer = SessionStatusSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ─── Available Sessions (student discovery) ────────────────────────────────────

class AvailableSessionsView(APIView):
    """
    GET /api/tutoring/sessions/available/

    Returns sessions available for the current student (based on section).
    """

    def get(self, request):
        user = _get_user(request)
        if not user:
            return _auth_error()

        if user.role != 'student':
            return Response(
                {'error': 'Forbidden', 'detail': 'Only students can list available sessions', 'code': 'student_required'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.students.models import StudentProfile
        try:
            profile = StudentProfile.objects.get(user=user)
        except StudentProfile.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)

        if not profile.section_id:
            return Response([], status=status.HTTP_200_OK)

        sessions = TutoringSession.objects.filter(
            section=profile.section,
            status__in=[SessionStatusEnum.WAITING, SessionStatusEnum.ACTIVE],
        ).select_related('teacher', 'section', 'section__class_ref')

        serializer = AvailableSessionSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ─── Leave Session ─────────────────────────────────────────────────────────────

class LeaveSessionView(APIView):
    """
    POST /api/tutoring/sessions/{session_id}/leave/

    Student leaves session without ending it.
    """

    def post(self, request, session_id):
        user = _get_user(request)
        if not user:
            return _auth_error()

        try:
            session = TutoringSession.objects.get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {'error': 'Not found', 'detail': 'Session not found', 'code': 'session_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        participant = SessionParticipant.objects.filter(
            session=session, user=user, left_at__isnull=True
        ).first()

        if not participant:
            return Response(
                {'error': 'Not in session', 'detail': 'You are not in this session', 'code': 'not_in_session'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participant.left_at = timezone.now()
        participant.save(update_fields=['left_at'])

        logger.info(f"Student {user.id} left session {session.id}")

        try:
            broadcast_participant_update(
                session_id=str(session.id),
                user_id=str(user.id),
                role='student',
                user_name=f"{user.first_name} {user.last_name}",
                event_type='participant_left',
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast leave event: {e}")

        return Response({'detail': 'Left session successfully'}, status=status.HTTP_200_OK)


# ─── Session List ──────────────────────────────────────────────────────────────

class SessionListView(APIView):
    """
    GET /api/tutoring/sessions/

    Teachers see their sessions. Students see sessions they participated in.
    """

    def get(self, request):
        user = _get_user(request)
        if not user:
            return _auth_error()

        if user.role == 'teacher':
            sessions = TutoringSession.objects.filter(teacher=user)
        else:
            participated_ids = SessionParticipant.objects.filter(user=user).values_list('session_id', flat=True)
            sessions = TutoringSession.objects.filter(id__in=participated_ids)

        status_filter = request.query_params.get('status')
        if status_filter:
            sessions = sessions.filter(status=status_filter)

        sessions = sessions.select_related('teacher', 'section', 'section__class_ref')
        serializer = SessionListSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
