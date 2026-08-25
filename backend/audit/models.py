from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """Audit log for important system actions."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                              null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=100)
    description = models.TextField()
    target_type = models.CharField(max_length=50, blank=True, default='')
    target_id = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        user_str = self.user.username if self.user else 'System'
        return f"{self.action} by {user_str} at {self.created_at}"
