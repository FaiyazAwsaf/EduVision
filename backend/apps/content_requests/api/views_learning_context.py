"""
Learning Context API Views - Phase 4

REST endpoints for manual learning context management.
Handles user-provided personalization inputs.
"""
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from ..persistence.learning_context_repository import LearningContextRepository
from .serializers_learning_context import LearningContextSerializer, LearningContextCreateSerializer

logger = logging.getLogger(__name__)


class LearningContextView(APIView):
    """
    API endpoint for learning context operations.
    
    POST /api/content-requests/{request_id}/context/
    - Create or update learning context
    - All fields optional (graceful degradation)
    - Allows partial updates
    
    GET /api/content-requests/{request_id}/context/
    - Retrieve existing learning context
    - Returns 404 if no context exists
    
    Design decisions:
    - No authentication required (Phase 4 - pre-auth)
    - Context is optional for content generation
    - Supports create-or-update pattern
    - All errors return clear messages
    
    Extension Points:
    - Add user authentication
    - Add validation against user's learning history
    - Add auto-population from Module 3 analytics
    """
    
    def post(self, request, request_id):
        """
        Create or update learning context for a content request.
        
        Args:
            request_id: UUID of the content request
            
        Request Body (all optional):
            {
                "target_goal": "REVISION"|"CONCEPT_CLARITY"|"EXAM_PREP"|"PRACTICE",
                "self_reported_weaknesses": ["topic1", "topic2"],
                "preferred_depth": "SHALLOW"|"NORMAL"|"DEEP",
                "time_constraint": "QUICK"|"NORMAL"|"EXTENSIVE",
                "notes": "optional text"
            }
            
        Returns:
            200: Context updated successfully
            201: Context created successfully
            400: Invalid input
            404: Content request not found
            500: Server error
        """
        try:
            # Validate input
            serializer = LearningContextCreateSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(
                    f"Invalid learning context for request {request_id}: "
                    f"{serializer.errors}"
                )
                return Response(
                    {
                        'error': 'Invalid learning context data',
                        'details': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if context already exists
            existing_context = LearningContextRepository.get_by_request_id(request_id)
            is_update = existing_context is not None
            
            # Create or update context
            context = LearningContextRepository.create_or_update_context(
                content_request_id=request_id,
                **serializer.validated_data
            )
            
            # Return result
            response_serializer = LearningContextSerializer(context)
            return Response(
                response_serializer.data,
                status=status.HTTP_200_OK if is_update else status.HTTP_201_CREATED
            )
            
        except ValueError as e:
            # Content request doesn't exist
            logger.error(f"Content request not found for context: {request_id}")
            return Response(
                {
                    'error': 'Content request not found',
                    'message': str(e)
                },
                status=status.HTTP_404_NOT_FOUND
            )
            
        except Exception as e:
            logger.error(
                f"Unexpected error creating/updating context for {request_id}: {str(e)}",
                exc_info=True
            )
            return Response(
                {
                    'error': 'Internal server error',
                    'message': 'Failed to save learning context. Please try again.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, request_id):
        """
        Retrieve learning context for a content request.
        
        Args:
            request_id: UUID of the content request
            
        Returns:
            200: Context data
            404: No context exists
            500: Server error
        """
        try:
            context = LearningContextRepository.get_by_request_id(request_id)
            
            if not context:
                return Response(
                    {
                        'error': 'Learning context not found',
                        'message': 'No learning context has been provided for this request'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = LearningContextSerializer(context)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(
                f"Error retrieving context for {request_id}: {str(e)}",
                exc_info=True
            )
            return Response(
                {
                    'error': 'Internal server error',
                    'message': 'Failed to retrieve learning context'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
