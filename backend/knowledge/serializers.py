from rest_framework import serializers
from .models import KnowledgeSubmission, TraditionalUse, PreparationMethod


class PreparationMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreparationMethod
        fields = ['id', 'name', 'description']


class TraditionalUseSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source='plant.scientific_name', read_only=True)
    plant_common_name = serializers.CharField(source='plant.common_name', read_only=True, default='')
    plant_image = serializers.SerializerMethodField()
    symptom_name = serializers.CharField(source='symptom.name', read_only=True)
    part_display = serializers.CharField(source='plant_part.get_part_type_display', read_only=True, default='')
    preparation_display = serializers.CharField(source='preparation.get_name_display', read_only=True, default='')
    region_name = serializers.CharField(source='region.name', read_only=True, default='')

    class Meta:
        model = TraditionalUse
        fields = ['id', 'plant', 'plant_name', 'plant_common_name', 'plant_image',
                  'symptom', 'symptom_name',
                  'plant_part', 'part_display', 'preparation', 'preparation_display',
                  'region', 'region_name', 'community', 'description',
                  'dosage', 'frequency', 'duration', 'administration',
                  'cultural_context', 'is_verified', 'source',
                  'contributor', 'verified_by', 'created_at']
        read_only_fields = ['is_verified', 'verified_by', 'contributor']

    def get_plant_image(self, obj):
        # Real database photo of THIS plant, so the UI never has to guess
        # which picture belongs to the name (guessing causes mismatches).
        try:
            if obj.plant and obj.plant.image:
                request = self.context.get('request')
                url = obj.plant.image.url
                return request.build_absolute_uri(url) if request else url
        except (ValueError, AttributeError):
            pass
        return None


class KnowledgeSubmissionSerializer(serializers.ModelSerializer):
    contributor_name = serializers.CharField(source='contributor.get_full_name', read_only=True)
    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True, default='')
    plant_name = serializers.SerializerMethodField()
    region_name = serializers.CharField(source='region.name', read_only=True, default='')
    symptom_name = serializers.CharField(source='symptom.name', read_only=True, default='')
    preparation_method_name = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSubmission
        fields = ['id', 'contributor', 'contributor_name', 'status',
                  'plant', 'plant_name', 'proposed_scientific_name', 'proposed_common_name',
                  'local_name', 'language', 'symptom', 'symptom_name', 'proposed_symptom_name',
                  'plant_part', 'preparation_method', 'preparation_method_name',
                  'traditional_use_description',
                  'dosage', 'frequency', 'duration', 'administration',
                  'cultural_context', 'region', 'region_name', 'community', 'community_name',
                  'supporting_information',
                  'reviewer', 'reviewer_name', 'review_comments', 'review_reason', 'review_date',
                  'submitted_at', 'created_at', 'updated_at']
        read_only_fields = ['contributor', 'status', 'reviewer', 'review_comments',
                           'review_reason', 'review_date', 'submitted_at']

    def get_plant_name(self, obj):
        if obj.plant:
            return obj.plant.scientific_name
        return obj.proposed_scientific_name or ''

    def get_preparation_method_name(self, obj):
        return obj.preparation_method or ''


class KnowledgeReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject', 'request_revision'])
    comments = serializers.CharField(required=False, allow_blank=True, default='')
    reason = serializers.CharField(required=False, allow_blank=True, default='')
