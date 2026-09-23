from rest_framework import serializers

from .models import ChatMessage, ChatSession


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'cited_plant_ids', 'created_at']
        read_only_fields = fields


class ChatSessionSerializer(serializers.ModelSerializer):
    display_title = serializers.CharField(read_only=True)
    message_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ChatSession
        fields = ['id', 'title', 'display_title', 'is_archived', 'message_count',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return ChatSession.objects.create(**validated_data)


class AskSerializer(serializers.Serializer):
    """Input for one turn. Omit ``session`` to start a new conversation."""

    message = serializers.CharField(required=True, max_length=2000)
    session = serializers.IntegerField(required=False, allow_null=True)

    def validate_session(self, value):
        if value in (None, ''):
            return None
        return value
