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
from rest_framework.renderers import JSONRenderer, BaseRenderer
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes as perm_classes_decorator
from django.db import models
from django.http import Http404, HttpResponse

class BinaryFileRenderer(BaseRenderer):
    """Renderer for binary file responses (PDF, etc.)"""
    media_type = 'application/pdf'
    format = 'pdf'
    charset = None
    render_style = 'binary'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

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


def _user_can_view_request(user, model_instance) -> bool:
    """
    Return True if ``user`` is allowed to view ``model_instance``.

    Access is granted when the user:
      1. is the creator of the request, OR
      2. is a student whose class (and optionally section) is the target of the request
         and the request is COMPLETED teacher content.
    """
    # Owner always has access
    if model_instance.created_by_id and model_instance.created_by_id == user.id:
        return True

    # Shared-content visibility for students
    if (
        getattr(user, 'role', None) == 'student'
        and model_instance.role == 'teacher'
        and model_instance.status == 'COMPLETED'
        and model_instance.target_class_id is not None
    ):
        from apps.students.models import StudentProfile
        try:
            profile = StudentProfile.objects.select_related(
                'section', 'section__class_ref'
            ).get(user=user)
        except StudentProfile.DoesNotExist:
            return False

        if not profile.section or not profile.section.class_ref:
            return False

        if profile.section.class_ref_id != model_instance.target_class_id:
            return False

        # Section-specific content: only that section can see it
        if (
            model_instance.target_section_id is not None
            and model_instance.target_section_id != profile.section_id
        ):
            return False

        return True

    return False


class ContentRequestListCreateView(APIView):
    """
    API endpoint for listing and creating content requests.
    
    POST /api/content-requests
        Create a new content request
        
    GET /api/content-requests
        List all content requests (with optional filtering)
    """
    permission_classes = [IsAuthenticated]
    
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
            content_request = service.create_request(
                **serializer.validated_data,
                user=request.user
            )
            
            # Get the model instance from repository using the domain entity's ID
            model_instance = ContentRequestModel.objects.get(id=content_request.id)
            response_serializer = ContentRequestResponseSerializer(model_instance)

            # Record CONTENT_GENERATED learning event (non-blocking)
            try:
                from apps.intelligence.services.event_service import EventService
                EventService().record_event(
                    event_type='content_generated',
                    user_id=request.user.id,
                    topic=content_request.topic,
                    metadata={'content_request_id': str(content_request.id)},
                )
            except Exception:
                pass

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
            - content_type: Filter by content type (optional)
            - subject: Filter by subject (optional, case-insensitive contains)
            - search: Search in topic (optional, case-insensitive contains)
            - created_after: Filter by creation date >= (ISO format, optional)
            - created_before: Filter by creation date <= (ISO format, optional)
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
            content_type_filter = request.query_params.get('content_type')
            subject_filter = request.query_params.get('subject')
            search_filter = request.query_params.get('search')
            created_after = request.query_params.get('created_after')
            created_before = request.query_params.get('created_before')
            limit = min(int(request.query_params.get('limit', 100)), 1000)
            offset = int(request.query_params.get('offset', 0))
            
            # Build queryset with user ownership filter
            qs = ContentRequestModel.objects.filter(created_by=request.user).order_by('-created_at')
            
            # Apply optional filters
            if status_filter:
                from ..domain.enums import RequestStatus
                try:
                    status_enum = RequestStatus(status_filter.upper())
                    qs = qs.filter(status=status_enum.value)
                except ValueError:
                    return Response(
                        {
                            'error': 'Invalid status value',
                            'detail': f'Status must be one of: {", ".join(RequestStatus.values())}'
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            if content_type_filter:
                qs = qs.filter(content_type=content_type_filter.upper())
            
            if subject_filter:
                qs = qs.filter(subject__icontains=subject_filter)
            
            if search_filter:
                qs = qs.filter(topic__icontains=search_filter)
            
            if created_after:
                from django.utils.dateparse import parse_datetime
                dt = parse_datetime(created_after)
                if dt:
                    qs = qs.filter(created_at__gte=dt)
            
            if created_before:
                from django.utils.dateparse import parse_datetime as parse_dt
                dt = parse_dt(created_before)
                if dt:
                    qs = qs.filter(created_at__lte=dt)
            
            # Paginate
            total = qs.count()
            models = qs[offset:offset + limit]
            
            serializer = ContentRequestListSerializer(models, many=True)
            
            logger.debug(f"Listed {len(serializer.data)} content requests")
            return Response(
                {
                    'results': serializer.data,
                    'count': len(serializer.data),
                    'total': total,
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
    permission_classes = [IsAuthenticated]
    
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
            
            # Verify access (owner or shared-content student)
            model_instance = ContentRequestModel.objects.get(id=uuid_obj)
            if not _user_can_view_request(request.user, model_instance):
                return Response(
                    {'error': 'Not found', 'detail': f'Content request {request_id} does not exist'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = ContentRequestResponseSerializer(model_instance)
            
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
    
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, BinaryFileRenderer]
    
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
            
            # Verify access (owner or shared-content student)
            model_instance = ContentRequestModel.objects.get(id=uuid_obj)
            if not _user_can_view_request(request.user, model_instance):
                return Response(
                    {'error': 'Not found', 'detail': f'Content request {request_id} does not exist'},
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
                elif content_request.status == RequestStatus.COMPLETED:
                    # This is an error state - status is COMPLETED but no content exists
                    logger.error(
                        f"Request {request_id} marked as COMPLETED but no generated content found. "
                        "This indicates a data inconsistency."
                    )
                    message = 'Content not yet generated'
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
            
            # Record CONTENT_VIEWED learning event (non-blocking)
            try:
                from apps.intelligence.services.event_service import EventService
                EventService().record_event(
                    event_type='content_viewed',
                    user_id=request.user.id,
                    topic=model_instance.topic,
                    metadata={'content_request_id': str(uuid_obj)},
                )
            except Exception:
                pass

            # Get format parameter (default to text for API response)
            output_format = request.query_params.get('format', 'text').lower()

            logger.info(f"Processing content request with format={output_format}")
            
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
                    
                    logger.info(
                        f"Returning formatted content for request {request_id} "
                        f"(format: {output_format})"
                    )
                    
                    # Return formatted content using HttpResponse with proper headers
                    response = HttpResponse(
                        formatted['content'],
                        content_type=formatted['mime_type']
                    )
                    response['Content-Disposition'] = (
                        f'attachment; filename="{formatted["filename"]}"'
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


@api_view(['GET'])
@perm_classes_decorator([IsAuthenticated])
def download_generated_content_view(request, request_id):
    """
    Authenticated view for downloading formatted content (PDF/Worksheet).
    """
    try:
        # Validate UUID
        try:
            uuid_obj = UUID(request_id)
        except ValueError:
            return HttpResponse(
                '{"error": "Invalid request ID"}',
                content_type='application/json',
                status=400
            )
        
        # Get format parameter
        output_format = request.GET.get('format', 'pdf').lower()
        
        logger.info(f"Download request for {request_id}, format={output_format}")
        
        # Check if content exists
        content_repo = GeneratedContentRepository()
        generated_content = content_repo.get_by_request_id(uuid_obj)
        
        if not generated_content:
            return HttpResponse(
                '{"error": "Content not found"}',
                content_type='application/json',
                status=404
            )
        
        # Map format to enum
        from ..domain.enums import OutputFormat
        if output_format == 'pdf':
            format_enum = OutputFormat.PDF
        elif output_format == 'worksheet':
            format_enum = OutputFormat.WORKSHEET
        else:
            return HttpResponse(
                '{"error": "Invalid format. Use pdf or worksheet"}',
                content_type='application/json',
                status=400
            )
        
        # Format the content
        formatter = get_content_formatter()
        formatted = formatter.format_content(
            content_text=generated_content.content_text,
            output_format=format_enum,
            metadata=generated_content.metadata
        )
        
        # Return the formatted file
        response = HttpResponse(
            formatted['content'],
            content_type=formatted['mime_type']
        )
        response['Content-Disposition'] = f'attachment; filename="{formatted["filename"]}"'
        
        logger.info(f"Returning {output_format} for request {request_id}")
        return response
        
    except ContentFormatterError as e:
        logger.error(f"Formatting error: {str(e)}")
        return HttpResponse(
            f'{{"error": "Formatting failed", "detail": "{str(e)}"}}',
            content_type='application/json',
            status=500
        )
    except Exception as e:
        logger.exception(f"Error downloading content: {str(e)}")
        return HttpResponse(
            '{"error": "Internal server error"}',
            content_type='application/json',
            status=500
        )


class RegenerateContentView(APIView):
    """
    POST /api/content-requests/<id>/regenerate/
    Creates a new content request with the same params as the original.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, request_id):
        try:
            uuid_obj = UUID(request_id)
        except ValueError:
            return Response(
                {'error': 'Invalid request ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            original = ContentRequestModel.objects.get(id=uuid_obj)
        except ContentRequestModel.DoesNotExist:
            return Response(
                {'error': 'Content request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify ownership
        if original.created_by_id and original.created_by_id != request.user.id:
            return Response(
                {'error': 'Not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create a new request with same params
        new_request = ContentRequestModel.objects.create(
            topic=original.topic,
            content_type=original.content_type,
            style=original.style,
            output_format=original.output_format,
            difficulty=original.difficulty,
            notes=original.notes,
            subject=original.subject,
            role=original.role,
            target_class=original.target_class,
            target_section=original.target_section,
            created_by=request.user,
            regenerated_from=original,
            status='PENDING',
        )
        
        # Enqueue for processing
        from ..tasks import process_content_request
        try:
            process_content_request.delay(str(new_request.id))
        except Exception as e:
            logger.error(f"Failed to enqueue regenerated request: {e}")
        
        response_serializer = ContentRequestResponseSerializer(new_request)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class SharedContentListView(APIView):
    """
    GET /api/content-requests/shared/

    Returns completed teacher-generated content targeted at the
    authenticated student's class (and optionally section).
    Only students can access this endpoint.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Must be a student
        if getattr(request.user, 'role', None) != 'student':
            return Response(
                {'error': 'Only students can view shared content'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Find the student's class & section via their profile
        from apps.students.models import StudentProfile
        try:
            profile = StudentProfile.objects.select_related(
                'section', 'section__class_ref'
            ).get(user=request.user)
        except StudentProfile.DoesNotExist:
            return Response(
                {'results': [], 'total': 0},
                status=status.HTTP_200_OK,
            )

        if not profile.section or not profile.section.class_ref:
            return Response(
                {'results': [], 'total': 0},
                status=status.HTTP_200_OK,
            )

        student_class = profile.section.class_ref
        student_section = profile.section

        # Query params
        content_type_filter = request.query_params.get('content_type')
        subject_filter = request.query_params.get('subject')
        search_filter = request.query_params.get('search')
        limit = min(int(request.query_params.get('limit', 100)), 1000)
        offset = int(request.query_params.get('offset', 0))

        # Base queryset: completed, teacher-created, targeted at this class
        qs = (
            ContentRequestModel.objects
            .filter(
                role='teacher',
                status='COMPLETED',
                target_class=student_class,
            )
            .select_related('created_by', 'target_class', 'target_section')
            .order_by('-created_at')
        )

        # Content targeted at a specific section should only show to that section
        # Content with no section (class-wide) shows to all sections in the class
        qs = qs.filter(
            models.Q(target_section__isnull=True) |
            models.Q(target_section=student_section)
        )

        # Optional filters
        if content_type_filter:
            qs = qs.filter(content_type=content_type_filter.upper())
        if subject_filter:
            qs = qs.filter(subject__icontains=subject_filter)
        if search_filter:
            qs = qs.filter(topic__icontains=search_filter)

        total = qs.count()
        results = qs[offset:offset + limit]

        from .serializers import SharedContentListSerializer
        serializer = SharedContentListSerializer(results, many=True)

        return Response(
            {
                'results': serializer.data,
                'total': total,
                'count': len(serializer.data),
            },
            status=status.HTTP_200_OK,
        )
