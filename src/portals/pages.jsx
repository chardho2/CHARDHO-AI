import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, fmt } from '../lib/api.js';
import {
  Alert, Badge, Button, Card, DataTable, Donut, EmptyState, Field, Icon, Input, MiniBars,
  Modal, Select, Spinner, StatusPill, Textarea,
} from '../components/ui.jsx';
import { PageHeader, PortalGate } from './PortalShell.jsx';

/* ------------------------------------------------------------------ *
 * shared resource hook
 * ------------------------------------------------------------------ */
export function useResource(name, { initialFilters = {}, limit = 25 } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(initialFilters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit, offset: page * limit });
      if (q) params.set('q', q);
      for (const [k, v] of Object.entries(filters)) if (v && v !== 'all') params.set(k, v);
      const data = await api.get(`/portal/resources/${name}?${params}`);
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [name, page, limit, q, filters]);

  useEffect(() => { load(); }, [load]);

  return { rows, total, loading, error, reload: load, page, setPage, q, setQ, filters, setFilters, limit };
}

function Pager({ page, setPage, total, limit }) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-[12px] text-slate-400">
      <span>{total} records</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
        <span>{page + 1} / {pages}</span>
        <Button variant="ghost" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
    </div>
  );
}

function Toolbar({ q, setQ, filters, setFilters, options = {}, placeholder = 'Search…' }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[180px] flex-1">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); }}
          placeholder={placeholder}
          className="pl-9"
          aria-label="Search"
        />
      </div>
      {Object.entries(options).map(([key, values]) => (
        <Select
          key={key}
          value={filters[key] || 'all'}
          onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
          aria-label={`Filter by ${key}`}
          className="w-auto min-w-[130px]"
        >
          <option value="all">All {key.replace(/_/g, ' ')}</option>
          {values.map((v) => <option key={v} value={v}>{fmt.title(v)}</option>)}
        </Select>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */
export function UsersPage() {
  const { can, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/admin/users');
      setRows(data.users || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((u) => {
    const matchQ = !q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchQ && matchRole;
  }), [rows, q, roleFilter]);

  const createUser = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post('/admin/users', form);
      setTempPassword({ email: form.email, password: res.tempPassword, route: res.homeRoute });
      setCreateOpen(false);
      setForm({ name: '', email: '', role: 'staff' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id, body) => {
    try {
      await api.patch(`/admin/users/${id}`, body);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetPassword = async (id) => {
    try {
      const res = await api.post(`/admin/users/${id}/reset-password`);
      const target = rows.find((r) => r.id === id);
      setTempPassword({ email: target?.email, password: res.tempPassword, reset: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every account belongs to exactly one role, and each role maps to one portal. Public sign-up can only create Free Users."
        actions={can('users.write') && (
          <Button onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} /> Add user</Button>
        )}
      />

      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {tempPassword && (
        <Alert tone="amber" title={tempPassword.reset ? 'Temporary password issued' : 'Account created'} className="mb-4">
          <p className="mt-1">Send these to <strong>{tempPassword.email}</strong> over a secure channel. It is shown once:</p>
          <code className="mt-2 block rounded-lg bg-black/40 px-3 py-2 font-mono text-[13px] text-white">{tempPassword.password}</code>
          {tempPassword.route && <p className="mt-2 text-xs">They will sign in and land on <code>{tempPassword.route}</code>.</p>}
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setTempPassword(null)}>Dismiss</Button>
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search users" />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-auto min-w-[150px]" aria-label="Filter by role">
          <option value="all">All roles</option>
          {['founder', 'super_admin', 'manager', 'staff', 'developer', 'support', 'user'].map((r) => (
            <option key={r} value={r}>{fmt.title(r)}</option>
          ))}
        </Select>
      </div>

      {loading ? <Spinner /> : (
        <DataTable
          rows={filtered}
          empty="No users match this filter."
          columns={[
            {
              key: 'name',
              label: 'User',
              render: (u) => (
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400/80 to-violet-500/80 text-[11px] font-semibold text-slate-950">
                    {u.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-white">{u.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{u.email}</p>
                  </div>
                </div>
              ),
            },
            { key: 'role_name', label: 'Role', render: (u) => <Badge tone={u.role === 'founder' ? 'violet' : 'cyan'}>{u.role_name}</Badge> },
            { key: 'status', label: 'Status', render: (u) => <StatusPill value={u.status} /> },
            { key: 'totp_enabled', label: '2FA', render: (u) => (u.totp_enabled ? <Badge tone="green">on</Badge> : <Badge>off</Badge>) },
            { key: 'last_login_at', label: 'Last sign-in', render: (u) => <span className="text-[12px] text-slate-400">{fmt.dateTime(u.last_login_at)}</span> },
            {
              key: 'actions',
              label: '',
              render: (u) => can('users.write') && (
                <div className="flex items-center gap-1.5">
                  {u.role !== 'founder' && (
                    <Select
                      value={u.role}
                      onChange={(e) => patch(u.id, { role: e.target.value })}
                      className="w-auto! px-2! py-1! text-[11px]!"
                      aria-label={`Change role for ${u.name}`}
                    >
                      {['super_admin', 'manager', 'staff', 'developer', 'support', 'user'].map((r) => (
                        <option key={r} value={r}>{fmt.title(r)}</option>
                      ))}
                    </Select>
                  )}
                  <Button
                    size="sm"
                    variant={u.status === 'active' ? 'danger' : 'ghost'}
                    disabled={u.id === user.id}
                    onClick={() => patch(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })}
                  >
                    {u.status === 'active' ? 'Suspend' : 'Restore'}
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => resetPassword(u.id)}>Reset</Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a portal account"
        footer={<>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={createUser} loading={busy}>Create account</Button>
        </>}
      >
        <form onSubmit={createUser} className="space-y-4">
          <Field label="Full name"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role" hint="The role determines which portal they can open.">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {['super_admin', 'manager', 'staff', 'developer', 'support', 'user'].map((r) => (
                <option key={r} value={r}>{fmt.title(r)}</option>
              ))}
              {user?.role === 'founder' && <option value="founder">Founder</option>}
            </Select>
          </Field>
          <Alert tone="cyan">A random temporary password is generated on the server. There are no default passwords.</Alert>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Roles & permissions
 * ------------------------------------------------------------------ */
export function PermissionsPage() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/roles');
      setData(res);
      setDraft(res.mapping);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <><PageHeader title="Roles & permissions" /><Alert tone="rose">{error}</Alert></>;
  if (!data) return <Spinner />;

  const groups = data.permissions.reduce((acc, p) => {
    (acc[p.group_name] ||= []).push(p);
    return acc;
  }, {});

  const toggle = (roleKey, permKey) => {
    setDraft((prev) => {
      const list = new Set(prev[roleKey] || []);
      if (list.has(permKey)) list.delete(permKey);
      else list.add(permKey);
      return { ...prev, [roleKey]: [...list] };
    });
  };

  const save = async (roleKey) => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/roles/${roleKey}/permissions`, { permissions: draft[roleKey] || [] });
      setSaved(roleKey);
      setTimeout(() => setSaved(null), 2500);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const editableRoles = data.roles.filter((r) => r.key !== 'founder');

  return (
    <PortalGate permission="permissions.manage">
      <PageHeader
        title="Roles & permissions"
        description="Founder-only. Changes take effect on the next request because the server re-reads permissions from the database every time."
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      <Alert tone="violet" className="mb-4">
        Founder permissions are fixed and cannot be edited. Roles, permissions and founder-only actions are additionally
        enforced in code, so a database edit cannot grant founder-only rights to another role.
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        {editableRoles.map((role) => (
          <Card key={role.key} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">{role.name}</h2>
                <p className="text-[11px] text-slate-500">Portal {role.portal} · {(draft[role.key] || []).length} permissions</p>
              </div>
              <div className="flex items-center gap-2">
                {saved === role.key && <Badge tone="green">saved</Badge>}
                <Button size="sm" onClick={() => save(role.key)} loading={busy}>Save</Button>
              </div>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {Object.entries(groups).map(([group, perms]) => (
                <div key={group}>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{group}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {perms.map((p) => {
                      const checked = (draft[role.key] || []).includes(p.key);
                      const founderOnly = data.founderOnly.includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] transition ${
                            founderOnly ? 'cursor-not-allowed opacity-40' : 'hover:bg-white/[0.05]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={founderOnly}
                            onChange={() => toggle(role.key, p.key)}
                            className="mt-0.5 h-3.5 w-3.5 accent-cyan-400"
                          />
                          <span className="text-slate-300">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </PortalGate>
  );
}

/* ------------------------------------------------------------------ *
 * AI tools / models / providers / agents
 * ------------------------------------------------------------------ */
export function ToolsPage() {
  const { can } = useAuth();
  const admin = can('ai_tools.write');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = admin ? await api.get('/ai/tools') : await api.get('/ai/tools');
      setRows(data.tools || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => { load(); }, [load]);

  const patch = async (key, body) => {
    try {
      await api.patch(`/admin/tools/${key}`, body);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="AI tools"
        description={admin
          ? 'Enable or disable tools and set the daily fair-use limit for each. Founder and Super Admin are exempt from limits.'
          : 'These are your available tools and the daily fair-use allowance configured by the platform owner.'}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((tool) => (
          <Card key={tool.key} className="p-4" hover>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[13.5px] font-semibold text-white">{tool.name}</h2>
                <p className="text-[11px] text-slate-500">{tool.category}</p>
              </div>
              {tool.enabled ? <Badge tone="green">enabled</Badge> : <Badge tone="rose">disabled</Badge>}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-mist">{tool.description}</p>

            {admin ? (
              <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[12px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!tool.enabled}
                      onChange={(e) => patch(tool.key, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 accent-cyan-400"
                    />
                    Enabled
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={tool.free_limit_daily}
                      onBlur={(e) => patch(tool.key, { free_limit_daily: Number(e.target.value) })}
                      className="w-20! py-1! text-[12px]!"
                      aria-label={`Daily limit for ${tool.name}`}
                    />
                    <span className="text-[11px] text-slate-500">/day</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[11px]">
                <span className="text-slate-500">Used today</span>
                <span className="text-slate-300">{tool.used_today ?? 0} / {tool.free_limit_daily}</span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ModelsPage() {
  const { can } = useAuth();
  const editable = can('ai_models.write');
  const res = useResource('models', { initialFilters: { enabled: 'all' } });

  const toggle = async (slug, enabled) => {
    await api.patch(`/admin/models/${slug}`, { enabled }).catch(() => {});
    res.reload();
  };

  return (
    <div>
      <PageHeader title="AI models" description="Model bindings used by agents and the workspace. Costs are shown per 1K tokens; the local engine is free." />
      {res.error && <Alert tone="rose" className="mb-4">{res.error}</Alert>}
      {res.loading ? <Spinner /> : (
        <DataTable
          rows={res.rows}
          empty="No models configured."
          columns={[
            { key: 'name', label: 'Model', render: (m) => <span className="text-[13px] text-white">{m.name}</span> },
            { key: 'provider', label: 'Provider' },
            { key: 'context_window', label: 'Context', render: (m) => fmt.compact(m.context_window) },
            { key: 'cost_per_1k_input', label: 'In / Out', render: (m) => <span className="text-[12px] text-slate-400">{fmt.money(m.cost_per_1k_input)} / {fmt.money(m.cost_per_1k_output)}</span> },
            { key: 'enabled', label: 'Status', render: (m) => <StatusPill value={m.enabled ? 'enabled' : 'disabled'} /> },
            ...(editable ? [{
              key: 'actions', label: '',
              render: (m) => <Button size="sm" variant="subtle" onClick={() => toggle(m.slug, !m.enabled)}>{m.enabled ? 'Disable' : 'Enable'}</Button>,
            }] : []),
          ]}
        />
      )}
    </div>
  );
}

export function ProvidersPage() {
  const { can } = useAuth();
  const editable = can('ai_providers.write');
  const res = useResource('providers');

  const toggle = async (slug, enabled) => {
    await api.patch(`/admin/providers/${slug}`, { enabled }).catch(() => {});
    res.reload();
  };

  return (
    <div>
      <PageHeader
        title="AI providers"
        description="Providers read their secret from an environment variable at runtime. Keys are never stored in the database or sent to the browser."
      />
      <Alert tone="amber" className="mb-4">
        Enabling a paid provider is a commercial decision. No paid provider is switched on without the Owner's approval.
      </Alert>
      {res.error && <Alert tone="rose" className="mb-4">{res.error}</Alert>}
      {res.loading ? <Spinner /> : (
        <DataTable
          rows={res.rows}
          empty="No providers configured."
          columns={[
            { key: 'name', label: 'Provider', render: (p) => <span className="text-[13px] text-white">{p.name}</span> },
            { key: 'slug', label: 'Key', render: (p) => <code className="text-[11.5px] text-slate-400">{p.slug}</code> },
            { key: 'key_env_var', label: 'Secret source', render: (p) => <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-cyan-200">{p.key_env_var}</code> },
            { key: 'is_paid', label: 'Cost', render: (p) => (p.is_paid ? <Badge tone="amber">paid</Badge> : <Badge tone="green">free</Badge>) },
            { key: 'enabled', label: 'Status', render: (p) => <StatusPill value={p.enabled ? 'enabled' : 'disabled'} /> },
            ...(editable ? [{
              key: 'actions', label: '',
              render: (p) => <Button size="sm" variant="subtle" onClick={() => toggle(p.slug, !p.enabled)}>{p.enabled ? 'Disable' : 'Enable'}</Button>,
            }] : []),
          ]}
        />
      )}
    </div>
  );
}

export function AgentsPage() {
  const { can } = useAuth();
  const res = useResource('agents');
  const [running, setRunning] = useState(null);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res2 = await api.post(`/ai/agents/${running.key}/run`, { input });
      setOutput(res2.output);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Agents" description="Each agent carries its own system prompt and model binding. Every run is metered against your fair-use allowance." />
      {res.error && <Alert tone="rose" className="mb-4">{res.error}</Alert>}
      {res.loading ? <Spinner /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {res.rows.map((agent) => (
            <Card key={agent.key} className="flex h-full flex-col p-4" hover>
              <div className="flex items-start justify-between">
                <span className="rounded-lg bg-violet-500/15 p-2 text-violet-200"><Icon name="sparkles" size={16} /></span>
                <StatusPill value={agent.enabled ? 'enabled' : 'disabled'} />
              </div>
              <h2 className="mt-2.5 text-[13.5px] font-semibold text-white">{agent.name}</h2>
              <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-mist">{agent.description}</p>
              <p className="mt-2 text-[11px] text-slate-500">Model: {agent.model || 'local'}</p>
              {can('agents.run') && (
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => { setRunning(agent); setOutput(null); setInput(''); setError(null); }}>
                  Run agent
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!running}
        onClose={() => setRunning(null)}
        title={running ? `Run ${running.name}` : ''}
        footer={output ? <Button variant="ghost" onClick={() => { setOutput(null); }}>Run again</Button> : <Button onClick={run} loading={busy} disabled={!input.trim()}>Run</Button>}
      >
        <div className="space-y-3">
          <Field label="Input" hint="Plain language. The agent returns structured output.">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe the task…" />
          </Field>
          {error && <Alert tone="rose">{error}</Alert>}
          {output && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-slate-200">
              {output}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tasks
 * ------------------------------------------------------------------ */
export function TasksPage() {
  const { can, user } = useAuth();
  const res = useResource('tasks', { initialFilters: { status: 'all' } });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/work/tasks', form);
      setOpen(false);
      setForm({ title: '', description: '', priority: 'medium', due_date: '' });
      res.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (id, body) => {
    try {
      await api.patch(`/work/tasks/${id}`, body);
      res.reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={can('tasks.read.all') ? 'All work across the team. You can reassign and reprioritise.' : 'Work assigned to you.'}
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" size={15} /> New task</Button>}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      <Toolbar
        q={res.q}
        setQ={res.setQ}
        filters={res.filters}
        setFilters={res.setFilters}
        placeholder="Search tasks"
        options={{ status: ['todo', 'in_progress', 'review', 'done', 'blocked'], priority: ['low', 'medium', 'high', 'urgent'] }}
      />

      {res.loading ? <Spinner /> : (
        <>
          <DataTable
            rows={res.rows}
            empty="No tasks yet."
            columns={[
              { key: 'title', label: 'Task', render: (t) => (
                <div className="min-w-[180px]">
                  <p className="text-[13px] text-white">{t.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{t.description}</p>
                </div>
              ) },
              { key: 'assignee', label: 'Assignee', render: (t) => <span className="text-[12px] text-slate-300">{t.assignee || '—'}</span> },
              { key: 'priority', label: 'Priority', render: (t) => <StatusPill value={t.priority} /> },
              { key: 'due_date', label: 'Due', render: (t) => <span className="text-[12px] text-slate-400">{fmt.date(t.due_date)}</span> },
              { key: 'progress', label: 'Progress', render: (t) => (
                <div className="w-24">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${t.progress}%` }} />
                  </div>
                  <span className="mt-0.5 block text-[10px] text-slate-500">{t.progress}%</span>
                </div>
              ) },
              {
                key: 'status', label: 'Status',
                render: (t) => {
                  const mine = t.assigned_to === user.id;
                  if (!mine && !can('tasks.assign')) return <StatusPill value={t.status} />;
                  return (
                    <Select
                      value={t.status}
                      onChange={(e) => update(t.id, { status: e.target.value, progress: e.target.value === 'done' ? 100 : t.progress })}
                      className="w-auto! px-2! py-1! text-[11px]!"
                      aria-label={`Status for ${t.title}`}
                    >
                      {['todo', 'in_progress', 'review', 'done', 'blocked'].map((s) => <option key={s} value={s}>{fmt.title(s)}</option>)}
                    </Select>
                  );
                },
              },
            ]}
          />
          <Pager page={res.page} setPage={res.setPage} total={res.total} limit={res.limit} />
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create a task"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Create</Button></>}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Title"><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{fmt.title(p)}</option>)}
              </Select>
            </Field>
            <Field label="Due date"><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Attendance
 * ------------------------------------------------------------------ */
export function AttendancePage() {
  const { can } = useAuth();
  const res = useResource('attendance');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const punch = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/work/attendance/${action}`);
      setNote(`${action === 'check-in' ? 'Checked in' : 'Checked out'} at ${r.attendance.check_in || r.attendance.check_out}`);
      res.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = res.rows.find((r) => r.work_date === today);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={can('attendance.read.all') ? 'Team attendance. Managers can correct a status with a note.' : 'Your check-in history for the current period.'}
        actions={can('attendance.write') && (
          <>
            <Button variant="ghost" disabled={busy || !todayRow?.check_in} onClick={() => punch('check-in')}>
              <Icon name="clock" size={15} /> Check in
            </Button>
            <Button variant="ghost" disabled={busy || !todayRow?.check_in || !todayRow?.check_out} onClick={() => punch('check-out')}>
              Check out
            </Button>
          </>
        )}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {note && <Alert tone="green" className="mb-4">{note}</Alert>}

      {res.loading ? <Spinner /> : (
        <DataTable
          rows={res.rows}
          empty="No attendance records."
          columns={[
            ...(can('attendance.read.all') ? [{ key: 'staff', label: 'Staff', render: (a) => <span className="text-[13px] text-slate-200">{a.staff}</span> }] : []),
            { key: 'work_date', label: 'Date', render: (a) => fmt.date(a.work_date) },
            { key: 'check_in', label: 'In', render: (a) => fmt.time(a.check_in) },
            { key: 'check_out', label: 'Out', render: (a) => fmt.time(a.check_out) },
            { key: 'status', label: 'Status', render: (a) => <StatusPill value={a.status} /> },
            { key: 'note', label: 'Note', render: (a) => <span className="text-[12px] text-slate-500">{a.note || '—'}</span> },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tickets
 * ------------------------------------------------------------------ */
export function TicketsPage() {
  const { can } = useAuth();
  const res = useResource('tickets');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' });

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/work/tickets', form);
      setOpen(false);
      setForm({ subject: '', description: '', priority: 'medium' });
      res.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (id, body) => {
    try {
      await api.patch(`/work/tickets/${id}`, body);
      res.reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description={can('tickets.read.all') ? 'Every ticket on the platform, ordered by priority.' : 'Tickets you have raised.'}
        actions={<Button onClick={() => setOpen(true)}><Icon name="plus" size={15} /> New ticket</Button>}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      <Toolbar
        q={res.q} setQ={res.setQ} filters={res.filters} setFilters={res.setFilters}
        placeholder="Search tickets"
        options={{ status: ['open', 'pending', 'resolved', 'closed'], priority: ['low', 'medium', 'high', 'urgent'] }}
      />

      {res.loading ? <Spinner /> : (
        <>
          <DataTable
            rows={res.rows}
            empty="No tickets."
            columns={[
              { key: 'subject', label: 'Ticket', render: (t) => (
                <div className="min-w-[200px]">
                  <p className="text-[13px] text-white"><span className="text-slate-500">#{t.id}</span> {t.subject}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{t.description}</p>
                </div>
              ) },
              { key: 'requester', label: 'Requester', render: (t) => <span className="text-[12px] text-slate-300">{t.requester || 'Website'}</span> },
              { key: 'priority', label: 'Priority', render: (t) => (can('tickets.assign')
                ? <Select value={t.priority} onChange={(e) => update(t.id, { priority: e.target.value })} className="w-auto! px-2! py-1! text-[11px]!" aria-label="Priority">
                    {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{fmt.title(p)}</option>)}
                  </Select>
                : <StatusPill value={t.priority} />) },
              { key: 'status', label: 'Status', render: (t) => (can('tickets.assign')
                ? <Select value={t.status} onChange={(e) => update(t.id, { status: e.target.value })} className="w-auto! px-2! py-1! text-[11px]!" aria-label="Status">
                    {['open', 'pending', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{fmt.title(s)}</option>)}
                  </Select>
                : <StatusPill value={t.status} />) },
              { key: 'created_at', label: 'Opened', render: (t) => <span className="text-[12px] text-slate-400">{fmt.dateTime(t.created_at)}</span> },
            ]}
          />
          <Pager page={res.page} setPage={res.setPage} total={res.total} limit={res.limit} />
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Raise a ticket"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} loading={busy}>Submit</Button></>}>
        <form onSubmit={create} className="space-y-4">
          <Field label="Subject"><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
          <Field label="Details"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{fmt.title(p)}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Staff overview
 * ------------------------------------------------------------------ */
export function StaffPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/work/staff-overview')
      .then((d) => setRows(d.staff || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Team" description="Staff profiles, workload and last attendance status." />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {loading ? <Spinner /> : (
        <DataTable
          rows={rows}
          empty="No staff profiles yet."
          columns={[
            { key: 'name', label: 'Staff', render: (s) => (
              <div>
                <p className="text-[13px] text-white">{s.name}</p>
                <p className="text-[11px] text-slate-500">{s.email}</p>
              </div>
            ) },
            { key: 'employee_code', label: 'Code', render: (s) => <code className="text-[11.5px] text-slate-400">{s.employee_code || '—'}</code> },
            { key: 'department', label: 'Department', render: (s) => s.department || '—' },
            { key: 'designation', label: 'Designation', render: (s) => s.designation || '—' },
            { key: 'open_tasks', label: 'Open', render: (s) => <Badge tone="cyan">{s.open_tasks ?? 0}</Badge> },
            { key: 'done_tasks', label: 'Done', render: (s) => <Badge tone="green">{s.done_tasks ?? 0}</Badge> },
            { key: 'last_attendance', label: 'Last attendance', render: (s) => <StatusPill value={s.last_attendance || 'absent'} /> },
          ]}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Reports & usage
 * ------------------------------------------------------------------ */
export function ReportsPage({ portalKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/portal/${portalKey}/reports`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [portalKey]);

  if (error) return <><PageHeader title="Reports" /><Alert tone="rose">{error}</Alert></>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Reports"
        description={data.scopedTo === 'platform' ? 'Platform-wide usage, scoped by your role.' : 'Your own usage. Managers and owners see platform-wide figures.'}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Requests by day</h2>
          <MiniBars data={data.byDay} valueKey="value" labelKey="day" height={160} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Requests by tool</h2>
          <Donut data={data.byTool.map((d) => ({ label: d.label, value: d.value }))} />
        </Card>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Requests</p><p className="mt-1 text-xl font-semibold">{fmt.number(data.totals?.requests)}</p></Card>
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Tokens</p><p className="mt-1 text-xl font-semibold">{fmt.compact(data.totals?.tokens)}</p></Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase text-slate-400">AI cost</p>
          <p className="mt-1 text-xl font-semibold">{fmt.money(data.totals?.cost)}</p>
          <span className="text-[11px] text-slate-500">local engine · no spend</span>
        </Card>
      </div>
      {data.byRole?.length > 0 && (
        <Card className="mt-4 p-5">
          <h2 className="mb-3 text-sm font-semibold">Active users by role</h2>
          <DataTable rows={data.byRole} columns={[{ key: 'label', label: 'Role' }, { key: 'value', label: 'Active users' }]} rowKey={(r) => r.label} />
        </Card>
      )}
    </div>
  );
}

export function UsagePage({ portalKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get('/ai/usage').then(setData).catch((e) => setError(e.message));
  }, [portalKey]);

  if (error) return <><PageHeader title="Usage" /><Alert tone="rose">{error}</Alert></>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Usage & cost" description="Metered per tool and per day so fair-use limits stay transparent. The local engine costs nothing." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Total requests</p><p className="mt-1 text-xl font-semibold">{fmt.number(data.summary?.requests)}</p></Card>
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Tokens in / out</p><p className="mt-1 text-xl font-semibold">{fmt.compact(data.summary?.tokens_in)} / {fmt.compact(data.summary?.tokens_out)}</p></Card>
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Cost</p><p className="mt-1 text-xl font-semibold">{fmt.money(data.summary?.cost)}</p></Card>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="mb-3 text-sm font-semibold">Daily fair-use allowances</h2>
        <DataTable
          rows={data.limits}
          rowKey={(r) => r.key}
          columns={[
            { key: 'name', label: 'Tool' },
            { key: 'used_today', label: 'Used today', render: (r) => `${r.used_today} / ${r.free_limit_daily}` },
            {
              key: 'bar', label: 'Allowance',
              render: (r) => (
                <div className="w-40">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${r.used_today >= r.free_limit_daily ? 'bg-rose-400' : 'bg-gradient-to-r from-cyan-400 to-violet-400'}`}
                      style={{ width: `${Math.min((r.used_today / Math.max(r.free_limit_daily, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Audit, security, settings, profile, notifications
 * ------------------------------------------------------------------ */
export function AuditPage() {
  const res = useResource('audit');
  return (
    <div>
      <PageHeader title="Audit log" description="Every administrative action, authentication event and moderation decision, with actor and IP." />
      {res.error && <Alert tone="rose" className="mb-4">{res.error}</Alert>}
      <Toolbar q={res.q} setQ={res.setQ} filters={res.filters} setFilters={res.setFilters} placeholder="Search action, actor or entity" />
      {res.loading ? <Spinner /> : (
        <>
          <DataTable
            rows={res.rows}
            empty="No audit entries."
            columns={[
              { key: 'action', label: 'Action', render: (a) => <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11.5px] text-cyan-200">{a.action}</code> },
              { key: 'actor_email', label: 'Actor', render: (a) => <span className="text-[12px] text-slate-300">{a.actor_email || 'system'}</span> },
              { key: 'entity', label: 'Entity', render: (a) => <span className="text-[12px] text-slate-400">{a.entity || '—'}{a.entity_id ? ` #${a.entity_id}` : ''}</span> },
              { key: 'ip', label: 'IP', render: (a) => <span className="text-[11px] text-slate-500">{a.ip || '—'}</span> },
              { key: 'created_at', label: 'When', render: (a) => <span className="text-[12px] text-slate-400">{fmt.dateTime(a.created_at)}</span> },
            ]}
          />
          <Pager page={res.page} setPage={res.setPage} total={res.total} limit={res.limit} />
        </>
      )}
    </div>
  );
}

export function SecurityPage() {
  const { can, user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/security').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const revoke = async (id) => {
    await api.del(`/auth/sessions/${id}`).catch(() => {});
    load();
  };

  if (error) return <><PageHeader title="Security" /><Alert tone="rose">{error}</Alert></>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Security posture"
        description="Privileged accounts, two-factor coverage and live sessions. Revoking a session signs that device out immediately."
        actions={<Button variant="ghost" onClick={load}>Refresh</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Failed logins (24h)</p><p className="mt-1 text-xl font-semibold">{data.failedLogins24h}</p></Card>
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">2FA enforcement</p><p className="mt-1 text-xl font-semibold">{data.twoFactorEnforced ? 'On' : 'Off'}</p></Card>
        <Card className="p-4"><p className="text-[11px] uppercase text-slate-400">Live sessions</p><p className="mt-1 text-xl font-semibold">{data.sessions.length}</p></Card>
      </div>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold">Privileged accounts</h2>
        <DataTable
          rows={data.privilegedUsers}
          columns={[
            { key: 'email', label: 'Account' },
            { key: 'role', label: 'Role', render: (u) => <Badge tone="violet">{fmt.title(u.role)}</Badge> },
            { key: 'totp_enabled', label: 'Two-factor', render: (u) => (u.totp_enabled ? <Badge tone="green">enabled</Badge> : <Badge tone="rose">missing</Badge>) },
            { key: 'last_login_at', label: 'Last sign-in', render: (u) => fmt.dateTime(u.last_login_at) },
          ]}
        />
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-sm font-semibold">Active sessions</h2>
        <DataTable
          rows={data.sessions}
          empty="No active sessions."
          columns={[
            { key: 'email', label: 'User' },
            { key: 'ip', label: 'IP', render: (s) => <span className="text-[12px] text-slate-400">{s.ip || '—'}</span> },
            { key: 'twofa_verified', label: '2FA', render: (s) => (s.twofa_verified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">pending</Badge>) },
            { key: 'created_at', label: 'Started', render: (s) => fmt.dateTime(s.created_at) },
            { key: 'expires_at', label: 'Expires', render: (s) => fmt.dateTime(s.expires_at) },
            ...(can('sessions.manage') ? [{ key: 'actions', label: '', render: (s) => <Button size="sm" variant="danger" onClick={() => revoke(s.id)}>Revoke</Button> }] : []),
          ]}
        />
      </Card>
    </div>
  );
}

export function SettingsPage({ portalKey }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/portal/${portalKey}/settings`)
      .then((d) => { setData(d); setDraft(Object.fromEntries(d.settings.map((s) => [s.key, s.value]))); })
      .catch((e) => setError(e.message));
  }, [portalKey]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/portal/${portalKey}/settings`, { settings: draft });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <><PageHeader title="Settings" /><Alert tone="rose">{error}</Alert></>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Portal settings"
        description={`Configuration for the ${portalKey} portal. Global platform settings are managed by the Founder.`}
        actions={data.canEdit && <Button onClick={save} loading={busy}>{saved ? 'Saved' : 'Save changes'}</Button>}
      />
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}
      {!data.canEdit && <Alert tone="amber" className="mb-4">You can view these settings but not change them. The API enforces this with the <code>settings.write</code> permission.</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">{portalKey} settings</h2>
          {data.settings.length === 0 && <EmptyState title="No settings for this portal yet" />}
          <div className="space-y-3">
            {data.settings.map((s) => (
              <Field key={s.key} label={s.key.replace(/_/g, ' ')} hint={`Last updated ${fmt.dateTime(s.updated_at)}`}>
                <Input
                  value={draft[s.key] ?? ''}
                  disabled={!data.canEdit}
                  onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Global platform</h2>
          <div className="space-y-2">
            {data.global.map((g) => (
              <div key={g.key} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.07] px-3 py-2">
                <div>
                  <p className="text-[12.5px] text-slate-200">{g.key.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-slate-500">{fmt.dateTime(g.updated_at)}</p>
                </div>
                <code className="max-w-[50%] truncate text-[11.5px] text-cyan-200">{g.value}</code>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Global values are read-only here. The Founder can change them in the Founder portal settings.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [sessions, setSessions] = useState([]);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api.get('/portal/profile').then((d) => { setData(d); setName(d.profile?.name || ''); }).catch(() => {});
    api.get('/auth/sessions').then((d) => setSessions(d.sessions || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveName = async () => {
    setError(null);
    try {
      await api.patch('/portal/profile', { name });
      await refresh();
      setMsg('Profile updated');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw.newPassword !== pw.confirm) {
      setError('The new passwords do not match');
      return;
    }
    try {
      await api.post('/auth/password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setMsg('Password changed. Other sessions were signed out.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const revoke = async (id) => {
    await api.del(`/auth/sessions/${id}`).catch(() => {});
    load();
  };

  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Profile" description="Your account, password and active sessions." />
      {msg && <Alert tone="green" className="mb-4">{msg}</Alert>}
      {error && <Alert tone="rose" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Account</h2>
          <dl className="mb-4 space-y-2 text-[12.5px]">
            <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd className="text-slate-200">{data.profile.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Role</dt><dd><Badge tone="violet">{data.profile.role_name}</Badge></dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Two-factor</dt><dd>{data.profile.totp_enabled ? <Badge tone="green">enabled</Badge> : <Badge tone="amber">not enabled</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Email verified</dt><dd>{data.profile.email_verified ? <Badge tone="green">yes</Badge> : <Badge tone="amber">no</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Member since</dt><dd className="text-slate-200">{fmt.date(data.profile.created_at)}</dd></div>
            {data.staff && (
              <>
                <div className="flex justify-between"><dt className="text-slate-400">Employee code</dt><dd className="text-slate-200">{data.staff.employee_code}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Department</dt><dd className="text-slate-200">{data.staff.department}</dd></div>
              </>
            )}
          </dl>
          <Field label="Display name">
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="ghost" onClick={saveName}>Save</Button>
            </div>
          </Field>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Change password</h2>
          <form onSubmit={changePassword} className="space-y-3">
            <Field label="Current password"><Input required type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" hint="Minimum 12 characters, mixed types."><Input required type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><Input required type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <Button type="submit">Update password</Button>
          </form>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Active sessions</h2>
          <DataTable
            rows={sessions}
            empty="No active sessions."
            columns={[
              { key: 'created_at', label: 'Started', render: (s) => fmt.dateTime(s.created_at) },
              { key: 'ip', label: 'IP', render: (s) => <span className="text-[12px] text-slate-400">{s.ip || '—'}</span> },
              { key: 'user_agent', label: 'Device', render: (s) => <span className="line-clamp-1 max-w-[28ch] text-[11px] text-slate-500">{s.user_agent || 'unknown'}</span> },
              { key: 'current', label: '', render: (s) => (s.current ? <Badge tone="green">this device</Badge> : null) },
              { key: 'actions', label: '', render: (s) => (!s.current && !s.revoked_at ? <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>Revoke</Button> : null) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

export function NotificationsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/portal/notifications')
      .then((d) => setRows(d.notifications || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAll = async () => {
    await api.post('/portal/notifications/read', { id: 'all' }).catch(() => {});
    load();
  };

  return (
    <div>
      <PageHeader title="Notifications" description="Account and workflow notifications addressed to you." actions={<Button variant="ghost" onClick={markAll}>Mark all read</Button>} />
      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState icon="bell" title="No notifications" /> : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={`p-4 ${n.is_read ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-white">{n.title}</p>
                  {n.body && <p className="mt-1 text-[12.5px] leading-relaxed text-mist">{n.body}</p>}
                </div>
                <span className="whitespace-nowrap text-[11px] text-slate-500">{fmt.dateTime(n.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Workflows (founder view)
 * ------------------------------------------------------------------ */
export function WorkflowsPage() {
  const wf = useResource('workflows');
  const runs = useResource('workflow_runs', { limit: 15 });
  return (
    <div>
      <PageHeader title="Workflows" description="Triggers, definitions and the execution history for each automation." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Definitions</h2>
          {wf.loading ? <Spinner /> : (
            <DataTable
              rows={wf.rows}
              empty="No workflows."
              columns={[
                { key: 'name', label: 'Workflow', render: (w) => <span className="text-[13px] text-white">{w.name}</span> },
                { key: 'trigger', label: 'Trigger', render: (w) => <Badge tone="cyan">{w.trigger}</Badge> },
                { key: 'enabled', label: 'Status', render: (w) => <StatusPill value={w.enabled ? 'enabled' : 'disabled'} /> },
              ]}
            />
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent executions</h2>
          {runs.loading ? <Spinner /> : (
            <DataTable
              rows={runs.rows}
              empty="No runs recorded."
              columns={[
                { key: 'workflow', label: 'Workflow' },
                { key: 'status', label: 'Result', render: (r) => <StatusPill value={r.status} /> },
                { key: 'started_at', label: 'Started', render: (r) => fmt.dateTime(r.started_at) },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
