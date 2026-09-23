"""Serializers for the consultations app."""
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User

from .models import Appointment, AvailabilitySlot, Conversation, Message


class MinimalUserSerializer(serializers.ModelSerializer):
    """Compact user representation embedded in appointment payloads."""

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'full_name', 'role', 'avatar']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    """Read/write shape for a consultant's published window."""

    expert = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=[User.Role.EXPERT, User.Role.ADMIN]),
        required=False,
    )
    expert_name = serializers.SerializerMethodField()
    is_booked = serializers.BooleanField(read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    is_open = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = [
            'id', 'expert', 'expert_name', 'starts_at', 'ends_at', 'note',
            'is_closed', 'is_booked', 'duration_minutes', 'is_open', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def _request_user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None)

    def get_expert_name(self, obj):
        return obj.expert.get_full_name() or obj.expert.username

    def get_is_open(self, obj):
        """Whether a patient may still claim this window.

        Reads the ``active_bookings`` annotation when the queryset supplied
        one, so a 200-row list costs one query instead of 200.
        """
        active = getattr(obj, 'active_bookings', None)
        if active is not None:
            return not obj.is_closed and active == 0 and obj.starts_at > timezone.now()
        return obj.is_open_to_patients()

    def validate_expert(self, value):
        """Only an administrator may publish on another consultant's behalf."""
        user = self._request_user()
        if value is None:
            return None
        if user is not None and (user.is_admin_role or user.is_superuser):
            return value
        if user is not None and value.id == user.id:
            return value
        raise serializers.ValidationError(
            'You can only publish availability for yourself.'
        )

    def validate(self, attrs):
        starts = attrs.get('starts_at') or getattr(self.instance, 'starts_at', None)
        ends = attrs.get('ends_at') or getattr(self.instance, 'ends_at', None)
        if starts is None or ends is None:
            raise serializers.ValidationError('Both starts_at and ends_at are required.')
        if ends <= starts:
            raise serializers.ValidationError({'ends_at': 'The window must end after it starts.'})
        if ends <= timezone.now():
            raise serializers.ValidationError({'starts_at': 'That window is already in the past.'})

        # Resolution order matters: an explicit expert, else the instance's,
        # else the caller. Reading only attrs used to leave this None on
        # create, which made the overlap check below match nothing.
        user = self._request_user()
        expert = (
            attrs.get('expert')
            or getattr(self.instance, 'expert', None)
            or user
        )

        if self.instance is not None and self.instance.is_booked:
            raise serializers.ValidationError(
                'A booked window cannot be edited. Cancel the appointment first.'
            )

        overlap = AvailabilitySlot.objects.filter(
            expert=expert, starts_at__lt=ends, ends_at__gt=starts,
        )
        if self.instance:
            overlap = overlap.exclude(pk=self.instance.pk)
        if overlap.exists():
            raise serializers.ValidationError(
                {'starts_at': 'This overlaps another window already published for that day.'}
            )
        return attrs


class AppointmentSerializer(serializers.ModelSerializer):
    """Appointment as shown to patient, consultant, or administrator."""

    patient = MinimalUserSerializer(read_only=True)
    expert = MinimalUserSerializer(read_only=True)
    slot_detail = AvailabilitySlotSerializer(source='slot', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    can_join = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'expert', 'slot_detail', 'reason', 'expert_notes',
            'status', 'status_display', 'room_id', 'started_at', 'completed_at',
            'cancellation_reason', 'can_join', 'created_at', 'updated_at',
        ]
        # Deliberately all read-only: status changes go through dedicated
        # endpoints so every transition is audited and permission-checked.
        read_only_fields = fields

    def get_can_join(self, obj):
        return obj.status == Appointment.Status.CONFIRMED


class AppointmentUpdateSerializer(serializers.ModelSerializer):
    """The only free-text fields either party may edit after booking."""

    class Meta:
        model = Appointment
        fields = ['reason', 'expert_notes']


class BookingSerializer(serializers.Serializer):
    """Input for booking an existing published window."""

    slot = serializers.IntegerField(required=True)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=4000)

    def validate_slot(self, slot_id):
        slot = AvailabilitySlot.objects.filter(pk=slot_id).select_related('expert').first()
        if slot is None:
            raise serializers.ValidationError('That availability window does not exist.')
        if not slot.is_open_to_patients():
            raise serializers.ValidationError(
                'That window is no longer bookable — it is booked, closed, or in the past.'
            )
        if slot.expert_id == self.context['request'].user.id:
            raise serializers.ValidationError('You cannot book your own window.')
        return slot


class ReviewSerializer(serializers.Serializer):
    """Input for the consultant's outcome of a consultation."""

    note = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_name', 'kind', 'body',
                  'is_read', 'created_at']
        read_only_fields = ['id', 'conversation', 'sender', 'kind', 'is_read', 'created_at']


class SendMessageSerializer(serializers.Serializer):
    """Chat line posted by a participant.

    ``kind`` is intentionally not accepted here: free-text chat is the only
    thing a client may post through this endpoint. Signalling payloads travel
    via :class:`SignallingSerializer`, which restricts them to the WebRTC
    kinds and never lets a client forge a ``TEXT`` message that looks like it
    came from the other party.
    """

    body = serializers.CharField(required=True, max_length=4000)


class SignallingSerializer(serializers.Serializer):
    """WebRTC handshake payload relayed to the other participant."""

    kind = serializers.ChoiceField(
        choices=[
            (Message.Kind.OFFER, Message.Kind.OFFER),
            (Message.Kind.ANSWER, Message.Kind.ANSWER),
            (Message.Kind.ICE, Message.Kind.ICE),
            (Message.Kind.JOIN, Message.Kind.JOIN),
            (Message.Kind.LEAVE, Message.Kind.LEAVE),
        ],
        required=True,
    )
    payload = serializers.CharField(required=False, allow_blank=True, max_length=20000)


class ConversationSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    appointment_detail = AppointmentSerializer(source='appointment', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'appointment', 'appointment_detail', 'participants',
                  'last_message', 'unread_count', 'created_at', 'last_activity_at']

    def get_participants(self, obj):
        return [MinimalUserSerializer(obj.appointment.patient).data,
                MinimalUserSerializer(obj.appointment.expert).data]

    def get_last_message(self, obj):
        last = obj.messages.order_by('-created_at', '-id').first()
        return MessageSerializer(last).data if last else None
