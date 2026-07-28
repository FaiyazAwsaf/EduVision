import pytest
from django.db import IntegrityError

from apps.students.models import Class as SchoolClass, Section, Subject


# Checks that creating a Class saves the name, stream, and academic year as given.
@pytest.mark.django_db
def test_creating_a_class_stores_the_given_fields():
    school_class = SchoolClass.objects.create(
        name="10", stream="Science", academic_year="2026-2027"
    )

    assert school_class.name == "10"
    assert school_class.stream == "Science"
    assert school_class.academic_year == "2026-2027"


# Checks that printing a Class shows its name, stream, and year (e.g. "10 - Science (2026-2027)").
@pytest.mark.django_db
def test_class_string_representation_includes_stream_and_year():
    school_class = SchoolClass.objects.create(
        name="10", stream="Science", academic_year="2026-2027"
    )

    assert str(school_class) == "10 - Science (2026-2027)"


# Checks that a new Section defaults to a capacity of 40 when none is given.
@pytest.mark.django_db
def test_section_default_capacity_is_forty():
    school_class = SchoolClass.objects.create(
        name="9", academic_year="2026-2027"
    )
    section = Section.objects.create(class_ref=school_class, name="A")

    assert section.capacity == 40


# Checks that two sections can't share the same name within the same class (e.g. two "A" sections in Class 9).
@pytest.mark.django_db
def test_cannot_create_two_sections_with_the_same_name_in_one_class():
    school_class = SchoolClass.objects.create(
        name="9", academic_year="2026-2027"
    )
    Section.objects.create(class_ref=school_class, name="A")

    with pytest.raises(IntegrityError):
        Section.objects.create(class_ref=school_class, name="A")


# Checks that printing a Subject shows its name and code (e.g. "Mathematics (MATH)").
@pytest.mark.django_db
def test_subject_string_representation_includes_code():
    subject = Subject.objects.create(name="Mathematics", code="MATH")

    assert str(subject) == "Mathematics (MATH)"


# Checks that a teaching assignment correctly links together a teacher, a subject, and a section.
@pytest.mark.django_db
def test_teaching_assignment_links_teacher_subject_and_section(teaching_assignment):
    assert teaching_assignment.teacher.role == "teacher"
    assert teaching_assignment.subject.name == "Mathematics"
    assert teaching_assignment.section.name == "A"
