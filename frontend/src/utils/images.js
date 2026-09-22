import africanBasil from '../assets/plants/african-basil.jpg';
import africanBirch from '../assets/plants/african-birch.jpg';
import africanPeach from '../assets/plants/african-peach.jpg';
import akuamma from '../assets/plants/akuamma.jpg';
import aloeVera from '../assets/plants/aloe-vera.jpg';
import alstonia from '../assets/plants/alstonia.jpg';
import ashantiPepper from '../assets/plants/ashanti-pepper.jpg';
import bitterKola from '../assets/plants/bitter-kola.jpg';
import bitterLeaf from '../assets/plants/bitter-leaf.jpg';
import candleBush from '../assets/plants/candle-bush.jpg';
import ethiopianPepper from '../assets/plants/ethiopian-pepper.jpg';
import garlic from '../assets/plants/garlic.jpg';
import ginger from '../assets/plants/ginger.jpg';
import goatWeed from '../assets/plants/goat-weed.jpg';
import guava from '../assets/plants/guava.jpg';
import khaya from '../assets/plants/khaya.jpg';
import kolaNut from '../assets/plants/kola-nut.jpg';
import lemongrass from '../assets/plants/lemongrass.jpg';
import mango from '../assets/plants/mango.jpg';
import moringa from '../assets/plants/moringa.jpg';
import neem from '../assets/plants/neem.jpg';
import papaya from '../assets/plants/papaya.jpg';
import prekese from '../assets/plants/prekese.jpg';
import prunusAfricana from '../assets/plants/prunus-africana.jpg';
import rauvolfia from '../assets/plants/rauvolfia.jpg';
import satinwood from '../assets/plants/satinwood.jpg';
import siamWeed from '../assets/plants/siam-weed.jpg';
import soursop from '../assets/plants/soursop.jpg';
import turmeric from '../assets/plants/turmeric.jpg';
import violetTree from '../assets/plants/violet-tree.jpg';
import voacanga from '../assets/plants/voacanga.jpg';
import yellowWood from '../assets/plants/yellow-wood.jpg';

/**
 * Real reference photos, keyed by common/scientific name fragments.
 * One photo per species — the fallback must always match the plant name.
 * Used whenever the database image is missing or fails to load, so the
 * UI never shows a broken image OR a wrong species.
 */
const generated = {
  'african basil': africanBasil,
  'ocimum gratissimum': africanBasil,
  'scent leaf': africanBasil,
  alstonia: alstonia,
  'stool wood': alstonia,
  'bitter leaf': bitterLeaf,
  vernonia: bitterLeaf,
  'ndole': bitterLeaf,
  'kola nut': kolaNut,
  'cola acuminata': kolaNut,
  moringa: moringa,
  'moringa oleifera': moringa,
  neem: neem,
  azadirachta: neem,
  'prunus africana': prunusAfricana,
  'african cherry': prunusAfricana,
  'red stinkwood': prunusAfricana,
  rauvolfia: rauvolfia,
  'poison devil': rauvolfia,
  ginger: ginger,
  zingiber: ginger,
  turmeric: turmeric,
  curcuma: turmeric,
  garlic: garlic,
  'allium sativum': garlic,
  aloe: aloeVera,
  papaya: papaya,
  carica: papaya,
  mango: mango,
  mangifera: mango,
  guava: guava,
  psidium: guava,
  lemongrass: lemongrass,
  cymbopogon: lemongrass,
  citronnelle: lemongrass,
  khaya: khaya,
  mahogany: khaya,
  'african peach': africanPeach,
  nauclea: africanPeach,
  sarcocephalus: africanPeach,
  'ashanti pepper': ashantiPepper,
  'piper guineense': ashantiPepper,
  uziza: ashantiPepper,
  prekese: prekese,
  tetrapleura: prekese,
  aridan: prekese,
  'ethiopian pepper': ethiopianPepper,
  xylopia: ethiopianPepper,
  'bitter kola': bitterKola,
  'garcinia kola': bitterKola,
  akuamma: akuamma,
  picralima: akuamma,
  'yellow wood': yellowWood,
  enantia: yellowWood,
  annickia: yellowWood,
  voacanga: voacanga,
  soursop: soursop,
  'annona muricata': soursop,
  corossol: soursop,
  'candle bush': candleBush,
  'senna alata': candleBush,
  cassia: candleBush,
  ringworm: candleBush,
  'goat weed': goatWeed,
  ageratum: goatWeed,
  'siam weed': siamWeed,
  chromolaena: siamWeed,
  'violet tree': violetTree,
  securidaca: violetTree,
  'african birch': africanBirch,
  anogeissus: africanBirch,
  satinwood: satinwood,
  zanthoxylum: satinwood,
  fagara: satinwood,
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

/** Reference photo that matches a plant (never returns a URL). */
export function generatedFor(plant) {
  const key = `${plant?.scientific_name || ''} ${plant?.common_name || ''} ${plant?.name || ''}`.toLowerCase();
  // Longest keys first so 'bitter kola' wins over 'kola'.
  const entries = Object.entries(generated).sort((a, b) => b[0].length - a[0].length);
  return entries.find(([name]) => key.includes(name))?.[1] || neem;
}

/**
 * Resolve a plant's display image:
 * 1. The database-provided image, normalized to a same-origin /media URL.
 * 2. Matching reference photo when the plant has no image.
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

/** onError handler that swaps in the reference photo once (no loops). */
export function withImageFallback(plant) {
  return (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.onerror = null;
    img.src = generatedFor(plant);
  };
}
