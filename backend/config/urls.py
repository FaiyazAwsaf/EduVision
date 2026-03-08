"""
URL configuration for EduVision project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from apps.content_requests.api.views_study_plan import StudyPlanViewSet, StudyPlanItemViewSet
from django.conf import settings
from django.conf.urls.static import static


# Health check endpoint for Docker/Kubernetes
def health_check(request):
    """Simple health check endpoint for container orchestration."""
    return JsonResponse({
        'status': 'healthy',
        'service': 'eduvision-backend'
    })


# Root API info endpoint
def api_root(request):
    """Root endpoint providing API information."""
    return JsonResponse({
        'name': 'EduVision API',
        'version': '1.0.0',
        'status': 'running',
        'endpoints': {
            'health': '/api/health/',
            'content_requests': '/api/content-requests/',
            'study_plans': '/api/study-plans/',
            'intelligence': '/api/intelligence/',
            'tutoring': '/api/tutoring/',
            'evaluation': '/api/evaluation/',
            'rubrics': '/api/rubrics/',
            'whiteboard': '/api/whiteboard/',
            'school': '/api/school/',
            'admin': '/admin/',
        }
    })


# Router for study plans (Phase 5)
router = DefaultRouter()
router.register(r'study-plans', StudyPlanViewSet, basename='study-plan')
router.register(r'study-plan-items', StudyPlanItemViewSet, basename='study-plan-item')


urlpatterns = [
    # Root API info
    path('', api_root, name='api_root'),
    
    # Health check (for Docker/Kubernetes)
    path('api/health/', health_check, name='health_check'),
    
    # Admin interface
    path('admin/', admin.site.urls),
    
    # API endpoints

    # content generator endpoint
    path('api/content-requests/', include('apps.content_requests.api.urls')),
    
    # Study plan endpoints 
    path('api/', include(router.urls)),
    
    # intelligence & adaptive optimization endpoints 
    path('api/intelligence/', include('apps.intelligence.api.urls', namespace='intelligence')),
    
    # tutoring endpoint
    path('api/tutoring/', include('apps.tutoring.api.urls', namespace='tutoring')),

    # whiteboard endpoint
    path('api/whiteboard/', include('apps.whiteboard.urls', namespace='whiteboard')),

    # authentication endpoint (also available at root /auth/)
    path('api/', include('apps.authentication.urls')),

    # path('api/evaluation/', include('apps.evaluation.api.urls')),
    path('api/evaluation/', include('apps.evaluation.urls')),
    path('api/', include('apps.rubrics.urls')),

    # school (classes, sections, teachers, students)
    path('api/school/', include('apps.students.urls', namespace='students')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
