from django.contrib import admin
from .models import RiskAssessment
@admin.register(RiskAssessment)
class RiskAdmin(admin.ModelAdmin):
    list_display = ['plant', 'region', 'risk_score', 'risk_level', 'calculated_at']
    list_filter = ['risk_level']
