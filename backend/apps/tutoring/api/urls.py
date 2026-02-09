"""
Tutoring API URL Configuration

URL patterns for tutoring session management.
"""

from django.urls import path
from apps.tutoring.api.views import (
    SessionCreateView,
    SessionJoinView,
    SessionStatusView,
    SessionEndView,
    SessionListView,
)

app_name = 'tutoring'

urlpatterns = [
    # Session management
    path('sessions/', SessionListView.as_view(), name='session-list'),
    path('sessions/create/', SessionCreateView.as_view(), name='session-create'),
    path('sessions/join/', SessionJoinView.as_view(), name='session-join'),
    path('sessions/<uuid:session_id>/status/', SessionStatusView.as_view(), name='session-status'),
    path('sessions/<uuid:session_id>/end/', SessionEndView.as_view(), name='session-end'),
]
