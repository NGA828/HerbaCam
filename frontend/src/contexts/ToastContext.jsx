import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onApiError } from '../api/client';

/**
 * Global feedback layer: every action in the application reports success,
 * failure, or pending state through this provider so the user always knows
 * what happened.
 */
const ToastContext = createContext(null);

let sequence = 0;
const nextId = () => `toast-${++sequence}`;

const DEFAULT_DURATION = {
  success: 4200,
  error: 7000,
  warning: 6000,
  info: 5000,
  loading: 0, // sticky until dismissed or replaced
};

export function ToastProvider({ children, max = 4 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const remaining = useRef(new Map());
  const startedAt = useRef(new Map());
  const durations = useRef(new Map());
  // Keeps the `toast` helper referentially stable: it is listed in the
  // dependency array of data-fetching effects, so it must NOT change identity
  // whenever a toast appears or disappears (that would refetch in a loop).
  const toastsRef = useRef(toasts);
  useEffect(() => { toastsRef.current = toasts; }, [toasts]);

  const clearTimer = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const remove = useCallback((id) => {
    clearTimer(id);
    remaining.current.delete(id);
    startedAt.current.delete(id);
    durations.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [clearTimer]);

  /** Start (or resume) the auto-dismiss countdown for a toast. */
  const arm = useCallback((id, duration) => {
    if (!duration || duration <= 0) return;
    clearTimer(id);
    durations.current.set(id, duration);
    startedAt.current.set(id, Date.now());
    timers.current.set(id, setTimeout(() => remove(id), duration));
  }, [clearTimer, remove]);

  const dismiss = useCallback((id) => {
    // Animate out, then unmount.
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    clearTimer(id);
    setTimeout(() => remove(id), 260);
  }, [clearTimer, remove]);

  const push = useCallback((variant, title, message, options = {}) => {
    const id = options.id || nextId();
    const duration = options.duration ?? DEFAULT_DURATION[variant] ?? 4500;
    const toast = {
      id,
      variant,
      title,
      message,
      duration,
      leaving: false,
      paused: false,
      action: options.action || null,
    };

    setToasts((prev) => {
      const others = prev.filter((t) => t.id !== id);
      return [...others, toast].slice(-max);
    });
    arm(id, duration);
    return id;
  }, [arm, max]);

  const pause = useCallback((id) => {
    if (!timers.current.has(id)) return;
    const started = startedAt.current.get(id) || Date.now();
    const total = remaining.current.get(id) ?? durations.current.get(id) ?? 4000;
    remaining.current.set(id, Math.max(500, total - (Date.now() - started)));
    clearTimer(id);
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: true } : t)));
  }, [clearTimer]);

  const resume = useCallback((id, duration) => {
    const left = remaining.current.get(id) ?? duration;
    startedAt.current.set(id, Date.now());
    clearTimer(id);
    timers.current.set(id, setTimeout(() => remove(id), left));
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, paused: false } : t)));
  }, [clearTimer, remove]);

  const toast = useMemo(() => {
    const api = {
      success: (title, message, options) => push('success', title, message, options),
      error: (title, message, options) => push('error', title, message, options),
      warning: (title, message, options) => push('warning', title, message, options),
      info: (title, message, options) => push('info', title, message, options),
      /** Sticky spinner toast; returns its id so you can dismiss or replace it. */
      loading: (title, message, options) => push('loading', title, message, options),
      /** Run an async task and report loading → success/error automatically. */
      promise: async (task, messages = {}) => {
        const id = nextId();
        push('loading', messages.loading || 'Working…', messages.loadingMessage || '', { id });
        try {
          const result = await task();
          push(
            'success',
            messages.success || 'Done',
            typeof messages.successMessage === 'function' ? messages.successMessage(result) : messages.successMessage || '',
            { id },
          );
          return result;
        } catch (error) {
          push(
            'error',
            messages.error || 'Something went wrong',
            typeof messages.errorMessage === 'function' ? messages.errorMessage(error) : (messages.errorMessage || describeError(error)),
            { id },
          );
          throw error;
        }
      },
      dismiss,
      dismissAll: () => toastsRef.current.forEach((t) => dismiss(t.id)),
    };
    return api;
  }, [push, dismiss]);

  // Server/network failures that no page handled locally still reach the user.
  useEffect(() => onApiError((error) => {
    if (error?.config?.skipErrorToast) return;
    const status = error?.response?.status;
    const title = !error?.response
      ? 'Connection problem'
      : status >= 500
        ? 'Server error'
        : status === 429
          ? 'Too many requests'
          : 'Request failed';
    const message = !error?.response
      ? 'The HerbaCam API is unreachable. Check that the backend is running.'
      : status >= 500
        ? `The server could not complete this request (HTTP ${status}).`
        : status === 429
          ? 'You are making requests too quickly. Please slow down and retry.'
          : error?.response?.data?.detail || error?.message || 'The request could not be completed.';
    push('error', title, message, { duration: 7000 });
  }), [push]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, toast, dismiss, pause, resume }),
    [toasts, toast, dismiss, pause, resume],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

/** Best-effort human message for a rejected request. */
export function describeError(error) {
  const data = error?.response?.data;
  if (!data) return error?.message || 'Please try again.';
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  if (data.error) return String(data.error);
  const firstKey = Object.keys(data)[0];
  const value = data[firstKey];
  if (Array.isArray(value)) return `${firstKey}: ${value[0]}`;
  if (typeof value === 'string') return `${firstKey}: ${value}`;
  return 'Please check the form and try again.';
}
