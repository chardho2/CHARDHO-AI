/**
 * CHARDHO-AI :: public marketing API
 * Deliberately read-only and free of personal data.
 */
import express from 'express';
import { db } from '../db.js';
import { asyncRoute, rateLimit, requireFields, stringField, emailField, badRequest, HttpError } from '../security.js';

export const publicRouter = express.Router();

publicRouter.get('/stats', (_req, res) => {
  const totals = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM usage_logs) AS requests,
       (SELECT COUNT(*) FROM ai_tools WHERE enabled = 1) AS tools,
       (SELECT COUNT(*) FROM agents WHERE enabled = 1) AS agents,
       (SELECT COUNT(*) FROM conversations) AS conversations`,
  ).get();
  res.json({
    stats: [
      { label: 'Registered users', value: totals.users, suffix: '+' },
      { label: 'AI requests served', value: totals.requests, suffix: '+' },
      { label: 'Free AI tools', value: totals.tools, suffix: '' },
      { label: 'Specialist agents', value: totals.agents, suffix: '' },
    ],
    live: true,
  });
});

publicRouter.get('/tools', (_req, res) => {
  res.json({
    tools: db.prepare('SELECT key, name, category, description FROM ai_tools WHERE enabled = 1 ORDER BY category, name').all(),
  });
});

publicRouter.get('/agents', (_req, res) => {
  res.json({ agents: db.prepare('SELECT key, name, description FROM agents WHERE enabled = 1 ORDER BY name').all() });
});

publicRouter.get('/platform', (_req, res) => {
  const rows = db.prepare(`SELECT key, value FROM portal_settings WHERE portal = 'global'`).all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    platformName: map.platform_name || 'CHARDHO AI',
    company: map.company || 'CHARDHO LLP',
    supportEmail: map.support_email || null,
    registrationOpen: (map.registration_open || 'true') === 'true',
    maintenanceMode: (map.maintenance_mode || 'false') === 'true',
  });
});

publicRouter.post(
  '/contact',
  rateLimit({ key: (req) => `contact:${req.ip}`, limit: 5, windowMs: 60 * 60 * 1000 }),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'message']);
    const name = stringField(req.body.name, 'name', { min: 2, max: 80 });
    const email = emailField(req.body.email);
    const message = stringField(req.body.message, 'message', { min: 10, max: 4000 });

    // A contact message becomes a support ticket so nothing is lost.
    const result = db.prepare(
      'INSERT INTO support_tickets (subject, description, user_id, priority) VALUES (?,?,?,?)',
    ).run(`Website enquiry from ${name}`, `${message}\n\nReply to: ${email}`, null, 'medium');
    db.prepare('INSERT INTO audit_logs (actor_email, action, entity, entity_id, meta) VALUES (?,?,?,?,?)').run(
      email, 'contact.message', 'support_tickets', String(result.lastInsertRowid), '{"source":"website"}',
    );
    res.status(201).json({ ok: true, message: 'Thank you — our team will reply within one business day.' });
  }),
);

publicRouter.get('/health', (_req, res) => {
  const started = process.uptime();
  res.json({ ok: true, uptimeSeconds: Math.round(started), time: new Date().toISOString() });
});
