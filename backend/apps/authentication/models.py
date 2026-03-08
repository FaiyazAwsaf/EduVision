from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import AbstractUser
from uuid import uuid4
from django.utils import timezone
from datetime import timedelta

# Create your models here.
class UserRole(models.TextChoices):
    ADMIN = "admin", "Admin"
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"

class CustomUser(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    role = models.CharField(max_length=10, choices=UserRole.choices, default=UserRole.STUDENT, db_index=True)

    def __str__(self):
        return self.username
    
    class Meta:
        db_table = "authentication_user"
