/** Hits every data endpoint the portal screens use, per role, and reports non-2xx. */
import fs from 'node:fs';
import { totpCode } from '../server/auth.js';

const rows = fs.readFileSync(process.env.CHARDHO_CREDENTIALS || 'data/credentials/seed-credentials.txt', 'utf8')
  .split('\n').filter((l) => /^\S+\s+\/[\w-]+/.test(l)).map((l) => l.trim().split(/\s+/));
const base = process.env.CHARDHO_BASE_URL || 'http://localhost:5173';

const CHECKS = {
  founder: ['/api/admin/users', '/api/admin/roles', '/api/admin/security', '/api/admin/backups', '/api/admin/moderation',
    '/api/portal/founder/settings', '/api/portal/founder/reports', '/api/portal/resources/agents', '/api/portal/resources/models',
    '/api/portal/resources/providers', '/api/portal/resources/tools', '/api/portal/resources/workflows', '/api/portal/resources/workflow_runs',
    '/api/portal/resources/audit', '/api/portal/resources/usage', '/api/ai/usage', '/api/portal/notifications', '/api/portal/profile'],
  manager: ['/api/work/tasks', '/api/work/attendance', '/api/work/tickets', '/api/work/staff-overview',
    '/api/portal/manager/reports', '/api/portal/resources/audit', '/api/portal/manager/settings'],
  staff: ['/api/work/tasks', '/api/work/attendance', '/api/work/tickets', '/api/portal/staff/reports', '/api/portal/profile'],
  developer: ['/api/dev/keys', '/api/dev/webhooks', '/api/dev/logs', '/api/dev/deployments', '/api/portal/resources/models',
    '/api/ai/usage', '/api/portal/developer/settings'],
  support: ['/api/work/tickets', '/api/portal/resources/users', '/api/portal/support/reports'],
  app: ['/api/ai/tools', '/api/ai/conversations', '/api/ai/usage', '/api/ai/agents', '/api/work/tickets',
    '/api/portal/app/reports', '/api/portal/resources/notifications', '/api/portal/app/dashboard'],
};

let failures = 0;
for (const [portal, paths] of Object.entries(CHECKS)) {
  const cred = rows.find((r) => r[0] === portal);
  let cookie = '';
  const req = async (path, opts = {}) => {
    const r = await fetch(base + path, {
      ...opts,
      headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) },
    });
    for (const c of r.headers.getSetCookie?.() || []) {
      const p = c.split(';')[0];
      if (p.startsWith('chardho_session=')) cookie = p;
    }
    return r;
  };
  const login = await req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: cred[2], password: cred[3] }) });
  const body = await login.json();
  if (body.twoFactor?.required) {
    const secret = body.twoFactor.secret || (await import('../server/db.js')).db
      .prepare('SELECT totp_secret s FROM users WHERE email = ?').get(cred[2])?.s;
    const verified = await req('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code: totpCode(secret) }) });
    if (verified.status !== 200) {
      console.log(`FAIL ${portal.padEnd(10)} 2fa verify -> ${verified.status} ${(await verified.text()).slice(0, 120)}`);
      failures++;
      continue;
    }
  }
  for (const path of paths) {
    const r = await req(path);
    if (r.status >= 400) {
      failures++;
      const detail = await r.text();
      console.log(`FAIL ${portal.padEnd(10)} ${path} -> ${r.status} ${detail.slice(0, 120)}`);
    }
  }
  console.log(`${portal.padEnd(10)} checked ${paths.length} endpoints`);
}
console.log(failures === 0 ? '\nAll endpoint checks passed.' : `\n${failures} endpoint failure(s).`);
process.exit(failures === 0 ? 0 : 1);
