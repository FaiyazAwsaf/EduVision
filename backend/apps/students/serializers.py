from rest_framework import serializers
from .models import Class, Section, TeacherProfile, StudentProfile


# ─── Class / Section ─────────────────────────────────────────────────────────


class SectionBriefSerializer(serializers.ModelSerializer):
    """Minimal section representation (used inside nested contexts)."""

    class_name = serializers.CharField(source="class_ref.name", read_only=True)
    stream = serializers.CharField(source="class_ref.stream", read_only=True)
    academic_year = serializers.CharField(
        source="class_ref.academic_year", read_only=True
    )

    class Meta:
        model = Section
        fields = [
            "id",
            "name",
            "class_name",
            "stream",
            "academic_year",
            "capacity",
        ]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "class_ref", "name", "capacity", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


class ClassSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)

    class Meta:
        model = Class
        fields = [
            "id",
            "name",
            "stream",
            "academic_year",
            "sections",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


# ─── Teacher Profile ─────────────────────────────────────────────────────────


class TeacherProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    class_teacher_of_detail = SectionBriefSerializer(
        source="class_teacher_of", read_only=True
    )

    class Meta:
        model = TeacherProfile
        fields = [
            "user_id",
            "email",
            "username",
            "first_name",
            "last_name",
            "employee_id",
            "department",
            "qualification",
            "date_of_birth",
            "phone",
            "address",
            "class_teacher_of",
            "class_teacher_of_detail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["user_id", "created_at", "updated_at"]


# ─── Student Profile ─────────────────────────────────────────────────────────


class StudentProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    section_detail = SectionBriefSerializer(source="section", read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            "user_id",
            "email",
            "username",
            "first_name",
            "last_name",
            "roll_number",
            "section",
            "section_detail",
            "blood_group",
            "date_of_birth",
            "address",
            "father_name",
            "father_phone",
            "mother_name",
            "mother_phone",
            "guardian_name",
            "guardian_phone",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["user_id", "created_at", "updated_at"]
