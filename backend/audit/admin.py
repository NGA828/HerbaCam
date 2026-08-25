from django.contrib import admin
from .models import AuditLog
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'target_type', 'created_at']
    list_filter = ['action']
    readonly_fields = ['user', 'action', 'description', 'target_type', 'target_id', 'metadata', 'ip_address', 'created_at']
