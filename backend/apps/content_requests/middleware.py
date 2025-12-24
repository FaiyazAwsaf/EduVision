"""
Custom Exception Handling Middleware

This middleware provides centralized error handling for the application.
It catches exceptions, logs them appropriately, and returns consistent
error responses to the API clients.

Features:
- Centralized exception logging
- Consistent error response format
- Security: Hides sensitive error details in production
- Request context tracking
"""
import logging
import traceback
import uuid
from django.http import JsonResponse
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import IntegrityError
from rest_framework.exceptions import APIException
from rest_framework import status


logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware:
    """
    Middleware for handling exceptions globally.
    
    Catches unhandled exceptions and returns appropriate JSON responses.
    Logs all errors with request context for debugging.
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
        Process the request and handle any exceptions.
        
        Args:
            request: The HTTP request
            
        Returns:
            HttpResponse: The response
        """
        response = self.get_response(request)
        return response
    
    def process_exception(self, request, exception):
        """
        Process exceptions that occur during request handling.
        
        Args:
            request: The HTTP request
            exception: The raised exception
            
        Returns:
            JsonResponse: Error response
        """
        # Generate unique error ID for tracking
        error_id = str(uuid.uuid4())
        
        # Get request context
        request_path = request.path
        request_method = request.method
        user = getattr(request, 'user', None)
        user_id = user.id if user and hasattr(user, 'id') else 'anonymous'
        
        # Log error with context
        logger.error(
            f"Error ID: {error_id} | "
            f"Path: {request_method} {request_path} | "
            f"User: {user_id} | "
            f"Exception: {type(exception).__name__}: {str(exception)}",
            exc_info=True,
            extra={
                'error_id': error_id,
                'request_path': request_path,
                'request_method': request_method,
                'user_id': user_id
            }
        )
        
        # Handle different exception types
        if isinstance(exception, ValidationError):
            return self._handle_validation_error(exception, error_id)
        
        elif isinstance(exception, IntegrityError):
            return self._handle_integrity_error(exception, error_id)
        
        elif isinstance(exception, PermissionDenied):
            return self._handle_permission_error(exception, error_id)
        
        elif isinstance(exception, APIException):
            return self._handle_api_exception(exception, error_id)
        
        else:
            return self._handle_generic_error(exception, error_id)
    
    def _handle_validation_error(self, exception, error_id):
        """Handle validation errors."""
        return JsonResponse({
            'error': 'Validation Error',
            'message': str(exception),
            'error_id': error_id
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def _handle_integrity_error(self, exception, error_id):
        """Handle database integrity errors."""
        return JsonResponse({
            'error': 'Data Integrity Error',
            'message': 'A database constraint was violated',
            'error_id': error_id
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def _handle_permission_error(self, exception, error_id):
        """Handle permission denied errors."""
        return JsonResponse({
            'error': 'Permission Denied',
            'message': str(exception) or 'You do not have permission to perform this action',
            'error_id': error_id
        }, status=status.HTTP_403_FORBIDDEN)
    
    def _handle_api_exception(self, exception, error_id):
        """Handle DRF API exceptions."""
        return JsonResponse({
            'error': exception.default_detail,
            'message': str(exception),
            'error_id': error_id
        }, status=exception.status_code)
    
    def _handle_generic_error(self, exception, error_id):
        """Handle generic unhandled errors."""
        # In production, hide detailed error messages
        # In development, provide more details
        from django.conf import settings
        
        if settings.DEBUG:
            error_detail = {
                'error': 'Internal Server Error',
                'message': str(exception),
                'type': type(exception).__name__,
                'traceback': traceback.format_exc(),
                'error_id': error_id
            }
        else:
            error_detail = {
                'error': 'Internal Server Error',
                'message': 'An unexpected error occurred. Please contact support.',
                'error_id': error_id
            }
        
        return JsonResponse(
            error_detail,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class RequestLoggingMiddleware:
    """
    Middleware for logging all API requests and responses.
    
    Logs request details, response status, and timing information.
    Useful for monitoring, debugging, and analytics.
    """
    
    def __init__(self, get_response):
        """
        Initialize the middleware.
        
        Args:
            get_response: The next middleware or view in the chain
        """
        self.get_response = get_response
        self.logger = logging.getLogger('api.requests')
    
    def __call__(self, request):
        """
        Log the request and response.
        
        Args:
            request: The HTTP request
            
        Returns:
            HttpResponse: The response
        """
        import time
        
        # Record start time
        start_time = time.time()
        
        # Log request
        self._log_request(request)
        
        # Process request
        response = self.get_response(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log response
        self._log_response(request, response, duration)
        
        return response
    
    def _log_request(self, request):
        """Log incoming request details."""
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
