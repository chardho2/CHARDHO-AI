import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Badge, Button, Icon } from '../components/ui.jsx';
import { api, fmt } from '../lib/api.js';
import { PORTALS, PORTAL_LIST, visibleNav } from './registry.js';

function PortalSwitcher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (user?.role !== 'founder') return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-cyan-200 hover:bg-white/[0.08]"
        aria-expanded={open}
      >
        <Icon name="shield" size={13} /> Master access
        <Icon name="arrow" size={11} />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-hidden="true" tabIndex={-1} />
          <div className="glass-strong absolute left-0 top-full z-20 mt-2 w-56 rounded-xl p-1.5">
            <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">Switch portal</p>
            {PORTAL_LIST.map((p) => (
              <Link
                key={p.key}
                to={p.route}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <Icon name={p.icon} size={13} /> {p.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const timer = useRef(null);

  const load = () => api.get('/portal/notifications').then(setData).catch(() => {});

  useEffect(() => {
    load();
    timer.current = setInterval(load, 60000);
    return () => clearInterval(timer.current);
  }, []);

  const markAll = async () => {
    await api.post('/portal/notifications/read', { id: 'all' }).catch(() => {});
    load();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ''}`}
      >
        <Icon name="bell" size={18} />
        {data.unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-hidden="true" tabIndex={-1} />
          <div className="glass-strong absolute right-0 top-full z-20 mt-2 w-80 rounded-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
              <p className="text-sm font-medium">Notifications</p>
              {data.unread > 0 && (
                <button onClick={markAll} className="text-[11px] text-cyan-300 hover:text-cyan-200">Mark all read</button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {data.notifications.length === 0 && <li className="px-3.5 py-6 text-center text-sm text-slate-500">Nothing yet.</li>}
              {data.notifications.map((n) => (
                <li key={n.id} className={`border-b border-white/[0.06] px-3.5 py-2.5 last:border-0 ${n.is_read ? 'opacity-60' : ''}`}>
                  <p className="text-[13px] font-medium text-white">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-[12px] leading-relaxed text-mist">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-slate-500">{fmt.dateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-white/[0.06]"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-[13px] font-semibold text-slate-950">
          {(user?.name || '?').slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] leading-tight text-white">{user?.name}</span>
          <span className="block text-[10px] uppercase tracking-wide text-slate-500">{user?.roleName}</span>
        </span>
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} aria-hidden="true" tabIndex={-1} />
          <div className="glass-strong absolute right-0 top-full z-20 mt-2 w-56 rounded-xl p-1.5">
            <div className="border-b border-white/10 px-2.5 py-2">
              <p className="truncate text-[13px] text-white">{user?.email}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{user?.roleName}</p>
            </div>
            <Link to="profile" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-300 hover:bg-white/10 hover:text-white">
              <Icon name="user" size={14} /> Profile & security
            </Link>
            <Link to="notifications" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-300 hover:bg-white/10 hover:text-white">
              <Icon name="bell" size={14} /> Notifications
            </Link>
            <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-slate-300 hover:bg-white/10 hover:text-white">
              <Icon name="globe" size={14} /> Public website
            </Link>
            <button onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-2.5 py-2 text-[13px] text-rose-300 hover:bg-rose-500/10">
              <Icon name="logout" size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function PortalShell({ portalKey }) {
  const { user, can } = useAuth();
  const portal = PORTALS[portalKey];
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  useEffect(() => setDrawer(false), [location.pathname]);

  if (!portal) return null;
  const nav = visibleNav(portal, can);
  const base = portal.route;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Link to="/" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-950" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3Z" />
            <path d="M12 8.2l3.4 2v3.6L12 15.8l-3.4-2v-3.6L12 8.2Z" />
          </svg>
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{portal.name} portal</p>
          <p className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500">CHARDHO AI</p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <PortalSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label={`${portal.name} navigation`}>
        {nav.map((item) => {
          const href = item.to ? `${base}/${item.to}` : base;
          const active = item.to
            ? location.pathname === href || location.pathname.startsWith(`${href}/`)
            : location.pathname === base || location.pathname === `${base}/`;
          return (
            <NavLink
              key={item.to || 'index'}
              to={href}
              end={!item.to}
              className="sidebar-link mb-0.5"
              data-active={active}
            >
              <Icon name={item.icon} size={16} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-[11px] font-semibold text-slate-950">
            {(user?.name || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-slate-500">{user?.roleName}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-ink">
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-[0.35]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_60%)]" />

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/[0.07] bg-ink-2/80 backdrop-blur-xl lg:block">
        {sidebar}
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-ink-2">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-ink/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
            <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Open menu">
              <Icon name="menu" size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-slate-400">{portal.tagline}</p>
            </div>
            {user?.requires2fa && !user?.twofaVerified && (
              <Badge tone="amber"><Icon name="alert" size={11} /> 2FA pending</Badge>
            )}
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* shared page header used by every portal page */
export function PageHeader({ title, description, actions, icon }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {icon && <Icon name={icon} size={20} className="text-cyan-300" />}
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-mist">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PortalGate({ permission, children }) {
  const { can } = useAuth();
  if (permission && !can(...(Array.isArray(permission) ? permission : [permission]))) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
        <p className="text-sm font-medium text-white">You do not have permission for this section</p>
        <p className="mt-1 text-[13px] text-mist">Ask the platform owner to grant it in the Roles &amp; permissions screen.</p>
        <Button variant="ghost" className="mt-4" onClick={() => window.history.back()}>Go back</Button>
      </div>
    );
  }
  return children;
}
