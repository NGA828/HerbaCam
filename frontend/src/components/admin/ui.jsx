/* Shared admin design system: components + tokens + data hook.
   The kit intentionally co-exports non-component values. */
/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';

/** Unwrap DRF paginated or plain-array responses. */
export const extractRows = (r) => r?.data?.results || r?.data || [];

/**
 * Data-fetching hook that keeps effects clean (never returns a promise to
 * React) and always resolves to an array so the UI can render.
 */
export function useList(fetcher, deps = []) {
  const [data, setData] = useState(null); // null => loading
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    fetcher()
      .then((r) => setData(extractRows(r)))
      .catch(() => {
        setError('We could not load this data from the database. Check the API and try again.');
        setData([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps);
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading: data === null, error, reload: load };
}

/* ---------------------------------- Tokens --------------------------------- */

export const inputCls =
  'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
export const selectCls = inputCls + ' appearance-none pr-8';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50';
export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800';
export const btnDanger =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700';

const badgeTones = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  stone: 'bg-stone-100 text-stone-600 ring-stone-500/20',
};

export function Badge({ tone = 'stone', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeTones[tone] || badgeTones.stone} ${className}`}>
      {children}
    </span>
  );
}

/** Consistent status pill for record states (SUBMITTED, APPROVED, HIGH, ...). */
export function StatusBadge({ value }) {
  const v = String(value || '').toUpperCase();
  let tone = 'stone';
  if (/APPROVED|PUBLISHED|ACTIVE|VERIFIED|COMPLETED|LOW$/.test(v)) tone = 'emerald';
  else if (/REJECT|INACTIVE|FAILED|CRITICAL/.test(v) || v === 'HIGH') tone = 'red';
  else if (/SUBMITTED|PENDING|UNDER_REVIEW|REQUESTED|MODERATE|DRAFT/.test(v)) tone = 'amber';
  else if (/INSUFFICIENT/.test(v)) tone = 'sky';
  return <Badge tone={tone}>{v ? v.replaceAll('_', ' ') : 'Draft'}</Badge>;
}

/* --------------------------------- Sections -------------------------------- */

export function AdminHeader({ eyebrow, title, description, action, icon: Icon }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-emerald-950 to-emerald-900 p-6 text-white shadow-sm sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full bg-teal-400/10 blur-2xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Icon className="h-5 w-5 text-emerald-200" />
            </div>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-emerald-100/80">{description}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </section>
  );
}

export function KpiCard({ icon: Icon, label, value, hint, tone = 'emerald' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-stone-800">{value}</p>
          <p className="truncate text-xs font-medium text-stone-500">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function TableCard({ children, minW = 'min-w-[680px]' }) {
  return (
    <Card>
      <div className="overflow-x-auto rounded-2xl">
        <table className={`w-full ${minW} text-left text-sm`}>{children}</table>
      </div>
    </Card>
  );
}

export function Th({ children, className = '' }) {
  return (
    <th className={`bg-stone-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return <td className={`border-t border-stone-100 px-4 py-3 align-middle ${className}`}>{children}</td>;
}

/* --------------------------------- States ---------------------------------- */

export function EmptyState({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <Card className="border-dashed">
      <div className="px-8 py-14 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <Icon className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="font-semibold text-stone-800">{title}</h3>
        {hint && <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">{hint}</p>}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </Card>
  );
}

export function Skeleton({ rows = 5, height = 'h-14' }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`animate-pulse rounded-2xl bg-stone-100 ${height}`} style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800">
      <span className="flex items-center gap-2">
        <CircleAlert className="h-5 w-5 shrink-0" /> {message}
      </span>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-red-700 ring-1 ring-red-200 transition hover:bg-red-100">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

/* --------------------------------- Forms ----------------------------------- */

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-1 text-xs font-bold uppercase tracking-wide text-stone-500">
        {label} {required && <span className="text-emerald-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

export function FormPanel({ title, subtitle, children, onDismiss }) {
  return (
    <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-emerald-950">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-emerald-900/70">{subtitle}</p>}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="rounded-lg px-2 py-1 text-sm font-medium text-emerald-900/60 transition hover:bg-emerald-100 hover:text-emerald-900">
            Close
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function FormActions({ saving, onCancel, saveLabel = 'Save changes' }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-emerald-200/60 pt-4">
      <button type="submit" disabled={saving} className={btnPrimary}>
        {saving ? 'Saving…' : saveLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} disabled={saving} className={btnSecondary}>
          Cancel
        </button>
      )}
    </div>
  );
}

export function Avatar({ name, size = 'h-9 w-9 text-xs' }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();
  return (
    <span className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800 ring-2 ring-emerald-200/60`}>
      {initials || '?'}
    </span>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
