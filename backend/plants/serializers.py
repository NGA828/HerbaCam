from rest_framework import serializers
from .models import Plant, PlantLocalName, PlantPart


class PlantLocalNameSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source='region.name', read_only=True, default='')

    class Meta:
        model = PlantLocalName
        fields = ['id', 'name', 'language', 'region', 'region_name', 'community', 'notes']


class PlantPartSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantPart
        fields = ['id', 'part_type', 'description']


class PlantListSerializer(serializers.ModelSerializer):
    local_names = PlantLocalNameSerializer(many=True, read_only=True)
    regions_count = serializers.IntegerField(source='regions.count', read_only=True, default=0)

    class Meta:
        model = Plant
        fields = ['id', 'scientific_name', 'common_name', 'family', 'image',
                  'habitat', 'local_names', 'regions_count']


class PlantDetailSerializer(serializers.ModelSerializer):
    local_names = PlantLocalNameSerializer(many=True, read_only=True)
    parts = PlantPartSerializer(many=True, read_only=True)
    region_names = serializers.ListField(
        source='regions.all', read_only=True,
        child=serializers.CharField()
    )

    class Meta:
        model = Plant
        fields = ['id', 'scientific_name', 'common_name', 'family', 'genus',
                  'description', 'habitat', 'image', 'image_credit',
                  'local_names', 'parts', 'region_names',
                  'is_published', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['region_names'] = [r.name for r in instance.regions.all()]
        return data


class PlantAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plant
        fields = '__all__'
