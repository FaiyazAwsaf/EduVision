from django.urls import path
from .views import (
    ClassListCreateView,
    ClassDetailView,
    SectionListCreateView,
    SectionDetailView,
    TeacherProfileCreateView,
    TeacherProfileDetailView,
    TeacherProfileListView,
    StudentProfileCreateView,
    StudentProfileDetailView,
    StudentProfileListView,
    MyClassView,
    MyStudentsListView,
    MyStudentDetailView,
)

app_name = "students"

urlpatterns = [
    # ── Classes ───────────────────────────────────────────────────────────────
    path("classes/", ClassListCreateView.as_view(), name="class-list"),
    path("classes/<int:pk>/", ClassDetailView.as_view(), name="class-detail"),
    # ── Sections ──────────────────────────────────────────────────────────────
    path("sections/", SectionListCreateView.as_view(), name="section-list"),
    path("sections/<int:pk>/", SectionDetailView.as_view(), name="section-detail"),
    # ── Teachers ──────────────────────────────────────────────────────────────
    path("teachers/", TeacherProfileListView.as_view(), name="teacher-list"),
    path("teachers/create/", TeacherProfileCreateView.as_view(), name="teacher-create"),
    path(
        "teachers/<uuid:user_id>/",
        TeacherProfileDetailView.as_view(),
        name="teacher-detail",
    ),
    # ── Students ──────────────────────────────────────────────────────────────
    path("students/", StudentProfileListView.as_view(), name="student-list"),
    path("students/create/", StudentProfileCreateView.as_view(), name="student-create"),
    path(
        "students/<uuid:user_id>/",
        StudentProfileDetailView.as_view(),
        name="student-detail",
    ),
    # ── Class-teacher-scoped ─────────────────────────────────────────────────
    path("my-class/", MyClassView.as_view(), name="my-class"),
    path("my-students/", MyStudentsListView.as_view(), name="my-students-list"),
    path(
        "my-students/<uuid:user_id>/",
        MyStudentDetailView.as_view(),
        name="my-student-detail",
    ),
]
