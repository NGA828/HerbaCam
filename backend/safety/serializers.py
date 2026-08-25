from rest_framework import serializers
from .models import SafetyInformation


class SafetySerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source='plant.scientific_name', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = SafetyInformation
        fields = ['id', 'plant', 'plant_name', 'risk_level', 'risk_level_display',
                  'precautions', 'contraindications', 'interactions', 'side_effects',
                  'pregnancy_warning', 'children_warning',
                  'dosage_concerns', 'preparation_concerns', 'general_warning',
                  'reviewer', 'is_verified', 'created_at', 'updated_at']
        read_only_fields = ['reviewer']
