from django.db import models
from django.conf import settings
from plants.models import Plant


class Identification(models.Model):
    """Plant identification request via AI."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='identifications')
    image = models.ImageField(upload_to='identifications/')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"ID#{self.pk} by {self.user.username} ({self.status})"


class IdentificationResult(models.Model):
    """AI identification result."""
    identification = models.ForeignKey(Identification, on_delete=models.CASCADE,
                                        related_name='results')
    plant = models.ForeignKey(Plant, on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='identification_results')
    scientific_name = models.CharField(max_length=255)
    common_name = models.CharField(max_length=255, blank=True, default='')
    confidence = models.FloatField(help_text='Confidence score 0-1')
    is_primary = models.BooleanField(default=False, help_text='Primary identification result')
    ai_raw_response = models.JSONField(null=True, blank=True, help_text='Raw AI response for debugging')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-confidence']

    def __str__(self):
        return f"{self.scientific_name} ({self.confidence:.0%})"


class IdentificationReport(models.Model):
    """User report of incorrect identification."""
    identification = models.ForeignKey(Identification, on_delete=models.CASCADE,
                                        related_name='reports')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Report on ID#{self.identification_id} by {self.user.username}"
