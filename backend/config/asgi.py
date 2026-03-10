"""
ASGI config for EduVision project.

It exposes the ASGI callable as a module-level variable named ``application``.

This configuration supports both HTTP and WebSocket protocols.
- HTTP requests are handled by Django's standard ASGI application
- WebSocket connections are routed through Django Channels

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application

# Set up Django settings before importing anything else
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

# Import Channels components after Django setup
from channels.routing import ProtocolTypeRouter, URLRouter
from apps.tutoring.websocket_middleware import TokenAuthMiddleware
from apps.tutoring.routing import websocket_urlpatterns as tutoring_ws_patterns
from apps.whiteboard.routing import websocket_urlpatterns as whiteboard_ws_patterns

# Combine websocket url patterns from apps that expose WebSocket endpoints.
websocket_urlpatterns = tutoring_ws_patterns + whiteboard_ws_patterns


class CORSOriginValidator:
    """
    WebSocket origin validator that checks against CORS_ALLOWED_ORIGINS.

    AllowedHostsOriginValidator only checks ALLOWED_HOSTS, which doesn't
    include the frontend domain in cross-origin deployments (e.g. Vercel + Railway).
    This validator uses CORS_ALLOWED_ORIGINS instead.
    """

    def __init__(self, application):
        self.application = application

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            from django.conf import settings
            from urllib.parse import urlparse

            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin", b"").decode("utf-8", errors="ignore")

            if origin:
                allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
                allowed_hosts = getattr(settings, "ALLOWED_HOSTS", [])

                origin_parsed = urlparse(origin)
                origin_host = origin_parsed.hostname or ""

                # Allow if origin is in CORS_ALLOWED_ORIGINS or host is in ALLOWED_HOSTS
                is_allowed = (
                    origin in allowed_origins
                    or origin_host in allowed_hosts
                    or "*" in allowed_hosts
                )

                if not is_allowed:
                    # Reject the WebSocket
                    await send({"type": "websocket.close", "code": 4003})
                    return

        return await self.application(scope, receive, send)


application = ProtocolTypeRouter({
    # HTTP requests are handled by Django
    "http": django_asgi_app,
    
    # WebSocket connections are routed through Channels
    "websocket": CORSOriginValidator(
        TokenAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
