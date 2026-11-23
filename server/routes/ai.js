/**
 * CHARDHO-AI :: AI workspace
 *
 * IMPORTANT: no paid AI provider is enabled by default and none is called without
 * Owner approval. The default "local engine" composes deterministic, useful
 * responses on the server. When the Owner enables a provider and sets its key in
 * the environment, `callProvider` becomes the integration point — API keys are
 * read from process.env only and never reach the browser.
 */
import express from 'express';
import { db } from '../db.js';
import {
  asyncRoute, requireAuth, requirePermission, audit, badRequest, notFound, forbidden,
  requireFields, stringField, HttpError,
} from '../security.js';

export const aiRouter = express.Router();

const today = () => new Date().toISOString().slice(0, 10);

function toolByKey(key) {
  return db.prepare('SELECT * FROM ai_tools WHERE key = ?').get(key);
}

function usageToday(userId, toolKey) {
  return db.prepare(
    `SELECT COUNT(*) AS c FROM usage_logs WHERE user_id = ? AND tool_key = ? AND date(created_at) = date('now')`,
  ).get(userId, toolKey).c;
}

/** Enforces the per-tool fair-use limit configured by the Founder/Admin. */
function checkFairUse(user, tool) {
  if (['founder', 'super_admin'].includes(user.role)) return;
  const used = usageToday(user.id, tool.key);
  if (used >= tool.free_limit_daily) {
    throw new HttpError(429, 'fair_use_limit', `Daily fair-use limit reached for ${tool.name} (${tool.free_limit_daily}/day). It resets at midnight UTC.`);
  }
}

function logUsage(userId, toolKey, tokensIn, tokensOut, meta = {}) {
  db.prepare(
    'INSERT INTO usage_logs (user_id, tool_key, model_slug, tokens_in, tokens_out, cost, meta) VALUES (?,?,?,?,?,?,?)',
  ).run(userId, toolKey, 'chardho-core', tokensIn, tokensOut, 0, JSON.stringify(meta).slice(0, 1000));
}

/**
 * Local deterministic engine.
 * Produces structured, genuinely useful output (plans, outlines, checklists)
 * without contacting any third party.
 */
function localEngine({ tool, prompt, agent }) {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const topic = words.slice(0, 9).join(' ') || 'your request';

  const opener = {
    chat: `Here is a focused answer on "${topic}".`,
    writer: `Draft copy for "${topic}"`,
    coder: `Implementation notes for "${topic}"`,
    pdf: `Document summary — "${topic}"`,
    'site-builder': `Landing page blueprint for "${topic}"`,
    agents: `Agent plan — "${topic}"`,
  }[tool.key] || `Assistant response for "${topic}"`;

  const wantsCode = /code|function|bug|error|react|python|sql|api/i.test(lower);
  const wantsPlan = /plan|launch|strategy|roadmap|grow|market/i.test(lower);

  const body = [];
  body.push(opener, '');

  if (tool.key === 'coder' || wantsCode) {
    body.push(
      'Approach:',
      '1. Reproduce the problem with the smallest possible input.',
      '2. Isolate the failing boundary (input validation, auth, or data access).',
      '3. Write the assertion first, then the fix.',
      '4. Keep the change reviewable — one behaviour per commit.',
      '',
      '```js',
      '// Example guard for the failure mode you described',
      'export function safeParse(input) {',
      '  if (typeof input !== "string" || input.length === 0) {',
      '    throw new Error("input must be a non-empty string");',
      '  }',
      '  return JSON.parse(input);',
      '}',
      '```',
    );
  } else if (wantsPlan || tool.key === 'site-builder' || tool.key === 'agents') {
    body.push(
      'A four-week sequence you can act on today:',
      '',
      '• Week 1 — Foundation: define the single metric that decides success, list the three assets you already have, and publish one page that states the offer plainly.',
      '• Week 2 — Validation: put it in front of ten people who fit the audience. Record objections verbatim; they are your copy brief.',
      '• Week 3 — Distribution: pick two channels only. One owned (list or community), one borrowed (partner or marketplace).',
      '• Week 4 — Compounding: turn the top three questions into reusable content, then measure again against the week-one metric.',
    );
  } else if (tool.key === 'pdf') {
    body.push(
      'How I would read this document:',
      '1. Skim headings and the final paragraph for the author\'s conclusion.',
      '2. Extract every figure and date into one table — that is where errors hide.',
      '3. Separate stated facts from recommendations.',
      '4. Write a five-line summary: purpose, method, finding, limitation, next step.',
    );
  } else {
    body.push(
      `A useful way to structure this:`,
      '',
      '• What you are actually deciding — state it in one line.',
      '• What you already know — list the constraints you cannot change.',
      '• What would change your mind — name the evidence that would. If nothing would, it is not a decision.',
      '• The smallest next step — something you can complete this week.',
    );
  }

  if (agent) {
    body.push('', `— ${agent.name}: ${agent.description || 'Specialist agent'} —`);
  }
  body.push('', `Ask a follow-up to go deeper on any of the four points.`);

  return body.join('\n');
}

/** Hook for a real provider. Only called when the Owner enables one. */
async function callProvider(_provider, _payload) {
  throw new HttpError(501, 'provider_not_configured',
    'No external AI provider is enabled. Enable one in the Founder portal after setting its key in the server environment.');
}

/* --------------------------------- tools ------------------------------ */
aiRouter.get(
  '/tools',
  requireAuth,
  requirePermission('ai_tools.read', 'portal.app.access'),
  asyncRoute(async (req, res) => {
    const tools = db.prepare('SELECT key, name, category, description, enabled, free_limit_daily FROM ai_tools ORDER BY category, name').all();
    const withUsage = tools.map((t) => ({ ...t, used_today: usageToday(req.user.id, t.key) }));
    res.json({ tools: withUsage });
  }),
);

/* ----------------------------- conversations -------------------------- */
aiRouter.get(
  '/conversations',
  requireAuth,
  asyncRoute(async (req, res) => {
    const rows = db.prepare(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC`,
    ).all(req.user.id);
    res.json({ conversations: rows });
  }),
);

aiRouter.post(
  '/conversations',
  requireAuth,
  asyncRoute(async (req, res) => {
    const title = req.body?.title ? stringField(req.body.title, 'title', { max: 120 }) : 'New conversation';
    const agent = req.body?.agentKey ? db.prepare('SELECT id FROM agents WHERE key = ?').get(req.body.agentKey) : null;
    const result = db.prepare('INSERT INTO conversations (user_id, title, agent_id) VALUES (?,?,?)').run(req.user.id, title, agent?.id ?? null);
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  }),
);

aiRouter.get(
  '/conversations/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!conv) throw notFound('Conversation not found');
    // Ownership check: users may only read their own conversations.
    if (conv.user_id !== req.user.id && req.user.role !== 'founder') throw forbidden('This conversation belongs to another user');
    const messages = db.prepare('SELECT id, role, content, tokens, created_at FROM messages WHERE conversation_id = ? ORDER BY id').all(conv.id);
    res.json({ conversation: conv, messages });
  }),
);

aiRouter.delete(
  '/conversations/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!conv) throw notFound('Conversation not found');
    if (conv.user_id !== req.user.id && req.user.role !== 'founder') throw forbidden('This conversation belongs to another user');
    db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
    audit(req, 'ai.conversation_deleted', { entity: 'conversations', entityId: conv.id });
    res.json({ ok: true });
  }),
);

/* --------------------------------- chat ------------------------------- */
aiRouter.post(
  '/chat',
  requireAuth,
  requirePermission('chat.use'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['message']);
    const message = stringField(req.body.message, 'message', { min: 1, max: 8000 });
    const tool = toolByKey('chat');
    if (!tool?.enabled) throw forbidden('AI chat is currently disabled by the administrator');
    checkFairUse(req.user, tool);

    let convId = req.body.conversationId ? Number(req.body.conversationId) : null;
    let conv = null;
    if (convId) {
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
      if (!conv) throw notFound('Conversation not found');
      if (conv.user_id !== req.user.id) throw forbidden('This conversation belongs to another user');
    } else {
      const title = message.split(/\s+/).slice(0, 7).join(' ').slice(0, 90) || 'New conversation';
      const result = db.prepare('INSERT INTO conversations (user_id, title) VALUES (?,?)').run(req.user.id, title);
      convId = Number(result.lastInsertRowid);
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    }

    const agent = req.body.agentKey ? db.prepare('SELECT * FROM agents WHERE key = ? AND enabled = 1').get(req.body.agentKey) : null;
    const userTokens = Math.ceil(message.length / 4);
    db.prepare('INSERT INTO messages (conversation_id, role, content, tokens) VALUES (?,?,?,?)').run(convId, 'user', message, userTokens);

    const reply = localEngine({ tool, prompt: message, agent });
    const replyTokens = Math.ceil(reply.length / 4);
    db.prepare('INSERT INTO messages (conversation_id, role, content, tokens) VALUES (?,?,?,?)').run(convId, 'assistant', reply, replyTokens);
    db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(convId);
    logUsage(req.user.id, 'chat', userTokens, replyTokens, { agent: agent?.key || null, mode: 'local-engine' });

    res.json({
      conversationId: convId,
      reply,
      engine: 'local',
      notice: 'Answered by the local CHARDHO engine. No external AI provider is enabled.',
      usage: { usedToday: usageToday(req.user.id, 'chat'), limit: tool.free_limit_daily },
    });
  }),
);

/* ----------------------------- image studio --------------------------- */
aiRouter.post(
  '/images',
  requireAuth,
  requirePermission('images.generate'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['prompt']);
    const prompt = stringField(req.body.prompt, 'prompt', { min: 3, max: 500 });
    const tool = toolByKey('image');
    if (!tool?.enabled) throw forbidden('Image generation is disabled by the administrator');
    checkFairUse(req.user, tool);

    // Procedural, deterministic artwork — no third-party service, no cost.
    const seed = [...prompt].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
    const hue = seed;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="640" viewBox="0 0 1024 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue},85%,58%)"/>
      <stop offset="55%" stop-color="hsl(${(hue + 60) % 360},80%,45%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 190) % 360},85%,38%)"/>
    </linearGradient>
    <radialGradient id="r"><stop offset="0%" stop-color="#fff" stop-opacity="0.55"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1024" height="640" fill="#05060f"/>
  <rect width="1024" height="640" fill="url(#g)" opacity="0.55"/>
  <circle cx="${120 + (seed * 7) % 700}" cy="${140 + (seed * 3) % 320}" r="260" fill="url(#r)"/>
  ${Array.from({ length: 18 }, (_, i) => `<circle cx="${(i * 137 + seed * 11) % 1024}" cy="${(i * 89 + seed * 5) % 640}" r="${6 + ((i * seed) % 22)}" fill="hsl(${(hue + i * 17) % 360},95%,72%)" opacity="0.5"/>`).join('\n  ')}
  <text x="48" y="596" fill="#ffffffcc" font-family="Inter,system-ui,sans-serif" font-size="26">${prompt.replace(/[<>&]/g, '').slice(0, 70)}</text>
</svg>`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    logUsage(req.user.id, 'image', Math.ceil(prompt.length / 4), 0, { mode: 'procedural' });
    res.json({
      image: dataUrl,
      engine: 'procedural',
      notice: 'Generated locally as concept artwork. Connect an image provider in the Founder portal for photorealistic output.',
      usage: { usedToday: usageToday(req.user.id, 'image'), limit: tool.free_limit_daily },
    });
  }),
);

/* -------------------------------- usage ------------------------------- */
aiRouter.get(
  '/usage',
  requireAuth,
  asyncRoute(async (req, res) => {
    const summary = db.prepare(
      `SELECT COUNT(*) AS requests, COALESCE(SUM(tokens_in),0) AS tokens_in, COALESCE(SUM(tokens_out),0) AS tokens_out,
              COALESCE(SUM(cost),0) AS cost FROM usage_logs WHERE user_id = ?`,
    ).get(req.user.id);
    const byTool = db.prepare(
      `SELECT tool_key AS tool, COUNT(*) AS requests FROM usage_logs WHERE user_id = ? GROUP BY tool_key ORDER BY requests DESC`,
    ).all(req.user.id);
    const limits = db.prepare('SELECT key, name, free_limit_daily FROM ai_tools WHERE enabled = 1').all()
      .map((t) => ({ ...t, used_today: usageToday(req.user.id, t.key) }));
    res.json({ summary, byTool, limits });
  }),
);

/* -------------------------------- agents ------------------------------ */
aiRouter.get(
  '/agents',
  requireAuth,
  requirePermission('agents.read'),
  asyncRoute(async (_req, res) => {
    res.json({
      agents: db.prepare(
        `SELECT a.key, a.name, a.description, a.enabled, m.name AS model FROM agents a
         LEFT JOIN ai_models m ON m.id = a.model_id WHERE a.enabled = 1`,
      ).all(),
    });
  }),
);

aiRouter.post(
  '/agents/:key/run',
  requireAuth,
  requirePermission('agents.run'),
  asyncRoute(async (req, res) => {
    const agent = db.prepare('SELECT * FROM agents WHERE key = ? AND enabled = 1').get(req.params.key);
    if (!agent) throw notFound('Agent not found');
    const input = stringField(req.body?.input ?? '', 'input', { max: 4000 });
    const tool = toolByKey('agents');
    checkFairUse(req.user, tool);
    const output = localEngine({ tool, prompt: input || agent.description || agent.name, agent });
    logUsage(req.user.id, 'agents', Math.ceil(input.length / 4), Math.ceil(output.length / 4), { agent: agent.key });
    res.json({ agent: agent.key, output, engine: 'local' });
  }),
);
