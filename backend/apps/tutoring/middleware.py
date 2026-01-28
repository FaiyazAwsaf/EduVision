"""
Temporary Authentication Middleware

Provides a temporary authentication mechanism for development
using X-User-Id header. This will be replaced with proper
authentication in production.

Security Note:
    This middleware is for development only! Do not use in production.
    It trusts the X-User-Id header without verification.
"""

import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class TempAuthMiddleware(MiddlewareMixin):
    """
    Temporary authentication middleware that reads X-User-Id header.
    
    How it works:
    1. Reads X-User-Id header from request
    2. Fetches corresponding TutoringUser from database
    3. Attaches user to request object as request.tutoring_user
    4. Returns 401 if header missing or user not found
    
    Exempt paths:
    - /api/tutoring/users/ (for creating/listing test users)
    - /admin/
    - Paths not starting with /api/tutoring/
    """
    
    # Paths that don't require authentication
    EXEMPT_PATHS = [
        '/api/tutoring/users/',
        '/api/tutoring/users',
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
        
        # Get user ID from header
        user_id = request.headers.get('X-User-Id')
        
        if not user_id:
            logger.warning(
                f"Missing X-User-Id header for path: {request.path}"
            )
            return JsonResponse(
                {
                    'error': 'Authentication required',
                    'detail': 'X-User-Id header is required',
                    'code': 'auth_required'
                },
                status=401
            )
        
        # Import here to avoid circular imports
        from apps.tutoring.models import TutoringUser
        
        try:
            user = TutoringUser.objects.get(id=user_id)
            request.tutoring_user = user
            logger.debug(
                f"Authenticated user: {user.full_name} ({user.role})"
            )
        except TutoringUser.DoesNotExist:
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
