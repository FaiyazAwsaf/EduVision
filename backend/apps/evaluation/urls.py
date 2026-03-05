from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AnswerScriptViewSet,
    QuestionEvaluationViewSet,
    SubmissionFormListCreateView,
    SubmissionFormDetailView,
    SubmissionFormScriptsView,
    BatchEvaluateView,
    StudentOpenFormsView,
    StudentSubmitScriptView,
    StudentMyScriptsView,
    EvaluationInsightsView,
)

router = DefaultRouter()
router.register(r"scripts", AnswerScriptViewSet, basename="script")
router.register(r"evaluations", QuestionEvaluationViewSet, basename="evaluation")

urlpatterns = [
    path("", include(router.urls)),
    # ── Teacher submission forms ──────────────────────────────────────────
    path("forms/", SubmissionFormListCreateView.as_view(), name="form-list"),
    path("forms/<uuid:pk>/", SubmissionFormDetailView.as_view(), name="form-detail"),
    path(
        "forms/<uuid:form_id>/submissions/",
        SubmissionFormScriptsView.as_view(),
        name="form-submissions",
    ),
    path(
        "forms/<uuid:form_id>/evaluate-all/",
        BatchEvaluateView.as_view(),
        name="form-evaluate-all",
    ),
    # ── Student submission endpoints ──────────────────────────────────────
    path("my-forms/", StudentOpenFormsView.as_view(), name="student-forms"),
    path(
        "my-forms/<uuid:form_id>/submit/",
        StudentSubmitScriptView.as_view(),
        name="student-submit",
    ),
    path("my-scripts/", StudentMyScriptsView.as_view(), name="student-scripts"),
    # ── Insights / Analytics ──────────────────────────────────────────────
    path("insights/", EvaluationInsightsView.as_view(), name="evaluation-insights"),
]
