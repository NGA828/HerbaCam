"""Identification configuration: which model an image is sent to, and what the
operator is told when it cannot work.

No test here reaches the network: the provider calls are patched, which is also
the point of the probe command — it is safe to run anywhere.
"""
from io import StringIO
from unittest import mock

import requests
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from .services import active_model, identify_plant

SVC = 'identification.services'
BASE = SVC + '.requests'
CMD = 'identification.management.commands.check_identification.requests'


def _http_error(status, message='provider said no'):
    response = mock.Mock(status_code=status)
    response.json.return_value = {'error': {'message': message}}
    response.raise_for_status.side_effect = requests.exceptions.HTTPError(response=response)
    return response


class ModelSelectionTests(TestCase):
    def test_the_chat_model_is_used_when_no_vision_model_is_pinned(self):
        with override_settings(OPENROUTER_MODEL='google/chat-model', OPENROUTER_VISION_MODEL=None):
            self.assertEqual(active_model(), 'google/chat-model')

    def test_the_vision_model_wins_for_images(self):
        with override_settings(OPENROUTER_MODEL='google/chat-model',
                               OPENROUTER_VISION_MODEL='google/vision-model'):
            self.assertEqual(active_model(), 'google/vision-model')

    def test_an_absent_key_is_named_in_the_error(self):
        with override_settings(OPENROUTER_API_KEY=''):
            result = identify_plant(SimpleUploadedFile('leaf.jpg', b'x', content_type='image/jpeg'))
        self.assertFalse(result['success'])
        self.assertIn('OPENROUTER_API_KEY', result['error'])

    def test_a_missing_model_names_the_setting_that_controls_it(self):
        image = SimpleUploadedFile('leaf.jpg', b'x', content_type='image/jpeg')
        with override_settings(OPENROUTER_API_KEY='sk-test', OPENROUTER_VISION_MODEL='google/vision-model'), \
                mock.patch(f'{SVC}.encode_image_to_base64', return_value='eA=='), \
                mock.patch(f'{BASE}.post', return_value=_http_error(404)) as post:
            result = identify_plant(image)
        self.assertEqual(post.call_args.kwargs['json']['model'], 'google/vision-model')
        self.assertIn('google/vision-model', result['error'])
        self.assertIn('OPENROUTER_VISION_MODEL', result['error'])

    def test_a_refusal_is_read_as_a_model_that_cannot_see(self):
        image = SimpleUploadedFile('leaf.jpg', b'x', content_type='image/jpeg')
        with override_settings(OPENROUTER_API_KEY='sk-test', OPENROUTER_VISION_MODEL=None), \
                mock.patch(f'{SVC}.encode_image_to_base64', return_value='eA=='), \
                mock.patch(f'{BASE}.post', return_value=_http_error(400, 'image input unsupported')):
            result = identify_plant(image)
        self.assertIn('may not accept image input', result['error'])
        self.assertIn('OPENROUTER_VISION_MODEL', result['error'])


class CheckIdentificationCommandTests(TestCase):
    def _listing(self, model, modalities=('text', 'image')):
        payload = {'data': [{'id': model, 'architecture': {'input_modalities': list(modalities)}}]}
        return mock.Mock(status_code=200, **{'json.return_value': payload,
                                            'raise_for_status.return_value': None})

    def test_reports_a_listed_model_as_usable(self):
        with mock.patch(f'{CMD}.get', return_value=self._listing('some/model')), \
                override_settings(OPENROUTER_API_KEY='sk-test', OPENROUTER_MODEL='some/model',
                                  OPENROUTER_VISION_MODEL=None):
            out = StringIO()
            call_command('check_identification', stdout=out)
        self.assertIn('some/model is listed', out.getvalue())
        self.assertIn('No problems found', out.getvalue())

    def test_flags_a_model_the_provider_does_not_have(self):
        listing = mock.Mock(status_code=200, **{'json.return_value': {'data': []},
                                                 'raise_for_status.return_value': None})
        with mock.patch(f'{CMD}.get', return_value=listing), \
                override_settings(OPENROUTER_MODEL='gone/model'):
            out = StringIO()
            call_command('check_identification', stdout=out)
        self.assertIn('gone/model is NOT listed', out.getvalue())

    def test_flags_a_listed_model_that_cannot_take_an_image(self):
        with mock.patch(f'{CMD}.get', return_value=self._listing('text/model', ('text',))), \
                override_settings(OPENROUTER_MODEL='text/model'):
            out = StringIO()
            call_command('check_identification', stdout=out)
        self.assertIn('does not advertise image input', out.getvalue())

    def test_a_network_failure_is_reported_without_lying_about_the_config(self):
        with mock.patch(f'{CMD}.get', side_effect=requests.ConnectionError('offline')), \
                override_settings(OPENROUTER_API_KEY='sk-test'):
            out = StringIO()
            call_command('check_identification', stdout=out)
        self.assertIn('could not check', out.getvalue())
        self.assertNotIn('NOT listed', out.getvalue())

    def test_strict_fails_a_deployment_without_a_key(self):
        with mock.patch(f'{CMD}.get', return_value=self._listing(active_model())), \
                override_settings(OPENROUTER_API_KEY='', OPENROUTER_VISION_MODEL=None):
            with self.assertRaises(SystemExit) as raised:
                call_command('check_identification', strict=True, stdout=StringIO())
        self.assertEqual(raised.exception.code, 1)
