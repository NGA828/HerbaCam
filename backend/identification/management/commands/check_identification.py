"""Read-only report of how plant identification is configured.

The identify path is the only place the platform depends on a third-party model,
and it has two independent failure modes: no API key, or a model id that OpenRouter
does not accept image input for. Both used to surface as the same opaque error in
the UI, so this prints the state of each before anyone uploads a photo.
"""
from __future__ import annotations

import requests
from django.conf import settings
from django.core.management.base import BaseCommand

from identification.services import active_model


class Command(BaseCommand):
    help = ('Report the OpenRouter configuration used for plant identification, '
            'and whether the model it names is listed by the provider.')

    def add_arguments(self, parser):
        parser.add_argument('--probe', action='store_true',
                            help='Send a one-token request to the configured model '
                                 'instead of only reading the public model list. Uses quota.')
        parser.add_argument('--strict', action='store_true',
                            help='Exit non-zero if the setup cannot serve identifications.')

    def handle(self, *args, **options):
        problems = []
        key = (settings.OPENROUTER_API_KEY or '').strip()
        model = active_model()

        if not key or key == 'your-openrouter-key':
            key_state = self.style.ERROR('not configured')
            problems.append('OPENROUTER_API_KEY is unset, so every upload is rejected.')
        else:
            key_state = self.style.SUCCESS(f'configured (ends {key[-4:]})')

        vision = settings.OPENROUTER_VISION_MODEL
        vision_state = (self.style.SUCCESS(f'{vision}') if vision
                        else self.style.NOTICE('not set — image calls use OPENROUTER_MODEL'))

        self.stdout.write(self.style.HTTP_INFO('Plant identification config'))
        self.stdout.write(f'  API key       : {key_state}')
        self.stdout.write(f'  Chat model    : {settings.OPENROUTER_MODEL}')
        self.stdout.write(f'  Vision model  : {vision_state}')
        self.stdout.write(f'  Used for images: {model}')

        if options['probe']:
            self._probe(model, key, problems)
        else:
            self._check_listing(model, problems)

        for problem in problems:
            self.stdout.write(self.style.ERROR(f'  ! {problem}'))
        if not problems:
            self.stdout.write(self.style.SUCCESS('  No problems found.'))
        if problems and options['strict']:
            raise SystemExit(1)
        return None

    def _check_listing(self, model, problems):
        """Ask OpenRouter's public catalogue for the id and its input modalities.

        The catalogue needs no key, so this is safe to run on a machine that is
        allowed to reach the internet but holds no credentials.
        """
        try:
            response = requests.get(f'{settings.OPENROUTER_BASE_URL}/models', timeout=20)
            response.raise_for_status()
            entries = response.json().get('data', [])
        except (requests.RequestException, ValueError) as exc:
            self.stdout.write(self.style.NOTICE(
                f'  Model listing : could not check ({exc.__class__.__name__})'))
            return

        entry = next((e for e in entries if e.get('id') == model), None)
        if entry is None:
            self.stdout.write(self.style.ERROR(f'  Model listing : {model} is NOT listed'))
            problems.append(f'OpenRouter has no model named "{model}".')
            return
        supported = (entry.get('architecture') or {}).get('input_modalities') or []
        if 'image' in supported:
            self.stdout.write(self.style.SUCCESS(
                f'  Model listing : {model} is listed (accepts {", ".join(supported)})'))
        else:
            # Listed but text-only: identification will reach it and be refused.
            self.stdout.write(self.style.NOTICE(
                f'  Model listing : {model} is listed, inputs are '
                f'{", ".join(supported) or "text only"}'))
            problems.append(f'"{model}" does not advertise image input; set '
                            'OPENROUTER_VISION_MODEL to a model that does.')

    def _probe(self, model, key, problems):
        url = f'{settings.OPENROUTER_BASE_URL}/chat/completions'
        try:
            response = requests.post(
                url,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                json={'model': model, 'messages': [{'role': 'user', 'content': 'Reply with OK.'}],
                      'max_tokens': 5},
                timeout=30,
            )
            response.raise_for_status()
            self.stdout.write(self.style.SUCCESS(f'  Probe         : {model} answered'))
        except requests.exceptions.HTTPError as exc:
            status = getattr(exc.response, 'status_code', None)
            self.stdout.write(self.style.ERROR(f'  Probe         : HTTP {status} from {model}'))
            problems.append(f'The provider refused the probe with HTTP {status}.')
        except requests.RequestException as exc:
            self.stdout.write(self.style.ERROR(f'  Probe         : {exc}'))
            problems.append('The probe request did not reach OpenRouter.')
