from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    QuestionPaperViewSet,
    QuestionViewSet,
    AnswerScriptViewSet,
    QuestionEvaluationViewSet,
)

router = DefaultRouter()
router.register(r"question-papers", QuestionPaperViewSet, basename="question-paper")
router.register(r"questions", QuestionViewSet, basename="question")
router.register(r"scripts", AnswerScriptViewSet, basename="script")
router.register(r"evaluations", QuestionEvaluationViewSet, basename="evaluation")

urlpatterns = [
    path("", include(router.urls)),
]
