from django.contrib import admin

from .models import ChatMessage, ChatSession


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'title', 'is_archived', 'updated_at')
    list_filter = ('is_archived',)
    search_fields = ('title', 'user__username')
    inlines = [ChatMessageInline]
