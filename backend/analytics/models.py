from django.db import models
from django.conf import settings
from plants.models import Plant


class Favorite(models.Model):
    """User's favorite plants."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='favorites')
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'plant']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} ♥ {self.plant.scientific_name}"
