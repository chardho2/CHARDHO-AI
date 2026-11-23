/**
 * CHARDHO-AI :: API server
 * Express + SQLite. In development Vite proxies /api here; in production this
 * process also serves the built front-end.
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { db, seed } from './db.js';
import { attachUser } from './auth.js';
import { originGuard, HttpError, clientIp } from './security.js';
import { authRouter } from './routes/auth.js';
import { portalRouter } from './routes/portal.js';
import { adminRouter } from './routes/admin.js';
import { workRouter } from './routes/work.js';
import { aiRouter } from './routes/ai.js';
import { devRouter, publicApiRouter } from './routes/dev.js';
import { publicRouter } from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const IS_PROD = process.env.NODE_ENV === 'production';
// In development the API only needs to be reachable by the Vite proxy on the same
// machine; in production it must accept traffic from the platform's proxy.
const HOST = process.env.CHARDHO_HOST || (IS_PROD ? '0.0.0.0' : '127.0.0.1');

/**
 * Framing policy.
 * Defaults to same-origin only. Hosted preview panels render the app inside an
 * iframe from a different origin, so they must be allow-listed explicitly via
 * CHARDHO_FRAME_ANCESTORS. When that is set we drop X-Frame-Options (which
 * cannot express a list) and rely on the CSP frame-ancestors directive.
 */
const FRAME_ANCESTORS = (process.env.CHARDHO_FRAME_ANCESTORS || "'self'").trim();
const EMBEDDABLE = FRAME_ANCESTORS !== "'self'";

// First run: create the schema and one randomly-passworded account per role.
// The credentials file is written next to the database, not into the project root.
if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0) {
  seed();
}

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ----------------------------- hardening ------------------------------ */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!EMBEDDABLE) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        `frame-ancestors ${FRAME_ANCESTORS}`,
      ].join('; '),
    );
  }
  next();
});

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(attachUser);
app.use('/api', originGuard);

/* ------------------------------- routes ------------------------------- */
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/portal', portalRouter);
app.use('/api/admin', adminRouter);
app.use('/api/work', workRouter);
app.use('/api/ai', aiRouter);
app.use('/api/dev', devRouter);
app.use('/api/v1', publicApiRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString(), uptime: Math.round(process.uptime()) }));

/* --------------------------- static front-end ------------------------- */
const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: IS_PROD ? '1h' : 0, index: false }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

/* ---------------------------- error handler --------------------------- */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found', message: `No API route for ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const payload = {
    error: err.code || 'internal_error',
    message: status >= 500 ? 'Something went wrong on our side.' : err.message,
  };
  if (err.details) payload.details = err.details;
  if (status >= 500) {
    console.error('[api]', err);
    try {
      db.prepare('INSERT INTO error_logs (level, source, message, meta) VALUES (?,?,?,?)').run(
        'error', `api${req.path}`, String(err.message).slice(0, 500), JSON.stringify({ route: req.originalUrl, ip: clientIp(req) }),
      );
    } catch { /* logging must never mask the original error */ }
  }
  res.status(status).json(payload);
});

if (process.env.CHARDHO_NO_LISTEN !== 'true') {
  app.listen(PORT, HOST, () => {
    console.log(`\n  CHARDHO-AI API listening on http://${HOST}:${PORT}`);
    console.log(`  Mode: ${IS_PROD ? 'production (serving dist/)' : 'development (Vite proxies /api)'}\n`);
  });
}

export default app;
