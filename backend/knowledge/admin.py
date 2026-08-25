from django.contrib import admin
from .models import TraditionalUse, KnowledgeSubmission, PreparationMethod

@admin.register(PreparationMethod)
class PreparationMethodAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']

@admin.register(TraditionalUse)
class TraditionalUseAdmin(admin.ModelAdmin):
    list_display = ['plant', 'symptom', 'region', 'is_verified', 'contributor']
    list_filter = ['is_verified', 'region']

@admin.register(KnowledgeSubmission)
class KnowledgeSubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'contributor', 'status', 'plant', 'created_at']
    list_filter = ['status']
