"""
AI Plant Identification Service using OpenRouter API.

Architecture: React → Django → OpenRouter
The AI never directly accesses the database. Django acts as the intermediary.
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
    
    Returns:
        dict: Structured identification result or error info
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        logger.warning("OpenRouter API key not configured")
        return {
            'success': False,
            'error': 'AI identification service is not configured. Please contact the administrator.',
        }

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
    
    # Try partial match
    try:
        plant = Plant.objects.filter(
            scientific_name__icontains=scientific_name.split()[0],  # Match genus
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
