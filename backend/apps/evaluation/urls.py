from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AnswerScriptViewSet,
    QuestionEvaluationViewSet,
)

router = DefaultRouter()
router.register(r"scripts", AnswerScriptViewSet, basename="script")
router.register(r"evaluations", QuestionEvaluationViewSet, basename="evaluation")

urlpatterns = [
    path("", include(router.urls)),
]
