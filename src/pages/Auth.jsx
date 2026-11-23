import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert, Badge, Button, Card, Field, Icon, Input } from '../components/ui.jsx';
import { api } from '../lib/api.js';

function AuthShell({ title, subtitle, children, footer, side }) {
  return (
    <div className="relative mx-auto grid min-h-[calc(100svh-6rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="order-2 lg:order-1">{side}</div>
      <div className="order-1 w-full max-w-md justify-self-center lg:order-2">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-mist">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
        {footer && <div className="mt-5 text-center text-sm text-mist">{footer}</div>}
      </div>
    </div>
  );
}

function PortalSide() {
  const portals = [
    ['Founder', '/founder'], ['Super Admin', '/super-admin'], ['Manager', '/manager'],
    ['Staff', '/staff'], ['Developer', '/developer'], ['AI User', '/app'], ['Support', '/support'],
  ];
  return (
    <div className="hidden lg:block">
      <h2 className="text-3xl font-semibold leading-tight">
        One login.<br />
        <span className="grad-text">The right portal.</span>
      </h2>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-mist">
        You never choose a portal at sign-in. The server reads your role and redirects you to the dashboard you own —
        and rejects any other portal, even if you type its URL.
      </p>
      <div className="mt-7 grid grid-cols-2 gap-2">
        {portals.map(([name, route]) => (
          <div key={route} className="glass flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-[13px] text-slate-300">{name}</span>
            <code className="text-[11px] text-slate-500">{route}</code>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        <Icon name="lock" size={13} /> Privileged roles require two-factor authentication.
      </div>
    </div>
  );
}

/* -------------------------------- login -------------------------------- */
export function Login() {
  const { login, verifyTwoFactor, twoFactor, status, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [form, setForm] = useState({ email: '', password: '' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(params.get('verified') ? 'Email verified. You can sign in now.' : null);

  const destination = (u) => next || u?.homeRoute || '/app';

  useEffect(() => {
    if (status === 'authenticated' && user) navigate(destination(user), { replace: true });
  }, [status, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitCredentials = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await login(form.email.trim(), form.password);
      if (!res.twoFactor?.required) navigate(destination(res.user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await verifyTwoFactor(code.replace(/\s/g, ''));
      navigate(destination(res.user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'twofa' && twoFactor) {
    const enrolling = twoFactor.state === 'enrol';
    return (
      <AuthShell
        title={enrolling ? 'Set up two-factor' : 'Two-factor code'}
        subtitle={
          enrolling
            ? 'Your role requires two-factor authentication. Add the key below to any authenticator app, then enter the six-digit code.'
            : 'Enter the six-digit code from your authenticator app.'
        }
        side={<PortalSide />}
      >
        <form onSubmit={submitCode} className="space-y-4">
          {enrolling && (
            <div className="space-y-3">
              <div className="rounded-xl border border-cyan-300/25 bg-cyan-400/[0.06] p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-cyan-200">Your setup key</p>
                <code className="mt-1.5 block break-all font-mono text-sm text-white">{twoFactor.secret}</code>
              </div>
              <a
                href={twoFactor.otpauth}
                className="block break-all rounded-lg bg-black/40 px-3 py-2 text-[11px] text-slate-400 hover:text-cyan-200"
              >
                {twoFactor.otpauth}
              </a>
              <p className="text-xs text-slate-500">
                In Google Authenticator, choose “Enter a setup key”, paste the key above, and keep the default
                time-based option.
              </p>
            </div>
          )}
          <Field label="Six-digit code" hint="Codes refresh every 30 seconds.">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-lg tracking-[0.5em]"
              autoFocus
            />
          </Field>
          {error && <Alert tone="rose">{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy} disabled={code.length !== 6}>
            {enrolling ? 'Enable and continue' : 'Verify and continue'}
          </Button>
          <p className="text-center text-xs text-slate-500">
            Lost your authenticator? An administrator must reset two-factor from the Super Admin portal.
          </p>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the credentials issued for your portal account."
      side={<PortalSide />}
      footer={
        <>
          No account? <Link to="/register" className="text-cyan-300 hover:text-cyan-200">Create a free one</Link>
        </>
      }
    >
      <form onSubmit={submitCredentials} className="space-y-4">
        {notice && <Alert tone="green">{notice}</Alert>}
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••••••"
          />
        </Field>
        {error && <Alert tone="rose">{error}</Alert>}
        <Button type="submit" className="w-full" loading={busy}>Continue</Button>
        <div className="flex items-center justify-between text-xs">
          <Link to="/forgot-password" className="text-slate-400 hover:text-cyan-200">Forgot password?</Link>
          <span className="inline-flex items-center gap-1 text-slate-500"><Icon name="lock" size={12} /> Session expires in 12h</span>
        </div>
      </form>
    </AuthShell>
  );
}

/* ------------------------------- register ------------------------------ */
export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    api.get('/public/platform').then((p) => setOpen(p.registrationOpen)).catch(() => {});
  }, []);

  const strength = (() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  })();

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/auth/register', { name: form.name, email: form.email, password: form.password });
      setDone(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Account created" subtitle="Your free AI workspace is ready." side={<PortalSide />}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3.5 text-sm text-emerald-100">
            <Icon name="check" size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">You can sign in now</p>
              <p className="mt-1 text-emerald-100/80">
                Registration creates a Free User account only. Staff and admin accounts are issued by the platform owner.
              </p>
            </div>
          </div>
          {done.devVerification && (
            <Alert tone="amber" title="Development mode">
              Email delivery is not configured, so the verification link is returned here:{' '}
              <a className="underline" href={done.devVerification.url}>verify this address</a>
            </Alert>
          )}
          <Link to="/login"><Button className="w-full">Go to sign in</Button></Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your free account"
      subtitle="Nine AI tools, specialist agents and a saved workspace."
      side={<PortalSide />}
      footer={<>Already registered? <Link to="/login" className="text-cyan-300 hover:text-cyan-200">Sign in</Link></>}
    >
      {!open ? (
        <Alert tone="amber" title="Registration is closed">
          The platform owner has paused new sign-ups. Please use the contact page to request access.
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name">
            <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" autoComplete="name" />
          </Field>
          <Field label="Email">
            <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" autoComplete="email" />
          </Field>
          <Field
            label="Password"
            hint="At least 12 characters, mixing upper case, lower case, digits or symbols."
          >
            <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••••••" autoComplete="new-password" />
          </Field>
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < strength ? 'bg-gradient-to-r from-cyan-400 to-violet-400' : 'bg-white/10'}`} />
            ))}
          </div>
          <Field label="Confirm password">
            <Input required type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="••••••••••••" autoComplete="new-password" />
          </Field>
          {error && <Alert tone="rose">{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>Create account</Button>
          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            By creating an account you accept the <Link to="/terms" className="text-slate-400 underline">Terms</Link> and{' '}
            <Link to="/privacy" className="text-slate-400 underline">Privacy Policy</Link>.
          </p>
        </form>
      )}
    </AuthShell>
  );
}

/* ---------------------------- forgot / reset --------------------------- */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post('/auth/forgot-password', { email }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email address on your account."
      side={<PortalSide />}
      footer={<Link to="/login" className="text-cyan-300 hover:text-cyan-200">Back to sign in</Link>}
    >
      {result ? (
        <div className="space-y-3">
          <Alert tone="green">{result.message}</Alert>
          {result.devReset && (
            <Alert tone="amber" title="Development mode">
              Email is not configured, so the reset link is shown here:{' '}
              <Link className="underline" to={result.devReset.url}>open reset page</Link>
            </Alert>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          {error && <Alert tone="rose">{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const token = params.get('token') || '';

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" subtitle="You will be signed out of every other device." side={<PortalSide />}>
      {done ? (
        <div className="space-y-4">
          <Alert tone="green">Password updated. All other sessions have been revoked.</Alert>
          <Link to="/login"><Button className="w-full">Sign in</Button></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {!token && <Alert tone="rose">This link is missing its token. Request a new reset email.</Alert>}
          <Field label="New password" hint="At least 12 characters with mixed character types.">
            <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input required type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
          </Field>
          {error && <Alert tone="rose">{error}</Alert>}
          <Button type="submit" className="w-full" loading={busy} disabled={!token}>Update password</Button>
          <div className="text-center">
            <Badge tone="neutral">Password reset revokes active sessions</Badge>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
