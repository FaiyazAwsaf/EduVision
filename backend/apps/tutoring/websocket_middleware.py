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
from django.core.cache import cache

logger = logging.getLogger(__name__)


class TokenAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for WebSocket authentication.
    
    Extracts one-time ws_ticket from query string and attaches user to scope.
    
    Query string format:
        ws://host/path/?ws_ticket=<ticket>
    
    Usage in consumer:
        user = self.scope['user']
        if user.is_anonymous:
            await self.close()
    """
    
    async def __call__(self, scope, receive, send):
        # Parse query string
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)

        # Preferred auth: one-time websocket ticket
        ws_ticket_list = query_params.get('ws_ticket', [])
        ws_ticket = ws_ticket_list[0] if ws_ticket_list else None
        if ws_ticket:
            user_id = await self.consume_ticket(ws_ticket)
            if user_id:
                scope['user'] = await self.get_user(user_id)
                if getattr(scope['user'], 'is_authenticated', False):
                    logger.debug(f"WebSocket authenticated via ticket for user {scope['user'].id}")
                    return await super().__call__(scope, receive, send)

            scope['user'] = AnonymousUser()
            logger.warning("WebSocket auth failed: invalid/expired ws_ticket")
            return await super().__call__(scope, receive, send)
        
        # Legacy fallback: user_id query parameter
        user_id_list = query_params.get('user_id', [])
        user_id = user_id_list[0] if user_id_list else None
        
        if user_id:
            # Fetch user from database
            scope['user'] = await self.get_user(user_id)
            # Check if we got a real user (CustomUser has first_name, AnonymousUser doesn't)
            if hasattr(scope['user'], 'first_name'):
                logger.debug(
                    f"WebSocket authenticated: {scope['user'].first_name} {scope['user'].last_name} ({scope['user'].id})"
                )
        else:
            scope['user'] = AnonymousUser()
            logger.debug("WebSocket connection without user_id")
        
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def consume_ticket(self, ticket):
        cache_key = f"ws_ticket:{ticket}"
        user_id = cache.get(cache_key)
        if user_id:
            # One-time ticket: delete immediately after successful read.
            cache.delete(cache_key)
        return user_id
    
    @database_sync_to_async
    def get_user(self, user_id):
        """
        Fetch CustomUser from database.
        
        Args:
            user_id: UUID string of the user
            
        Returns:
            CustomUser instance or AnonymousUser if not found
        """
        from apps.authentication.models import CustomUser
        
        try:
            return CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            logger.warning(f"WebSocket auth failed: User {user_id} not found")
            return AnonymousUser()
        except Exception as e:
            logger.error(f"WebSocket auth error: {str(e)}")
            return AnonymousUser()
