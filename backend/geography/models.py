from django.db import models


class Region(models.Model):
    """Cameroon administrative regions."""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, blank=True, default='')
    description = models.TextField(blank=True, default='')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Division(models.Model):
    """Divisions within regions."""
    name = models.CharField(max_length=100)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='divisions')
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['name']
        unique_together = ['name', 'region']

    def __str__(self):
        return f"{self.name} ({self.region.name})"


class Subdivision(models.Model):
    """Subdivisions within divisions."""
    name = models.CharField(max_length=100)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name='subdivisions')
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.division.name})"


class Community(models.Model):
    """Local communities."""
    name = models.CharField(max_length=150)
    subdivision = models.ForeignKey(Subdivision, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='communities')
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='communities')
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'communities'

    def __str__(self):
        return f"{self.name} ({self.region.name})"
