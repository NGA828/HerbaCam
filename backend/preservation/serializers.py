from rest_framework import serializers
from .models import RiskAssessment


class RiskAssessmentSerializer(serializers.ModelSerializer):
    plant_name = serializers.SerializerMethodField()
    region_name = serializers.SerializerMethodField()
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = RiskAssessment
        fields = ['id', 'plant', 'plant_name', 'region', 'region_name',
                  'risk_score', 'risk_level', 'risk_level_display',
                  'contributor_scarcity_score', 'knowledge_recency_score',
                  'geographic_concentration_score', 'documentation_scarcity_score',
                  'submission_decline_score',
                  'total_contributors', 'total_traditional_uses',
                  'days_since_last_contribution', 'unique_regions_count',
                  'calculated_at']

    def get_plant_name(self, obj):
        return obj.plant.scientific_name if obj.plant else None

    def get_region_name(self, obj):
        return obj.region.name if obj.region else None
