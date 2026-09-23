from django.contrib import admin

from .models import Feedback


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'category', 'status', 'rating', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('message', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'resolved_at')
