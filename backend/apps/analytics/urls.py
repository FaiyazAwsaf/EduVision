from django.urls import path
from . import views

app_name = "analytics"

urlpatterns = [
    # ── Student ──────────────────────────────────────────────────────────────
    # Convenience endpoint for the logged-in student's own data
    path("me/", views.MyAnalyticsView.as_view(), name="my-analytics"),

    # Teacher or self: individual student data
    path("student/<str:student_id>/progress/", views.StudentProgressView.as_view(), name="student-progress"),
    path("student/<str:student_id>/subjects/", views.StudentSubjectsView.as_view(), name="student-subjects"),
    path("student/<str:student_id>/topics/", views.StudentTopicsView.as_view(), name="student-topics"),
    path("student/<str:student_id>/overview/", views.StudentOverviewView.as_view(), name="student-overview"),

    # ── Class / Assessment ────────────────────────────────────────────────────
    path("class/<str:assessment_id>/distribution/", views.ClassDistributionView.as_view(), name="class-distribution"),
    path("class/<str:assessment_id>/question-performance/", views.ClassQuestionPerformanceView.as_view(), name="class-question-performance"),

    # ── Misconception Detection ───────────────────────────────────────────────
    path("misconceptions/<str:question_rubric_id>/", views.MisconceptionView.as_view(), name="misconceptions"),
    path("misconceptions/<str:question_rubric_id>/recompute/", views.MisconceptionRecomputeView.as_view(), name="misconceptions-recompute"),

    # ── Utilities ─────────────────────────────────────────────────────────────
    path("rebuild-snapshots/", views.RebuildSnapshotsView.as_view(), name="rebuild-snapshots"),
]
