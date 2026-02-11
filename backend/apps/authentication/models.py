from django.db import models
from django.contrib.auth.hashers import make_password, check_password
from uuid import uuid4
from django.utils import timezone
from datetime import timedelta

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
    is_active = models.BooleanField(default=False)
    role = models.CharField(max_length=10, choices=UserRole.choices, default=UserRole.STUDENT, db_index=True)
    date_joined = models.DateField(auto_now_add=True)

    def __str__(self):
        return self.username
    
    def set_password(self, password_raw):
        self.password_hash = make_password(password_raw)
    
    def verify_password(self, password_raw):
        hashed = check_password(password_raw, self.password_hash)
        return hashed
    
    class Meta:
        db_table = "authentication_user"

class EmailOTP(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="otps")
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=10)
        return super().save(*args, **kwargs)
    
    def is_valid(self):
        valid = (not self.is_used) and (self.expires_at > timezone.now())
        return valid
    
    def __str__(self):
        return f"OTP for {self.user.email} ({self.created_at})"