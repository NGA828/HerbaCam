from django.db import models


class Symptom(models.Model):
    """Symptoms that traditional medicine addresses."""
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='',
                                 help_text='e.g., Respiratory, Digestive, Skin')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
