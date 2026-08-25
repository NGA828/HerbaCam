from django.db import models
from plants.models import Plant
from geography.models import Region


class RiskAssessment(models.Model):
    """Preservation risk assessment for traditional knowledge."""

    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Low'
        MODERATE = 'MODERATE', 'Moderate'
        HIGH = 'HIGH', 'High'

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='risk_assessments',
                               null=True, blank=True)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='risk_assessments',
                                null=True, blank=True)

    risk_score = models.FloatField(help_text='Risk score 0-100')
    risk_level = models.CharField(max_length=20, choices=RiskLevel.choices)

    # Component scores (for transparency)
    contributor_scarcity_score = models.FloatField(default=0)
    knowledge_recency_score = models.FloatField(default=0)
    geographic_concentration_score = models.FloatField(default=0)
    documentation_scarcity_score = models.FloatField(default=0)
    submission_decline_score = models.FloatField(default=0)

    # Statistics
    total_contributors = models.IntegerField(default=0)
    total_traditional_uses = models.IntegerField(default=0)
    days_since_last_contribution = models.IntegerField(default=0)
    unique_regions_count = models.IntegerField(default=0)

    calculated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-risk_score']

    def __str__(self):
        target = self.plant or self.region or 'General'
        return f"Risk: {target} ({self.risk_level} - {self.risk_score:.0f})"
