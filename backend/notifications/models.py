from django.db import models
from django.conf import settings


class Notification(models.Model):
    """User notifications."""

    class Type(models.TextChoices):
        IDENTIFICATION_READY = 'IDENTIFICATION_READY', 'Identification Complete'
        SUBMISSION_APPROVED = 'SUBMISSION_APPROVED', 'Submission Approved'
        SUBMISSION_REJECTED = 'SUBMISSION_REJECTED', 'Submission Rejected'
        SUBMISSION_REVISION = 'SUBMISSION_REVISION', 'Revision Requested'
        NEW_REVIEW = 'NEW_REVIEW', 'New Submission to Review'
        SYSTEM = 'SYSTEM', 'System Notification'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='notifications')
    type = models.CharField(max_length=30, choices=Type.choices)
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    related_object_type = models.CharField(max_length=50, blank=True, default='')
    related_object_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} → {self.user.username}"
