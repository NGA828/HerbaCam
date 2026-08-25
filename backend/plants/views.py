from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Plant, PlantLocalName, PlantPart
from .serializers import (
    PlantListSerializer, PlantDetailSerializer,
    PlantLocalNameSerializer, PlantPartSerializer, PlantAdminSerializer
)
from audit.services import log_action


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (request.user.is_admin_role or request.user.is_superuser)


class PlantListView(generics.ListAPIView):
    """List all published plants with search and filtering."""
    serializer_class = PlantListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Plant.objects.filter(is_published=True).prefetch_related('local_names', 'regions')
        
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(scientific_name__icontains=search) |
                models.Q(common_name__icontains=search) |
                models.Q(local_names__name__icontains=search) |
                models.Q(local_names__language__icontains=search)
            ).distinct()
        
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(regions__id=region)
        
        family = self.request.query_params.get('family')
        if family:
            qs = qs.filter(family__icontains=family)
        
        habitat = self.request.query_params.get('habitat')
        if habitat:
            qs = qs.filter(habitat=habitat)
        
        return qs


class PlantDetailView(generics.RetrieveAPIView):
    """Get detailed plant information."""
    serializer_class = PlantDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Plant.objects.filter(is_published=True).prefetch_related(
        'local_names', 'parts', 'regions',
        'traditional_uses', 'evidence_records', 'safety_records'
    )


class PlantAdminListView(generics.ListCreateAPIView):
    """Admin: manage plants."""
    serializer_class = PlantAdminSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Plant.objects.all()

    def perform_create(self, serializer):
        plant = serializer.save()
        log_action(self.request.user, 'PLANT_CREATE',
                   f'Created plant: {plant.scientific_name}',
                   target_type='Plant', target_id=plant.id)


class PlantAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: manage individual plant."""
    serializer_class = PlantAdminSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Plant.objects.all()

    def perform_update(self, serializer):
        plant = serializer.save()
        log_action(self.request.user, 'PLANT_UPDATE',
                   f'Updated plant: {plant.scientific_name}',
                   target_type='Plant', target_id=plant.id)


from django.db import models


class PlantSearchView(APIView):
    """Advanced plant search with multiple filters."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = Plant.objects.filter(is_published=True).prefetch_related('local_names')
        
        # Text search
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(
                models.Q(scientific_name__icontains=q) |
                models.Q(common_name__icontains=q) |
                models.Q(local_names__name__icontains=q)
            ).distinct()
        
        # Filters
        region = request.query_params.get('region')
        if region:
            qs = qs.filter(regions__id=region)
        
        part = request.query_params.get('part')
        if part:
            qs = qs.filter(parts__part_type=part)
        
        evidence_level = request.query_params.get('evidence')
        if evidence_level:
            qs = qs.filter(evidence_records__level=evidence_level)
        
        serializer = PlantListSerializer(qs[:50], many=True)
        return Response(serializer.data)
