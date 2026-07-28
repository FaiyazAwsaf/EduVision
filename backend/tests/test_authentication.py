import pytest

from apps.authentication.models import CustomUser


# Checks that hitting the register endpoint creates a student.
@pytest.mark.django_db
def test_register_creates_a_student_user(api_client):
    response = api_client.post(
        "/api/auth/register/",
        {
            "username": "student",
            "email": "student@example.com",
            "first_name": "New",
            "last_name": "Student",
            "password": "pass1234",
            "password_confirm": "pass1234",
        },
        format="json",
    )

    assert response.status_code == 201
    assert CustomUser.objects.filter(username="student").exists()
    assert response.json()["payload"]["role"] == "student"


# Checks that the register endpoint rejects the request when passwords don't match.
@pytest.mark.django_db
def test_register_rejects_mismatched_passwords(api_client):
    response = api_client.post(
        "/api/auth/register/",
        {
            "username": "student",
            "email": "student@example.com",
            "first_name": "Wrong",
            "last_name": "Password",
            "password": "pass1234",
            "password_confirm": "different1234",
        },
        format="json",
    )

    assert response.status_code == 400
    assert not CustomUser.objects.filter(username="student").exists()


# Checks that logging in with correct credentials returns an access token and sets a refresh-token cookie.
@pytest.mark.django_db
def test_login_returns_an_access_token_and_refresh_cookie(api_client, student_user):
    response = api_client.post(
        "/api/auth/login/",
        {"username": student_user.username, "password": "pass1234"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["payload"]["access_token"]
    assert "refresh_token" in response.cookies