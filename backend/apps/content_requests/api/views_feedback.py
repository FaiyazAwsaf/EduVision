"""
Feedback API Views - Phase 3

REST endpoints for feedback submission and retrieval.
"""
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from django.db import IntegrityError

from ..persistence.feedback_repository import FeedbackRepository
from .serializers_feedback import FeedbackSerializer, FeedbackCreateSerializer

logger = logging.getLogger(__name__)


class FeedbackView(APIView):
    """
    API endpoint for feedback operations.
    
    POST /api/generated-content/{id}/feedback
    - Submit feedback for generated content
    - Validates content exists
    - Prevents duplicate submissions
    
    GET /api/generated-content/{id}/feedback
    - Retrieve existing feedback
    - Returns 404 if no feedback exists
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, content_id):
        """
        Submit feedback for generated content.
        
        Args:
            content_id: UUID of the generated content
            
        Request Body:
            {
                "usefulness_rating": 1-5,
                "difficulty_rating": "TOO_EASY"|"APPROPRIATE"|"TOO_HARD",
                "correctness_flag": true|false,
                "missing_topics": "optional text",
                "freeform_comment": "optional text"
            }
            
        Returns:
            201: Feedback created successfully
            400: Invalid input or duplicate submission
            404: Content not found
            500: Server error
        """
        try:
            # Validate input
            serializer = FeedbackCreateSerializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(
                    f"Invalid feedback submission for content {content_id}: "
                    f"{serializer.errors}"
                )
                return Response(
                    {
                        'error': 'Invalid feedback data',
                        'details': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if feedback already exists
            if FeedbackRepository.exists_for_content(content_id):
                logger.warning(f"Duplicate feedback attempt for content {content_id}")
                return Response(
                    {
                        'error': 'Feedback already exists for this content',
                        'message': 'You have already submitted feedback for this content'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create feedback
            feedback = FeedbackRepository.create_feedback(
                generated_content_id=content_id,
                **serializer.validated_data
            )
            
            # Return created feedback
            response_serializer = FeedbackSerializer(feedback)
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
            
        except ValueError as e:
            # Content doesn't exist
            logger.error(f"Content not found for feedback: {content_id}")
            return Response(
                {
                    'error': 'Content not found',
                    'message': str(e)
                },
                status=status.HTTP_404_NOT_FOUND
            )
            
        except IntegrityError as e:
            # Race condition - feedback was created between check and create
            logger.warning(f"Race condition - duplicate feedback for {content_id}")
            return Response(
                {
                    'error': 'Feedback already exists',
                    'message': 'Feedback was already submitted for this content'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
            logger.error(
                f"Unexpected error creating feedback for {content_id}: {str(e)}",
                exc_info=True
            )
            return Response(
                {
                    'error': 'Internal server error',
                    'message': 'Failed to submit feedback. Please try again.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, content_id):
        """
        Retrieve feedback for generated content.
        
        Args:
            content_id: UUID of the generated content
            
        Returns:
            200: Feedback data
            404: No feedback exists for this content
            500: Server error
        """
        try:
            feedback = FeedbackRepository.get_feedback_by_content_id(content_id)
            
            if not feedback:
                return Response(
                    {'feedback': None},
                    status=status.HTTP_200_OK
                )
            
            serializer = FeedbackSerializer(feedback)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(
                f"Error retrieving feedback for {content_id}: {str(e)}",
                exc_info=True
            )
            return Response(
                {
                    'error': 'Internal server error',
                    'message': 'Failed to retrieve feedback'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
