"""
Tutoring WebSocket Consumer

Handles real-time communication for tutoring sessions.
Manages:
- Connection establishment and authentication
- Room group subscription (session-based)
- Event broadcasting (participant join/leave, status changes)
- Message routing

Events:
- participant_joined: When teacher or student connects
- participant_left: When teacher or student disconnects
- session_status_changed: When session status changes (WAITING → ACTIVE, etc.)
- ping/pong: Keep-alive messages
"""

import json
import logging
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class TutoringConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for tutoring sessions.
    
    Handles real-time communication between teacher and student.
    Each session has its own "room group" for message broadcasting.
    """
    
    async def connect(self):
        """
        Handle WebSocket connection.
        
        1. Extract session_id from URL
        2. Authenticate user (from scope, set by middleware)
        3. Verify user is part of this session
        4. Join room group
        5. Track connection
        6. Broadcast presence event
        7. Accept connection
        """
        # Extract session_id from URL route
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'tutoring_{self.session_id}'
        self.user = self.scope.get('user')
        self.role = None
        
        # Check authentication
        if not self.user or self.user.is_anonymous:
            logger.warning(
                f"WebSocket connection rejected: No authenticated user for session {self.session_id}"
            )
            await self.close(code=4001)  # Custom close code: Unauthorized
            return
        
        # Verify user is part of this session
        session = await self.get_session()
        if not session:
            logger.warning(
                f"WebSocket connection rejected: Session {self.session_id} not found"
            )
            await self.close(code=4004)  # Custom close code: Not Found
            return
        
        # Determine user's role in this session
        if str(session.teacher_id) == str(self.user.id):
            self.role = 'teacher'
        elif session.student_id and str(session.student_id) == str(self.user.id):
            self.role = 'student'
        else:
            logger.warning(
                f"WebSocket connection rejected: User {self.user.id} is not a participant "
                f"in session {self.session_id}"
            )
            await self.close(code=4003)  # Custom close code: Forbidden
            return
        
        # Check if session is ended
        if session.status == 'ENDED':
            logger.warning(
                f"WebSocket connection rejected: Session {self.session_id} has ended"
            )
            await self.close(code=4010)  # Custom close code: Gone
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Accept the connection
        await self.accept()
        
        logger.info(
            f"WebSocket connected: {self.user.full_name} ({self.role}) "
            f"joined session {self.session_id}"
        )
        
        # Send initial state to the connecting user
        await self.send_initial_state(session)
        
        # Broadcast join event to all participants
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'participant_joined',
                'user_id': str(self.user.id),
                'role': self.role,
                'user_name': self.user.full_name,
                'timestamp': datetime.now().isoformat()
            }
        )
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        
        1. Broadcast leave event to room
        2. Remove from room group
        3. Clean up connection tracking
        """
        if hasattr(self, 'room_group_name') and self.role:
            # Broadcast leave event before leaving the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'participant_left',
                    'user_id': str(self.user.id),
                    'role': self.role,
                    'user_name': self.user.full_name,
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
            logger.info(
                f"WebSocket disconnected: {self.user.full_name} ({self.role}) "
                f"left session {self.session_id} (code: {close_code})"
            )
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages.
        
        Message format:
        {
            "type": "message_type",
            "payload": { ... }
        }
        
        Supported message types:
        - ping: Keep-alive ping
        - webrtc_signal: WebRTC signaling (Phase 3)
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            payload = data.get('payload', {})
            
            # Route to appropriate handler
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
                    'payload': {
                        'message': f'Unknown message type: {message_type}',
                        'code': 'unknown_type'
                    }
                }))
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data[:100]}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'payload': {
                    'message': 'Invalid JSON format',
                    'code': 'invalid_json'
                }
            }))
    
    # ==================== Message Handlers ====================
    
    async def handle_ping(self, payload):
        """Handle ping message - respond with pong."""
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'payload': {
                'timestamp': datetime.now().isoformat()
            }
        }))
    
    async def handle_webrtc_signal(self, payload):
        """
        Handle WebRTC signaling messages.
        
        Forward signaling data to the other participant.
        Used for offer/answer/ICE candidate exchange in Phase 3.
        """
        # Forward to the room group (will be received by both participants)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'webrtc_signal_event',
                'sender_id': str(self.user.id),
                'sender_role': self.role,
                'signal_type': payload.get('signal_type'),
                'signal_data': payload.get('signal_data'),
                'timestamp': datetime.now().isoformat()
            }
        )
    
    async def handle_request_state(self, payload):
        """Handle request for current session state."""
        session = await self.get_session()
        if session:
            await self.send_initial_state(session)
    
    # ==================== Event Handlers (Channel Layer) ====================
    
    async def participant_joined(self, event):
        """
        Handle participant_joined event from channel layer.
        
        Broadcast to WebSocket client.
        """
        await self.send(text_data=json.dumps({
            'type': 'participant_joined',
            'payload': {
                'user_id': event['user_id'],
                'role': event['role'],
                'user_name': event['user_name'],
                'timestamp': event['timestamp']
            }
        }))
    
    async def participant_left(self, event):
        """
        Handle participant_left event from channel layer.
        
        Broadcast to WebSocket client.
        """
        await self.send(text_data=json.dumps({
            'type': 'participant_left',
            'payload': {
                'user_id': event['user_id'],
                'role': event['role'],
                'user_name': event['user_name'],
                'timestamp': event['timestamp']
            }
        }))
    
    async def session_status_changed(self, event):
        """
        Handle session_status_changed event from channel layer.
        
        Broadcast to WebSocket client.
        """
        await self.send(text_data=json.dumps({
            'type': 'session_status_changed',
            'payload': {
                'status': event['status'],
                'previous_status': event.get('previous_status'),
                'metadata': event.get('metadata', {}),
                'timestamp': event['timestamp']
            }
        }))
    
    async def webrtc_signal_event(self, event):
        """
        Handle webrtc_signal event from channel layer.
        
        Forward to WebSocket client (except sender).
        """
        # Don't send signal back to the sender
        if event['sender_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'webrtc_signal',
                'payload': {
                    'sender_id': event['sender_id'],
                    'sender_role': event['sender_role'],
                    'signal_type': event['signal_type'],
                    'signal_data': event['signal_data'],
                    'timestamp': event['timestamp']
                }
            }))
    
    async def session_ended(self, event):
        """
        Handle session_ended event from channel layer.
        
        Notify client and close connection.
        """
        await self.send(text_data=json.dumps({
            'type': 'session_ended',
            'payload': {
                'reason': event.get('reason', 'Session ended'),
                'ended_by': event.get('ended_by'),
                'timestamp': event['timestamp']
            }
        }))
        
        # Close the WebSocket connection
        await self.close(code=1000)  # Normal closure
    
    # ==================== Helper Methods ====================
    
    @database_sync_to_async
    def get_session(self):
        """
        Fetch TutoringSession from database.
        
        Returns:
            TutoringSession instance or None if not found
        """
        from apps.tutoring.models import TutoringSession
        
        try:
            return TutoringSession.objects.select_related(
                'teacher', 'student'
            ).get(id=self.session_id)
        except TutoringSession.DoesNotExist:
            return None
    
    async def send_initial_state(self, session):
        """
        Send initial session state to the connecting user.
        
        Includes:
        - Session status
        - Participant information
        - User's role
        """
        # Build participant info
        teacher_info = {
            'id': str(session.teacher_id),
            'name': session.teacher.full_name,
            'connected': False  # Will be updated by presence events
        }
        
        student_info = None
        if session.student:
            student_info = {
                'id': str(session.student_id),
                'name': session.student.full_name,
                'connected': False  # Will be updated by presence events
            }
        
        await self.send(text_data=json.dumps({
            'type': 'initial_state',
            'payload': {
                'session_id': str(session.id),
                'room_id': session.room_id,
                'status': session.status,
                'your_role': self.role,
                'teacher': teacher_info,
                'student': student_info,
                'timestamp': datetime.now().isoformat()
            }
        }))
