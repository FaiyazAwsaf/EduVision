from django.db import models
from apps.authentication.models import CustomUser


class BloodGroup(models.TextChoices):
    A_POS = "A+", "A+"
    A_NEG = "A-", "A-"
    B_POS = "B+", "B+"
    B_NEG = "B-", "B-"
    AB_POS = "AB+", "AB+"
    AB_NEG = "AB-", "AB-"
    O_POS = "O+", "O+"
    O_NEG = "O-", "O-"


# ─── Class & Section ─────────────────────────────────────────────────────────


class Class(models.Model):
    """A grade/class level within the institution."""

    name = models.CharField(
        max_length=20,
        help_text="Grade or class name, e.g. '10', '12'",
    )
    stream = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Optional stream, e.g. 'Science', 'Commerce', 'Arts'",
    )
    academic_year = models.CharField(
        max_length=9,
        help_text="e.g. '2025-2026'",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "classes"
        verbose_name = "Class"
        verbose_name_plural = "Classes"
        unique_together = ("name", "stream", "academic_year")
        ordering = ["name", "stream"]

    def __str__(self):
        label = self.name
        if self.stream:
            label += f" - {self.stream}"
        return f"{label} ({self.academic_year})"


class Section(models.Model):
    """A section within a class (e.g. 'A', 'B')."""

    class_ref = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="sections",
    )
    name = models.CharField(
        max_length=10,
        help_text="Section identifier, e.g. 'A', 'B'",
    )
    capacity = models.PositiveIntegerField(
        default=40,
        help_text="Maximum number of students",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sections"
        verbose_name = "Section"
        verbose_name_plural = "Sections"
        unique_together = ("class_ref", "name")
        ordering = ["class_ref", "name"]

    def __str__(self):
        return f"{self.class_ref.name}-{self.name} ({self.class_ref.academic_year})"


# ─── Teacher Profile ─────────────────────────────────────────────────────────


class TeacherProfile(models.Model):
    """
    Extended profile for users with role='teacher'.
    Linked 1:1 to CustomUser.
    """

    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="teacher_profile",
    )

    employee_id = models.CharField(max_length=30, unique=True)
    department = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="e.g. 'Mathematics', 'Science'",
    )
    qualification = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="e.g. 'M.Sc. Mathematics', 'B.Ed'",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    address = models.TextField(blank=True, default="")

    # Classes this teacher is assigned as class-teacher
    class_teacher_of = models.ForeignKey(
        Section,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_teacher",
        help_text="Section where this teacher is the class teacher",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "teachers_profile"
        verbose_name = "Teacher Profile"
        verbose_name_plural = "Teacher Profiles"

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} ({self.employee_id})"


# ─── Student Profile ─────────────────────────────────────────────────────────


class StudentProfile(models.Model):
    """
    Extended profile for users with role='student'.
    Linked 1:1 to CustomUser — the auth table stays untouched.
    """

    user = models.OneToOneField(
        CustomUser,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="student_profile",
    )

    roll_number = models.CharField(max_length=30, unique=True)
    section = models.ForeignKey(
        Section,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        help_text="The section this student belongs to",
    )
    blood_group = models.CharField(
        max_length=3,
        choices=BloodGroup.choices,
        blank=True,
        default="",
    )
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True, default="")

    # Parent / Guardian info
    father_name = models.CharField(max_length=100, blank=True, default="")
    father_phone = models.CharField(max_length=20, blank=True, default="")
    mother_name = models.CharField(max_length=100, blank=True, default="")
    mother_phone = models.CharField(max_length=20, blank=True, default="")
    guardian_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Fill only if different from parents",
    )
    guardian_phone = models.CharField(max_length=20, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students_profile"
        verbose_name = "Student Profile"
        verbose_name_plural = "Student Profiles"

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} ({self.roll_number})"

