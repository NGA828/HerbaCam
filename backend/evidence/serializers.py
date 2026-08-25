from rest_framework import serializers
from .models import Evidence


class EvidenceSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source='plant.scientific_name', read_only=True)
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = Evidence
        fields = ['id', 'plant', 'plant_name', 'level', 'level_display',
                  'summary', 'source', 'reference_url', 'publication_date',
                  'reviewer', 'created_at', 'updated_at']
        read_only_fields = ['reviewer']
