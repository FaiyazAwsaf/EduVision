from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, RefreshView, MeView, WebSocketTicketView,
    AdminUserListView, AdminUserCreateView, AdminUserDetailView,
    AdminResetPasswordView, AdminStatsView,
)

app_name = 'authentication'

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/ws-ticket/', WebSocketTicketView.as_view(), name='ws-ticket'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    # Admin endpoints
    path('auth/admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('auth/admin/users/', AdminUserListView.as_view(), name='admin-user-list'),
    path('auth/admin/users/create/', AdminUserCreateView.as_view(), name='admin-user-create'),
    path('auth/admin/users/<uuid:user_id>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('auth/admin/users/<uuid:user_id>/reset-password/', AdminResetPasswordView.as_view(), name='admin-reset-password'),
]