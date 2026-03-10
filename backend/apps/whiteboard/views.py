import os
import json
import base64
import google.generativeai as genai
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .services.prompt_builder import create_math_prompt, create_text_prompt, create_equation_solver_prompt
from .models import WhiteboardSession, SessionMember, WhiteboardState
from .serializers import (
    WhiteboardSessionSerializer,
    WhiteboardSessionDetailSerializer,
    WhiteboardStateSerializer,
    WhiteboardStateCreateSerializer,
    SessionMemberSerializer,
)
from apps.authentication.models import CustomUser
from apps.tutoring.utils import generate_livekit_token, get_livekit_ws_url

genai.configure(api_key=os.environ.get("GEMINI_API_KEY_2"))


@csrf_exempt
@require_http_methods(["POST"])
def convert_to_latex(request):

    """
    convert handwritten math/text to LaTeX using Gemini Vision API
    
    expected request body:
    {
        "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
        "type": "math" | "text"
    }
    
    returns:
    {
        "success": true,
        "latex": "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",
        "error": null
    }
    """

    try:
        # parse json body
        data = json.loads(request.body)
        image_data = data.get("image")
        conversion_type = data.get("type", "math")

        model = genai.GenerativeModel("gemini-2.5-flash")

        if not image_data:
            return JsonResponse(
                {
                "success": False,
                "latex": None,
                "error": "Image data not provided",
                },
                status = status.HTTP_400_BAD_REQUEST,
            )
            
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]

        image_bytes = base64.b64decode(image_data)
        
        if conversion_type == "math":
            prompt = create_math_prompt()
        else:
            prompt = create_text_prompt()

        image_parts = [
            {
                "mime_type": "image/png",
                "data": image_bytes,
            }
        ]

        response = model.generate_content([prompt, image_parts[0]])
        
        latex_output = response.text.strip()

        if latex_output.startswith("```"):
            latex_output = latex_output.split("```")[1]
            
            if latex_output.startswith("latex"):
                latex_output = latex_output[5:]
            
            latex_output = latex_output.strip()
        
        # return success response
        return JsonResponse(
            {
                "success": True,
                "latex": latex_output,
                "error": None,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        return JsonResponse(
            {
            "success": False,
            "latex": None,
            "error": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@csrf_exempt
@require_http_methods(["POST"])
def evaluate_equation(request):
    """
    Evaluate/solve a handwritten mathematical equation using Gemini Vision API
    
    Expected request body:
    {
        "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
    }
    
    Returns:
    {
        "success": true,
        "original_latex": "2x + 5 = 13",
        "solution_latex": "x = 4",
        "evaluation_type": "solve",
        "error": null
    }
    """
    try:
        data = json.loads(request.body)
        image_data = data.get("image")
        
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        if not image_data:
            return JsonResponse(
                {
                    "success": False,
                    "original_latex": None,
                    "solution_latex": None,
                    "evaluation_type": None,
                    "error": "Image data not provided",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        if "base64," in image_data:
            image_data = image_data.split("base64,")[1]
        
        image_bytes = base64.b64decode(image_data)
        prompt = create_equation_solver_prompt()
        
        image_parts = [
            {
                "mime_type": "image/png",
                "data": image_bytes,
            }
        ]
        
        response = model.generate_content([prompt, image_parts[0]])
        response_text = response.text.strip()
        
        # Clean up markdown code blocks if present
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()
            if response_text.endswith("```"):
                response_text = response_text[:-3].strip()
        
        # Parse JSON response
        result = json.loads(response_text)
        
        return JsonResponse(
            {
                "success": True,
                "original_latex": result.get("original_latex", ""),
                "solution_latex": result.get("solution_latex", ""),
                "evaluation_type": result.get("evaluation_type", "evaluate"),
                "error": None,
            },
            status=status.HTTP_200_OK,
        )
    
    except json.JSONDecodeError as e:
        return JsonResponse(
            {
                "success": False,
                "original_latex": None,
                "solution_latex": None,
                "evaluation_type": None,
                "error": f"Invalid JSON response from model: {str(e)}",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as e:
        return JsonResponse(
            {
                "success": False,
                "original_latex": None,
                "solution_latex": None,
                "evaluation_type": None,
                "error": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ============================================================
# REST API Views for Whiteboard Sessions and State
# ============================================================

class WhiteboardSessionViewSet(viewsets.ViewSet):
    """
    API endpoints for whiteboard sessions
    
    Requires authentication - users must be logged in to access
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        List all sessions where user is owner or member
        Query params:
        - include_inactive: "true" to show inactive sessions (teachers only)
        """
        user = request.user
        include_inactive = request.query_params.get("include_inactive", "false").lower() == "true"
        can_include_inactive = include_inactive and user.role == "teacher"

        access_filter = Q(owner=user) | Q(members__user=user)
        sessions = WhiteboardSession.objects.filter(access_filter)
        if not can_include_inactive and user.role != "teacher":
            sessions = sessions.filter(is_active=True)

        sessions = sessions.distinct().order_by("-updated_at")
        
        serializer = WhiteboardSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def create(self, request):
        """Create a new whiteboard session"""
        if request.user.role != "teacher":
            return Response(
                {"detail": "Only teachers can create whiteboard sessions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WhiteboardSessionSerializer(
            data=request.data,
            context={"request": request}
        )
        if serializer.is_valid():
            session = serializer.save()
            SessionMember.objects.get_or_create(
                session=session,
                user=request.user,
                defaults={"role": "owner"},
            )
            return Response(
                WhiteboardSessionDetailSerializer(session).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """Delete a whiteboard session (owner only)."""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)

        if session.owner_id != user.id:
            return Response(
                {"detail": "Only session owner can delete this session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, pk=None):
        """Get session details with latest state"""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)
        
        # Students can only open active sessions.
        if user.role == "student" and not session.is_active:
            return Response(
                {"detail": "This session is archived."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check permissions: user must be owner or member
        is_owner = session.owner_id == user.id
        is_member = SessionMember.objects.filter(
            session=session, user=user
        ).exists()
        
        if not (is_owner or is_member):
            return Response(
                {"detail": "You don't have access to this session."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = WhiteboardSessionDetailSerializer(session)
        response_data = serializer.data
        print(f"[Whiteboard API] Session {pk} retrieved by {user.username} (role: {user.role})")
        print(f"[Whiteboard API] Latest state present: {response_data.get('latest_state') is not None}")
        if response_data.get('latest_state'):
            print(f"[Whiteboard API] Latest state version: {response_data['latest_state'].get('version')}")
        return Response(response_data)

    @action(detail=True, methods=["post"], url_path="invite")
    def invite_student(self, request, pk=None):
        """Invite one or more students to a whiteboard session."""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)

        if session.owner_id != user.id:
            return Response(
                {"detail": "Only session owner can invite students."},
                status=status.HTTP_403_FORBIDDEN,
            )

        student_ids = request.data.get("student_ids")
        if student_ids is None:
            single_student_id = request.data.get("student_id")
            student_ids = [single_student_id] if single_student_id else []

        if not isinstance(student_ids, list) or not student_ids:
            return Response(
                {"detail": "Provide student_id or non-empty student_ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invited_members = []
        for student_id in student_ids:
            student = CustomUser.objects.filter(id=student_id, role="student").first()
            if not student:
                continue

            member, _ = SessionMember.objects.get_or_create(
                session=session,
                user=student,
                defaults={"role": "student"},
            )
            invited_members.append(member)

        if invited_members and not session.is_active:
            session.is_active = True
            session.save(update_fields=["is_active", "updated_at"])

        serializer = SessionMemberSerializer(invited_members, many=True)
        return Response(
            {
                "session_id": str(session.id),
                "invited_count": len(invited_members),
                "invited_members": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate_session(self, request, pk=None):
        """Mark session as inactive (archive it)"""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)

        # Only owner can deactivate
        if session.owner_id != user.id:
            return Response(
                {"detail": "Only session owner can deactivate."},
                status=status.HTTP_403_FORBIDDEN
            )

        session.is_active = False
        session.save(update_fields=["is_active", "updated_at"])

        return Response(
            WhiteboardSessionDetailSerializer(session).data,
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"], url_path="states")
    def save_state(self, request, pk=None):
        """Save a new whiteboard state snapshot"""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)
        
        # Check permissions
        is_owner = session.owner_id == user.id
        is_member = SessionMember.objects.filter(
            session=session, user=user
        ).exists()
        
        if not (is_owner or is_member):
            return Response(
                {"detail": "You don't have access to this session."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = WhiteboardStateCreateSerializer(data=request.data)
        if serializer.is_valid():
            page_number = serializer.validated_data.get("page", 1)

            # Get next version number
            page_states = WhiteboardState.objects.filter(session=session, page=page_number)
            latest_state = page_states.latest("version") if page_states.exists() else None
            next_version = (latest_state.version + 1) if latest_state else 0
            
            # Create new state
            state = WhiteboardState.objects.create(
                session=session,
                page=page_number,
                version=next_version,
                snapshot_json=serializer.validated_data["snapshot_json"],
                latex_objects=serializer.validated_data.get("latex_objects", []),
                created_by=user,
                description=serializer.validated_data.get("description", "")
            )

            if page_number > session.page_count:
                session.page_count = page_number
                session.save(update_fields=["page_count", "updated_at"])
            
            return Response(
                WhiteboardStateSerializer(state).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"], url_path="latest-state")
    def get_latest_state(self, request, pk=None):
        """Get the latest state of a whiteboard session"""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)
        
        # Check permissions
        is_owner = session.owner_id == user.id
        is_member = SessionMember.objects.filter(
            session=session, user=user
        ).exists()
        
        if not (is_owner or is_member):
            return Response(
                {"detail": "You don't have access to this session."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        page_param = request.query_params.get("page")
        if page_param:
            try:
                page_number = int(page_param)
            except ValueError:
                return Response(
                    {"detail": "Invalid page query parameter."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            state_qs = WhiteboardState.objects.filter(session=session, page=page_number)
        else:
            state_qs = WhiteboardState.objects.filter(session=session)

        latest_state = state_qs.latest("version") if state_qs.exists() else None
        
        if latest_state:
            serializer = WhiteboardStateSerializer(latest_state)
            return Response(serializer.data)
        else:
            return Response(
                {"detail": "No state found for this session."},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["post"], url_path="voice-token")
    def voice_token(self, request, pk=None):
        """Generate a LiveKit token for voice chat in this whiteboard session."""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)

        is_owner = session.owner_id == user.id
        is_member = SessionMember.objects.filter(
            session=session, user=user
        ).exists()

        if not (is_owner or is_member):
            return Response(
                {"detail": "You don't have access to this session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        ws_url = get_livekit_ws_url()
        if not ws_url:
            return Response(
                {"detail": "Voice chat is not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        room_id = f"whiteboard-voice-{pk}"
        token = generate_livekit_token(
            room_id=room_id,
            user_id=str(user.id),
            user_name=user.get_full_name() or user.username,
            role=user.role.upper(),
        )

        return Response({
            "livekit_token": token,
            "livekit_ws_url": ws_url,
            "room_id": room_id,
        })