from uuid import uuid4
from django.db import models
from ..authentication.models import CustomUser

class SessionRole(models.TextChoices):
    OWNER = "owner", "Owner"
    EDITOR = "editor", "Editor"
    STUDENT = "student", "Student"
    VIEWER = "viewer", "Viewer"

class WhiteboardSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="sessions"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "whiteboard_sessions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} (Owner : {self.owner.username})"
    
    def is_owner(self, user):
        return self.owner_id == user.id
    
class SessionMember(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    session = models.ForeignKey(
        WhiteboardSession, 
        on_delete=models.CASCADE,
        related_name="members"
    )
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="whiteboard_memberships"
    )
    role = models.CharField(
        max_length=10,
        choices=SessionRole.choices,
        default=SessionRole.STUDENT 
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_active_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "whiteboard_session_members"
        unique_together = [['session', 'user']]
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.user.username} as {self.role} in {self.session.name}"
    
    @classmethod
    def get_latest(cls, session):
        return cls.objects.filter(session=session)
    
class WhiteboardState(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    session = models.ForeignKey(
        WhiteboardSession,
        on_delete=models.CASCADE,
        related_name="states"
    )
    version = models.IntegerField(default=0)
    snapshot_json = models.JSONField()
    latex_objects = models.JSONField(default=dict)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete = models.SET_NULL,
        null = True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "whiteboard_states"
        unique_together = [["session", "version"]]
        ordering = ["-version"]

    def __str__(self):
        return f"{self.session.name} - Version {self.version}"
    
    @classmethod
    def get_latest(cls, session):
        return cls.objects.filter(session=session)