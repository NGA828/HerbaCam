/**
 * Utility functions for HerbaCam frontend.
 */

/**
 * Convert an absolute Django media URL to a relative URL that works through the Vite proxy.
 * Handles both `http://localhost:8000/media/...` and `/media/...` formats.
 */
export function mediaUrl(url) {
  if (!url) return null;
  // If it's already a relative URL, return as-is
  if (url.startsWith('/media/')) return url;
  // If it's an absolute URL, extract the path
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

/**
 * Format a date string to a human-readable format.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/**
 * Format a confidence score (0-1) as a percentage with label.
 */
export function formatConfidence(score) {
  const pct = Math.round(score * 100);
  let label = 'Uncertain';
  if (pct >= 80) label = 'High Confidence';
  else if (pct >= 50) label = 'Moderate';
  else if (pct >= 30) label = 'Low';
  return { pct, label };
}

/**
 * Debounce function for search inputs.
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
