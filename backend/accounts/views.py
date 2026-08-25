from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .serializers import (
    UserRegistrationSerializer, UserProfileSerializer,
    UserAdminSerializer, ChangePasswordSerializer
)
from audit.services import log_action


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


class UserListView(generics.ListAPIView):
    """Admin: list all users."""
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_admin_role or user.is_superuser):
            return User.objects.none()
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
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_admin_role or user.is_superuser):
            return User.objects.none()
        return User.objects.all()

    def perform_update(self, serializer):
        log_action(self.request.user, 'USER_MANAGE',
                   f'Admin modified user: {serializer.instance.username}',
                   target_type='User')
        serializer.save()
