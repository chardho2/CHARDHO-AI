import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import SceneStage from '../three/SceneStage.jsx';
import { Badge, Button, Card, Counter, Icon, Reveal, SectionHeading } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const FALLBACK_TOOLS = [
  { key: 'chat', name: 'AI Chatbot', category: 'Chat', description: 'Conversational assistant with saved history.' },
  { key: 'writer', name: 'AI Writing', category: 'Writing', description: 'Draft, rewrite and summarise copy.' },
  { key: 'coder', name: 'AI Coding', category: 'Code', description: 'Explain, refactor and generate code.' },
  { key: 'image', name: 'AI Images', category: 'Media', description: 'Create brand-ready visuals from prompts.' },
  { key: 'pdf', name: 'AI PDF Assistant', category: 'Documents', description: 'Ask questions about your documents.' },
  { key: 'site-builder', name: 'Website Builder', category: 'Build', description: 'Generate landing pages from a brief.' },
];

const FALLBACK_AGENTS = [
  { key: 'growth-strategist', name: 'Growth Strategist', description: 'Multi-channel acquisition plans with budget estimates.' },
  { key: 'support-copilot', name: 'Support Copilot', description: 'Drafts support replies in your tone of voice.' },
  { key: 'code-reviewer', name: 'Code Reviewer', description: 'Reviews changes for security and clarity.' },
  { key: 'market-researcher', name: 'Market Researcher', description: 'Structured competitor and market briefs.' },
];

const PORTALS = [
  { route: '/founder', name: 'Founder', icon: 'shield', desc: 'Complete ownership: permissions, models, cost and backups.', tone: 'from-cyan-400/20' },
  { route: '/super-admin', name: 'Super Admin', icon: 'settings', desc: 'System settings, AI models, moderation and monitoring.', tone: 'from-violet-500/20' },
  { route: '/manager', name: 'Manager', icon: 'users', desc: 'Staff, tasks, attendance, approvals and team analytics.', tone: 'from-blue-500/20' },
  { route: '/staff', name: 'Staff', icon: 'tasks', desc: 'Assigned work, attendance, reports and leave requests.', tone: 'from-emerald-400/20' },
  { route: '/developer', name: 'Developer', icon: 'terminal', desc: 'API keys, webhooks, logs, deployments and sandbox.', tone: 'from-amber-400/20' },
  { route: '/app', name: 'AI User', icon: 'sparkles', desc: 'Every free AI tool, agents, files and chat history.', tone: 'from-cyan-400/20' },
  { route: '/support', name: 'Support', icon: 'ticket', desc: 'Tickets, priorities, assignment and resolution history.', tone: 'from-rose-400/20' },
];

function TiltCard({ children, className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const onMove = (e) => {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateY(-4px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`transition-transform duration-300 will-change-transform ${className}`}
    >
      {children}
    </div>
  );
}

function StatStrip() {
  const [stats, setStats] = useState([
    { label: 'Registered users', value: 0, suffix: '+' },
    { label: 'AI requests served', value: 0, suffix: '+' },
    { label: 'Free AI tools', value: 9, suffix: '' },
    { label: 'Specialist agents', value: 5, suffix: '' },
  ]);

  useEffect(() => {
    api.get('/public/stats').then((d) => d?.stats && setStats(d.stats)).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.06}>
          <div className="glass rounded-xl px-4 py-3.5">
            <p className="text-xl font-semibold text-white sm:text-2xl">
              <Counter value={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">{s.label}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export default function Home() {
  const heroRef = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 110]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0.15]);

  const [tools, setTools] = useState(FALLBACK_TOOLS);
  const [agents, setAgents] = useState(FALLBACK_AGENTS);

  useEffect(() => {
    api.get('/public/tools').then((d) => d?.tools?.length && setTools(d.tools.slice(0, 6))).catch(() => {});
    api.get('/public/agents').then((d) => d?.agents?.length && setAgents(d.agents.slice(0, 4))).catch(() => {});
  }, []);

  return (
    <div>
      {/* ------------------------------- hero ------------------------------ */}
      <section ref={heroRef} className="relative min-h-[92svh] overflow-hidden">
        <SceneStage />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/[0.07] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
                </span>
                CHARDHO LLP · AI platform v0.1
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.2rem]">
                One platform for
                <span className="grad-text"> agents, automation </span>
                and every AI tool your team needs.
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-[15px] leading-relaxed text-slate-300 sm:text-base">
                CHARDHO AI unifies a conversational workspace, specialist agents and marketing automation behind seven
                isolated portals — each with its own dashboard, permissions and audit trail. The free tier stays free,
                governed by transparent fair-use limits.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start free <Icon name="arrow" size={16} />
                  </Button>
                </Link>
                <Link to="/ai-tools">
                  <Button variant="ghost" size="lg" className="w-full sm:w-auto">
                    <Icon name="sparkles" size={16} /> Explore the AI tools
                  </Button>
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.26}>
              <div className="mt-10">
                <StatStrip />
              </div>
            </Reveal>
          </div>
        </motion.div>

        <div className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1.5 text-[10px] uppercase tracking-[0.24em] text-slate-500 sm:flex">
          Scroll
          <span className="h-8 w-px bg-gradient-to-b from-cyan-300/70 to-transparent" />
        </div>
      </section>

      {/* ------------------------------ tools ------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          eyebrow="Free AI workspace"
          title={<>Nine tools, one workspace, <span className="grad-text">zero cost</span></>}
          description="Chat, writing, code, images, documents, site building and project management live in a single signed-in workspace with saved history."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, i) => (
            <Reveal key={tool.key} delay={i * 0.05}>
              <TiltCard>
                <Card hover className="group relative h-full overflow-hidden p-5">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/10 blur-2xl transition group-hover:bg-cyan-400/20" />
                  <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-cyan-200">
                    <Icon name={['chat', 'doc', 'code', 'image', 'layers', 'globe'][i % 6]} size={18} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">{tool.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist">{tool.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge tone="cyan">{tool.category}</Badge>
                    <span className="text-[11px] text-emerald-300">Free tier</span>
                  </div>
                </Card>
              </TiltCard>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/ai-tools" className="inline-flex items-center gap-1.5 text-sm text-cyan-300 hover:text-cyan-200">
            See every tool and its fair-use limit <Icon name="arrow" size={14} />
          </Link>
        </div>
      </section>

      {/* ----------------------------- portals ----------------------------- */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Seven isolated portals"
            title={<>Every role gets its own <span className="grad-text">front door</span></>}
            description="One secure login, then an automatic redirect to the portal your role owns. Permissions are enforced on the server for every request — the frontend is only a convenience."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PORTALS.map((p, i) => (
              <Reveal key={p.route} delay={i * 0.04}>
                <Link to={p.route} className="block h-full">
                  <Card hover className="group relative h-full overflow-hidden p-5">
                    <div className={`pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b ${p.tone} to-transparent opacity-60 blur-2xl`} />
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-lg border border-white/10 bg-white/[0.05] p-2 text-cyan-100">
                        <Icon name={p.icon} size={17} />
                      </span>
                      <code className="rounded-md bg-black/40 px-2 py-1 text-[11px] text-slate-400">{p.route}</code>
                    </div>
                    <h3 className="text-[15px] font-semibold">{p.name}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-mist">{p.desc}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-cyan-300 opacity-0 transition group-hover:opacity-100">
                      Open portal <Icon name="arrow" size={12} />
                    </span>
                  </Card>
                </Link>
              </Reveal>
            ))}
            <Reveal delay={0.3}>
              <Card className="flex h-full flex-col justify-center border-dashed p-5 text-center">
                <p className="text-sm font-medium text-white">Role-based access</p>
                <p className="mt-1.5 text-[13px] text-mist">Staff can never see the Founder or Admin portals, by design.</p>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------ agents ----------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Specialist agents"
              title={<>Deploy an agent that <span className="grad-text">already knows the job</span></>}
              description="Each agent carries its own system prompt, model binding and usage accounting. Run one from the workspace or call it through the developer API."
            />
            <div className="mt-8 space-y-3">
              {agents.map((a, i) => (
                <Reveal key={a.key} delay={i * 0.05}>
                  <div className="glass flex items-start gap-3.5 rounded-xl p-4">
                    <span className="mt-0.5 rounded-lg bg-violet-500/15 p-2 text-violet-200">
                      <Icon name="sparkles" size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{a.name}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-mist">{a.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.1}>
            <Card className="relative overflow-hidden p-6">
              <div className="mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-[11px] text-slate-400">workspace · growth-strategist</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-400/10 px-3.5 py-2.5 text-cyan-50">
                  Plan a 30-day launch for a bakery in Kandukur.
                </div>
                <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-3 text-slate-200">
                  <p className="mb-2 font-medium text-white">A four-week sequence you can act on today</p>
                  <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-300">
                    <li>• Week 1 — foundation and a single success metric</li>
                    <li>• Week 2 — validation with ten real customers</li>
                    <li>• Week 3 — two distribution channels, no more</li>
                    <li>• Week 4 — compounding content and a re-measure</li>
                  </ul>
                  <p className="mt-2 text-[11px] text-slate-500">Answered by the local CHARDHO engine</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[13px] text-slate-500">
                Ask a follow-up…
                <span className="ml-auto rounded-lg bg-white/10 px-2 py-1 text-[11px] text-slate-300">Send</span>
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- security ---------------------------- */}
      <section className="relative py-20 sm:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/[0.04] to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="Security by construction"
            title={<>Permissions checked on the server, <span className="grad-text">every single time</span></>}
            description="Frontend role hints are never trusted. Route guards are a convenience; the API is the boundary."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: 'lock', title: 'Centralised sessions', body: 'HttpOnly, SameSite cookies with server-side revocation and expiry.' },
              { icon: 'shield', title: 'TOTP two-factor', body: 'Mandatory for Founder, Admin, Manager, Developer and Support roles.' },
              { icon: 'key', title: 'Hashed API keys', body: 'Keys are shown once, stored as hashes, and revocable at any time.' },
              { icon: 'doc', title: 'Audit trail', body: 'Every administrative action is recorded with actor, entity and IP.' },
              { icon: 'users', title: 'Portal isolation', body: 'A staff session is rejected by the Founder and Admin portals.' },
              { icon: 'alert', title: 'No public admin signup', body: 'Registration can only ever create a Free User account.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 0.05}>
                <Card className="h-full p-5" hover>
                  <span className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-cyan-200">
                    <Icon name={f.icon} size={17} />
                  </span>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-mist">{f.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- CTA ------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <Reveal>
          <div className="glass grad-border relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
            <h2 className="relative text-balance text-3xl font-semibold sm:text-4xl">
              Start with the free tier. <span className="grad-text">Scale when you are ready.</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-300">
              Create a free account, open the AI workspace, and invite the rest of your team when the work justifies it.
              No card required, and no paid AI provider is enabled without the Owner's approval.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register"><Button size="lg">Create free account</Button></Link>
              <Link to="/contact"><Button variant="ghost" size="lg">Talk to the team</Button></Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
