from django.contrib import admin
from .models import Plant, PlantLocalName, PlantPart

@admin.register(Plant)
class PlantAdmin(admin.ModelAdmin):
    list_display = ['scientific_name', 'common_name', 'family', 'habitat', 'is_published']
    list_filter = ['family', 'habitat', 'is_published']
    search_fields = ['scientific_name', 'common_name']
    filter_horizontal = ['regions']

@admin.register(PlantLocalName)
class PlantLocalNameAdmin(admin.ModelAdmin):
    list_display = ['name', 'plant', 'language', 'region']

@admin.register(PlantPart)
class PlantPartAdmin(admin.ModelAdmin):
    list_display = ['plant', 'part_type']
