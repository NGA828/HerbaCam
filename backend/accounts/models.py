from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user model with role-based access control."""

    class Role(models.TextChoices):
        USER = 'USER', 'Registered User'
        PRACTITIONER = 'PRACTITIONER', 'Traditional Medicine Practitioner'
        EXPERT = 'EXPERT', 'Expert / Reviewer'
        ADMIN = 'ADMIN', 'Administrator'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    bio = models.TextField(blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_joined']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    @property
    def is_practitioner(self):
        return self.role == self.Role.PRACTITIONER

    @property
    def is_expert(self):
        return self.role == self.Role.EXPERT

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN


class SystemSetting(models.Model):
    """Non-secret platform configuration. Credentials must never be stored here."""
    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['key']
