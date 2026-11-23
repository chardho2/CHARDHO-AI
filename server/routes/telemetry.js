/**
 * CHARDHO-AI :: client telemetry
 *
 * Browser crashes are posted here so they reach the server log and the
 * Developer portal's error monitor. It is deliberately unauthenticated — the
 * failure may happen before anyone has signed in — so the endpoint accepts only
 * short, bounded strings, is rate limited per IP, and never echoes input back.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { clientIp, rateLimit } from '../security.js';

export const telemetryRouter = Router();

/** Strip control characters (log injection) and cap the length. */
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);

telemetryRouter.post(
  '/client-errors',
  rateLimit({ key: (req) => `client-error:${clientIp(req)}`, limit: 20, windowMs: 60_000 }),
  (req, res) => {
    const body = req.body || {};
    if (typeof body.message !== 'string' || !body.message.trim()) {
      return res.status(400).json({ error: 'bad_request', message: 'message is required' });
    }

    const kind = clean(body.kind, 20) || 'error';
    const message = clean(body.message, 500);
    const meta = JSON.stringify({
      route: clean(body.route, 200),
      stack: clean(body.stack, 2000),
      componentStack: clean(body.componentStack, 2000),
      userAgent: clean(body.userAgent, 200),
      ip: clientIp(req),
    });

    try {
      db.prepare('INSERT INTO error_logs (level, source, message, meta) VALUES (?,?,?,?)').run(
        'error',
        `client:${kind}`,
        message,
        meta,
      );
    } catch (err) {
      console.error('[telemetry] could not persist client error:', err.message);
    }

    console.warn(`[client-error] ${kind}: ${message}`);
    res.status(204).end();
  },
);
