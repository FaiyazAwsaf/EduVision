from django.shortcuts import render
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import status
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer
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
            return self.handle_exception(e)

class LoginView(APIView):

    def post(self, request):
        
        user_serialized = LoginSerializer(data=request.data)
        if not user_serialized.is_valid():
            return Response(user_serialized.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = user_serialized.validated_data["user"]
            refresh = RefreshToken.for_user(user)

            response = Response(
                {
                    "message": "Successfully logged in",
                    "payload": {
                        "access_token": str(refresh.access_token),
                        "user": UserSerializer(user).data,
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
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
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

            new_refresh = str(token)
        
            response = Response(
                {
                    "message" : "Successfully returned new access token",
                    "payload" : access
                },
                status=status.HTTP_200_OK
            )

            response.set_cookie(
                key="refresh_token",
                value=new_refresh,
                httponly=True,
                secure=False,
                samesite="Strict",
                path="/"
            )
            
            return response
        except Exception as e :
            self.handle_exception(e)

class MeView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data

        response = Response(
            {
                "message": "Successfully retrieved user profile",
                "payload": data,
            },
            status=status.HTTP_200_OK
        )

        return response

class LogoutView(APIView):
    def post(self, request):
        try:
            response = Response(
                {"message": "Logged out successfully"},
                status=status.HTTP_200_OK,
            )
            response.delete_cookie("refresh_token", path="/")
            return response
        except Exception as e:
            return self.handle_exception(e)

        

        

