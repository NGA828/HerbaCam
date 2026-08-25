from rest_framework import generics, permissions
from .models import Region, Division, Community
from .serializers import RegionSerializer, RegionListSerializer, DivisionSerializer, CommunitySerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (request.user.is_admin_role or request.user.is_superuser)


class RegionListView(generics.ListCreateAPIView):
    queryset = Region.objects.all()
    permission_classes = [IsAdminOrReadOnly]

    def get_serializer_class(self):
        if self.request.query_params.get('detailed'):
            return RegionSerializer
        return RegionListSerializer


class RegionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer
    permission_classes = [IsAdminOrReadOnly]


class DivisionListView(generics.ListCreateAPIView):
    serializer_class = DivisionSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Division.objects.select_related('region').all()
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region_id=region)
        return qs


class CommunityListView(generics.ListCreateAPIView):
    serializer_class = CommunitySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Community.objects.select_related('region').all()
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region_id=region)
        return qs
