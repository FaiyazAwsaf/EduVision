from rest_framework import generics, status
from rest_framework.response import Response
from apps.authentication.models import CustomUser
from .models import Class, Section, TeacherProfile, StudentProfile
from .serializers import (
    ClassSerializer,
    SectionSerializer,
    TeacherProfileSerializer,
    StudentProfileSerializer,
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
