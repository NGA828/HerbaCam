"""Tests for the grounded assistant.

The OpenRouter call is mocked throughout: these tests assert on what the
platform does around the model — persistence, grounding, scoping, and failure
handling — not on the model's prose.
"""
from unittest import mock

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from geography.models import Region
from knowledge.models import TraditionalUse
from plants.models import Plant
from symptoms.models import Symptom

from .models import ChatMessage, ChatSession
from .services import answer, build_grounding, find_relevant_ids


def fake_openrouter_reply(content, ok=True, status_code=200):
    """Stand-in for ``requests.Response`` covering the shapes we branch on."""
    response = mock.Mock()
    response.ok = ok
    response.status_code = status_code
    response.json.return_value = {
        'choices': [{'message': {'role': 'assistant', 'content': content}}]
    }
    return response


class GroundingTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(name='Centre', latitude=3.5, longitude=11.5)
        self.plant = Plant.objects.create(
            scientific_name='Azadirachta indica', common_name='Neem',
            family='Meliaceae', is_published=True)
        self.plant.regions.add(self.region)
        self.symptom = Symptom.objects.create(name='Fever', category='General')
        self.use = TraditionalUse.objects.create(
            plant=self.plant, symptom=self.symptom,
            description='Crushed leaves are applied to reduce temperature.',
            dosage='One teacup (~150 ml)', frequency='Twice daily',
            is_verified=True,
        )

    def test_relevant_ids_match_plants_and_symptoms_by_word(self):
        plant_ids, symptom_ids = find_relevant_ids('Is neem good for fever?')
        self.assertIn(self.plant.id, plant_ids)
        self.assertIn(self.symptom.id, symptom_ids)

    def test_unmatched_question_produces_no_grounding(self):
        extract, cited = build_grounding('what is the capital of the moon')
        self.assertEqual(extract, '')
        self.assertEqual(cited, [])

    def test_extract_carries_the_reported_dose_and_cites_the_plant(self):
        extract, cited = build_grounding('tell me about neem for fever')
        self.assertIn('One teacup (~150 ml)', extract)
        self.assertIn('Twice daily', extract)
        self.assertIn('verified', extract)
        self.assertEqual(cited, [self.plant.id])

    def test_unpublished_plants_are_never_cited(self):
        self.plant.is_published = False
        self.plant.save()
        extract, cited = build_grounding('tell me about neem for fever')
        self.assertEqual(extract, '')
        self.assertEqual(cited, [])


class AnswerServiceTests(TestCase):
    @mock.patch('assistant.services.settings.OPENROUTER_API_KEY', '')
    def test_missing_key_reports_configuration_instead_of_calling(self):
        with mock.patch('assistant.services.requests.post') as post:
            result = answer('hello')
        self.assertFalse(result['success'])
        self.assertIn('OPENROUTER_API_KEY', result['error'])
        post.assert_not_called()

    @mock.patch('assistant.services.settings.OPENROUTER_API_KEY', 'test-key')
    @mock.patch('assistant.services.settings.OPENROUTER_MODEL', 'test/model')
    @mock.patch('assistant.services.requests.post')
    def test_history_and_system_prompt_are_sent(self, post):
        post.return_value = fake_openrouter_reply('Neem is documented for fever.')
        session = ChatSession.objects.create(
            user=User.objects.create_user(username='u', password='test1234!'))
        ChatMessage.objects.create(session=session, role='USER', content='earlier question')
        ChatMessage.objects.create(session=session, role='ASSISTANT', content='earlier answer')

        result = answer('and for children?', history=list(session.messages.all()))

        self.assertTrue(result['success'])
        _, kwargs = post.call_args
        sent = kwargs['json']['messages']
        self.assertEqual(sent[0]['role'], 'system')
        self.assertIn('earlier question', sent[1]['content'])
        self.assertEqual(sent[-1]['content'], 'and for children?')

    @mock.patch('assistant.services.settings.OPENROUTER_API_KEY', 'test-key')
    @mock.patch('assistant.services.requests.post')
    def test_provider_error_is_reported_not_raised(self, post):
        response = mock.Mock(ok=False, status_code=401)
        response.json.return_value = {'error': {'message': 'Invalid API key'}}
        post.return_value = response
        result = answer('hello')
        self.assertFalse(result['success'])
        self.assertIn('Invalid API key', result['error'])

    @mock.patch('assistant.services.settings.OPENROUTER_API_KEY', 'test-key')
    @mock.patch('assistant.services.requests.post')
    def test_malformed_payload_is_handled(self, post):
        post.return_value = fake_openrouter_reply('')
        post.return_value.json.return_value = {'unexpected': True}
        result = answer('hello')
        self.assertFalse(result['success'])


class ChatApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pat', password='test1234!')
        self.other = User.objects.create_user(username='other', password='test1234!')
        self.client.force_authenticate(user=self.user)

    def test_anonymous_users_cannot_chat(self):
        self.client.force_authenticate(user=None)
        res = self.client.post('/api/assistant/ask/', {'message': 'hi'})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ask_creates_a_session_and_both_turns(self):
        with mock.patch('assistant.services.settings.OPENROUTER_API_KEY', 'test-key'), \
             mock.patch('assistant.services.requests.post',
                        return_value=fake_openrouter_reply('Neem is used for fever.')):
            res = self.client.post('/api/assistant/ask/', {'message': 'What is neem used for?'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['reply']['role'], 'ASSISTANT')
        self.assertEqual(ChatSession.objects.filter(user=self.user).count(), 1)
        self.assertEqual(ChatMessage.objects.count(), 2)

    def test_failure_does_not_leave_a_dangling_question(self):
        with mock.patch('assistant.services.settings.OPENROUTER_API_KEY', ''), \
             mock.patch('assistant.services.requests.post') as post:
            res = self.client.post('/api/assistant/ask/', {'message': 'hello'})
        post.assert_not_called()
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertEqual(ChatSession.objects.count(), 0)
        self.assertEqual(ChatMessage.objects.count(), 0)

    def test_failure_mid_conversation_keeps_the_earlier_transcript(self):
        with mock.patch('assistant.services.settings.OPENROUTER_API_KEY', 'test-key'), \
             mock.patch('assistant.services.requests.post',
                        return_value=fake_openrouter_reply('first answer')):
            session_id = self.client.post(
                '/api/assistant/ask/', {'message': 'first question'}).data['session']['id']

        with mock.patch('assistant.services.settings.OPENROUTER_API_KEY', ''):
            res = self.client.post('/api/assistant/ask/',
                                   {'message': 'second', 'session': session_id})
        self.assertEqual(res.status_code, status.HTTP_502_BAD_GATEWAY)
        session = ChatSession.objects.get(pk=session_id)
        self.assertEqual(session.messages.count(), 2,
                         'A failed turn must not destroy the existing conversation.')

    def test_you_cannot_read_or_use_someone_elses_conversation(self):
        session = ChatSession.objects.create(user=self.other, title='private')
        res = self.client.get(f'/api/assistant/{session.pk}/messages/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        with mock.patch('assistant.services.settings.OPENROUTER_API_KEY', 'test-key'):
            res = self.client.post('/api/assistant/ask/',
                                   {'message': 'hi', 'session': session.pk})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_is_scoped_to_the_caller(self):
        ChatSession.objects.create(user=self.user, title='mine')
        ChatSession.objects.create(user=self.other, title='theirs')
        res = self.client.get('/api/assistant/')
        self.assertEqual(len(res.data['results']), 1)

    def test_transcript_is_oldest_first(self):
        session = ChatSession.objects.create(user=self.user)
        ChatMessage.objects.create(session=session, role='ASSISTANT', content='second')
        ChatMessage.objects.create(session=session, role='USER', content='first')
        res = self.client.get(f'/api/assistant/{session.pk}/messages/')
        bodies = [m['content'] for m in res.data['results']]
        self.assertEqual(bodies, ['second', 'first'])

    def test_empty_message_is_refused(self):
        res = self.client.post('/api/assistant/ask/', {'message': '   '})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ChatSession.objects.count(), 0)

    def test_archiving_hides_a_session(self):
        session = ChatSession.objects.create(user=self.user, title='done with this')
        res = self.client.patch(f'/api/assistant/{session.pk}/archive/',
                                {'is_archived': True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertTrue(session.is_archived)
