from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Region, Division, Community
from .utils import haversine_km
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

    # The client edits with PATCH; PUT (full replacement) is not offered.
    http_method_names = ['get', 'head', 'options', 'patch', 'delete']
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


class LocateView(generics.GenericAPIView):
    """Match browser coordinates to the nearest Cameroonian region.

    Honours the diagram's GEOLOCALISATION API actor: the browser supplies a
    latitude/longitude and this returns the closest region together with the
    plants documented there, so the map can open centred on the viewer.
    Distances use the haversine formula computed in Python over the ten
    regions, which is exact enough for region-scale matching and needs no
    third-party geocoder or API key.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        
        try:
            lat = float(request.query_params.get('lat'))
            lng = float(request.query_params.get('lng'))
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Both lat and lng must be numbers.'},
                status.HTTP_400_BAD_REQUEST,
            )
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return Response({'detail': 'Coordinates are out of range.'},
                            status.HTTP_400_BAD_REQUEST)

        best, best_d = None, None
        for region in Region.objects.exclude(latitude=None).exclude(longitude=None):
            d = haversine_km(lat, lng, float(region.latitude), float(region.longitude))
            if best_d is None or d < best_d:
                best, best_d = region, d

        if best is None:
            return Response({'detail': 'No geolocated regions are available yet.'},
                            status.HTTP_404_NOT_FOUND)

        from plants.models import Plant
        plants = Plant.objects.filter(is_published=True, regions=best)
        return Response({
            'region': RegionSerializer(best).data,
            'distance_km': round(best_d, 1),
            'in_cameroon': (1 <= lat <= 14) and (8 <= lng <= 17),
            'plant_count': plants.count(),
            'plants': [{'id': p.id, 'scientific_name': p.scientific_name,
                        'common_name': p.common_name} for p in plants[:20]],
        })
