from django.urls import path
from . import views

app_name = "curriculum"

urlpatterns = [
    # ── Teacher endpoints ─────────────────────────────────────────────────
    path(
        "outlines/",
        views.CourseOutlineUploadView.as_view(),
        name="outline-upload",
    ),
    path(
        "outlines/list/",
        views.CourseOutlineListView.as_view(),
        name="outline-list",
    ),
    path(
        "outlines/<uuid:outline_id>/",
        views.CourseOutlineDetailView.as_view(),
        name="outline-detail",
    ),
    path(
        "outlines/<uuid:outline_id>/reparse/",
        views.CourseOutlineReparseView.as_view(),
        name="outline-reparse",
    ),
    path(
        "outlines/<uuid:outline_id>/difficulty-report/",
        views.TopicDifficultyReportView.as_view(),
        name="difficulty-report",
    ),

    # ── Material management ───────────────────────────────────────────────
    path(
        "topics/<uuid:topic_id>/materials/",
        views.TopicMaterialUploadView.as_view(),
        name="material-upload",
    ),
    path(
        "materials/<uuid:material_id>/",
        views.TopicMaterialDeleteView.as_view(),
        name="material-delete",
    ),

    # ── Notifications ─────────────────────────────────────────────────────
    path(
        "notifications/",
        views.NotificationListView.as_view(),
        name="notification-list",
    ),
    path(
        "notifications/mark-read/",
        views.NotificationMarkReadView.as_view(),
        name="notification-mark-read",
    ),

    # ── Student endpoints ─────────────────────────────────────────────────
    path(
        "my-courses/",
        views.MyCoursesListView.as_view(),
        name="my-courses",
    ),
    path(
        "my-courses/<uuid:outline_id>/topics/",
        views.CourseTopicsView.as_view(),
        name="course-topics",
    ),
    path(
        "my-courses/<uuid:outline_id>/summary/",
        views.CourseProgressSummaryView.as_view(),
        name="course-progress-summary",
    ),
    path(
        "topics/<uuid:topic_id>/progress/",
        views.TopicProgressUpdateView.as_view(),
        name="topic-progress",
    ),
    path(
        "topics/<uuid:topic_id>/flag-difficulty/",
        views.TopicDifficultyFlagView.as_view(),
        name="topic-flag-difficulty",
    ),
    path(
        "topics/<uuid:topic_id>/materials/list/",
        views.TopicMaterialsListView.as_view(),
        name="topic-materials-list",
    ),

    # ── Shared ────────────────────────────────────────────────────────────
    path(
        "topics/search/",
        views.TopicSearchView.as_view(),
        name="topic-search",
    ),
]
