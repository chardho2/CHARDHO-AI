import { useCallback, useEffect, useState } from 'react';
import { api, fmt } from '../lib/api.js';
import {
  Alert, Badge, Button, Card, DataTable, EmptyState, Field, Icon, Input, Modal, Select,
  Spinner, StatusPill, Textarea,
} from '../components/ui.jsx';
import { PageHeader } from './PortalShell.jsx';
import { useResource } from './pages.jsx';

/* ------------------------------- API keys ------------------------------ */
export function ApiKeysPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/dev/keys').then((d) => setRows(d.keys || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/dev/keys', { label, scopes: ['read', 'ai'] });
      setCreated(res);
      setOpen(false);
      setLabel('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id) => {
    await api.del(`/dev/keys/${id}`).catch((e) => setError(e.message));
    load();
  };

  return (
    <div>
      <PageHeader
        title="API keys"
        description="Keys are stored as SHA-256 hashes and shown exactly once. Revoking is immediate."
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" size={15} /> Create key</Button>}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {created && (
        <Alert tone="amber" title="Copy this key now" className="mb-4">
          <p className="mt-1">It will not be shown again. Only the hash is stored on the server.</p>
          <code className="mt-2 block break-all rounded-lg bg-black/50 px-3 py-2 font-mono text-[13px] text-white">{created.key}</code>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(created.key)}>Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>Dismiss</Button>
          </div>
        </Alert>
      )}

      {loading ? <Spinner /> : (
        <DataTable
          rows={rows}
          empty="No API keys yet."
          columns={[
            { key: 'label', label: 'Label', render: (k) => <span className="text-[13px] text-white">{k.label}</span> },
            { key: 'prefix', label: 'Prefix', render: (k) => <code className="text-[11.5px] text-cyan-200">{k.prefix}…</code> },
            { key: 'scopes', label: 'Scopes', render: (k) => <span className="text-[11px] text-slate-400">{k.scopes}</span> },
            { key: 'last_used_at', label: 'Last used', render: (k) => fmt.dateTime(k.last_used_at) },
            { key: 'created_at', label: 'Created', render: (k) => fmt.dateTime(k.created_at) },
            { key: 'state', label: 'Status', render: (k) => <StatusPill value={k.revoked_at ? 'disabled' : 'active'} /> },
            { key: 'actions', label: '', render: (k) => (!k.revoked_at ? <Button size="sm" variant="danger" onClick={() => revoke(k.id)}>Revoke</Button> : null) },
          ]}
        />
      )}

      <Card className="mt-4 p-4">
        <h2 className="mb-2 text-sm font-semibold">Using your key</h2>
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-3 text-[12px] text-slate-300">
{`curl /api/v1/tools -H "Authorization: Bearer chd_..."`}
        </pre>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Never ship a key to the browser or a mobile app. Proxy requests through your own server and pass the key there.
        </p>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Create an API key"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create</Button></>}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Label" hint="Something you will recognise later — e.g. “Analytics sync”.">
            <Input required minLength={3} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Alert tone="cyan">Scopes: <code>read</code>, <code>ai</code>. Add <code>write</code> only if the integration must create data.</Alert>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------- webhooks ------------------------------ */
export function WebhooksPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ url: '', events: 'ticket.created' });
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/dev/webhooks').then((d) => setRows(d.webhooks || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/dev/webhooks', { url: form.url, events: [form.events] });
      setSecret(res.secret);
      setOpen(false);
      setForm({ url: '', events: 'ticket.created' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    await api.del(`/dev/webhooks/${id}`).catch((e) => setError(e.message));
    load();
  };

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Receive a signed POST when something happens on the platform. The signing secret is shown once."
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" size={15} /> Add webhook</Button>}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {secret && (
        <Alert tone="amber" title="Signing secret" className="mb-4">
          <code className="mt-2 block break-all rounded-lg bg-black/50 px-3 py-2 font-mono text-[13px] text-white">{secret}</code>
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setSecret(null)}>Dismiss</Button>
        </Alert>
      )}
      {loading ? <Spinner /> : (
        <DataTable
          rows={rows}
          empty="No webhooks configured."
          columns={[
            { key: 'url', label: 'Endpoint', render: (w) => <code className="break-all text-[11.5px] text-cyan-200">{w.url}</code> },
            { key: 'events', label: 'Events', render: (w) => <span className="text-[11px] text-slate-400">{w.events}</span> },
            { key: 'enabled', label: 'Status', render: (w) => <StatusPill value={w.enabled ? 'enabled' : 'disabled'} /> },
            { key: 'created_at', label: 'Created', render: (w) => fmt.dateTime(w.created_at) },
            { key: 'actions', label: '', render: (w) => <Button size="sm" variant="danger" onClick={() => remove(w.id)}>Delete</Button> },
          ]}
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a webhook"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create</Button></>}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Endpoint URL" hint="Must be an absolute http or https URL.">
            <Input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/hooks/chardho" />
          </Field>
          <Field label="Event">
            <Select value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })}>
              {['ticket.created', 'ticket.resolved', 'task.assigned', 'user.registered', 'usage.threshold'].map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

/* --------------------------------- logs -------------------------------- */
export function LogsPage() {
  const res = useResource('errors', { initialFilters: { level: 'all' } });
  return (
    <div>
      <PageHeader title="Error & integration logs" description="Server-side failures and integration events, newest first." />
      {res.error && <Alert tone="rose" className="mb-4">{res.error}</Alert>}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={res.filters.level || 'all'} onChange={(e) => res.setFilters({ ...res.filters, level: e.target.value })} className="w-auto">
          <option value="all">All levels</option>
          {['error', 'warn', 'info'].map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <div className="relative min-w-[180px] flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={res.q} onChange={(e) => res.setQ(e.target.value)} placeholder="Search message or source" className="pl-9" aria-label="Search logs" />
        </div>
      </div>
      {res.loading ? <Spinner /> : (
        <DataTable
          rows={res.rows}
          empty="No log entries."
          columns={[
            { key: 'level', label: 'Level', render: (l) => <StatusPill value={l.level} /> },
            { key: 'source', label: 'Source', render: (l) => <code className="text-[11.5px] text-cyan-200">{l.source}</code> },
            { key: 'message', label: 'Message', render: (l) => <span className="text-[12.5px] text-slate-300">{l.message}</span> },
            { key: 'created_at', label: 'When', render: (l) => <span className="text-[11.5px] text-slate-500">{fmt.dateTime(l.created_at)}</span> },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------ deployments ---------------------------- */
export function DeploymentsPage() {
  const res = useResource('deployments');
  return (
    <div>
      <PageHeader title="Deployments" description="Environment history. Status is recorded by the release process." />
      {res.error && <Alert tone="rose" className="mb-4">{res.error}</Alert>}
      {res.loading ? <Spinner /> : (
        <DataTable
          rows={res.rows}
          empty="No deployments recorded."
          columns={[
            { key: 'environment', label: 'Environment', render: (d) => <Badge tone={d.environment === 'production' ? 'violet' : 'cyan'}>{d.environment}</Badge> },
            { key: 'version', label: 'Version', render: (d) => <code className="text-[12px] text-white">{d.version}</code> },
            { key: 'status', label: 'Status', render: (d) => <StatusPill value={d.status} /> },
            { key: 'note', label: 'Note', render: (d) => <span className="text-[12px] text-slate-400">{d.note || '—'}</span> },
            { key: 'created_at', label: 'When', render: (d) => <span className="text-[11.5px] text-slate-500">{fmt.dateTime(d.created_at)}</span> },
          ]}
        />
      )}
    </div>
  );
}

/* -------------------------------- sandbox ------------------------------ */
export function SandboxPage() {
  const [form, setForm] = useState({ method: 'GET', endpoint: '/api/v1/ping' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post('/dev/sandbox', form));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Sandbox"
        description="Validate a request against the sandbox allow-list. Nothing is read or written — this only reports how the API would respond."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <form onSubmit={send} className="space-y-3">
            <Field label="Method">
              <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {['GET', 'POST', 'PATCH', 'DELETE'].map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </Field>
            <Field label="Endpoint" hint="Must start with /api/">
              <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
            </Field>
            <Button type="submit" loading={busy}>Send test request</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {['/api/v1/ping', '/api/v1/me', '/api/v1/tools', '/api/v1/agents', '/api/v1/usage'].map((ep) => (
              <button key={ep} onClick={() => setForm({ ...form, endpoint: ep })} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:border-cyan-300/30 hover:text-cyan-200">
                {ep}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Response</h2>
          {error && <Alert tone="rose">{error}</Alert>}
          {!result && !error && <EmptyState icon="terminal" title="No request sent yet" description="Send a test request to see the simulated response." />}
          {result && (
            <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/50 p-3 text-[11.5px] leading-relaxed text-slate-300">
{JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------- backups ------------------------------ */
export function BackupsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/backups').then((d) => setRows(d.backups || [])).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post('/admin/backups');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Backups"
        description="Point-in-time copies of the SQLite database, written to the server's data directory. Founder only."
        actions={<Button onClick={create} loading={busy}><Icon name="box" size={15} /> Create backup</Button>}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      <Alert tone="cyan" className="mb-4">
        Backups live on the same disk as the live database. Copy them to separate storage for real disaster recovery.
      </Alert>
      {loading ? <Spinner /> : (
        <DataTable
          rows={rows}
          empty="No backups created yet."
          rowKey={(b) => b.file}
          columns={[
            { key: 'file', label: 'File', render: (b) => <code className="text-[11.5px] text-cyan-200">{b.file}</code> },
            { key: 'size', label: 'Size', render: (b) => `${(b.size / 1024).toFixed(1)} KB` },
            { key: 'created_at', label: 'Created', render: (b) => fmt.dateTime(b.created_at) },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------ moderation ----------------------------- */
export function ModerationPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/moderation')
      .then((d) => setRows(d.conversations || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    await api.del(`/admin/moderation/conversations/${id}`).catch((e) => setError(e.message));
    load();
  };

  return (
    <div>
      <PageHeader
        title="Content moderation"
        description="Review recent conversations across the platform. Removing one notifies its owner and writes an audit entry."
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {loading ? <Spinner /> : (
        <DataTable
          rows={rows}
          empty="No conversations to review."
          columns={[
            { key: 'title', label: 'Conversation', render: (c) => (
              <div className="min-w-[180px]">
                <p className="text-[13px] text-white">{c.title}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{c.last_message || '—'}</p>
              </div>
            ) },
            { key: 'owner', label: 'Owner', render: (c) => <span className="text-[12px] text-slate-300">{c.owner}</span> },
            { key: 'messages', label: 'Messages', render: (c) => <Badge>{c.messages}</Badge> },
            { key: 'created_at', label: 'Created', render: (c) => fmt.dateTime(c.created_at) },
            { key: 'actions', label: '', render: (c) => <Button size="sm" variant="danger" onClick={() => remove(c.id)}>Remove</Button> },
          ]}
        />
      )}
    </div>
  );
}
