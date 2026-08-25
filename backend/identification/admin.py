from django.contrib import admin
from .models import Identification, IdentificationResult, IdentificationReport
@admin.register(Identification)
class IdentificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'created_at']
    list_filter = ['status']
@admin.register(IdentificationResult)
class ResultAdmin(admin.ModelAdmin):
    list_display = ['identification', 'scientific_name', 'confidence', 'is_primary']
@admin.register(IdentificationReport)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['identification', 'user', 'created_at']
