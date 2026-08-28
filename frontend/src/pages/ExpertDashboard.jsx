import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { knowledgeAPI } from '../api/client';
import { useToast, describeError } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { CountUp, Reveal } from '../components/ui/motion';
import { ClipboardCheck, CheckCircle, ArrowRight, Loader2, XCircle, Clock } from 'lucide-react';

export default function ExpertDashboard() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    knowledgeAPI.pending({ page_size: 50 })
      .then(r => { setPending(r.data.results || r.data); })
      .catch(() => toast.error('Could not load the review queue', 'Please refresh to try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const quickReview = async (id, action) => {
    const labels = {
      approve: ['Approve and publish?', 'The traditional use becomes public immediately.', 'Approve'],
      reject: ['Reject this submission?', 'The contributor will be asked to submit a new version instead.', 'Reject submission'],
    };
    const [title, message, confirmLabel] = labels[action];

    const ok = await confirm({
      title,
      message,
      confirmLabel,
      tone: action === 'reject' ? 'danger' : 'primary',
    });
    if (!ok) return;

    setBusyId(id);
    try {
      await knowledgeAPI.review(id, { action, reason: action === 'reject' ? 'Rejected during quick review.' : '', comments: '' });
      setPending(prev => prev.filter(p => p.id !== id));
      toast.success(
        action === 'approve' ? 'Submission approved' : 'Submission rejected',
        action === 'approve' ? 'It is now published to the knowledge base.' : 'The contributor has been notified.',
      );
    } catch (err) {
      toast.error('Review failed', describeError(err));
    } finally {
      setBusyId(null);
    }
  };

  const byStatus = pending.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-700 to-indigo-900 p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h2 className="text-2xl font-bold mb-2">Expert Review Panel</h2>
            <p className="text-blue-100">Review and verify traditional knowledge submissions.</p>
            <Link
              to="/expert/reviews"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 active:scale-[0.98]"
            >
              Open review queue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ClipboardCheck, label: 'Awaiting review', value: pending.length, tone: 'bg-amber-50 text-amber-600' },
          { icon: Clock, label: 'Submitted', value: byStatus.SUBMITTED || 0, tone: 'bg-sky-50 text-sky-600' },
          { icon: XCircle, label: 'In revision', value: byStatus.REVISION_REQUESTED || 0, tone: 'bg-violet-50 text-violet-600' },
        ].map((stat, i) => (
          <Reveal key={stat.label} delay={i * 70}>
            <div className="rounded-xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.tone}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-800"><CountUp value={stat.value} /></p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-stone-800">Pending Submissions</h3>
          <Link to="/expert/reviews" className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer h-24 rounded-lg" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="animate-fade-in-up py-8 text-center">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-300" />
            <p className="text-stone-500">All caught up! No pending submissions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((sub, index) => (
              <Reveal key={sub.id} delay={Math.min(index * 60, 300)}>
                <div className="rounded-xl border border-stone-200 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-stone-800">
                        {sub.plant_name || sub.proposed_scientific_name || 'Plant request'}
                      </h4>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {sub.contributor_name || 'Contributor'}
                        {sub.region_name ? ` · ${sub.region_name}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {sub.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-sm text-stone-600">{sub.traditional_use_description}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/expert/reviews/${sub.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 active:scale-95"
                    >
                      Full review <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      onClick={() => quickReview(sub.id, 'approve')}
                      disabled={busyId === sub.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 disabled:opacity-60"
                    >
                      {busyId === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => quickReview(sub.id, 'reject')}
                      disabled={busyId === sub.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 active:scale-95 disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
