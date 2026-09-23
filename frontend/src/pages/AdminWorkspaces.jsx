import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, BadgeCheck, BookOpen, CalendarDays, Check, ChevronDown, Globe, ShieldCheck,
  ClipboardList, Code, FlaskConical, Landmark, Leaf, MapPin, Pencil, Plus, Save,
  ScrollText, Search, SlidersHorizontal, Sprout, Stethoscope, Trash2, TrendingUp,
  UserRound, Users
} from 'lucide-react';
import {
  analyticsAPI, articlesAPI, auditAPI, authAPI, geographyAPI, knowledgeAPI,
  plantsAPI, preservationAPI, practitionersAPI, symptomsAPI,
} from '../api/client';
import { useToast, describeError } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
  AdminHeader, Avatar, Badge, EmptyState, ErrorState, Field, FormActions,
  FormPanel, KpiCard, Skeleton, StatusBadge, TableCard, Td, Th, Card,
  btnPrimary, btnSecondary, formatDate, formatDateTime, inputCls, selectCls, useList,
} from '../components/admin/ui';
import { generatedFor, plantImage } from '../utils/images';

/* Shared bits used across the admin suite ----------------------------------- */

function RowActions({ children }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

function ActionIconButton({ label, onClick, danger, disabled, icon: Icon }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`group relative inline-flex items-center justify-center rounded-lg p-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${
        danger 
          ? 'text-stone-400 hover:bg-red-50 hover:text-red-600' 
          : 'text-stone-400 hover:bg-emerald-50 hover:text-emerald-600'
      }`}
    >
      {Icon ? <Icon className="h-4 w-4" /> : (danger ? <Trash2 className="h-4 w-4" /> : <Pencil className="h-4 w-4" />)}
    </button>
  );
}

function SaveState({ saving, message }) {
  if (saving) return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 animate-pulse">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Saving…
    </span>
  );
  if (message) return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
      <Check className="h-3.5 w-3.5" />
      {message}
    </span>
  );
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
  const { toast } = useToast();
  const confirm = useConfirm();

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
      const isEdit = Boolean(form.id);
      if (isEdit) await plantsAPI.adminUpdate(form.id, form);
      else await plantsAPI.adminCreate(form);
      const label = isEdit ? 'Plant updated' : 'Plant created';
      setForm(null);
      setFlash(`${label}.`);
      toast.success(label, `${form.scientific_name} was saved to the library.`);
      reload();
    } catch (err) {
      const message = describeError(err);
      setFlash(message);
      toast.error('Could not save plant', message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (p) => {
    setFlash('');
    try {
      const res = await plantsAPI.adminDetail(p.id);
      setForm({ ...res.data });
    } catch {
      setForm({ ...p });
      toast.warning('Opened with list data', 'The full record could not be refreshed from the API.');
    }
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: `Delete ${p.scientific_name}?`,
      message: 'Every traditional use, evidence record and safety record attached to this plant will also be removed. This cannot be undone.',
      confirmLabel: 'Delete plant',
    });
    if (!ok) return;
    try {
      await plantsAPI.adminDelete(p.id);
      setFlash('Plant deleted.');
      toast.success('Plant deleted', `${p.scientific_name} was removed from the library.`);
      reload();
    } catch (err) {
      toast.error('Delete failed', describeError(err));
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
        <KpiCard icon={Leaf} label="Total Species" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={Sprout} label="Published" value={data ? published : '—'} tone="sky" />
        <KpiCard icon={FlaskConical} label="Draft / Hidden" value={data ? (data.length - published) : '—'} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input 
                className={`${inputCls} pl-10 transition-all focus:ring-2 focus:ring-emerald-500/20`} 
                placeholder="Search by scientific name, common name, or family…" 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
              />
            </div>
            <SaveState saving={saving} message={flash} />
          </div>

          {form && (
            <FormPanel title={form.id ? `Edit ${form.scientific_name}` : 'New plant'} subtitle="Scientific name is unique. Leave the image blank to use the matching botanical artwork." onDismiss={() => setForm(null)}>
              <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
                <Field label="Scientific name" required>
                  <input className={`${inputCls} font-medium`} required value={form.scientific_name || ''} onChange={(e) => set('scientific_name', e.target.value)} placeholder="e.g. Moringa oleifera" />
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
                  <textarea className={`${inputCls} min-h-28 resize-y`} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Morphology, distribution, and traditional relevance…" />
                </Field>
                <Field label="Image URL" hint="Stored on the server, served through /media.">
                  <input className={inputCls} value={form.image || ''} onChange={(e) => set('image', e.target.value)} placeholder="/media/plants/moringa.jpg" />
                </Field>
                <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30">
                  <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                  Published to the public directory
                </label>
                <div className="md:col-span-2 pt-2"><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save plant' : 'Create plant'} /></div>
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
                  <tr key={p.id} className="group transition-colors duration-150 hover:bg-emerald-50/40">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-stone-100 transition-transform group-hover:scale-105">
                          <img
                            src={plantImage(p)}
                            alt={p.common_name || p.scientific_name}
                            className="h-full w-full object-cover"
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = generatedFor(p); }}
                          />
                        </div>
                        <div className="min-w-0">
                          <Link to={`/plants/${p.id}`} className="block truncate font-semibold text-stone-800 transition-colors hover:text-emerald-700">{p.common_name || p.scientific_name}</Link>
                          <span className="block truncate text-xs italic text-stone-500">{p.scientific_name}</span>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="text-sm text-stone-600">{p.family || '—'}</span></Td>
                    <Td><span className="text-sm text-stone-600">{p.habitat ? p.habitat.charAt(0) + p.habitat.slice(1).toLowerCase() : '—'}</span></Td>
                    <Td><Badge tone="stone">{p.regions?.length ?? p.regions_count ?? '—'}</Badge></Td>
                    <Td>{p.is_published ? <Badge tone="emerald">Published</Badge> : <Badge tone="amber">Hidden</Badge>}</Td>
                    <Td><RowActions>
                      <ActionIconButton label="Edit" onClick={() => openEdit(p)} />
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
              <button onClick={() => setStatus('')} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${!status ? 'bg-emerald-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                All{data ? ` · ${data.length}` : ''}
              </button>
              {SUBMISSION_STATUSES.map((s) => {
                const count = (data || []).filter((x) => x.status === s).length;
                if (!count) return null;
                return (
                  <button key={s} onClick={() => setStatus(status === s ? '' : s)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${status === s ? 'bg-emerald-700 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                    {s.replaceAll('_', ' ')} · {count}
                  </button>
                );
              })}
              <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input className={`${inputCls} pl-10 transition-all focus:ring-2 focus:ring-emerald-500/20`} placeholder="Search contributions…" value={q} onChange={(e) => setQ(e.target.value)} />
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
                    <tr key={s.id} className="group transition-colors duration-150 hover:bg-emerald-50/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition-transform group-hover:scale-105">
                            <Leaf className="h-4 w-4" />
                          </div>
                          <span className="font-semibold text-stone-800">{plantLabel}</span>
                        </div>
                      </Td>
                      <Td><span className="text-sm text-stone-600">{s.contributor_name || '—'}</span></Td>
                      <Td><span className="text-sm text-stone-600">{s.local_name || '—'}</span></Td>
                      <Td><span className="text-sm text-stone-600">{s.region_name || s.community_name || '—'}</span></Td>
                      <Td><span className="text-sm text-stone-500">{formatDate(s.created_at)}</span></Td>
                      <Td><StatusBadge value={s.status} /></Td>
                      <Td>
                        <RowActions>
                          <Link to={`/expert/reviews/${s.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95">
                            Open <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
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
  const { toast } = useToast();
  const confirm = useConfirm();

  const published = (data || []).filter((a) => a.is_published).length;

  const openEdit = async (a) => {
    setFlash('');
    try {
      const res = await articlesAPI.adminDetail(a.id);
      setForm({ ...res.data, category: res.data.category ?? null });
    } catch {
      setForm({ ...a, category: a.category ?? null, slug: a.slug });
      toast.warning('Opened with list data', 'The full article could not be refreshed from the API.');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const slug = (form.slug || form.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).replace(/(^-|-$)/g, '');
      const payload = { ...form, slug };
      const isEdit = Boolean(form.id);
      if (isEdit) await articlesAPI.adminUpdate(form.id, payload);
      else await articlesAPI.adminCreate(payload);
      const label = isEdit ? 'Article updated' : 'Article created';
      setForm(null);
      setFlash(`${label}.`);
      toast.success(label, isEdit
        ? 'Your changes are live in the reading room.'
        : (payload.is_published ? 'The article is published and visible to readers.' : 'Saved as a draft.'));
      reload();
    } catch (err) {
      const message = describeError(err);
      setFlash(message);
      toast.error('Could not save article', message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    const ok = await confirm({
      title: `Delete "${a.title}"?`,
      message: 'The article will be permanently removed from the reading room.',
      confirmLabel: 'Delete article',
    });
    if (!ok) return;
    try {
      await articlesAPI.adminDelete(a.id);
      setFlash('Article deleted.');
      toast.success('Article deleted', `"${a.title}" was removed.`);
      reload();
    } catch (err) {
      toast.error('Delete failed', describeError(err));
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
        <KpiCard icon={BookOpen} label="Total Articles" value={data?.length ?? '—'} tone="emerald" />
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
              <form onSubmit={save} className="grid gap-5">
                <Field label="Title" required>
                  <input className={`${inputCls} text-lg font-medium`} required value={form.title || ''} onChange={(e) => set('title', e.target.value)} placeholder="A clear, informative title" />
                </Field>
                <div className="grid gap-5 md:grid-cols-2">
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
                  <textarea className={`${inputCls} min-h-48 resize-y font-mono text-sm leading-relaxed`} required value={form.content || ''} onChange={(e) => set('content', e.target.value)} placeholder="Write the article content here…" />
                </Field>
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-stone-700 transition-colors hover:text-emerald-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500" checked={!!form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
                  Publish immediately upon saving
                </label>
                <div className="pt-2"><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save article' : 'Create article'} /></div>
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
                  <tr key={a.id} className="group transition-colors duration-150 hover:bg-emerald-50/40">
                    <Td>
                      <Link to={`/articles/${a.slug}`} className="block font-semibold text-stone-800 transition-colors hover:text-emerald-700">{a.title}</Link>
                      {a.summary && <span className="mt-1 block max-w-md truncate text-xs text-stone-500">{a.summary}</span>}
                    </Td>
                    <Td><Badge tone="sky">{a.category_name || 'General'}</Badge></Td>
                    <Td><span className="text-sm text-stone-600">{a.author_name}</span></Td>
                    <Td><span className="text-sm text-stone-500">{formatDate(a.updated_at || a.published_at)}</span></Td>
                    <Td>{a.is_published ? <Badge tone="emerald">Published</Badge> : <Badge tone="amber">Draft</Badge>}</Td>
                    <Td><RowActions>
                      <ActionIconButton label="Edit" onClick={() => openEdit(a)} />
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
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative min-w-[240px] max-w-md flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input className={`${inputCls} pl-10 transition-all focus:ring-2 focus:ring-emerald-500/20`} placeholder="Search user, action, or detail…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className={`${selectCls} w-auto min-w-[180px] transition-all focus:ring-2 focus:ring-emerald-500/20`} value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">All actions</option>
                {actions.map((a) => <option key={a} value={a}>{a.replaceAll('_', ' ')}</option>)}
              </select>
              <Badge tone="emerald" className="ml-auto">{rows.length} of {data.length} events</Badge>
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
                  <tr key={x.id} className="group transition-colors duration-150 hover:bg-emerald-50/40">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={x.username} size="h-8 w-8 text-[10px]" />
                        <span className="font-medium text-stone-700">{x.username}</span>
                      </div>
                    </Td>
                    <Td><Badge tone="stone" className="font-mono text-[10px] uppercase tracking-wider">{x.action}</Badge></Td>
                    <Td><span className="block max-w-md text-sm text-stone-600">{x.description}</span></Td>
                    <Td><span className="text-sm text-stone-500">{x.target_type ? `${x.target_type}${x.target_id ? ` #${x.target_id}` : ''}` : '—'}</span></Td>
                    <Td><span className="whitespace-nowrap text-sm text-stone-500">{formatDateTime(x.created_at)}</span></Td>
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
  application: { name: 'Ancestor', support_email: 'support@herbacam.org' },
  registration: { enabled: true, require_email: true },
  notifications: { email: true, in_app: true },
  content: { moderation: true, ai_assist: true },
  ai: { enabled: true, model: 'google/gemini-3.8-flash' },
};

export function SettingsPage() {
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS);
  const [drafts, setDrafts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    authAPI.getSettings()
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
      const res = await authAPI.updateSettings(payload);
      setSettings((s) => ({ ...s, ...res.data }));
      setDrafts({});
      setFlash('Configuration saved.');
      toast.success('Settings saved', `${Object.keys(payload).length} section(s) updated.`);
    } catch (err) {
      setFlash('Save failed — the API may be unreachable.');
      toast.error('Could not save settings', describeError(err));
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
        action={
          <button className={`${btnPrimary} flex items-center gap-2`} onClick={save} disabled={saving || !dirty}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save configuration'}
          </button>
        }
      />

      {!loaded ? (
        <Skeleton rows={4} height="h-40" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {Object.entries(SETTINGS_DEFAULTS).map(([k, val]) => (
            <Card key={k} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-5 py-3">
                <h3 className="flex items-center gap-2 font-bold capitalize text-stone-800">
                  <Code className="h-4 w-4 text-stone-400" />
                  {k.replace(/_/g, ' ')}
                </h3>
                <Badge tone="stone" className="font-mono text-[10px]">JSON</Badge>
              </div>
              <div className="p-4">
                <textarea
                  className="w-full rounded-xl border border-stone-200 bg-stone-900 p-4 font-mono text-xs leading-relaxed text-emerald-400 shadow-inner outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                  rows={6}
                  value={drafts[k] !== undefined ? drafts[k] : JSON.stringify(settings[k] ?? val, null, 2)}
                  onChange={(e) => setKey(k, e.target.value)}
                  spellCheck={false}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
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
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [childDraft, setChildDraft] = useState({ division: '', community: '' });
  const { toast } = useToast();
  const confirm = useConfirm();

  const addChild = async (e, region, kind) => {
    e.preventDefault();
    const key = kind === 'division' ? 'division' : 'community';
    const name = childDraft[key].trim();
    if (!name) {
      toast.warning('Name required', `Enter the ${kind} name before adding it.`);
      return;
    }
    const payload = { name, region: region.id };
    try {
      if (kind === 'division') await geographyAPI.createDivision(payload);
      else await geographyAPI.createCommunity(payload);
      setChildDraft((d) => ({ ...d, [key]: '' }));
      toast.success(`${kind === 'division' ? 'Division' : 'Community'} added`, `${name} was added to ${region.name}.`);
      await toggleRegion(region.id);
      await toggleRegion(region.id);
      reload();
    } catch (err) {
      toast.error(`Could not add ${kind}`, describeError(err));
    }
  };

  const toggleRegion = async (id) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setDetailLoading(true);
    setDetail(null);
    setDivisions([]);
    setCommunities([]);
    try {
      const [regionRes, divRes, comRes] = await Promise.all([
        geographyAPI.regionDetail(id),
        geographyAPI.divisions({ region: id, page_size: 100 }),
        geographyAPI.communities({ region: id, page_size: 200 }),
      ]);
      setDetail(regionRes.data);
      setDivisions(divRes.data.results || divRes.data || []);
      setCommunities(comRes.data.results || comRes.data || []);
    } catch (err) {
      toast.error('Could not load region detail', describeError(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const removeRegion = async (r) => {
    const ok = await confirm({
      title: `Delete ${r.name}?`,
      message: 'Divisions and communities belonging to this region are removed with it, and any knowledge record pointing at it loses its location.',
      confirmLabel: 'Delete region',
    });
    if (!ok) return;
    try {
      await geographyAPI.deleteRegion(r.id);
      if (openId === r.id) setOpenId(null);
      setFlash('Region deleted.');
      toast.success('Region deleted', `${r.name} was removed from the geography registry.`);
      reload();
    } catch (err) {
      const message = describeError(err);
      setFlash(message);
      toast.error('Could not delete region', message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFlash('');
    try {
      const isEdit = Boolean(form.id);
      if (isEdit) await geographyAPI.updateRegion(form.id, form);
      else await geographyAPI.createRegion(form);
      const label = isEdit ? 'Region updated' : 'Region created';
      setForm(null);
      setFlash(`${label}.`);
      toast.success(label, `${form.name} is now used across the distribution map.`);
      reload();
    } catch (err) {
      const message = describeError(err);
      setFlash(message);
      toast.error('Could not save region', message);
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
              <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
                <Field label="Name" required>
                  <input className={`${inputCls} font-medium`} required value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Northwest" />
                </Field>
                <Field label="Code" required hint="Short postal-style code, e.g. NO.">
                  <input className={`${inputCls} uppercase`} required maxLength={4} value={form.code || ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="NO" />
                </Field>
                <Field label="Latitude">
                  <input className={inputCls} type="number" step="0.000001" value={form.latitude ?? ''} onChange={(e) => set('latitude', e.target.value)} placeholder="5.9688" />
                </Field>
                <Field label="Longitude">
                  <input className={inputCls} type="number" step="0.000001" value={form.longitude ?? ''} onChange={(e) => set('longitude', e.target.value)} placeholder="10.1542" />
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <textarea className={`${inputCls} min-h-24 resize-y`} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Terrain, climate, and cultural notes…" />
                </Field>
                <div className="md:col-span-2 pt-2"><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save region' : 'Create region'} /></div>
              </form>
            </FormPanel>
          )}

          <div className="flex items-center"><SaveState saving={saving} message={flash} /></div>

          <div className="grid gap-4 md:grid-cols-2">
            {(data || []).map((r) => (
              <Card key={r.id} className="group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => toggleRegion(r.id)} className="flex min-w-0 items-center gap-4 text-left">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-sm font-bold text-white shadow-sm ring-1 ring-emerald-800/10">
                      {r.code}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-800">{r.name}</h3>
                      <p className="flex items-center gap-1.5 text-xs text-stone-500">
                        <MapPin className="h-3 w-3" />
                        {r.latitude && r.longitude ? `${Number(r.latitude).toFixed(3)}, ${Number(r.longitude).toFixed(3)}` : 'No coordinates'}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone="stone" className="mr-2">{(r.divisions || []).length} divisions</Badge>
                    <ActionIconButton label="Edit" onClick={() => setForm({ ...r })} />
                    <ActionIconButton label="Delete" danger onClick={() => removeRegion(r)} />
                  </div>
                </div>
                {r.description && <p className="mt-3 line-clamp-2 text-sm text-stone-600">{r.description}</p>}

                {openId === r.id && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-stone-50/80 p-4 transition-all duration-300 ease-in-out">
                    {detailLoading ? (
                      <div className="space-y-3 py-2">
                        <div className="skeleton-shimmer h-4 w-1/3 rounded" />
                        <div className="skeleton-shimmer h-3 w-2/3 rounded" />
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="rounded-lg bg-white p-3 ring-1 ring-stone-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Divisions</p>
                            <p className="mt-1 text-xl font-bold text-stone-800">{divisions.length}</p>
                          </div>
                          <div className="rounded-lg bg-white p-3 ring-1 ring-stone-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Communities</p>
                            <p className="mt-1 text-xl font-bold text-stone-800">{communities.length}</p>
                          </div>
                        </div>
                        
                        {divisions.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Divisions</p>
                            <div className="flex flex-wrap gap-1.5">
                              {divisions.slice(0, 12).map((d) => (
                                <Badge key={d.id} tone="sky">{d.name}</Badge>
                              ))}
                              {divisions.length > 12 && <Badge tone="stone">+{divisions.length - 12} more</Badge>}
                            </div>
                          </div>
                        )}
                        
                        {communities.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">Communities</p>
                            <div className="flex flex-wrap gap-1.5">
                              {communities.slice(0, 12).map((c) => (
                                <Badge key={c.id} tone="emerald">{c.name}</Badge>
                              ))}
                              {communities.length > 12 && <Badge tone="stone">+{communities.length - 12} more</Badge>}
                            </div>
                          </div>
                        )}
                        
                        {detail?.description && <p className="mt-4 text-sm text-stone-600 italic border-l-2 border-stone-300 pl-3">{detail.description}</p>}

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <form onSubmit={(e) => addChild(e, r, 'division')} className="flex gap-2">
                            <input
                              value={childDraft.division}
                              onChange={(e) => setChildDraft((d) => ({ ...d, division: e.target.value }))}
                              className={`${inputCls} flex-1`}
                              placeholder="New division name"
                            />
                            <button type="submit" disabled={saving} className={`${btnSecondary} shrink-0`}><Plus className="h-4 w-4" /></button>
                          </form>
                          <form onSubmit={(e) => addChild(e, r, 'community')} className="flex gap-2">
                            <input
                              value={childDraft.community}
                              onChange={(e) => setChildDraft((d) => ({ ...d, community: e.target.value }))}
                              className={`${inputCls} flex-1`}
                              placeholder="New community name"
                            />
                            <button type="submit" disabled={saving} className={`${btnSecondary} shrink-0`}><Plus className="h-4 w-4" /></button>
                          </form>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
        <KpiCard icon={Users} label="Total Practitioners" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={BadgeCheck} label="Verified" value={data ? verified : '—'} tone="sky" />
        <KpiCard icon={CalendarDays} label="Avg. Experience" value={data ? `${avgYears} yrs` : '—'} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={4} />
      ) : !data.length ? (
        <EmptyState icon={UserRound} title="No practitioner profiles yet." hint="Practitioners appear here once they create a profile from their dashboard." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((p) => (
            <Card key={p.id} className="group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
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
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Region</dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-stone-700"><MapPin className="h-3.5 w-3.5 text-emerald-600" /> {p.region_name || p.community_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Experience</dt>
                  <dd className="mt-1 text-stone-700">{p.years_of_experience ? `${p.years_of_experience} years` : '—'}</dd>
                </div>
              </dl>
              {p.areas_of_knowledge && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {String(p.areas_of_knowledge).split(/[,\n]/).filter(Boolean).slice(0, 4).map((a) => (
                    <Badge key={a} tone="emerald" className="text-[10px]">{a.trim()}</Badge>
                  ))}
                </div>
              )}
              {p.traditional_training && <p className="mt-3 line-clamp-2 text-sm text-stone-500 italic border-l-2 border-stone-200 pl-3">{p.traditional_training}</p>}
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
            <KpiCard icon={Users} label="Total Users" value={stats.total_users} tone="sky" />
            <KpiCard icon={Leaf} label="Plants" value={stats.total_plants} tone="emerald" />
            <KpiCard icon={ClipboardList} label="Submissions" value={stats.total_submissions} tone="amber" />
            <KpiCard icon={FlaskConical} label="Identifications" value={stats.total_identifications} tone="violet" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard icon={Pencil} label="Pending Reviews" value={stats.pending_submissions} tone="amber" hint="Needs expert attention" />
            <KpiCard icon={UserRound} label="Practitioners" value={stats.total_practitioners} tone="emerald" />
            <KpiCard icon={ShieldCheck} label="Expert Reviewers" value={stats.total_experts} tone="sky" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-stone-800">
                <ClipboardList className="h-4 w-4 text-emerald-600" /> Knowledge pipeline
              </h3>
              <p className="mb-6 text-sm text-stone-500">Where every submission currently sits in the review journey.</p>
              {pipeline.length ? (
                <div className="space-y-4">
                  {pipeline.map((row) => {
                    const max = Math.max(...pipeline.map((r) => r.value), 1);
                    return (
                      <div key={row.name} className="group">
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-medium text-stone-700">{row.name}</span>
                          <span className="font-semibold text-stone-900">{row.value}</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-500 ease-out group-hover:from-emerald-400 group-hover:to-teal-300" 
                            style={{ width: `${(row.value / max) * 100}%` }} 
                          />
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
              <h3 className="mb-1 flex items-center gap-2 font-semibold text-stone-800">
                <Activity className="h-4 w-4 text-amber-600" /> Preservation risk
              </h3>
              <p className="mb-6 text-sm text-stone-500">Documentation-risk assessments across regions and species.</p>
              <div className="flex h-48 items-end justify-around gap-8 px-4 pb-2">
                {riskLevels.map((row, i) => {
                  const max = Math.max(...riskLevels.map((r) => r.value), 1);
                  const colors = ['from-emerald-600 to-emerald-400', 'from-amber-500 to-amber-400', 'from-red-600 to-red-400'];
                  return (
                    <div key={row.name} className="group flex flex-1 flex-col items-center gap-3">
                      <span className="text-lg font-bold text-stone-800 transition-transform group-hover:scale-110">{row.value}</span>
                      <div 
                        className={`w-full max-w-16 rounded-t-xl bg-gradient-to-t ${colors[i]} shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:brightness-110`} 
                        style={{ height: `${Math.max(8, (row.value / max) * 140)}px` }} 
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{row.name}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-xs text-stone-400">{risks?.length ?? 0} active assessments</p>
            </Card>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-500">
            <Globe className="h-4 w-4 text-stone-400" />
            {stats.total_regions ?? (risks?.length ? '10' : '—')} regions tracked · data refreshes live from the database
          </div>
        </>
      )}
    </div>
  );
}

/* 9 · Symptoms (admin) --------------------------------------------------------- */

const emptySymptom = { name: '', description: '', category: '' };

const SYMPTOM_CATEGORIES = [
  'Infectious', 'Respiratory', 'General', 'Digestive', 'Neurological',
  'Dermatological', 'Cardiovascular', 'Metabolic', 'Musculoskeletal',
  'Women’s health', 'Men’s health', 'Oral health', 'Sensory', 'Emergency',
  'Hepatic', 'Blood', 'Other',
];

export function SymptomsManagement() {
  const { data, loading, error, reload } = useList(() => symptomsAPI.adminList({ page_size: 200 }));
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const { toast } = useToast();
  const confirm = useConfirm();

  const rows = useMemo(
    () => (data || []).filter((s) => {
      const hay = `${s.name} ${s.category} ${s.description}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    }),
    [data, q],
  );

  const categories = useMemo(
    () => [...new Set((data || []).map((s) => s.category).filter(Boolean))].sort(),
    [data],
  );

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = Boolean(form.id);
      if (isEdit) await symptomsAPI.adminUpdate(form.id, form);
      else await symptomsAPI.adminCreate(form);
      toast.success(isEdit ? 'Symptom updated' : 'Symptom created', `“${form.name}” is now available to contributors.`);
      setForm(null);
      reload();
    } catch (err) {
      toast.error(form.id ? 'Could not update symptom' : 'Could not create symptom', describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (s) => {
    try {
      const res = await symptomsAPI.adminDetail(s.id);
      setForm({ ...res.data });
    } catch {
      setForm({ ...s });
      toast.warning('Opened with list data', 'The full symptom record could not be refreshed.');
    }
  };

  const remove = async (s) => {
    const ok = await confirm({
      title: `Delete “${s.name}”?`,
      message: 'Symptoms referenced by documented traditional uses cannot be removed while those records exist.',
      confirmLabel: 'Delete symptom',
    });
    if (!ok) return;
    try {
      await symptomsAPI.adminDelete(s.id);
      toast.success('Symptom deleted', `“${s.name}” was removed.`);
      reload();
    } catch (err) {
      toast.error('Delete failed', describeError(err));
    }
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Administration"
        title="Symptom index"
        description="The vocabulary contributors and search use. A well-maintained index makes symptom search precise."
        icon={Stethoscope}
        action={<button className={btnPrimary} onClick={() => setForm({ ...emptySymptom })}><Plus className="h-4 w-4" /> Add symptom</button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Stethoscope} label="Total Symptoms" value={data?.length ?? '—'} tone="emerald" />
        <KpiCard icon={Activity} label="Categories" value={data ? categories.length : '—'} tone="sky" />
        <KpiCard icon={ClipboardList} label="Documented Uses" value={data ? (data.reduce((sum, s) => sum + (s.traditional_uses_count || 0), 0)) : '—'} tone="amber" />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input className={`${inputCls} pl-10 transition-all focus:ring-2 focus:ring-emerald-500/20`} placeholder="Search symptoms…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {form && (
            <FormPanel title={form.id ? `Edit ${form.name}` : 'New symptom'} subtitle="Keep names in the singular and lower case — contributors search on them." onDismiss={() => setForm(null)}>
              <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
                <Field label="Name" required>
                  <input className={`${inputCls} font-medium`} required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Malaria" />
                </Field>
                <Field label="Category">
                  <input className={inputCls} list="symptom-categories" value={form.category || ''} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Infectious" />
                  <datalist id="symptom-categories">
                    {SYMPTOM_CATEGORIES.concat(categories).map((c) => <option key={c} value={c} />)}
                  </datalist>
                </Field>
                <Field label="Description" className="md:col-span-2">
                  <textarea className={`${inputCls} min-h-24 resize-y`} value={form.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="Short, factual description shown to readers." />
                </Field>
                <div className="md:col-span-2 pt-2"><FormActions saving={saving} onCancel={() => setForm(null)} saveLabel={form.id ? 'Save symptom' : 'Create symptom'} /></div>
              </form>
            </FormPanel>
          )}

          {!rows.length ? (
            <EmptyState icon={Stethoscope} title="No symptoms match your search." />
          ) : (
            <TableCard minW="min-w-[720px]">
              <thead>
                <tr>
                  <Th>Symptom</Th>
                  <Th>Category</Th>
                  <Th>Documented uses</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="group transition-colors duration-150 hover:bg-emerald-50/40">
                    <Td>
                      <Link to={`/symptoms/${s.id}`} className="block font-semibold text-stone-800 transition-colors hover:text-emerald-700">{s.name}</Link>
                      {s.description && <span className="mt-1 block max-w-md truncate text-xs text-stone-500">{s.description}</span>}
                    </Td>
                    <Td><Badge tone="sky">{s.category || 'Uncategorised'}</Badge></Td>
                    <Td><Badge tone={s.traditional_uses_count ? 'emerald' : 'stone'}>{s.traditional_uses_count || 0}</Badge></Td>
                    <Td><RowActions>
                      <Link to={`/symptoms/${s.id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-50 active:scale-95">View</Link>
                      <ActionIconButton label="Edit" onClick={() => openEdit(s)} />
                      <ActionIconButton label="Delete" danger onClick={() => remove(s)} />
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