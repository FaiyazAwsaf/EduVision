from django.shortcuts import render
from django.db import transaction
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import status
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    AdminUserCreateSerializer, AdminUserUpdateSerializer,
)
from .models import CustomUser
from secrets import randbelow
from uuid import uuid4


WS_TICKET_TTL_SECONDS = 60

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
                samesite="Lax",
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
                samesite="Lax",
                path="/"
            )
            
            return response
        except Exception as e :
            return Response(
                {
                    "message": "Invalid or expired refresh token",
                    "detail": str(e),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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


class WebSocketTicketView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ticket = uuid4().hex
        cache_key = f"ws_ticket:{ticket}"
        cache.set(cache_key, str(request.user.id), timeout=WS_TICKET_TTL_SECONDS)

        response = Response(
            {
                "message": "WebSocket ticket created",
                "payload": {
                    "ticket": ticket,
                    "expires_in": WS_TICKET_TTL_SECONDS,
                },
            },
            status=status.HTTP_201_CREATED,
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


# ─── Admin Permission ─────────────────────────────────────────────────────────

from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with role='admin'."""
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


# ─── Admin Views ──────────────────────────────────────────────────────────────


class AdminUserListView(APIView):
    """GET /api/auth/admin/users/ → list all users with optional filters."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        qs = CustomUser.objects.all().order_by("-date_joined")

        role = request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)

        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        data = UserSerializer(qs, many=True).data
        return Response({"message": "Users retrieved", "payload": data})


class AdminUserCreateView(APIView):
    """POST /api/auth/admin/users/create/ → create a user with a specific role."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"message": "User created", "payload": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(APIView):
    """
    GET    /api/auth/admin/users/<uuid>/  → retrieve user
    PATCH  /api/auth/admin/users/<uuid>/  → update user
    DELETE /api/auth/admin/users/<uuid>/  → deactivate user
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def _get_user(self, user_id):
        try:
            return CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return None

    def get(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": "User retrieved", "payload": UserSerializer(user).data})

    def patch(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        user.save()

        return Response({"message": "User updated", "payload": UserSerializer(user).data})

    def delete(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.id == request.user.id:
            return Response(
                {"error": "Cannot delete your own account"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.save()
        return Response({"message": "User deactivated"})


class AdminResetPasswordView(APIView):
    """POST /api/auth/admin/users/<uuid>/reset-password/ → reset user password."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        new_password = request.data.get("new_password")
        if not new_password or len(new_password) < 8:
            return Response(
                {"error": "Password must be at least 8 characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        return Response({"message": "Password reset successfully"})


class AdminStatsView(APIView):
    """GET /api/auth/admin/stats/ → dashboard statistics."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        from apps.students.models import Class, Section, Subject, TeacherProfile, StudentProfile, TeacherSubjectAssignment

        total_users = CustomUser.objects.count()
        total_teachers = CustomUser.objects.filter(role="teacher").count()
        total_students = CustomUser.objects.filter(role="student").count()
        active_users = CustomUser.objects.filter(is_active=True).count()
        total_classes = Class.objects.count()
        total_sections = Section.objects.count()
        total_subjects = Subject.objects.count()
        total_assignments = TeacherSubjectAssignment.objects.count()
        teachers_with_profile = TeacherProfile.objects.count()
        students_with_profile = StudentProfile.objects.count()

        return Response({
            "message": "Stats retrieved",
            "payload": {
                "total_users": total_users,
                "total_teachers": total_teachers,
                "total_students": total_students,
                "active_users": active_users,
                "inactive_users": total_users - active_users,
                "total_classes": total_classes,
                "total_sections": total_sections,
                "total_subjects": total_subjects,
                "total_assignments": total_assignments,
                "teachers_with_profile": teachers_with_profile,
                "teachers_without_profile": total_teachers - teachers_with_profile,
                "students_with_profile": students_with_profile,
                "students_without_profile": total_students - students_with_profile,
            }
        })

