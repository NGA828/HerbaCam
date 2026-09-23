"""Tests for user feedback and administrator triage."""
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from notifications.models import Notification

from .models import Feedback


class FeedbackApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pat', password='test1234!')
        self.expert = User.objects.create_user(username='exp', password='test1234!',
                                               role=User.Role.EXPERT)
        self.admin = User.objects.create_user(username='adm', password='test1234!',
                                              role=User.Role.ADMIN)

    def _send(self, **extra):
        payload = {'category': Feedback.Category.BUG, 'message': 'Upload fails on PNGs.'}
        payload.update(extra)
        return self.client.post('/api/feedback/send/', payload)

    def test_any_signed_in_user_can_send_feedback(self):
        self.client.force_authenticate(user=self.user)
        res = self._send()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user'], self.user.id)
        self.assertEqual(res.data['status'], Feedback.Status.NEW)

    def test_anonymous_users_are_refused(self):
        res = self._send()
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_feedback_is_required(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/feedback/send/', {'category': 'BUG'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_administrators_read_the_queue(self):
        self.client.force_authenticate(user=self.user)
        self._send()
        for actor, expected in ((self.user, 403), (self.expert, 403), (self.admin, 200)):
            self.client.force_authenticate(user=actor)
            res = self.client.get('/api/feedback/')
            self.assertEqual(res.status_code, expected, f'{actor.role} expected {expected}')

    def test_a_user_cannot_resolve_their_own_ticket(self):
        self.client.force_authenticate(user=self.user)
        feedback_id = self._send().data['id']
        res = self.client.patch(f'/api/feedback/{feedback_id}/',
                                {'status': Feedback.Status.RESOLVED})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        feedback = Feedback.objects.get(pk=feedback_id)
        self.assertEqual(feedback.status, Feedback.Status.NEW)

    def test_admin_reply_notifies_the_author_once(self):
        self.client.force_authenticate(user=self.user)
        feedback_id = self._send().data['id']
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(f'/api/feedback/{feedback_id}/', {
            'status': Feedback.Status.RESOLVED, 'admin_response': 'Fixed in this release.'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        feedback = Feedback.objects.get(pk=feedback_id)
        self.assertIsNotNone(feedback.resolved_at)
        self.assertEqual(
            Notification.objects.filter(user=self.user, type='FEEDBACK_REPLY').count(), 1)

    def test_re_resolving_does_not_double_notify(self):
        self.client.force_authenticate(user=self.user)
        feedback_id = self._send().data['id']
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/feedback/{feedback_id}/', {'status': Feedback.Status.RESOLVED})
        self.client.patch(f'/api/feedback/{feedback_id}/', {'admin_response': 'again'})
        self.assertEqual(
            Notification.objects.filter(user=self.user, type='FEEDBACK_REPLY').count(), 1)

    def test_rating_is_optional_but_bounded(self):
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self._send(rating=4).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._send(rating=9).status_code, status.HTTP_400_BAD_REQUEST)
