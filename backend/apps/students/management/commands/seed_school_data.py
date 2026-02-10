"""
Management command to seed the database with sample Bangladeshi data.

Usage:
    python manage.py seed_school_data          # creates everything
    python manage.py seed_school_data --flush  # wipes existing seed data first
"""

import random
from django.core.management.base import BaseCommand
from apps.authentication.models import CustomUser
from apps.students.models import Class, Section, TeacherProfile, StudentProfile


# ─── Bangladeshi name pools ──────────────────────────────────────────────────

MALE_FIRST = [
    "Rahim", "Karim", "Farhan", "Tanvir", "Shakib", "Mahfuz", "Arif",
    "Nayeem", "Sabbir", "Jubayer", "Rakib", "Mehedi", "Shihab", "Imran",
    "Ashraf", "Rifat", "Sohel", "Mamun", "Fahim", "Nazmul", "Sajid",
    "Rezaul", "Mushfiq", "Tamim", "Liton", "Soumya", "Mominul", "Taskin",
    "Ebadot", "Shoriful", "Towhid", "Rony", "Shanto", "Naim", "Mahmudul",
    "Rayhan", "Hasib", "Kamrul", "Zahid", "Monir",
]

FEMALE_FIRST = [
    "Fatema", "Ayesha", "Nusrat", "Tasnim", "Rabeya", "Sultana", "Marium",
    "Jannatul", "Sharmin", "Nafisa", "Lamia", "Sadia", "Tamanna", "Farzana",
    "Sumaiya", "Israt", "Taslima", "Rumana", "Mahbuba", "Nasreen", "Salma",
    "Reshma", "Farjana", "Tania", "Poly", "Habiba", "Munni", "Shirin",
    "Laboni", "Sabrina", "Ruma", "Mithila", "Nahar", "Ratna", "Afroza",
]

LAST_NAMES = [
    "Hasan", "Islam", "Rahman", "Ahmed", "Chowdhury", "Khan", "Uddin",
    "Akter", "Begum", "Mia", "Hossain", "Talukder", "Sarkar", "Mondal",
    "Bhuiyan", "Siddique", "Alam", "Kabir", "Mostafa", "Kamal", "Zaman",
    "Haque", "Biswas", "Khandaker", "Mahmud",
]

DEPARTMENTS = [
    "Mathematics", "Physics", "Chemistry", "Biology", "English",
    "Bengali", "ICT", "History", "Geography", "Islamic Studies",
    "Accounting", "Business Studies",
]

QUALIFICATIONS = [
    "M.Sc. Mathematics", "M.Sc. Physics", "M.Sc. Chemistry",
    "M.A. English", "M.A. Bengali", "M.A. History",
    "M.S.S. Geography", "B.Ed", "M.Ed",
    "M.B.S. Accounting", "M.Com", "B.Sc. (Hons) ICT",
]

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

STREETS = [
    "Mirpur", "Dhanmondi", "Uttara", "Mohammadpur", "Banani",
    "Gulshan", "Tejgaon", "Motijheel", "Badda", "Khilgaon",
    "Rampura", "Jatrabari", "Shyamoli", "Lalmatia", "Mohakhali",
    "Gazipur", "Narayanganj", "Tongi", "Savar", "Keraniganj",
]


def _random_phone():
    return f"01{random.choice(['3','5','6','7','8','9'])}{random.randint(10000000,99999999)}"


def _random_dob(min_year, max_year):
    from datetime import date
    y = random.randint(min_year, max_year)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    return date(y, m, d)


def _random_address():
    house = random.randint(1, 300)
    road = random.randint(1, 30)
    area = random.choice(STREETS)
    return f"House {house}, Road {road}, {area}, Dhaka"


class Command(BaseCommand):
    help = "Seed database with sample Bangladeshi school data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing seed data before creating new entries",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            self.stdout.write("Flushing existing seed data …")
            TeacherProfile.objects.all().delete()
            StudentProfile.objects.all().delete()
            Section.objects.all().delete()
            Class.objects.all().delete()
            # Delete users whose username starts with seed_
            CustomUser.objects.filter(username__startswith="seed_").delete()

        self._create_classes_and_sections()
        self._create_teachers()
        self._create_students()

        self.stdout.write(self.style.SUCCESS("\n✓ Seeding complete!"))
        self.stdout.write(f"  Classes  : {Class.objects.count()}")
        self.stdout.write(f"  Sections : {Section.objects.count()}")
        self.stdout.write(f"  Teachers : {TeacherProfile.objects.count()}")
        self.stdout.write(f"  Students : {StudentProfile.objects.count()}")

    # ── Classes & Sections ────────────────────────────────────────────────

    def _create_classes_and_sections(self):
        self.stdout.write("Creating classes 9-12 with sections A, B, C …")
        academic_year = "2025-2026"
        streams = {
            "9": [""],
            "10": [""],
            "11": ["Science", "Commerce", "Arts"],
            "12": ["Science", "Commerce", "Arts"],
        }

        for grade, grade_streams in streams.items():
            for stream in grade_streams:
                cls, created = Class.objects.get_or_create(
                    name=grade,
                    stream=stream,
                    academic_year=academic_year,
                )
                if created:
                    self.stdout.write(f"  + Class {cls}")

                for sec_name in ["A", "B", "C"]:
                    sec, sec_created = Section.objects.get_or_create(
                        class_ref=cls,
                        name=sec_name,
                        defaults={"capacity": random.randint(35, 50)},
                    )
                    if sec_created:
                        self.stdout.write(f"    + Section {sec}")

    # ── Teachers ──────────────────────────────────────────────────────────

    def _create_teachers(self):
        self.stdout.write("Creating teacher profiles …")
        sections = list(Section.objects.select_related("class_ref").all())
        used_names = set()
        teacher_count = 0

        # Create ~12 teachers (one per department roughly)
        for i, dept in enumerate(DEPARTMENTS):
            # Pick a unique name
            while True:
                first = random.choice(MALE_FIRST + FEMALE_FIRST)
                last = random.choice(LAST_NAMES)
                full = f"{first} {last}"
                if full not in used_names:
                    used_names.add(full)
                    break

            username = f"seed_teacher_{i+1}"
            email = f"{first.lower()}.{last.lower()}.t{i+1}@eduvision.bd"

            if CustomUser.objects.filter(username=username).exists():
                continue

            user = CustomUser.objects.create(
                email=email,
                username=username,
                first_name=first,
                last_name=last,
                role="teacher",
            )
            user.set_password("teacher123")
            user.save()

            # Optionally assign class teacher to a section
            ct_section = None
            if sections and random.random() < 0.5:
                ct_section = random.choice(sections)

            TeacherProfile.objects.create(
                user=user,
                employee_id=f"TCH-{1000 + i}",
                department=dept,
                qualification=random.choice(QUALIFICATIONS),
                date_of_birth=_random_dob(1970, 1995),
                phone=_random_phone(),
                address=_random_address(),
                class_teacher_of=ct_section,
            )
            teacher_count += 1
            self.stdout.write(f"  + {first} {last} — {dept}")

        self.stdout.write(f"  Created {teacher_count} teachers")

    # ── Students ──────────────────────────────────────────────────────────

    def _create_students(self):
        self.stdout.write("Creating student profiles …")
        sections = list(
            Section.objects.select_related("class_ref").order_by(
                "class_ref__name", "name"
            )
        )
        used_names = set()
        student_count = 0

        for section in sections:
            # 5-8 students per section
            num_students = random.randint(5, 8)
            for j in range(num_students):
                while True:
                    is_female = random.random() < 0.5
                    first = random.choice(
                        FEMALE_FIRST if is_female else MALE_FIRST
                    )
                    last = random.choice(LAST_NAMES)
                    full = f"{first} {last}"
                    if full not in used_names:
                        used_names.add(full)
                        break

                student_count += 1
                username = f"seed_student_{student_count}"
                email = f"{first.lower()}.{last.lower()}.s{student_count}@eduvision.bd"

                if CustomUser.objects.filter(username=username).exists():
                    continue

                user = CustomUser.objects.create(
                    email=email,
                    username=username,
                    first_name=first,
                    last_name=last,
                    role="student",
                )
                user.set_password("student123")
                user.save()

                roll_prefix = section.class_ref.name + section.name
                if section.class_ref.stream:
                    stream_code = section.class_ref.stream[:3].upper()
                    roll_prefix = f"{section.class_ref.name}{stream_code}{section.name}"
                roll = f"{roll_prefix}-{str(j + 1).zfill(3)}"

                # Parent names
                father_first = random.choice(MALE_FIRST)
                mother_first = random.choice(FEMALE_FIRST)

                StudentProfile.objects.create(
                    user=user,
                    roll_number=roll,
                    section=section,
                    blood_group=random.choice(BLOOD_GROUPS),
                    date_of_birth=_random_dob(2008, 2012),
                    address=_random_address(),
                    father_name=f"{father_first} {last}",
                    father_phone=_random_phone(),
                    mother_name=f"{mother_first} {last}",
                    mother_phone=_random_phone(),
                )

            self.stdout.write(
                f"  + {section} → {num_students} students"
            )

        self.stdout.write(f"  Created {student_count} students total")
