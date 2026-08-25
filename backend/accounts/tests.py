"""Tests for HerbaCam backend."""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from accounts.models import User
from plants.models import Plant, PlantLocalName, PlantPart
from symptoms.models import Symptom
from knowledge.models import TraditionalUse, KnowledgeSubmission, PreparationMethod
from geography.models import Region
from evidence.models import Evidence
from safety.models import SafetyInformation


class UserModelTest(TestCase):
    def test_create_user(self):
        user = User.objects.create_user(username='testuser', password='test1234!', email='test@test.com')
        self.assertEqual(user.role, User.Role.USER)
        self.assertTrue(user.is_active)

    def test_create_practitioner(self):
        user = User.objects.create_user(username='prac', password='test1234!', role=User.Role.PRACTITIONER)
        self.assertTrue(user.is_practitioner)
        self.assertFalse(user.is_expert)

    def test_create_expert(self):
        user = User.objects.create_user(username='expert', password='test1234!', role=User.Role.EXPERT)
        self.assertTrue(user.is_expert)
        self.assertFalse(user.is_practitioner)


class AuthAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='test1234!', email='test@test.com')

    def test_register(self):
        data = {
            'username': 'newuser', 'email': 'new@test.com',
            'first_name': 'New', 'last_name': 'User',
            'password': 'StrongP@ss123', 'password_confirm': 'StrongP@ss123',
        }
        res = self.client.post('/api/auth/register/', data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('tokens', res.data)

    def test_login(self):
        res = self.client.post('/api/auth/login/', {'username': 'testuser', 'password': 'test1234!'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)

    def test_login_invalid(self):
        res = self.client.post('/api/auth/login/', {'username': 'testuser', 'password': 'wrong'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_requires_auth(self):
        res = self.client.get('/api/auth/profile/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_authenticated(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/auth/profile/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['username'], 'testuser')


class PlantsAPITest(APITestCase):
    def setUp(self):
        self.plant = Plant.objects.create(
            scientific_name='Test plant', common_name='Test Common', family='Testaceae'
        )

    def test_list_plants(self):
        res = self.client.get('/api/plants/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['count'], 1)

    def test_plant_detail(self):
        res = self.client.get(f'/api/plants/{self.plant.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['scientific_name'], 'Test plant')

    def test_plant_search(self):
        res = self.client.get('/api/plants/?search=Test')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data['count'], 1)


class SymptomSearchTest(APITestCase):
    def setUp(self):
        self.plant = Plant.objects.create(scientific_name='TestSym', common_name='TestSym')
        self.symptom = Symptom.objects.create(name='Headache', category='Neurological')
        self.region = Region.objects.create(name='TestRegion')
        TraditionalUse.objects.create(
            plant=self.plant, symptom=self.symptom, region=self.region,
            description='Test use', is_verified=True
        )

    def test_search_by_symptom(self):
        res = self.client.get('/api/symptoms/search/?q=Headache')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(res.data['results']), 1)

    def test_search_no_results(self):
        res = self.client.get('/api/symptoms/search/?q=NonexistentSymptom99')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['results']), 0)


class KnowledgeWorkflowTest(APITestCase):
    def setUp(self):
        self.practitioner = User.objects.create_user(
            username='pract', password='test1234!', role=User.Role.PRACTITIONER
        )
        self.expert = User.objects.create_user(
            username='expert', password='test1234!', role=User.Role.EXPERT
        )
        self.plant = Plant.objects.create(scientific_name='WorkflowPlant')
        self.symptom = Symptom.objects.create(name='TestSym')
        self.region = Region.objects.create(name='TestReg')

    def test_practitioner_submit(self):
        self.client.force_authenticate(user=self.practitioner)
        data = {
            'plant': self.plant.id,
            'symptom': self.symptom.id,
            'region': self.region.id,
            'traditional_use_description': 'Test traditional use',
        }
        res = self.client.post('/api/knowledge/submissions/create/', data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_expert_approve(self):
        submission = KnowledgeSubmission.objects.create(
            contributor=self.practitioner, plant=self.plant, symptom=self.symptom,
            region=self.region, traditional_use_description='Test',
            status=KnowledgeSubmission.Status.SUBMITTED,
        )
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(f'/api/knowledge/submissions/{submission.id}/review/', {
            'action': 'approve', 'comments': 'Looks good',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        submission.refresh_from_db()
        self.assertEqual(submission.status, KnowledgeSubmission.Status.PUBLISHED)

    def test_expert_reject(self):
        submission = KnowledgeSubmission.objects.create(
            contributor=self.practitioner, plant=self.plant,
            traditional_use_description='Test',
            status=KnowledgeSubmission.Status.SUBMITTED,
        )
        self.client.force_authenticate(user=self.expert)
        res = self.client.post(f'/api/knowledge/submissions/{submission.id}/review/', {
            'action': 'reject', 'reason': 'Insufficient evidence',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        submission.refresh_from_db()
        self.assertEqual(submission.status, KnowledgeSubmission.Status.REJECTED)

    def test_user_cannot_submit(self):
        user = User.objects.create_user(username='reg', password='test1234!', role=User.Role.USER)
        self.client.force_authenticate(user=user)
        data = {
            'plant': self.plant.id,
            'traditional_use_description': 'Test',
        }
        res = self.client.post('/api/knowledge/submissions/create/', data)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class PermissionTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='user', password='test1234!')
        self.admin = User.objects.create_user(
            username='admin', password='test1234!', role=User.Role.ADMIN, is_staff=True, is_superuser=True
        )

    def test_user_cannot_manage_users(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data.get('results', res.data)), 0)

    def test_admin_can_manage_users(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/auth/users/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreater(len(res.data.get('results', res.data)), 0)


class PreservationRiskTest(TestCase):
    def setUp(self):
        self.plant = Plant.objects.create(scientific_name='RiskPlant')
        self.region = Region.objects.create(name='RiskRegion')

    def test_risk_calculation(self):
        from preservation.services import calculate_plant_risk
        assessment = calculate_plant_risk(self.plant)
        self.assertIsNotNone(assessment)
        self.assertGreaterEqual(assessment.risk_score, 0)
        self.assertLessEqual(assessment.risk_score, 100)
        self.assertIn(assessment.risk_level, ['LOW', 'MODERATE', 'HIGH'])

    def test_high_risk_no_contributions(self):
        from preservation.services import calculate_plant_risk
        assessment = calculate_plant_risk(self.plant)
        # Plant with no contributions should be high risk
        self.assertGreater(assessment.risk_score, 50)
