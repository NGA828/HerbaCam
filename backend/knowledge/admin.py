from django.contrib import admin
from .models import TraditionalUse, KnowledgeSubmission, PreparationMethod


@admin.register(PreparationMethod)
class PreparationMethodAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']


@admin.register(TraditionalUse)
class TraditionalUseAdmin(admin.ModelAdmin):
    list_display = ['plant', 'symptom', 'region', 'dosage', 'frequency', 'is_verified', 'contributor']
    list_filter = ['is_verified', 'region']
    search_fields = ['plant__scientific_name', 'symptom__name', 'description']
    fieldsets = (
        (None, {'fields': ('plant', 'symptom', 'plant_part', 'preparation', 'region', 'community')}),
        ('Traditional use', {'fields': ('description', 'cultural_context')}),
        ('Traditionally reported dosage (educational record, not a prescription)',
         {'fields': ('dosage', 'frequency', 'duration', 'administration')}),
        ('Verification', {'fields': ('is_verified', 'source', 'contributor', 'verified_by')}),
    )


@admin.register(KnowledgeSubmission)
class KnowledgeSubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'contributor', 'status', 'plant', 'dosage', 'created_at']
    list_filter = ['status']
    search_fields = ['traditional_use_description', 'proposed_scientific_name']
    fieldsets = (
        (None, {'fields': ('contributor', 'status', 'plant', 'proposed_scientific_name',
                            'proposed_common_name', 'local_name', 'language')}),
        ('Use & preparation', {'fields': ('symptom', 'proposed_symptom_name', 'plant_part',
                                          'preparation_method', 'traditional_use_description')}),
        ('Practitioner-reported dosage', {'fields': ('dosage', 'frequency', 'duration', 'administration')}),
        ('Context', {'fields': ('cultural_context', 'region', 'community', 'community_name',
                                'supporting_information')}),
        ('Review', {'fields': ('reviewer', 'review_comments', 'review_reason', 'review_date',
                               'submitted_at')}),
    )
