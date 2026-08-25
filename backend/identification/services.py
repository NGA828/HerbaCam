"""
AI Plant Identification Service using OpenRouter API.

Architecture: React → Django → OpenRouter
The AI never directly accesses the database. Django acts as the intermediary.

When OPENROUTER_API_KEY is not configured, the service operates in DEMO MODE,
simulating AI identification using the local plant database for demonstration purposes.
"""
import base64
import json
import logging
import random
import requests
from django.conf import settings
from plants.models import Plant

logger = logging.getLogger(__name__)

IDENTIFICATION_PROMPT = """You are a botanical expert specializing in plant identification, 
with particular expertise in African and Cameroonian flora.

Analyze the provided plant image and identify the plant species.

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
    }
}

Important rules:
- Confidence should be between 0.0 and 1.0
- Provide the most likely identification first
- Include up to 3 alternative identifications if uncertain
- If you cannot identify the plant with any confidence, set confidence to 0.0
- Focus on species found in Cameroon and Central Africa when possible
- Be honest about uncertainty - do not guess with high confidence
"""


def encode_image_to_base64(image_file):
    """Encode an uploaded image file to base64."""
    image_data = image_file.read()
    return base64.b64encode(image_data).decode('utf-8')


def identify_plant(image_file):
    """
    Send plant image to OpenRouter for AI identification.
    
    If OPENROUTER_API_KEY is not configured, uses demo mode which
    simulates AI identification from the local plant database.
    
    Returns:
        dict: Structured identification result or error info
    """
    api_key = settings.OPENROUTER_API_KEY
    
    if not api_key:
        logger.info("OpenRouter API key not configured — using DEMO MODE")
        return _demo_identification(image_file)

    # Encode image
    image_base64 = encode_image_to_base64(image_file)
    
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
        logger.error(f"OpenRouter API HTTP error: {e}")
        # If auth fails, fall back to demo mode
        if e.response is not None and e.response.status_code in (401, 403):
            logger.warning("OpenRouter API authentication failed — falling back to DEMO MODE")
            return _demo_identification(image_file)
        return {
            'success': False,
            'error': 'Plant identification service returned an error. Please try again later.',
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


def _demo_identification(image_file):
    """
    Demo mode: simulate AI identification by selecting a plant from the database.
    
    This allows the identification feature to be demonstrated and tested
    without requiring a live OpenRouter API key.
    
    Uses image hash to deterministically select a plant (same image → same result),
    making it feel realistic rather than purely random.
    """
    published_plants = list(Plant.objects.filter(is_published=True))
    
    if not published_plants:
        return {
            'success': False,
            'error': 'No plants in database for demo identification.',
        }
    
    # Use image size as a pseudo-random seed for deterministic results
    try:
        image_file.seek(0, 2)  # Seek to end
        file_size = image_file.tell()
        image_file.seek(0)  # Reset to beginning
        random.seed(file_size)
    except Exception:
        file_size = 0
    
    # Select primary plant
    primary_plant = random.choice(published_plants)
    
    # Generate confidence based on "image quality" simulation
    confidence = round(random.uniform(0.65, 0.95), 2)
    
    # Select alternatives (different from primary)
    alternatives_pool = [p for p in published_plants if p.id != primary_plant.id]
    num_alternatives = min(2, len(alternatives_pool))
    alt_plants = random.sample(alternatives_pool, num_alternatives) if alternatives_pool else []
    
    # Distribute remaining confidence among alternatives
    remaining_conf = round((1.0 - confidence) * 0.8, 2)
    alternatives = []
    for i, alt in enumerate(alt_plants):
        alt_conf = round(remaining_conf / (i + 2), 2)
        alternatives.append({
            'scientific_name': alt.scientific_name,
            'common_name': alt.common_name,
            'confidence': alt_conf,
        })
    
    parsed = {
        'identification': {
            'scientific_name': primary_plant.scientific_name,
            'common_name': primary_plant.common_name,
            'confidence': confidence,
            'description': primary_plant.description or f'A {primary_plant.common_name or primary_plant.scientific_name} specimen.',
        },
        'alternatives': alternatives,
        'plant_features': {
            'leaf_type': 'See detailed description in plant profile',
            'flower_type': 'See detailed description in plant profile',
            'growth_form': primary_plant.habitat or 'Various',
        },
        'demo_mode': True,
    }
    
    db_match = match_plant_in_database(parsed)
    
    return {
        'success': True,
        'data': parsed,
        'database_match': db_match,
        'mode': 'demo',
        'demo_notice': 'This identification was generated in demo mode (no AI API key configured). '
                       'In production, this would use real AI vision analysis via OpenRouter.',
    }


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
        
        for alt in parsed['alternatives']:
            alt_conf = float(alt.get('confidence', 0))
            alt['confidence'] = max(0.0, min(1.0, alt_conf))
        
        return parsed
        
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.error(f"Failed to parse AI response: {e}")
        return None


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
