from rest_framework import serializers
from .models import Symptom


class SymptomSerializer(serializers.ModelSerializer):
    traditional_uses_count = serializers.SerializerMethodField()

    class Meta:
        model = Symptom
        fields = ['id', 'name', 'description', 'category', 'traditional_uses_count']

    def get_traditional_uses_count(self, obj):
        return obj.traditional_uses.count()
