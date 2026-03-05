from django.db.models import Count, Q, Avg, F, ExpressionWrapper, DurationField
from django.utils import timezone
from datetime import timedelta
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from apps.authentication.models import CustomUser
from apps.authentication.backends import CustomUserJWTAuthentication
from .models import (
    Class, Section, TeacherProfile, StudentProfile,
    Subject, TeacherSubjectAssignment,
)
from .serializers import (
    ClassSerializer,
    SectionSerializer,
    TeacherProfileSerializer,
    StudentProfileSerializer,
    MyClassSerializer,
    SubjectSerializer,
    TeacherSubjectAssignmentSerializer,
    MyTeachingAssignmentSerializer,
)


# ─── Class views ──────────────────────────────────────────────────────────────


class ClassListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/classes/       → list all classes
    POST /api/classes/       → create a new class
    """

    serializer_class = ClassSerializer

    def get_queryset(self):
        qs = Class.objects.prefetch_related("sections").all()
        academic_year = self.request.query_params.get("academic_year")
        if academic_year:
            qs = qs.filter(academic_year=academic_year)
        return qs


class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET / PUT / PATCH / DELETE  /api/classes/<id>/
    """

    serializer_class = ClassSerializer
    queryset = Class.objects.prefetch_related("sections")


# ─── Section views ────────────────────────────────────────────────────────────


class SectionListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/sections/      → list all sections
    POST /api/sections/      → create a new section
    """

    serializer_class = SectionSerializer

    def get_queryset(self):
        qs = Section.objects.select_related("class_ref").all()
        class_id = self.request.query_params.get("class_id")
        if class_id:
            qs = qs.filter(class_ref_id=class_id)
        return qs


class SectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET / PUT / PATCH / DELETE  /api/sections/<id>/
    """

    serializer_class = SectionSerializer
    queryset = Section.objects.select_related("class_ref")


# ─── Teacher Profile views ───────────────────────────────────────────────────


class TeacherProfileListView(generics.ListAPIView):
    """
    GET /api/teachers/ → list all teacher profiles
    """

    serializer_class = TeacherProfileSerializer

    def get_queryset(self):
        return TeacherProfile.objects.select_related(
            "user", "class_teacher_of__class_ref"
        ).order_by("employee_id")


class TeacherProfileCreateView(generics.CreateAPIView):
    """
    POST /api/teachers/create/ → create a teacher profile
    Body: { "user_id": "<uuid>", "employee_id": "...", ... }
    """

    serializer_class = TeacherProfileSerializer

    def create(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(id=user_id, role="teacher")
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Teacher user not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if TeacherProfile.objects.filter(user=user).exists():
            return Response(
                {"error": "Profile already exists for this teacher"},
                status=status.HTTP_409_CONFLICT,
            )

        profile = TeacherProfile.objects.create(
            user=user,
            employee_id=request.data.get("employee_id", ""),
            department=request.data.get("department", ""),
            qualification=request.data.get("qualification", ""),
            date_of_birth=request.data.get("date_of_birth"),
            phone=request.data.get("phone", ""),
            address=request.data.get("address", ""),
            class_teacher_of_id=request.data.get("class_teacher_of"),
        )

        serializer = self.get_serializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TeacherProfileDetailView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/teachers/<user_id>/  → retrieve teacher profile
    PUT / PATCH                    → update teacher profile
    """

    serializer_class = TeacherProfileSerializer
    lookup_field = "user_id"

    def get_queryset(self):
        return TeacherProfile.objects.select_related(
            "user", "class_teacher_of__class_ref"
        )


# ─── Student Profile views ───────────────────────────────────────────────────


class StudentProfileDetailView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/students/<user_id>/  → retrieve student profile
    PUT  /api/students/<user_id>/  → update student profile
    PATCH /api/students/<user_id>/ → partial update
    """

    serializer_class = StudentProfileSerializer
    lookup_field = "user_id"

    def get_queryset(self):
        return StudentProfile.objects.select_related(
            "user", "section__class_ref"
        )


class StudentProfileCreateView(generics.CreateAPIView):
    """
    POST /api/students/create/  → create student profile for an existing user
    Body: { "user_id": "<uuid>", "roll_number": "...", "section": <id>, ... }
    """

    serializer_class = StudentProfileSerializer

    def create(self, request, *args, **kwargs):
        user_id = request.data.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = CustomUser.objects.get(id=user_id, role="student")
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Student user not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if StudentProfile.objects.filter(user=user).exists():
            return Response(
                {"error": "Profile already exists for this student"},
                status=status.HTTP_409_CONFLICT,
            )

        profile = StudentProfile.objects.create(
            user=user,
            roll_number=request.data.get("roll_number", ""),
            section_id=request.data.get("section"),
            blood_group=request.data.get("blood_group", ""),
            date_of_birth=request.data.get("date_of_birth"),
            address=request.data.get("address", ""),
            father_name=request.data.get("father_name", ""),
            father_phone=request.data.get("father_phone", ""),
            mother_name=request.data.get("mother_name", ""),
            mother_phone=request.data.get("mother_phone", ""),
            guardian_name=request.data.get("guardian_name", ""),
            guardian_phone=request.data.get("guardian_phone", ""),
        )

        serializer = self.get_serializer(profile)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StudentProfileListView(generics.ListAPIView):
    """
    GET /api/students/ → list all student profiles
    Supports ?section=<id> and ?class_id=<id> query filters.
    """

    serializer_class = StudentProfileSerializer

    def get_queryset(self):
        qs = StudentProfile.objects.select_related(
            "user", "section__class_ref"
        ).order_by("roll_number")

        section_id = self.request.query_params.get("section")
        if section_id:
            qs = qs.filter(section_id=section_id)

        class_id = self.request.query_params.get("class_id")
        if class_id:
            qs = qs.filter(section__class_ref_id=class_id)

        return qs


# ─── Subject & Assignment views ──────────────────────────────────────────────


class SubjectListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/school/subjects/   → list all subjects
    POST /api/school/subjects/   → create a new subject (admin)
    """

    serializer_class = SubjectSerializer
    queryset = Subject.objects.all()
    pagination_class = None


class SubjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET / PUT / PATCH / DELETE  /api/school/subjects/<uuid:pk>/
    """

    serializer_class = SubjectSerializer
    queryset = Subject.objects.all()


class TeacherSubjectAssignmentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/school/assignments/   → list all assignments (admin)
    POST /api/school/assignments/   → create assignment (admin)
    """

    serializer_class = TeacherSubjectAssignmentSerializer

    def get_queryset(self):
        qs = TeacherSubjectAssignment.objects.select_related(
            "teacher", "subject", "section__class_ref"
        ).all()

        teacher_id = self.request.query_params.get("teacher")
        if teacher_id:
            qs = qs.filter(teacher_id=teacher_id)

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        section_id = self.request.query_params.get("section")
        if section_id:
            qs = qs.filter(section_id=section_id)

        return qs


class TeacherSubjectAssignmentDetailView(generics.RetrieveDestroyAPIView):
    """
    GET / DELETE  /api/school/assignments/<uuid:pk>/
    """

    serializer_class = TeacherSubjectAssignmentSerializer
    queryset = TeacherSubjectAssignment.objects.select_related(
        "teacher", "subject", "section__class_ref"
    )


class MyTeachingAssignmentsView(generics.ListAPIView):
    """
    GET /api/school/my-assignments/
    Returns the logged-in teacher's subject + section combos.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = MyTeachingAssignmentSerializer
    pagination_class = None

    def get_queryset(self):
        return TeacherSubjectAssignment.objects.filter(
            teacher=self.request.user
        ).select_related("subject", "section__class_ref")


# ─── Class-teacher-scoped views ──────────────────────────────────────────────


def _get_teacher_section(user):
    """Return the Section the authenticated teacher is class-teacher of, or None."""
    try:
        profile = TeacherProfile.objects.select_related(
            "class_teacher_of__class_ref"
        ).get(user=user)
        return profile.class_teacher_of
    except TeacherProfile.DoesNotExist:
        return None


class MyClassView(APIView):
    """
    GET /api/school/my-class/
    Returns section info + student count for the logged-in teacher's assigned section.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        section = _get_teacher_section(request.user)
        if section is None:
            return Response(
                {"detail": "You are not assigned as a class teacher."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Annotate with student count
        section_qs = Section.objects.filter(pk=section.pk).select_related(
            "class_ref"
        ).annotate(student_count=Count("students"))
        section_obj = section_qs.first()

        serializer = MyClassSerializer(section_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MyStudentsListView(generics.ListAPIView):
    """
    GET /api/school/my-students/
    Lists all students in the logged-in teacher's assigned section.
    Supports ?search= to filter by name or roll number.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = StudentProfileSerializer
    pagination_class = None  # Return all students (sections are small)

    def get_queryset(self):
        section = _get_teacher_section(self.request.user)
        if section is None:
            return StudentProfile.objects.none()

        qs = StudentProfile.objects.filter(
            section=section
        ).select_related("user", "section__class_ref").order_by("roll_number")

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(roll_number__icontains=search)
            )

        return qs


class MyStudentDetailView(generics.RetrieveAPIView):
    """
    GET /api/school/my-students/<user_id>/
    Returns full student profile, but only if the student belongs to
    the logged-in teacher's assigned section.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = StudentProfileSerializer
    lookup_field = "user_id"

    def get_queryset(self):
        section = _get_teacher_section(self.request.user)
        if section is None:
            return StudentProfile.objects.none()

        return StudentProfile.objects.filter(
            section=section
        ).select_related("user", "section__class_ref")


# ─── School Insights (Teacher) ──────────────────────────────────────────────


class SchoolInsightsView(APIView):
    """
    GET /api/school/insights/
    Returns student count, content generation summary, and tutoring activity
    scoped to the logged-in teacher.
    """

    authentication_classes = [CustomUserJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()

        # Total students across teacher's assigned sections
        teacher_sections = TeacherSubjectAssignment.objects.filter(
            teacher=user
        ).values_list("section_id", flat=True)

        total_students = StudentProfile.objects.filter(
            section_id__in=teacher_sections
        ).distinct().count()

        # ── Content Generation Summary ───────────────────────────────────
        from apps.content_requests.models import ContentRequestModel

        teacher_content = ContentRequestModel.objects.filter(created_by=user)
        total_content = teacher_content.count()
        completed_content = teacher_content.filter(status="completed").count()

        content_by_type = list(
            teacher_content.values("content_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # ── Tutoring Summary ─────────────────────────────────────────────
        from apps.tutoring.models import TutoringSession

        teacher_sessions = TutoringSession.objects.filter(teacher=user)
        total_sessions = teacher_sessions.count()
        ended_sessions = teacher_sessions.filter(ended_at__isnull=False)

        # Average duration for ended sessions
        avg_duration_seconds = 0
        if ended_sessions.exists():
            durations = []
            for s in ended_sessions:
                delta = s.ended_at - s.created_at
                durations.append(delta.total_seconds())
            avg_duration_seconds = round(sum(durations) / len(durations)) if durations else 0

        # Sessions per day over last 14 days
        fourteen_days_ago = now - timedelta(days=14)
        sessions_by_day = []
        for day_offset in range(13, -1, -1):
            day_start = (now - timedelta(days=day_offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            day_end = day_start + timedelta(days=1)
            cnt = teacher_sessions.filter(
                created_at__gte=day_start, created_at__lt=day_end
            ).count()
            sessions_by_day.append({
                "date": day_start.strftime("%b %d"),
                "count": cnt,
            })

        return Response({
            "total_students": total_students,
            "content_summary": {
                "total": total_content,
                "completed": completed_content,
                "success_rate": round(
                    (completed_content / total_content * 100) if total_content > 0 else 0, 1
                ),
                "by_type": content_by_type,
            },
            "tutoring_summary": {
                "total_sessions": total_sessions,
                "avg_duration_seconds": avg_duration_seconds,
                "sessions_by_day": sessions_by_day,
            },
        })
