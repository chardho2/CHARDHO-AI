import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/* ------------------------------- icons -------------------------------- */
const PATHS = {
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm13 18v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  tasks: 'M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  ticket: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7Z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Zm-1.5 9.5l3 3 4.5-4.5',
  key: 'M15 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2.8 5.2L3 21m3-3l2 2m0-5l2 2',
  terminal: 'M4 5h16v14H4V5Zm3 4l3 3-3 3m6 0h4',
  chart: 'M4 20V10m5 10V4m5 16v-7m5 7V8',
  chat: 'M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a8 8 0 0 0-3-1.7L14 2h-4l-.4 2.5a8 8 0 0 0-3 1.7l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 3.6l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 3 1.7L10 22h4l.4-2.5a8 8 0 0 0 3-1.7l2.4 1 2-3.4-2-1.6c.1-.6.2-1.2.2-1.8Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2l-4.35-4.35',
  check: 'M20 6L9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm7 10l.9 2.4L22 16l-2.1.6L19 19l-.9-2.4L16 16l2.1-.6L19 13Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.4 4-5.6 4-9s-1.5-6.6-4-9c-2.5 2.4-4 5.6-4 9s1.5 6.6 4 9ZM3 12h18',
  box: 'M21 8.5L12 3 3 8.5v7L12 21l9-5.5v-7ZM12 12l9-5.5M12 12v9M12 12L3 6.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0Z',
  code: 'M8 18l-5-6 5-6m8 12l5-6-5-6',
  server: 'M4 4h16v6H4V4Zm0 10h16v6H4v-6Zm3-7h.01M7 17h.01',
  image: 'M4 5h16v14H4V5Zm3 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 10l-5-6-4 5-2-2-3 3',
  lock: 'M6 11h12v9H6v-9Zm3 0V8a3 3 0 0 1 6 0v3',
  arrow: 'M5 12h14m-6-6l6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  doc: 'M6 3h8l4 4v14H6V3Zm8 0v4h4M9 13h6M9 17h6',
  layers: 'M12 3l9 5-9 5-9-5 9-5Zm9 9l-9 5-9-5m18 4l-9 5-9-5',
  zap: 'M13 2L4 14h6l-1 8 9-12h-6l1-8Z',
  mail: 'M4 5h16v14H4V5Zm0 1l8 6 8-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 9a8 8 0 0 0-16 0',
  logoutAlt: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5m5 5H3',
};

export function Icon({ name, size = 18, className = '', ...rest }) {
  const d = PATHS[name] || PATHS.grid;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

/* ------------------------------ buttons ------------------------------- */
const BUTTON_STYLES = {
  primary:
    'bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 text-slate-950 font-semibold shadow-[0_10px_40px_-12px_rgba(34,211,238,0.75)] hover:brightness-110',
  ghost: 'border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.09]',
  subtle: 'bg-white/[0.07] text-white hover:bg-white/[0.12]',
  danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/30 hover:bg-rose-500/25',
  link: 'text-cyan-300 hover:text-cyan-200 underline underline-offset-4',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-sm rounded-xl',
};

export function Button({ variant = 'primary', size = 'md', className = '', loading, children, ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${BUTTON_SIZES[size]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-white/8 text-slate-200 border-white/10',
    cyan: 'bg-cyan-400/12 text-cyan-200 border-cyan-300/25',
    violet: 'bg-violet-500/14 text-violet-200 border-violet-300/25',
    green: 'bg-emerald-400/12 text-emerald-200 border-emerald-300/25',
    amber: 'bg-amber-400/12 text-amber-200 border-amber-300/25',
    rose: 'bg-rose-500/12 text-rose-200 border-rose-300/25',
    blue: 'bg-blue-500/12 text-blue-200 border-blue-300/25',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone] || tones.neutral} ${className}`}>
      {children}
    </span>
  );
}

const STATUS_TONES = {
  active: 'green', done: 'green', resolved: 'green', success: 'green', present: 'green', enabled: 'green', verified: 'green',
  open: 'cyan', todo: 'cyan', in_progress: 'blue', running: 'blue', review: 'violet', pending: 'amber', late: 'amber',
  blocked: 'rose', urgent: 'rose', suspended: 'rose', failed: 'rose', error: 'rose', closed: 'neutral', disabled: 'neutral',
};

export function StatusPill({ value }) {
  const key = String(value ?? '').toLowerCase();
  return <Badge tone={STATUS_TONES[key] || 'neutral'}>{String(value ?? '—').replace(/_/g, ' ')}</Badge>;
}

/* ------------------------------- layout ------------------------------- */
export function Card({ className = '', children, hover = false, ...rest }) {
  return (
    <div className={`glass rounded-2xl ${hover ? 'card-hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, align = 'center', className = '' }) {
  return (
    <div className={`${align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'} ${className}`}>
      {eyebrow && (
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200/90">
          {eyebrow}
        </span>
      )}
      <h2 className="text-balance text-3xl font-semibold sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-pretty text-[15px] leading-relaxed text-mist">{description}</p>}
    </div>
  );
}

/* ------------------------------- inputs ------------------------------- */
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-rose-300">{error}</span>}
    </label>
  );
}

const INPUT_CLASS =
  'w-full rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 transition focus:border-cyan-300/50 focus:bg-white/[0.06] focus:outline-none';

export const Input = ({ className = '', ...rest }) => <input className={`${INPUT_CLASS} ${className}`} {...rest} />;
export const Textarea = ({ className = '', ...rest }) => <textarea className={`${INPUT_CLASS} min-h-28 resize-y ${className}`} {...rest} />;
export const Select = ({ className = '', children, ...rest }) => (
  <select className={`${INPUT_CLASS} appearance-none bg-ink-2 ${className}`} {...rest}>
    {children}
  </select>
);

export function Alert({ tone = 'cyan', title, children, className = '' }) {
  const tones = {
    cyan: 'border-cyan-300/25 bg-cyan-400/8 text-cyan-100',
    rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
    amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
    green: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  };
  return (
    <div className={`rounded-xl border px-3.5 py-3 text-sm ${tones[tone]} ${className}`} role={tone === 'rose' ? 'alert' : 'status'}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-1 opacity-90' : 'opacity-90'}>{children}</div>}
    </div>
  );
}

/* ------------------------------- states ------------------------------- */
export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-mist">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
      {label || 'Loading…'}
    </div>
  );
}

export function EmptyState({ icon = 'box', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 px-6 py-12 text-center">
      <div className="mb-3 rounded-xl bg-white/[0.05] p-2.5 text-cyan-200/80">
        <Icon name={icon} size={22} />
      </div>
      <p className="font-medium text-slate-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-mist">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------- table ------------------------------- */
export function DataTable({ columns, rows, empty = 'Nothing to show yet.', rowKey = (r) => r.id }) {
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- modal ------------------------------- */
export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className={`glass-strong w-full ${width} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl`}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------- motion & counters -------------------------- */
export function Reveal({ children, delay = 0, y = 22, className = '' }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({ value, suffix = '', duration = 1400, className = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return undefined;
    }
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(value * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {new Intl.NumberFormat('en-IN').format(display)}
      {suffix}
    </span>
  );
}

export function StatCard({ label, value, hint, icon = 'chart', tone = 'cyan', trend }) {
  const tones = {
    cyan: 'from-cyan-400/20 to-transparent text-cyan-200',
    violet: 'from-violet-500/20 to-transparent text-violet-200',
    blue: 'from-blue-500/20 to-transparent text-blue-200',
    green: 'from-emerald-400/20 to-transparent text-emerald-200',
  };
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5" hover>
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tones[tone]} blur-2xl`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <span className={`rounded-lg bg-white/[0.06] p-1.5 ${tones[tone].split(' ').pop()}`}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend !== undefined && trend !== null && (
          <span className={trend >= 0 ? 'text-xs text-emerald-300' : 'text-xs text-rose-300'}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
    </Card>
  );
}

/* ------------------------------- charts ------------------------------- */
export function MiniBars({ data = [], height = 120, valueKey = 'value', labelKey = 'label' }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  if (!data.length) return <EmptyState title="No data for this period" />;
  return (
    <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        return (
          <div key={`${d[labelKey]}-${i}`} className="group relative flex-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-cyan-500/30 via-cyan-400/60 to-violet-400/80 transition-all group-hover:from-cyan-400/60 group-hover:to-violet-300"
              style={{ height: `${Math.max((v / max) * height, 3)}px` }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[10px] text-white group-hover:block">
              {String(d[labelKey] ?? '').slice(5)}: {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Donut({ data = [], size = 148, thickness = 18 }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (!total) return <EmptyState title="No data" />;
  const colors = ['#22d3ee', '#a855f7', '#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8'];
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart" className="shrink-0">
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = (Number(d.value) || 0) / total;
            const dash = frac * c;
            const el = (
              <circle
                key={d.label}
                r={r}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="fill-white" style={{ fontSize: 20, fontWeight: 600 }}>
          {total}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
          total
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-slate-300">
            <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="capitalize">{String(d.label).replace(/_/g, ' ')}</span>
            <span className="ml-auto text-slate-500">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ data = [], valueKey = 'value', height = 60, className = '' }) {
  if (data.length < 2) return null;
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const w = 260;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / Math.max(max - min, 1)) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className={`w-full ${className}`} preserveAspectRatio="none" role="img" aria-label="Trend">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${points} ${w},${height}`} fill="url(#spark)" />
    </svg>
  );
}
