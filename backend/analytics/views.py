from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from .models import Favorite
from .serializers import FavoriteSerializer
from plants.models import Plant
from plants.serializers import PlantListSerializer
from accounts.models import User
from knowledge.models import KnowledgeSubmission, TraditionalUse
from symptoms.models import Symptom
from identification.models import Identification
from geography.models import Region


class FavoriteListView(generics.ListAPIView):
    """User's favorite plants."""
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related('plant')


class FavoriteCreateView(APIView):
    """Add plant to favorites."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        plant_id = request.data.get('plant_id')
        if not plant_id:
            return Response({'error': 'plant_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            plant = Plant.objects.get(id=plant_id)
        except Plant.DoesNotExist:
            return Response({'error': 'Plant not found'}, status=status.HTTP_404_NOT_FOUND)
        
        fav, created = Favorite.objects.get_or_create(user=request.user, plant=plant)
        if not created:
            return Response({'detail': 'Already in favorites'}, status=status.HTTP_200_OK)
        return Response({'detail': 'Added to favorites', 'id': fav.id}, status=status.HTTP_201_CREATED)


class FavoriteDeleteView(APIView):
    """Remove plant from favorites."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        plant_id = request.data.get('plant_id')
        Favorite.objects.filter(user=request.user, plant_id=plant_id).delete()
        return Response({'detail': 'Removed from favorites'})


class FavoriteCheckView(APIView):
    """Check if a plant is favorited."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, plant_id):
        is_fav = Favorite.objects.filter(user=request.user, plant_id=plant_id).exists()
        return Response({'is_favorite': is_fav})


class AnalyticsDashboardView(APIView):
    """Dashboard analytics overview."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        data = {
            'total_plants': Plant.objects.filter(is_published=True).count(),
            'total_symptoms': Symptom.objects.count(),
            'total_regions': Region.objects.count(),
            'total_traditional_uses': TraditionalUse.objects.filter(is_verified=True).count(),
            'total_identifications': Identification.objects.filter(status='COMPLETED').count(),
            'total_submissions': KnowledgeSubmission.objects.count(),
            'pending_submissions': KnowledgeSubmission.objects.filter(
                status__in=['SUBMITTED', 'UNDER_REVIEW']
            ).count(),
        }
        
        # User-specific data
        if not user.is_admin_role and not user.is_superuser:
            data['my_identifications'] = Identification.objects.filter(user=user).count()
            data['my_favorites'] = Favorite.objects.filter(user=user).count()
        
        if user.is_practitioner:
            data['my_submissions'] = KnowledgeSubmission.objects.filter(contributor=user).count()
            data['approved_submissions'] = KnowledgeSubmission.objects.filter(
                contributor=user, status='PUBLISHED'
            ).count()
        
        if user.is_expert or user.is_admin_role or user.is_superuser:
            data['total_users'] = User.objects.count()
            data['total_practitioners'] = User.objects.filter(role='PRACTITIONER').count()
            data['total_experts'] = User.objects.filter(role='EXPERT').count()
        
        return Response(data)
