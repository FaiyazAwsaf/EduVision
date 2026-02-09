from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer

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

