/**
 * Grounded conversational assistant — the ANCESTOR use case "chat with AI".
 *
 * Answers come from OpenRouter, but the context is assembled by Django from
 * verified records in this database, so every claim the assistant makes about
 * traditional use is traceable to a plant page. The UI says so explicitly and
 * keeps the medical disclaimer in view rather than burying it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bot, Leaf, MessageSquarePlus, RefreshCw, Send, Sparkles,
  Trash2, User,
} from 'lucide-react';

import { assistantAPI, plantsAPI } from '../api/client';
import { describeError, useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { PageTransition, Spinner } from '../components/ui/motion';
import {
  Badge, Card, EmptyState, btnGhost, btnPrimary, btnSecondary,
  extractRows, formatDateTime, inputCls,
} from '../components/admin/ui';

const STARTERS = [
  'Which plants does the knowledge base document for fever?',
  'What is neem traditionally used for?',
  'Are there safety warnings on bitter leaf?',
];

export default function AssistantPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [plantNames, setPlantNames] = useState({});
  const scroller = useRef(null);

  // A short id→name table so citations the assistant returns can be rendered
  // as links instead of bare numbers.
  useEffect(() => {
    plantsAPI.list({ page_size: 100 })
      .then((res) => {
        const table = {};
        extractRows(res).forEach((p) => { table[p.id] = p.common_name || p.scientific_name; });
        setPlantNames(table);
      })
      .catch(() => { /* citations still render without names */ });
  }, []);

  const loadSessions = useMemo(() => async () => {
    try {
      const res = await assistantAPI.sessions();
      const rows = extractRows(res);
      setSessions(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      toast.error('Could not load your conversations', describeError(err));
    }
  }, [toast]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    assistantAPI.sessionMessages(activeId)
      .then((res) => { if (!cancelled) setMessages(extractRows(res)); })
      .catch((err) => { if (!cancelled) toast.error('Could not open that conversation', describeError(err)); });
    return () => { cancelled = true; };
  }, [activeId, toast]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, asking]);

  async function ask(event) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || asking) return;
    setDraft('');
    setAsking(true);
    // Optimistic bubble so the wait feels answered immediately.
    setMessages((prev) => [...prev, {
      id: `local-${Date.now()}`, role: 'USER', content: message, cited_plant_ids: [],
    }]);
    try {
      const res = await assistantAPI.ask({ message, session: activeId || undefined });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== res.data.user_message?.id),
        res.data.user_message, res.data.reply,
      ]);
      if (!res.data.grounded) {
        toast.info('Nothing in the knowledge base matched',
          'The assistant answered from general context only — it flagged that itself.');
      }
      loadSessions();
      if (!activeId) setActiveId(res.data.session.id);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => typeof m.id !== 'string'));
      setDraft(message);
      toast.error('The assistant could not reply', describeError(err));
    } finally {
      setAsking(false);
    }
  }

  async function startNew() {
    setActiveId(null);
    setMessages([]);
    setDraft('');
  }

  async function remove(session) {
    const ok = await confirm({
      title: 'Delete this conversation?',
      description: 'The transcript is removed for good. This does not affect any plant records.',
      tone: 'danger',
      confirmLabel: 'Delete conversation',
    });
    if (!ok) return;
    try {
      await assistantAPI.deleteSession(session.id);
      toast.success('Conversation deleted', 'It no longer appears in your history.');
      if (activeId === session.id) await startNew();
      loadSessions();
    } catch (err) {
      toast.error('Could not delete it', describeError(err));
    }
  }

  return (
    <PageTransition>
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-stone-500">
                <Sparkles className="h-4 w-4 text-emerald-700" /> Conversations
              </h2>
              <button onClick={startNew} className={btnGhost} title="Start a new conversation">
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-stone-400">Your saved conversations will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {sessions.map((session) => (
                  <li key={session.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition ${
                      session.id === activeId ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    <button onClick={() => setActiveId(session.id)} className="min-w-0 flex-1 truncate text-left">
                      {session.display_title || 'Untitled'}
                      <span className="ml-1 text-[10px] text-stone-400">{session.message_count}</span>
                    </button>
                    <button onClick={() => remove(session)}
                      className="opacity-0 transition group-hover:opacity-100" title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-stone-400 hover:text-red-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={loadSessions} className={`${btnSecondary} mt-3 w-full`}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </Card>
        </aside>

        <section>
          <Card className="flex h-[74vh] flex-col overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="font-bold text-stone-900">Ask Ancestor</h1>
                  <p className="text-xs text-stone-500">
                    Answers are drawn from this platform&rsquo;s verified records.
                  </p>
                </div>
              </div>
              <Badge tone="stone">AI · probabilistic</Badge>
            </header>

            <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="py-6">
                  <EmptyState
                    icon={Bot}
                    title="Ask about the plants in the knowledge base"
                    hint="I only speak from what contributors and reviewers have documented here, and I link the plants I mention. I am not a substitute for a health professional."
                  />
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {STARTERS.map((starter) => (
                      <button key={starter} onClick={() => setDraft(starter)}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:border-emerald-500 hover:text-emerald-800">
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => {
                const mine = message.role === 'USER';
                return (
                  <div key={message.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      mine ? 'bg-stone-200 text-stone-600' : 'bg-emerald-100 text-emerald-700'
                    }`}
                    >
                      {mine ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </span>
                    <div className={`max-w-[80%] ${mine ? 'text-right' : ''}`}>
                      <div className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed ${
                        mine ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-800'
                      }`}
                      >
                        {message.content}
                      </div>
                      {!mine && message.cited_plant_ids?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {message.cited_plant_ids.map((plantId) => (
                            <Link key={plantId} to={`/plants/${plantId}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100">
                              <Leaf className="h-3 w-3" /> {plantNames[plantId] || `Plant #${plantId}`}
                            </Link>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-[10px] text-stone-400">{formatDateTime(message.created_at)}</p>
                    </div>
                  </div>
                );
              })}

              {asking && (
                <div className="flex items-center gap-2 text-sm text-stone-400">
                  <Spinner /> Consulting the knowledge base…
                </div>
              )}
            </div>

            <footer className="border-t border-stone-100 px-5 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Educational information only. Not a diagnosis, and traditional use is not proof of efficacy.
              </p>
              <form onSubmit={ask} className="flex gap-2">
                <input
                  className={inputCls}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about a plant, a preparation, or what the records say…"
                  maxLength={2000}
                />
                <button type="submit" className={btnPrimary} disabled={asking || !draft.trim()}>
                  {asking ? <Spinner /> : <Send className="h-4 w-4" />} Send
                </button>
              </form>
            </footer>
          </Card>
        </section>
      </div>
    </PageTransition>
  );
}
