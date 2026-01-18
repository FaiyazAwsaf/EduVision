"""
WebSocket Authentication Middleware

Provides authentication for WebSocket connections using query string parameters.
This is a temporary authentication mechanism for development that mirrors
the X-User-Id header approach used in HTTP requests.

Security Note:
    This middleware is for development only! In production, use proper
    authentication mechanisms like JWT tokens or session-based auth.
"""

import logging
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


class TokenAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for WebSocket authentication.
    
    Extracts user_id from query string and attaches user to scope.
    
    Query string format:
        ws://host/path/?user_id=<uuid>
    
    Usage in consumer:
        user = self.scope['user']
        if user.is_anonymous:
            await self.close()
    """
    
    async def __call__(self, scope, receive, send):
        # Parse query string
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        
        # Extract user_id
        user_id_list = query_params.get('user_id', [])
        user_id = user_id_list[0] if user_id_list else None
        
        if user_id:
            # Fetch user from database
            scope['user'] = await self.get_user(user_id)
            # Check if we got a real user (TutoringUser has full_name, AnonymousUser doesn't)
            if hasattr(scope['user'], 'full_name'):
                logger.debug(
                    f"WebSocket authenticated: {scope['user'].full_name} ({scope['user'].id})"
                )
        else:
            scope['user'] = AnonymousUser()
            logger.debug("WebSocket connection without user_id")
        
        return await super().__call__(scope, receive, send)
    
    @database_sync_to_async
    def get_user(self, user_id):
        """
        Fetch TutoringUser from database.
        
        Args:
            user_id: UUID string of the user
            
        Returns:
            TutoringUser instance or AnonymousUser if not found
        """
        from apps.tutoring.models import TutoringUser
        
        try:
            return TutoringUser.objects.get(id=user_id)
        except TutoringUser.DoesNotExist:
            logger.warning(f"WebSocket auth failed: User {user_id} not found")
            return AnonymousUser()
        except Exception as e:
            logger.error(f"WebSocket auth error: {str(e)}")
            return AnonymousUser()


class AnonymousUser:
    """
    Placeholder for unauthenticated users.
    
    Mimics Django's AnonymousUser interface for compatibility.
    """
    
    id = None
    is_anonymous = True
    is_authenticated = False
    
    def __str__(self):
        return "AnonymousUser"
