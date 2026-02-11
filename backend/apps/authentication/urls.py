from django.urls import path
from .views import RegisterView, LoginView, RefreshView, ChangePasswordView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
]