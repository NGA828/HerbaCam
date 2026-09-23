"""Consultation scheduling: availability, appointments, and per-appointment threads.

Implements the ANCESTOR use cases: ``Book appointment``, ``manage appointments``,
``update availability``, ``conduct video consultation``, ``view messages`` and
``view consultations``.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from geography.utils import haversine_km

# A window is only truly claimed while a booking is still live; cancelled and
# completed bookings must release it back to the diary.
ACTIVE_APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED']


class AvailabilitySlotQuerySet(models.QuerySet):
    """Shared definition of "bookable", so every caller agrees on it."""

    def open_to_patients(self):
        return self.filter(
            is_closed=False, starts_at__gt=timezone.now(),
        ).exclude(appointments__status__in=ACTIVE_APPOINTMENT_STATUSES)


class AvailabilitySlot(models.Model):
    """One bookable window published by a consultant ("update availability")."""

    objects = AvailabilitySlotQuerySet.as_manager()

    expert = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='availability_slots',
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    note = models.CharField(
        max_length=255, blank=True, default='',
        help_text='Optional line patients see next to this window, e.g. "Follow-ups only".',
    )
    is_closed = models.BooleanField(
        default=False,
        help_text='Hidden from patients. Does not cancel an existing booking.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['starts_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(ends_at__gt=models.F('starts_at')),
                name='slot_ends_after_starts',
            ),
        ]

    def __str__(self):
        return f'{self.expert.username} {self.starts_at:%Y-%m-%d %H:%M}'

    @property
    def is_booked(self):
        """True while a *live* appointment claims this window.

        Cancelled and completed bookings deliberately do not count, so the
        window returns to the pool instead of being stranded forever.
        """
        return self.appointments.filter(status__in=ACTIVE_APPOINTMENT_STATUSES).exists()

    @property
    def duration_minutes(self):
        return int((self.ends_at - self.starts_at).total_seconds() // 60)

    def is_open_to_patients(self):
        """A window a patient may still book: open, in the future, and unclaimed."""
        return (
            not self.is_closed
            and not self.is_booked
            and self.starts_at > timezone.now()
        )


class Appointment(models.Model):
    """A patient's booking of one of a consultant's slots."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending confirmation'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        NO_SHOW = 'NO_SHOW', 'No show'

    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='appointments_as_patient',
    )
    expert = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='appointments_as_expert',
    )
    slot = models.ForeignKey(
        AvailabilitySlot, on_delete=models.SET_NULL,
        related_name='appointments', null=True, blank=True,
        help_text='The diary window this booking claims.',
    )
    reason = models.TextField(
        blank=True, default='',
        help_text='What the patient wants to discuss.',
    )
    expert_notes = models.TextField(
        blank=True, default='',
        help_text='Private notes the consultant keeps on this consultation.',
    )
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    room_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['expert', 'status'])]

    def __str__(self):
        return f'#{self.pk}: {self.patient.username} → {self.expert.username} ({self.status})'

    @property
    def is_active(self):
        return self.status in {self.Status.PENDING, self.Status.CONFIRMED}

    def can_transition(self, to_status):
        """Allowed status moves. Cancelling/confirming only makes sense while live."""
        if to_status in {self.Status.COMPLETED, self.Status.NO_SHOW}:
            return self.status == self.Status.CONFIRMED
        return self.is_active


class Conversation(models.Model):
    """The single messaging thread attached to one appointment.

    Doubles as the WebRTC signalling channel for the video consultation: SDP
    offers, answers and ICE candidates travel as :class:`Message` rows so no
    second protocol or third-party service is required.
    """

    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name='conversation',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_activity_at']

    def __str__(self):
        return f'Thread for appointment #{self.appointment_id}'

    @property
    def unread_count(self):
        return self.messages.filter(is_read=False).count()


class Message(models.Model):
    """One entry in a conversation — a chat line, or a signalling payload."""

    class Kind(models.TextChoices):
        TEXT = 'TEXT', 'Message'
        JOIN = 'JOIN', 'Entered the room'
        LEAVE = 'LEAVE', 'Left the room'
        OFFER = 'OFFER', 'WebRTC offer'
        ANSWER = 'ANSWER', 'WebRTC answer'
        ICE = 'ICE', 'WebRTC ICE candidate'

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages',
    )
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='sent_messages')
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.TEXT)
    body = models.TextField()
    is_read = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.sender.username}: {self.body[:40]}'


class ExpertProfile(models.Model):
    """How a specialized expert gets found: what they consult on, where they
    work, and whether an administrator has vouched for them.

    The diagram's actor is a *specialized* expert that patients choose, and
    geolocation is one of its use cases; neither is expressible on ``User``
    alone. Verification is deliberately soft: an unverified specialist keeps
    working, but the directory is where an approval becomes visible, so nothing
    is locked out by a missing row.
    """

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='consultant_profile')
    region = models.ForeignKey('geography.Region', on_delete=models.SET_NULL,
                               null=True, blank=True, related_name='expert_profiles')
    specialization = models.CharField(max_length=120, blank=True, default='',
                                      help_text='Short label patients filter by, e.g. "Maternal health".')
    focus = models.TextField(blank=True, default='',
                             help_text='What this specialist consults on, in their own words.')
    is_verified = models.BooleanField(default=False,
                                      help_text='An administrator has checked the credentials behind this profile.')
    is_accepting_patients = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_verified', 'user__username']

    def __str__(self):
        return self.user.username + ' - ' + (self.specialization or 'no specialty set')

    def distance_from(self, lat, lng):
        """Kilometres from a point, measured to the region this specialist works
        from. ``None`` when either side is unlocated, so a caller with no
        location gets a usable listing instead of a bogus 0 km.
        """
        if self.region_id is None:
            return None
        if self.region.latitude is None or self.region.longitude is None:
            return None
        return round(haversine_km(lat, lng, float(self.region.latitude),
                                  float(self.region.longitude)), 1)
