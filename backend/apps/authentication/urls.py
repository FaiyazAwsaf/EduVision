from django.urls import path
from .views import RegisterView, LoginView, RefreshView

app_name = 'authentication'

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh')
]