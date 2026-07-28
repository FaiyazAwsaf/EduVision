import pytest

from apps.authentication.serializers import (
    RegisterSerializer,
    ChangePasswordSerializer,
)
from apps.authentication.models import CustomUser


# Checks that registering saves the user with the password hashed, not stored as plain text.
@pytest.mark.django_db
def test_register_creates_a_user_with_a_hashed_password():
    serializer = RegisterSerializer(data={
        "username": "student",
        "email": "student@example.com",
        "first_name": "New",
        "last_name": "Student",
        "password": "pass1234",
        "password_confirm": "pass1234",
    })

    assert serializer.is_valid()
    user = serializer.save()

    assert isinstance(user, CustomUser)
    assert user.password != "pass1234"
    assert user.check_password("pass1234")


# Checks that registration fails if password and password_confirm don't match.
def test_register_rejects_mismatched_passwords():
    serializer = RegisterSerializer(data={
        "username": "student",
        "email": "student@example.com",
        "first_name": "New",
        "last_name": "Student",
        "password": "pass1234",
        "password_confirm": "pass5678",
    })

    assert serializer.is_valid() is False


# Checks that registration fails if the password is too short.
def test_register_rejects_a_short_password():
    serializer = RegisterSerializer(data={
        "username": "student",
        "email": "student@example.com",
        "first_name": "New",
        "last_name": "Student",
        "password": "pass",
        "password_confirm": "pass",
    })

    assert serializer.is_valid() is False


# Checks that a well-formed change-password request (matching new passwords, different from the current one) is accepted.
def test_change_password_accepts_a_valid_payload():
    serializer = ChangePasswordSerializer(data={
        "current_password": "pass1234",
        "new_password": "NewPass456",
        "new_password_confirm": "NewPass456",
    })

    assert serializer.is_valid()


# Checks that changing password fails if new_password and new_password_confirm don't match.
def test_change_password_rejects_mismatched_new_passwords():
    serializer = ChangePasswordSerializer(data={
        "current_password": "pass1234",
        "new_password": "NewPass456",
        "new_password_confirm": "different",
    })

    assert serializer.is_valid() is False


# Checks that changing password fails if the "new" password is the same as the current one.
def test_change_password_serializer_rejects_reusing_the_current_password():
    serializer = ChangePasswordSerializer(data={
        "current_password": "pass1234",
        "new_password": "pass1234",
        "new_password_confirm": "pass1234",
    })

    assert serializer.is_valid() is False
