"""
Django REST Framework Views for Content Requests API

This module implements RESTful API endpoints for the content request system.
Uses DRF ViewSets for standard CRUD operations and custom actions.

API Endpoints:
- POST   /api/content-requests/          - Create new request
- GET    /api/content-requests/          - List requests
- GET    /api/content-requests/:id/      - Retrieve request details
- GET    /api/content-requests/:id/content/ - Get generated content
- POST   /api/content-requests/:id/feedback/ - Submit feedback
- POST   /api/content-requests/:id/cancel/ - Cancel request
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound
from django.core.exceptions import ValidationError as DjangoValidationError

from ..models import ContentRequest, GeneratedContent, UserFeedback
from .serializers import (
    ContentRequestCreateSerializer,
    ContentRequestListSerializer,
    ContentRequestDetailSerializer,
    GeneratedContentSerializer,
    FeedbackCreateSerializer,
    UserFeedbackSerializer
)
from ..services.content_service import ContentRequestService


logger = logging.getLogger(__name__)


class ContentRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing content requests.
    
    Provides standard CRUD operations plus custom actions:
    - list: Get all requests (with optional filtering)
    - create: Create a new request and trigger async generation
    - retrieve: Get request details with nested data
    - content: Get generated content for a request
    - feedback: Submit feedback on generated content
    - cancel: Cancel a pending request
    
    The ViewSet uses different serializers for different actions
    to optimize data transfer and validation.
    """
    
    queryset = ContentRequest.objects.all().order_by('-created_at')
    
    # Dependency injection for service layer (easier testing)
    service_class = ContentRequestService
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.service = self.service_class()
    
    def get_serializer_class(self):
        """
        Return appropriate serializer class based on action.
        
        Returns:
            Serializer class for the current action
        """
        if self.action == 'list':
            return ContentRequestListSerializer
        elif self.action == 'create':
            return ContentRequestCreateSerializer
        elif self.action == 'retrieve':
            return ContentRequestDetailSerializer
        elif self.action == 'feedback':
            return FeedbackCreateSerializer
        
        return ContentRequestDetailSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List content requests with optional filtering.
        
        Query Parameters:
            - status: Filter by status (pending, processing, completed, failed)
            - limit: Maximum results to return (default: 50)
            - offset: Pagination offset (default: 0)
            
        Returns:
            Response: List of content requests
        """
        try:
            # Get query parameters
            status_filter = request.query_params.get('status')
            limit = int(request.query_params.get('limit', 50))
            offset = int(request.query_params.get('offset', 0))
            
            # Validate limit
            if limit > 100:
                limit = 100  # Maximum limit
            
            # Get filtered requests from service
            requests = self.service.list_requests(
                status=status_filter,
                limit=limit,
                offset=offset
            )
            
            # Serialize and return
            serializer = self.get_serializer(requests, many=True)
            
            return Response({
                'count': len(requests),
                'results': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error listing requests: {str(e)}")
            return Response(
                {'error': 'Failed to retrieve requests'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def create(self, request, *args, **kwargs):
        """
        Create a new content request.
        
        Request Body:
            {
                "topic": "string",
                "style": "brief|detailed|step_by_step",
                "format": "text|pdf|worksheet",
                "metadata": {} (optional)
            }
            
        Returns:
            Response: Created request details with status 201
        """
        try:
            # Validate input
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Create request via service
            content_request = self.service.create_request(
                topic=serializer.validated_data['topic'],
                style=serializer.validated_data['style'],
                format=serializer.validated_data['format'],
                metadata=serializer.validated_data.get('metadata', {}),
                # user=request.user  # Uncomment when auth is implemented
            )
            
            # Trigger async content generation
            # This will be implemented with Celery tasks
            from ..tasks import generate_content_task
            generate_content_task.delay(content_request.id)
            
            # Return created request
            response_serializer = ContentRequestDetailSerializer(content_request)
            
            logger.info(f"Created content request #{content_request.id}")
            
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
            
        except DjangoValidationError as e:
            logger.warning(f"Validation error creating request: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error creating request: {str(e)}")
            return Response(
                {'error': 'Failed to create request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def retrieve(self, request, pk=None, *args, **kwargs):
        """
        Retrieve detailed information about a content request.
        
        Path Parameters:
            - pk: Request ID
            
        Returns:
            Response: Request details with nested content and feedback
        """
        try:
            content_request = self.service.get_request(pk)
            
            if not content_request:
                raise NotFound(f"Content request #{pk} not found")
            
            serializer = self.get_serializer(content_request)
            
            return Response(serializer.data)
            
        except NotFound:
            raise
        
        except Exception as e:
            logger.error(f"Error retrieving request #{pk}: {str(e)}")
            return Response(
                {'error': 'Failed to retrieve request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='content')
    def content(self, request, pk=None):
        """
        Retrieve generated content for a request.
        
        Path Parameters:
            - pk: Request ID
            
        Returns:
            Response: Generated content or 404 if not yet available
        """
        try:
            generated_content = self.service.get_request_content(pk)
            
            if not generated_content:
                return Response(
                    {
                        'message': 'Content not yet available',
                        'status': 'Check request status for progress'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = GeneratedContentSerializer(generated_content)
            
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error retrieving content for request #{pk}: {str(e)}")
            return Response(
                {'error': 'Failed to retrieve content'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='feedback')
    def feedback(self, request, pk=None):
        """
        Submit feedback for a content request.
        
        Path Parameters:
            - pk: Request ID
            
        Request Body:
            {
                "feedback_type": "positive|negative|report_issue|suggestion",
                "notes": "string" (optional but required for some types)
            }
            
        Returns:
            Response: Created feedback with status 201
        """
        try:
            # Validate input
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            
            # Create feedback via service
            feedback = self.service.add_feedback(
                request_id=pk,
                feedback_type=serializer.validated_data['feedback_type'],
                notes=serializer.validated_data.get('notes', ''),
                # user=request.user  # Uncomment when auth is implemented
            )
            
            # Return created feedback
            response_serializer = UserFeedbackSerializer(feedback)
            
            logger.info(f"Added feedback for request #{pk}")
            
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
            
        except DjangoValidationError as e:
            logger.warning(f"Validation error adding feedback: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error adding feedback for request #{pk}: {str(e)}")
            return Response(
                {'error': 'Failed to add feedback'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """
        Cancel a pending content request.
        
        Path Parameters:
            - pk: Request ID
            
        Returns:
            Response: Success message or error
        """
        try:
            success = self.service.cancel_request(pk)
            
            if success:
                return Response({
                    'message': f'Request #{pk} cancelled successfully'
                })
            else:
                return Response(
                    {'error': 'Failed to cancel request'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except DjangoValidationError as e:
            logger.warning(f"Validation error cancelling request: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.error(f"Error cancelling request #{pk}: {str(e)}")
            return Response(
                {'error': 'Failed to cancel request'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class HealthCheckViewSet(viewsets.ViewSet):
    """
    Simple health check endpoint for monitoring.
    
    Used to verify the API is running and responsive.
    """
    
    @action(detail=False, methods=['get'], url_path='health')
    def health(self, request):
        """
        Health check endpoint.
        
        Returns:
            Response: Service health status
        """
        return Response({
            'status': 'healthy',
            'service': 'content-requests-api',
            'version': '1.0.0'
        })
