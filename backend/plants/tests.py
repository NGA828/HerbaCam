"""Tests for plant-library curation rights.

The ANCESTOR use-case diagram hands ``manage plant information`` to the
specialized expert, so these assert what a curator may and may not do to the
species database, and that widening the write path did not widen the read path.
"""
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from audit.models import AuditLog
from plants.models import Plant

ENDPOINT = '/api/plants/admin/'


def rows(payload):
    """The management list is paginated in some configurations, plain in others."""
    if isinstance(payload, dict):
        return payload.get('results', [])
    return payload


def plant_payload(scientific_name='Zingiber officinale'):
    return {
        'scientific_name': scientific_name,
        'common_name': 'Ginger',
        'family': 'Zingiberaceae',
        'is_published': True,
    }


class PlantCurationPermissionTests(APITestCase):
    def setUp(self):
        self.expert = User.objects.create_user(
            username='cur_expert', password='test1234!', role=User.Role.EXPERT)
        self.admin = User.objects.create_user(
            username='cur_admin', password='test1234!', role=User.Role.ADMIN)
        self.practitioner = User.objects.create_user(
            username='cur_pract', password='test1234!', role=User.Role.PRACTITIONER)
        self.patient = User.objects.create_user(
            username='cur_user', password='test1234!', role=User.Role.USER)
        self.hidden = Plant.objects.create(
            scientific_name='Prunus africana', common_name='African Cherry', is_published=False)

    # -- the use case: the specialized expert manages plant information ------

    def test_expert_can_create_a_plant(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(ENDPOINT, plant_payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Plant.objects.filter(scientific_name='Zingiber officinale').exists())

    def test_expert_can_edit_a_plant(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch(f'{ENDPOINT}{self.hidden.pk}/', {'description': 'Bark harvested under permit.'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.hidden.refresh_from_db()
        self.assertEqual(self.hidden.description, 'Bark harvested under permit.')

    def test_expert_can_publish_a_plant(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.patch(f'{ENDPOINT}{self.hidden.pk}/', {'is_published': True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.hidden.refresh_from_db()
        self.assertTrue(self.hidden.is_published)

    def test_expert_can_delete_a_plant(self):
        """'Manage' includes withdrawal; every write is audited, see below."""
        doomed = Plant.objects.create(scientific_name='Doomed species')
        self.client.force_authenticate(user=self.expert)
        res = self.client.delete(f'{ENDPOINT}{doomed.pk}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Plant.objects.filter(pk=doomed.pk).exists())

    def test_expert_writes_are_audited(self):
        self.client.force_authenticate(user=self.expert)
        self.client.post(ENDPOINT, plant_payload())
        entry = AuditLog.objects.filter(action='PLANT_CREATE').first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.user, self.expert)
        self.assertEqual(entry.target_type, 'Plant')

    # -- administrators keep the same authority, they are not displaced ------

    def test_admin_has_identical_rights(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(ENDPOINT, plant_payload('Mangifera indica'))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    # -- roles the diagram does not give curation to -------------------------

    def test_practitioner_cannot_write_plants(self):
        self.client.force_authenticate(user=self.practitioner)
        res = self.client.post(ENDPOINT, plant_payload())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Plant.objects.filter(scientific_name='Zingiber officinale').exists())

    def test_registered_user_cannot_write_plants(self):
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(ENDPOINT, plant_payload())
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # -- the read path must not have moved along with the write path ---------

    def test_management_list_never_leaks_unpublished_records(self):
        res = self.client.get(ENDPOINT)
        self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertNotIn('Prunus africana', res.content.decode())

    def test_public_catalogue_still_shows_only_published_plants(self):
        res = self.client.get('/api/plants/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [row['scientific_name'] for row in rows(res.data)]
        self.assertNotIn('Prunus africana', names)

    def test_expert_can_read_unpublished_records_for_review(self):
        self.client.force_authenticate(user=self.expert)
        res = self.client.get(ENDPOINT)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [row['scientific_name'] for row in rows(res.data)]
        self.assertIn('Prunus africana', names)
