from django.shortcuts import render
from django.db import transaction
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, SendOTPSerializer, VerifyOTPSerializer
from .models import CustomUser, EmailOTP
from datetime import timedelta
from django.utils import timezone
from secrets import randbelow

# Create your views here.
class RegisterView(APIView):
    
    def post(self, request):
        try:
            user_serialized = RegisterSerializer(data=request.data)
            user_serialized.is_valid(raise_exception=True)
            user = user_serialized.save()

            response = Response(
                {
                "message" : "User successfully created",
                "payload" : UserSerializer(user).data,
            }, 
            status=status.HTTP_201_CREATED,)

            return response

        except Exception as e:
            self.handle_exception(e)

class LoginView(APIView):

    def post(self, request):
        try:
            user_serialized = LoginSerializer(data=request.data)
            user_serialized.is_valid(raise_exception=True)

            user = user_serialized.validated_data["user"]
            refresh = RefreshToken.for_user(user)

            response = Response(
                {
                    "message": "Successfully logged in",
                    "payload": {
                        "access_token": str(refresh.access_token),
                    }
                },
                status=status.HTTP_200_OK
            )

            response.set_cookie(
                key="refresh_token",
                value=str(refresh),
                httponly=True,
                secure=False,
                samesite="Strict",
                path="/"
            )

            return response

        except Exception as e:
            self.handle_exception(e)
        
class RefreshView(APIView):

    def post(self, request):
        
        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response(
                {
                    "message" : "Refresh token required"
                },
                status = status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            access = str(token.access_token)
        
            response = Response(
                {
                    "message" : "Successfully returned new access token",
                    "payload" : access
                },
                status=status.HTTP_200_OK
            )
            
            return response
        except Exception as e :
            self.handle_exception(e)

class SendOTPView(APIView):

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = CustomUser.objects.get(email=email)

        if EmailOTP.objects.filter(
            user=user, 
            created_at__gte=timezone.now() - timedelta(minutes=1)
        ).exists():
            response = Response(
                {"error": "Too many requests"}, 
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

            return response
        
        code = f"{randbelow(10**6):06d}"

        with transaction.atomic():

            EmailOTP.objects.create(
                user=user,
                is_used=False,
            ).update(is_used=True)

            otp = EmailOTP.objects.create(
                user=user,
                otp=make_password(code),
                expires_at=timezone.now() + timedelta(minutes=10)
            )

            send_mail(
                "Email Verification Code",
                f"Your verification code is: {code}\n\nThis code expires 10 minutes",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )

        response = Response(
            {"message": "OTP sent to your email"}, 
            status=status.HTTP_200_OK
            )
        return response
    
class VerifyOTPView(APIView):

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        otp = serializer.validated_data["otp"]

        otp.is_used = True
        otp.save()

        user.is_active = True
        user.save(update_fields=["is_active"])

        response = Response(
            {
                "message": "Email verified successfully.",
                "payload": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )

        return response

        

        

