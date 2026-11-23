import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card, Field, Icon, Input, Reveal, SectionHeading, Textarea } from '../components/ui.jsx';
import { api } from '../lib/api.js';

/* ------------------------------ shared -------------------------------- */
function PageHero({ eyebrow, title, description, children }) {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.07] py-16 sm:py-20">
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}

function Prose({ children }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-14 text-[15px] leading-relaxed text-slate-300 sm:px-6 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-white">
      {children}
    </div>
  );
}

/* ------------------------------- about -------------------------------- */
export function About() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={<>Built by CHARDHO LLP to make AI <span className="grad-text">genuinely usable</span></>}
        description="We build small, practical software for businesses that need AI to do real work — not demos."
      />
      <Prose>
        <p>
          CHARDHO AI began as an internal answer to a simple problem: teams were paying for five AI subscriptions and
          still copying answers between them by hand. We built one platform where the tools, the agents and the
          operational records live together — and where the people responsible for each part only see the part they own.
        </p>
        <h2>What makes this different</h2>
        <p>
          Most AI platforms bolt a chat box onto a billing page. CHARDHO AI ships <strong>seven isolated portals</strong>{' '}
          — Founder, Super Admin, Manager, Staff, Developer, AI User and Support — each with a purpose-built dashboard.
          A staff member cannot reach the Founder portal even if they type the URL, because the API rejects the request
          independently of the interface.
        </p>
        <h2>Principles we hold</h2>
        <ul>
          <li><strong>Free stays free.</strong> The AI tool set is available on a fair-use basis, with limits the Owner can tune.</li>
          <li><strong>No silent spend.</strong> No paid provider is switched on without explicit Owner approval.</li>
          <li><strong>Server-side truth.</strong> Roles and permissions are verified on the backend for every call.</li>
          <li><strong>Readable code.</strong> A small team should be able to audit the whole thing.</li>
        </ul>
        <h2>Status</h2>
        <p>
          This repository is the working implementation: the 3D marketing site, the authentication and RBAC layer, the
          seven portal dashboards and the AI workspace all run from a single Node process with a SQLite database. Portal
          URLs become publicly reachable once the platform is deployed.
        </p>
      </Prose>
    </>
  );
}

/* ------------------------------ features ------------------------------- */
export function Features() {
  const groups = [
    { title: 'AI workspace', icon: 'sparkles', items: ['Chat with saved history', 'Writing and rewriting', 'Code explanation and generation', 'Image concepts', 'PDF and document Q&A', 'Website blueprints'] },
    { title: 'Automation', icon: 'zap', items: ['Event and schedule triggers', 'Workflow execution history', 'Agent chaining', 'Usage accounting per run'] },
    { title: 'Operations', icon: 'users', items: ['Staff profiles and attendance', 'Task assignment with progress', 'Approval workflows', 'Team analytics'] },
    { title: 'Support', icon: 'ticket', items: ['Ticket queue with priorities', 'Assignment and status history', 'Resolution timestamps', 'Requester notifications'] },
    { title: 'Developer', icon: 'terminal', items: ['Hashed API keys', 'Webhook configuration', 'Error monitoring', 'Deployment status', 'Sandbox request tester'] },
    { title: 'Governance', icon: 'shield', items: ['Server-side RBAC', 'TOTP for privileged roles', 'Audit log of admin actions', 'Session revocation', 'Backup management'] },
  ];
  return (
    <>
      <PageHero
        eyebrow="Features"
        title={<>Everything the platform actually does, <span className="grad-text">no vapourware</span></>}
        description="Each item below is implemented in this repository and enforced by the API."
      />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <Reveal key={g.title} delay={i * 0.05}>
              <Card className="h-full p-5" hover>
                <span className="mb-3 inline-flex rounded-xl border border-white/10 bg-white/[0.05] p-2.5 text-cyan-200">
                  <Icon name={g.icon} size={17} />
                </span>
                <h3 className="text-[15px] font-semibold">{g.title}</h3>
                <ul className="mt-3 space-y-1.5 text-[13px] text-mist">
                  {g.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <Icon name="check" size={13} className="mt-0.5 shrink-0 text-emerald-300/80" />
                      {it}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

/* -------------------------- tools & agents ---------------------------- */
export function ToolsPage() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/public/tools')
      .then((d) => setTools(d.tools || []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  const byCategory = tools.reduce((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <>
      <PageHero
        eyebrow="AI tools"
        title={<>The full tool set, <span className="grad-text">free to start</span></>}
        description="Sign in to use every tool. Daily fair-use limits are set by the platform owner and shown inside your workspace."
      >
        <Link to="/register"><Button size="lg">Create a free account</Button></Link>
      </PageHero>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {loading && <p className="text-sm text-mist">Loading the live tool list…</p>}
        <div className="space-y-10">
          {Object.entries(byCategory).map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                <Icon name="layers" size={15} /> {category}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((t) => (
                  <Card key={t.key} className="p-5" hover>
                    <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-mist">{t.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge tone="cyan">Free tier</Badge>
                      <Link to="/login" className="text-[11px] text-cyan-300 hover:text-cyan-200">Open →</Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
        {!loading && !tools.length && <p className="text-sm text-mist">The tool list could not be loaded. Please try again shortly.</p>}
      </section>
    </>
  );
}

export function AgentsPage() {
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    api.get('/public/agents').then((d) => setAgents(d.agents || [])).catch(() => {});
  }, []);

  return (
    <>
      <PageHero
        eyebrow="AI agents"
        title={<>Agents with a <span className="grad-text">defined job</span></>}
        description="Each agent is bound to a model and a system prompt, and every run is counted against your usage."
      />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Card key={a.key} className="flex h-full flex-col p-5" hover>
              <span className="mb-3 inline-flex w-fit rounded-xl bg-violet-500/15 p-2.5 text-violet-200">
                <Icon name="sparkles" size={17} />
              </span>
              <h3 className="text-sm font-semibold text-white">{a.name}</h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-mist">{a.description}</p>
              <code className="mt-4 rounded-md bg-black/40 px-2 py-1 text-[11px] text-slate-400">POST /api/ai/agents/{a.key}/run</code>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

/* ----------------------------- automation ----------------------------- */
export function Automation() {
  const steps = [
    { n: '01', title: 'Choose a trigger', body: 'An inbound form, a scheduled digest or an event such as a new ticket.' },
    { n: '02', title: 'Attach an agent', body: 'The agent receives the payload with its own system prompt and model binding.' },
    { n: '03', title: 'Record the run', body: 'Every execution is stored with status, duration and output for later review.' },
  ];
  return (
    <>
      <PageHero
        eyebrow="Automation"
        title={<>Work that runs <span className="grad-text">without being asked twice</span></>}
        description="Workflows connect triggers to agents and record each execution so nothing is invisible."
      />
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.07}>
              <Card className="h-full p-5">
                <span className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">{s.n}</span>
                <h3 className="mt-2 text-sm font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mist">{s.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <Card className="mt-8 p-6">
          <h3 className="text-sm font-semibold">Included workflow templates</h3>
          <ul className="mt-3 grid gap-2 text-[13px] text-mist sm:grid-cols-2">
            <li>• New lead → qualify → assign to a manager</li>
            <li>• Weekly usage and cost digest to the Founder</li>
            <li>• Urgent ticket escalation after four hours</li>
            <li>• Nightly backup with retention policy</li>
          </ul>
        </Card>
      </section>
    </>
  );
}

/* ---------------------------- marketplace ----------------------------- */
export function Marketplace() {
  const items = [
    { name: 'Local SEO Auditor', category: 'Marketing', price: 'Included' },
    { name: 'Invoice Extractor', category: 'Finance', price: 'Included' },
    { name: 'Support Reply Drafter', category: 'Support', price: 'Included' },
    { name: 'Ad Copy Variant Generator', category: 'Marketing', price: 'Included' },
    { name: 'Meeting Notes Summariser', category: 'Operations', price: 'Included' },
    { name: 'Product Description Writer', category: 'Commerce', price: 'Included' },
  ];
  return (
    <>
      <PageHero
        eyebrow="Marketplace"
        title={<>Prebuilt agents, <span className="grad-text">ready to run</span></>}
        description="Listings are curated by the platform team. No paid third-party listing is enabled without Owner approval."
      />
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Card key={it.name} className="p-5" hover>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{it.name}</h3>
                <Badge tone="green">{it.price}</Badge>
              </div>
              <p className="mt-2 text-[13px] text-mist">{it.category}</p>
              <p className="mt-3 text-[11px] text-slate-500">
                Runs on the local engine by default. A marketplace listing is not a paid service.
              </p>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

/* ------------------------------ solutions ----------------------------- */
export function Solutions() {
  const segments = [
    { title: 'Small agencies', body: 'Run marketing, content and client support from one workspace, with the founder keeping control of permissions.' },
    { title: 'Local businesses', body: 'Automate enquiries and follow-ups without hiring a marketing team or buying five subscriptions.' },
    { title: 'Internal IT teams', body: 'Give staff a governed AI workspace with per-role limits, audit logs and revocable API keys.' },
    { title: 'Support desks', body: 'Triage tickets by priority, draft replies with an agent, and keep resolution history searchable.' },
  ];
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title={<>Fits the team you <span className="grad-text">actually have</span></>}
        description="The portal structure maps to real responsibilities, not to an org chart someone wishes they had."
      />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {segments.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <Card className="h-full p-6" hover>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist">{s.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

/* ---------------------------- documentation --------------------------- */
export function Documentation() {
  const endpoints = [
    ['GET', '/api/v1/ping', 'Liveness check. Works with or without a key.'],
    ['GET', '/api/v1/me', 'Identity for the presented API key or session.'],
    ['GET', '/api/v1/tools', 'Enabled AI tools and their fair-use limits.'],
    ['GET', '/api/v1/agents', 'Available agents.'],
    ['POST', '/api/ai/chat', 'Send a message; returns the assistant reply.'],
    ['GET', '/api/ai/conversations', 'Your conversations, newest first.'],
    ['GET', '/api/portal/resources/tasks', 'Tasks, scoped to your permissions.'],
    ['GET', '/api/health', 'Server uptime and timestamp.'],
  ];

  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title={<>Everything you need to <span className="grad-text">integrate</span></>}
        description="The API is JSON over HTTPS. Session cookies are for the browser; API keys are for servers."
      />
      <Prose>
        <h2>Authentication</h2>
        <p>
          Browser clients authenticate with an <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">HttpOnly</code>{' '}
          session cookie set by <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">POST /api/auth/login</code>.
          Server-to-server clients use an API key from the Developer portal:
        </p>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 text-[12.5px] leading-relaxed text-slate-300">
{`curl https://your-domain/api/v1/tools \\
  -H "Authorization: Bearer chd_your_key_here"`}
        </pre>
        <p>
          Keys are hashed at rest and shown once at creation. Never call the API with a secret key from browser code —
          proxy the request through your own server.
        </p>

        <h2>Endpoints</h2>
        <div className="table-wrap not-prose">
          <table className="data-table">
            <thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
            <tbody>
              {endpoints.map(([m, p, d]) => (
                <tr key={p + m}>
                  <td><Badge tone={m === 'GET' ? 'cyan' : 'violet'}>{m}</Badge></td>
                  <td><code className="text-[12.5px] text-slate-300">{p}</code></td>
                  <td className="text-slate-400">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Portals and roles</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Portal</th><th>Route</th><th>Role</th><th>Two-factor</th></tr></thead>
            <tbody>
              {[
                ['Founder', '/founder', 'founder', 'Required'],
                ['Super Admin', '/super-admin', 'super_admin', 'Required'],
                ['Manager', '/manager', 'manager', 'Required'],
                ['Staff', '/staff', 'staff', 'Optional'],
                ['Developer', '/developer', 'developer', 'Required'],
                ['AI User', '/app', 'user', 'Optional'],
                ['Support', '/support', 'support', 'Required'],
              ].map(([n, r, role, tfa]) => (
                <tr key={r}>
                  <td>{n}</td>
                  <td><code className="text-[12.5px] text-slate-300">{r}</code></td>
                  <td className="text-slate-400">{role}</td>
                  <td>{tfa === 'Required' ? <Badge tone="green">Required</Badge> : <Badge>Optional</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Rate limits</h2>
        <p>
          Login attempts: 10 per 10 minutes. Registration: 5 per hour. Contact form: 5 per hour. API keys: 60 requests
          per minute, reported in the <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">X-RateLimit-Remaining</code> header.
        </p>

        <h2>Errors</h2>
        <p>Failures return a JSON body with a stable machine code:</p>
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 text-[12.5px] text-slate-300">
{`{ "error": "forbidden", "message": "Your role (Staff) cannot access the founder portal" }`}
        </pre>
        <p>
          Common codes: <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">unauthorized</code>,{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">forbidden</code>,{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">2fa_required</code>,{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">fair_use_limit</code>,{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">rate_limited</code>.
        </p>
      </Prose>
    </>
  );
}

/* ------------------------------- contact ------------------------------ */
export function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [state, setState] = useState({ status: 'idle', error: null });
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    api.get('/public/platform').then(setPlatform).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: 'sending', error: null });
    try {
      await api.post('/public/contact', form);
      setState({ status: 'sent', error: null });
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setState({ status: 'error', error: err.message });
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={<>Talk to <span className="grad-text">CHARDHO LLP</span></>}
        description="Messages become support tickets, so nothing gets lost in an inbox."
      />
      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <Card className="p-6 sm:p-8">
          {state.status === 'sent' ? (
            <div className="py-8 text-center">
              <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-400/15 text-emerald-200">
                <Icon name="check" size={22} />
              </span>
              <h2 className="text-lg font-semibold">Message received</h2>
              <p className="mt-2 text-sm text-mist">
                Your enquiry has been logged as a support ticket. We reply within one business day.
              </p>
              <Button variant="ghost" className="mt-6" onClick={() => setState({ status: 'idle', error: null })}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </Field>
                <Field label="Email">
                  <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
                </Field>
              </div>
              <Field label="How can we help?">
                <Textarea required minLength={10} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about the team, the workflow and what you are trying to automate." />
              </Field>
              {state.error && <Alert tone="rose">{state.error}</Alert>}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={state.status === 'sending'}>Send message</Button>
                {platform?.supportEmail && (
                  <span className="text-xs text-slate-500">or email {platform.supportEmail}</span>
                )}
              </div>
            </form>
          )}
        </Card>
      </section>
    </>
  );
}

/* -------------------------------- legal ------------------------------- */
export function Privacy() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" description="How CHARDHO LLP handles data on this platform." />
      <Prose>
        <p><em>Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</em></p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account data</strong> — name, email address, role and a hash of your password (never the password itself).</li>
          <li><strong>Usage data</strong> — which AI tool was used, token counts and timestamps, so fair-use limits can be applied.</li>
          <li><strong>Operational data</strong> — tasks, attendance, tickets and audit entries created inside the portals.</li>
          <li><strong>Technical data</strong> — IP address and user agent recorded on sign-in and on administrative actions.</li>
        </ul>
        <h2>How we use it</h2>
        <p>
          To operate your account, enforce permissions, apply fair-use limits, investigate abuse and produce
          aggregate reporting for the platform owner. We do not sell personal data.
        </p>
        <h2>AI processing</h2>
        <p>
          Prompts and replies are stored in your workspace so you can revisit them. By default they are processed by the
          platform's own local engine. If the Owner enables an external provider, prompts are sent to that provider under
          its own terms, and this policy will name it.
        </p>
        <h2>Retention</h2>
        <p>
          Conversations and tasks are kept until you delete them or the Owner removes the account. Audit logs are
          retained for security purposes. Backups are retained on the schedule set in the Founder portal.
        </p>
        <h2>Your rights</h2>
        <p>
          You can update your profile, change your password, revoke sessions and delete conversations from your portal.
          For export or erasure requests, contact the address on the <Link to="/contact" className="text-cyan-300">contact page</Link>.
        </p>
        <h2>Security</h2>
        <p>
          Passwords are hashed with scrypt. Sessions use HttpOnly, SameSite cookies. Privileged roles require TOTP.
          Administrative actions are audited. No system is perfectly secure, and we will disclose a breach to affected
          users without undue delay.
        </p>
      </Prose>
    </>
  );
}

export function Terms() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms & Conditions" description="The agreement between you and CHARDHO LLP." />
      <Prose>
        <p><em>Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</em></p>
        <h2>Using the platform</h2>
        <p>
          You may use CHARDHO AI for lawful business purposes. You are responsible for the content you submit and for
          keeping your credentials secure. Accounts are personal; do not share a session or an API key.
        </p>
        <h2>Free tier and fair use</h2>
        <p>
          The AI tools are provided free of charge within published daily limits. Limits exist so the platform stays
          available to everyone. Automated attempts to bypass limits may result in throttling or suspension.
        </p>
        <h2>Acceptable use</h2>
        <ul>
          <li>No unlawful, deceptive or harmful content.</li>
          <li>No attempts to access another user's data, another portal, or to circumvent permissions.</li>
          <li>No probing, scanning or overloading the service.</li>
          <li>No reselling access without written permission from CHARDHO LLP.</li>
        </ul>
        <h2>Accounts and roles</h2>
        <p>
          Public registration creates a Free User account only. Staff and administrative accounts are created by the
          platform owner. Roles, permissions and 2FA requirements may change as the platform evolves.
        </p>
        <h2>Availability</h2>
        <p>
          The service is provided on an "as available" basis. Maintenance windows may interrupt access. We do not
          guarantee uninterrupted availability.
        </p>
        <h2>Liability</h2>
        <p>
          To the extent permitted by law, CHARDHO LLP's liability is limited to the amount you paid for the service in
          the preceding twelve months. On the free tier that amount is zero.
        </p>
        <h2>Governing law</h2>
        <p>These terms are governed by the laws of India, with courts in Andhra Pradesh having jurisdiction.</p>
      </Prose>
    </>
  );
}

export function Disclaimer() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Disclaimer" description="Important limits on AI output and platform claims." />
      <Prose>
        <h2>AI output may be wrong</h2>
        <p>
          AI systems generate plausible text, and plausible is not the same as correct. Output from this platform may be
          incomplete, outdated or simply mistaken. Verify anything you intend to act on — especially legal, financial,
          medical or safety-related material.
        </p>
        <h2>No professional advice</h2>
        <p>
          Nothing produced here constitutes legal, medical, financial or tax advice. Consult a qualified professional
          before making decisions with real consequences.
        </p>
        <h2>Local engine by default</h2>
        <p>
          Unless the platform Owner enables an external provider, responses come from the platform's own deterministic
          engine. It composes structured plans and checklists; it does not have live access to the internet, your
          accounts, or private data beyond what you enter.
        </p>
        <h2>Portal URLs</h2>
        <p>
          Routes such as <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">/founder</code> or{' '}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-[13px]">/developer</code> are application routes, not
          separate public websites. They require an authenticated account with the matching role.
        </p>
        <h2>Trademarks</h2>
        <p>CHARDHO and the CHARDHO AI mark belong to CHARDHO LLP. Other names remain the property of their owners.</p>
      </Prose>
    </>
  );
}

/* -------------------------------- 404 --------------------------------- */
export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="grad-text text-6xl font-semibold">404</p>
      <h1 className="mt-3 text-2xl font-semibold">That page does not exist</h1>
      <p className="mt-2 text-sm text-mist">The link may be old, or the route may belong to a portal you have not opened.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/"><Button>Back to home</Button></Link>
        <Link to="/documentation"><Button variant="ghost">Read the docs</Button></Link>
      </div>
    </div>
  );
}
