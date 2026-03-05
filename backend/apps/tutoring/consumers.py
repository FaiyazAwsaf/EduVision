"""
Tutoring WebSocket Consumer

Handles real-time communication for section-based batch tutoring sessions.
Manages:
- Connection establishment and authentication
- Room group subscription (session-based)
- Event broadcasting (participant join/leave, status changes)
- Multi-student support: teacher + N students per session

Events:
- participant_joined: When teacher or student connects
- participant_left: When teacher or student disconnects
- session_status_changed: When session status changes
- session_ended: When session is ended by teacher
- ping/pong: Keep-alive messages
"""

import json
import logging
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)

# Track connected users per session (in-memory)
# Structure: {session_id: {user_id: {'role': 'teacher'|'student', 'channel_name': '...', 'user_name': '...'}}}
_connected_users = defaultdict(dict)
_connected_users_lock = threading.Lock()


class TutoringConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for tutoring sessions.

    Handles real-time communication between teacher and multiple students.
    Each session has its own "room group" for message broadcasting.
    """

    async def connect(self):
        """
        Handle WebSocket connection.

        1. Extract session_id from URL
        2. Authenticate user
        3. Verify user is teacher or an active participant
        4. Join room group
        5. Track connection
        6. Broadcast presence event
        7. Accept connection
        """
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'tutoring_{self.session_id}'
        self.user = self.scope.get('user')
        self.role = None

        # Check authentication
        if not self.user or not hasattr(self.user, 'first_name'):
            logger.warning(f"WS rejected: No authenticated user for session {self.session_id}")
            await self.close(code=4001)
            return

        # Verify user is part of this session
        session = await self.get_session()
        if not session:
            logger.warning(f"WS rejected: Session {self.session_id} not found")
            await self.close(code=4004)
            return

        # Determine role: teacher or participant
        if str(session.teacher_id) == str(self.user.id):
            self.role = 'teacher'
        elif await self.is_session_participant(session):
            self.role = 'student'
        else:
            logger.warning(f"WS rejected: User {self.user.id} not a participant in {self.session_id}")
            await self.close(code=4003)
            return

        # Check if session is ended
        if session.status == 'ENDED':
            logger.warning(f"WS rejected: Session {self.session_id} has ended")
            await self.close(code=4010)
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        # Track this connection
        with _connected_users_lock:
            _connected_users[self.session_id][str(self.user.id)] = {
                'role': self.role,
                'channel_name': self.channel_name,
                'user_name': f"{self.user.first_name} {self.user.last_name}",
            }

        # Accept the connection
        await self.accept()

        logger.info(
            f"WS connected: {self.user.first_name} {self.user.last_name} ({self.role}) "
            f"joined session {self.session_id}"
        )

        # Send initial state
        await self.send_initial_state(session)

        # Broadcast join event
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'participant_joined',
                'user_id': str(self.user.id),
                'role': self.role,
                'user_name': f"{self.user.first_name} {self.user.last_name}",
                'timestamp': datetime.now().isoformat(),
            },
        )

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if hasattr(self, 'room_group_name') and self.role:
            # Remove from connection tracking
            with _connected_users_lock:
                if self.session_id in _connected_users:
                    _connected_users[self.session_id].pop(str(self.user.id), None)
                    if not _connected_users[self.session_id]:
                        del _connected_users[self.session_id]

            # Broadcast leave event
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'participant_left',
                    'user_id': str(self.user.id),
                    'role': self.role,
                    'user_name': f"{self.user.first_name} {self.user.last_name}",
                    'timestamp': datetime.now().isoformat(),
                },
            )

            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )

            logger.info(
                f"WS disconnected: {self.user.first_name} {self.user.last_name} ({self.role}) "
                f"left session {self.session_id} (code: {close_code})"
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            payload = data.get('payload', {})

            handlers = {
                'ping': self.handle_ping,
                'webrtc_signal': self.handle_webrtc_signal,
                'request_state': self.handle_request_state,
            }

            handler = handlers.get(message_type)
            if handler:
                await handler(payload)
            else:
                logger.warning(f"Unknown message type: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'payload': {'message': f'Unknown message type: {message_type}', 'code': 'unknown_type'},
                }))
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data[:100]}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'payload': {'message': 'Invalid JSON format', 'code': 'invalid_json'},
            }))

    # ==================== Message Handlers ====================

    async def handle_ping(self, payload):
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'payload': {'timestamp': datetime.now().isoformat()},
        }))

    async def handle_webrtc_signal(self, payload):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'webrtc_signal_event',
                'sender_id': str(self.user.id),
                'sender_role': self.role,
                'signal_type': payload.get('signal_type'),
                'signal_data': payload.get('signal_data'),
                'timestamp': datetime.now().isoformat(),
            },
        )

    async def handle_request_state(self, payload):
        session = await self.get_session()
        if session:
            await self.send_initial_state(session)

    # ==================== Event Handlers (Channel Layer) ====================

    async def participant_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'participant_joined',
            'payload': {
                'user_id': event['user_id'],
                'role': event['role'],
                'user_name': event['user_name'],
                'timestamp': event['timestamp'],
            },
        }))

    async def participant_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'participant_left',
            'payload': {
                'user_id': event['user_id'],
                'role': event['role'],
                'user_name': event['user_name'],
                'timestamp': event['timestamp'],
            },
        }))

    async def session_status_changed(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session_status_changed',
            'payload': {
                'status': event['status'],
                'previous_status': event.get('previous_status'),
                'metadata': event.get('metadata', {}),
                'timestamp': event['timestamp'],
            },
        }))

    async def webrtc_signal_event(self, event):
        # Don't send signal back to the sender
        if event['sender_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'webrtc_signal',
                'payload': {
                    'sender_id': event['sender_id'],
                    'sender_role': event['sender_role'],
                    'signal_type': event['signal_type'],
                    'signal_data': event['signal_data'],
                    'timestamp': event['timestamp'],
                },
            }))

    async def session_ended(self, event):
        await self.send(text_data=json.dumps({
            'type': 'session_ended',
            'payload': {
                'reason': event.get('reason', 'Session ended'),
                'ended_by': event.get('ended_by'),
                'timestamp': event['timestamp'],
            },
        }))
        await self.close(code=1000)

    # ==================== Helper Methods ====================

    @database_sync_to_async
    def get_session(self):
        from apps.tutoring.models import TutoringSession
        try:
            return TutoringSession.objects.select_related(
                'teacher', 'section', 'section__class_ref'
            ).get(id=self.session_id)
        except TutoringSession.DoesNotExist:
            return None

    @database_sync_to_async
    def is_session_participant(self, session):
        """Check if user is an active participant of this session."""
        from apps.tutoring.models import SessionParticipant
        return SessionParticipant.objects.filter(
            session=session, user=self.user, left_at__isnull=True
        ).exists()

    @database_sync_to_async
    def get_participant_list(self, session):
        """Get list of active participants from the database."""
        from apps.tutoring.models import SessionParticipant
        participants = SessionParticipant.objects.filter(
            session=session, left_at__isnull=True
        ).select_related('user')
        return [
            {
                'id': str(p.user.id),
                'name': f"{p.user.first_name} {p.user.last_name}",
                'role': 'student',
                'joined_at': p.joined_at.isoformat(),
            }
            for p in participants
        ]

    async def send_initial_state(self, session):
        """
        Send initial session state to the connecting user.
        Includes session info, teacher info, and full participant list.
        """
        # Get currently connected users for online status
        with _connected_users_lock:
            connected = _connected_users.get(self.session_id, {})

        teacher_connected = str(session.teacher_id) in connected
        teacher_info = {
            'id': str(session.teacher_id),
            'name': f"{session.teacher.first_name} {session.teacher.last_name}",
            'connected': teacher_connected,
        }

        # Get participants from database
        db_participants = await self.get_participant_list(session)

        # Merge with in-memory connection tracking for online status
        for p in db_participants:
            p['connected'] = p['id'] in connected

        section_info = None
        if session.section:
            section_info = {
                'id': session.section.id,
                'name': session.section.name,
                'class_name': session.section.class_ref.name if session.section.class_ref else None,
            }

        await self.send(text_data=json.dumps({
            'type': 'initial_state',
            'payload': {
                'session_id': str(session.id),
                'room_id': session.room_id,
                'status': session.status,
                'your_role': self.role,
                'teacher': teacher_info,
                'participants': db_participants,
                'section': section_info,
                'timestamp': datetime.now().isoformat(),
            },
        }))
