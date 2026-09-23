"""Views for availability, appointments, consultations and messaging."""
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from notifications.services import send_notification

from .models import (
    ACTIVE_APPOINTMENT_STATUSES,
    Appointment,
    AvailabilitySlot,
    Conversation,
    ExpertProfile,
    Message,
)
from .permissions import CanPublishAvailability, IsAppointmentParty
from .serializers import (
    AppointmentSerializer,
    RescheduleSerializer,
    ExpertProfileSerializer,
    ExpertSelfSerializer,
    AppointmentUpdateSerializer,
    AvailabilitySlotSerializer,
    BookingSerializer,
    ConversationSerializer,
    MessageSerializer,
    ReviewSerializer,
    SendMessageSerializer,
    SignallingSerializer,
)


def _log(request, action, description, target_type='', target_id=None):
    from audit.services import log_action
    log_action(request.user, action, description,
               target_type=target_type, target_id=target_id,
               ip_address=request.META.get('REMOTE_ADDR'))


def _is_admin(user):
    return user.is_admin_role or user.is_superuser


def _is_consultant(user):
    return user.is_expert or _is_admin(user)


def annotate_open(queryset):
    """Attach ``active_bookings`` so ``is_open`` needs no per-row query."""
    return queryset.annotate(
        active_bookings=Count(
            'appointments',
            filter=Q(appointments__status__in=ACTIVE_APPOINTMENT_STATUSES),
        ),
    )


# --------------------------------------------------------------------------
# Availability  ("update availability")
# --------------------------------------------------------------------------

class AvailabilityListCreate(generics.ListCreateAPIView):
    """The signed-in consultant's own published windows."""

    serializer_class = AvailabilitySlotSerializer
    permission_classes = [permissions.IsAuthenticated, CanPublishAvailability]

    def get_queryset(self):
        qs = annotate_open(
            AvailabilitySlot.objects.select_related('expert').all()
        ).order_by('starts_at')
        user = self.request.user
        if not _is_admin(user):
            qs = qs.filter(expert=user)
        future_only = self.request.query_params.get('future')
        if future_only and future_only.lower() in {'1', 'true', 'yes'}:
            qs = qs.filter(ends_at__gt=timezone.now())
        return qs

    def perform_create(self, serializer):
        # ``expert`` defaults to the caller; validate_expert already refused
        # anyone publishing under someone else's name unless they administer.
        slot = serializer.save(expert=serializer.validated_data.get('expert') or self.request.user)
        _log(self.request, 'AVAILABILITY_CREATE',
             f'Published availability {slot.starts_at:%Y-%m-%d %H:%M}',
             target_type='AvailabilitySlot', target_id=slot.id)


class AvailabilityDetail(generics.RetrieveUpdateDestroyAPIView):
    """Edit or withdraw one of your own windows."""

    serializer_class = AvailabilitySlotSerializer
    # CanPublishAvailability already owns the object check for slots
    # (expert_id == user, or admin). IsAppointmentParty belongs to the
    # appointment/thread views and reads patient_id — applying it here turned
    # a non-owner lookup into an AttributeError instead of a denial.
    permission_classes = [permissions.IsAuthenticated, CanPublishAvailability]
    queryset = AvailabilitySlot.objects.select_related('expert')
    # PATCH only — the rest of the API never offers PUT for partial records.
    http_method_names = ['get', 'head', 'options', 'patch', 'delete']

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method in ('PATCH', 'DELETE') and obj.is_booked and not _is_admin(request.user):
            raise ValidationError(
                'That window is already booked. Cancel the appointment first.'
            )

    def perform_destroy(self, instance):
        if instance.is_booked:
            raise ValidationError('A booked window can only be removed by cancelling its appointment.')
        _log(self.request, 'AVAILABILITY_DELETE', 'Removed an availability window',
             target_type='AvailabilitySlot', target_id=instance.id)
        instance.delete()


class PublicSlotList(generics.ListAPIView):
    """Open windows a patient may book, optionally filtered by consultant."""

    serializer_class = AvailabilitySlotSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = AvailabilitySlot.objects.select_related('expert')

    def get_queryset(self):
        qs = annotate_open(super().get_queryset().open_to_patients().order_by('starts_at'))
        expert = self.request.query_params.get('expert')
        if expert:
            qs = qs.filter(expert_id=expert)
        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(starts_at__date=date)
        return accepting_only(qs)[:200]


# --------------------------------------------------------------------------
# Appointments  ("Book appointment", "manage appointments")
# --------------------------------------------------------------------------

class AppointmentList(generics.ListAPIView):
    """Appointments visible to the caller, scoped by role.

    A patient sees bookings they made; a consultant sees those addressed to
    them *and* any they made as a patient themselves; administrators may see
    everything with ``?scope=all``.
    """

    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Appointment.objects.select_related('patient', 'expert', 'slot')
        scope = self.request.query_params.get('scope')

        if _is_admin(user) and scope == 'all':
            qs = base
        else:
            mine = base.filter(patient=user)
            if _is_consultant(user):
                mine = mine | base.filter(expert=user)
            qs = mine

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.distinct().order_by('-created_at')


class BookAppointment(APIView):
    """Patient books an open window; the window is claimed atomically."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BookingSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        slot = serializer.validated_data['slot']
        reason = serializer.validated_data.get('reason', '')

        with transaction.atomic():
            # Lock the slot row so two patients clicking at once cannot both win.
            locked = AvailabilitySlot.objects.select_for_update().get(pk=slot.pk)
            if not locked.is_open_to_patients():
                raise ValidationError({'slot': 'That window was just taken or closed.'})
            appointment = Appointment.objects.create(
                patient=request.user,
                expert=locked.expert,
                slot=locked,
                reason=reason,
                status=Appointment.Status.PENDING,
            )
            Conversation.objects.create(appointment=appointment)

        send_notification(
            locked.expert, 'APPOINTMENT_BOOKED',
            'New consultation request',
            f'{request.user.get_full_name() or request.user.username} requested '
            f'{locked.starts_at:%d %b, %H:%M}.',
            related_object_type='Appointment', related_object_id=appointment.id,
        )
        _log(request, 'APPOINTMENT_BOOK',
             f'Booked appointment #{appointment.id}',
             target_type='Appointment', target_id=appointment.id)
        return Response(AppointmentSerializer(appointment).data, status.HTTP_201_CREATED)


class AppointmentDetail(generics.RetrieveUpdateAPIView):
    """Read an appointment; edit only the free-text notes."""

    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAppointmentParty]
    queryset = Appointment.objects.select_related('patient', 'expert', 'slot')
    http_method_names = ['get', 'head', 'options', 'patch']

    def get_serializer_class(self):
        if self.request.method in ('PATCH', 'PUT'):
            return AppointmentUpdateSerializer
        return AppointmentSerializer

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if request.method == 'PATCH':
            expert_editing = 'expert_notes' in request.data
            if expert_editing and not (request.user.id == obj.expert_id or _is_admin(request.user)):
                raise PermissionDenied('Only the consultant can write consultation notes.')


class UpdateAppointmentStatus(APIView):
    """The single door through which every status change passes."""

    permission_classes = [permissions.IsAuthenticated, IsAppointmentParty]

    TRANSITIONS = {
        'confirm': Appointment.Status.CONFIRMED,
        'cancel': Appointment.Status.CANCELLED,
        'complete': Appointment.Status.COMPLETED,
        'no_show': Appointment.Status.NO_SHOW,
    }

    def post(self, request, pk):
        appointment = get_object_or_404(
            Appointment.objects.select_related('patient', 'expert', 'slot'), pk=pk,
        )
        self.check_object_permissions(request, appointment)

        action = request.data.get('action')
        if action not in self.TRANSITIONS:
            raise ValidationError({'action': f'Unknown action. Choose one of: {", ".join(self.TRANSITIONS)}.'})
        if not _is_consultant(request.user) and action != 'cancel':
            raise PermissionDenied('Only the consultant can confirm, complete, or mark a no-show.')
        if not appointment.can_transition(self.TRANSITIONS[action]):
            raise ValidationError(
                {'action': f'Cannot {action} an appointment that is {appointment.status}.'}
            )

        review = ReviewSerializer(data=request.data)
        review.is_valid(raise_exception=True)
        new_status = self.TRANSITIONS[action]

        appointment.status = new_status
        if new_status == Appointment.Status.CANCELLED:
            appointment.cancellation_reason = review.validated_data.get('reason', '')
            # The slot keeps its appointment link for history: is_booked only
            # counts live bookings, so the window releases itself here.
        elif new_status == Appointment.Status.COMPLETED:
            appointment.completed_at = timezone.now()
            note = review.validated_data.get('note', '')
            if note:
                appointment.expert_notes = (
                    f'{appointment.expert_notes}\n{note}'.strip() if appointment.expert_notes else note
                )
        appointment.save()

        recipient = appointment.expert if request.user == appointment.patient else appointment.patient
        send_notification(
            recipient, f'APPOINTMENT_{new_status}',
            f'Consultation {new_status.lower()}',
            f'Appointment #{appointment.id} is now {appointment.get_status_display().lower()}.',
            related_object_type='Appointment', related_object_id=appointment.id,
        )
        _log(request, f'APPOINTMENT_{action.upper()}',
             f'{action.capitalize()} appointment #{appointment.id}',
             target_type='Appointment', target_id=appointment.id)
        return Response(AppointmentSerializer(appointment).data)


class RescheduleAppointment(APIView):
    """Move a live booking to one of the same specialist's other open windows.

    The window the patient leaves comes back for everyone on its own: a slot is
    only considered taken while a live appointment points at it. A move asked for
    by the patient returns the booking to PENDING, because the new time still
    needs the specialist's agreement; a move proposed by the specialist is
    already agreed and stays CONFIRMED.
    """

    permission_classes = [permissions.IsAuthenticated, IsAppointmentParty]

    def post(self, request, pk):
        appointment = get_object_or_404(
            Appointment.objects.select_related('patient', 'expert', 'slot'), pk=pk,
        )
        self.check_object_permissions(request, appointment)
        if appointment.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            raise ValidationError({
                'status': f'Cannot move an appointment that is {appointment.get_status_display().lower()}.'
            })

        serializer = RescheduleSerializer(
            data=request.data, context={'request': request, 'appointment': appointment},
        )
        serializer.is_valid(raise_exception=True)
        new_slot = serializer.validated_data['slot']
        note = serializer.validated_data.get('reason', '')

        with transaction.atomic():
            # Same lock as booking: whoever claims the window first keeps it.
            claimed = AvailabilitySlot.objects.select_for_update().get(pk=new_slot.pk)
            if not claimed.is_open_to_patients():
                raise ValidationError({'slot': 'That window was just taken by someone else.'})
            previous = appointment.slot
            appointment.slot = claimed
            if request.user.id == appointment.patient_id:
                appointment.status = Appointment.Status.PENDING
            appointment.save()

            conversation = Conversation.objects.filter(appointment=appointment).first()
            if conversation is not None:
                conversation.messages.create(
                    sender=request.user,
                    kind=Message.Kind.TEXT,
                    body=(f'Moved from {previous.starts_at:%a %d %b, %H:%M} to '
                          f'{claimed.starts_at:%a %d %b, %H:%M}.'
                          + (f' {note}' if note else '')),
                )

        recipient = appointment.expert if request.user.id == appointment.patient_id else appointment.patient
        send_notification(
            recipient, 'APPOINTMENT_RESCHEDULED',
            'Consultation moved to a new time',
            f'Appointment #{appointment.id} is now {claimed.starts_at:%a %d %b, %H:%M}'
            f'{", pending confirmation" if appointment.status == Appointment.Status.PENDING else ""}.',
            related_object_type='Appointment', related_object_id=appointment.id,
        )
        _log(request, 'APPOINTMENT_RESCHEDULE',
             f'Moved appointment #{appointment.id} to slot #{claimed.pk}',
             target_type='Appointment', target_id=appointment.id)
        return Response(AppointmentSerializer(appointment).data)


class StartConsultation(APIView):
    """Marks the moment a participant enters the video room, and hands back the room id."""

    permission_classes = [permissions.IsAuthenticated, IsAppointmentParty]

    def post(self, request, pk):
        appointment = get_object_or_404(Appointment, pk=pk)
        self.check_object_permissions(request, appointment)
        if appointment.status != Appointment.Status.CONFIRMED:
            raise ValidationError({'detail': 'The consultation can only start once confirmed.'})
        if not appointment.started_at:
            appointment.started_at = timezone.now()
            appointment.save(update_fields=['started_at'])
        conversation, _ = Conversation.objects.get_or_create(appointment=appointment)
        Message.objects.create(
            conversation=conversation, sender=request.user,
            kind=Message.Kind.JOIN, body=f'{request.user.username} joined the room',
        )
        _log(request, 'CONSULTATION_START', f'Started consultation #{appointment.id}',
             target_type='Appointment', target_id=appointment.id)
        # ICE servers travel with the join instead of being baked into the
        # bundle, so adding a TURN relay is an environment change, not a deploy
        # of new frontend code.
        return Response({'room_id': str(appointment.room_id),
                         'conversation_id': conversation.id,
                         'ice_servers': settings.WEBRTC_ICE_SERVERS})


# --------------------------------------------------------------------------
# Messaging + WebRTC signalling  ("view messages")
# --------------------------------------------------------------------------

class ConversationList(generics.ListAPIView):
    """Threads the caller takes part in."""

    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Conversation.objects.select_related(
            'appointment', 'appointment__patient', 'appointment__expert',
        )
        if _is_admin(user):
            return qs
        return qs.filter(appointment__patient=user) | qs.filter(appointment__expert=user)


class ConversationMessages(generics.ListCreateAPIView):
    """Read the thread (``?after=<id>`` for incremental polling) and post chat."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def _conversation(self):
        conversation = get_object_or_404(
            Conversation.objects.select_related('appointment'), pk=self.kwargs['pk'],
        )
        user = self.request.user
        if not _is_admin(user) and user.id not in {
            conversation.appointment.patient_id, conversation.appointment.expert_id,
        }:
            raise PermissionDenied('You are not a participant in this conversation.')
        return conversation

    def get_queryset(self):
        # Handshake payloads live in the same table but belong to the signalling
        # endpoint; returning them here would drop raw SDP between two humans.
        qs = self._conversation().messages.select_related('sender').exclude(
            kind__in=[Message.Kind.OFFER, Message.Kind.ANSWER, Message.Kind.ICE],
        )
        after = self.request.query_params.get('after')
        if after:
            qs = qs.filter(pk__gt=after)
        return qs[:500]

    def create(self, request, *args, **kwargs):
        """Post a chat line, then nudge the other participant.

        Uses :class:`SendMessageSerializer` rather than the model serializer so
        a client cannot inject ``kind`` / ``is_read`` / ``sender``.
        """
        conversation = self._conversation()
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            conversation=conversation, sender=request.user,
            kind=Message.Kind.TEXT, body=serializer.validated_data['body'],
            is_read=False,
        )
        conversation.save(update_fields=['last_activity_at'])

        appointment = conversation.appointment
        other = (appointment.expert
                 if request.user.id == appointment.patient_id
                 else appointment.patient)
        if other.id != request.user.id:
            send_notification(
                other, 'NEW_MESSAGE', 'New message',
                f'{request.user.get_full_name() or request.user.username} sent you a message.',
                related_object_type='Conversation', related_object_id=conversation.id,
            )
        return Response(MessageSerializer(message).data, status.HTTP_201_CREATED)


class ConversationSignal(APIView):
    """Relay WebRTC handshake payloads to the other participant.

    Kept separate from ``messages/`` so a client can never forge a chat line.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        conversation = self._conversation(request, pk)
        after = request.query_params.get('after')
        # LEAVE travels with the handshake so the other participant can end the
        # call instead of staring at a frozen image.
        qs = conversation.messages.filter(kind__in=[
            Message.Kind.OFFER, Message.Kind.ANSWER, Message.Kind.ICE, Message.Kind.LEAVE,
        ]).exclude(sender=request.user)
        if after:
            qs = qs.filter(pk__gt=after)
        return Response(MessageSerializer(qs[:100], many=True).data)

    def _conversation(self, request, pk):
        conversation = get_object_or_404(
            Conversation.objects.select_related('appointment'), pk=pk,
        )
        if not _is_admin(request.user) and request.user.id not in {
            conversation.appointment.patient_id, conversation.appointment.expert_id,
        }:
            raise PermissionDenied('You are not a participant in this conversation.')
        return conversation

    def post(self, request, pk):
        conversation = self._conversation(request, pk)
        serializer = SignallingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = Message.objects.create(
            conversation=conversation, sender=request.user,
            kind=serializer.validated_data['kind'],
            body=serializer.validated_data.get('payload', ''),
            is_read=True,
        )
        return Response({'id': message.id, 'kind': message.kind}, status.HTTP_201_CREATED)


class MarkThreadRead(APIView):
    """Flag every unread message in a thread as read."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        conversation = get_object_or_404(
            Conversation.objects.select_related('appointment'), pk=pk,
        )
        if not _is_admin(request.user) and request.user.id not in {
            conversation.appointment.patient_id, conversation.appointment.expert_id,
        }:
            raise PermissionDenied('You are not a participant in this conversation.')
        updated = conversation.messages.filter(is_read=False).exclude(
            sender=request.user,
        ).update(is_read=True)
        return Response({'marked_read': updated})


class ConsultationStats(APIView):
    """Administrator oversight: "view consultations"."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_admin(request.user):
            raise PermissionDenied('Administrator access is required.')
        qs = Appointment.objects.all()
        by_status = {s.lower(): qs.filter(status=s).count() for s in Appointment.Status.values}
        return Response({
            'total': qs.count(),
            'by_status': by_status,
            'pending': qs.filter(status=Appointment.Status.PENDING).count(),
            'completed': qs.filter(status=Appointment.Status.COMPLETED).count(),
            'open_slots': AvailabilitySlot.objects.open_to_patients().count(),
            'consultants': User.objects.filter(role=User.Role.EXPERT).count(),
            'patients_booked': qs.values('patient').distinct().count(),
        })

# --------------------------------------------------------------------------
# Specialist directory — "book appointment" needs someone to book
# --------------------------------------------------------------------------

def open_window_counts():
    """``expert_id -> open windows`` in one query, mirroring book() rules."""
    rows = (AvailabilitySlot.objects
            .filter(is_closed=False, starts_at__gt=timezone.now())
            .exclude(appointments__status__in=ACTIVE_APPOINTMENT_STATUSES)
            .values('expert_id').annotate(n=Count('id')))
    return {row['expert_id']: row['n'] for row in rows}


def accepting_only(queryset):
    """Windows from specialists who have not been pulled off the marketplace.

    A missing profile counts as accepting on purpose: the row is created by a
    signal, so absence must never silently empty the booking list.
    """
    return queryset.filter(
        Q(expert__consultant_profile__is_accepting_patients=True)
        | Q(expert__consultant_profile__isnull=True)
    )


class ExpertDirectory(generics.ListAPIView):
    """Specialized experts, filterable by specialty, nearest-first when the
    caller shares a location (the same coordinate pair the geolocation use case
    already uses). A suspended specialist disappears from everyone but an
    administrator.
    """

    serializer_class = ExpertProfileSerializer
    permission_classes = [permissions.AllowAny]

    def _origin(self):
        params = self.request.query_params
        try:
            return (float(params['lat']), float(params['lng']))
        except (KeyError, TypeError, ValueError):
            return None

    def get_queryset(self):
        qs = ExpertProfile.objects.select_related('user', 'region').filter(user__is_active=True)
        user = self.request.user
        if not (user and user.is_authenticated and _is_admin(user)):
            qs = qs.filter(is_accepting_patients=True)
        specialization = self.request.query_params.get('specialization')
        if specialization:
            qs = qs.filter(specialization__icontains=specialization)
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region_id=region)
        origin = self._origin()
        if origin:
            # Sorted before pagination, so "nearest" spans the whole directory
            # instead of the nearest few on page one.
            def key(profile):
                distance = profile.distance_from(*origin)
                return (distance is None, distance if distance is not None else 0.0)
            return sorted(qs, key=key)
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['origin'] = self._origin()
        context['open_counts'] = open_window_counts()
        return context


class ExpertMyProfile(generics.RetrieveUpdateAPIView):
    """A specialist's own listing: specialty, region, taking patients or not."""

    serializer_class = ExpertSelfSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'head', 'options', 'patch']

    def get_object(self):
        if not _is_consultant(self.request.user):
            raise PermissionDenied('Only specialists have a consultation profile.')
        profile, _ = ExpertProfile.objects.get_or_create(user=self.request.user)
        return profile


class ExpertProfileDetail(generics.RetrieveUpdateAPIView):
    """One specialist's listing; changing it is an administrator's call.

    Verifying is the moment worth telling the specialist about, so the flip
    notifies and lands in the audit log rather than being a silent checkbox.
    """

    serializer_class = ExpertProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'head', 'options', 'patch']
    queryset = ExpertProfile.objects.select_related('user', 'region')

    def partial_update(self, request, *args, **kwargs):
        if not _is_admin(request.user):
            raise PermissionDenied('Only an administrator can change another specialist listing.')
        profile = self.get_object()
        response = super().partial_update(request, *args, **kwargs)
        if 'is_verified' in request.data:
            profile.refresh_from_db()
            verified = profile.is_verified
            send_notification(
                profile.user, 'APPOINTMENT',
                'You are verified' if verified else 'Verification withdrawn',
                ('An administrator verified your specialist profile; the directory '
                 'now shows the verified badge against your name.')
                if verified else
                'An administrator withdrew the verification on your specialist profile.',
                related_object_type='ExpertProfile', related_object_id=profile.id,
            )
            _log(request, 'EXPERT_VERIFY',
                 ('Verified specialist ' if verified else 'Unverified specialist ')
                 + profile.user.username,
                 target_type='ExpertProfile', target_id=profile.id)
        return response
