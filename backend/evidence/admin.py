from django.contrib import admin
from .models import Evidence
@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ['plant', 'level', 'reviewer', 'created_at']
    list_filter = ['level']
