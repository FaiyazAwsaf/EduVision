"""
Error Handling Middleware - Phase 1

This middleware provides centralized error handling for the content request system.

Responsibilities:
- Catch unhandled exceptions from views
- Log errors with proper context
- Return consistent JSON error responses
- Hide sensitive details in production

Extension points:
- Add request ID tracking for distributed tracing
- Integrate with error monitoring services (Sentry, etc.)
- Add custom error types as needed

Design principles:
- Fail gracefully with meaningful messages
- Log everything for debugging
- Never expose internal implementation details
- Consistent error format across all endpoints
"""
import logging
import traceback
import uuid
from django.http import JsonResponse
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import IntegrityError, DatabaseError
from rest_framework import status as http_status


logger = logging.getLogger(__name__)


class ContentRequestErrorHandlingMiddleware:
    """
    Middleware for centralized error handling.
    
    Catches exceptions and converts them to proper HTTP responses
    with consistent error formatting.
    """
    
    def __init__(self, get_response):
        """
        Initialize middleware.
        
        Args:
            get_response: Next middleware or view in the chain
        """
        self.get_response = get_response
    
    def __call__(self, request):
        """
        Process request and handle any exceptions.
        
        Args:
            request: HTTP request object
            
        Returns:
            HTTP response (normal or error)
        """
        # Process request normally
        response = self.get_response(request)
        return response
    
    def process_exception(self, request, exception):
        """
        Handle exceptions that occur during request processing.
        
        This method is called by Django when an unhandled exception occurs.
        
        Args:
            request: HTTP request object
            exception: Exception that was raised
            
        Returns:
            JsonResponse with error details
        """
        # Generate unique error ID for tracking
        error_id = str(uuid.uuid4())
        
        # Extract request context
        request_path = request.path
        request_method = request.method
        request_body = getattr(request, 'body', b'').decode('utf-8', errors='ignore')[:500]
        
        # Log error with full context
        logger.error(
            f"[Error {error_id}] Unhandled exception in {request_method} {request_path}",
            exc_info=True,
            extra={
                'error_id': error_id,
                'request_method': request_method,
                'request_path': request_path,
                'request_body': request_body,
                'exception_type': type(exception).__name__,
            }
        )
        
        # Handle different exception types
        if isinstance(exception, ValidationError):
            return self._handle_validation_error(exception, error_id)
        
        elif isinstance(exception, IntegrityError):
            return self._handle_integrity_error(exception, error_id)
        
        elif isinstance(exception, DatabaseError):
            return self._handle_database_error(exception, error_id)
        
        elif isinstance(exception, PermissionDenied):
            return self._handle_permission_error(exception, error_id)
        
        else:
            return self._handle_generic_error(exception, error_id)
    
    def _handle_validation_error(self, exception, error_id):
        """
        Handle Django validation errors.
        
        Args:
            exception: ValidationError instance
            error_id: Unique error identifier
            
        Returns:
            JsonResponse with 400 status
        """
        logger.warning(f"[Error {error_id}] Validation error: {str(exception)}")
        return JsonResponse({
            'error': 'Validation error',
            'detail': str(exception),
            'error_id': error_id
        }, status=http_status.HTTP_400_BAD_REQUEST)
    
    def _handle_integrity_error(self, exception, error_id):
        """
        Handle database integrity constraint violations.
        
        Args:
            exception: IntegrityError instance
            error_id: Unique error identifier
            
        Returns:
            JsonResponse with 400 status
        """
        logger.error(f"[Error {error_id}] Integrity error: {str(exception)}")
        return JsonResponse({
            'error': 'Data integrity error',
            'detail': 'A database constraint was violated',
            'error_id': error_id
        }, status=http_status.HTTP_400_BAD_REQUEST)
    
    def _handle_database_error(self, exception, error_id):
        """
        Handle general database errors.
        
        Args:
            exception: DatabaseError instance
            error_id: Unique error identifier
            
        Returns:
            JsonResponse with 500 status
        """
        logger.error(f"[Error {error_id}] Database error: {str(exception)}")
        return JsonResponse({
            'error': 'Database error',
            'detail': 'A database error occurred',
            'error_id': error_id
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _handle_permission_error(self, exception, error_id):
        """
        Handle permission denied errors.
        
        Args:
            exception: PermissionDenied instance
            error_id: Unique error identifier
            
        Returns:
            JsonResponse with 403 status
        """
        logger.warning(f"[Error {error_id}] Permission denied: {str(exception)}")
        return JsonResponse({
            'error': 'Permission denied',
            'detail': str(exception) or 'You do not have permission to perform this action',
            'error_id': error_id
        }, status=http_status.HTTP_403_FORBIDDEN)
    
    def _handle_generic_error(self, exception, error_id):
        """
        Handle any unspecified errors.
        
        Args:
            exception: Exception instance
            error_id: Unique error identifier
            
        Returns:
            JsonResponse with 500 status
        """
        logger.exception(f"[Error {error_id}] Unexpected error: {str(exception)}")
        
        # In production, hide implementation details
        # In development, show the actual error
        from django.conf import settings
        if settings.DEBUG:
            detail = str(exception)
        else:
            detail = 'An unexpected error occurred'
        
        return JsonResponse({
            'error': 'Internal server error',
            'detail': detail,
            'error_id': error_id
        }, status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)


class RequestLoggingMiddleware:
    """
    Middleware for logging API requests and responses.
    
    Logs:
    - Request method, path, and headers
    - Response status and timing
    - Request/response correlation for debugging
    
    Extension points:
    - Add distributed tracing headers
    - Integrate with APM tools
    - Add performance metrics collection
    """
    
    def __init__(self, get_response):
        """Initialize middleware."""
        self.get_response = get_response
    
    def __call__(self, request):
        """
        Log request and response details.
        
        Args:
            request: HTTP request object
            
        Returns:
            HTTP response
        """
        import time
        
        # Generate request ID
        request_id = str(uuid.uuid4())[:8]
        request.request_id = request_id
        
        # Log incoming request
        logger.info(
            f"[Request {request_id}] {request.method} {request.path}",
            extra={
                'request_id': request_id,
                'method': request.method,
                'path': request.path,
                'query_params': dict(request.GET),
            }
        )
        
        # Process request and measure time
        start_time = time.time()
        response = self.get_response(request)
        duration = time.time() - start_time
        
        # Log response
        logger.info(
            f"[Request {request_id}] {response.status_code} "
            f"({duration*1000:.2f}ms)",
            extra={
                'request_id': request_id,
                'status_code': response.status_code,
                'duration_ms': duration * 1000,
            }
        )
        
        # Add request ID to response headers for client-side tracking
        response['X-Request-ID'] = request_id
        
        return response

        self.logger.info(
            f"Request: {request.method} {request.path}",
            extra={
                'method': request.method,
                'path': request.path,
                'query_params': dict(request.GET),
                'user': getattr(request.user, 'id', 'anonymous') if hasattr(request, 'user') else 'unknown'
            }
        )
    
    def _log_response(self, request, response, duration):
        """Log response details."""
        self.logger.info(
            f"Response: {request.method} {request.path} - "
            f"Status: {response.status_code} - "
            f"Duration: {duration:.3f}s",
            extra={
                'method': request.method,
                'path': request.path,
                'status_code': response.status_code,
                'duration_seconds': duration
            }
        )


class CORSMiddleware:
    """
    CORS (Cross-Origin Resource Sharing) middleware.
    
    Note: This is a basic implementation. For production, consider
    using django-cors-headers package for more robust CORS handling.
    """
    
    def __init__(self, get_response):
        """
        Initialize the middleware.
        
        Args:
            get_response: The next middleware or view in the chain
        """
        self.get_response = get_response
    
    def __call__(self, request):
        """
        Add CORS headers to response.
        
        Args:
            request: The HTTP request
            
        Returns:
            HttpResponse: The response with CORS headers
        """
        response = self.get_response(request)
        
        # Add CORS headers
        # TODO: Configure allowed origins based on environment
        response['Access-Control-Allow-Origin'] = '*'  # TODO: Restrict in production
        response['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response['Access-Control-Max-Age'] = '86400'  # 24 hours
        
        return response
