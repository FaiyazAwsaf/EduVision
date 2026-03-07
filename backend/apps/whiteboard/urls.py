from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'whiteboard'

router = DefaultRouter()
router.register(r'sessions', views.WhiteboardSessionViewSet, basename='session')

urlpatterns = [
    path('api/', include(router.urls)),
    path('convert/', views.convert_to_latex, name="convert-to-latex"),
    path('me/', views.get_current_user, name="current-user"),
]