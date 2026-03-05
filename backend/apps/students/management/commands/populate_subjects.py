"""
Management command to populate subjects, teacher profiles for non-seed teachers,
and teaching assignments based on existing database data.

Usage:
    python manage.py populate_subjects
"""

from django.core.management.base import BaseCommand
from apps.authentication.models import CustomUser
from apps.students.models import (
    Subject, TeacherSubjectAssignment, TeacherProfile, Section,
)


SUBJECTS = [
    ("Mathematics", "MATH"),
    ("Physics", "PHY"),
    ("Chemistry", "CHEM"),
    ("Biology", "BIO"),
    ("English", "ENG"),
    ("Bengali", "BAN"),
    ("ICT", "ICT"),
    ("History", "HIST"),
    ("Geography", "GEO"),
    ("Islamic Studies", "IS"),
    ("Accounting", "ACC"),
    ("Business Studies", "BUS"),
]


class Command(BaseCommand):
    help = "Populate subjects table and create teaching assignments"

    def handle(self, *args, **options):
        self._create_subjects()
        self._ensure_teacher_profiles()
        self._create_assignments()
        self.stdout.write(self.style.SUCCESS("\nDone!"))

    # ── 1. Subjects ────────────────────────────────────────────────────────

    def _create_subjects(self):
        self.stdout.write("Creating subjects...")
        for name, code in SUBJECTS:
            obj, created = Subject.objects.get_or_create(
                code=code, defaults={"name": name}
            )
            tag = "CREATED" if created else "exists "
            self.stdout.write(f"  {tag}: {obj.name} ({obj.code})")
        self.stdout.write(f"  Total: {Subject.objects.count()}")

    # ── 2. Teacher profiles for non-seed accounts ──────────────────────────

    def _ensure_teacher_profiles(self):
        self.stdout.write("\nEnsuring teacher profiles for non-seed teachers...")
        non_seed = CustomUser.objects.filter(role="teacher").exclude(
            username__startswith="seed_"
        )
        section_9a = Section.objects.filter(
            class_ref__name="9", name="A"
        ).select_related("class_ref").first()
        section_9b = Section.objects.filter(
            class_ref__name="9", name="B"
        ).select_related("class_ref").first()

        for user in non_seed:
            try:
                user.teacher_profile  # noqa: B018
                self.stdout.write(f"  exists : {user.username}")
            except TeacherProfile.DoesNotExist:
                dept = "ICT" if user.username == "rifat" else "Mathematics"
                ct = section_9a if user.username == "rifat" else section_9b
                TeacherProfile.objects.create(
                    user=user,
                    employee_id=f"TCH-{user.username.upper()[:8]}",
                    department=dept,
                    qualification="B.Sc. (Hons)" if dept == "ICT" else "M.Sc.",
                    phone="",
                    address="",
                    class_teacher_of=ct,
                )
                self.stdout.write(
                    f"  CREATED: {user.username} - {dept}, class teacher of {ct}"
                )

    # ── 3. Teaching Assignments ────────────────────────────────────────────

    def _create_assignments(self):
        self.stdout.write("\nCreating teaching assignments...")

        subject_map = {s.name: s for s in Subject.objects.all()}

        # Organize sections
        general = list(
            Section.objects.filter(
                class_ref__name__in=["9", "10"]
            ).select_related("class_ref")
        )
        science = list(
            Section.objects.filter(
                class_ref__name__in=["11", "12"], class_ref__stream="Science"
            ).select_related("class_ref")
        )
        commerce = list(
            Section.objects.filter(
                class_ref__name__in=["11", "12"], class_ref__stream="Commerce"
            ).select_related("class_ref")
        )
        arts = list(
            Section.objects.filter(
                class_ref__name__in=["11", "12"], class_ref__stream="Arts"
            ).select_related("class_ref")
        )

        all_sections = general + science + commerce + arts

        # Department → eligible sections
        dept_sections = {
            "Mathematics": all_sections,
            "English": all_sections,
            "Bengali": all_sections,
            "ICT": all_sections,
            "Islamic Studies": all_sections,
            "Physics": general + science,
            "Chemistry": general + science,
            "Biology": general + science,
            "History": general + arts,
            "Geography": general + arts,
            "Accounting": commerce,
            "Business Studies": commerce,
        }

        teachers = TeacherProfile.objects.select_related("user").all()
        created_count = 0

        for tp in teachers:
            subject = subject_map.get(tp.department)
            if not subject:
                self.stdout.write(
                    f"  SKIP: {tp.user.first_name} {tp.user.last_name}"
                    f" — no subject for '{tp.department}'"
                )
                continue

            eligible = dept_sections.get(tp.department, [])
            # Assign to up to 6 sections (realistic workload)
            to_assign = eligible[:6]

            for sec in to_assign:
                _, created = TeacherSubjectAssignment.objects.get_or_create(
                    teacher=tp.user,
                    subject=subject,
                    section=sec,
                )
                if created:
                    created_count += 1

            self.stdout.write(
                f"  {tp.user.first_name} {tp.user.last_name}"
                f" ({tp.department}) -> {len(to_assign)} sections"
            )

        self.stdout.write(f"\n  New assignments: {created_count}")
        self.stdout.write(
            f"  Total assignments: {TeacherSubjectAssignment.objects.count()}"
        )
