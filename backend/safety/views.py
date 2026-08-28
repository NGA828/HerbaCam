from rest_framework import generics, permissions
from .models import SafetyInformation
from .serializers import SafetySerializer


class IsExpertOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (
            request.user.is_expert or request.user.is_admin_role or request.user.is_superuser
        )


class SafetyListView(generics.ListAPIView):
    serializer_class = SafetySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = SafetyInformation.objects.select_related('plant')
        plant = self.request.query_params.get('plant')
        if plant:
            qs = qs.filter(plant_id=plant)
        return qs


class SafetyDetailView(generics.RetrieveAPIView):
    serializer_class = SafetySerializer
    queryset = SafetyInformation.objects.select_related('plant')
    permission_classes = [permissions.AllowAny]


class SafetyCreateView(generics.CreateAPIView):
    serializer_class = SafetySerializer
    permission_classes = [IsExpertOrAdmin]

    def perform_create(self, serializer):
        from audit.services import log_action
        safety = serializer.save(reviewer=self.request.user)
        log_action(self.request.user, 'SAFETY_CREATE',
                   f'Created safety record for {safety.plant.scientific_name}',
                   target_type='SafetyInformation', target_id=safety.id)


class SafetyUpdateView(generics.UpdateAPIView):

    # The client edits with PATCH; PUT (full replacement) is not offered.
    http_method_names = ['get', 'head', 'options', 'patch']
    serializer_class = SafetySerializer
    queryset = SafetyInformation.objects.all()
    permission_classes = [IsExpertOrAdmin]
