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
    SubjectListCreateView,
    SubjectDetailView,
    TeacherSubjectAssignmentListCreateView,
    TeacherSubjectAssignmentDetailView,
    MyTeachingAssignmentsView,
    MyClassView,
    MyStudentsListView,
    MyStudentDetailView,
    SchoolInsightsView,
    MySubjectsView,
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
    # ── Subjects ──────────────────────────────────────────────────────────────
    path("subjects/", SubjectListCreateView.as_view(), name="subject-list"),
    path("subjects/<uuid:pk>/", SubjectDetailView.as_view(), name="subject-detail"),
    # ── Teaching Assignments ──────────────────────────────────────────────────
    path("assignments/", TeacherSubjectAssignmentListCreateView.as_view(), name="assignment-list"),
    path("assignments/<uuid:pk>/", TeacherSubjectAssignmentDetailView.as_view(), name="assignment-detail"),
    path("my-assignments/", MyTeachingAssignmentsView.as_view(), name="my-assignments"),    path("my-subjects/", MySubjectsView.as_view(), name="my-subjects"),    # ── Class-teacher-scoped ─────────────────────────────────────────────────
    path("my-class/", MyClassView.as_view(), name="my-class"),
    path("my-students/", MyStudentsListView.as_view(), name="my-students-list"),
    path(
        "my-students/<uuid:user_id>/",
        MyStudentDetailView.as_view(),
        name="my-student-detail",
    ),
    # ── Insights / Analytics ──────────────────────────────────────────────
    path("insights/", SchoolInsightsView.as_view(), name="school-insights"),
]
