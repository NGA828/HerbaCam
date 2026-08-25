from rest_framework import serializers
from .models import Identification, IdentificationResult, IdentificationReport


class IdentificationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = IdentificationResult
        fields = ['id', 'plant', 'scientific_name', 'common_name', 'confidence', 'is_primary', 'created_at']


class IdentificationSerializer(serializers.ModelSerializer):
    results = IdentificationResultSerializer(many=True, read_only=True)

    class Meta:
        model = Identification
        fields = ['id', 'image', 'status', 'results', 'created_at']
        read_only_fields = ['status', 'created_at']


class IdentificationListSerializer(serializers.ModelSerializer):
    primary_result = serializers.SerializerMethodField()

    class Meta:
        model = Identification
        fields = ['id', 'image', 'status', 'primary_result', 'created_at']

    def get_primary_result(self, obj):
        primary = obj.results.filter(is_primary=True).first()
        if primary:
            return IdentificationResultSerializer(primary).data
        return None


class IdentificationReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = IdentificationReport
        fields = ['id', 'identification', 'reason', 'created_at']
        read_only_fields = ['created_at']
