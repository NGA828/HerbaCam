from django.db import models
from geography.models import Region, Community


class Plant(models.Model):
    """Medicinal plant record."""

    class Habitat(models.TextChoices):
        FOREST = 'FOREST', 'Forest'
        SAVANNA = 'SAVANNA', 'Savanna'
        MOUNTAIN = 'MOUNTAIN', 'Mountain'
        WETLAND = 'WETLAND', 'Wetland'
        COASTAL = 'COASTAL', 'Coastal'
        URBAN = 'URBAN', 'Urban'

    scientific_name = models.CharField(max_length=255, unique=True)
    common_name = models.CharField(max_length=255, blank=True, default='')
    family = models.CharField(max_length=100, blank=True, default='')
    genus = models.CharField(max_length=100, blank=True, default='')
    description = models.TextField(blank=True, default='')
    habitat = models.CharField(max_length=20, choices=Habitat.choices, blank=True, default='')
    image = models.ImageField(upload_to='plants/', blank=True, null=True)
    image_credit = models.CharField(max_length=255, blank=True, default='')
    regions = models.ManyToManyField(Region, blank=True, related_name='plants')
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scientific_name']

    def __str__(self):
        return self.scientific_name


class PlantLocalName(models.Model):
    """Local names for plants in different languages/communities."""
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='local_names')
    name = models.CharField(max_length=255)
    language = models.CharField(max_length=100, blank=True, default='')
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True)
    community = models.ForeignKey(Community, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.plant.scientific_name})"


class PlantPart(models.Model):
    """Plant parts used in traditional medicine."""

    class PartType(models.TextChoices):
        LEAF = 'LEAF', 'Leaf'
        ROOT = 'ROOT', 'Root'
        BARK = 'BARK', 'Bark'
        STEM = 'STEM', 'Stem'
        FLOWER = 'FLOWER', 'Flower'
        FRUIT = 'FRUIT', 'Fruit'
        SEED = 'SEED', 'Seed'
        TUBER = 'TUBER', 'Tuber'
        WHOLE = 'WHOLE', 'Whole Plant'
        SAP = 'SAP', 'Sap/Latex'
        OTHER = 'OTHER', 'Other'

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='parts')
    part_type = models.CharField(max_length=20, choices=PartType.choices)
    description = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['part_type']
        unique_together = ['plant', 'part_type']

    def __str__(self):
        return f"{self.get_part_type_display()} of {self.plant.scientific_name}"
