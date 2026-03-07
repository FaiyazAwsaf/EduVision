"""
WhiteboardConsumer

Handles WebSocket connections for real-time collaboration
Manages room-based communication for whiteboard and WebRTC signaling
Does NOT process video streams - only relays signaling and canvas events

Requires authenticated user - checks if user is session owner or member
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from asgiref.sync import sync_to_async
from .models import WhiteboardSession, SessionMember


class WhiteboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for whiteboard collaboration

    Supports:
    - Room-based communication (session-based)
    - Canvas event forwarding (drawing, erasing, clearing)
    - WebRTC signaling (offer, answer, ICE candidates)
    - User join/leave notifications
    - Drawing permission management
    - Authentication: Only allows authenticated users who are session members
    """

    async def connect(self):
        """
        Handle WebSocket connection
        Extract session ID from URL and authenticate user
        Join room group only if authorized
        """
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.user = self.scope.get("user")
        self.room_group_name = f"whiteboard_{self.session_id}"

        # Check if user is authenticated
        if isinstance(self.user, AnonymousUser) or not self.user:
            print(f"[WebSocket] Anonymous user attempted to connect to session: {self.session_id}")
            await self.close(code=4001, reason="Authentication required")
            return

        # Check if user has access to this session
        has_access = await self._check_session_access()
        if not has_access:
            print(f"[WebSocket] User {self.user.username} denied access to session: {self.session_id}")
            await self.close(code=4003, reason="Access denied")
            return

        # User is authenticated and authorized
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        print(f"[WebSocket] User {self.user.username} connected to session: {self.session_id}")

        # Notify others that user joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_joined",
                "user_id": str(self.user.id),
                "username": self.user.username,
            },
        )

    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection
        Leave room group and notify others
        """
        # leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        # Notify others that user left
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "user_left",
                "user_id": str(self.user.id),
                "username": self.user.username if hasattr(self.user, "username") else "Unknown",
            },
        )

        print(
            f"[WebSocket] User {self.user.username if hasattr(self.user, 'username') else 'Unknown'} "
            f"disconnected from session: {self.session_id} (code: {close_code})"
        )

    async def receive(self, text_data):
        """
        Receive message from WebSocket client
        Parse and forward to appropriate handler
        """
        try:
            data = json.loads(text_data)
            message_type = data.get("type")

            print(f"[WebSocket] Received message type: {message_type} from {self.user.username}")

            # forward message to all clients in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_message",
                    "message": data,
                    "user_id": str(self.user.id),
                    "username": self.user.username,
                },
            )

        except json.JSONDecodeError:
            print("[WebSocket] Error: Invalid JSON received")
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": "Invalid JSON format"}
                )
            )
        except Exception as e:
            print(f"[WebSocket] Error processing message: {str(e)}")
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "message": f"Error processing message: {str(e)}"}
                )
            )

    async def broadcast_message(self, event):
        """
        Receive message from room group and send to WebSocket

        This method is called when channel_layer.group_send() is used
        The method name must match the 'type' key in the message dict
        """
        message = event["message"]

        # Send message to WebSocket
        await self.send(text_data=json.dumps(message))

    async def user_joined(self, event):
        """Handle user joined event"""
        await self.send(
            text_data=json.dumps({
                "type": "user_joined",
                "user_id": event["user_id"],
                "username": event["username"],
            })
        )

    async def user_left(self, event):
        """Handle user left event"""
        await self.send(
            text_data=json.dumps({
                "type": "user_left",
                "user_id": event["user_id"],
                "username": event["username"],
            })
        )

    @sync_to_async
    def _check_session_access(self):
        """
        Check if user is authorized to access this session
        User must be either:
        1. The session owner, OR
        2. A member of the session
        """
        try:
            session = WhiteboardSession.objects.get(id=self.session_id)

            # Check if user is owner
            if session.owner_id == self.user.id:
                return True

            # Check if user is a member
            is_member = SessionMember.objects.filter(
                session=session, user=self.user
            ).exists()

            return is_member

        except WhiteboardSession.DoesNotExist:
            print(f"[WebSocket] Session {self.session_id} does not exist")
            return False
        except Exception as e:
            print(f"[WebSocket] Error checking session access: {str(e)}")
            return False