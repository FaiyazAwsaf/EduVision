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
