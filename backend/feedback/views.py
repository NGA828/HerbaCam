"""Feedback views: any authenticated user sends; administrators triage."""
from django.utils import timezone
from rest_framework import generics, permissions

from .models import Feedback
from .serializers import FeedbackAdminSerializer, FeedbackSerializer


class _IsAdmin(permissions.BasePermission):
    message = 'Administrator access is required.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_admin_role or user.is_superuser)
        )


class FeedbackCreate(generics.CreateAPIView):
    """A user submits feedback; it is stamped with their identity."""

    serializer_class = FeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        from audit.services import log_action
        feedback = serializer.save(user=self.request.user)
        log_action(self.request.user, 'FEEDBACK_CREATE',
                   f'Submitted {feedback.get_category_display().lower()} feedback',
                   target_type='Feedback', target_id=feedback.id)


class FeedbackList(generics.ListAPIView):
    """Administrator queue of all feedback, filterable by status/category."""

    serializer_class = FeedbackAdminSerializer
    permission_classes = [permissions.IsAuthenticated, _IsAdmin]
    queryset = Feedback.objects.select_related('user').all()

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs


class FeedbackDetail(generics.RetrieveUpdateAPIView):
    """Administrator reads/answers one ticket.

    Resolving stamps ``resolved_at`` and notifies the author once.
    """

    serializer_class = FeedbackAdminSerializer
    permission_classes = [permissions.IsAuthenticated, _IsAdmin]
    queryset = Feedback.objects.select_related('user').all()
    http_method_names = ['get', 'head', 'options', 'patch']

    def perform_update(self, serializer):
        was_resolved = serializer.instance.status == Feedback.Status.RESOLVED
        feedback = serializer.save()
        from audit.services import log_action
        log_action(self.request.user, 'FEEDBACK_UPDATE',
                   f'Updated feedback #{feedback.id} to {feedback.status}',
                   target_type='Feedback', target_id=feedback.id)
        if (feedback.status == Feedback.Status.RESOLVED and not was_resolved
                and feedback.user_id != self.request.user.id):
            feedback.resolved_at = timezone.now()
            feedback.save(update_fields=['resolved_at'])
            from notifications.services import send_notification
            send_notification(
                feedback.user, 'FEEDBACK_REPLY', 'Your feedback was resolved',
                'An administrator marked your feedback as resolved.',
                related_object_type='Feedback', related_object_id=feedback.id,
            )
