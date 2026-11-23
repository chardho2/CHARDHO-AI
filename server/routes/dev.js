/**
 * CHARDHO-AI :: developer platform
 * API keys are hashed at rest and shown exactly once. Secrets never reach the browser.
 */
import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import {
  asyncRoute, requireAuth, requirePermission, audit, badRequest, notFound, forbidden,
  requireFields, stringField, oneOf, HttpError,
} from '../security.js';
import { issueApiKey, verifyApiKey } from '../auth.js';

export const devRouter = express.Router();

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

/* ------------------------------- API keys ----------------------------- */
devRouter.get(
  '/keys',
  requireAuth,
  requirePermission('apikeys.read'),
  asyncRoute(async (req, res) => {
    const seeAll = req.user.role === 'founder';
    const rows = db.prepare(
      `SELECT k.id, k.label, k.prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at, u.email
       FROM api_keys k JOIN users u ON u.id = k.user_id
       WHERE (? = 1 OR k.user_id = ?) ORDER BY k.created_at DESC`,
    ).all(seeAll ? 1 : 0, req.user.id);
    res.json({ keys: rows });
  }),
);

devRouter.post(
  '/keys',
  requireAuth,
  requirePermission('apikeys.manage'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['label']);
    const label = stringField(req.body.label, 'label', { min: 3, max: 60 });
    const scopes = Array.isArray(req.body.scopes)
      ? req.body.scopes.filter((s) => ['read', 'write', 'ai', 'webhooks'].includes(s))
      : ['read'];
    const { key, prefix } = issueApiKey(req.user.id, label, scopes);
    audit(req, 'apikeys.create', { entity: 'api_keys', entityId: prefix, meta: { scopes } });
    // Shown once. Only the hash is stored.
    res.status(201).json({ ok: true, key, prefix, label, scopes });
  }),
);

devRouter.delete(
  '/keys/:id',
  requireAuth,
  requirePermission('apikeys.manage'),
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Key not found');
    if (row.user_id !== req.user.id && req.user.role !== 'founder') throw forbidden('You can only revoke your own keys');
    db.prepare(`UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ?`).run(row.id);
    audit(req, 'apikeys.revoke', { entity: 'api_keys', entityId: row.id });
    res.json({ ok: true });
  }),
);

/* ------------------------------- webhooks ----------------------------- */
devRouter.get(
  '/webhooks',
  requireAuth,
  requirePermission('webhooks.manage'),
  asyncRoute(async (req, res) => {
    const rows = db.prepare('SELECT id, url, events, enabled, created_at FROM webhooks WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
    res.json({ webhooks: rows });
  }),
);

devRouter.post(
  '/webhooks',
  requireAuth,
  requirePermission('webhooks.manage'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['url']);
    const url = stringField(req.body.url, 'url', { min: 8, max: 500 });
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw badRequest('Enter a valid absolute URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw badRequest('Webhook URL must use http or https');
    const events = Array.isArray(req.body.events) ? req.body.events.slice(0, 10).map(String) : ['ticket.created'];
    const secret = crypto.randomBytes(24).toString('base64url');
    const result = db.prepare(
      'INSERT INTO webhooks (user_id, url, events, secret_hash) VALUES (?,?,?,?)',
    ).run(req.user.id, url, JSON.stringify(events), sha256(secret));
    audit(req, 'webhooks.create', { entity: 'webhooks', entityId: result.lastInsertRowid });
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid), secret });
  }),
);

devRouter.delete(
  '/webhooks/:id',
  requireAuth,
  requirePermission('webhooks.manage'),
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Webhook not found');
    if (row.user_id !== req.user.id && req.user.role !== 'founder') throw forbidden();
    db.prepare('DELETE FROM webhooks WHERE id = ?').run(row.id);
    audit(req, 'webhooks.delete', { entity: 'webhooks', entityId: row.id });
    res.json({ ok: true });
  }),
);

/* --------------------------------- logs ------------------------------- */
devRouter.get(
  '/logs',
  requireAuth,
  requirePermission('logs.read'),
  asyncRoute(async (req, res) => {
    const level = req.query.level && req.query.level !== 'all' ? oneOf(req.query.level, ['error', 'warn', 'info'], 'level') : null;
    const rows = db.prepare(
      `SELECT * FROM error_logs WHERE (? IS NULL OR level = ?) ORDER BY id DESC LIMIT 100`,
    ).all(level, level);
    res.json({ logs: rows });
  }),
);

devRouter.post(
  '/logs',
  requireAuth,
  requirePermission('logs.read'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['message', 'source']);
    db.prepare('INSERT INTO error_logs (level, source, message, meta) VALUES (?,?,?,?)').run(
      oneOf(req.body.level || 'info', ['error', 'warn', 'info'], 'level'),
      stringField(req.body.source, 'source', { max: 80 }),
      stringField(req.body.message, 'message', { max: 2000 }),
      req.body.meta ? JSON.stringify(req.body.meta).slice(0, 2000) : null,
    );
    res.status(201).json({ ok: true });
  }),
);

/* ------------------------------ deployments --------------------------- */
devRouter.get(
  '/deployments',
  requireAuth,
  requirePermission('deploy.read'),
  asyncRoute(async (_req, res) => {
    res.json({ deployments: db.prepare('SELECT * FROM deployments ORDER BY id DESC LIMIT 30').all() });
  }),
);

/* -------------------------------- sandbox ----------------------------- */
/**
 * A real, safe sandbox: it validates a request shape and reports what the API
 * would do, without ever executing user code on the server.
 */
devRouter.post(
  '/sandbox',
  requireAuth,
  requirePermission('sandbox.use'),
  asyncRoute(async (req, res) => {
    const method = oneOf(String(req.body?.method || 'GET').toUpperCase(), ['GET', 'POST', 'PATCH', 'DELETE'], 'method');
    const endpoint = String(req.body?.endpoint || '/api/v1/ping');
    if (!endpoint.startsWith('/api/')) throw badRequest('Sandbox endpoints must start with /api/');

    const known = [
      '/api/v1/ping', '/api/v1/me', '/api/v1/tools', '/api/v1/agents',
      '/api/v1/usage', '/api/v1/tickets', '/api/v1/conversations',
    ];
    const match = known.includes(endpoint);
    audit(req, 'sandbox.request', { entity: 'sandbox', meta: { method, endpoint } });
    res.json({
      request: { method, endpoint },
      validation: match ? 'endpoint recognised' : 'endpoint not in the sandbox allow-list',
      simulated: match,
      response: match
        ? { status: 200, body: { ok: true, sandbox: true, endpoint, method, note: 'Simulated response — no data was read or written.' } }
        : { status: 404, body: { error: 'not_found' } },
      hints: [
        'Authenticate with the header: Authorization: Bearer chd_...',
        'Rate limit: 60 requests per minute per key',
        'Never call the API from browser code with a secret key — proxy through your server',
      ],
    });
  }),
);

/* ------------------------- public API (v1, key auth) ------------------ */
export const publicApiRouter = express.Router();

publicApiRouter.use((req, _res, next) => {
  if (req.user) return next(); // already authenticated via session
  const header = req.headers.authorization || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (raw) {
    const key = verifyApiKey(raw);
    if (key) {
      req.apiKey = key;
      req.user = { id: key.user_id, email: key.email, name: key.name, role: 'api_key', permissions: [], apiKey: true };
    }
  }
  next();
});

const apiRate = new Map();
publicApiRouter.use((req, res, next) => {
  const ident = req.apiKey ? `k${req.apiKey.id}` : `ip${req.ip}`;
  const now = Date.now();
  const entry = apiRate.get(ident) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  entry.count += 1;
  apiRate.set(ident, entry);
  res.setHeader('X-RateLimit-Limit', '60');
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, 60 - entry.count)));
  if (entry.count > 60) return next(new HttpError(429, 'rate_limited', 'API rate limit exceeded'));
  next();
});

publicApiRouter.get('/ping', (req, res) => {
  res.json({ ok: true, service: 'chardho-ai', time: new Date().toISOString(), authenticated: !!req.apiKey });
});

publicApiRouter.get('/me', (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'unauthorized', 'A valid API key is required'));
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, via: req.apiKey ? 'api_key' : 'session' });
});

publicApiRouter.get('/tools', (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'unauthorized', 'A valid API key is required'));
  res.json({ tools: db.prepare('SELECT key, name, category, enabled, free_limit_daily FROM ai_tools WHERE enabled = 1').all() });
});

publicApiRouter.get('/agents', (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'unauthorized', 'A valid API key is required'));
  res.json({ agents: db.prepare('SELECT key, name, description FROM agents WHERE enabled = 1').all() });
});
