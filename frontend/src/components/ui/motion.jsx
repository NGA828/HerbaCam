import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Fades + lifts its children whenever the route changes, so navigation feels
 * continuous instead of an instant swap.
 */
export function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}

/**
 * Reveals content as it scrolls into view (falls back to visible immediately
 * when IntersectionObserver is unavailable).
 */
export function Reveal({ children, delay = 0, y = 24, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'reveal-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms`, '--reveal-y': `${y}px` }}
    >
      {children}
    </Tag>
  );
}

/** Staggers the entrance of a list of children. */
export function Stagger({ children, step = 60, className = '' }) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <div key={child?.key ?? index} className="animate-rise" style={{ animationDelay: `${index * step}ms` }}>
              {child}
            </div>
          ))
        : children}
    </div>
  );
}

/** Animates from 0 to `value` on mount — used for dashboard counters. */
export function CountUp({ value = 0, duration = 900, decimals = 0, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const start = performance.now();
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      setDisplay(target);
      return undefined;
    }

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3; // easeOutCubic
      setDisplay(target * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => frame.current && cancelAnimationFrame(frame.current);
  }, [value, duration]);

  const formatted = decimals
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();

  return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>;
}

/** Indeterminate spinner used inside buttons and loading panels. */
export function Spinner({ className = 'h-4 w-4', label }) {
  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label && <span>{label}</span>}
    </span>
  );
}

/** Shimmering placeholder block. */
export function SkeletonBlock({ className = 'h-4 w-full' }) {
  return <div className={`skeleton-shimmer rounded-lg bg-stone-100 ${className}`} />;
}
