from rest_framework import generics, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer
from accounts.permissions import IsAdministrator


class AuditLogListView(generics.ListAPIView):
    """Admin: view audit logs."""
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user')
        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action__icontains=action)
        return qs
