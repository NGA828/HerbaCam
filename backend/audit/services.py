"""Audit logging service."""
from audit.models import AuditLog


def log_action(user, action, description, target_type='', target_id=None, metadata=None, ip_address=None):
    """Create an audit log entry."""
    return AuditLog.objects.create(
        user=user,
        action=action,
        description=description,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata,
        ip_address=ip_address,
    )
