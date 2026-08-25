from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, SystemSetting
from .serializers import (
    UserRegistrationSerializer, UserProfileSerializer,
    UserAdminSerializer, ChangePasswordSerializer
)
from audit.services import log_action
from .permissions import IsAdministrator


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        log_action(None, 'USER_REGISTER', f'New user registered: {user.username}', target_type='User')
        return Response({
            'user': UserProfileSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class ProfileView(generics.RetrieveUpdateAPIView):
    """View and update user profile."""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """Change user password."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        log_action(request.user, 'PASSWORD_CHANGE', 'User changed password')
        return Response({'detail': 'Password changed successfully.'})


class SystemSettingsView(APIView):
    """Administrator-only, non-secret configuration endpoint."""
    permission_classes = [IsAdministrator]

    def get(self, request):
        return Response({item.key: item.value for item in SystemSetting.objects.all()})

    def put(self, request):
        allowed = {'application', 'registration', 'notifications', 'content', 'ai'}
        payload = request.data if isinstance(request.data, dict) else {}
        for key, value in payload.items():
            if key not in allowed:
                continue
            # Deliberately reject any credential-like fields from this public API surface.
            if isinstance(value, dict) and any('key' in str(k).lower() or 'secret' in str(k).lower() for k in value):
                return Response({'detail': 'Secrets cannot be configured through this endpoint.'}, status=status.HTTP_400_BAD_REQUEST)
            SystemSetting.objects.update_or_create(key=key, defaults={'value': value, 'updated_by': request.user})
        log_action(request.user, 'SYSTEM_SETTINGS_UPDATE', 'Updated system settings', target_type='SystemSetting')
        return self.get(request)


class UserListView(generics.ListAPIView):
    """Admin: list all users."""
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        qs = User.objects.all()
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(username__icontains=search) | qs.filter(email__icontains=search)
        return qs


class UserManageView(generics.RetrieveUpdateAPIView):
    """Admin: manage individual user."""
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdministrator]

    def get_queryset(self):
        return User.objects.all()

    def perform_update(self, serializer):
        log_action(self.request.user, 'USER_MANAGE',
                   f'Admin modified user: {serializer.instance.username}',
                   target_type='User')
        serializer.save()
