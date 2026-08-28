import { useToast } from '../../contexts/ToastContext';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    ring: 'ring-emerald-200',
    bar: 'bg-emerald-500',
    iconCls: 'text-emerald-600',
    glow: 'shadow-emerald-600/10',
  },
  error: {
    icon: XCircle,
    ring: 'ring-red-200',
    bar: 'bg-red-500',
    iconCls: 'text-red-600',
    glow: 'shadow-red-600/10',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'ring-amber-200',
    bar: 'bg-amber-500',
    iconCls: 'text-amber-600',
    glow: 'shadow-amber-600/10',
  },
  info: {
    icon: Info,
    ring: 'ring-sky-200',
    bar: 'bg-sky-500',
    iconCls: 'text-sky-600',
    glow: 'shadow-sky-600/10',
  },
  loading: {
    icon: Loader2,
    ring: 'ring-stone-200',
    bar: 'bg-stone-500',
    iconCls: 'text-stone-500',
    glow: 'shadow-stone-600/10',
    spin: true,
  },
};

function ToastItem({ toast, onDismiss, onPause, onResume }) {
  const variant = VARIANTS[toast.variant] || VARIANTS.info;
  const Icon = variant.icon;

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id, toast.duration)}
      className={`toast ${toast.leaving ? 'toast-exit' : 'toast-enter'} pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-stone-100 bg-white/95 p-4 pr-10 shadow-xl ring-1 ${variant.ring} ${variant.glow} backdrop-blur`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${variant.iconCls} ${variant.spin ? 'animate-spin' : ''}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 break-words text-sm leading-relaxed text-stone-500">{toast.message}</p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}
              className="mt-2 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-700 active:scale-95"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 active:scale-90"
      >
        <X className="h-4 w-4" />
      </button>

      {toast.duration > 0 && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-stone-100">
          <div
            className={`h-full origin-left ${variant.bar}`}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
              animationPlayState: toast.paused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Fixed stack of notifications. Mounted once, near the root of the app. */
export default function ToastViewport() {
  const { toasts, dismiss, pause, resume } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2.5 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="w-full sm:w-[min(24rem,calc(100vw-3rem))]">
          <ToastItem toast={toast} onDismiss={dismiss} onPause={pause} onResume={resume} />
        </div>
      ))}
    </div>
  );
}
