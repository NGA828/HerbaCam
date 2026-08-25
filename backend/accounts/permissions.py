from rest_framework.permissions import BasePermission


class IsAdministrator(BasePermission):
    """Server-side guard for administrator-only endpoints."""
    message = 'Administrator permission is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_admin_role or user.is_superuser))
