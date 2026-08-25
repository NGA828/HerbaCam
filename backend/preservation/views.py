from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import RiskAssessment
from .serializers import RiskAssessmentSerializer
from .services import calculate_plant_risk, run_full_risk_assessment


class IsExpertOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_expert or request.user.is_admin_role or request.user.is_superuser
        )


class RiskAssessmentListView(generics.ListAPIView):
    """List risk assessments."""
    serializer_class = RiskAssessmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = RiskAssessment.objects.select_related('plant', 'region')
        level = self.request.query_params.get('level')
        if level:
            qs = qs.filter(risk_level=level)
        target = self.request.query_params.get('target')
        if target == 'plant':
            qs = qs.filter(plant__isnull=False)
        elif target == 'region':
            qs = qs.filter(region__isnull=False)
        return qs


class RiskAssessmentDetailView(generics.RetrieveAPIView):
    serializer_class = RiskAssessmentSerializer
    queryset = RiskAssessment.objects.select_related('plant', 'region')
    permission_classes = [permissions.IsAuthenticated]


class RunRiskAssessmentView(APIView):
    """Trigger a full risk assessment calculation."""
    permission_classes = [IsExpertOrAdmin]

    def post(self, request):
        results = run_full_risk_assessment()
        return Response({
            'detail': f'Risk assessment completed. {len(results["plants"])} plants, {len(results["regions"])} regions assessed.',
            'high_risk_plants': RiskAssessmentSerializer(
                [a for a in results['plants'] if a.risk_level == 'HIGH'], many=True
            ).data,
        })
