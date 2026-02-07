from django.db import models
from uuid import uuid4

# Create your models here.
class UserRole(models.TextChoices):
    TEACHER = "Teacher", "teacher"
    STUDENT = "Student", "student"

class CustomUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    is_active = models.BooleanField(default=False)
    role = models.CharField(max_length=10, choices=UserRole.choices, default=UserRole.STUDENT, db_index=True)
    date_joined = models.DateField(auto_now_add=True)

    def __str__(self):
        return self.username
    
    class Meta:
        db_table = "authentication_user"
