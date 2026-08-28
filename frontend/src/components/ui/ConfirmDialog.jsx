import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

const ConfirmContext = createContext(null);

/**
 * promise-based confirm() replacement: `await confirm({ title, ... })` → boolean.
 * Used instead of window.confirm so destructive actions get the same animated,
 * accessible treatment as the rest of the interface.
 */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null); // null = closed
  const [busy, setBusy] = useState(false);
  const resolver = useRef(null);

  const confirm = useCallback((config = {}) => {
    setBusy(false);
    setOptions({
      title: 'Are you sure?',
      message: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'danger',
      onConfirm: null,
      ...config,
    });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = useCallback(async (value) => {
    const current = options;
    if (value && current?.onConfirm) {
      try {
        setBusy(true);
        await current.onConfirm();
      } catch {
        setBusy(false);
        // Keep the dialog open so the user can retry or cancel.
        return;
      }
    }
    setBusy(false);
    setOptions(null);
    resolver.current?.(value);
    resolver.current = null;
  }, [options]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] animate-fade-in"
            onClick={() => !busy && finish(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-stone-200 animate-scale-in"
          >
            <div className="flex items-start gap-4">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  options.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-base font-bold text-stone-900">{options.title}</h2>
                {options.message && (
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{options.message}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => finish(false)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60"
              >
                {options.cancelLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => finish(true)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${
                  options.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {options.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context.confirm;
}
