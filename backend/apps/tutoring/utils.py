"""
LiveKit Token Generation Utility

Provides utility functions for generating LiveKit access tokens
with appropriate permissions for teachers and students.
"""

import os
import logging
from typing import Optional
from datetime import timedelta

logger = logging.getLogger(__name__)


def generate_livekit_token(
    room_id: str,
    user_id: str,
    user_name: str,
    role: str,
    ttl_hours: int = 4
) -> str:
    """
    Generate a LiveKit access token for a user.
    
    Args:
        room_id: The LiveKit room identifier
        user_id: Unique identifier for the user
        user_name: Display name for the user
        role: User's role ('TEACHER' or 'STUDENT')
        ttl_hours: Token time-to-live in hours (default: 4)
    
    Returns:
        Signed JWT token string
    
    Raises:
        ValueError: If required environment variables are not set
        RuntimeError: If token generation fails
    
    Token Permissions:
        - Teachers: canPublish, canSubscribe, roomJoin, roomAdmin
        - Students: canPublish, canSubscribe, roomJoin
    """
    api_key = os.environ.get('LIVEKIT_API_KEY')
    api_secret = os.environ.get('LIVEKIT_API_SECRET')
    
    if not api_key or not api_secret:
        logger.error("LiveKit API credentials not configured")
        raise ValueError(
            "LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables must be set"
        )
    
    try:
        from livekit.api import AccessToken, VideoGrants
        
        # Set room permissions based on role
        if role == 'TEACHER':
            # Teachers get full permissions including room admin
            grant = VideoGrants(
                room=room_id,
                room_join=True,
                can_publish=True,
                can_subscribe=True,
                room_admin=True,  # Teachers can manage room
                can_publish_data=True,
            )
        else:
            # Students get standard participant permissions
            grant = VideoGrants(
                room=room_id,
                room_join=True,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        
        # Create token with appropriate permissions based on role
        token = AccessToken(api_key, api_secret) \
            .with_identity(str(user_id)) \
            .with_name(user_name) \
            .with_ttl(timedelta(hours=ttl_hours)) \
            .with_metadata(f'{{"role": "{role}"}}') \
            .with_grants(grant)
        
        jwt_token = token.to_jwt()
        logger.info(
            f"Generated LiveKit token for user {user_id} ({role}) in room {room_id}"
        )
        return jwt_token
        
    except ImportError:
        logger.error("LiveKit API SDK not installed. Install with: pip install livekit-api")
        raise RuntimeError(
            "LiveKit API SDK not installed. Run: pip install livekit-api"
        )
    except Exception as e:
        logger.error(f"Failed to generate LiveKit token: {str(e)}")
        raise RuntimeError(f"Failed to generate LiveKit token: {str(e)}")


def get_livekit_ws_url() -> Optional[str]:
    """
    Get the LiveKit WebSocket URL from environment.
    
    Returns:
        WebSocket URL string or None if not configured
    """
    return os.environ.get('LIVEKIT_WS_URL')


def validate_livekit_config() -> dict:
    """
    Validate LiveKit configuration.
    
    Returns:
        Dictionary with configuration status:
        {
            'configured': bool,
            'api_key_set': bool,
            'api_secret_set': bool,
            'ws_url_set': bool,
            'ws_url': str or None
        }
    """
    api_key = os.environ.get('LIVEKIT_API_KEY')
    api_secret = os.environ.get('LIVEKIT_API_SECRET')
    ws_url = os.environ.get('LIVEKIT_WS_URL')
    
    config = {
        'api_key_set': bool(api_key),
        'api_secret_set': bool(api_secret),
        'ws_url_set': bool(ws_url),
        'ws_url': ws_url,
    }
    config['configured'] = all([
        config['api_key_set'],
        config['api_secret_set'],
        config['ws_url_set'],
    ])
    
    return config


# ==================== WebSocket Broadcast Utilities ====================

def broadcast_session_status_change(session_id: str, status: str, previous_status: str = None, metadata: dict = None):
    """
    Broadcast session status change to all connected WebSocket clients.
    
    This function should be called from HTTP views when session status changes.
    Uses sync_to_async to work in Django's sync views.
    
    Args:
        session_id: UUID of the tutoring session
        status: New session status
        previous_status: Previous session status (optional)
        metadata: Additional metadata to include (optional)
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from datetime import datetime
    
    channel_layer = get_channel_layer()
    room_group_name = f'tutoring_{session_id}'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'session_status_changed',
            'status': status,
            'previous_status': previous_status,
            'metadata': metadata or {},
            'timestamp': datetime.now().isoformat()
        }
    )
    
    logger.info(f"Broadcast session status change: {session_id} -> {status}")


def broadcast_session_ended(session_id: str, reason: str = "Session ended", ended_by: str = None):
    """
    Broadcast session ended event to all connected WebSocket clients.
    
    This function should be called from HTTP views when a session is ended.
    
    Args:
        session_id: UUID of the tutoring session
        reason: Reason for ending the session
        ended_by: Role of user who ended the session ('teacher' or 'student')
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from datetime import datetime
    
    channel_layer = get_channel_layer()
    room_group_name = f'tutoring_{session_id}'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': 'session_ended',
            'reason': reason,
            'ended_by': ended_by,
            'timestamp': datetime.now().isoformat()
        }
    )
    
    logger.info(f"Broadcast session ended: {session_id} - {reason}")


def broadcast_participant_update(session_id: str, user_id: str, role: str, user_name: str, event_type: str):
    """
    Broadcast participant update (join/leave) to all connected WebSocket clients.
    
    Args:
        session_id: UUID of the tutoring session
        user_id: UUID of the participant
        role: Role of the participant ('teacher' or 'student')
        user_name: Display name of the participant
        event_type: Either 'participant_joined' or 'participant_left'
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from datetime import datetime
    
    if event_type not in ['participant_joined', 'participant_left']:
        raise ValueError(f"Invalid event_type: {event_type}")
    
    channel_layer = get_channel_layer()
    room_group_name = f'tutoring_{session_id}'
    
    async_to_sync(channel_layer.group_send)(
        room_group_name,
        {
            'type': event_type,
            'user_id': str(user_id),
            'role': role,
            'user_name': user_name,
            'timestamp': datetime.now().isoformat()
        }
    )
    
    logger.info(f"Broadcast {event_type}: {user_name} ({role}) in session {session_id}")
