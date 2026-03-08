"""
Tutoring Authentication Middleware

Provides authentication for tutoring API endpoints.
Supports both JWT Bearer tokens and X-User-Id header (development fallback).
"""

import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class TempAuthMiddleware(MiddlewareMixin):
    """
    Authentication middleware for tutoring endpoints.
    
    How it works (in order of priority):
    1. Checks for JWT Bearer token in Authorization header
    2. Falls back to X-User-Id header (development only)
    3. Attaches user to request.tutoring_user
    4. Returns 401 if neither method succeeds
    """
    
    # Paths that don't require authentication
    EXEMPT_PATHS = [
        '/admin/',
    ]
    
    def process_request(self, request):
        """
        Process incoming request and attach user if authenticated.
        """
        # Skip non-tutoring API paths
        if not request.path.startswith('/api/tutoring/'):
            return None
        
        # Check exempt paths
        for exempt_path in self.EXEMPT_PATHS:
            if request.path.startswith(exempt_path):
                return None
        
        # Try JWT Bearer token first
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            user = self._authenticate_jwt(token)
            if user:
                request.tutoring_user = user
                return None
            # If JWT fails, don't fall back - return 401
            return JsonResponse(
                {
                    'error': 'Authentication failed',
                    'detail': 'Invalid or expired JWT token',
                    'code': 'auth_failed'
                },
                status=401
            )
        
        # Fall back to X-User-Id header (development)
        user_id = request.headers.get('X-User-Id')
        
        if not user_id:
            logger.warning(
                f"Missing authentication for path: {request.path}"
            )
            return JsonResponse(
                {
                    'error': 'Authentication required',
                    'detail': 'Authorization header or X-User-Id header is required',
                    'code': 'auth_required'
                },
                status=401
            )
        
        from apps.authentication.models import CustomUser
        
        try:
            user = CustomUser.objects.get(id=user_id)
            request.tutoring_user = user
            logger.debug(
                f"Authenticated user via X-User-Id: {user.first_name} {user.last_name} ({user.role})"
            )
        except CustomUser.DoesNotExist:
            logger.warning(f"User not found: {user_id}")
            return JsonResponse(
                {
                    'error': 'User not found',
                    'detail': f'No user found with ID: {user_id}',
                    'code': 'user_not_found'
                },
                status=401
            )
        except Exception as e:
            logger.error(f"Error fetching user: {str(e)}")
            return JsonResponse(
                {
                    'error': 'Authentication error',
                    'detail': 'Failed to authenticate user',
                    'code': 'auth_error'
                },
                status=500
            )
        
        return None
    
    def _authenticate_jwt(self, token):
        """
        Validate JWT token and return the associated user.
        
        Returns:
            CustomUser instance or None if token is invalid
        """
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from apps.authentication.models import CustomUser
            
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            user = CustomUser.objects.get(id=user_id)
            logger.debug(
                f"Authenticated user via JWT: {user.first_name} {user.last_name} ({user.role})"
            )
            return user
        except Exception as e:
            logger.warning(f"JWT authentication failed: {str(e)}")
            return None
