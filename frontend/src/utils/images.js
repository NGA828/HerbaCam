import africanBasil from '../assets/plants/african-basil.jpg';
import alstonia from '../assets/plants/alstonia.jpg';
import bitterLeaf from '../assets/plants/bitter-leaf.jpg';
import kolaNut from '../assets/plants/kola-nut.jpg';
import moringa from '../assets/plants/moringa.jpg';
import neem from '../assets/plants/neem.jpg';
import prunusAfricana from '../assets/plants/prunus-africana.jpg';
import rauvolfia from '../assets/plants/rauvolfia.jpg';

/**
 * Generated botanical artwork, keyed by common/scientific name fragments.
 * Used as a reliable fallback whenever the database image is missing or
 * fails to load, so the UI never shows a broken image.
 */
const generated = {
  'african basil': africanBasil,
  'ocimum gratissimum': africanBasil,
  alstonia: alstonia,
  'stool wood': alstonia,
  'bitter leaf': bitterLeaf,
  vernonia: bitterLeaf,
  'kola nut': kolaNut,
  kola: kolaNut,
  moringa: moringa,
  neem: neem,
  azadirachta: neem,
  'prunus africana': prunusAfricana,
  'african cherry': prunusAfricana,
  rauvolfia: rauvolfia,
  "poison devil": rauvolfia,
};

/**
 * Normalize any server image reference to a same-origin URL that works
 * through the Vite dev proxy (and any reverse proxy in production):
 *   http://host:8000/media/plants/x.jpg  ->  /media/plants/x.jpg
 *   /media/plants/x.jpg                  ->  /media/plants/x.jpg
 *   plants/x.jpg (relative DB path)      ->  /media/plants/x.jpg
 */
export function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^https?:\/\/[^/]+/i, '');
  if (trimmed.startsWith('/')) return trimmed;
  return `/media/${trimmed.replace(/^\/+/, '')}`;
}

/** Generated artwork that matches a plant (never returns a URL). */
export function generatedFor(plant) {
  const key = `${plant?.scientific_name || ''} ${plant?.common_name || ''} ${plant?.name || ''}`.toLowerCase();
  return Object.entries(generated).find(([name]) => key.includes(name))?.[1] || africanBasil;
}

/**
 * Resolve a plant's display image:
 * 1. The database-provided image, normalized to a same-origin /media URL.
 * 2. Matching generated botanical artwork when the plant has no image.
 */
export function plantImage(plant) {
  const image = typeof plant === 'string' ? plant : plant?.image;
  const normalized = normalizeMediaUrl(image);
  if (normalized) return normalized;
  return generatedFor(plant);
}

/** Resolve an article cover image, with the same normalization rules. */
export function articleImage(article) {
  return normalizeMediaUrl(article?.cover_image) || generatedFor({ name: article?.title });
}

/** onError handler that swaps in the generated artwork once (no loops). */
export function withImageFallback(plant) {
  return (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.onerror = null;
    img.src = generatedFor(plant);
  };
}
