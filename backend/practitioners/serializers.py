from rest_framework import serializers
from .models import PractitionerProfile


class PractitionerProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    region_name = serializers.CharField(source='region.name', read_only=True, default='')

    class Meta:
        model = PractitionerProfile
        fields = ['id', 'user', 'username', 'full_name', 'region', 'region_name',
                  'community_name', 'years_of_experience', 'areas_of_knowledge',
                  'traditional_training', 'is_verified', 'created_at', 'updated_at']
        read_only_fields = ['user', 'is_verified']

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username
