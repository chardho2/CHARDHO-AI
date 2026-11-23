import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { api, fmt } from '../lib/api.js';
import { Badge, Card, Counter, Donut, EmptyState, Icon, MiniBars, Sparkline, Spinner, StatusPill } from '../components/ui.jsx';
import { PageHeader } from './PortalShell.jsx';

function Panel({ title, subtitle, children, action }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default function Dashboard({ portalKey }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.get(`/portal/${portalKey}/dashboard`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [portalKey]);

  if (error) {
    return (
      <>
        <PageHeader title="Overview" />
        <Card className="p-6 text-sm text-rose-200">
          {error}
          {error.toLowerCase().includes('two-factor') && (
            <Link to="/login" className="ml-2 underline">Complete two-factor setup</Link>
          )}
        </Card>
      </>
    );
  }
  if (!data) return <Spinner label="Building your dashboard" />;

  const t = data.totals || {};
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`}
        description={`${user?.roleName} view · ${data.countryMix ? 'live platform data' : 'your workspace'}`}
        actions={<Badge tone="cyan"><Icon name="clock" size={11} /> {fmt.date(new Date())}</Badge>}
      />

      {/* primary metrics */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kind === 'app' ? (
          <>
            <Metric label="Requests today" value={data.myUsage?.requests || 0} icon="zap" tone="cyan" />
            <Metric label="Tokens used" value={fmt.compact(data.myUsage?.tokens || 0)} icon="chart" tone="violet" />
            <Metric label="Saved conversations" value={data.conversations?.length || 0} icon="chat" tone="blue" />
            <Metric label="Tools available" value={data.tools?.length || 0} icon="sparkles" tone="green" />
          </>
        ) : data.kind === 'staff' ? (
          <>
            <Metric label="My open tasks" value={data.myTasks?.filter((x) => x.status !== 'done').length || 0} icon="tasks" tone="cyan" />
            <Metric label="Requests this week" value={data.myUsage?.requests || 0} icon="zap" tone="violet" />
            <Metric label="Leave balance" value={`${data.leaveBalance} days`} icon="clock" tone="blue" />
            <Metric label="Unread notices" value={data.notifications?.length || 0} icon="bell" tone="green" />
          </>
        ) : (
          <>
            <Metric label="Registered users" value={<Counter value={t.users} />} icon="users" tone="cyan" hint={`${t.activeUsers} active this week`} />
            <Metric label="AI requests (7d)" value={<Counter value={t.requests7d} />} icon="zap" tone="violet" trend={t.growth} />
            <Metric label="Open tickets" value={t.openTickets} icon="ticket" tone="blue" />
            <Metric label="Live sessions" value={t.liveSessions} icon="server" tone="green" hint="Active now" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-4 lg:col-span-2">
          {data.dailyUsage?.length > 0 && (
            <Panel
              title="Request volume"
              subtitle="Last 14 days"
              action={<Badge tone="green"><Icon name="chart" size={10} /> {fmt.number(t.requests7d)} this week</Badge>}
            >
              <MiniBars data={data.dailyUsage} valueKey="requests" labelKey="day" height={140} />
            </Panel>
          )}

          {data.kind === 'staff' && (
            <Panel title="My tasks" subtitle="Sorted by status and due date"
              action={<Link to="tasks" className="text-[11px] text-cyan-300 hover:text-cyan-200">Open board →</Link>}>
              {data.myTasks?.length ? (
                <ul className="space-y-2">
                  {data.myTasks.slice(0, 6).map((task) => (
                    <li key={task.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                      <StatusPill value={task.status} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{task.title}</span>
                      <span className="hidden text-[11px] text-slate-500 sm:block">{fmt.date(task.due_date)}</span>
                      <span className="w-16">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${task.progress}%` }} />
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No tasks assigned" description="Your manager will assign work here." />}
            </Panel>
          )}

          {data.kind === 'manager' && (
            <>
              <Panel title="Task distribution" subtitle="Across the whole team">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Donut data={data.taskSummary || []} />
                  <div className="space-y-2">
                    {data.myTasks?.map((task) => (
                      <div key={task.id} className="rounded-lg border border-white/[0.07] px-3 py-2">
                        <p className="truncate text-[13px] text-slate-200">{task.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusPill value={task.status} />
                          <StatusPill value={task.priority} />
                        </div>
                      </div>
                    ))}
                    {!data.myTasks?.length && <p className="text-[13px] text-slate-500">No personal tasks.</p>}
                  </div>
                </div>
              </Panel>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Pending approvals" value={data.pendingApprovals} icon="check" tone="violet" />
                <Metric label="Checked in today" value={data.attendanceToday} icon="clock" tone="cyan" />
                <Metric label="Open tickets" value={data.openTickets} icon="ticket" tone="blue" />
              </div>
            </>
          )}

          {data.kind === 'developer' && (
            <>
              <Panel title="Recent errors" subtitle="Newest first"
                action={<Link to="logs" className="text-[11px] text-cyan-300">All logs →</Link>}>
                {data.recentErrors?.length ? (
                  <ul className="space-y-1.5">
                    {data.recentErrors.map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] px-3 py-2">
                        <StatusPill value={e.level} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-slate-200">{e.message}</p>
                          <p className="text-[11px] text-slate-500">{e.source} · {fmt.dateTime(e.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyState title="No errors logged" />}
              </Panel>
              <Panel title="Deployments">
                <ul className="space-y-2">
                  {data.deployments?.map((d, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2">
                      <StatusPill value={d.status} />
                      <span className="text-[13px] text-slate-200">{d.version}</span>
                      <span className="text-[11px] text-slate-500">{d.environment}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{fmt.dateTime(d.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )}

          {data.kind === 'support' && (
            <Panel title="Live queue" subtitle="Prioritised by urgency"
              action={<Link to="tickets" className="text-[11px] text-cyan-300">All tickets →</Link>}>
              {data.queue?.length ? (
                <div className="space-y-2">
                  {data.queue.map((ticket) => (
                    <div key={ticket.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2.5">
                      <span className="text-[11px] text-slate-500">#{ticket.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">{ticket.subject}</span>
                      <StatusPill value={ticket.priority} />
                      <StatusPill value={ticket.status} />
                      <span className="text-[11px] text-slate-500">{ticket.requester || 'Website'}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="Queue is clear" icon="check" />}
            </Panel>
          )}

          {data.kind === 'app' && (
            <>
              <Panel title="Your AI tools" subtitle="Tap any tool to open the workspace"
                action={<Link to="chat" className="text-[11px] text-cyan-300">Open chat →</Link>}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.tools?.map((tool) => (
                    <Link key={tool.key} to={tool.key === 'image' ? 'tools' : 'chat'} className="group rounded-xl border border-white/[0.07] px-3 py-2.5 transition hover:border-cyan-300/30 hover:bg-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] text-slate-200">{tool.name}</p>
                        <Badge tone="cyan">{tool.free_limit_daily}/day</Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{tool.description}</p>
                    </Link>
                  ))}
                </div>
              </Panel>
              {data.conversations?.length > 0 && (
                <Panel title="Recent conversations" action={<Link to="history" className="text-[11px] text-cyan-300">History →</Link>}>
                  <ul className="space-y-1.5">
                    {data.conversations.map((c) => (
                      <li key={c.id}>
                        <Link to={`chat?c=${c.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-slate-300 hover:bg-white/[0.05]">
                          <Icon name="chat" size={14} className="text-cyan-300/70" />
                          <span className="truncate">{c.title}</span>
                          <span className="ml-auto text-[11px] text-slate-500">{fmt.date(c.updated_at)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </>
          )}

          {(data.kind === 'founder' || data.kind === 'super-admin') && (
            <Panel title="Recent administrative activity" subtitle="From the audit log"
              action={<Link to="audit" className="text-[11px] text-cyan-300">Full log →</Link>}>
              {data.recentActivity?.length ? (
                <ul className="space-y-1.5">
                  {data.recentActivity.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2 text-[12.5px]">
                      <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-cyan-200">{a.action}</code>
                      <span className="text-slate-400">{a.actor_email || 'system'}</span>
                      {a.entity && <span className="text-slate-600">· {a.entity}</span>}
                      <span className="ml-auto text-[11px] text-slate-500">{fmt.dateTime(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No activity recorded yet" />}
            </Panel>
          )}
        </div>

        {/* side column */}
        <div className="space-y-4">
          {data.kind === 'founder' || data.kind === 'super-admin' ? (
            <>
              <Panel title="Requests by tool" subtitle="Last 30 days">
                <Donut data={data.toolUsage || []} />
              </Panel>
              <Panel title="Users by role">
                <Donut data={data.roleSplit || []} size={132} thickness={16} />
              </Panel>
              <Panel title="AI providers"
                action={<Link to="providers" className="text-[11px] text-cyan-300">Manage →</Link>}>
                <ul className="space-y-1.5">
                  {data.providers?.map((p) => (
                    <li key={p.slug} className="flex items-center gap-2 text-[12.5px]">
                      <span className={`h-1.5 w-1.5 rounded-full ${p.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span className="text-slate-300">{p.name}</span>
                      {p.is_paid ? <Badge tone="amber">paid</Badge> : <Badge tone="green">free</Badge>}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  Paid providers stay disabled until the Owner approves them.
                </p>
              </Panel>
            </>
          ) : (
            <Panel title="This week" subtitle="Request trend">
              <Sparkline data={(data.dailyUsage || []).map((d) => ({ value: d.requests }))} height={70} />
              <div className="mt-3 space-y-2 text-[12.5px]">
                <div className="flex justify-between text-slate-400"><span>Requests</span><span className="text-white">{fmt.number(t.requests7d)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Tokens</span><span className="text-white">{fmt.compact(t.tokens7d)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Growth</span><span className={t.growth >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{t.growth}%</span></div>
              </div>
            </Panel>
          )}

          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              {(data.kind === 'founder' || data.kind === 'super-admin'
                ? [['Add a user', 'users'], ['Permissions', 'permissions'], ['Audit log', 'audit'], ['Backups', 'backups']]
                : data.kind === 'developer'
                  ? [['New API key', 'keys'], ['Sandbox', 'sandbox'], ['Error logs', 'logs'], ['Deployments', 'deployments']]
                  : data.kind === 'staff'
                    ? [['My tasks', 'tasks'], ['Attendance', 'attendance'], ['Reports', 'reports'], ['Profile', 'profile']]
                    : data.kind === 'manager'
                      ? [['Tasks', 'tasks'], ['Team', 'staff'], ['Reports', 'reports'], ['Tickets', 'tickets']]
                      : data.kind === 'support'
                        ? [['Tickets', 'tickets'], ['Customers', 'users'], ['Reports', 'reports'], ['Profile', 'profile']]
                        : [['Open chat', 'chat'], ['Image studio', 'tools'], ['History', 'history'], ['Usage', 'usage']]
              ).map(([label, to]) => {
                if (['permissions', 'backups'].includes(to) && user?.role !== 'founder') return null;
                return (
                  <Link key={to} to={to} className="rounded-lg border border-white/[0.08] px-2.5 py-2 text-center text-[12px] text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/[0.05] hover:text-white">
                    {label}
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel title="Security posture">
            <ul className="space-y-2 text-[12.5px]">
              <li className="flex items-center gap-2 text-slate-300">
                <Icon name={user?.totpEnabled ? 'check' : 'alert'} size={14} className={user?.totpEnabled ? 'text-emerald-300' : 'text-amber-300'} />
                Two-factor {user?.totpEnabled ? 'enabled' : 'not enabled'}
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Icon name="check" size={14} className="text-emerald-300" />
                Server-side permissions enforced
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                <Icon name="check" size={14} className="text-emerald-300" />
                Sessions expire automatically
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon, tone = 'cyan', hint, trend }) {
  const tones = {
    cyan: 'from-cyan-400/20 to-transparent text-cyan-200',
    violet: 'from-violet-500/20 to-transparent text-violet-200',
    blue: 'from-blue-500/20 to-transparent text-blue-200',
    green: 'from-emerald-400/20 to-transparent text-emerald-200',
  };
  return (
    <Card className="relative overflow-hidden p-4" hover>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${tones[tone]} blur-2xl`} />
      <div className="flex items-start justify-between">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <span className={`rounded-lg bg-white/[0.06] p-1.5 ${tones[tone].split(' ').pop()}`}><Icon name={icon} size={14} /></span>
      </div>
      <p className="mt-2.5 text-xl font-semibold text-white">{value}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {trend !== undefined && trend !== null && (
          <span className={trend >= 0 ? 'text-[11px] text-emerald-300' : 'text-[11px] text-rose-300'}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
    </Card>
  );
}
