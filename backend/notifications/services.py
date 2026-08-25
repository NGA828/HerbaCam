"""Notification service."""
from notifications.models import Notification


def send_notification(user, notification_type, title, message, related_object_type='', related_object_id=None):
    """Create a notification for a user."""
    return Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        message=message,
        related_object_type=related_object_type,
        related_object_id=related_object_id,
    )
