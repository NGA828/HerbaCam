import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck, BookOpen, CalendarDays, ClipboardList, FlaskConical, Landmark,
  Leaf, MapPin, Pencil, Plus, Save, ScrollText, Search, SlidersHorizontal,
  Sprout, Trash2, TrendingUp, UserRound,
} from 'lucide-react';
import {
  analyticsAPI, articlesAPI, auditAPI, geographyAPI, knowledgeAPI,
  plantsAPI, preservationAPI, practitionersAPI,
} from '../api/client';
import api from '../api/client';
import {
  AdminHeader, Avatar, Badge, EmptyState, ErrorState, Field, FormActions,
  FormPanel, KpiCard, Skeleton, StatusBadge, TableCard, Td, Th, Card,
  btnPrimary, btnSecondary, formatDate,
  formatDateTime, inputCls, selectCls, useList,
} from '../components/admin/ui';
import { plantImage, generatedFor } from '../utils/images';

/* Shared bits used across the admin suite ----------------------------------- */

function RowActions({ children }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

function ActionIconButton({ label, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-2 transition disabled:opacity-40 ${
        danger ? 'text-stone-400 hover:bg-red-50 hover:text-red-600' : 'text-stone-400 hover:bg-emerald-50 hover:text-emerald-700'
      }`}
    >
      {danger ? <Trash2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
    </button>
  );
}

function SaveState({ saving, message }) {
  if (saving) return <span className="text-sm font-medium text-emerald-700">Saving…</span>;
  if (message) return <span className="text-sm font-medium text-emerald-700">{message}</span>;
  return null;
}

/* 1 · Plants ---------------------------------------------------------------- */

const HABITATS = ['FOREST', 'SAVANNA', 'MOUNTAIN', 'WETLAND', 'COASTAL', 'URBAN'];
const emptyPlant = { scientific_name: '', common_name: '', family: '', genus: '', description: '', habitat: '', image: '', is_published: true };

export function PlantsManagement() {
  const { data, loading, error, reload } = useList(() => plantsAPI.adminList({ page_size: 200 }));
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const rows = useMemo(
    () => (data || []).filter((p) => {
      const hay = `${p.scientific_name} ${p.common_name} ${p.family}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    }),
    [data, q],
  );
  const published = (data || []).filter((p) => p.is_published).length;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      if (form.id) await plantsAPI.adminUpdate(form.id, form);
      else await plantsAPI.adminCreate(form);
      setForm(null);
      setFlash(form.id ? 'Plant updated.' : 'Plant created.');
      reload();
    } catch (err) {
      setFlash(err.response?.data?.scientific_name?.[0] || err.response?.data?.detail || 'Please check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete ${p.scientific_name}? This cannot be undone.`)) return;
    try {
      await plantsAPI.adminDelete(p.id);
      setFlash('Plant deleted.');
      reload();
    } catch {
      setFlash('Delete failed.');
    }
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Plant library"
        description="Curate the species database. Changes publish immediately to the public plant directory and every dependent record."
        icon={Sprout}
        action={
          <button className={btnPrimary} onClick={() => setForm({ ...emptyPlant })}>
            <Plus className="h-4 w-4" /> Add plant
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Leaf} label="Species" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={Sprout} label="Published" value={data ? published : '—'} tone="sky" />
        <KpiCard icon={FlaskConical} label="Draft / hidden" value={data ? (data.length - published) : '—'} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input className={inputCls + ' pl-10'} placeholder="Search by name, common name, or family…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <SaveState saving={saving} message={flash} />
          </div>

          {form && (
            <FormPanel title={form.id ? `Edit ${form.scientific_name}` : 'New plant'} subtitle="Scientific name is unique. Leave the image blank to use the matching botanical artwork." onDismiss={() => setForm(null)}>
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                <Field label="Scientific name" required>
                  <input className={inputCls} required value={form.scientific_name || ''} onChange={(e) => set('scientific_name', e.target.value)} placeholder="e.g. Moringa oleifera" />
                </Field>
                <Field label="Common name">
                  <input className={inputCls} value={form.common_name || ''} onChange={(e) => set('common_name', e.target.value)} placeholder="e.g. Moringa" />
                </Field>
                <Field label="Family">
                  <input className={inputCls} value={form.family || ''} onChange={(e) => set('family', e.target.value)} placeholder="e.g. Moringaceae" />
                </Field>
                <Field label="Genus">
                  <input className={inputCls} value={form.genus || ''} onChange={(e) => set('genus', e.target.value)} placeholder="e.g. Moringa" />
                </Field>
                <Field label="Habitat" className="md:col-span-2">
                  <select className={selectCls} value={form.habitat || ''} onChange={(e) => set('habitat', e.target.value)}>
                    <option value="">Select habitat…</option>
                    {HABITATS.map((h) => <option key={h} value={h}>{h.charAt(0) + h.slice(1).toLowerCase()}</option>)}
                  </select>
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <textarea className={inputCls + ' min-h-28'} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Morphology, distribution, and traditional relevance…" />
                </Field>
                <Field label="Image URL" hint="Stored on the server, served through /media.">
                  <input className={inputCls} value={form.image || ''} onChange={(e) => set('image', e.target.value)} placeholder="/media/plants/moringa.jpg" />
                </Field>
                <label className="flex items-center gap-2.5 self-end rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-medium text-stone-700">
                  <input type="checkbox" className="h-4 w-4 rounded accent-emerald-600" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                  Published to the public directory
                </label>
                <div className="md:col-span-2"><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save plant' : 'Create plant'} /></div>
              </form>
            </FormPanel>
          )}

          {!rows.length ? (
            <EmptyState icon={Leaf} title="No plants match your search." hint="Adjust the filter or add a new species to the library." />
          ) : (
            <TableCard>
              <thead>
                <tr>
                  <Th>Plant</Th>
                  <Th>Family</Th>
                  <Th>Habitat</Th>
                  <Th>Regions</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-emerald-50/40">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-stone-100">
                          <img
                            src={plantImage(p)}
                            alt={p.common_name || p.scientific_name}
                            className="h-full w-full object-cover"
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = generatedFor(p); }}
                          />
                        </div>
                        <div className="min-w-0">
                          <Link to={`/plants/${p.id}`} className="block truncate font-semibold text-stone-800 hover:text-emerald-700">{p.common_name || p.scientific_name}</Link>
                          <span className="block truncate text-xs italic text-stone-500">{p.scientific_name}</span>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="text-stone-600">{p.family || '—'}</span></Td>
                    <Td><span className="text-stone-600">{p.habitat ? p.habitat.charAt(0) + p.habitat.slice(1).toLowerCase() : '—'}</span></Td>
                    <Td><Badge tone="stone">{p.regions?.length ?? p.regions_count ?? '—'}</Badge></Td>
                    <Td>{p.is_published ? <Badge tone="emerald">Published</Badge> : <Badge tone="amber">Hidden</Badge>}</Td>
                    <Td><RowActions>
                      <ActionIconButton label="Edit" onClick={() => setForm({ ...p, image: typeof p.image === 'string' ? p.image.replace(/^https?:\/\/[^/]+/, '') : '' })} />
                      <ActionIconButton label="Delete" danger onClick={() => remove(p)} />
                    </RowActions></Td>
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

/* 2 · Knowledge -------------------------------------------------------------- */

const SUBMISSION_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'REVISION_REQUESTED'];

export function KnowledgeManagement() {
  const { data, loading, error, reload } = useList(() => knowledgeAPI.submissions({ page_size: 200 }));
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const rows = useMemo(
    () => (data || []).filter((s) => {
      if (status && s.status !== status) return false;
      const hay = `${s.plant_name} ${s.proposed_scientific_name} ${s.contributor_name} ${s.local_name}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    }),
    [data, status, q],
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Knowledge records"
        description="Every contribution from the practitioner network. Route items to expert review and keep the audit trail complete."
        icon={ClipboardList}
        action={<Link to="/expert/reviews" className={btnSecondary}><Pencil className="h-4 w-4" /> Open review queue</Link>}
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setStatus('')} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${!status ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                All{data ? ` · ${data.length}` : ''}
              </button>
              {SUBMISSION_STATUSES.map((s) => {
                const count = (data || []).filter((x) => x.status === s).length;
                if (!count) return null;
                return (
                  <button key={s} onClick={() => setStatus(status === s ? '' : s)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${status === s ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    {s.replaceAll('_', ' ')} · {count}
                  </button>
                );
              })}
              <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input className={inputCls + ' pl-10'} placeholder="Search contributions…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </Card>

          {!rows.length ? (
            <EmptyState icon={ClipboardList} title="No knowledge records here." hint="New practitioner submissions will appear the moment they are created." />
          ) : (
            <TableCard>
              <thead>
                <tr>
                  <Th>Plant</Th>
                  <Th>Contributor</Th>
                  <Th>Local name</Th>
                  <Th>Region</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Review</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const plantLabel = s.plant_name || s.proposed_scientific_name || 'Plant request';
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-emerald-50/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                            <Leaf className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-stone-800">{plantLabel}</span>
                        </div>
                      </Td>
                      <Td><span className="text-stone-600">{s.contributor_name || '—'}</span></Td>
                      <Td><span className="text-stone-600">{s.local_name || '—'}</span></Td>
                      <Td><span className="text-stone-600">{s.region_name || s.community_name || '—'}</span></Td>
                      <Td><span className="text-stone-500">{formatDate(s.created_at)}</span></Td>
                      <Td><StatusBadge value={s.status} /></Td>
                      <Td>
                        <RowActions>
                          <Link to={`/expert/reviews/${s.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50">
                            Open
                          </Link>
                        </RowActions>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
          )}
        </>
      )}
    </div>
  );
}

/* 3 · Articles --------------------------------------------------------------- */

const emptyArticle = { title: '', summary: '', content: '', category: null, is_published: false };

export function ArticlesManagement() {
  const { data, loading, error, reload } = useList(() => articlesAPI.adminList({ page_size: 200 }));
  const { data: categories } = useList(() => articlesAPI.categories());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const published = (data || []).filter((a) => a.is_published).length;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const slug = (form.slug || form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).replace(/(^-|-$)/g, '');
      const payload = { ...form, slug };
      if (form.id) await articlesAPI.adminUpdate(form.id, payload);
      else await articlesAPI.adminCreate(payload);
      setForm(null);
      setFlash(form.id ? 'Article updated.' : 'Article created.');
      reload();
    } catch (err) {
      setFlash(err.response?.data?.slug?.[0] || err.response?.data?.detail || 'Please check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try {
      await articlesAPI.adminDelete(a.id);
      setFlash('Article deleted.');
      reload();
    } catch {
      setFlash('Delete failed.');
    }
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Educational articles"
        description="Publish field notes, plant profiles, and preservation stories to the public reading room."
        icon={BookOpen}
        action={
          <button className={btnPrimary} onClick={() => setForm({ ...emptyArticle })}>
            <Plus className="h-4 w-4" /> New article
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={BookOpen} label="Articles" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={TrendingUp} label="Published" value={data ? published : '—'} tone="sky" />
        <KpiCard icon={Pencil} label="Drafts" value={data ? (data.length - published) : '—'} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={5} />
      ) : (
        <>
          {form && (
            <FormPanel title={form.id ? 'Edit article' : 'New article'} subtitle="Published articles are immediately visible on the public site." onDismiss={() => setForm(null)}>
              <form onSubmit={save} className="grid gap-4">
                <Field label="Title" required>
                  <input className={inputCls} required value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="A clear, informative title" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Category">
                    <select className={selectCls} value={form.category || ''} onChange={(e) => set('category', e.target.value || null)}>
                      <option value="">No category</option>
                      {(categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Summary">
                    <input className={inputCls} value={form.summary || ''} onChange={(e) => set('summary', e.target.value)} placeholder="One-line teaser shown in the listing" />
                  </Field>
                </div>
                <Field label="Content" required>
                  <textarea className={inputCls + ' min-h-40'} required value={form.content || ''} onChange={(e) => set('content', e.target.value)} placeholder="Write the article…" />
                </Field>
                <label className="flex items-center gap-2.5 text-sm font-medium text-stone-700">
                  <input type="checkbox" className="h-4 w-4 rounded accent-emerald-600" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                  Publish now
                </label>
                <div><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save article' : 'Create article'} /></div>
              </form>
            </FormPanel>
          )}

          <div className="flex items-center"><SaveState saving={saving} message={flash} /></div>

          {!data.length ? (
            <EmptyState icon={BookOpen} title="No articles yet." hint="Create the first article to open the reading room." action={<button className={btnPrimary} onClick={() => setForm({ ...emptyArticle })}><Plus className="h-4 w-4" /> Write article</button>} />
          ) : (
            <TableCard>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Author</Th>
                  <Th>Updated</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-emerald-50/40">
                    <Td>
                      <Link to={`/articles/${a.slug}`} className="font-semibold text-stone-800 hover:text-emerald-700">{a.title}</Link>
                      {a.summary && <span className="mt-0.5 block max-w-md truncate text-xs text-stone-500">{a.summary}</span>}
                    </Td>
                    <Td><Badge tone="sky">{a.category_name || 'General'}</Badge></Td>
                    <Td><span className="text-stone-600">{a.author_name}</span></Td>
                    <Td><span className="text-stone-500">{formatDate(a.updated_at || a.published_at)}</span></Td>
                    <Td>{a.is_published ? <Badge tone="emerald">Published</Badge> : <Badge tone="amber">Draft</Badge>}</Td>
                    <Td><RowActions>
                      <ActionIconButton label="Edit" onClick={() => setForm({ ...a, category: a.category ?? null, slug: a.slug })} />
                      <ActionIconButton label="Delete" danger onClick={() => remove(a)} />
                    </RowActions></Td>
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

/* 4 · Audit logs ------------------------------------------------------------- */

export function AuditLogs() {
  const { data, loading, error, reload } = useList(() => auditAPI.list({ page_size: 200 }));
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');

  const actions = useMemo(() => [...new Set((data || []).map((x) => x.action))].sort(), [data]);
  const rows = useMemo(
    () => (data || []).filter((x) => {
      if (action && x.action !== action) return false;
      const hay = `${x.username} ${x.action} ${x.description} ${x.target_type}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    }),
    [data, action, q],
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Audit logs"
        description="A tamper-evident record of who did what. Every privileged action on the platform is written here."
        icon={ScrollText}
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={8} />
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] max-w-md flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input className={inputCls + ' pl-10'} placeholder="Search user, action, or detail…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className={selectCls + ' w-auto min-w-[180px]'} value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}
              </select>
              <Badge tone="emerald">{rows.length} of {data.length} events</Badge>
            </div>
          </Card>

          {!rows.length ? (
            <EmptyState icon={ScrollText} title="No audit events match." hint="Try clearing the filters — new activity is recorded in real time." />
          ) : (
            <TableCard>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Detail</Th>
                  <Th>Target</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="transition-colors hover:bg-emerald-50/40">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={x.username} size="h-8 w-8 text-[10px]" />
                        <span className="font-medium text-stone-700">{x.username}</span>
                      </div>
                    </Td>
                    <Td><Badge tone="stone" className="font-mono uppercase">{x.action}</Badge></Td>
                    <Td><span className="block max-w-md text-stone-600">{x.description}</span></Td>
                    <Td><span className="text-stone-500">{x.target_type ? `${x.target_type}${x.target_id ? ` #${x.target_id}` : ''}` : '—'}</span></Td>
                    <Td><span className="whitespace-nowrap text-stone-500">{formatDateTime(x.created_at)}</span></Td>
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

/* 5 · Settings ---------------------------------------------------------------- */

const SETTINGS_DEFAULTS = {
  application: { name: 'HerbaCam', support_email: 'support@herbacam.org' },
  registration: { enabled: true, require_email: true },
  notifications: { email: true, in_app: true },
  content: { moderation: true, ai_assist: true },
  ai: { enabled: true, model: 'google/gemini-2.0-flash-exp:free' },
};

export function SettingsPage() {
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [drafts, setDrafts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    api.get('/auth/settings/')
      .then((r) => {
        const merged = { ...SETTINGS_DEFAULTS };
        Object.keys(merged).forEach((k) => {
          if (r.data?.[k]) merged[k] = { ...merged[k], ...r.data[k] };
        });
        setSettings(merged);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const dirty = Object.entries(drafts).some(([k, raw]) => {
    try {
      return JSON.stringify(JSON.parse(raw)) !== JSON.stringify(settings[k] ?? null);
    } catch {
      return true;
    }
  });

  const setKey = (k, text) => {
    try {
      setDrafts((d) => ({ ...d, [k]: text }));
    } catch {
      /* ignore malformed JSON while typing */
    }
  };

  const save = async () => {
    setSaving(true);
    setFlash('');
    try {
      const payload = {};
      Object.entries(SETTINGS_DEFAULTS).forEach(([k]) => {
        const raw = drafts[k];
        if (raw === undefined) return;
        try {
          payload[k] = JSON.parse(raw);
        } catch {
          payload[k] = settings[k];
        }
      });
      const res = await api.put('/auth/settings/', payload);
      setSettings((s) => ({ ...s, ...res.data }));
      setDrafts({});
      setFlash('Configuration saved.');
    } catch {
      setFlash('Save failed — the API may be unreachable.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="System settings"
        description="Non-secret platform configuration. Credentials and API keys are managed server-side and never exposed here."
        icon={SlidersHorizontal}
        action={<button className={btnPrimary} onClick={save} disabled={saving || !dirty}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save configuration'}</button>}
      />

      {!loaded ? (
        <Skeleton rows={4} height="h-40" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(SETTINGS_DEFAULTS).map(([k, val]) => (
            <Card key={k} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold capitalize text-stone-800">{k.replace(/_/g, ' ')}</h3>
                <Badge tone="stone">JSON</Badge>
              </div>
              <textarea
                className={inputCls + ' min-h-32 font-mono text-xs leading-relaxed'}
                value={drafts[k] !== undefined ? drafts[k] : JSON.stringify(settings[k] ?? val, null, 2)}
                onChange={(e) => setKey(k, e.target.value)}
                spellCheck={false}
              />
            </Card>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <SaveState saving={saving} message={flash} />
      </div>
    </div>
  );
}

/* 6 · Geography ---------------------------------------------------------------- */

const emptyRegion = { name: '', code: '', description: '', latitude: '', longitude: '' };

export function GeographyManagement() {
  const { data, loading, error, reload } = useList(() => geographyAPI.regions({ detailed: 1, page_size: 200 }));
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      if (form.id) await geographyAPI.updateRegion(form.id, form);
      else await geographyAPI.createRegion(form);
      setForm(null);
      setFlash(form.id ? 'Region updated.' : 'Region created.');
      reload();
    } catch (err) {
      setFlash(err.response?.data?.detail || 'Please check the fields and try again.');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Geography"
        description="Cameroon's ten administrative regions anchor the distribution map, knowledge records, and preservation analysis."
        icon={Landmark}
        action={
          <button className={btnPrimary} onClick={() => setForm({ ...emptyRegion })}>
            <Plus className="h-4 w-4" /> Add region
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          {form && (
            <FormPanel title={form.id ? `Edit ${form.name}` : 'New region'} subtitle="Coordinates are used to place the region on the interactive map." onDismiss={() => setForm(null)}>
              <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
                <Field label="Name" required>
                  <input className={inputCls} required value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Northwest" />
                </Field>
                <Field label="Code" required hint="Short postal-style code, e.g. NO.">
                  <input className={inputCls} required maxLength={4} value={form.code || ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="NO" />
                </Field>
                <Field label="Latitude">
                  <input className={inputCls} type="number" step="0.000001" value={form.latitude ?? ''} onChange={(e) => set('latitude', e.target.value)} placeholder="5.9688" />
                </Field>
                <Field label="Longitude">
                  <input className={inputCls} type="number" step="0.000001" value={form.longitude ?? ''} onChange={(e) => set('longitude', e.target.value)} placeholder="10.1542" />
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <textarea className={inputCls + ' min-h-24'} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Terrain, climate, and cultural notes…" />
                </Field>
                <div className="md:col-span-2"><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save region' : 'Create region'} /></div>
              </form>
            </FormPanel>
          )}

          <div className="flex items-center"><SaveState saving={saving} message={flash} /></div>

          <div className="grid gap-4 md:grid-cols-2">
            {(data || []).map((r) => (
              <Card key={r.id} className="group p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white">{r.code}</span>
                    <div>
                      <h3 className="font-bold text-stone-800">{r.name}</h3>
                      <p className="text-xs text-stone-500">
                        {r.latitude && r.longitude ? `${Number(r.latitude).toFixed(3)}, ${Number(r.longitude).toFixed(3)}` : 'No coordinates'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone="stone">{(r.divisions || []).length} divisions</Badge>
                    <ActionIconButton label="Edit" onClick={() => setForm({ ...r })} />
                  </div>
                </div>
                {r.description && <p className="mt-3 line-clamp-2 text-sm text-stone-600">{r.description}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* 7 · Practitioners (admin) ---------------------------------------------------- */

export function PractitionersAdmin() {
  const { data, loading, error, reload } = useList(() => practitionersAPI.list({ page_size: 200 }));

  const verified = (data || []).filter((p) => p.is_verified).length;
  const avgYears = data?.length ? Math.round(data.reduce((sum, p) => sum + (Number(p.years_of_experience) || 0), 0) / data.length) : 0;

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Practitioners"
        description="Traditional medicine practitioners who document knowledge. Verification is granted by the expert review team."
        icon={UserRound}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={UserRound} label="Practitioners" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={BadgeCheck} label="Verified" value={data ? verified : '—'} tone="sky" />
        <KpiCard icon={CalendarDays} label="Avg. experience" value={data ? `${avgYears} yrs` : '—'} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : !data.length ? (
        <EmptyState icon={UserRound} title="No practitioner profiles yet." hint="Practitioners appear here once they create a profile from their dashboard." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={p.full_name || p.username} size="h-11 w-11 text-sm" />
                  <div>
                    <h3 className="font-bold text-stone-800">{p.full_name || p.username}</h3>
                    <p className="text-xs text-stone-500">@{p.username}</p>
                  </div>
                </div>
                {p.is_verified ? <Badge tone="emerald">Verified</Badge> : <Badge tone="amber">Pending</Badge>}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Region</dt>
                  <dd className="mt-0.5 flex items-center gap-1 text-stone-700"><MapPin className="h-3.5 w-3.5 text-emerald-600" /> {p.region_name || p.community_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">Experience</dt>
                  <dd className="mt-0.5 text-stone-700">{p.years_of_experience ? `${p.years_of_experience} years` : '—'}</dd>
                </div>
              </dl>
              {p.areas_of_knowledge && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {String(p.areas_of_knowledge).split(/[,\n]/).filter(Boolean).slice(0, 4).map((a) => (
                    <Badge key={a} tone="emerald">{a.trim()}</Badge>
                  ))}
                </div>
              )}
              {p.traditional_training && <p className="mt-3 line-clamp-2 text-sm text-stone-500">{p.traditional_training}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* 8 · Analytics (admin) --------------------------------------------------------- */

export function AdminAnalytics() {
  const [stats, setStats] = useState(null);
  const { data: submissions } = useList(() => knowledgeAPI.submissions({ page_size: 200 }));
  const { data: risks } = useList(() => preservationAPI.risk({ page_size: 200 }));

  useEffect(() => {
    analyticsAPI.dashboard().then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const pipeline = useMemo(() => {
    const counts = {};
    (submissions || []).forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value }));
  }, [submissions]);

  const riskLevels = useMemo(() => {
    const counts = {};
    (risks || []).forEach((r) => { counts[r.risk_level] = (counts[r.risk_level] || 0) + 1; });
    return ['LOW', 'MODERATE', 'HIGH'].map((name) => ({ name, value: counts[name] || 0 }));
  }, [risks]);

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Platform analytics"
        description="Live health of the platform: growth, review workload, and preservation pressure, all drawn from the database."
        icon={TrendingUp}
      />

      {!stats ? (
        <Skeleton rows={4} height="h-28" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard icon={UserRound} label="Total users" value={stats.total_users} tone="sky" />
            <KpiCard icon={Leaf} label="Plants" value={stats.total_plants} tone="emerald" />
            <KpiCard icon={ClipboardList} label="Submissions" value={stats.total_submissions} tone="amber" />
            <KpiCard icon={FlaskConical} label="Identifications" value={stats.total_identifications} tone="violet" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard icon={Pencil} label="Pending reviews" value={stats.pending_submissions} tone="amber" hint="Needs expert attention" />
            <KpiCard icon={UserRound} label="Practitioners" value={stats.total_practitioners} tone="emerald" />
            <KpiCard icon={TrendingUp} label="Expert reviewers" value={stats.total_experts} tone="sky" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-stone-800">Knowledge pipeline</h3>
              <p className="mb-4 text-sm text-stone-500">Where every submission currently sits in the review journey.</p>
              {pipeline.length ? (
                <div className="space-y-3">
                  {pipeline.map((row) => {
                    const max = Math.max(...pipeline.map((r) => r.value), 1);
                    return (
                      <div key={row.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-stone-700">{row.name}</span>
                          <span className="text-stone-500">{row.value}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500" style={{ width: `${(row.value / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-stone-400">No submissions recorded yet.</p>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="mb-1 font-semibold text-stone-800">Preservation risk</h3>
              <p className="mb-4 text-sm text-stone-500">Documentation-risk assessments across regions and species.</p>
              <div className="flex h-44 items-end justify-around gap-6 px-4">
                {riskLevels.map((row, i) => {
                  const max = Math.max(...riskLevels.map((r) => r.value), 1);
                  const colors = ['from-emerald-600 to-emerald-400', 'from-amber-500 to-amber-400', 'from-red-600 to-red-400'];
                  return (
                    <div key={row.name} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-sm font-bold text-stone-700">{row.value}</span>
                      <div className={`w-full max-w-16 rounded-t-xl bg-gradient-to-t ${colors[i]}`} style={{ height: `${Math.max(6, (row.value / max) * 130)}px` }} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{row.name}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-xs text-stone-400">{risks?.length ?? 0} active assessments</p>
            </Card>
          </div>

          <div className="flex items-center gap-2 text-sm text-stone-400">
            <MapPin className="h-4 w-4" />
            {stats.total_regions ?? (risks?.length ? '10' : '—')} regions tracked · data refreshes live from the database
          </div>
        </>
      )}
    </div>
  );
}
