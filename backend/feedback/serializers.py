from rest_framework import serializers

from .models import Feedback


class FeedbackSerializer(serializers.ModelSerializer):
    """Read/write shape for a feedback note.

    Status and reply fields are administrator-only: they are exposed for
    reading but stripped from writes, so a user cannot resolve their own
    ticket.
    """

    user_name = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Feedback
        fields = ['id', 'user', 'user_name', 'category', 'category_display', 'message',
                  'rating', 'page', 'status', 'status_display', 'admin_response',
                  'resolved_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'resolved_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class FeedbackAdminSerializer(FeedbackSerializer):
    """Widens the writable set for the administrator triage view."""

    class Meta(FeedbackSerializer.Meta):
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
