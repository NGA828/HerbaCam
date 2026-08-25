from rest_framework import generics, permissions
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    """Admin: view audit logs."""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_admin_role or user.is_superuser):
            return AuditLog.objects.none()
        
        qs = AuditLog.objects.select_related('user')
        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action__icontains=action)
        return qs
