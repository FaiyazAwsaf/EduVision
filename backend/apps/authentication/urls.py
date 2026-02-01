from django.urls import path
from .views import RegisterView, LoginView

app_name = 'authentication'

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    # path('auth/refresh/', views.refresh, name='refresh')
]