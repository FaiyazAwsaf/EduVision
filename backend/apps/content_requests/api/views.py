"""
REST API Views for Content Request System - Phase 1

This module implements thin controllers that handle HTTP requests and responses.
Controllers are responsible for:
- Request deserialization and validation (using serializers)
- Delegating business logic to the service layer
- Response serialization and HTTP status codes
- Error handling and logging

Extension points:
- Add authentication decorators when auth is implemented
- Add permission classes for authorization
- Add rate limiting for production
- Add caching for frequently accessed resources

Design principles:
- Controllers are thin - no business logic here
- All logic delegated to service layer
- Consistent error responses
- RESTful design patterns
"""
import logging
from uuid import UUID
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import Http404

from ..models import ContentRequestModel
from ..services.content_service import get_content_request_service
from ..services.validators import ValidationError as DomainValidationError
from ..services.content_formatter import get_content_formatter, ContentFormatterError
from ..persistence.repository import GeneratedContentRepository
from ..domain.exceptions import InvalidStatusTransitionError
from .serializers import (
    ContentRequestCreateSerializer,
    ContentRequestResponseSerializer,
    ContentRequestListSerializer,
    GeneratedContentSerializer,
    ErrorResponseSerializer,
)


logger = logging.getLogger(__name__)


class ContentRequestListCreateView(APIView):
    """
    API endpoint for listing and creating content requests.
    
    POST /api/content-requests
        Create a new content request
        
    GET /api/content-requests
        List all content requests (with optional filtering)
    """
    
    def post(self, request):
        """
        Create a new content request.
        
        Request body:
            {
                "topic": "string",
                "content_type": "SUMMARY|WORKED_EXAMPLES|FORMULA_SHEET",
                "style": "BRIEF|DETAILED|STEP_BY_STEP",
                "output_format": "TEXT|PDF|WORKSHEET",
                "difficulty": "EASY|MEDIUM|HARD" (optional),
                "notes": "string" (optional)
            }
        
        Returns:
            201: Created with request details
            400: Validation error
            500: Internal server error
        """
        serializer = ContentRequestCreateSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Validation failed: {serializer.errors}")
            return Response(
                {
                    'error': 'Validation failed',
                    'errors': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            service = get_content_request_service()
            content_request = service.create_request(**serializer.validated_data)
            
            # Get the model instance from repository using the domain entity's ID
            model_instance = ContentRequestModel.objects.get(id=content_request.id)
            response_serializer = ContentRequestResponseSerializer(model_instance)
            
            logger.info(f"Created content request {content_request.id}")
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        
        except DomainValidationError as e:
            logger.error(f"Domain validation error: {e.errors}")
            return Response(
                {
                    'error': 'Validation failed',
                    'errors': e.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.exception(f"Unexpected error creating content request: {str(e)}")
            return Response(
                {
                    'error': 'Internal server error',
                    'detail': 'Failed to create content request'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request):
        """
        List content requests.
        
        Query parameters:
            - status: Filter by status (optional)
            - limit: Max results (default: 100, max: 1000)
            - offset: Pagination offset (default: 0)
        
        Returns:
            200: List of requests
            400: Invalid query parameters
            500: Internal server error
        """
        try:
            # Get query parameters
            status_filter = request.query_params.get('status')
            limit = min(int(request.query_params.get('limit', 100)), 1000)
            offset = int(request.query_params.get('offset', 0))
            
            # Validate status if provided
            if status_filter:
                from ..domain.enums import RequestStatus
                try:
                    # Accept both uppercase and lowercase
                    status_enum = RequestStatus(status_filter.upper())
                except ValueError:
                    return Response(
                        {
                            'error': 'Invalid status value',
                            'detail': f'Status must be one of: {", ".join(RequestStatus.values())}'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                service = get_content_request_service()
                requests = service.list_requests(
                    status=status_enum,
                    limit=limit,
                    offset=offset
                )
            else:
                service = get_content_request_service()
                requests = service.list_requests(limit=limit, offset=offset)
            
            serializer = ContentRequestListSerializer(requests, many=True)
            
            logger.debug(f"Listed {len(requests)} content requests")
            return Response(
                {
                    'results': serializer.data,
                    'count': len(serializer.data)
                },
                status=status.HTTP_200_OK
            )
        
        except ValueError as e:
            return Response(
                {
                    'error': 'Invalid query parameters',
                    'detail': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        except Exception as e:
            logger.exception(f"Unexpected error listing content requests: {str(e)}")
            return Response(
                {
                    'error': 'Internal server error',
                    'detail': 'Failed to list content requests'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ContentRequestDetailView(APIView):
    """
    API endpoint for retrieving individual content request details.
    
    GET /api/content-requests/{id}
        Retrieve full details of a content request
    """
    
    def get(self, request, request_id):
        """
        Retrieve a content request by ID.
        
        Path parameters:
            - request_id: UUID of the content request
        
        Returns:
            200: Request details
            404: Request not found
            400: Invalid UUID
            500: Internal server error
        """
        try:
            # Validate UUID
            try:
                uuid_obj = UUID(request_id)
            except ValueError:
                return Response(
                    {
                        'error': 'Invalid request ID',
                        'detail': 'Request ID must be a valid UUID'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Fetch request
            service = get_content_request_service()
            content_request = service.get_request_by_id(uuid_obj)
            
            if not content_request:
                logger.warning(f"Content request {request_id} not found")
                return Response(
                    {
                        'error': 'Not found',
                        'detail': f'Content request {request_id} does not exist'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = ContentRequestResponseSerializer(content_request)
            
            logger.debug(f"Retrieved content request {request_id}")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.exception(
                f"Unexpected error retrieving content request {request_id}: {str(e)}"
            )
            return Response(
                {
                    'error': 'Internal server error',
                    'detail': 'Failed to retrieve content request'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GeneratedContentView(APIView):
    """
    API endpoint for retrieving generated content.
    
    Phase 2: Returns AI-generated content for a completed request.
    
    GET /api/content-requests/{id}/content
        Retrieve generated content for a request
    """
    
    def get(self, request, request_id):
        """
        Retrieve generated content for a specific request.
        
        Args:
            request_id (UUID): UUID of the content request
            
        Returns:
            200: Generated content with metadata
            404: Content not found or not yet generated
            500: Internal server error
        """
        try:
            # Validate UUID
            try:
                uuid_obj = UUID(request_id)
            except ValueError:
                return Response(
                    {
                        'error': 'Invalid request ID',
                        'detail': 'Request ID must be a valid UUID'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if request exists
            service = get_content_request_service()
            content_request = service.get_request_by_id(uuid_obj)
            
            if not content_request:
                logger.warning(f"Content request {request_id} not found")
                return Response(
                    {
                        'error': 'Content request not found',
                        'detail': f'Content request {request_id} does not exist'
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if content has been generated
            content_repo = GeneratedContentRepository()
            generated_content = content_repo.get_by_request_id(uuid_obj)
            
            if not generated_content:
                # Check request status
                from ..domain.enums import RequestStatus
                if content_request.status == RequestStatus.PENDING:
                    message = 'Content generation is queued'
                elif content_request.status == RequestStatus.PROCESSING:
                    message = 'Content is being generated'
                elif content_request.status == RequestStatus.FAILED:
                    message = 'Content generation failed'
                else:
                    message = 'Content not yet available'
                
                logger.info(
                    f"No generated content for request {request_id} "
                    f"(status: {content_request.status})"
                )
                return Response(
                    {
                        'error': 'Content not available',
                        'detail': message,
                        'status': content_request.status.value
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get format parameter (default to text for API response)
            output_format = request.query_params.get('format', 'text').lower()
            
            # If requesting raw JSON
            if output_format == 'json' or output_format == 'text':
                serializer = GeneratedContentSerializer(generated_content)
                logger.debug(f"Retrieved generated content for request {request_id}")
                return Response(serializer.data, status=status.HTTP_200_OK)
            
            # If requesting formatted output (PDF, WORKSHEET)
            elif output_format in ['pdf', 'worksheet']:
                try:
                    formatter = get_content_formatter()
                    
                    # Map format parameter to enum
                    from ..domain.enums import OutputFormat
                    if output_format == 'pdf':
                        format_enum = OutputFormat.PDF
                    elif output_format == 'worksheet':
                        format_enum = OutputFormat.WORKSHEET
                    else:
                        format_enum = OutputFormat.TEXT
                    
                    # Format the content
                    formatted = formatter.format_content(
                        content_text=generated_content.content_text,
                        output_format=format_enum,
                        metadata=generated_content.metadata
                    )
                    
                    # Return formatted content
                    from django.http import HttpResponse
                    response = HttpResponse(
                        formatted['content'],
                        content_type=formatted['mime_type']
                    )
                    response['Content-Disposition'] = (
                        f'attachment; filename="{formatted["filename"]}"'
                    )
                    
                    logger.info(
                        f"Returning formatted content for request {request_id} "
                        f"(format: {output_format})"
                    )
                    return response
                    
                except ContentFormatterError as e:
                    logger.error(f"Formatting error for request {request_id}: {str(e)}")
                    return Response(
                        {
                            'error': 'Content formatting failed',
                            'detail': str(e)
                        },
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            else:
                return Response(
                    {
                        'error': 'Invalid format parameter',
                        'detail': 'Format must be one of: json, text, pdf, worksheet'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        except Exception as e:
            logger.exception(
                f"Unexpected error retrieving content for request {request_id}: {str(e)}"
            )
            return Response(
                {
                    'error': 'Internal server error',
                    'detail': 'Failed to retrieve generated content'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Phase 3+ views will be added here when additional features are implemented
# Examples:
# - ContentGenerationStatusView: for polling generation status
# - FeedbackSubmissionView: for submitting user feedback
# - RequestStatisticsView: for analytics and monitoring
