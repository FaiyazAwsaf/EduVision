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
from .services.prompt_builder import create_math_prompt, create_text_prompt
from .models import WhiteboardSession, SessionMember, WhiteboardState
from .serializers import (
    WhiteboardSessionSerializer,
    WhiteboardSessionDetailSerializer,
    WhiteboardStateSerializer,
    WhiteboardStateCreateSerializer,
)

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
        """List all sessions where user is owner or member"""
        user = request.user
        
        # Sessions where user is owner
        owned_sessions = WhiteboardSession.objects.filter(owner=user)
        
        # Sessions where user is a member
        member_sessions = WhiteboardSession.objects.filter(
            members__user=user
        ).distinct()
        
        # Combine
        sessions = (owned_sessions | member_sessions).distinct()
        
        serializer = WhiteboardSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    def create(self, request):
        """Create a new whiteboard session"""
        serializer = WhiteboardSessionSerializer(
            data=request.data,
            context={"request": request}
        )
        if serializer.is_valid():
            session = serializer.save()
            return Response(
                WhiteboardSessionDetailSerializer(session).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, pk=None):
        """Get session details with latest state"""
        user = request.user
        session = get_object_or_404(WhiteboardSession, id=pk)
        
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
        return Response(serializer.data)

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
            # Get next version number
            latest_state = WhiteboardState.objects.filter(session=session).latest("version") if WhiteboardState.objects.filter(session=session).exists() else None
            next_version = (latest_state.version + 1) if latest_state else 0
            
            # Create new state
            state = WhiteboardState.objects.create(
                session=session,
                version=next_version,
                snapshot_json=serializer.validated_data["snapshot_json"],
                latex_objects=serializer.validated_data.get("latex_objects", []),
                created_by=user,
                description=serializer.validated_data.get("description", "")
            )
            
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
        
        latest_state = WhiteboardState.objects.filter(session=session).latest("version") if WhiteboardState.objects.filter(session=session).exists() else None
        
        if latest_state:
            serializer = WhiteboardStateSerializer(latest_state)
            return Response(serializer.data)
        else:
            return Response(
                {"detail": "No state found for this session."},
                status=status.HTTP_404_NOT_FOUND
            )