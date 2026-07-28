import pytest

from apps.authentication.models import CustomUser


# Checks that an admin is blocked from deleting their own account through the admin API.
@pytest.mark.django_db
def test_auth_005_admin_cannot_delete_their_own_account(api_client):
    admin_user = CustomUser.objects.create_user(
        username="selfdelete",
        email="selfdelete@example.com",
        password="AdminPass123",
        role="admin",
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.delete(f"/api/auth/admin/users/{admin_user.id}/")

    assert response.status_code == 400
    assert CustomUser.objects.filter(id=admin_user.id).exists()
