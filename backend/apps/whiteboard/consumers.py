"""
WhiteboardConsumer

Handles WebSocket connections for real-time collaboration
Manages room-based communication for whiteboard and WebRTC signaling
Does NOT process video streams - only relays signaling and canvas events
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer


class WhiteboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for whiteboard collaboration

    Supports:
    - Room-based communication (session-based)
    - Canvas event forwarding (drawing, erasing, clearing)
    - WebRTC signaling (offer, answer, ICE candidates)
    - User join/leave notifications
    - Drawing permission management
    """

    async def connect(self):
        """
        Handle WebSocket connection
        Extract session ID from URL and join room group
        """
        self.session_id = self.scope["url_route"]["kwargs"]["session_id"]
        self.room_group_name = f"whiteboard_{self.session_id}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()

        print(f"[WebSocket] Client connected to session: {self.session_id}")

    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection
        Leave room group
        """
        # leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

        print(
            f"[WebSocket] Client disconnected from session: {self.session_id} (code: {close_code})"
        )

    async def receive(self, text_data):
        """
        Receive message from WebSocket client
        Parse and forward to appropriate handler
        """
        try:
            data = json.loads(text_data)
            message_type = data.get("type")

            print(f"[WebSocket] Received message type: {message_type}")

            # forward message to all clients in the room
            await self.channel_layer.group_send(
                self.room_group_name, {"type": "broadcast_message", "message": data}
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