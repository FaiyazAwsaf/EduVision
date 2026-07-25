import pytest


@pytest.mark.django_db
def test_health_endpoint_returns_healthy_status(api_client):
    response = api_client.get("/api/health/")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["service"] == "eduvision-backend"


@pytest.mark.django_db
def test_api_root_lists_main_endpoints(api_client):
    response = api_client.get("/")

    assert response.status_code == 200
    assert response.json()["name"] == "EduVision API"
    assert "evaluation" in response.json()["endpoints"]
