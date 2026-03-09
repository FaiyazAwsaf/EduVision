from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'whiteboard'

router = DefaultRouter()
router.register(r'sessions', views.WhiteboardSessionViewSet, basename='session')

urlpatterns = [
    path('', include(router.urls)),
    path('convert/', views.convert_to_latex, name="convert-to-latex"),
    path('evaluate/', views.evaluate_equation, name="evaluate-equation"),
]