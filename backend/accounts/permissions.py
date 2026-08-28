from rest_framework.permissions import BasePermission


class IsAdministrator(BasePermission):
    """Server-side guard for administrator-only endpoints."""
    message = 'Administrator permission is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_admin_role or user.is_superuser))


class IsStaffOrReadOnly(BasePermission):
    """Reads are limited to curators (admin/expert), writes to administrators.

    Used by the /admin/ management endpoints that expose unpublished records
    (draft articles, unpublished plants) which must never reach the public.
    """
    message = 'Curator permission is required.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return bool(user.is_admin_role or user.is_expert or user.is_superuser)
        return bool(user.is_admin_role or user.is_superuser)
