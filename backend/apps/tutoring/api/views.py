"""
Tutoring Session API Views

Implements the core API endpoints for tutoring sessions:
- POST /api/tutoring/sessions/create/ - Teacher creates session
- POST /api/tutoring/sessions/join/ - Student joins session
- GET /api/tutoring/sessions/{session_id}/status/ - Get session status
- POST /api/tutoring/sessions/{session_id}/end/ - End session

All endpoints enforce strict role-based authorization.
"""

import uuid
import logging
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from apps.tutoring.models import (
    TutoringUser, 
    TutoringSession, 
    UserRole, 
    SessionStatus
)
from apps.tutoring.api.serializers import (
    TutoringUserSerializer,
    TutoringUserCreateSerializer,
    SessionCreateSerializer,
    SessionCreateResponseSerializer,
    SessionJoinSerializer,
    SessionJoinResponseSerializer,
    SessionStatusSerializer,
    SessionListSerializer,
)
from apps.tutoring.utils import (
    generate_livekit_token, 
    get_livekit_ws_url,
    broadcast_session_status_change,
    broadcast_session_ended,
    broadcast_participant_update
)

logger = logging.getLogger(__name__)


def get_base_url(request):
    """Get the base URL for constructing join links."""
    # Use frontend URL for join links
    return "http://localhost:3000"


class UserListCreateView(APIView):
    """
    API endpoint for listing and creating test users.
    
    GET: List all users
    POST: Create a new user
    
    Note: This endpoint is exempt from authentication for testing purposes.
    """
    
    def get(self, request):
        """List all users."""
        users = TutoringUser.objects.all()
        serializer = TutoringUserSerializer(users, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        """Create a new user."""
        serializer = TutoringUserCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = TutoringUser.objects.create(**serializer.validated_data)
            response_serializer = TutoringUserSerializer(user)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SessionCreateView(APIView):
    """
    POST /api/tutoring/sessions/create/
    
    Create a new tutoring session. Only TEACHERS can create sessions.
    
    Authorization: User must be a TEACHER
    
    Returns:
        - 201: Session created successfully
        - 403: User is not a teacher
        - 500: LiveKit token generation failed
    """
    
    def post(self, request):
        # Get authenticated user (attached by middleware)
        user = getattr(request, 'tutoring_user', None)
        
        if not user:
            return Response(
                {
                    'error': 'Authentication required',
                    'detail': 'User not authenticated',
                    'code': 'auth_required'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Verify user is a teacher
        if not user.is_teacher:
            logger.warning(
                f"Non-teacher user {user.id} attempted to create session"
            )
            return Response(
                {
                    'error': 'Forbidden',
                    'detail': 'Only teachers can create tutoring sessions',
                    'code': 'teacher_required'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generate unique room ID
        room_id = f"tutoring_{uuid.uuid4()}"
        
        try:
            # Generate LiveKit token for teacher
            token = generate_livekit_token(
                room_id=room_id,
                user_id=str(user.id),
                user_name=user.full_name,
                role='TEACHER'
            )
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {str(e)}")
            return Response(
                {
                    'error': 'Token generation failed',
                    'detail': str(e),
                    'code': 'token_generation_failed'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Create session
        session = TutoringSession.objects.create(
            room_id=room_id,
            teacher=user,
            status=SessionStatus.WAITING,
            livekit_token_teacher=token
        )
        
        logger.info(
            f"Session created: {session.id} by teacher {user.id}"
        )
        
        # Build join URL (frontend route)
        base_url = get_base_url(request)
        join_url = f"{base_url}/student/join/{room_id}"
        
        return Response(
            {
                'session_id': str(session.id),
                'room_id': room_id,
                'token': token,
                'status': session.status,
                'join_url': join_url,
                'livekit_ws_url': get_livekit_ws_url(),
                'teacher_id': str(user.id),
            },
            status=status.HTTP_201_CREATED
        )


class SessionJoinView(APIView):
    """
    POST /api/tutoring/sessions/join/
    
    Join an existing tutoring session. Only STUDENTS can join sessions.
    
    Authorization: User must be a STUDENT
    
    Request Body:
        - room_id: The room ID to join
    
    Returns:
        - 200: Successfully joined session
        - 400: Student already in another active session
        - 403: User is not a student
        - 404: Room not found
        - 409: Another student already joined
        - 410: Session has ended
    """
    
    def post(self, request):
        # Get authenticated user
        user = getattr(request, 'tutoring_user', None)
        
        if not user:
            return Response(
                {
                    'error': 'Authentication required',
                    'detail': 'User not authenticated',
                    'code': 'auth_required'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Verify user is a student
        if not user.is_student:
            logger.warning(
                f"Non-student user {user.id} attempted to join session"
            )
            return Response(
                {
                    'error': 'Forbidden',
                    'detail': 'Only students can join tutoring sessions',
                    'code': 'student_required'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate request data
        serializer = SessionJoinSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    'error': 'Invalid request',
                    'detail': serializer.errors,
                    'code': 'validation_error'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        room_id = serializer.validated_data['room_id']
        
        # Find session by room_id
        try:
            session = TutoringSession.objects.get(room_id=room_id)
        except TutoringSession.DoesNotExist:
            logger.warning(f"Room not found: {room_id}")
            return Response(
                {
                    'error': 'Room not found',
                    'detail': f"No session found with room ID: {room_id}",
                    'code': 'room_not_found'
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if session has ended
        if session.is_ended:
            logger.warning(
                f"User {user.id} attempted to join ended session {session.id}"
            )
            return Response(
                {
                    'error': 'Session ended',
                    'detail': 'This tutoring session has already ended',
                    'code': 'session_ended'
                },
                status=status.HTTP_410_GONE
            )
        
        # Check if student already joined (this session or same student)
        if session.has_student:
            # Check if it's the same student rejoining
            if session.student_id == user.id:
                # Return existing token for reconnection
                return Response(
                    {
                        'session_id': str(session.id),
                        'token': session.livekit_token_student,
                        'status': session.status,
                        'teacher_name': session.teacher.full_name,
                        'room_id': room_id,
                        'livekit_ws_url': get_livekit_ws_url(),
                    },
                    status=status.HTTP_200_OK
                )
            
            logger.warning(
                f"User {user.id} attempted to join session {session.id} "
                f"but another student already joined"
            )
            return Response(
                {
                    'error': 'Session full',
                    'detail': 'Another student has already joined this session',
                    'code': 'session_full'
                },
                status=status.HTTP_409_CONFLICT
            )
        
        # Check if student is already in another active session
        active_sessions = TutoringSession.objects.filter(
            student=user,
            status__in=[SessionStatus.WAITING, SessionStatus.ACTIVE, SessionStatus.GRACE]
        ).exclude(id=session.id)
        
        if active_sessions.exists():
            logger.warning(
                f"User {user.id} already in another active session"
            )
            return Response(
                {
                    'error': 'Already in session',
                    'detail': 'You are already in another active tutoring session',
                    'code': 'already_in_session'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Generate LiveKit token for student
            token = generate_livekit_token(
                room_id=room_id,
                user_id=str(user.id),
                user_name=user.full_name,
                role='STUDENT'
            )
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {str(e)}")
            return Response(
                {
                    'error': 'Token generation failed',
                    'detail': str(e),
                    'code': 'token_generation_failed'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Activate session with student
        session.activate(student=user, token=token)
        
        logger.info(
            f"Student {user.id} joined session {session.id}"
        )
        
        # Broadcast WebSocket event for student join
        try:
            broadcast_session_status_change(
                session_id=str(session.id),
                status=session.status,
                previous_status=SessionStatus.WAITING,
                metadata={
                    'student_id': str(user.id),
                    'student_name': user.full_name,
                    'event': 'student_joined'
                }
            )
            broadcast_participant_update(
                session_id=str(session.id),
                user_id=str(user.id),
                role='student',
                user_name=user.full_name,
                event_type='participant_joined'
            )
        except Exception as e:
            # Don't fail the join if WebSocket broadcast fails
            logger.warning(f"Failed to broadcast join event: {str(e)}")
        
        return Response(
            {
                'session_id': str(session.id),
                'token': token,
                'status': session.status,
                'teacher_name': session.teacher.full_name,
                'room_id': room_id,
                'livekit_ws_url': get_livekit_ws_url(),
            },
            status=status.HTTP_200_OK
        )


class SessionStatusView(APIView):
    """
    GET /api/tutoring/sessions/{session_id}/status/
    
    Get the current status of a tutoring session.
    
    Authorization: User must be the teacher or student of this session
    
    Returns:
        - 200: Session status
        - 403: User not authorized for this session
        - 404: Session not found
    """
    
    def get(self, request, session_id):
        # Get authenticated user
        user = getattr(request, 'tutoring_user', None)
        
        if not user:
            return Response(
                {
                    'error': 'Authentication required',
                    'detail': 'User not authenticated',
                    'code': 'auth_required'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Find session
        try:
            session = TutoringSession.objects.get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {
                    'error': 'Session not found',
                    'detail': f"No session found with ID: {session_id}",
                    'code': 'session_not_found'
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify user is a participant
        if not session.is_participant(user):
            logger.warning(
                f"User {user.id} attempted to access session {session.id} "
                f"without authorization"
            )
            return Response(
                {
                    'error': 'Forbidden',
                    'detail': 'You are not authorized to view this session',
                    'code': 'not_participant'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = SessionStatusSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionEndView(APIView):
    """
    POST /api/tutoring/sessions/{session_id}/end/
    
    End a tutoring session. Only the teacher can end a session.
    
    Authorization: User must be the teacher of this session
    
    Returns:
        - 200: Session ended successfully
        - 403: User is not the teacher of this session
        - 404: Session not found
        - 410: Session already ended
    """
    
    def post(self, request, session_id):
        # Get authenticated user
        user = getattr(request, 'tutoring_user', None)
        
        if not user:
            return Response(
                {
                    'error': 'Authentication required',
                    'detail': 'User not authenticated',
                    'code': 'auth_required'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Find session
        try:
            session = TutoringSession.objects.get(id=session_id)
        except TutoringSession.DoesNotExist:
            return Response(
                {
                    'error': 'Session not found',
                    'detail': f"No session found with ID: {session_id}",
                    'code': 'session_not_found'
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify user is the teacher
        if session.teacher_id != user.id:
            logger.warning(
                f"User {user.id} attempted to end session {session.id} "
                f"without authorization"
            )
            return Response(
                {
                    'error': 'Forbidden',
                    'detail': 'Only the teacher can end this session',
                    'code': 'teacher_required'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if already ended
        if session.is_ended:
            return Response(
                {
                    'error': 'Session already ended',
                    'detail': 'This session has already ended',
                    'code': 'already_ended'
                },
                status=status.HTTP_410_GONE
            )
        
        # End the session
        previous_status = session.status
        session.end()
        
        logger.info(
            f"Session {session.id} ended by teacher {user.id}"
        )
        
        # Broadcast WebSocket event for session end
        try:
            broadcast_session_ended(
                session_id=str(session.id),
                reason="Session ended by teacher",
                ended_by="teacher"
            )
        except Exception as e:
            # Don't fail the end if WebSocket broadcast fails
            logger.warning(f"Failed to broadcast session end event: {str(e)}")
        
        serializer = SessionStatusSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SessionListView(APIView):
    """
    GET /api/tutoring/sessions/
    
    List sessions for the current user.
    Teachers see their created sessions.
    Students see sessions they have joined.
    
    Query params:
        - status: Filter by status (WAITING, ACTIVE, ENDED)
    """
    
    def get(self, request):
        # Get authenticated user
        user = getattr(request, 'tutoring_user', None)
        
        if not user:
            return Response(
                {
                    'error': 'Authentication required',
                    'detail': 'User not authenticated',
                    'code': 'auth_required'
                },
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        # Filter sessions based on role
        if user.is_teacher:
            sessions = TutoringSession.objects.filter(teacher=user)
        else:
            sessions = TutoringSession.objects.filter(student=user)
        
        # Apply status filter if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            sessions = sessions.filter(status=status_filter)
        
        serializer = SessionListSerializer(sessions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
