from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'username', 'action', 'description',
                  'target_type', 'target_id', 'metadata', 'created_at']

    def get_username(self, obj):
        return obj.user.username if obj.user else 'System'
