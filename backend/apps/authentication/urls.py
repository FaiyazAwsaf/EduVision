from django.urls import path
from .views import RegisterView, LoginView, LogoutView, RefreshView, SendOTPView, VerifyOTPView

app_name = 'authentication'

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('auth/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('auth/logout/', LogoutView.as_view(), name='logout')
]