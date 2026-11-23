import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, fmt } from '../lib/api.js';
import { Alert, Badge, Button, Card, EmptyState, Icon, Input, Select, Spinner, Textarea } from '../components/ui.jsx';
import { PageHeader } from './PortalShell.jsx';

/* --------------------------------- chat -------------------------------- */
export function ChatPage() {
  const { user, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(params.get('c') ? Number(params.get('c')) : null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agent, setAgent] = useState('');
  const [agents, setAgents] = useState([]);
  const [usage, setUsage] = useState(null);
  const bottom = useRef(null);

  const loadConversations = useCallback(() => {
    api.get('/ai/conversations').then((d) => setConversations(d.conversations || [])).catch(() => {});
  }, []);

  const loadThread = useCallback(async (id) => {
    if (!id) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const d = await api.get(`/ai/conversations/${id}`);
      setMessages(d.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    api.get('/ai/agents').then((d) => setAgents(d.agents || [])).catch(() => {});
    api.get('/ai/usage').then((d) => setUsage(d)).catch(() => {});
  }, [loadConversations]);

  useEffect(() => { loadThread(activeId); }, [activeId, loadThread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput('');
    const optimistic = { id: `tmp-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);

    try {
      const res = await api.post('/ai/chat', { message: text, conversationId: activeId || undefined, agentKey: agent || undefined });
      setActiveId(res.conversationId);
      setParams({ c: String(res.conversationId) }, { replace: true });
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: res.reply, notice: res.notice }]);
      loadConversations();
      api.get('/ai/usage').then(setUsage).catch(() => {});
    } catch (err) {
      setError(err.message);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setParams({}, { replace: true });
  };

  const remove = async (id) => {
    try {
      await api.del(`/ai/conversations/${id}`);
      if (id === activeId) newChat();
      loadConversations();
    } catch (err) {
      setError(err.message);
    }
  };

  const chatLimit = usage?.limits?.find((l) => l.key === 'chat');

  return (
    <div>
      <PageHeader
        title="AI chat"
        description="Your conversations are saved to your account. Replies come from the local CHARDHO engine unless the owner connects a provider."
        actions={
          <>
            {chatLimit && <Badge tone={chatLimit.used_today >= chatLimit.free_limit_daily ? 'rose' : 'cyan'}>
              {chatLimit.used_today}/{chatLimit.free_limit_daily} today
            </Badge>}
            <Button variant="ghost" onClick={newChat}><Icon name="plus" size={15} /> New chat</Button>
          </>
        }
      />
      {error && <Alert tone="rose" className="mb-3">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* conversation list */}
        <Card className="hidden max-h-[70vh] overflow-y-auto p-2 lg:block">
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">Conversations</p>
          {conversations.length === 0 && <p className="px-2 py-3 text-[12px] text-slate-500">No conversations yet.</p>}
          {conversations.map((c) => (
            <div key={c.id} className="group flex items-center gap-1">
              <button
                onClick={() => { setActiveId(c.id); setParams({ c: String(c.id) }, { replace: true }); }}
                className={`flex-1 truncate rounded-lg px-2 py-2 text-left text-[12.5px] transition ${
                  activeId === c.id ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                }`}
              >
                <span className="block truncate">{c.title}</span>
                <span className="text-[10px] text-slate-500">{fmt.date(c.updated_at)} · {c.message_count} msgs</span>
              </button>
              <button
                onClick={() => remove(c.id)}
                className="rounded p-1 text-slate-600 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                aria-label={`Delete ${c.title}`}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
        </Card>

        {/* thread */}
        <Card className="flex h-[70vh] flex-col p-0">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[12px] text-slate-300">Local CHARDHO engine</span>
            {can('agents.run') && (
              <Select value={agent} onChange={(e) => setAgent(e.target.value)} className="ml-auto w-auto! py-1! text-[11px]!" aria-label="Agent">
                <option value="">No agent</option>
                {agents.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
              </Select>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {loading && <Spinner />}
            {!loading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 p-3 text-cyan-200">
                  <Icon name="sparkles" size={22} />
                </div>
                <p className="text-sm font-medium text-white">Start a conversation</p>
                <p className="mt-1 max-w-sm text-[12.5px] text-mist">
                  Ask for a plan, a draft, a code review or a summary. Everything is saved to your workspace.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {['Plan a product launch', 'Review this SQL query', 'Draft a follow-up email', 'Summarise a document'].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-200">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-cyan-400/12 text-cyan-50'
                    : 'rounded-bl-sm border border-white/[0.09] bg-white/[0.03] text-slate-200'
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.notice && <p className="mt-2 text-[10px] text-slate-500">{m.notice}</p>}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-white/[0.09] bg-white/[0.03] px-3.5 py-2.5">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300/70" style={{ animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>

          <form onSubmit={send} className="border-t border-white/[0.07] p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(e);
                  }
                }}
                placeholder={`Message the assistant…  (you are ${user?.name})`}
                className="min-h-[44px]! resize-none! py-2.5!"
                rows={1}
                aria-label="Message"
              />
              <Button type="submit" loading={busy} disabled={!input.trim()} className="py-2.5!">
                <Icon name="arrow" size={16} />
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              Enter sends · Shift+Enter adds a line · outputs are saved to your history
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------- history ------------------------------- */
export function HistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/ai/conversations')
      .then((d) => setRows(d.conversations || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    await api.del(`/ai/conversations/${id}`).catch((e) => setError(e.message));
    load();
  };

  return (
    <div>
      <PageHeader title="Saved conversations" description="Everything you have asked is stored here until you delete it." />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState icon="chat" title="No saved conversations" description="Start a chat and it will appear here automatically." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} className="flex flex-col p-4" hover>
              <div className="flex items-start justify-between gap-2">
                <a href={`/app/chat?c=${c.id}`} className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{c.message_count} messages · {fmt.dateTime(c.updated_at)}</p>
                </a>
                <button onClick={() => remove(c.id)} className="rounded p-1 text-slate-600 hover:text-rose-300" aria-label="Delete conversation">
                  <Icon name="close" size={14} />
                </button>
              </div>
              <a href={`/app/chat?c=${c.id}`} className="mt-3 text-[11px] text-cyan-300 hover:text-cyan-200">Open conversation →</a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- image studio ---------------------------- */
export function ImageStudioPage() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api.get('/ai/usage').then(setUsage).catch(() => {});
  }, []);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/ai/images', { prompt });
      setImage(res);
      api.get('/ai/usage').then(setUsage).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const limit = usage?.limits?.find((l) => l.key === 'image');

  return (
    <div>
      <PageHeader
        title="Image studio"
        description="Procedural concept artwork generated on the server. No external image service is called and nothing is billed."
        actions={limit && <Badge tone="cyan">{limit.used_today}/{limit.free_limit_daily} today</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <form onSubmit={generate} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">Prompt</span>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the visual: subject, mood, palette…"
                required
                minLength={3}
              />
            </label>
            {error && <Alert tone="rose">{error}</Alert>}
            <Button type="submit" loading={busy} disabled={prompt.trim().length < 3}>
              <Icon name="image" size={15} /> Generate
            </Button>
          </form>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            This is deterministic concept art, not a photorealistic model. Connect an image provider in the Founder
            portal to enable real generation.
          </p>
        </Card>
        <Card className="flex items-center justify-center p-4">
          {image ? (
            <div>
              <img src={image.image} alt={prompt} className="w-full rounded-xl border border-white/10" />
              <p className="mt-2 text-[11px] text-slate-500">Engine: {image.engine}</p>
            </div>
          ) : (
            <EmptyState icon="image" title="Nothing generated yet" description="Your concept artwork will appear here." />
          )}
        </Card>
      </div>
    </div>
  );
}
