import logging
from django.conf import settings
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser
from .models import Identification, IdentificationResult, IdentificationReport
from .serializers import (
    IdentificationSerializer, IdentificationListSerializer,
    IdentificationReportSerializer
)
from .services import identify_plant
from plants.models import Plant
from notifications.services import send_notification
from audit.services import log_action

logger = logging.getLogger(__name__)


class IsAuthenticated(permissions.IsAuthenticated):
    pass


class PlantIdentifyView(APIView):
    """Upload an image for AI plant identification."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'No image provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate image
        if image.content_type not in settings.ALLOWED_IMAGE_TYPES:
            return Response(
                {'error': f'Invalid image type. Allowed: {", ".join(settings.ALLOWED_IMAGE_TYPES)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if image.size > settings.MAX_UPLOAD_SIZE:
            return Response(
                {'error': f'Image too large. Maximum size: {settings.MAX_UPLOAD_SIZE // (1024*1024)}MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create identification record
        identification = Identification.objects.create(
            user=request.user,
            image=image,
            status=Identification.Status.PROCESSING
        )

        # Run AI identification
        ai_result = identify_plant(image)

        if not ai_result.get('success'):
            identification.status = Identification.Status.FAILED
            identification.save()
            logger.warning(f"AI identification failed for user {request.user.username}: {ai_result.get('error')}")
            return Response({
                'identification': IdentificationSerializer(identification).data,
                'error': ai_result.get('error', 'Identification failed.'),
            }, status=status.HTTP_200_OK)

        # Store results
        data = ai_result['data']
        db_match = ai_result.get('database_match', {})
        mode = ai_result.get('mode', 'live')
        demo_notice = ai_result.get('demo_notice', '')

        # Primary identification
        plant_obj = None
        if db_match and db_match.get('found') and db_match.get('id'):
            try:
                plant_obj = Plant.objects.get(id=db_match['id'])
            except Plant.DoesNotExist:
                pass

        primary_result = IdentificationResult.objects.create(
            identification=identification,
            plant=plant_obj,
            scientific_name=data['identification']['scientific_name'],
            common_name=data['identification'].get('common_name', ''),
            confidence=data['identification']['confidence'],
            is_primary=True,
            ai_raw_response={**data, 'mode': mode, 'demo_notice': demo_notice},
        )

        # Alternative identifications
        for alt in data.get('alternatives', []):
            alt_plant = None
            try:
                alt_plant = Plant.objects.filter(
                    scientific_name__iexact=alt['scientific_name']
                ).first()
            except Exception:
                pass

            IdentificationResult.objects.create(
                identification=identification,
                plant=alt_plant,
                scientific_name=alt['scientific_name'],
                common_name=alt.get('common_name', ''),
                confidence=alt['confidence'],
                is_primary=False,
            )

        identification.status = Identification.Status.COMPLETED
        identification.save()

        # Build response with metadata
        response_data = IdentificationSerializer(identification).data
        response_data['mode'] = mode
        if demo_notice:
            response_data['demo_notice'] = demo_notice
        if db_match and not db_match.get('found'):
            response_data['database_notice'] = db_match.get('message', '')

        # Notify user
        send_notification(
            request.user,
            'IDENTIFICATION_READY',
            'Plant Identification Complete',
            f'Your plant has been identified as {data["identification"]["scientific_name"]}.',
            related_object_type='Identification',
            related_object_id=identification.id,
        )

        log_action(request.user, 'PLANT_IDENTIFICATION',
                   f'Identified plant: {data["identification"]["scientific_name"]} ({mode} mode)',
                   target_type='Identification', target_id=identification.id)

        return Response(response_data, status=status.HTTP_201_CREATED)


class IdentificationHistoryView(generics.ListAPIView):
    """View user's identification history."""
    serializer_class = IdentificationListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Identification.objects.filter(user=self.request.user).prefetch_related('results')


class IdentificationDetailView(generics.RetrieveAPIView):
    """View individual identification result."""
    serializer_class = IdentificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Identification.objects.filter(user=self.request.user).prefetch_related('results')


class IdentificationDeleteView(generics.DestroyAPIView):
    """Delete identification from history."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Identification.objects.filter(user=self.request.user)


class ReportIdentificationView(generics.CreateAPIView):
    """Report incorrect identification."""
    serializer_class = IdentificationReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
