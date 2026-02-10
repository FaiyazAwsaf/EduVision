from django.contrib import admin
from .models import Class, Section, TeacherProfile, StudentProfile


# ─── Class ────────────────────────────────────────────────────────────────────


class SectionInline(admin.TabularInline):
    model = Section
    extra = 1


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ("name", "stream", "academic_year")
    list_filter = ("academic_year", "stream")
    search_fields = ("name", "stream")
    inlines = [SectionInline]


# ─── Section ──────────────────────────────────────────────────────────────────


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("__str__", "class_ref", "name", "capacity")
    list_filter = ("class_ref__academic_year", "class_ref__name")
    search_fields = ("name", "class_ref__name")


# ─── Teacher Profile ─────────────────────────────────────────────────────────


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = (
        "employee_id",
        "get_full_name",
        "department",
        "phone",
        "class_teacher_of",
    )
    search_fields = (
        "employee_id",
        "user__first_name",
        "user__last_name",
        "user__email",
        "department",
    )
    list_filter = ("department",)

    @admin.display(description="Teacher Name")
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"


# ─── Student Profile ─────────────────────────────────────────────────────────


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = (
        "roll_number",
        "get_full_name",
        "get_class",
        "get_section",
        "blood_group",
    )
    search_fields = (
        "roll_number",
        "user__first_name",
        "user__last_name",
        "user__email",
    )
    list_filter = (
        "section__class_ref__name",
        "section__name",
        "blood_group",
    )

    @admin.display(description="Student Name")
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"

    @admin.display(description="Class")
    def get_class(self, obj):
        return obj.section.class_ref.name if obj.section else "-"

    @admin.display(description="Section")
    def get_section(self, obj):
        return obj.section.name if obj.section else "-"
