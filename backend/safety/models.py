from django.db import models
from plants.models import Plant
from django.conf import settings


class SafetyInformation(models.Model):
    """Safety information for medicinal plants."""

    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Low Risk'
        MODERATE = 'MODERATE', 'Moderate Risk'
        HIGH = 'HIGH', 'High Risk'
        UNKNOWN = 'UNKNOWN', 'Unknown'

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='safety_records')
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices, default=RiskLevel.UNKNOWN)
    precautions = models.TextField(blank=True, default='', help_text='General precautions')
    contraindications = models.TextField(blank=True, default='',
                                          help_text='Conditions where use is not recommended')
    interactions = models.TextField(blank=True, default='',
                                     help_text='Known drug/herb interactions')
    side_effects = models.TextField(blank=True, default='', help_text='Known side effects')
    pregnancy_warning = models.BooleanField(default=False)
    children_warning = models.BooleanField(default=False)
    dosage_concerns = models.TextField(blank=True, default='')
    preparation_concerns = models.TextField(blank=True, default='')
    general_warning = models.TextField(blank=True, default='')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name='safety_reviewed')
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'safety information records'

    def __str__(self):
        return f"{self.plant.scientific_name} - Safety ({self.get_risk_level_display()})"
