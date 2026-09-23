/**
 * Consultation scheduling: booking, the consultant's desk, the video room,
 * and administrator oversight.
 *
 * These pages implement the ANCESTOR use cases Book appointment, manage
 * appointments, update availability, conduct video consultation, view
 * messages and view consultations.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock, CalendarPlus, Camera, CheckCircle2, Clock3, Gauge, LogOut,
  MessageSquare, Mic, MicOff, RefreshCw, Send, ShieldAlert, Trash2, Users,
  Video, VideoOff, XCircle,
} from 'lucide-react';

import { consultationsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { describeError, useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { PageTransition, Reveal, Spinner } from '../components/ui/motion';
import {
  AdminHeader, Avatar, Badge, Card, EmptyState, ErrorState, Field, KpiCard,
  Skeleton, TableCard, Td, Th, btnDanger, btnGhost, btnPrimary, btnSecondary,
  extractRows, formatDateTime, inputCls, selectCls,
} from '../components/admin/ui';

const STATUS_TONE = {
  PENDING: 'amber',
  CONFIRMED: 'emerald',
  COMPLETED: 'sky',
  CANCELLED: 'stone',
  NO_SHOW: 'red',
};

function StatusPill({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'stone'}>{String(status).replace('_', ' ')}</Badge>;
}

/** Local time in the viewer's zone, trimmed to what a booking needs. */
function when(value) {
  if (!value) return '—';
  return formatDateTime(value);
}

/* ------------------------------------------------------------------ */
/* Patient: browse open windows and book one                          */
/* ------------------------------------------------------------------ */

export function BookAppointmentPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await consultationsAPI.slots();
      setSlots(extractRows(res));
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group the flat window list by consultant so the page reads as
  // "who can I see", not "a pile of timestamps".
  const byConsultant = useMemo(() => {
    const groups = new Map();
    (slots || []).forEach((slot) => {
      const key = slot.expert;
      if (!groups.has(key)) {
        groups.set(key, { expert: slot.expert, name: slot.expert_name, windows: [] });
      }
      groups.get(key).windows.push(slot);
    });
    return [...groups.values()];
  }, [slots]);

  async function book() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await consultationsAPI.book({ slot: selected, reason });
      toast.success('Appointment requested',
        `${res.data.expert.full_name} will confirm ${when(res.data.slot_detail?.starts_at)}.`);
      navigate('/user/appointments');
    } catch (err) {
      toast.error('Could not book that window', describeError(err));
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageTransition>
      <AdminHeader
        eyebrow="For patients"
        title="Book a consultation"
        description="Choose an open window published by a specialist. They confirm before it appears as scheduled."
        action={(
          <Link to="/user/appointments" className={btnSecondary}>
            <CalendarClock className="h-4 w-4" /> My appointments
          </Link>
        )}
        icon={CalendarPlus}
      />

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}

      {!error && slots === null && <div className="mt-6"><Skeleton rows={4} /></div>}

      {!error && slots !== null && byConsultant.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={CalendarClock}
            title="No open consultation windows"
            hint="Specialists publish the times they are available. Nothing is open right now — check again later, or ask an administrator to nudge a specialist to publish availability."
            action={<button onClick={load} className={btnSecondary}><RefreshCw className="h-4 w-4" /> Refresh</button>}
          />
        </div>
      )}

      {byConsultant.length > 0 && (
        <div className="mt-6 space-y-4">
          {byConsultant.map((group) => (
            <Reveal key={group.expert}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={group.name} size="h-11 w-11 text-sm" />
                    <div>
                      <h3 className="font-semibold text-stone-900">{group.name}</h3>
                      <p className="text-xs text-stone-500">{group.windows.length} open window{group.windows.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.windows.map((slot) => {
                    const active = selected === slot.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelected(active ? null : slot.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          active
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <span className="block font-semibold">{when(slot.starts_at)}</span>
                        <span className="block text-xs text-stone-500">
                          {slot.duration_minutes} min{slot.note ? ` · ${slot.note}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4">
          <Card className="p-5">
            <Field label="What would you like to discuss?" hint="Shared with the specialist before the session.">
              <textarea
                className={`${inputCls} min-h-24 resize-y`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. I have been using a bitter-leaf preparation for weeks and want a second opinion on safety."
              />
            </Field>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setSelected(null)}>Cancel</button>
              <button type="button" className={btnPrimary} onClick={book} disabled={saving}>
                {saving ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} Request this window
              </button>
            </div>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}

/* ------------------------------------------------------------------ */
/* Patient: their appointments                                        */
/* ------------------------------------------------------------------ */

export function MyAppointmentsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await consultationsAPI.appointments();
      setRows(extractRows(res));
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(appointment, action) {
    let payload = { action };
    if (action === 'cancel') {
      const ok = await confirm({
        title: 'Cancel this appointment?',
        description: 'The specialist is notified and the window is released for someone else to book.',
        tone: 'danger',
        confirmLabel: 'Cancel appointment',
      });
      if (!ok) return;
      payload = { action, reason: 'Cancelled by the patient in the app.' };
    }
    try {
      await consultationsAPI.setAppointmentStatus(appointment.id, payload);
      toast.success('Appointment updated', `Now marked ${action.replace('_', ' ')}.`);
      load();
    } catch (err) {
      toast.error('Could not update the appointment', describeError(err));
    }
  }

  // The endpoint already scopes rows to the caller, so no client-side filter.
  const mine = rows || [];

  return (
    <PageTransition>
      <AdminHeader
        eyebrow="For patients"
        title="My appointments"
        description="Everything you have requested or booked, with the thread attached to each one."
        action={<Link to="/user/book" className={btnSecondary}><CalendarPlus className="h-4 w-4" /> Book another</Link>}
        icon={CalendarClock}
      />

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}
      {!error && rows === null && <div className="mt-6"><Skeleton rows={3} /></div>}
      {!error && rows !== null && mine.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={CalendarClock}
            title="No appointments yet"
            hint="Once you book one of a specialist's open windows it shows up here, with a link into the consultation room."
            action={<Link to="/user/book" className={btnPrimary}><CalendarPlus className="h-4 w-4" /> Book a consultation</Link>}
          />
        </div>
      )}

      {mine.length > 0 && (
        <div className="mt-6 space-y-3">
          {mine.map((appointment) => (
            <Reveal key={appointment.id}>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusPill status={appointment.status} />
                      <span className="text-xs text-stone-400">#{appointment.id}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-stone-900">
                      with {appointment.expert?.full_name}
                    </h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" /> {when(appointment.slot_detail?.starts_at)}
                      </span>
                      {appointment.slot_detail && (
                        <span>{appointment.slot_detail.duration_minutes} minutes</span>
                      )}
                    </p>
                    {appointment.reason && (
                      <p className="mt-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">{appointment.reason}</p>
                    )}
                    {appointment.expert_notes && (
                      <p className="mt-2 text-sm text-stone-500">
                        <span className="font-semibold text-stone-600">Notes: </span>{appointment.expert_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {appointment.can_join && (
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => navigate(`/user/consultation/${appointment.id}`)}
                      >
                        <Video className="h-4 w-4" /> Enter room
                      </button>
                    )}
                    <Link to={`/user/consultation/${appointment.id}?tab=chat`} className={btnSecondary}>
                      <MessageSquare className="h-4 w-4" /> Messages
                    </Link>
                    {['PENDING', 'CONFIRMED'].includes(appointment.status) && (
                      <button type="button" className={btnDanger} onClick={() => act(appointment, 'cancel')}>
                        <XCircle className="h-4 w-4" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
    </PageTransition>
  );
}

/* ------------------------------------------------------------------ */
/* Consultant: publish availability and work the desk                 */
/* ------------------------------------------------------------------ */

export function ConsultantDeskPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [slots, setSlots] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: '', start: '10:00', minutes: '30', note: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [availability, booked] = await Promise.all([
        consultationsAPI.availability(),
        consultationsAPI.appointments(),
      ]);
      setSlots(extractRows(availability));
      setAppointments(extractRows(booked));
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const requests = useMemo(
    () => (appointments || []).filter((a) => a.expert?.id === user?.id),
    [appointments, user],
  );

  function set(key) {
    return (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function publish(event) {
    event.preventDefault();
    if (!form.date || !form.start) {
      toast.warning('Pick a day and a time', 'Both are needed to publish a window.');
      return;
    }
    const startsAt = new Date(`${form.date}T${form.start}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error('That date could not be read', 'Use the pickers rather than typing over them.');
      return;
    }
    const endsAt = new Date(startsAt.getTime() + Number(form.minutes) * 60000);
    setSaving(true);
    try {
      await consultationsAPI.createAvailability({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        note: form.note,
      });
      toast.success('Availability published', `Patients can now book ${startsAt.toLocaleString()}.`);
      setForm((prev) => ({ ...prev, note: '' }));
      load();
    } catch (err) {
      toast.error('Could not publish that window', describeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(slot) {
    const ok = await confirm({
      title: 'Remove this window?',
      description: `${when(slot.starts_at)} will no longer be bookable.`,
      tone: 'danger',
      confirmLabel: 'Remove window',
    });
    if (!ok) return;
    try {
      await consultationsAPI.deleteAvailability(slot.id);
      toast.success('Window removed', 'Patients will no longer see it.');
      load();
    } catch (err) {
      toast.error('Could not remove the window', describeError(err));
    }
  }

  async function decide(appointment, action) {
    let note = '';
    if (action === 'complete') {
      note = window.prompt('Add a closing note for this consultation (optional):') || '';
    }
    try {
      await consultationsAPI.setAppointmentStatus(appointment.id, { action, note });
      toast.success('Consultation updated', `Marked ${action.replace('_', ' ')}.`);
      load();
    } catch (err) {
      toast.error('Could not update that appointment', describeError(err));
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageTransition>
      <AdminHeader
        eyebrow="For specialists"
        title="Consultation desk"
        description="Publish when you are available, then confirm requests and record outcomes."
        action={<button onClick={load} className={btnSecondary}><RefreshCw className="h-4 w-4" /> Refresh</button>}
        icon={Gauge}
      />

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <CalendarPlus className="h-4 w-4 text-emerald-700" /> Publish availability
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Windows you open here are what patients see. They never overlap each other.
            </p>
            <form onSubmit={publish} className="mt-4 space-y-3">
              <Field label="Day" required>
                <input type="date" min={today} className={inputCls} value={form.date} onChange={set('date')} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts" required>
                  <input type="time" className={inputCls} value={form.start} onChange={set('start')} required />
                </Field>
                <Field label="Length">
                  <select className={selectCls} value={form.minutes} onChange={set('minutes')}>
                    {['20', '30', '45', '60', '90'].map((m) => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Note for patients" hint="Optional, e.g. follow-ups only.">
                <input className={inputCls} value={form.note} onChange={set('note')} placeholder="Follow-ups only" />
              </Field>
              <button type="submit" className={`${btnPrimary} w-full`} disabled={saving}>
                {saving ? <Spinner /> : <CheckCircle2 className="h-4 w-4" />} Publish window
              </button>
            </form>
          </Card>
        </Reveal>

        <Reveal className="lg:col-span-3">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <CalendarClock className="h-4 w-4 text-emerald-700" /> Your published windows
            </h3>
            {slots === null ? (
              <div className="mt-4"><Skeleton rows={3} /></div>
            ) : slots.length === 0 ? (
              <div className="mt-4">
                <EmptyState icon={CalendarClock} title="Nothing published yet"
                  hint="Add your first window on the left and patients can book it straight away." />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {slots.map((slot) => (
                  <li key={slot.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{when(slot.starts_at)}</p>
                      <p className="text-xs text-stone-500">
                        {slot.duration_minutes} min{slot.note ? ` · ${slot.note}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.is_booked
                        ? <Badge tone="violet">Booked</Badge>
                        : slot.is_open
                          ? <Badge tone="emerald">Open</Badge>
                          : <Badge tone="stone">Past or closed</Badge>}
                      <button type="button" className={btnDanger} onClick={() => remove(slot)}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>

      <Reveal className="mt-4 block">
        <TableCard>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
            <h3 className="flex items-center gap-2 font-semibold text-stone-900">
              <Users className="h-4 w-4 text-emerald-700" /> Requests and consultations
            </h3>
            <span className="text-xs text-stone-400">{requests.length} shown</span>
          </div>
          {appointments === null ? (
            <div className="p-5"><Skeleton rows={3} /></div>
          ) : requests.length === 0 ? (
            <EmptyState icon={Users} title="No consultation requests"
              hint="Publish a window and requests will land here for you to confirm." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <Th>Patient</Th><Th>Window</Th><Th>Reason</Th><Th>Status</Th><Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {requests.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-stone-50/60">
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={appointment.patient?.full_name} size="h-8 w-8 text-[11px]" />
                        <span className="font-medium text-stone-800">{appointment.patient?.full_name}</span>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-stone-600">{when(appointment.slot_detail?.starts_at)}</Td>
                    <Td className="max-w-[220px] truncate text-stone-500">{appointment.reason || '—'}</Td>
                    <Td><StatusPill status={appointment.status} /></Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {appointment.status === 'PENDING' && (
                          <button type="button" className={btnPrimary} onClick={() => decide(appointment, 'confirm')}>
                            Confirm
                          </button>
                        )}
                        {appointment.status === 'CONFIRMED' && (
                          <>
                            <Link to={`/expert/consultation/${appointment.id}`} className={btnPrimary}>
                              <Video className="h-4 w-4" /> Room
                            </Link>
                            <button type="button" className={btnSecondary} onClick={() => decide(appointment, 'complete')}>
                              Complete
                            </button>
                            <button type="button" className={btnGhost} onClick={() => decide(appointment, 'no_show')}>
                              No-show
                            </button>
                          </>
                        )}
                        {appointment.status === 'PENDING' && (
                          <button type="button" className={btnDanger} onClick={() => decide(appointment, 'cancel')}>
                            Decline
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      </Reveal>
    </PageTransition>
  );
}

/* ------------------------------------------------------------------ */
/* The video room + messaging thread                                  */
/* ------------------------------------------------------------------ */

const POLL_MS = 1500;

export function ConsultationRoomPage({ basePath = '/user' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState('video');
  const [mediaError, setMediaError] = useState('');
  const [callState, setCallState] = useState('idle');
  const [muted, setMuted] = useState(false);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const lastSignalRef = useRef(0);
  const lastChatRef = useRef(0);
  const isPatient = user?.id === appointment?.patient?.id;

  const teardown = useCallback(() => {
    if (peerRef.current) { try { peerRef.current.close(); } catch { /* already closed */ } }
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setCallState('idle');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await consultationsAPI.appointmentDetail(id);
        if (cancelled) return;
        setAppointment(detail.data);
        if (!detail.data.can_join) {
          toast.info('Room is locked', 'This consultation is only open once the specialist confirms it.');
        }
      } catch (err) {
        if (!cancelled) toast.error('Could not open the room', describeError(err));
      }
    })();
    return () => { cancelled = true; };
  }, [id, toast]);

  /** Pull chat lines and signalling payloads since the last poll. */
  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const messages = await consultationsAPI.messages(conversationId,
          lastChatRef.current ? { after: lastChatRef.current } : undefined);
        const rows = extractRows(messages);
        if (rows.length && !cancelled) {
          lastChatRef.current = Math.max(lastChatRef.current, ...rows.map((m) => m.id));
          setChat((prev) => [...prev, ...rows]);
          consultationsAPI.markThreadRead(conversationId).catch(() => {});
        }
        // The endpoint already returns only the *other* party's payloads.
        const signals = await consultationsAPI.signals(conversationId,
          lastSignalRef.current ? { after: lastSignalRef.current } : undefined);
        const inbound = extractRows(signals);
        if (inbound.length && !cancelled) {
          lastSignalRef.current = Math.max(lastSignalRef.current, ...inbound.map((row) => row.id));
          for (const signal of inbound) {
            if (cancelled) break;
            await handleSignal(signal);
          }
        }
      } catch {
        /* a dropped poll tick is not worth bothering the user about */
      }
    };

    async function handleSignal(signal) {
      const peer = peerRef.current;
      if (!peer) return;
      const data = safeParse(signal.body);
      if (!data) return;
      try {
        if (signal.kind === 'OFFER') {
          await peer.setRemoteDescription(data);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await consultationsAPI.sendSignal(conversationId, { kind: 'ANSWER', payload: JSON.stringify(answer) });
          setCallState('connecting');
        } else if (signal.kind === 'ANSWER') {
          await peer.setRemoteDescription(data);
        } else if (signal.kind === 'ICE' && data.candidate) {
          await peer.addIceCandidate(data);
        }
      } catch {
        setMediaError('The video link could not be negotiated. Chat still works.');
      }
    }

    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [conversationId]);

  async function join() {
    setTab('video');
    try {
      const res = await consultationsAPI.startConsultation(id);
      setConversationId(res.data.conversation_id);
    } catch (err) {
      toast.error('Could not join', describeError(err));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('This browser cannot capture camera and microphone here (a secure https context is required). You can still chat.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19908' }],
      });
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          consultationsAPI.sendSignal(conversationId, {
            kind: 'ICE', payload: JSON.stringify(event.candidate.toJSON()),
          }).catch(() => {});
        }
      };
      peer.ontrack = (event) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
        setCallState('connected');
      };
      peer.onconnectionstatechange = () => setCallState(peer.connectionState);

      // The patient offers; the specialist answers. Choosing one initiator
      // avoids the both-sides-offer collision that a naive handshake hits.
      if (isPatient) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await consultationsAPI.sendSignal(conversationId, { kind: 'OFFER', payload: JSON.stringify(offer) });
        setCallState('connecting');
      }
    } catch {
      setMediaError('Camera and microphone are unavailable or blocked. The consultation can continue as chat.');
    }
  }

  async function leave() {
    if (conversationId) {
      consultationsAPI.sendSignal(conversationId, { kind: 'LEAVE', payload: '' }).catch(() => {});
    }
    teardown();
    navigate(`${basePath}/appointments`);
  }

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId) return;
    setDraft('');
    try {
      await consultationsAPI.sendMessage(conversationId, { body });
      setChat((prev) => [...prev, {
        id: (prev.at(-1)?.id || 0) + 0.5, kind: 'TEXT', body,
        sender: user?.id, sender_name: user?.username, created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      toast.error('Message not sent', describeError(err));
    }
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  useEffect(() => () => teardown(), [teardown]);

  if (!appointment) {
    return (
      <PageTransition>
        <div className="py-16"><Skeleton rows={4} /></div>
      </PageTransition>
    );
  }

  const other = isPatient ? appointment.expert : appointment.patient;

  return (
    <PageTransition>
      <AdminHeader
        eyebrow="Consultation room"
        title={other?.full_name || 'Consultation'}
        description={`Appointment #${appointment.id} · ${when(appointment.slot_detail?.starts_at)}`}
        action={(
          <button onClick={leave} className={btnSecondary}>
            <LogOut className="h-4 w-4" /> Leave room
          </button>
        )}
        icon={Video}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill status={appointment.status} />
        <Badge tone={callState === 'connected' ? 'emerald' : 'stone'}>
          call: {callState}
        </Badge>
        {mediaError && <Badge tone="amber">{mediaError}</Badge>}
      </div>

      <div className="mt-4 flex gap-2">
        {['video', 'chat'].map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
              tab === key ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50'
            }`}
          >
            {key === 'video' ? <Video className="mr-1 inline h-4 w-4" /> : <MessageSquare className="mr-1 inline h-4 w-4" />}
            {key}
          </button>
        ))}
      </div>

      {tab === 'video' ? (
        <Card className="mt-4 overflow-hidden">
          {callState === 'idle' ? (
            <div className="p-10 text-center">
              <Camera className="mx-auto h-10 w-10 text-stone-300" />
              <h3 className="mt-3 font-semibold text-stone-800">Not connected yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
                Joining opens your camera and microphone and connects you directly to {other?.full_name}.
                Video travels peer-to-peer between the two of you; the server only relays the handshake.
              </p>
              {appointment.can_join ? (
                <button onClick={join} className={`${btnPrimary} mt-4`}>
                  <Video className="h-4 w-4" /> Join the room
                </button>
              ) : (
                <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <ShieldAlert className="h-4 w-4" /> Waiting for the specialist to confirm this appointment.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="relative aspect-video bg-stone-900">
                <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-contain" />
                <video
                  ref={localVideo} autoPlay playsInline muted
                  className="absolute bottom-4 right-4 h-28 w-40 rounded-lg border-2 border-white/20 bg-stone-800 object-cover shadow-lg"
                />
              </div>
              <div className="flex items-center justify-center gap-2 border-t border-stone-100 p-4">
                <button onClick={toggleMute} className={btnSecondary}>
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                <button onClick={teardown} className={btnSecondary}><VideoOff className="h-4 w-4" /> Stop video</button>
                <button onClick={leave} className={btnDanger}><LogOut className="h-4 w-4" /> Leave</button>
              </div>
            </>
          )}
        </Card>
      ) : (
        <Card className="mt-4 flex h-[520px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {chat.length === 0 && (
              <p className="py-10 text-center text-sm text-stone-400">
                No messages yet. Say hello — this thread stays attached to the appointment.
              </p>
            )}
            {chat.map((message) => {
              if (message.kind === 'JOIN' || message.kind === 'LEAVE') {
                return (
                  <p key={message.id} className="text-center text-xs text-stone-400">
                    {message.body}
                  </p>
                );
              }
              const mine = message.sender === user?.id;
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-800'
                  }`}
                  >
                    {!mine && <span className="mb-0.5 block text-xs font-semibold text-stone-500">{message.sender_name}</span>}
                    {message.body}
                    <span className={`mt-1 block text-[10px] ${mine ? 'text-emerald-100' : 'text-stone-400'}`}>
                      {when(message.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-stone-100 p-3">
            <input
              className={inputCls}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={conversationId ? 'Write a message…' : 'Join the room to start the thread'}
              disabled={!conversationId}
            />
            <button type="submit" className={btnPrimary} disabled={!conversationId || !draft.trim()}>
              <Send className="h-4 w-4" />
            </button>
          </form>
        </Card>
      )}
    </PageTransition>
  );
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Admin: oversight of all consultations                              */
/* ------------------------------------------------------------------ */

export function AdminConsultationsPage() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [statRes, listRes] = await Promise.all([
        consultationsAPI.stats(),
        consultationsAPI.appointments({ scope: 'all', ...(status ? { status } : {}) }),
      ]);
      setStats(statRes.data);
      setRows(extractRows(listRes));
    } catch (err) {
      setError(describeError(err));
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageTransition>
      <AdminHeader
        eyebrow="Administration"
        title="Consultations"
        description="Every booking across the platform, and how the diary is being used."
        action={<button onClick={load} className={btnSecondary}><RefreshCw className="h-4 w-4" /> Refresh</button>}
        icon={Gauge}
      />

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}

      {stats && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={CalendarClock} label="Total consultations" value={stats.total} />
          <KpiCard icon={Clock3} label="Awaiting confirmation" value={stats.pending} tone="amber" />
          <KpiCard icon={CheckCircle2} label="Completed" value={stats.completed} tone="sky" />
          <KpiCard icon={Users} label="Open windows" value={stats.open_slots} tone="violet" />
        </div>
      )}

      <div className="mt-6">
        <TableCard>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <h3 className="font-semibold text-stone-900">All appointments</h3>
            <select className={`${selectCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              {['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing here"
              hint="No appointments match this filter yet." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr><Th>Patient</Th><Th>Consultant</Th><Th>Window</Th><Th>Status</Th><Th>Room</Th></tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-stone-50/60">
                    <Td>{appointment.patient?.full_name}</Td>
                    <Td>{appointment.expert?.full_name}</Td>
                    <Td className="whitespace-nowrap text-stone-600">{when(appointment.slot_detail?.starts_at)}</Td>
                    <Td><StatusPill status={appointment.status} /></Td>
                    <Td className="font-mono text-xs text-stone-400">{appointment.room_id?.slice(0, 8)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      </div>
    </PageTransition>
  );
}
