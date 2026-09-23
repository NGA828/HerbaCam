"""Object-level permissions for scheduling and consultations."""
from rest_framework import permissions


class CanPublishAvailability(permissions.BasePermission):
    """Consultants manage their own diary; administrators may act for them."""

    message = 'Only experts and administrators can publish availability windows.'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated
            and (user.is_expert or user.is_admin_role or user.is_superuser)
        )

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.is_admin_role:
            return True
        return obj.expert_id == user.id


class IsAppointmentParty(permissions.BasePermission):
    """Only the patient and the consultant on an appointment may see it."""

    message = 'You are not a participant in this appointment.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.is_admin_role:
            return True
        # Accept an Appointment or anything exposing one (e.g. Conversation).
        appointment = obj if hasattr(obj, 'patient_id') else getattr(obj, 'appointment', None)
        if appointment is None or not hasattr(appointment, 'patient_id'):
            # Wrong object type wired onto this view: deny rather than raise,
            # so a wiring mistake can never surface as a 500 to a client.
            return False
        return user.id in {appointment.patient_id, appointment.expert_id}
