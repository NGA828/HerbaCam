from rest_framework import serializers
from .models import Region, Division, Subdivision, Community


class CommunitySerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = Community
        fields = ['id', 'name', 'subdivision', 'region', 'region_name', 'description']


class SubdivisionSerializer(serializers.ModelSerializer):
    communities = CommunitySerializer(many=True, read_only=True)

    class Meta:
        model = Subdivision
        fields = ['id', 'name', 'division', 'description', 'communities']


class DivisionSerializer(serializers.ModelSerializer):
    subdivisions = SubdivisionSerializer(many=True, read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = Division
        fields = ['id', 'name', 'region', 'region_name', 'description', 'subdivisions']


class RegionSerializer(serializers.ModelSerializer):
    divisions = DivisionSerializer(many=True, read_only=True)

    class Meta:
        model = Region
        fields = ['id', 'name', 'code', 'description', 'latitude', 'longitude', 'divisions']


class RegionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ['id', 'name', 'code', 'latitude', 'longitude']
