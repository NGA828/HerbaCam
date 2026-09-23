"""Tests for the symptom vocabulary's deliberately narrower permissions.

Plant and article content is curator-writable, but the symptom list is a shared
controlled vocabulary: renaming or deleting an entry silently relabels every
historical contribution that matched on it, including evidence already reviewed.
That is why writes here stay with the administrator, and these tests exist to
make the asymmetry explicit rather than accidental.
"""
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from symptoms.models import Symptom

ENDPOINT = '/api/symptoms/admin/'


class SymptomVocabularyPermissionTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='sym_expert', password='test1234!', role=User.Role.EXPERT)
        self.admin = User.objects.create_user(
            username='sym_admin', password='test1234!', role=User.Role.ADMIN)
        self.cough = Symptom.objects.create(name='Cough', description='Persistent cough')

    def test_expert_can_read_the_vocabulary_for_review(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.get(ENDPOINT)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_expert_cannot_create_a_symptom(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(ENDPOINT, {'name': 'Night sweats'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Symptom.objects.filter(name='Night sweats').exists())

    def test_expert_cannot_rename_or_delete_an_existing_symptom(self):
        self.client.force_authenticate(user=self.expert)
        renamed = self.client.patch(f'{ENDPOINT}{self.cough.pk}/', {'name': 'Chesty cough'})
        self.assertEqual(renamed.status_code, status.HTTP_403_FORBIDDEN)
        deleted = self.client.delete(f'{ENDPOINT}{self.cough.pk}/')
        self.assertEqual(deleted.status_code, status.HTTP_403_FORBIDDEN)
        self.cough.refresh_from_db()
        self.assertEqual(self.cough.name, 'Cough')

    def test_admin_can_curate_the_vocabulary(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(ENDPOINT, {'name': 'Night sweats', 'category': 'General'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_anonymous_readers_get_the_public_symptom_list(self):
        res = self.client.get('/api/symptoms/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
