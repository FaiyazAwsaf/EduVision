from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, ChangePasswordSerializer
from .backends import CustomUserJWTAuthentication

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
            raise Exception(str(e))
        
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
                        "refresh_token": str(refresh),
                        "user": UserSerializer(user).data
                    }
                },
                status=status.HTTP_200_OK
            )

            return response

        except Exception as e:
            raise Exception(str(e))
        
class RefreshView(APIView):

    def post(self, request):
        
        refresh_token = request.data.get("refresh_token")

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
            raise Exception(str(e))


class ChangePasswordView(APIView):
    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        if not user.verify_password(serializer.validated_data["current_password"]):
            return Response(
                {"message": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password_hash"])

        return Response(
            {"message": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )
