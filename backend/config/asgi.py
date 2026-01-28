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
from channels.security.websocket import AllowedHostsOriginValidator
from apps.tutoring.websocket_middleware import TokenAuthMiddleware
from apps.tutoring.routing import websocket_urlpatterns as tutoring_ws_patterns
from apps.whiteboard.routing import websocket_urlpatterns as whiteboard_ws_patterns

# Combine websocket url patterns from apps that expose WebSocket endpoints.
websocket_urlpatterns = tutoring_ws_patterns + whiteboard_ws_patterns

application = ProtocolTypeRouter({
    # HTTP requests are handled by Django
    "http": django_asgi_app,
    
    # WebSocket connections are routed through Channels
    "websocket": AllowedHostsOriginValidator(
        TokenAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
