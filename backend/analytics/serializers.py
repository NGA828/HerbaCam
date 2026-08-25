from rest_framework import serializers
from .models import Favorite
from plants.serializers import PlantListSerializer


class FavoriteSerializer(serializers.ModelSerializer):
    plant_detail = PlantListSerializer(source='plant', read_only=True)

    class Meta:
        model = Favorite
        fields = ['id', 'plant', 'plant_detail', 'created_at']
        read_only_fields = ['created_at']
