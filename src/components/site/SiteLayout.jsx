import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Icon } from '../ui.jsx';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/ai-tools', label: 'AI Tools' },
  { to: '/ai-agents', label: 'AI Agents' },
  { to: '/automation', label: 'Automation' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/features', label: 'Features' },
  { to: '/documentation', label: 'Docs' },
];

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="CHARDHO AI home">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 shadow-[0_0_22px_-6px_rgba(34,211,238,0.9)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-950" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3Z" />
          <path d="M12 8.2l3.4 2v3.6L12 15.8l-3.4-2v-3.6L12 8.2Z" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight text-white">CHARDHO <span className="grad-text">AI</span></span>
          <span className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-500">CHARDHO LLP</span>
        </span>
      )}
    </Link>
  );
}

function SiteNav() {
  const { user, status } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${scrolled ? 'py-2' : 'py-3.5'}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <nav
          className={`glass flex items-center justify-between rounded-2xl px-3.5 py-2.5 transition-shadow ${
            scrolled ? 'shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]' : ''
          }`}
          aria-label="Main"
        >
          <Logo />

          <ul className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-[13px] transition ${
                      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            {status === 'authenticated' && user ? (
              <Link
                to="/portal"
                className="hidden items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-3.5 py-2 text-[13px] font-semibold text-slate-950 sm:inline-flex"
              >
                <Icon name="grid" size={15} /> {user.portal === 'app' ? 'My workspace' : 'My portal'}
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden rounded-lg px-3 py-2 text-[13px] text-slate-300 hover:text-white sm:block">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-3.5 py-2 text-[13px] font-semibold text-slate-950 shadow-[0_10px_30px_-12px_rgba(34,211,238,0.8)] sm:inline-flex"
                >
                  Start free <Icon name="arrow" size={14} />
                </Link>
              </>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={open}
            >
              <Icon name={open ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="glass-strong mt-2 overflow-hidden rounded-2xl p-2 lg:hidden"
            >
              <ul className="grid grid-cols-2 gap-1">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }) =>
                        `block rounded-lg px-3 py-2.5 text-sm ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.06]'}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
                <Link to="/login" className="rounded-lg bg-white/[0.06] px-3 py-2.5 text-center text-sm text-white">Sign in</Link>
                <Link to="/register" className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-2.5 text-center text-sm font-semibold text-slate-950">
                  Start free
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

function SiteFooter() {
  const groups = [
    {
      title: 'Platform',
      links: [
        ['AI Tools', '/ai-tools'], ['AI Agents', '/ai-agents'], ['Automation', '/automation'],
        ['Marketplace', '/marketplace'], ['Features', '/features'],
      ],
    },
    {
      title: 'Company',
      links: [['About', '/about'], ['Solutions', '/solutions'], ['Documentation', '/documentation'], ['Contact', '/contact']],
    },
    {
      title: 'Legal',
      links: [['Privacy Policy', '/privacy'], ['Terms & Conditions', '/terms'], ['Disclaimer', '/disclaimer']],
    },
  ];

  return (
    <footer className="relative mt-24 border-t border-white/10 bg-ink-2/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist">
              A free, all-in-one AI agent and marketing automation platform built by CHARDHO LLP. Seven isolated
              portals, server-side permissions and a 3D-first interface.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Server-side RBAC', 'TOTP 2FA', 'Audit logs'].map((t) => (
                <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">
                  {t}
                </span>
              ))}
            </div>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{g.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {g.links.map(([label, to]) => (
                  <li key={to}>
                    <Link to={to} className="text-sm text-slate-400 transition hover:text-cyan-200">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} CHARDHO LLP. All rights reserved.</p>
          <p>
            Free tier subject to fair-use limits. Portal URLs become active once the platform is deployed.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function SiteLayout() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.10),transparent_55%)]" />
      <SiteNav />
      <main className="pt-24">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
