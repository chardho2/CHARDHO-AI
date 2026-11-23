/**
 * CHARDHO-AI :: API and authorisation tests
 * Run with: npm test
 *
 * These exercise the real server against a throwaway SQLite database, so they
 * verify the security boundary rather than a mock of it.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chardho-test-'));
process.env.CHARDHO_DB_PATH = path.join(tmpDir, 'test.db');
process.env.CHARDHO_NO_LISTEN = 'true';
process.env.NODE_ENV = 'test';
process.env.CHARDHO_REQUIRE_2FA = 'true';
process.env.CHARDHO_EXPOSE_SETUP_TOKENS = 'true';

let server;
let baseUrl;
let credentials;
let totpCode;
let dbModule;

/** Minimal cookie jar per simulated user. */
function client() {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    async fetch(pathname, { method = 'GET', body, headers = {} } = {}) {
      const res = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      });
      const setCookie = res.headers.getSetCookie?.() || [];
      for (const c of setCookie) {
        const [pair] = c.split(';');
        if (pair.startsWith('chardho_session=')) cookie = pair;
      }
      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: res.status, body: json, headers: res.headers };
    },
  };
}

const credFor = (role) => credentials.find((c) => c.role === role);

/** Full password + TOTP sign-in for a role, returning an authenticated client. */
async function loginAs(role) {
  const c = client();
  const cred = credFor(role);
  const res = await c.fetch('/api/auth/login', { method: 'POST', body: { email: cred.email, password: cred.password } });
  assert.equal(res.status, 200, `login for ${role} should succeed: ${JSON.stringify(res.body)}`);

  if (res.body.twoFactor?.required) {
    const row = dbModule.db.prepare('SELECT totp_secret FROM users WHERE email = ?').get(cred.email);
    const secret = res.body.twoFactor.state === 'enrol' ? res.body.twoFactor.secret : row?.totp_secret;
    assert.ok(secret, 'a TOTP secret is available for the challenge');
    const verify = await c.fetch('/api/auth/2fa/verify', { method: 'POST', body: { code: totpCode(secret) } });
    assert.equal(verify.status, 200, `2fa verify for ${role} should succeed: ${JSON.stringify(verify.body)}`);
    return { client: c, user: verify.body.user };
  }
  return { client: c, user: res.body.user };
}

before(async () => {
  dbModule = await import('../server/db.js');
  const seeded = dbModule.seed({ quiet: true });
  credentials = seeded.credentials;
  const auth = await import('../server/auth.js');
  totpCode = auth.totpCode;
  const { app } = await import('../server/index.js');
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
});

/* ------------------------------------------------------------------ */
describe('seeding and password policy', () => {
  it('creates one account per role with randomly generated passwords', () => {
    assert.equal(credentials.length, 7);
    const passwords = new Set(credentials.map((c) => c.password));
    assert.equal(passwords.size, 7, 'every seeded password is unique');
    for (const c of credentials) {
      assert.ok(c.password.length >= 16, 'generated passwords are long');
      assert.notEqual(c.password, 'password');
    }
  });
});

describe('authentication', () => {
  it('rejects a wrong password without revealing whether the account exists', async () => {
    const c = client();
    const real = await c.fetch('/api/auth/login', {
      method: 'POST',
      body: { email: credFor('staff').email, password: 'definitely-not-the-password' },
    });
    const fake = await c.fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'definitely-not-the-password' },
    });
    assert.equal(real.status, 401);
    assert.equal(fake.status, 401);
    assert.equal(real.body.message, fake.body.message, 'identical message avoids account enumeration');
  });

  it('requires a second factor for the founder before the session is usable', async () => {
    const c = client();
    const cred = credFor('founder');
    const login = await c.fetch('/api/auth/login', { method: 'POST', body: { email: cred.email, password: cred.password } });
    assert.equal(login.status, 200);
    assert.equal(login.body.twoFactor.required, true);
    assert.equal(login.body.twoFactor.state, 'enrol');

    // The session exists but is not authorised for portal data yet.
    const blocked = await c.fetch('/api/portal/founder/dashboard');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, '2fa_required');

    const verify = await c.fetch('/api/auth/2fa/verify', { method: 'POST', body: { code: totpCode(login.body.twoFactor.secret) } });
    assert.equal(verify.status, 200);
    const allowed = await c.fetch('/api/portal/founder/dashboard');
    assert.equal(allowed.status, 200);
  });

  it('rejects an incorrect two-factor code', async () => {
    const c = client();
    const cred = credFor('manager');
    const login = await c.fetch('/api/auth/login', { method: 'POST', body: { email: cred.email, password: cred.password } });
    const bad = await c.fetch('/api/auth/2fa/verify', { method: 'POST', body: { code: '000000' } });
    assert.equal(bad.status, 400);
    assert.ok(login.body.twoFactor.secret);
  });

  it('rate limits repeated login attempts', async () => {
    const c = client();
    let last;
    for (let i = 0; i < 12; i++) {
      last = await c.fetch('/api/auth/login', { method: 'POST', body: { email: 'ratelimit@example.com', password: 'x'.repeat(20) } });
    }
    assert.equal(last.status, 429);
    assert.equal(last.body.error, 'rate_limited');
  });

  it('logout revokes the session server-side', async () => {
    const { client: c } = await loginAs('staff');
    assert.equal((await c.fetch('/api/auth/me')).body.user.role, 'staff');
    await c.fetch('/api/auth/logout', { method: 'POST' });
    const after = await c.fetch('/api/auth/me');
    assert.equal(after.body.user, null);
  });
});

describe('portal isolation and RBAC', () => {
  it('lets staff use their own portal', async () => {
    const { client: c } = await loginAs('staff');
    const res = await c.fetch('/api/portal/staff/dashboard');
    assert.equal(res.status, 200);
    assert.equal(res.body.portal, 'staff');
  });

  it('blocks staff from the founder and super-admin portals', async () => {
    const { client: c } = await loginAs('staff');
    for (const portal of ['founder', 'super-admin']) {
      const res = await c.fetch(`/api/portal/${portal}/dashboard`);
      assert.equal(res.status, 403, `staff must not reach ${portal}`);
    }
  });

  it('blocks staff from administrative APIs even though the UI exists', async () => {
    const { client: c } = await loginAs('staff');
    const users = await c.fetch('/api/admin/users');
    assert.equal(users.status, 403);
    assert.equal(users.body.error, 'forbidden');
    const audit = await c.fetch('/api/admin/audit');
    assert.equal(audit.status, 403);
  });

  it('rejects unauthenticated access to every portal', async () => {
    const c = client();
    for (const portal of ['founder', 'super-admin', 'manager', 'staff', 'developer', 'app', 'support']) {
      const res = await c.fetch(`/api/portal/${portal}/dashboard`);
      assert.equal(res.status, 401, `${portal} must require authentication`);
    }
  });

  it('lets the founder enter every portal (master access)', async () => {
    const { client: c } = await loginAs('founder');
    for (const portal of ['founder', 'super-admin', 'manager', 'staff', 'developer', 'app', 'support']) {
      const res = await c.fetch(`/api/portal/${portal}/dashboard`);
      assert.equal(res.status, 200, `founder should reach ${portal}`);
    }
  });

  it('scopes a free user to their own tasks and conversations', async () => {
    const { client: c } = await loginAs('user');
    // Free users have no staff-task permission at all, so the resource is refused outright.
    const tasks = await c.fetch('/api/portal/resources/tasks');
    assert.equal(tasks.status, 403, 'free users cannot read the staff task resource');

    const conversations = await c.fetch('/api/ai/conversations');
    assert.equal(conversations.status, 200);
    const ownIds = conversations.body.conversations.map((x) => x.id);

    // Another user's conversation must be unreadable.
    const other = conversations.body.conversations[0];
    if (other) {
      const { client: staff } = await loginAs('staff');
      const foreign = await staff.fetch(`/api/ai/conversations/${other.id}`);
      assert.equal(foreign.status, 403, 'conversations are private to their owner');
    }
    assert.ok(Array.isArray(ownIds));
  });

  it('refuses to let the founder grant founder-only permissions to another role', async () => {
    const { client: c } = await loginAs('founder');
    const res = await c.fetch('/api/admin/roles/staff/permissions', {
      method: 'PUT',
      body: { permissions: ['tasks.read', 'roles.manage'] },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /founder-only/);
  });

  it('never allows the founder role itself to be edited', async () => {
    const { client: c } = await loginAs('founder');
    const res = await c.fetch('/api/admin/roles/founder/permissions', {
      method: 'PUT',
      body: { permissions: [] },
    });
    assert.equal(res.status, 403);
  });
});

describe('public registration', () => {
  it('always creates a free user, ignoring any role supplied by the client', async () => {
    const c = client();
    const email = `intruder-${Date.now()}@example.com`;
    const res = await c.fetch('/api/auth/register', {
      method: 'POST',
      body: { name: 'Intruder Test', email, password: 'Str0ng-Passw0rd!23', role: 'founder' },
    });
    assert.equal(res.status, 201);

    const login = await c.fetch('/api/auth/login', { method: 'POST', body: { email, password: 'Str0ng-Passw0rd!23' } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'user', 'role escalation via registration is impossible');
    assert.equal(login.body.user.homeRoute, '/app');

    const founderAttempt = await c.fetch('/api/portal/founder/dashboard');
    assert.equal(founderAttempt.status, 403);
  });

  it('enforces the password policy', async () => {
    const c = client();
    const res = await c.fetch('/api/auth/register', {
      method: 'POST',
      body: { name: 'Weak Pass', email: `weak-${Date.now()}@example.com`, password: 'short' },
    });
    assert.equal(res.status, 400);
  });
});

describe('request hardening', () => {
  it('blocks cross-origin cookie-authenticated mutations', async () => {
    const { client: c } = await loginAs('staff');
    const res = await c.fetch('/api/work/tasks', {
      method: 'POST',
      body: { title: 'CSRF attempt' },
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.message, /Cross-origin/);
  });

  it('sets hardened response headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  it('returns a structured 404 for unknown API routes', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'not_found');
  });
});

describe('audit trail', () => {
  it('records administrative and authentication actions', async () => {
    const { client: c } = await loginAs('founder');
    await c.fetch('/api/admin/users', {
      method: 'POST',
      body: { name: 'Audit Subject', email: `audit-${Date.now()}@example.com`, role: 'staff' },
    });
    const logs = await c.fetch('/api/admin/audit?limit=50');
    assert.equal(logs.status, 200);
    const actions = logs.body.logs.map((l) => l.action);
    assert.ok(actions.includes('users.create'), 'user creation is audited');
    assert.ok(actions.some((a) => a.startsWith('auth.')), 'authentication events are audited');
  });
});

describe('developer API keys', () => {
  it('creates a key that authenticates /api/v1 and can be revoked', async () => {
    const { client: c } = await loginAs('developer');
    const created = await c.fetch('/api/dev/keys', { method: 'POST', body: { label: 'Test key', scopes: ['read'] } });
    assert.equal(created.status, 201);
    const key = created.body.key;
    assert.match(key, /^chd_/);

    const ok = await fetch(`${baseUrl}/api/v1/tools`, { headers: { Authorization: `Bearer ${key}` } });
    assert.equal(ok.status, 200);

    const anon = await fetch(`${baseUrl}/api/v1/tools`);
    assert.equal(anon.status, 401);

    const list = await c.fetch('/api/dev/keys');
    const id = list.body.keys.find((k) => k.prefix === created.body.prefix).id;
    await c.fetch(`/api/dev/keys/${id}`, { method: 'DELETE' });

    const revoked = await fetch(`${baseUrl}/api/v1/tools`, { headers: { Authorization: `Bearer ${key}` } });
    assert.equal(revoked.status, 401, 'a revoked key stops working immediately');
  });

  it('never returns a stored key hash to the browser', async () => {
    const { client: c } = await loginAs('developer');
    const list = await c.fetch('/api/dev/keys');
    for (const k of list.body.keys) {
      assert.equal(k.key_hash, undefined);
      assert.equal(k.key, undefined);
    }
  });
});

describe('work management', () => {
  it('lets staff check in once per day and blocks a duplicate', async () => {
    const { client: c } = await loginAs('staff');
    await c.fetch('/api/work/attendance/check-out').catch(() => {});
    const first = await c.fetch('/api/work/attendance/check-in', { method: 'POST' });
    assert.equal(first.status, 200);
    const second = await c.fetch('/api/work/attendance/check-in', { method: 'POST' });
    assert.equal(second.status, 400, 'a second check-in on the same day is rejected');
  });

  it('prevents staff from reassigning or reprioritising tasks', async () => {
    const { client: staff } = await loginAs('staff');
    const tasks = await staff.fetch('/api/work/tasks');
    const own = tasks.body.tasks.find((t) => t.assigned_to);
    assert.ok(own, 'seeded staff account has a task');
    const res = await staff.fetch(`/api/work/tasks/${own.id}`, { method: 'PATCH', body: { priority: 'low' } });
    assert.equal(res.status, 403);
  });

  it('prevents a free user from reading all tickets', async () => {
    const { client: c } = await loginAs('user');
    const res = await c.fetch('/api/work/tickets');
    assert.equal(res.status, 200);
    assert.equal(res.body.scope, 'self');
  });
});

describe('AI workspace', () => {
  it('answers from the local engine and persists the conversation', async () => {
    const { client: c } = await loginAs('user');
    const res = await c.fetch('/api/ai/chat', { method: 'POST', body: { message: 'Plan a launch for a bakery' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'local');
    assert.ok(res.body.reply.length > 40);

    const thread = await c.fetch(`/api/ai/conversations/${res.body.conversationId}`);
    assert.equal(thread.body.messages.length, 2);
    assert.equal(thread.body.messages[0].role, 'user');
    assert.equal(thread.body.messages[1].role, 'assistant');
  });

  it('keeps every free tool free of cost', async () => {
    const { client: c } = await loginAs('user');
    const usage = await c.fetch('/api/ai/usage');
    assert.equal(usage.status, 200);
    assert.equal(Number(usage.body.summary.cost), 0);
  });
});

describe('database integrity', () => {
  it('does not store raw passwords anywhere', async () => {
    const { db } = await import('../server/db.js');
    const rows = db.prepare('SELECT password_hash FROM users').all();
    const staffPassword = credFor('staff').password;
    for (const r of rows) {
      assert.match(r.password_hash, /^scrypt\$/);
      assert.ok(!r.password_hash.includes(staffPassword));
    }
  });

  it('stores plaintext-looking secrets nowhere in provider config', async () => {
    const { db } = await import('../server/db.js');
    const providers = db.prepare('SELECT * FROM ai_providers').all();
    for (const p of providers) {
      assert.ok(!p.api_key, 'providers reference an env var, not a stored secret');
      assert.match(p.key_env_var, /^[A-Z0-9_]+$/);
    }
  });
});

describe('client error reporting', () => {
  const anon = () => client();

  it('accepts a browser crash and records it for the developer portal', async () => {
    const c = anon();
    const res = await c.fetch('/api/client-errors', {
      method: 'POST',
      body: {
        kind: 'render',
        message: 'Cannot read properties of undefined (reading "name")',
        stack: 'TypeError: ...\n    at Dashboard (pages.jsx:42)',
        componentStack: '\n    in Dashboard',
        route: '/app',
        userAgent: 'node-test',
      },
    });
    assert.equal(res.status, 204);

    const row = dbModule.db
      .prepare("SELECT level, source, message, meta FROM error_logs WHERE source = 'client:render' ORDER BY id DESC")
      .get();
    assert.ok(row, 'the error was persisted');
    assert.equal(row.level, 'error');
    assert.match(row.message, /Cannot read properties/);
    assert.equal(JSON.parse(row.meta).route, '/app');
  });

  it('rejects a payload without a message', async () => {
    const res = await anon().fetch('/api/client-errors', { method: 'POST', body: { kind: 'render' } });
    assert.equal(res.status, 400);
  });

  it('truncates oversized fields instead of storing unbounded text', async () => {
    const c = anon();
    await c.fetch('/api/client-errors', {
      method: 'POST',
      body: { kind: 'promise', message: 'x'.repeat(4000), stack: 'y'.repeat(9000) },
    });
    const row = dbModule.db
      .prepare("SELECT message, meta FROM error_logs WHERE source = 'client:promise' ORDER BY id DESC")
      .get();
    assert.equal(row.message.length, 500);
    assert.ok(JSON.parse(row.meta).stack.length <= 2000);
  });

  it('rate limits a flood of reports', async () => {
    const c = anon();
    let sawLimit = false;
    for (let i = 0; i < 40 && !sawLimit; i += 1) {
      const res = await c.fetch('/api/client-errors', { method: 'POST', body: { kind: 'flood', message: `flood ${i}` } });
      if (res.status === 429) sawLimit = true;
    }
    assert.ok(sawLimit, 'repeated reports are throttled per IP');
  });
});
