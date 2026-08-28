import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast, describeError } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
  AlertTriangle, Bell, Check, ChevronDown, ClipboardCheck, ClipboardList, FileText,
  Leaf, MapPin, Pencil, Plus, RefreshCw, ScrollText, Search, Shield, ShieldCheck,
  UserRound, X,
} from 'lucide-react';
import {
  evidenceAPI, knowledgeAPI, notificationsAPI, plantsAPI, preservationAPI,
  safetyAPI, usersAPI,
} from '../api/client';
import {
  AdminHeader, Avatar, Badge, EmptyState, ErrorState, KpiCard, Skeleton,
  StatusBadge, TableCard, Td, Th, btnPrimary, btnSecondary, formatDate,
  formatDateTime, inputCls, selectCls, useList,
} from '../components/admin/ui';

/* ------------------------------ shared helpers ----------------------------- */

const extractRows = (r) => r?.data?.results || r?.data || [];

function StatusPill({ value }) {
  return <StatusBadge value={value} />;
}

/** One component score of a preservation risk assessment (each scored 0-20). */
function ScoreRow({ label, value }) {
  const score = Number(value) || 0;
  return (
    <div>
      <dt className="font-semibold uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
          <span
            className="bar-fill block h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
            style={{ width: `${Math.min(100, (score / 20) * 100)}%` }}
          />
        </span>
        <span className="text-stone-700">{score.toFixed(1)} / 20</span>
      </dd>
    </div>
  );
}

/* ------------------------------ Notifications ------------------------------ */

export function NotificationsPage() {
  const [items, setItems] = useState([]);
  const { toast } = useToast();
  const load = () => {
    notificationsAPI.list().then((r) => setItems(extractRows(r))).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Your inbox"
        title="Notifications"
        description="Updates about identifications, reviews, and account activity."
        icon={Bell}
        action={(
          <button
            onClick={async () => {
              try {
                await notificationsAPI.markAllRead();
                toast.success('All marked as read', 'Your notification inbox is clear.');
                load();
              } catch (err) {
                toast.error('Could not update notifications', describeError(err));
              }
            }}
            className={btnSecondary}
          >
            Mark all read
          </button>
        )}
      />
      {!items.length ? (
        <EmptyState icon={Bell} title="No notifications yet." hint="Activity across your account will show up here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {items.map((n) => (
            <div key={n.id} className={`animate-rise flex gap-4 border-b border-stone-100 p-4 transition-colors last:border-0 hover:bg-stone-50 ${!n.is_read ? 'bg-emerald-50/40' : ''}`}>
              <Bell className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-800">{n.title}</p>
                <p className="text-sm text-stone-600">{n.message}</p>
                <p className="mt-1 text-xs text-stone-400">{formatDateTime(n.created_at)}</p>
              </div>
              <div className="flex items-start gap-2">
                {!n.is_read && (
                  <button
                    onClick={async () => {
                      try {
                        await notificationsAPI.markRead(n.id);
                        toast.success('Marked as read', n.title, { duration: 2600 });
                        load();
                      } catch (err) {
                        toast.error('Could not update notification', describeError(err));
                      }
                    }}
                    aria-label="Mark as read"
                    className="rounded-lg p-1.5 text-emerald-700 transition hover:bg-emerald-50 active:scale-90"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      await notificationsAPI.delete(n.id);
                      toast.info('Notification deleted', n.title, { duration: 2600 });
                      load();
                    } catch (err) {
                      toast.error('Could not delete notification', describeError(err));
                    }
                  }}
                  aria-label="Delete notification"
                  className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Contributions ------------------------------ */

export function ContributionsPage() {
  const { data, loading, error, reload } = useList(() => knowledgeAPI.submissions({ page_size: 200 }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Practitioner workspace"
        title="My contributions"
        description="Track every contribution and its verification journey."
        icon={FileText}
        action={<Link to="/practitioner/contributions/new" className={btnPrimary}><Plus className="h-4 w-4" /> Submit knowledge</Link>}
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : !data.length ? (
        <EmptyState icon={FileText} title="You haven't contributed any traditional knowledge yet." hint="Document a plant, its local name, and how it is traditionally prepared." action={<Link to="/practitioner/contributions/new" className={btnPrimary}>Submit knowledge</Link>} />
      ) : (
        <div className="grid gap-3">
          {data.map((x) => (
            <Link key={x.id} to={`/practitioner/contributions/${x.id}`} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800">
                    {x.plant_name || x.proposed_scientific_name || 'Plant request'}
                    {x.local_name && <span className="ml-2 font-normal text-stone-500">· {x.local_name}</span>}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-stone-500">{x.traditional_use_description}</p>
                  <p className="mt-2 text-xs text-stone-400">Updated {formatDate(x.updated_at)}</p>
                </div>
                <StatusPill value={x.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Submission detail ----------------------------- */

export function SubmissionDetailPage({ review = false }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [x, setX] = useState(null);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const load = () => {
    knowledgeAPI.submissionDetail(id).then((r) => setX(r.data)).catch(() => setError('This submission is unavailable.'));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const editable = !review && x && ['DRAFT', 'REJECTED', 'REVISION_REQUESTED'].includes(x.status);

  const startEdit = () => {
    setDraft({
      traditional_use_description: x.traditional_use_description || '',
      cultural_context: x.cultural_context || '',
      plant_part: x.plant_part || '',
      preparation_method: x.preparation_method || '',
      supporting_information: x.supporting_information || '',
      local_name: x.local_name || '',
      language: x.language || '',
    });
    setEditing(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await knowledgeAPI.updateSubmission(id, draft);
      toast.success('Contribution updated', x.status === 'DRAFT'
        ? 'Your draft was saved.'
        : 'Saved and resubmitted for expert review.');
      setEditing(false);
      load();
    } catch (err) {
      const message = describeError(err);
      setError(message);
      toast.error('Could not update contribution', message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (action) => {
    if (action === 'reject' && !reason.trim()) {
      setError('A rejection reason is required.');
      toast.warning('Reason required', 'Explain what needs to change before rejecting this submission.');
      return;
    }

    const labels = {
      approve: ['Submission approved', 'The contribution is now published to the knowledge base.'],
      reject: ['Submission rejected', 'The contributor has been notified with your reason.'],
      request_revision: ['Revision requested', 'The contributor has been asked to make corrections.'],
    };

    const confirmed = await confirm({
      title: action === 'approve' ? 'Approve and publish?' : action === 'reject' ? 'Reject this submission?' : 'Request corrections?',
      message: action === 'approve'
        ? 'The traditional use will become visible to every visitor immediately.'
        : action === 'reject'
          ? 'The contributor will see your reason and can submit a new version.'
          : 'The contributor will be asked to correct and resubmit.',
      confirmLabel: action === 'reject' ? 'Reject submission' : 'Confirm',
      tone: action === 'reject' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    setBusy(true);
    setError('');
    try {
      await knowledgeAPI.review(id, { action, comments, reason });
      const [title, message] = labels[action];
      toast.success(title, message);
      nav('/expert/reviews');
    } catch (e) {
      const message = describeError(e);
      setError(message);
      toast.error('Review could not be saved', message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !x) return <div className="space-y-6"><AdminHeader eyebrow={review ? 'Expert review' : 'Contribution'} title="Submission" /><ErrorState message={error} onRetry={load} /></div>;
  if (!x) return <div className="space-y-6"><AdminHeader eyebrow={review ? 'Expert review' : 'Contribution'} title="Submission" /><Skeleton rows={4} /></div>;

  const fields = [
    ['Plant', x.plant_name || x.proposed_scientific_name],
    ['Local name', x.local_name],
    ['Traditional association', x.traditional_use_description],
    ['Symptom', x.symptom_name || x.proposed_symptom_name],
    ['Region', x.region_name],
    ['Community', x.community_name],
    ['Preparation', x.preparation_method_name || x.preparation_method],
    ['Supporting information', x.supporting_information],
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow={review ? 'Expert review' : 'Contribution'}
        title={x.plant_name || x.proposed_scientific_name || 'Knowledge submission'}
        description={`Submitted ${formatDate(x.created_at)} by ${x.contributor_name || 'you'}.`}
        icon={FileText}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{label}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{value || 'Not provided'}</p>
            </div>
          ))}
        </section>
        <aside className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <StatusPill value={x.status} />
          {x.review_comments && (
            <p className="text-sm"><b>Reviewer comments:</b><br />{x.review_comments}</p>
          )}
          {x.review_reason && (
            <p className="text-sm text-red-700"><b>Required corrections:</b><br />{x.review_reason}</p>
          )}
          {editable && !editing && (
            <button onClick={startEdit} className={btnPrimary}>
              <Pencil className="h-4 w-4" /> {x.status === 'DRAFT' ? 'Continue draft' : 'Edit & resubmit'}
            </button>
          )}

          {editing && (
            <form onSubmit={saveEdit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">How it is used *</span>
                <textarea required value={draft.traditional_use_description} onChange={(e) => setDraft({ ...draft, traditional_use_description: e.target.value })} className={inputCls + ' min-h-28'} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Local name</span>
                <input value={draft.local_name || ''} onChange={(e) => setDraft({ ...draft, local_name: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Language</span>
                <input value={draft.language || ''} onChange={(e) => setDraft({ ...draft, language: e.target.value })} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Cultural context</span>
                <textarea value={draft.cultural_context || ''} onChange={(e) => setDraft({ ...draft, cultural_context: e.target.value })} className={inputCls + ' min-h-20'} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-stone-500">Supporting information</span>
                <textarea value={draft.supporting_information || ''} onChange={(e) => setDraft({ ...draft, supporting_information: e.target.value })} className={inputCls + ' min-h-20'} />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => { setEditing(false); setError(''); }} className={btnSecondary}>Cancel</button>
              </div>
            </form>
          )}

          {review && (
            <>
              <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Review comments" className={inputCls + ' min-h-24'} />
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required to reject)" className={inputCls + ' min-h-20'} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="grid gap-2">
                <button disabled={busy} onClick={() => submit('approve')} className={btnPrimary}>Approve & publish</button>
                <button disabled={busy} onClick={() => submit('request_revision')} className="rounded-xl bg-amber-100 p-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-200 disabled:opacity-60">Request corrections</button>
                <button disabled={busy} onClick={() => submit('reject')} className="rounded-xl bg-red-50 p-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60">Reject</button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------- Reviews ---------------------------------- */

export function ReviewsPage() {
  const { data, loading, error, reload } = useList(() => knowledgeAPI.pending({ page_size: 200 }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Quality assurance"
        title="Pending reviews"
        description="Review documentation carefully. Every decision is stored in the audit trail."
        icon={ClipboardCheck}
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : !data.length ? (
        <EmptyState icon={ClipboardCheck} title="You're all caught up." hint="New practitioner submissions will land here for review." />
      ) : (
        <div className="grid gap-3">
          {data.map((x) => (
            <Link key={x.id} to={`/expert/reviews/${x.id}`} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="min-w-0">
                <b className="text-stone-800">{x.plant_name || x.proposed_scientific_name || 'Plant request'}</b>
                <small className="ml-2 text-stone-500">{x.contributor_name}{x.region_name ? ` · ${x.region_name}` : ''}</small>
              </span>
              <ClipboardCheck className="h-5 w-5 shrink-0 text-emerald-700" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Record manager ------------------------------ */

export function RecordManager({ kind }) {
  const managerApi = kind === 'evidence' ? evidenceAPI : safetyAPI;
  const { data, loading, error, reload } = useList(() => managerApi.list({ page_size: 200 }));
  const { data: plants } = useList(() => plantsAPI.adminList({ page_size: 200 }));
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const openEdit = async (x) => {
    try {
      const res = await managerApi.detail(x.id);
      setForm({ ...res.data });
    } catch {
      setForm({ ...x });
      toast.warning('Opened with list data', 'The full record could not be refreshed from the API.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const isEdit = Boolean(form.id);
      if (isEdit) await managerApi.update(form.id, form);
      else await managerApi.create(form);
      const label = isEdit ? 'Record updated' : 'Record created';
      setForm(null);
      toast.success(label, isEdit
        ? 'Your changes were saved to the documented base.'
        : 'The record is now part of the knowledge base.');
      reload();
    } catch (err) {
      const message = describeError(err);
      setErr(message);
      toast.error('Could not save record', message);
    } finally {
      setSaving(false);
    }
  };

  const title = kind === 'evidence' ? 'Scientific evidence' : 'Safety information';
  const description = kind === 'evidence'
    ? 'Evidence levels describe the available research; they do not automatically validate traditional claims.'
    : 'Safety records are human-reviewed; HerbaCam never invents medical safety guidance.';

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Expert records"
        title={title}
        description={description}
        icon={kind === 'evidence' ? ShieldCheck : Shield}
        action={<button onClick={() => setForm({})} className={btnPrimary}><Plus className="h-4 w-4" /> Add record</button>}
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={5} />
      ) : (
        <>
          {form && (
            <section className="rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-5 shadow-sm">
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">Plant <span className="text-emerald-600">*</span></span>
                  <select required value={form.plant || ''} onChange={(e) => set('plant', e.target.value)} className={selectCls}>
                    <option value="">Select plant…</option>
                    {(plants || []).map((p) => <option key={p.id} value={p.id}>{p.scientific_name}</option>)}
                  </select>
                </label>
                {kind === 'evidence' ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">Evidence level <span className="text-emerald-600">*</span></span>
                      <select required value={form.level || ''} onChange={(e) => set('level', e.target.value)} className={selectCls}>
                        <option value="">Select level…</option>
                        {['INSUFFICIENT', 'PRELIMINARY', 'MODERATE', 'STRONG'].map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">Source <span className="text-emerald-600">*</span></span>
                      <input required placeholder="Journal, study, or reference" value={form.source || ''} onChange={(e) => set('source', e.target.value)} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">Summary</span>
                      <textarea placeholder="What does the evidence show?" value={form.summary || ''} onChange={(e) => set('summary', e.target.value)} className={inputCls + ' min-h-24'} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">Risk level</span>
                      <select value={form.risk_level || 'LOW'} onChange={(e) => set('risk_level', e.target.value)} className={selectCls}>
                        {['LOW', 'MODERATE', 'HIGH'].map((x) => <option key={x}>{x}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">Precautions</span>
                      <textarea placeholder="Dose guidance, monitoring, interactions…" value={form.precautions || ''} onChange={(e) => set('precautions', e.target.value)} className={inputCls + ' min-h-24'} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-stone-500">General warning</span>
                      <textarea placeholder="Populations to avoid, contraindications…" value={form.general_warning || ''} onChange={(e) => set('general_warning', e.target.value)} className={inputCls + ' min-h-24'} />
                    </label>
                  </>
                )}
                <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                  <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save record'}</button>
                  <button type="button" onClick={() => setForm(null)} disabled={saving} className={btnSecondary}>Cancel</button>
                  {err && <span className="text-sm text-red-600">{err}</span>}
                </div>
              </form>
            </section>
          )}

          {!data.length ? (
            <EmptyState icon={kind === 'evidence' ? ShieldCheck : Shield} title={`No ${title.toLowerCase()} records yet.`} hint="Add the first record to start building the documented base." />
          ) : (
            <div className="grid gap-3">
              {data.map((x) => (
                <div key={x.id} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:bg-emerald-50/30">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-stone-800">{x.plant_name}</b>
                      <StatusBadge value={kind === 'evidence' ? x.level : x.risk_level} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-stone-500">{x.source || x.precautions || 'No notes yet'}</p>
                  </div>
                  <button onClick={() => openEdit(x)} className="ml-3 shrink-0 rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50 active:scale-95" aria-label="Edit record">
                    <ClipboardList className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------- Admin users ------------------------------- */

export function AdminUsersPage() {
  const { data, loading, error, reload } = useList(() => usersAPI.list({ page_size: 200 }));
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [flash, setFlash] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  const toggleUser = async (x) => {
    if (openId === x.id) { setOpenId(null); return; }
    setOpenId(x.id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await usersAPI.detail(x.id);
      setDetail(res.data);
    } catch (err) {
      toast.error('Could not load user detail', describeError(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const rows = (data || []).filter((x) => {
    if (role && x.role !== role) return false;
    const hay = `${x.username} ${x.email} ${x.first_name} ${x.last_name}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const update = async (x, patch, message) => {
    try {
      await usersAPI.update(x.id, patch);
      setFlash('Saved.');
      toast.success('User updated', message);
      reload();
    } catch (err) {
      setFlash('Update failed.');
      toast.error('Could not update user', describeError(err));
    }
  };

  const changeRole = async (x, nextRole) => {
    const ok = await confirm({
      title: `Change ${x.username} to ${nextRole}?`,
      message: 'The new role takes effect immediately and changes what this person can access.',
      confirmLabel: 'Change role',
      tone: nextRole === 'ADMIN' ? 'danger' : 'primary',
    });
    if (!ok) return;
    await update(x, { role: nextRole }, `${x.username} is now ${nextRole}.`);
  };

  const toggleActive = async (x) => {
    const next = !x.is_active;
    const ok = await confirm({
      title: next ? `Reactivate ${x.username}?` : `Deactivate ${x.username}?`,
      message: next
        ? 'This account will be able to sign in again.'
        : 'This account will be signed out and will not be able to sign in.',
      confirmLabel: next ? 'Reactivate' : 'Deactivate',
      tone: next ? 'primary' : 'danger',
    });
    if (!ok) return;
    await update(x, { is_active: next }, `${x.username} was ${next ? 'reactivated' : 'deactivated'}.`);
  };

  const counts = (data || []).reduce((acc, x) => {
    acc[x.role] = (acc[x.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Users & access"
        description="Role assignments and account status are enforced by the API, not merely hidden in this interface."
        icon={UserRound}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard icon={UserRound} label="Total users" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={UserRound} label="Practitioners" value={counts.PRACTITIONER || 0} tone="sky" />
        <KpiCard icon={ShieldCheck} label="Experts" value={counts.EXPERT || 0} tone="amber" />
        <KpiCard icon={ScrollText} label="Admins" value={counts.ADMIN || 0} tone="violet" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input className={inputCls + ' pl-10'} placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className={selectCls + ' w-auto min-w-[170px]'} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {['USER', 'PRACTITIONER', 'EXPERT', 'ADMIN'].map((v) => <option key={v}>{v}</option>)}
            </select>
            <span className="text-sm font-medium text-emerald-700">{flash}</span>
          </div>

          {!rows.length ? (
            <EmptyState icon={UserRound} title="No users match your filters." />
          ) : (
            <TableCard>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="transition-colors hover:bg-emerald-50/40">
                    <Td>
                      <button type="button" onClick={() => toggleUser(x)} className="flex w-full items-center gap-3 text-left">
                        <Avatar name={`${x.first_name || ''} ${x.username}`.trim()} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-stone-800">{x.first_name ? `${x.first_name} ${x.last_name || ''}`.trim() : x.username}</p>
                          <p className="truncate text-xs text-stone-500">{x.email}</p>
                        </div>
                      </button>
                      {openId === x.id && (
                        <div className="animate-fade-in-up mt-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                          {detailLoading ? (
                            <div className="space-y-2">
                              <div className="skeleton-shimmer h-3 w-1/2 rounded" />
                              <div className="skeleton-shimmer h-3 w-2/3 rounded" />
                            </div>
                          ) : (
                            <dl className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Username</dt>
                                <dd className="text-stone-700">@{detail?.username || x.username}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Phone</dt>
                                <dd className="text-stone-700">{detail?.phone || '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Last login</dt>
                                <dd className="text-stone-700">{detail?.last_login ? formatDateTime(detail.last_login) : '—'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Joined</dt>
                                <dd className="text-stone-700">{formatDate(detail?.date_joined || x.date_joined)}</dd>
                              </div>
                              {detail?.bio && (
                                <div className="col-span-2">
                                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Bio</dt>
                                  <dd className="text-stone-600">{detail.bio}</dd>
                                </div>
                              )}
                            </dl>
                          )}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <select value={x.role} onChange={(e) => changeRole(x, e.target.value)} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 outline-none transition focus:border-emerald-500">
                        {['USER', 'PRACTITIONER', 'EXPERT', 'ADMIN'].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </Td>
                    <Td><StatusPill value={x.is_active ? 'ACTIVE' : 'INACTIVE'} /></Td>
                    <Td><span className="text-stone-500">{formatDate(x.date_joined)}</span></Td>
                    <Td>
                      <div className="flex justify-end">
                        <button
                          onClick={() => toggleActive(x)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95 ${x.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                        >
                          {x.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------ Preservation ------------------------------- */

const RISK_BAR = { LOW: 'bg-emerald-500', MODERATE: 'bg-amber-500', HIGH: 'bg-red-500' };

export function PreservationPage() {
  const { data, loading, error, reload } = useList(() => preservationAPI.risk({ page_size: 200 }));
  const { toast } = useToast();
  const [recalculating, setRecalculating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);

  const counts = (data || []).reduce((acc, r) => {
    acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
    return acc;
  }, {});

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const res = await preservationAPI.calculate();
      toast.success('Risk assessment complete', res.data?.detail || 'Documentation risk was recalculated.');
      reload();
    } catch (err) {
      toast.error('Assessment failed', describeError(err));
    } finally {
      setRecalculating(false);
    }
  };

  const toggleDetail = async (id) => {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    try {
      const res = await preservationAPI.riskDetail(id);
      setDetail(res.data);
    } catch (err) {
      toast.error('Could not load assessment detail', describeError(err));
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Documentation insight"
        title="Preservation analysis"
        description="A documentation-risk indicator derived from contribution activity and geographic concentration — not a prediction of biological extinction."
        icon={AlertTriangle}
        action={(
          <button onClick={recalculate} disabled={recalculating} className={btnPrimary}>
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculating…' : 'Recalculate risk'}
          </button>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Leaf} label="Assessments" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={AlertTriangle} label="High risk" value={counts.HIGH || 0} tone="red" hint="Prioritise documentation outreach" />
        <KpiCard icon={MapPin} label="Moderate risk" value={counts.MODERATE || 0} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={5} />
      ) : !data.length ? (
        <EmptyState icon={Leaf} title="No preservation assessments are available yet." hint="Risk assessments are generated as knowledge contributions accumulate." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((x) => (
            <div key={x.id} className="animate-rise rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge value={x.risk_level} />
                <span className="text-lg font-bold text-stone-800">{Math.round(x.risk_score ?? 0)}<span className="text-xs font-medium text-stone-400"> / 100</span></span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className={`h-full rounded-full ${RISK_BAR[x.risk_level] || 'bg-stone-400'}`} style={{ width: `${Math.min(100, Math.max(4, x.risk_score ?? 0))}%` }} />
              </div>
              <h3 className="mt-4 font-bold text-stone-800">
                {x.plant_name || 'Regional assessment'}
                {x.region_name && <span className="ml-2 text-sm font-medium text-stone-500">· {x.region_name}</span>}
              </h3>
              <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-stone-600">
                {x.reasoning || x.reasons || 'Documentation assessment based on contribution activity and geographic concentration.'}
              </p>
              {(x.total_contributors != null || x.total_traditional_uses != null) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="stone">{x.total_contributors ?? 0} contributors</Badge>
                  <Badge tone="stone">{x.total_traditional_uses ?? 0} documented uses</Badge>
                  {x.days_since_last_contribution != null && (
                    <Badge tone="stone">{x.days_since_last_contribution} days since last entry</Badge>
                  )}
                </div>
              )}

              <button
                onClick={() => toggleDetail(x.id)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 transition hover:text-emerald-800"
              >
                {expanded === x.id ? 'Hide breakdown' : 'View breakdown'}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded === x.id ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid overflow-hidden transition-all duration-300 ${expanded === x.id ? 'mt-4 max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                {detail && expanded === x.id && (
                  <dl className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-4 text-xs">
                    <ScoreRow label="Contributor scarcity" value={detail.contributor_scarcity_score} />
                    <ScoreRow label="Knowledge recency" value={detail.knowledge_recency_score} />
                    <ScoreRow label="Geographic concentration" value={detail.geographic_concentration_score} />
                    <ScoreRow label="Documentation scarcity" value={detail.documentation_scarcity_score} />
                    <ScoreRow label="Submission decline" value={detail.submission_decline_score} />
                    <div>
                      <dt className="font-semibold uppercase tracking-wide text-stone-400">Regions covered</dt>
                      <dd className="mt-1 text-stone-700">{detail.unique_regions_count ?? 0}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
