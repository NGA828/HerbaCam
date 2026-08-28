from rest_framework import generics, permissions
from .models import Evidence
from .serializers import EvidenceSerializer


class IsExpertOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.is_expert or request.user.is_admin_role or request.user.is_superuser
        )


class EvidenceListView(generics.ListAPIView):
    """List evidence records."""
    serializer_class = EvidenceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Evidence.objects.select_related('plant')
        plant = self.request.query_params.get('plant')
        if plant:
            qs = qs.filter(plant_id=plant)
        level = self.request.query_params.get('level')
        if level:
            qs = qs.filter(level=level)
        return qs


class EvidenceDetailView(generics.RetrieveAPIView):
    serializer_class = EvidenceSerializer
    queryset = Evidence.objects.select_related('plant')
    permission_classes = [permissions.AllowAny]


class EvidenceCreateView(generics.CreateAPIView):
    """Expert: create evidence record."""
    serializer_class = EvidenceSerializer
    permission_classes = [IsExpertOrAdmin]

    def perform_create(self, serializer):
        from audit.services import log_action
        evidence = serializer.save(reviewer=self.request.user)
        log_action(self.request.user, 'EVIDENCE_CREATE',
                   f'Created evidence for {evidence.plant.scientific_name}',
                   target_type='Evidence', target_id=evidence.id)


class EvidenceUpdateView(generics.UpdateAPIView):

    # The client edits with PATCH; PUT (full replacement) is not offered.
    http_method_names = ['get', 'head', 'options', 'patch']
    serializer_class = EvidenceSerializer
    queryset = Evidence.objects.all()
    permission_classes = [IsExpertOrAdmin]
