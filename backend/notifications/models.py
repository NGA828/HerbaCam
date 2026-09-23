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
        APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED', 'New Consultation Request'
        APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED', 'Consultation Confirmed'
        APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED', 'Consultation Cancelled'
        APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED', 'Consultation Completed'
        APPOINTMENT_NO_SHOW = 'APPOINTMENT_NO_SHOW', 'Consultation No-Show'
        NEW_MESSAGE = 'NEW_MESSAGE', 'New Message'
        FEEDBACK_REPLY = 'FEEDBACK_REPLY', 'Reply to your feedback'
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
