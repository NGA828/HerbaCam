from django.contrib import admin
from .models import SafetyInformation
@admin.register(SafetyInformation)
class SafetyAdmin(admin.ModelAdmin):
    list_display = ['plant', 'risk_level', 'is_verified', 'reviewer']
    list_filter = ['risk_level', 'is_verified']
