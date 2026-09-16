"""
AI Plant Identification Service using OpenRouter API.

Architecture: React → Django → OpenRouter
The AI never directly accesses the database. Django acts as the intermediary.

OpenRouter is required for identification. The service never substitutes a
database lookup for an AI response.
"""
import base64
import json
import logging
import requests
from django.conf import settings
from plants.models import Plant

logger = logging.getLogger(__name__)

IDENTIFICATION_PROMPT = """You are a botanical expert specializing in plant identification, 
with particular expertise in African and Cameroonian flora.

First determine whether the image contains a real plant specimen or a visible
plant part (leaf, flower, fruit, seed, bark, stem, or whole plant). Only if it
does, identify the plant species. Do not identify screenshots, drawings,
packaging, furniture, buildings, people, animals, or other objects as plants.

Return your response as a valid JSON object with this exact structure:
{
    "identification": {
        "scientific_name": "Genus species",
        "common_name": "Common English name",
        "confidence": 0.0,
        "description": "Brief description of the plant"
    },
    "alternatives": [
        {
            "scientific_name": "Alternative species",
            "common_name": "Alternative common name",
            "confidence": 0.0
        }
    ],
    "plant_features": {
        "leaf_type": "Description of leaves",
        "flower_type": "Description of flowers if visible",
        "growth_form": "Tree/Shrub/Herb/Vine/etc."
    },
    "analysis": {
        "visual_observations": ["Visible observation 1"],
        "traditional_context": "Documented or commonly reported traditional context, or state that it is unknown",
        "potential_uses": ["Potentially relevant use, clearly labelled as traditional if not scientifically established"],
        "safety_notes": ["Important safety or toxicity concern, or state that verification is needed"],
        "next_steps": ["A practical observation or verification step"]
    }
}

Important rules:
- Confidence should be between 0.0 and 1.0
- Provide the most likely identification first
- Include up to 3 alternative identifications if uncertain
- If you cannot identify the plant with any confidence, set confidence to 0.0
- Focus on species found in Cameroon and Central Africa when possible
- Be honest about uncertainty - do not guess with high confidence
- Do not diagnose illness, prescribe treatment, recommend dosage, or claim that a plant is safe to consume
- Separate traditional knowledge from scientific evidence and label uncertainty explicitly
- If the image is not a plant, identify it as "N/A" with confidence 0.0 and explain why
- The image must contain a visible plant or plant part; do not infer a plant from context alone
- Keep each analysis list to a maximum of 3 concise items
"""


def encode_image_to_base64(image_file):
    """Encode an uploaded image file to base64."""
    # Django may have consumed the upload stream while saving the
    # Identification record. Always encode from the beginning.
    image_file.seek(0)
    image_data = image_file.read()
    if not image_data:
        raise ValueError("Uploaded image is empty.")
    return base64.b64encode(image_data).decode('utf-8')


def identify_plant(image_file):
    """
    Send plant image to OpenRouter for AI identification.
    
    Returns:
        dict: Structured identification result or error info
    """
    api_key = settings.OPENROUTER_API_KEY.strip()
    
    if not api_key or api_key == 'your-openrouter-key':
        logger.error("OpenRouter API key is not configured")
        return {
            'success': False,
            'error': 'Live plant identification is not configured. Add OPENROUTER_API_KEY to backend/.env and restart the backend.',
        }

    # Encode image
    try:
        image_base64 = encode_image_to_base64(image_file)
    except (OSError, ValueError) as e:
        logger.error("Could not read uploaded image: %s", e)
        return {
            'success': False,
            'error': 'The uploaded image could not be read. Please choose the image again and retry.',
        }
    
    # Determine content type
    content_type = getattr(image_file, 'content_type', 'image/jpeg')
    
    # Build request
    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": IDENTIFICATION_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content_type};base64,{image_base64}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000,
        "temperature": 0.3,
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        # Parse the AI response
        parsed = parse_ai_response(content)
        
        if parsed:
            if not is_plant_identification(parsed):
                return {
                    'success': False,
                    'invalid_image': True,
                    'error': 'This image does not appear to show a plant. Please upload a clear photo of a leaf, flower, fruit, bark, or the whole plant.',
                }
            # Try to match with database
            db_match = match_plant_in_database(parsed)
            return {
                'success': True,
                'data': parsed,
                'database_match': db_match,
                'mode': 'live',
            }
        else:
            return {
                'success': False,
                'error': 'Could not parse AI response. Please try again with a clearer image.',
            }

    except requests.exceptions.Timeout:
        logger.error("OpenRouter API timeout")
        return {
            'success': False,
            'error': 'Plant identification is taking too long. Please try again.',
        }
    except requests.exceptions.HTTPError as e:
        response = e.response
        status_code = response.status_code if response is not None else None
        provider_error = _openrouter_error_message(response)
        logger.error(
            "OpenRouter API HTTP error (%s): %s",
            status_code,
            provider_error or str(e),
        )
        if status_code in (401, 403):
            return {
                'success': False,
                'error': 'OpenRouter rejected the API key. Check OPENROUTER_API_KEY in backend/.env and try again.',
            }
        if status_code == 404:
            return {
                'success': False,
                'error': f'OpenRouter could not find model "{settings.OPENROUTER_MODEL}". Update OPENROUTER_MODEL in backend/.env.',
            }
        if status_code == 429:
            return {
                'success': False,
                'error': 'OpenRouter rate limit or account quota reached. Please check your OpenRouter account and try again later.',
            }
        if status_code is not None and status_code >= 500:
            return {
                'success': False,
                'error': 'OpenRouter is temporarily unavailable. Please try again in a moment.',
            }
        return {
            'success': False,
            'error': f'OpenRouter rejected the request: {provider_error or "unknown provider error"}.',
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"OpenRouter API error: {e}")
        return {
            'success': False,
            'error': 'Plant identification service is temporarily unavailable. Please try again later.',
        }
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        logger.error(f"Error parsing OpenRouter response: {e}")
        return {
            'success': False,
            'error': 'Received unexpected response from identification service. Please try again.',
        }


def _openrouter_error_message(response):
    """Extract a safe, useful provider error without exposing response headers."""
    if response is None:
        return ''
    try:
        payload = response.json()
        error = payload.get('error', {})
        if isinstance(error, dict):
            return str(error.get('message') or error.get('code') or '').strip()
        return str(error).strip()
    except (ValueError, TypeError):
        return response.text[:300].strip()


def parse_ai_response(content):
    """Parse AI response content into structured data."""
    try:
        # Try to extract JSON from the response
        # The AI might wrap it in markdown code blocks
        cleaned = content.strip()
        if cleaned.startswith('```'):
            # Remove code block markers
            lines = cleaned.split('\n')
            cleaned = '\n'.join(lines[1:-1])
        
        parsed = json.loads(cleaned)
        
        # Validate required fields
        if 'identification' not in parsed:
            return None
        
        ident = parsed['identification']
        if 'scientific_name' not in ident or 'confidence' not in ident:
            return None
        
        # Ensure confidence is a float between 0 and 1
        confidence = float(ident.get('confidence', 0))
        ident['confidence'] = max(0.0, min(1.0, confidence))
        
        # Validate alternatives
        if 'alternatives' not in parsed:
            parsed['alternatives'] = []
        if 'analysis' not in parsed or not isinstance(parsed['analysis'], dict):
            parsed['analysis'] = {}
        analysis = parsed['analysis']
        for field in ('visual_observations', 'potential_uses', 'safety_notes', 'next_steps'):
            if not isinstance(analysis.get(field), list):
                analysis[field] = []
        analysis.setdefault('traditional_context', 'Traditional context could not be verified from the image alone.')
        
        for alt in parsed['alternatives']:
            alt_conf = float(alt.get('confidence', 0))
            alt['confidence'] = max(0.0, min(1.0, alt_conf))
        
        return parsed
        
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.error(f"Failed to parse AI response: {e}")
        return None


def is_plant_identification(ai_result):
    """Reject model responses that explicitly identify a non-plant image."""
    identification = ai_result.get('identification', {})
    scientific_name = str(identification.get('scientific_name', '')).strip().lower()
    common_name = str(identification.get('common_name', '')).strip().lower()
    description = str(identification.get('description', '')).strip().lower()

    non_plant_names = {
        'n/a',
        'na',
        'unknown',
        'not a plant',
        'no plant detected',
        'unidentified object',
    }
    non_plant_phrases = (
        'not a plant',
        'no plant',
        'no botanical',
        'screenshot',
        'user interface',
        'animal',
        'person',
        'vehicle',
        'building',
    )

    if scientific_name in non_plant_names or common_name in non_plant_names:
        return False
    return not any(
        phrase in f'{scientific_name} {common_name} {description}'
        for phrase in non_plant_phrases
    )


def match_plant_in_database(ai_result):
    """
    Try to match AI identification results with plants in the database.
    
    Returns database plant info if found, None otherwise.
    """
    scientific_name = ai_result['identification'].get('scientific_name', '')
    common_name = ai_result['identification'].get('common_name', '')
    
    if not scientific_name:
        return None
    
    # Try exact match on scientific name
    try:
        plant = Plant.objects.get(scientific_name__iexact=scientific_name, is_published=True)
        return {
            'id': plant.id,
            'scientific_name': plant.scientific_name,
            'common_name': plant.common_name,
            'found': True,
        }
    except Plant.DoesNotExist:
        pass
    
    # Try partial match on genus
    try:
        genus = scientific_name.split()[0]
        plant = Plant.objects.filter(
            scientific_name__icontains=genus,
            is_published=True
        ).first()
        if plant:
            return {
                'id': plant.id,
                'scientific_name': plant.scientific_name,
                'common_name': plant.common_name,
                'found': True,
                'partial_match': True,
            }
    except (IndexError, AttributeError):
        pass
    
    # Try common name match
    if common_name:
        try:
            plant = Plant.objects.get(common_name__iexact=common_name, is_published=True)
            return {
                'id': plant.id,
                'scientific_name': plant.scientific_name,
                'common_name': plant.common_name,
                'found': True,
            }
        except Plant.DoesNotExist:
            pass
    
    return {
        'found': False,
        'message': f'Cameroon-specific knowledge for "{scientific_name}" is currently unavailable in our database.',
    }
