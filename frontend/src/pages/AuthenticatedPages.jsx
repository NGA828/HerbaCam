import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Bell, Check, ClipboardCheck, ClipboardList, FileText,
  Leaf, MapPin, Plus, ScrollText, Search, Shield, ShieldCheck, UserRound, X,
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

/* ------------------------------ Notifications ------------------------------ */

export function NotificationsPage() {
  const [items, setItems] = useState([]);
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
        action={<button onClick={() => notificationsAPI.markAllRead().then(load)} className={btnSecondary}>Mark all read</button>}
      />
      {!items.length ? (
        <EmptyState icon={Bell} title="No notifications yet." hint="Activity across your account will show up here." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {items.map((n) => (
            <div key={n.id} className={`flex gap-4 border-b border-stone-100 p-4 last:border-0 ${!n.is_read ? 'bg-emerald-50/40' : ''}`}>
              <Bell className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-stone-800">{n.title}</p>
                <p className="text-sm text-stone-600">{n.message}</p>
                <p className="mt-1 text-xs text-stone-400">{formatDateTime(n.created_at)}</p>
              </div>
              <div className="flex items-start gap-2">
                {!n.is_read && (
                  <button onClick={() => notificationsAPI.markRead(n.id).then(load)} aria-label="Mark as read" className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50">
                    <Check className="h-5 w-5" />
                  </button>
                )}
                <button onClick={() => notificationsAPI.delete(n.id).then(load)} aria-label="Delete notification" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100">
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
  const [x, setX] = useState(null);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    knowledgeAPI.submissionDetail(id).then((r) => setX(r.data)).catch(() => setError('This submission is unavailable.'));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async (action) => {
    if (action === 'reject' && !reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await knowledgeAPI.review(id, { action, comments, reason });
      nav('/expert/reviews');
    } catch (e) {
      setError(e.response?.data?.detail || 'Review could not be saved.');
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

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      if (form.id) await managerApi.update(form.id, form);
      else await managerApi.create(form);
      setForm(null);
      reload();
    } catch (e) {
      setErr(e.response?.data?.detail || 'Please check the required fields and try again.');
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
                  <button onClick={() => setForm({ ...x })} className="ml-3 shrink-0 rounded-lg p-2 text-emerald-700 transition hover:bg-emerald-50" aria-label="Edit record">
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

  const rows = (data || []).filter((x) => {
    if (role && x.role !== role) return false;
    const hay = `${x.username} ${x.email} ${x.first_name} ${x.last_name}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const update = (x, patch) => {
    usersAPI.update(x.id, patch).then(reload).catch(() => setFlash('Update failed — the API rejected the change.'));
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
                      <div className="flex items-center gap-3">
                        <Avatar name={`${x.first_name || ''} ${x.username}`.trim()} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-stone-800">{x.first_name ? `${x.first_name} ${x.last_name || ''}`.trim() : x.username}</p>
                          <p className="truncate text-xs text-stone-500">{x.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <select value={x.role} onChange={(e) => update(x, { role: e.target.value })} className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 outline-none focus:border-emerald-500">
                        {['USER', 'PRACTITIONER', 'EXPERT', 'ADMIN'].map((v) => <option key={v}>{v}</option>)}
                      </select>
                    </Td>
                    <Td><StatusPill value={x.is_active ? 'ACTIVE' : 'INACTIVE'} /></Td>
                    <Td><span className="text-stone-500">{formatDate(x.date_joined)}</span></Td>
                    <Td>
                      <div className="flex justify-end">
                        <button
                          onClick={() => update(x, { is_active: !x.is_active })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${x.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
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

  const counts = (data || []).reduce((acc, r) => {
    acc[r.risk_level] = (acc[r.risk_level] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Documentation insight"
        title="Preservation analysis"
        description="A documentation-risk indicator derived from contribution activity and geographic concentration — not a prediction of biological extinction."
        icon={AlertTriangle}
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
            <div key={x.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
