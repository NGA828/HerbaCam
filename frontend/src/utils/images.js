import africanBasil from '../assets/plants/african-basil.jpg';
import alstonia from '../assets/plants/alstonia.jpg';
import bitterLeaf from '../assets/plants/bitter-leaf.jpg';
import kolaNut from '../assets/plants/kola-nut.jpg';
import moringa from '../assets/plants/moringa.jpg';
import neem from '../assets/plants/neem.jpg';
import prunusAfricana from '../assets/plants/prunus-africana.jpg';
import rauvolfia from '../assets/plants/rauvolfia.jpg';

const generated = {
  'african basil': africanBasil, 'ocimum gratissimum': africanBasil,
  'alstonia': alstonia, 'alstonia boonei': alstonia,
  'bitter leaf': bitterLeaf, 'vernonia amygdalina': bitterLeaf,
  'kola nut': kolaNut, 'cola acuminata': kolaNut,
  'moringa': moringa, 'moringa oleifera': moringa,
  'neem': neem, 'azadirachta indica': neem,
  'prunus africana': prunusAfricana, 'rauvolfia': rauvolfia, 'rauvolfia vomitoria': rauvolfia,
};

/** Resolve API media through the same-origin proxy, with generated botanical art as a useful fallback. */
export function plantImage(plant) {
  const image = typeof plant === 'string' ? plant : plant?.image;
  if (image) {
    // If it's already a relative media path, return it directly
    if (image.startsWith('/media/')) return image;
    
    // Strip absolute domains (e.g., http://localhost:8000/media/...)
    // so Vite's proxy can handle the request properly.
    try {
      const url = new URL(image);
      return url.pathname;
    } catch {
      return image.replace(/^https?:\/\/[^/]+/, '');
    }
  }
  const key = `${plant?.scientific_name || ''} ${plant?.common_name || ''}`.toLowerCase();
  return Object.entries(generated).find(([name]) => key.includes(name))?.[1] || africanBasil;
}
