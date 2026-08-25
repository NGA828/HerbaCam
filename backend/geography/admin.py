from django.contrib import admin
from .models import Region, Division, Subdivision, Community

@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'latitude', 'longitude']

@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ['name', 'region']
    list_filter = ['region']

@admin.register(Subdivision)
class SubdivisionAdmin(admin.ModelAdmin):
    list_display = ['name', 'division']

@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = ['name', 'region']
    list_filter = ['region']
