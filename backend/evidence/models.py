from django.db import models
from plants.models import Plant
from django.conf import settings


class Evidence(models.Model):
    """Scientific evidence records for plants."""

    class Level(models.TextChoices):
        INSUFFICIENT = 'INSUFFICIENT', 'Insufficient'
        PRELIMINARY = 'PRELIMINARY', 'Preliminary'
        MODERATE = 'MODERATE', 'Moderate'
        STRONG = 'STRONG', 'Strong'

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='evidence_records')
    level = models.CharField(max_length=20, choices=Level.choices)
    summary = models.TextField(help_text='Summary of the evidence')
    source = models.CharField(max_length=500, help_text='Source/publication reference')
    reference_url = models.URLField(blank=True, default='')
    publication_date = models.DateField(null=True, blank=True)
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name='evidence_reviewed')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'evidence records'

    def __str__(self):
        return f"{self.plant.scientific_name} - {self.get_level_display()}"
