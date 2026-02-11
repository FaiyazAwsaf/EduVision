from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from uuid import uuid4

# Create your models here.
class UserRole(models.TextChoices):
    TEACHER = "teacher", "Teacher"
    STUDENT = "student", "Student"

class CustomUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=20, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    password_hash = models.CharField(max_length=255, null=True)
    is_active = models.BooleanField(default=True)
    role = models.CharField(max_length=10, choices=UserRole.choices, default=UserRole.STUDENT, db_index=True)
    date_joined = models.DateField(auto_now_add=True)

    def __str__(self):
        return self.username
    
    def set_password(self, password_raw):
        self.password_hash = make_password(password_raw)
    
    def verify_password(self, password_raw):
        hashed = check_password(password_raw, self.password_hash)
        return hashed
    
    @property
    def is_authenticated(self):
        """Required by DRF's IsAuthenticated permission."""
        return True
    
    @property
    def is_anonymous(self):
        """Required by Django's auth framework."""
        return False
    
    class Meta:
        db_table = "authentication_user"

