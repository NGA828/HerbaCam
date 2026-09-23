from rest_framework.permissions import BasePermission


class IsAdministrator(BasePermission):
    """Server-side guard for administrator-only endpoints."""
    message = 'Administrator permission is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_admin_role or user.is_superuser))


class IsContentCurator(BasePermission):
    """Content curation: administrators and specialized experts, read and write.

    The ANCESTOR use-case diagram assigns ``manage plant information`` and
    ``manage articles`` to the specialized expert, so writing the plant library
    and the article editorium is deliberately not administrator-only. Experts
    are the taxonomists and reviewers the diagram puts in charge of this
    content; administrators keep the same rights for oversight.

    Reads are closed to everyone else on purpose. These endpoints back the
    management screens and therefore serve ``Model.objects.all()`` — drafts and
    unpublished rows, which must never reach anonymous visitors.
    """
    message = 'Expert or administrator permission is required.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(user.is_expert or user.is_admin_role or user.is_superuser)


class IsStaffOrReadOnly(BasePermission):
    """Reads are limited to curators (admin/expert), writes to administrators.

    Retained for the shared symptom vocabulary: renaming or deleting a symptom
    silently relabels every historical contribution that matched on it, so that
    taxonomy stays with the administrator even though plant and article content
    is curator-writable (see :class:`IsContentCurator`).
    """
    message = 'Curator permission is required.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return bool(user.is_admin_role or user.is_expert or user.is_superuser)
        return bool(user.is_admin_role or user.is_superuser)
