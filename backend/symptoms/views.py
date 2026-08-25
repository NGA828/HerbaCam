from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Symptom
from .serializers import SymptomSerializer
from knowledge.models import TraditionalUse
from plants.serializers import PlantListSerializer


class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_authenticated and (request.user.is_admin_role or request.user.is_superuser)


class SymptomListView(generics.ListAPIView):
    """List all symptoms."""
    serializer_class = SymptomSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Symptom.objects.all()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__icontains=category)
        return qs


class SymptomDetailView(generics.RetrieveAPIView):
    """Get symptom details with associated plants."""
    serializer_class = SymptomSerializer
    queryset = Symptom.objects.all()
    permission_classes = [permissions.AllowAny]


class SymptomSearchView(APIView):
    """Search plants by symptom - reverse search."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        symptom_name = request.query_params.get('q', '')
        if not symptom_name:
            return Response({'detail': 'Please provide a search query (q parameter).'})
        
        # Find matching symptoms
        symptoms = Symptom.objects.filter(name__icontains=symptom_name)
        
        if not symptoms.exists():
            return Response({
                'symptoms': [],
                'results': [],
                'message': f'No symptoms matching "{symptom_name}" found.'
            })
        
        # Find traditional uses for these symptoms
        uses = TraditionalUse.objects.filter(
            symptom__in=symptoms,
            plant__is_published=True
        ).select_related('plant', 'symptom', 'plant_part', 'preparation', 'region')
        
        results = []
        for use in uses[:50]:
            results.append({
                'plant': {
                    'id': use.plant.id,
                    'scientific_name': use.plant.scientific_name,
                    'common_name': use.plant.common_name,
                    'image': use.plant.image.url if use.plant.image else None,
                },
                'symptom': use.symptom.name,
                'traditional_use': use.description,
                'plant_part': use.plant_part.get_part_type_display() if use.plant_part else '',
                'preparation': use.preparation.get_name_display() if use.preparation else '',
                'region': use.region.name if use.region else '',
                'is_verified': use.is_verified,
                'disclaimer': 'Traditionally associated with this symptom. This is not medical advice.',
            })
        
        return Response({
            'symptoms': SymptomSerializer(symptoms, many=True).data,
            'results': results,
            'count': len(results),
        })


class SymptomAdminListView(generics.ListCreateAPIView):
    serializer_class = SymptomSerializer
    permission_classes = [IsAdminOrReadOnly]
    queryset = Symptom.objects.all()
