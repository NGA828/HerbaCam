from rest_framework import serializers
from .models import KnowledgeSubmission, TraditionalUse, PreparationMethod


class PreparationMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreparationMethod
        fields = ['id', 'name', 'description']


class TraditionalUseSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source='plant.scientific_name', read_only=True)
    symptom_name = serializers.CharField(source='symptom.name', read_only=True)
    part_display = serializers.CharField(source='plant_part.get_part_type_display', read_only=True, default='')
    preparation_display = serializers.CharField(source='preparation.get_name_display', read_only=True, default='')
    region_name = serializers.CharField(source='region.name', read_only=True, default='')

    class Meta:
        model = TraditionalUse
        fields = ['id', 'plant', 'plant_name', 'symptom', 'symptom_name',
                  'plant_part', 'part_display', 'preparation', 'preparation_display',
                  'region', 'region_name', 'community', 'description',
                  'cultural_context', 'is_verified', 'source',
                  'contributor', 'verified_by', 'created_at']
        read_only_fields = ['is_verified', 'verified_by', 'contributor']


class KnowledgeSubmissionSerializer(serializers.ModelSerializer):
    contributor_name = serializers.CharField(source='contributor.get_full_name', read_only=True)
    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True, default='')

    class Meta:
        model = KnowledgeSubmission
        fields = ['id', 'contributor', 'contributor_name', 'status',
                  'plant', 'proposed_scientific_name', 'proposed_common_name',
                  'local_name', 'language', 'symptom', 'proposed_symptom_name',
                  'plant_part', 'preparation_method', 'traditional_use_description',
                  'cultural_context', 'region', 'community', 'community_name',
                  'supporting_information',
                  'reviewer', 'reviewer_name', 'review_comments', 'review_reason', 'review_date',
                  'submitted_at', 'created_at', 'updated_at']
        read_only_fields = ['contributor', 'status', 'reviewer', 'review_comments',
                           'review_reason', 'review_date', 'submitted_at']


class KnowledgeReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approve', 'reject', 'request_revision'])
    comments = serializers.CharField(required=False, allow_blank=True, default='')
    reason = serializers.CharField(required=False, allow_blank=True, default='')
