"""
Tutoring WebSocket URL Routing

Defines WebSocket URL patterns for the tutoring application.
"""

from django.urls import re_path
from . import consumers


websocket_urlpatterns = [
    # WebSocket endpoint for tutoring sessions
    # URL: /ws/tutoring/<session_id>/
    # Query string: ?user_id=<uuid>
    re_path(
        r'ws/tutoring/(?P<session_id>[0-9a-f-]+)/$',
        consumers.TutoringConsumer.as_asgi(),
    ),
]
