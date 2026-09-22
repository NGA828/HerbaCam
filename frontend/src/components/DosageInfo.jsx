import { Beaker, Clock, Repeat, Route, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

/**
 * Traditionally reported dosage — how much to take and how to take it.
 *
 * This documents what practitioners report; it is an educational record,
 * never a prescription. Always rendered with verification status and a
 * disclaimer, plus a strong warning for high-risk plants.
 *
 * Props:
 *  - use: traditional-use object with dosage/frequency/duration/administration
 *  - riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN' (optional)
 *  - compact: render a single-line summary (for lists)
 */
export default function DosageInfo({ use, riskLevel, compact = false }) {
  if (!use) return null;
  const hasDosage = use.dosage || use.frequency || use.duration || use.administration;
  const highRisk = riskLevel === 'HIGH';

  if (compact) {
    if (!hasDosage) {
      return (
        <p className="mt-2 text-xs italic text-stone-400">
          Dosage not documented yet — see plant page for details.
        </p>
      );
    }
    return (
      <div className="mt-3 rounded-lg bg-emerald-50/70 border border-emerald-100 px-3 py-2 text-xs text-emerald-900">
        <span className="font-semibold">Traditionally taken: </span>
        {[use.dosage, use.frequency, use.duration].filter(Boolean).join(' · ')}
      </div>
    );
  }

  return (
    <div className={`mt-3 rounded-xl border p-4 ${highRisk ? 'border-red-200 bg-red-50/60' : 'border-emerald-100 bg-emerald-50/50'}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="flex items-center gap-1.5 text-sm font-bold text-stone-800">
          <Beaker className={`h-4 w-4 ${highRisk ? 'text-red-600' : 'text-emerald-600'}`} />
          How it is traditionally taken
        </h4>
        {use.is_verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Expert-verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500">
            Unverified record
          </span>
        )}
      </div>

      {highRisk && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-red-100/80 px-3 py-2 text-xs font-semibold text-red-800">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          Potent plant — do not self-medicate. Only an experienced practitioner should prepare or administer this.
        </p>
      )}

      {!hasDosage ? (
        <p className="text-sm italic text-stone-500">
          The amount and method have not been documented for this use yet.
        </p>
      ) : (
        <dl className="grid gap-2.5 sm:grid-cols-2">
          {use.dosage && (
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <dt className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">
                <Beaker className="h-3 w-3" /> Amount
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-stone-800">{use.dosage}</dd>
            </div>
          )}
          {use.frequency && (
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <dt className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">
                <Repeat className="h-3 w-3" /> How often
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-stone-800">{use.frequency}</dd>
            </div>
          )}
          {use.duration && (
            <div className="rounded-lg bg-white/70 px-3 py-2">
              <dt className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">
                <Clock className="h-3 w-3" /> How long
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-stone-800">{use.duration}</dd>
            </div>
          )}
          {use.administration && (
            <div className="rounded-lg bg-white/70 px-3 py-2 sm:col-span-2">
              <dt className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">
                <Route className="h-3 w-3" /> How to take it
              </dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-stone-700">{use.administration}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-500">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        Traditionally reported use, not medical advice. Always consult a qualified health professional
        before using any plant medicinally.
      </p>
    </div>
  );
}
