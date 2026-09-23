/**
 * Floating "Send feedback" affordance — the ANCESTOR use case of the same name.
 *
 * Mounted once at the app root so every authenticated screen can report a
 * problem without leaving the page. Administrators answer these from
 * /admin/feedback, and the author gets a notification when one is resolved.
 */
import { useState } from 'react';
import { MessageSquareWarning, Send, Star } from 'lucide-react';

import { feedbackAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { describeError, useToast } from '../contexts/ToastContext';
import { inputCls, btnPrimary, btnGhost } from './admin/ui';

const CATEGORIES = [
  ['BUG', 'Bug or defect'],
  ['SUGGESTION', 'Improvement idea'],
  ['CONTENT', 'Content or knowledge correction'],
  ['DATA', 'Missing plant or region data'],
  ['OTHER', 'Something else'],
];

export default function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('BUG');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

  // Sending feedback needs an account; guests get nothing floating at them.
  if (!user) return null;

  async function send(event) {
    event.preventDefault();
    if (!message.trim()) {
      toast.warning('Tell us what happened', 'A sentence or two is enough.');
      return;
    }
    setSaving(true);
    try {
      await feedbackAPI.send({
        category,
        message: message.trim(),
        rating: rating || undefined,
        page: window.location.pathname,
      });
      toast.success('Feedback sent', 'Thank you — an administrator will review it.');
      setMessage('');
      setRating(0);
      setOpen(false);
    } catch (err) {
      toast.error('Feedback was not sent', describeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-800 active:scale-95"
        aria-expanded={open}
      >
        <MessageSquareWarning className="h-4 w-4" />
        <span className="hidden sm:inline">Send feedback</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="fixed bottom-24 right-5 z-50 w-[min(94vw,26rem)] animate-scale-in">
            <form onSubmit={send} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
              <h2 className="font-bold text-stone-900">Send feedback</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Spotted something wrong or have an idea? This goes straight to the team.
              </p>

              <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-stone-500" htmlFor="fb-category">
                Category
              </label>
              <select
                id="fb-category" className={`${inputCls} mt-1`}
                value={category} onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-stone-500" htmlFor="fb-body">
                Your feedback
              </label>
              <textarea
                id="fb-body" className={`${inputCls} mt-1 min-h-28 resize-y`} maxLength={4000}
                value={message} onChange={(e) => setMessage(e.target.value)} required
                placeholder="What happened, what you expected, and where it occurred…"
              />

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Rating</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value} type="button" onClick={() => setRating(rating === value ? 0 : value)}
                      className={`transition ${value <= rating ? 'text-amber-500' : 'text-stone-300 hover:text-amber-300'}`}
                      aria-label={`Rate ${value} of 5`}
                    >
                      <Star className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className={btnPrimary} disabled={saving}>
                  {saving ? <span className="animate-pulse">Sending…</span> : <Send className="h-4 w-4" />} Send
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
