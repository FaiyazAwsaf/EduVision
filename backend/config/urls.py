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
from rest_framework.routers import DefaultRouter
from apps.content_requests.api.views_study_plan import StudyPlanViewSet, StudyPlanItemViewSet

# Router for study plans (Phase 5)
router = DefaultRouter()
router.register(r'study-plans', StudyPlanViewSet, basename='study-plan')
router.register(r'study-plan-items', StudyPlanItemViewSet, basename='study-plan-item')

urlpatterns = [
    # Admin interface
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/content-requests/', include('apps.content_requests.api.urls')),
    
    # Study plan endpoints (Phase 5)
    path('api/', include(router.urls)),
    
    # Intelligence & Adaptive Optimization endpoints (Phase 6)
    path('api/intelligence/', include('apps.intelligence.api.urls', namespace='intelligence')),
    
    # Module 5: Tutoring endpoints
    path('api/tutoring/', include('apps.tutoring.api.urls', namespace='tutoring')),
    
    # Add other module APIs here as they are implemented
    # path('api/evaluation/', include('apps.evaluation.api.urls')),
]
