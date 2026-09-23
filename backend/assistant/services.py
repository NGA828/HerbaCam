"""OpenRouter text chat, grounded in a Django-assembled knowledge extract.

The model is allowed to answer only from :func:`build_grounding` output plus
general botanical context it labels as such. It has no database access, no
tool calls, and never sees credentials.
"""
import logging
import re

import requests
from django.conf import settings
from django.db.models import Q

from knowledge.models import TraditionalUse
from plants.models import Plant
from symptoms.models import Symptom

logger = logging.getLogger(__name__)

# Turns of prior conversation replayed to the model, and how much knowledge-base
# text is allowed to ride along. Both caps exist so a long chat or a chatty
# search cannot silently inflate the token bill.
HISTORY_TURNS = 12
MAX_CONTEXT_ITEMS = 8
REQUEST_TIMEOUT = 60

SYSTEM_PROMPT = """You are the Ancestor assistant, embedded in a documentation \
platform for Cameroonian traditional medicinal plants.

You are given a KNOWLEDGE BASE EXTRACT assembled from records that human \
contributors submitted and expert reviewers verified.

Rules you must follow:
1. Treat the extract as the source of truth for what this knowledge base says. \
Do not claim the database documents something that is not in the extract.
2. Dosages, preparations and durations may only be repeated verbatim from the \
extract, with the plant they belong to. Never estimate, scale, or invent one. \
If the extract has none, say so plainly.
3. Where you add general botanical or cultural knowledge that is not in the \
extract, mark it clearly with "Outside the database:".
4. You are not a clinician. For anything a person might act on, tell them to \
consult a qualified health professional, and mention that traditional use is \
not evidence of efficacy.
5. Flag safety: if the extract shows a HIGH risk level, a pregnancy or children \
warning, or interactions, say so unprompted.
6. Be concise and concrete. Plain prose, no markdown headers.
"""


def _tokens(text):
    """Lowercase word fragments long enough to be worth searching on."""
    return [t for t in re.findall(r"[A-Za-z][A-Za-z\-']{3,}", (text or '').lower())]


def find_relevant_ids(question):
    """Plant and symptom ids whose names appear in the question.

    Searched word-by-word rather than matching the whole sentence, because a
    question like "what leaf helps a fever in the Northwest" mentions several
    records at once.
    """
    plant_ids, symptom_ids = set(), set()
    for token in _tokens(question):
        plant_ids.update(
            Plant.objects.filter(is_published=True)
            .filter(
                Q(scientific_name__icontains=token)
                | Q(common_name__icontains=token)
                | Q(local_names__name__icontains=token)
            )
            .values_list('id', flat=True)[:10]
        )
        symptom_ids.update(
            Symptom.objects.filter(name__icontains=token)
            .values_list('id', flat=True)[:10]
        )
    return plant_ids, symptom_ids


def _describe_use(use):
    """One extract line for a documented traditional use."""
    parts = [f'{use.plant.scientific_name} ({use.plant.common_name or "no common name"})']
    if use.symptom:
        parts.append(f'used for {use.symptom.name}')
    if use.plant_part:
        parts.append(f'part: {use.plant_part.get_part_type_display().lower()}')
    if use.preparation:
        parts.append(f'preparation: {use.preparation.name}')
    dose = ' / '.join(filter(None, [use.dosage, use.frequency, use.duration]))
    if dose:
        parts.append(f'reported dose: {dose}')
    if use.administration:
        parts.append(f'how taken: {use.administration}')
    if use.region:
        parts.append(f'region: {use.region.name}')
    parts.append('verified' if use.is_verified else 'NOT yet verified')
    return '- ' + '; '.join(parts)


def build_grounding(question):
    """Return ``(extract_text, cited_plant_ids)`` for what the KB holds on this."""
    plant_ids, symptom_ids = find_relevant_ids(question)
    clause = Q()
    if plant_ids:
        clause |= Q(plant_id__in=plant_ids)
    if symptom_ids:
        clause |= Q(symptom_id__in=symptom_ids)
    if not clause:
        return '', []

    uses = (
        TraditionalUse.objects.filter(clause, plant__is_published=True)
        .select_related('plant', 'symptom', 'plant_part', 'preparation', 'region')
        .order_by('-is_verified', '-created_at')[:MAX_CONTEXT_ITEMS]
    )
    if not uses:
        return '', []

    lines = [f'{use.plant_id}|{_describe_use(use)}' for use in uses]

    # Attach the safety and evidence picture for every plant we are quoting.
    from evidence.models import Evidence
    from safety.models import SafetyInformation

    cited = sorted({use.plant_id for use in uses})
    for safety in SafetyInformation.objects.filter(plant_id__in=cited):
        warnings = []
        if safety.pregnancy_warning:
            warnings.append('pregnancy warning')
        if safety.children_warning:
            warnings.append('children warning')
        if safety.interactions:
            warnings.append(f'interactions: {safety.interactions[:160]}')
        lines.append(
            f'SAFETY|{safety.plant.scientific_name}: risk {safety.risk_level}'
            + (f'; {"; ".join(warnings)}' if warnings else '')
        )
    for record in Evidence.objects.filter(plant_id__in=cited).select_related('plant'):
        lines.append(
            f'EVIDENCE|{record.plant.scientific_name}: {record.level} — {record.summary[:200]}'
        )

    return '\n'.join(lines), cited


def _messages(question, history, extract):
    """Assemble the OpenRouter ``messages`` array."""
    context = (
        'KNOWLEDGE BASE EXTRACT (the platform\'s verified records):\n' + extract
        if extract else
        'KNOWLEDGE BASE EXTRACT: no records in the database match this question.'
    )
    payload = [{'role': 'system', 'content': SYSTEM_PROMPT + '\n\n' + context}]
    for turn in history[-HISTORY_TURNS:]:
        role = 'assistant' if turn.role == 'ASSISTANT' else 'user'
        payload.append({'role': role, 'content': turn.content})
    payload.append({'role': 'user', 'content': question})
    return payload


def answer(question, history=()):
    """Ask the assistant one question. Never raises; returns a result dict."""
    api_key = (settings.OPENROUTER_API_KEY or '').strip()
    if not api_key or api_key == 'your-openrouter-key':
        return {
            'success': False,
            'error': 'Live chat is not configured. Add OPENROUTER_API_KEY to '
                     'backend/.env and restart the backend.',
        }

    extract, cited = build_grounding(question)

    try:
        response = requests.post(
            f'{settings.OPENROUTER_BASE_URL}/chat/completions',
            headers={'Authorization': f'Bearer {api_key}',
                     'Content-Type': 'application/json'},
            json={
                'model': settings.OPENROUTER_MODEL,
                'messages': _messages(question, list(history), extract),
                'max_tokens': 700,
                'temperature': 0.4,
            },
            timeout=REQUEST_TIMEOUT,
        )
    except requests.Timeout:
        logger.error('OpenRouter chat timeout')
        return {'success': False, 'error': 'The AI provider timed out. Please try again.'}
    except requests.RequestException as exc:
        logger.error('OpenRouter chat request failed: %s', exc)
        return {'success': False, 'error': 'Could not reach the AI provider. Check your connection and retry.'}

    if not response.ok:
        detail = ''
        try:
            detail = (response.json().get('error') or {}).get('message', '')
        except ValueError:
            pass
        return {'success': False, 'error': detail or f'The AI provider returned HTTP {response.status_code}.'}

    try:
        content = response.json()['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError, ValueError):
        logger.exception('Unexpected OpenRouter chat payload')
        return {'success': False, 'error': 'The AI provider returned an unreadable reply. Please try again.'}

    return {'success': True, 'answer': (content or '').strip(), 'cited_plant_ids': cited}
