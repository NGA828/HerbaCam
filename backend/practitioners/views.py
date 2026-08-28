from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import PractitionerProfile
from .serializers import PractitionerProfileSerializer
from accounts.models import User


class PractitionerProfileView(generics.RetrieveUpdateAPIView):
    """View/update own practitioner profile."""

    # The client edits with PATCH; PUT (full replacement) is not offered.
    http_method_names = ['get', 'head', 'options', 'patch']
    serializer_class = PractitionerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = PractitionerProfile.objects.get_or_create(
            user=self.request.user
        )
        # Filling in a practitioner profile upgrades a plain account, but it must
        # never demote an existing expert or administrator.
        if created and self.request.user.role == User.Role.USER:
            self.request.user.role = User.Role.PRACTITIONER
            self.request.user.save()
        return profile


class PractitionerListView(generics.ListAPIView):
    """Admin: list all practitioners."""
    serializer_class = PractitionerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_admin_role or user.is_superuser):
            return PractitionerProfile.objects.none()
        return PractitionerProfile.objects.select_related('user', 'region').all()
