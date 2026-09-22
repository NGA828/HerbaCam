/**
 * Ancestor brand mark — "Leaf Aperture" (Concept A).
 *
 * Six leaves arranged as camera-aperture blades around a golden lens,
 * fusing the app's three ideas: medicinal plant + AI camera
 * identification + Cameroon gold.
 *
 * NOTE: the wordmark is intentionally NOT part of this component — every
 * usage keeps the existing single-color "Ancestor" text exactly as today.
 */

const BLADE = 'M32 32 C33 22 37 12 46 6 C45 17 40 27 32 32 Z';
const ANGLES = [0, 60, 120, 180, 240, 300];

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Ancestor logo">
      {ANGLES.map((angle) => (
        <path
          key={angle}
          d={BLADE}
          fill={angle % 120 === 0 ? '#16a34a' : '#059669'}
          stroke="#14532d"
          strokeWidth="0.8"
          strokeOpacity="0.35"
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="10" fill="#14532d" />
      <circle cx="32" cy="32" r="6.5" fill="#f59e0b" />
      <circle cx="29.8" cy="29.8" r="1.8" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

export default LogoMark;
