"""Tests for scheduling, consultations, and messaging."""
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from geography.models import Region

from .models import Appointment, AvailabilitySlot, Conversation, Message


def future(hours=24, minutes=60):
    start = timezone.now() + timezone.timedelta(hours=hours)
    return start, start + timezone.timedelta(minutes=minutes)


class AvailabilityTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='exp', password='test1234!', role=User.Role.EXPERT)
        self.user = User.objects.create_user(
            username='pat', password='test1234!', role=User.Role.USER)

    def test_expert_can_publish_a_window(self):
        self.client.force_authenticate(user=self.expert)
        start, end = future()
        res = self.client.post('/api/consultations/availability/', {
            'starts_at': start.isoformat(), 'ends_at': end.isoformat(),
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AvailabilitySlot.objects.filter(expert=self.expert).count(), 1)

    def test_overlapping_window_is_rejected(self):
        self.client.force_authenticate(user=self.expert)
        start, end = future()
        self.client.post('/api/consultations/availability/', {
            'starts_at': start.isoformat(), 'ends_at': end.isoformat(),
        })
        overlapping_start = start + timezone.timedelta(minutes=15)
        res = self.client.post('/api/consultations/availability/', {
            'starts_at': overlapping_start.isoformat(),
            'ends_at': (end + timezone.timedelta(minutes=30)).isoformat(),
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AvailabilitySlot.objects.count(), 1)

    def test_window_must_end_after_it_starts(self):
        self.client.force_authenticate(user=self.expert)
        start, end = future()
        res = self.client.post('/api/consultations/availability/', {
            'starts_at': end.isoformat(), 'ends_at': start.isoformat(),
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ordinary_user_cannot_publish_availability(self):
        self.client.force_authenticate(user=self.user)
        start, end = future()
        res = self.client.post('/api/consultations/availability/', {
            'starts_at': start.isoformat(), 'ends_at': end.isoformat(),
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_expert_cannot_publish_under_a_colleagues_name(self):
        """Regression: ``expert`` is writable, so this must be refused."""
        colleague = User.objects.create_user(username='other_exp', password='test1234!',
                                              role=User.Role.EXPERT)
        self.client.force_authenticate(user=self.expert)
        start, end = future()
        res = self.client.post('/api/consultations/availability/', {
            'expert': colleague.pk,
            'starts_at': start.isoformat(), 'ends_at': end.isoformat(),
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AvailabilitySlot.objects.count(), 0)

    def test_admin_may_publish_on_behalf_of_an_expert(self):
        admin = User.objects.create_user(username='adm', password='test1234!',
                                          role=User.Role.ADMIN)
        self.client.force_authenticate(user=admin)
        start, end = future()
        res = self.client.post('/api/consultations/availability/', {
            'expert': self.expert.pk,
            'starts_at': start.isoformat(), 'ends_at': end.isoformat(),
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(AvailabilitySlot.objects.get().expert, self.expert)

    def test_other_expert_is_denied_not_crashed(self):
        """Regression: a non-owner lookup used to raise AttributeError -> 500."""
        colleague = User.objects.create_user(username='exp3', password='test1234!',
                                              role=User.Role.EXPERT)
        start, end = future()
        slot = AvailabilitySlot.objects.create(expert=self.expert, starts_at=start, ends_at=end)
        self.client.force_authenticate(user=colleague)
        res = self.client.get(f'/api/consultations/availability/{slot.pk}/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        res = self.client.patch(f'/api/consultations/availability/{slot.pk}/', {'note': 'hijacked'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(AvailabilitySlot.objects.get(pk=slot.pk).note, '')

    def test_list_only_shows_your_own_windows(self):
        other = User.objects.create_user(username='exp2', password='test1234!',
                                          role=User.Role.EXPERT)
        start, end = future()
        AvailabilitySlot.objects.create(expert=self.expert, starts_at=start, ends_at=end)
        AvailabilitySlot.objects.create(expert=other, starts_at=start, ends_at=end)
        self.client.force_authenticate(user=self.expert)
        res = self.client.get('/api/consultations/availability/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['results']), 1)


class BookingTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='exp', password='test1234!', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(
            username='pat', password='test1234!', role=User.Role.USER)
        start, end = future()
        self.slot = AvailabilitySlot.objects.create(
            expert=self.expert, starts_at=start, ends_at=end)
        self.client.force_authenticate(user=self.patient)

    def _book(self, slot=None):
        return self.client.post('/api/consultations/appointments/book/', {
            'slot': (slot or self.slot).pk, 'reason': 'Follow-up on a cough.',
        })

    def test_patient_can_book_an_open_window(self):
        res = self._book()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], Appointment.Status.PENDING)
        self.slot.refresh_from_db()
        self.assertTrue(self.slot.is_booked)

    def test_booking_creates_the_messaging_thread(self):
        self._book()
        self.assertEqual(Conversation.objects.count(), 1)

    def test_a_booked_window_is_no_longer_offered(self):
        self._book()
        res = self.client.get('/api/consultations/slots/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['results']), 0)

    def test_a_window_cannot_be_booked_twice(self):
        self._book()
        res = self._book()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_expert_cannot_book_their_own_window(self):
        self.client.force_authenticate(user=self.expert)
        res = self._book()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancelling_releases_the_window(self):
        appointment = self._book().data
        res = self.client.post(
            f"/api/consultations/appointments/{appointment['id']}/status/",
            {'action': 'cancel', 'reason': 'Travelling.'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.slot.refresh_from_db()
        self.assertFalse(self.slot.is_booked,
                         'A cancelled booking must give the window back.')
        res = self.client.get('/api/consultations/slots/')
        self.assertEqual(len(res.data['results']), 1)

    def test_patient_cannot_confirm_their_own_appointment(self):
        appointment = self._book().data
        res = self.client.post(
            f"/api/consultations/appointments/{appointment['id']}/status/",
            {'action': 'confirm'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_confirm_then_complete(self):
        appointment = self._book().data
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(
            f"/api/consultations/appointments/{appointment['id']}/status/",
            {'action': 'confirm'})
        self.assertEqual(res.data['status'], Appointment.Status.CONFIRMED)
        res = self.client.post(
            f"/api/consultations/appointments/{appointment['id']}/status/",
            {'action': 'complete', 'note': 'Advised warm leaf infusion.'})
        self.assertEqual(res.data['status'], Appointment.Status.COMPLETED)
        self.assertIsNotNone(res.data['completed_at'])

    def test_cannot_complete_before_it_is_confirmed(self):
        appointment = self._book().data
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(
            f"/api/consultations/appointments/{appointment['id']}/status/",
            {'action': 'complete'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_action_is_rejected(self):
        appointment = self._book().data
        res = self.client.post(
            f"/api/consultations/appointments/{appointment['id']}/status/",
            {'action': 'refunded'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class AppointmentVisibilityTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='exp', password='test1234!', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(
            username='pat', password='test1234!', role=User.Role.USER)
        self.stranger = User.objects.create_user(
            username='other', password='test1234!', role=User.Role.USER)
        start, end = future()
        self.slot = AvailabilitySlot.objects.create(
            expert=self.expert, starts_at=start, ends_at=end)
        self.client.force_authenticate(user=self.patient)
        self.appointment = Appointment.objects.create(
            patient=self.patient, expert=self.expert, slot=self.slot,
            status=Appointment.Status.CONFIRMED)

    def test_participant_sees_it(self):
        res = self.client.get(f"/api/consultations/appointments/{self.appointment.pk}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_outsider_cannot_see_it(self):
        self.client.force_authenticate(user=self.stranger)
        res = self.client.get(f"/api/consultations/appointments/{self.appointment.pk}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_is_scoped_per_role(self):
        res = self.client.get('/api/consultations/appointments/')
        self.assertEqual(len(res.data['results']), 1)
        self.client.force_authenticate(user=self.stranger)
        res = self.client.get('/api/consultations/appointments/')
        self.assertEqual(len(res.data['results']), 0)

    def test_only_the_expert_writes_consultation_notes(self):
        res = self.client.patch(
            f"/api/consultations/appointments/{self.appointment.pk}/",
            {'expert_notes': 'should be refused'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch(
            f"/api/consultations/appointments/{self.appointment.pk}/",
            {'expert_notes': 'Advised rest and fluids.'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class MessagingTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='exp', password='test1234!', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(
            username='pat', password='test1234!', role=User.Role.USER)
        self.appointment = Appointment.objects.create(
            patient=self.patient, expert=self.expert,
            status=Appointment.Status.CONFIRMED)
        self.conversation = Conversation.objects.create(appointment=self.appointment)

    def test_participant_posts_a_text_message(self):
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/messages/",
            {'body': 'Can we move to 4pm?'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['kind'], Message.Kind.TEXT)
        self.assertEqual(self.conversation.messages.count(), 1)

    def test_recipient_is_notified_of_a_message(self):
        from notifications.models import Notification
        self.client.force_authenticate(user=self.patient)
        self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/messages/",
            {'body': 'hello'})
        self.assertTrue(Notification.objects.filter(
            user=self.expert, type='NEW_MESSAGE').exists())

    def test_mark_read_leaves_your_own_messages_alone(self):
        Message.objects.create(conversation=self.conversation, sender=self.patient,
                               body='hi', is_read=False)
        Message.objects.create(conversation=self.conversation, sender=self.expert,
                               body='yo', is_read=False)
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/read/")
        self.assertEqual(res.data['marked_read'], 1)
        mine = self.conversation.messages.filter(sender=self.expert).first()
        self.assertFalse(mine.is_read)

    def test_signalling_endpoint_refuses_chat_kinds(self):
        """A client must not be able to forge a TEXT line as signalling."""
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/",
            {'kind': Message.Kind.TEXT, 'payload': 'forged'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_relayed_signal_is_only_seen_by_the_other_party(self):
        self.client.force_authenticate(user=self.patient)
        self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/",
            {'kind': Message.Kind.OFFER, 'payload': '{"sdp":"x"}'})
        as_sender = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/").data
        self.assertEqual(len(as_sender), 0, 'You should not receive your own offer back.')
        self.client.force_authenticate(user=self.expert)
        as_peer = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/").data
        self.assertEqual(len(as_peer), 1)

    def test_chat_thread_never_carries_signalling_payloads(self):
        self.client.force_authenticate(user=self.patient)
        self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/",
            {'kind': 'OFFER', 'payload': 'v=0-this-is-sdp'})
        self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/messages/",
            {'body': 'hello'})
        res = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/messages/")
        bodies = [row['body'] for row in res.data['results']]
        self.assertEqual(bodies, ['hello'])

    def test_signals_are_delivered_oldest_first(self):
        # The room queues ICE until the description lands, relying on order.
        self.client.force_authenticate(user=self.patient)
        for index in range(4):
            self.client.post(
                f"/api/consultations/conversations/{self.conversation.pk}/signal/",
                {'kind': 'ICE', 'payload': f'{{"candidate": "{index}"}}'})
        self.client.force_authenticate(user=self.expert)
        res = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/")
        ids = [row['id'] for row in res.data]
        self.assertEqual(ids, sorted(ids))

    def test_the_other_participant_is_told_you_left(self):
        self.client.force_authenticate(user=self.patient)
        self.client.post(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/",
            {'kind': 'LEAVE', 'payload': ''})
        res = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/")
        self.assertEqual([row['kind'] for row in res.data], [])
        self.client.force_authenticate(user=self.expert)
        res = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/signal/")
        self.assertEqual([row['kind'] for row in res.data], ['LEAVE'])

    def test_non_participant_cannot_read_the_thread(self):
        stranger = User.objects.create_user(username='nosy', password='test1234!')
        self.client.force_authenticate(user=stranger)
        res = self.client.get(
            f"/api/consultations/conversations/{self.conversation.pk}/messages/")
        self.assertIn(res.status_code,
                      (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))


class VideoRoomTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='exp', password='test1234!', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(
            username='pat', password='test1234!', role=User.Role.USER)
        self.appointment = Appointment.objects.create(
            patient=self.patient, expert=self.expert,
            status=Appointment.Status.PENDING)

    def test_joining_requires_a_confirmed_appointment(self):
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(
            f"/api/consultations/appointments/{self.appointment.pk}/start/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_join_returns_the_room_and_records_it(self):
        self.appointment.status = Appointment.Status.CONFIRMED
        self.appointment.save()
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(
            f"/api/consultations/appointments/{self.appointment.pk}/start/")
        # Joining is an action that returns the room, not a resource creation.
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['room_id'], str(self.appointment.room_id))
        conversation = Conversation.objects.get(appointment=self.appointment)
        self.assertTrue(conversation.messages.filter(kind=Message.Kind.JOIN).exists())


class ConsultationStatsTests(APITestCase):
    def test_only_administrators_see_the_overview(self):
        user = User.objects.create_user(username='pat', password='test1234!')
        expert = User.objects.create_user(username='exp', password='test1234!',
                                           role=User.Role.EXPERT)
        admin = User.objects.create_user(username='adm', password='test1234!',
                                         role=User.Role.ADMIN)
        for actor, expected in ((user, 403), (expert, 403), (admin, 200)):
            self.client.force_authenticate(user=actor)
            res = self.client.get('/api/consultations/stats/')
            self.assertEqual(res.status_code, expected, f'{actor.role} should get {expected}')
        self.assertIn('by_status', res.data)


class SlotReleaseModelTests(TestCase):
    """The window-release rule lives on the model, so test it directly."""

    def setUp(self):
        self.expert = User.objects.create_user(username='exp', password='test1234!',
                                                role=User.Role.EXPERT)
        self.patient = User.objects.create_user(username='pat', password='test1234!')
        start = timezone.now() + timezone.timedelta(hours=1)
        self.slot = AvailabilitySlot.objects.create(
            expert=self.expert, starts_at=start, ends_at=start + timezone.timedelta(minutes=30))

    def _book(self, appointment_status):
        return Appointment.objects.create(
            patient=self.patient, expert=self.expert, slot=self.slot,
            status=appointment_status)

    def test_pending_and_confirmed_bookings_hold_the_window(self):
        for live in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            Appointment.objects.all().delete()
            self._book(live)
            self.assertTrue(self.slot.is_booked, f'{live} should block the window')
            self.assertFalse(self.slot.is_open_to_patients())

    def test_finished_bookings_release_the_window(self):
        for finished in (Appointment.Status.CANCELLED, Appointment.Status.COMPLETED,
                        Appointment.Status.NO_SHOW):
            Appointment.objects.all().delete()
            self._book(finished)
            self.assertFalse(self.slot.is_booked, f'{finished} should free the window')
            self.assertTrue(self.slot.is_open_to_patients())

    def test_past_windows_are_never_bookable(self):
        past = timezone.now() - timezone.timedelta(hours=2)
        slot = AvailabilitySlot.objects.create(
            expert=self.expert, starts_at=past, ends_at=past + timezone.timedelta(minutes=30))
        self.assertFalse(slot.is_open_to_patients())


class ExpertDirectoryTests(APITestCase):
    """Item: the diagram picks a *specialized* expert, by specialty and place."""

    def setUp(self):
        self.centre = Region.objects.create(name='Centre', latitude=3.87, longitude=11.52)
        self.north = Region.objects.create(name='North', latitude=7.2, longitude=14.15)
        self.near = User.objects.create_user(username='near_exp', password='pw', role=User.Role.EXPERT)
        self.far = User.objects.create_user(username='far_exp', password='pw', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(username='pat_dir', password='pw', role=User.Role.USER)
        self.admin = User.objects.create_user(username='adm_dir', password='pw', role=User.Role.ADMIN)
        for profile_user, region, spec in [(self.near, self.centre, 'Fever and malaria'),
                                           (self.far, self.north, 'Safety documentation')]:
            profile = profile_user.consultant_profile
            profile.region = region
            profile.specialization = spec
            profile.is_verified = True
            profile.save()
        start = timezone.now() + timedelta(hours=24)
        AvailabilitySlot.objects.create(expert=self.near, starts_at=start,
                                        ends_at=start + timedelta(minutes=30))
        AvailabilitySlot.objects.create(expert=self.far, starts_at=start + timedelta(hours=3),
                                        ends_at=start + timedelta(hours=3, minutes=30))

    def _user(self, u):
        return u.consultant_profile

    def test_directory_lists_specialists_with_what_patients_filter_on(self):
        res = self.client.get('/api/consultations/experts/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        by_name = {row['username']: row for row in rows}
        self.assertEqual(by_name['near_exp']['specialization'], 'Fever and malaria')
        self.assertEqual(by_name['near_exp']['region_name'], 'Centre')
        self.assertEqual(by_name['near_exp']['open_windows'], 1)

    def test_specialization_filter_narrows_the_list(self):
        res = self.client.get('/api/consultations/experts/?specialization=malaria')
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual([row['username'] for row in rows], ['near_exp'])

    def test_location_makes_it_nearest_first_and_reports_distance(self):
        res = self.client.get('/api/consultations/experts/?lat=3.9&lng=11.6')
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual([row['username'] for row in rows], ['near_exp', 'far_exp'])
        self.assertIsNotNone(rows[0]['distance_km'])
        self.assertLess(rows[0]['distance_km'], rows[1]['distance_km'])

    def test_a_suspended_specialist_disappears_from_patients(self):
        self._user(self.far).is_accepting_patients = False
        self._user(self.far).save()
        res = self.client.get('/api/consultations/experts/')
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertNotIn('far_exp', [row['username'] for row in rows])

        self.client.force_authenticate(user=self.patient)
        res = self.client.get('/api/consultations/slots/')
        self.assertNotIn('far_exp', [row['expert_name'] for row in res.data['results']])

        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/consultations/experts/')
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertIn('far_exp', [row['username'] for row in rows])

    def test_an_unverified_specialist_is_listed_but_flagged(self):
        self._user(self.near).is_verified = False
        self._user(self.near).save()
        res = self.client.get('/api/consultations/experts/')
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertFalse([r for r in rows if r['username'] == 'near_exp'][0]['is_verified'])


class ExpertProfilePermissionTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(username='self_exp', password='pw', role=User.Role.EXPERT)
        self.other = User.objects.create_user(username='other_exp', password='pw', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(username='pat_prof', password='pw', role=User.Role.USER)
        self.admin = User.objects.create_user(username='adm_prof', password='pw', role=User.Role.ADMIN)
        self.region = Region.objects.create(name='Littoral', latitude=4.05, longitude=9.7)

    def test_specialist_sets_their_own_listing(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch('/api/consultations/experts/me/',
                                {'specialization': 'Wound care', 'region': self.region.pk},
                                format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.expert.consultant_profile.refresh_from_db()
        self.assertEqual(self.expert.consultant_profile.specialization, 'Wound care')
        self.assertEqual(self.expert.consultant_profile.region_id, self.region.pk)

    def test_a_specialist_cannot_verify_themselves(self):
        self.client.force_authenticate(user=self.expert)
        self.client.patch('/api/consultations/experts/me/',
                          {'specialization': 'x', 'is_verified': True}, format='json')
        self.expert.consultant_profile.refresh_from_db()
        self.assertFalse(self.expert.consultant_profile.is_verified)

    def test_a_patient_has_no_specialist_listing(self):
        self.client.force_authenticate(user=self.patient)
        self.assertEqual(self.client.get('/api/consultations/experts/me/').status_code,
                         status.HTTP_403_FORBIDDEN)

    def test_only_an_admin_may_change_another_listing(self):
        profile = self.other.consultant_profile
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch(f'/api/consultations/experts/{profile.pk}/',
                                {'is_verified': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(f'/api/consultations/experts/{profile.pk}/',
                                {'is_verified': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertTrue(profile.is_verified)

    def test_verification_notifies_the_specialist_and_is_audited(self):
        from audit.models import AuditLog
        from notifications.models import Notification
        profile = self.other.consultant_profile
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/consultations/experts/{profile.pk}/',
                          {'is_verified': True}, format='json')
        self.assertTrue(Notification.objects.filter(user=self.other).exists())
        self.assertTrue(AuditLog.objects.filter(action='EXPERT_VERIFY').exists())

    def test_a_profile_exists_for_every_expert_without_being_created_twice(self):
        from consultations.models import ExpertProfile
        fresh = User.objects.create_user(username='brand_new_exp', password='pw',
                                         role=User.Role.EXPERT)
        self.assertEqual(ExpertProfile.objects.filter(user=fresh).count(), 1)


class ConsultationTransportTests(APITestCase):
    """Item: TURN/STUN must be a deployment setting, not a bundle literal."""

    def setUp(self):
        self.expert = User.objects.create_user(username='ice_exp', password='pw', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(username='ice_pat', password='pw', role=User.Role.USER)
        start = timezone.now() + timedelta(hours=2)
        self.slot = AvailabilitySlot.objects.create(expert=self.expert, starts_at=start,
                                                    ends_at=start + timedelta(minutes=30))

    def test_join_hands_back_the_configured_ice_servers(self):
        self.client.force_authenticate(user=self.patient)
        booked = self.client.post('/api/consultations/appointments/book/',
                                  {'slot': self.slot.pk, 'reason': 'ice'}, format='json')
        self.assertEqual(booked.status_code, status.HTTP_201_CREATED)
        appointment_id = booked.data['id']
        self.client.force_authenticate(user=self.expert)
        self.client.post(f'/api/consultations/appointments/{appointment_id}/status/',
                         {'action': 'confirm'}, format='json')
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(f'/api/consultations/appointments/{appointment_id}/start/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['ice_servers'], [{'urls': 'stun:stun.l.google.com:19302'}])

    def test_a_turn_relay_can_be_added_without_touching_the_client(self):
        from django.test import override_settings
        relay = [{'urls': 'stun:stun.example.cm:3478'},
                 {'urls': 'turn:turn.example.cm:3478', 'username': 'u', 'credential': 'c'}]
        self.client.force_authenticate(user=self.patient)
        booked = self.client.post('/api/consultations/appointments/book/',
                                  {'slot': self.slot.pk, 'reason': 'ice2'}, format='json')
        appointment_id = booked.data['id']
        self.client.force_authenticate(user=self.expert)
        self.client.post(f'/api/consultations/appointments/{appointment_id}/status/',
                         {'action': 'confirm'}, format='json')
        self.client.force_authenticate(user=self.patient)
        with override_settings(WEBRTC_ICE_SERVERS=relay):
            res = self.client.post(f'/api/consultations/appointments/{appointment_id}/start/')
        self.assertEqual(res.data['ice_servers'], relay)


class RescheduleTests(APITestase if False else APITestCase):
    """Item: "manage appointments" has to include moving one, not just cancelling."""

    def setUp(self):
        self.expert = User.objects.create_user(username='rs_exp', password='pw', role=User.Role.EXPERT)
        self.other_expert = User.objects.create_user(username='rs_exp2', password='pw', role=User.Role.EXPERT)
        self.patient = User.objects.create_user(username='rs_pat', password='pw', role=User.Role.USER)
        self.bystander = User.objects.create_user(username='rs_by', password='pw', role=User.Role.USER)
        base = timezone.now() + timedelta(hours=24)
        self.slot_a = self._slot(self.expert, base)
        self.slot_b = self._slot(self.expert, base + timedelta(hours=3))
        self.slot_taken = self._slot(self.expert, base + timedelta(hours=6))
        self.slot_foreign = self._slot(self.other_expert, base + timedelta(hours=9))
        self.client.force_authenticate(user=self.patient)
        booked = self.client.post('/api/consultations/appointments/book/',
                                  {'slot': self.slot_a.pk, 'reason': 'first'}, format='json')
        self.assertEqual(booked.status_code, status.HTTP_201_CREATED)
        self.appointment_id = booked.data['id']
        self.client.force_authenticate(user=self.expert)
        self.client.post(f'/api/consultations/appointments/{self.appointment_id}/status/',
                         {'action': 'confirm'}, format='json')

    @staticmethod
    def _slot(expert, starts_at):
        return AvailabilitySlot.objects.create(expert=expert, starts_at=starts_at,
                                                ends_at=starts_at + timedelta(minutes=30))

    def _move(self, slot, expected=None, user=None, data=None):
        self.client.force_authenticate(user=user or self.patient)
        res = self.client.post(f'/api/consultations/appointments/{self.appointment_id}/reschedule/',
                               data if data is not None else {'slot': slot.pk}, format='json')
        if expected is not None:
            self.assertEqual(res.status_code, expected)
        return res

    def test_a_patient_move_releases_the_old_window_and_asks_again(self):
        res = self._move(self.slot_b, expected=status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'PENDING')
        self.assertEqual(res.data['slot_detail']['id'], self.slot_b.pk)
        self.slot_a.refresh_from_db()
        self.assertTrue(self.slot_a.is_open_to_patients())
        self.slot_b.refresh_from_db()
        self.assertFalse(self.slot_b.is_open_to_patients())

    def test_a_specialist_move_keeps_the_confirmation(self):
        res = self._move(self.slot_b, expected=status.HTTP_200_OK, user=self.expert)
        self.assertEqual(res.data['status'], 'CONFIRMED')

    def test_the_thread_records_the_move(self):
        self._move(self.slot_b, expected=status.HTTP_200_OK, data={'slot': self.slot_b.pk,
                                                                   'reason': 'I am travelling that day'})
        appointment = Appointment.objects.get(pk=self.appointment_id)
        last = appointment.conversation.messages.order_by('-id').first()
        self.assertIn('Moved from', last.body)
        self.assertIn('travelling', last.body)

    def test_a_window_cannot_be_moved_onto_someone_else(self):
        res = self._move(self.slot_foreign, expected=status.HTTP_400_BAD_REQUEST)
        self.assertIn('same specialist', str(res.data))

    def test_a_taken_window_is_refused(self):
        self.client.force_authenticate(user=self.bystander)
        taken = self.client.post('/api/consultations/appointments/book/',
                                 {'slot': self.slot_taken.pk}, format='json')
        self.assertEqual(taken.status_code, status.HTTP_201_CREATED)
        res = self._move(self.slot_taken, expected=status.HTTP_400_BAD_REQUEST)
        self.assertIn('no longer bookable', str(res.data))

    def test_the_same_window_is_not_a_move(self):
        res = self._move(self.slot_a, expected=status.HTTP_400_BAD_REQUEST)
        self.assertIn('already on this window', str(res.data))

    def test_a_finished_appointment_cannot_be_moved(self):
        self.client.force_authenticate(user=self.expert)
        self.client.post(f'/api/consultations/appointments/{self.appointment_id}/status/',
                         {'action': 'complete', 'note': 'done'}, format='json')
        res = self._move(self.slot_b, expected=status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cannot move', str(res.data))

    def test_a_stranger_cannot_reschedule_someone_elses_appointment(self):
        res = self._move(self.slot_b, user=self.bystander)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_released_window_can_be_booked_by_someone_else(self):
        self._move(self.slot_b, expected=status.HTTP_200_OK)
        self.client.force_authenticate(user=self.bystander)
        res = self.client.post('/api/consultations/appointments/book/',
                               {'slot': self.slot_a.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_the_move_is_notified_and_audited(self):
        from audit.models import AuditLog
        from notifications.models import Notification
        self._move(self.slot_b, expected=status.HTTP_200_OK)
        self.assertTrue(Notification.objects.filter(user=self.expert,
                                                    type='APPOINTMENT_RESCHEDULED').exists())
        self.assertTrue(AuditLog.objects.filter(action='APPOINTMENT_RESCHEDULE').exists())
