/**
 * Administrator triage queue for user feedback.
 *
 * Paired with components/FeedbackWidget.jsx: users submit there, answers are
 * written back here, and resolving a ticket notifies its author.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Inbox, MessageSquareWarning, RefreshCw, Send } from 'lucide-react';

import { feedbackAPI } from '../api/client';
import { describeError, useToast } from '../contexts/ToastContext';
import { PageTransition, Reveal } from '../components/ui/motion';
import {
  AdminHeader, Avatar, Badge, Card, EmptyState, ErrorState, KpiCard, Skeleton,
  StatusBadge, btnGhost, btnPrimary, btnSecondary, extractRows, formatDateTime,
  inputCls,
} from '../components/admin/ui';

const FILTERS = ['NEW', 'IN_REVIEW', 'RESOLVED'];

function Stars({ value }) {
  if (!value) return <span className="text-stone-300">—</span>;
  return (
    <span className="text-amber-500" title={`${value} of 5`}>
      {'★'.repeat(value)}<span className="text-stone-200">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export default function FeedbackQueuePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('NEW');
  const [answers, setAnswers] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await feedbackAPI.queue(filter ? { status: filter } : undefined);
      setRows(extractRows(res));
    } catch (err) {
      setError(describeError(err));
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const all = rows || [];
    return {
      shown: all.length,
      open: all.filter((r) => r.status !== 'RESOLVED').length,
      avg: all.length
        ? (all.reduce((sum, r) => sum + (r.rating || 0), 0) / all.filter((r) => r.rating).length || 0)
        : 0,
    };
  }, [rows]);

  async function respond(feedback, status) {
    setSavingId(feedback.id);
    try {
      await feedbackAPI.update(feedback.id, {
        status,
        admin_response: answers[feedback.id] ?? feedback.admin_response ?? '',
      });
      toast.success(status === 'RESOLVED' ? 'Marked resolved' : 'Moved to review',
        status === 'RESOLVED' ? 'The author has been notified.' : undefined);
      setAnswers((prev) => ({ ...prev, [feedback.id]: '' }));
      load();
    } catch (err) {
      toast.error('Could not update that ticket', describeError(err));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <PageTransition>
      <AdminHeader
        eyebrow="Administration"
        title="Feedback"
        description="What users report, and the answers they get back."
        action={(
          <button onClick={load} className={btnSecondary}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        )}
        icon={MessageSquareWarning}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <KpiCard icon={Inbox} label="In this view" value={counts.shown} />
        <KpiCard icon={MessageSquareWarning} label="Still open" value={counts.open} tone="amber" />
        <KpiCard icon={CheckCircle2} label="Average rating"
          value={counts.avg ? counts.avg.toFixed(1) : '—'} hint="out of 5" tone="violet" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setFilter('')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${!filter ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}>
          Everything
        </button>
        {FILTERS.map((option) => (
          <button key={option} onClick={() => setFilter(option)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${filter === option ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'}`}>
            {option.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && rows === null && <div className="mt-6"><Skeleton rows={4} /></div>}
      {!error && rows !== null && rows.length === 0 && (
        <div className="mt-6">
          <EmptyState icon={MessageSquareWarning} title="Nothing in this queue"
            hint={filter ? `No ${filter.replace('_', ' ').toLowerCase()} feedback right now.` : 'Users have not sent any feedback yet.'} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {(rows || []).map((feedback) => (
          <Reveal key={feedback.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Avatar name={feedback.user_name} size="h-10 w-10 text-xs" />
                  <div>
                    <p className="font-semibold text-stone-900">
                      {feedback.user_name}
                      <span className="ml-2 text-xs font-normal text-stone-400">{formatDateTime(feedback.created_at)}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone="sky">{feedback.category_display}</Badge>
                      <StatusBadge value={feedback.status} />
                      {feedback.page && <code className="text-[11px] text-stone-400">{feedback.page}</code>}
                      <Stars value={feedback.rating} />
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                {feedback.message}
              </p>

              {feedback.admin_response && (
                <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                  <span className="font-semibold">Replied: </span>{feedback.admin_response}
                </p>
              )}

              {feedback.status !== 'RESOLVED' && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1">
                    <input
                      className={inputCls}
                      placeholder="Optional reply the user will see…"
                      value={answers[feedback.id] ?? feedback.admin_response ?? ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [feedback.id]: e.target.value }))}
                    />
                  </div>
                  <button className={btnGhost} onClick={() => respond(feedback, 'IN_REVIEW')} disabled={savingId === feedback.id}>
                    Move to review
                  </button>
                  <button className={btnPrimary} onClick={() => respond(feedback, 'RESOLVED')} disabled={savingId === feedback.id}>
                    <Send className="h-4 w-4" /> Resolve
                  </button>
                </div>
              )}
            </Card>
          </Reveal>
        ))}
      </div>
    </PageTransition>
  );
}
