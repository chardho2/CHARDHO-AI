import fs from 'node:fs';
import { totpCode } from '../server/auth.js';

const text = fs.readFileSync('data/credentials/seed-credentials.txt', 'utf8');
const rows = text.split('\n')
  .filter((l) => /^\S+\s+\/[\w-]+/.test(l))
  .map((l) => l.trim().split(/\s+/));

const base = 'http://localhost:5173';
const out = [];

for (const [portal, home, email, password] of rows) {
  let cookie = '';
  const req = async (path, opts = {}) => {
    const r = await fetch(base + path, {
      ...opts,
      headers: {
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(opts.headers || {}),
      },
      redirect: 'manual',
    });
    for (const c of r.headers.getSetCookie?.() || []) {
      const pair = c.split(';')[0];
      if (pair.startsWith('chardho_session=')) cookie = pair;
    }
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 80) }; }
    return { status: r.status, body: j };
  };

  const login = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (login.status !== 200) { out.push(`${portal}: LOGIN FAIL ${login.status} ${login.body.message}`); continue; }

  let note = 'no-2fa';
  if (login.body.twoFactor?.required) {
    const { db } = await import('../server/db.js');
    const secret = login.body.twoFactor.secret || db.prepare('SELECT totp_secret s FROM users WHERE email = ?').get(email)?.s;
    const v = await req('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code: totpCode(secret) }) });
    if (v.status !== 200) { out.push(`${portal}: 2FA FAIL ${v.status} ${v.body.message}`); continue; }
    note = `2fa(${login.body.twoFactor.state})`;
  }

  const dash = await req('/api/portal/' + portal + '/dashboard');
  const me = await req('/api/auth/me');
  const metrics = dash.status === 200 ? Object.keys(dash.body).length : 0;
  out.push(`${portal.padEnd(12)} login=200 ${note.padEnd(14)} dash=${dash.status} keys=${metrics} home=${login.body.user.homeRoute} role=${me.body.user?.role}`);
}

// cross-portal denial: staff session against founder API (through the proxy)
let cookie = '';
const staff = rows.find((r) => r[0] === 'staff');
const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: staff[2], password: staff[3] }) });
cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('chardho_session=')) || '';
const denied = await fetch(base + '/api/portal/founder/dashboard', { headers: { Cookie: cookie } });
out.push(`staff -> /founder dashboard: ${denied.status} (expected 403)`);

console.log(out.join('\n'));
