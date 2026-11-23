/**
 * CHARDHO-AI :: portal data
 * Every read is scoped by the caller's role on the server. The client only ever
 * receives rows it is allowed to see.
 */
import express from 'express';
import { db } from '../db.js';
import {
  asyncRoute, requireAuth, requirePortal, requirePermission, userSatisfies,
  audit, notFound, badRequest, forbidden, oneOf,
} from '../security.js';

export const portalRouter = express.Router();

const PORTALS = ['founder', 'super-admin', 'manager', 'staff', 'developer', 'app', 'support'];

/* ------------------------------------------------------------------ *
 * Resource registry — the only tables/columns the generic API exposes
 * ------------------------------------------------------------------ */
const RESOURCES = {
  tasks: {
    sql: `SELECT t.id, t.title, t.description, t.assigned_to, a.name AS assignee, t.created_by, c.name AS creator,
                 t.status, t.priority, t.due_date, t.progress, t.created_at, t.updated_at
          FROM tasks t LEFT JOIN users a ON a.id = t.assigned_to LEFT JOIN users c ON c.id = t.created_by`,
    read: ['tasks.read'],
    scope: (u) => (userSatisfies(u, ['tasks.read.all']) ? ['1=1', []] : ['t.assigned_to = ?', [u.id]]),
    filters: { status: 't.status', priority: 't.priority', assigned_to: 't.assigned_to' },
    search: ['t.title', 't.description'],
    order: 't.updated_at DESC',
  },
  tickets: {
    sql: `SELECT s.id, s.subject, s.description, s.user_id, u.name AS requester, s.assigned_to,
                 a.name AS assignee, s.status, s.priority, s.created_at, s.updated_at, s.resolved_at
          FROM support_tickets s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN users a ON a.id = s.assigned_to`,
    read: ['tickets.read'],
    scope: (u) => (userSatisfies(u, ['tickets.read.all']) ? ['1=1', []] : ['s.user_id = ?', [u.id]]),
    filters: { status: 's.status', priority: 's.priority', assigned_to: 's.assigned_to' },
    search: ['s.subject', 's.description'],
    order: `CASE s.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, s.created_at DESC`,
  },
  users: {
    sql: `SELECT u.id, u.email, u.name, r.key AS role, r.name AS role_name, u.status, u.email_verified,
                 u.totp_enabled, u.created_at, u.last_login_at
          FROM users u JOIN roles r ON r.id = u.role_id`,
    read: ['users.read'],
    scope: () => ['1=1', []],
    filters: { role: 'r.key', status: 'u.status' },
    search: ['u.email', 'u.name'],
    order: 'u.created_at DESC',
  },
  attendance: {
    sql: `SELECT a.id, a.user_id, u.name AS staff, a.work_date, a.check_in, a.check_out, a.status, a.note
          FROM attendance a JOIN users u ON u.id = a.user_id`,
    read: ['attendance.read'],
    scope: (u) => (userSatisfies(u, ['attendance.read.all']) ? ['1=1', []] : ['a.user_id = ?', [u.id]]),
    filters: { status: 'a.status', user_id: 'a.user_id' },
    search: [],
    order: 'a.work_date DESC',
  },
  staff: {
    sql: `SELECT sp.id, sp.user_id, u.name, u.email, sp.employee_code, sp.department, sp.designation,
                 sp.joined_at, sp.phone, m.name AS manager
          FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
          LEFT JOIN users m ON m.id = sp.manager_id`,
    read: ['staff.manage', 'users.read'],
    scope: () => ['1=1', []],
    filters: { department: 'sp.department' },
    search: ['u.name', 'sp.employee_code', 'sp.department'],
    order: 'sp.employee_code ASC',
  },
  agents: {
    sql: `SELECT ag.id, ag.key, ag.name, ag.description, ag.enabled, m.name AS model, ag.created_at
          FROM agents ag LEFT JOIN ai_models m ON m.id = ag.model_id`,
    read: ['agents.read'],
    scope: () => ['1=1', []],
    filters: { enabled: 'ag.enabled' },
    search: ['ag.name', 'ag.description'],
    order: 'ag.name ASC',
  },
  tools: {
    sql: `SELECT id, key, name, category, description, enabled, free_limit_daily, created_at FROM ai_tools`,
    read: ['ai_tools.read'],
    scope: () => ['1=1', []],
    filters: { enabled: 'enabled', category: 'category' },
    search: ['name', 'description'],
    order: 'name ASC',
  },
  models: {
    sql: `SELECT m.id, m.name, m.slug, p.name AS provider, m.context_window, m.enabled,
                 m.cost_per_1k_input, m.cost_per_1k_output
          FROM ai_models m LEFT JOIN ai_providers p ON p.id = m.provider_id`,
    read: ['ai_models.read'],
    scope: () => ['1=1', []],
    filters: { enabled: 'm.enabled', provider: 'p.slug' },
    search: ['m.name', 'm.slug'],
    order: 'm.name ASC',
  },
  providers: {
    // key_env_var is intentionally exposed; the actual secret is never stored in the database.
    sql: `SELECT id, name, slug, base_url, key_env_var, enabled, is_paid, created_at FROM ai_providers`,
    read: ['ai_providers.read'],
    scope: () => ['1=1', []],
    filters: { enabled: 'enabled' },
    search: ['name', 'slug'],
    order: 'name ASC',
  },
  usage: {
    sql: `SELECT ul.id, ul.user_id, u.name AS user_name, ul.tool_key, ul.model_slug, ul.tokens_in,
                 ul.tokens_out, ul.cost, ul.created_at
          FROM usage_logs ul LEFT JOIN users u ON u.id = ul.user_id`,
    read: ['usage.read.self'],
    scope: (u) => (userSatisfies(u, ['usage.read.all']) ? ['1=1', []] : ['ul.user_id = ?', [u.id]]),
    filters: { tool_key: 'ul.tool_key', user_id: 'ul.user_id' },
    search: [],
    order: 'ul.created_at DESC',
  },
  audit: {
    sql: `SELECT id, actor_id, actor_email, action, entity, entity_id, meta, ip, created_at FROM audit_logs`,
    read: ['audit.read'],
    scope: () => ['1=1', []],
    filters: { action: 'action', entity: 'entity' },
    search: ['action', 'actor_email', 'entity'],
    order: 'created_at DESC',
  },
  workflows: {
    sql: `SELECT id, name, description, trigger, enabled, created_at FROM workflows`,
    read: ['approvals.manage', 'reports.read', 'settings.write'],
    scope: () => ['1=1', []],
    filters: { enabled: 'enabled' },
    search: ['name', 'description'],
    order: 'name ASC',
  },
  workflow_runs: {
    sql: `SELECT we.id, we.workflow_id, w.name AS workflow, we.status, we.started_at, we.finished_at
          FROM workflow_executions we JOIN workflows w ON w.id = we.workflow_id`,
    read: ['approvals.manage', 'reports.read', 'settings.write'],
    scope: () => ['1=1', []],
    filters: { status: 'we.status' },
    search: [],
    order: 'we.started_at DESC',
  },
  deployments: {
    sql: `SELECT id, environment, version, status, note, created_at FROM deployments`,
    read: ['deploy.read'],
    scope: () => ['1=1', []],
    filters: { environment: 'environment', status: 'status' },
    search: ['version', 'note'],
    order: 'created_at DESC',
  },
  errors: {
    sql: `SELECT id, level, source, message, created_at FROM error_logs`,
    read: ['logs.read'],
    scope: () => ['1=1', []],
    filters: { level: 'level', source: 'source' },
    search: ['source', 'message'],
    order: 'created_at DESC',
  },
  apikeys: {
    sql: `SELECT k.id, k.user_id, k.label, k.prefix, k.scopes, k.created_at, k.last_used_at, k.revoked_at
          FROM api_keys k`,
    read: ['apikeys.read'],
    scope: (u) => (u.role === 'founder' ? ['1=1', []] : ['k.user_id = ?', [u.id]]),
    filters: {},
    search: ['k.label', 'k.prefix'],
    order: 'k.created_at DESC',
  },
  webhooks: {
    sql: `SELECT id, user_id, url, events, enabled, created_at FROM webhooks`,
    read: ['webhooks.manage'],
    scope: (u) => (u.role === 'founder' ? ['1=1', []] : ['user_id = ?', [u.id]]),
    filters: { enabled: 'enabled' },
    search: ['url'],
    order: 'created_at DESC',
  },
  notifications: {
    sql: `SELECT id, user_id, title, body, is_read, created_at FROM notifications`,
    read: ['portal.app.access', 'portal.staff.access', 'portal.manager.access', 'portal.developer.access', 'portal.superadmin.access', 'portal.support.access', 'portal.founder.access'],
    scope: (u) => ['user_id = ?', [u.id]],
    filters: { is_read: 'is_read' },
    search: ['title', 'body'],
    order: 'created_at DESC',
  },
};

portalRouter.get(
  '/resources/:name',
  requireAuth,
  asyncRoute(async (req, res) => {
    const resource = RESOURCES[req.params.name];
    if (!resource) throw notFound(`Unknown resource: ${req.params.name}`);
    if (!userSatisfies(req.user, resource.read)) throw forbidden('You do not have access to this data');

    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [scopeSql, scopeParams] = resource.scope(req.user);
    const clauses = [scopeSql];
    const params = [...scopeParams];

    for (const [name, column] of Object.entries(resource.filters || {})) {
      const value = req.query[name];
      if (value !== undefined && value !== '' && value !== 'all') {
        clauses.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (req.query.q && resource.search?.length) {
      const like = `%${String(req.query.q).slice(0, 100)}%`;
      clauses.push(`(${resource.search.map((c) => `${c} LIKE ?`).join(' OR ')})`);
      resource.search.forEach(() => params.push(like));
    }

    const where = clauses.join(' AND ');
    const rows = db.prepare(`${resource.sql} WHERE ${where} ORDER BY ${resource.order} LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) AS c FROM (${resource.sql} WHERE ${where})`).get(...params).c;

    res.json({ resource: req.params.name, rows, total, limit, offset });
  }),
);

/* ------------------------------------------------------------------ *
 * Dashboards
 * ------------------------------------------------------------------ */
const one = (sql, ...params) => db.prepare(sql).get(...params) || {};
const all = (sql, ...params) => db.prepare(sql).all(...params);

function countryMix() {
  return [
    { label: 'India', value: 62 }, { label: 'UAE', value: 11 }, { label: 'United Kingdom', value: 9 },
    { label: 'United States', value: 8 }, { label: 'Singapore', value: 5 }, { label: 'Other', value: 5 },
  ];
}

function dashboards(user) {
  const usage7 = one(`SELECT COUNT(*) AS requests, COALESCE(SUM(tokens_in + tokens_out),0) AS tokens,
                             COALESCE(SUM(cost),0) AS cost FROM usage_logs
                      WHERE datetime(created_at) >= datetime('now','-7 day')`);
  const usagePrev7 = one(`SELECT COUNT(*) AS requests FROM usage_logs
                          WHERE datetime(created_at) >= datetime('now','-14 day')
                            AND datetime(created_at) < datetime('now','-7 day')`);
  const activeUsers = one(`SELECT COUNT(DISTINCT user_id) AS c FROM usage_logs WHERE datetime(created_at) >= datetime('now','-7 day')`).c || 0;
  const totals = {
    users: one('SELECT COUNT(*) AS c FROM users').c || 0,
    activeUsers,
    requests7d: usage7.requests || 0,
    tokens7d: usage7.tokens || 0,
    cost7d: usage7.cost || 0,
    growth: usagePrev7.requests ? Math.round(((usage7.requests - usagePrev7.requests) / usagePrev7.requests) * 100) : 100,
    openTickets: one(`SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('open','pending')`).c || 0,
    liveSessions: one(`SELECT COUNT(*) AS c FROM sessions WHERE revoked_at IS NULL AND datetime(expires_at) > datetime('now')`).c || 0,
  };

  const base = { totals, countryMix: countryMix() };

  switch (user.portal) {
    case 'founder':
    case 'super-admin':
      return {
        ...base,
        kind: user.portal,
        roleSplit: all(`SELECT r.name AS label, COUNT(u.id) AS value FROM roles r LEFT JOIN users u ON u.role_id = r.id GROUP BY r.id ORDER BY r.rank`),
        toolUsage: all(`SELECT tool_key AS label, COUNT(*) AS value FROM usage_logs WHERE datetime(created_at) >= datetime('now','-30 day') GROUP BY tool_key ORDER BY value DESC LIMIT 8`),
        dailyUsage: all(`SELECT date(created_at) AS day, COUNT(*) AS requests FROM usage_logs WHERE datetime(created_at) >= datetime('now','-14 day') GROUP BY day ORDER BY day`),
        recentActivity: all(`SELECT action, actor_email, entity, created_at FROM audit_logs ORDER BY id DESC LIMIT 8`),
        tickets: one(`SELECT SUM(status='open') AS open, SUM(status='pending') AS pending, SUM(status='resolved') AS resolved FROM support_tickets`),
        providers: all(`SELECT p.name, p.slug, p.enabled, p.is_paid, m.name AS model FROM ai_providers p LEFT JOIN ai_models m ON m.provider_id = p.id`),
      };
    case 'manager': {
      const team = all(`SELECT u.id, u.name, r.key AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE r.key IN ('staff')`);
      return {
        ...base,
        kind: 'manager',
        team,
        taskSummary: all(`SELECT status AS label, COUNT(*) AS value FROM tasks GROUP BY status`),
        myTasks: all(`SELECT id, title, status, priority, due_date, progress FROM tasks WHERE assigned_to = ? ORDER BY updated_at DESC LIMIT 5`, user.id),
        pendingApprovals: one(`SELECT COUNT(*) AS c FROM tasks WHERE status = 'review'`).c || 0,
        attendanceToday: one(`SELECT COUNT(*) AS c FROM attendance WHERE work_date = date('now')`).c || 0,
        openTickets: one(`SELECT COUNT(*) AS c FROM support_tickets WHERE status IN ('open','pending')`).c || 0,
        dailyUsage: all(`SELECT date(created_at) AS day, COUNT(*) AS requests FROM usage_logs WHERE datetime(created_at) >= datetime('now','-14 day') GROUP BY day ORDER BY day`),
      };
    }
    case 'staff':
      return {
        ...base,
        kind: 'staff',
        myTasks: all(`SELECT id, title, status, priority, due_date, progress FROM tasks WHERE assigned_to = ? ORDER BY status, due_date`, user.id),
        taskSummary: all(`SELECT status AS label, COUNT(*) AS value FROM tasks WHERE assigned_to = ? GROUP BY status`, user.id),
        attendance: all(`SELECT work_date, check_in, check_out, status FROM attendance WHERE user_id = ? ORDER BY work_date DESC LIMIT 10`, user.id),
        checkedInToday: !!one(`SELECT id FROM attendance WHERE user_id = ? AND work_date = date('now')`, user.id).id,
        myUsage: one(`SELECT COUNT(*) AS requests FROM usage_logs WHERE user_id = ? AND datetime(created_at) >= datetime('now','-7 day')`, user.id),
        notifications: all(`SELECT id, title, body, created_at FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY id DESC LIMIT 5`, user.id),
        leaveBalance: 12,
      };
    case 'developer':
      return {
        ...base,
        kind: 'developer',
        deployments: all(`SELECT environment, version, status, created_at FROM deployments ORDER BY created_at DESC LIMIT 5`),
        errorRate: all(`SELECT level AS label, COUNT(*) AS value FROM error_logs GROUP BY level`),
        recentErrors: all(`SELECT id, level, source, message, created_at FROM error_logs ORDER BY id DESC LIMIT 6`),
        apiKeys: one(`SELECT COUNT(*) AS c FROM api_keys WHERE revoked_at IS NULL`).c || 0,
        dailyUsage: all(`SELECT date(created_at) AS day, COUNT(*) AS requests FROM usage_logs WHERE datetime(created_at) >= datetime('now','-14 day') GROUP BY day ORDER BY day`),
      };
    case 'support':
      return {
        ...base,
        kind: 'support',
        ticketSummary: all(`SELECT status AS label, COUNT(*) AS value FROM support_tickets GROUP BY status`),
        unassigned: one(`SELECT COUNT(*) AS c FROM support_tickets WHERE assigned_to IS NULL`).c || 0,
        myTickets: all(`SELECT id, subject, status, priority, created_at FROM support_tickets WHERE assigned_to = ? ORDER BY created_at DESC LIMIT 5`, user.id),
        queue: all(`SELECT s.id, s.subject, s.status, s.priority, u.name AS requester FROM support_tickets s LEFT JOIN users u ON u.id=s.user_id WHERE s.status IN ('open','pending') ORDER BY CASE s.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 6`),
      };
    case 'app':
    default:
      return {
        ...base,
        kind: 'app',
        myUsage: one(`SELECT COUNT(*) AS requests, COALESCE(SUM(tokens_in+tokens_out),0) AS tokens FROM usage_logs WHERE user_id = ? AND datetime(created_at) >= datetime('now','-1 day')`, user.id),
        tools: all(`SELECT key, name, category, description, enabled, free_limit_daily FROM ai_tools WHERE enabled = 1 ORDER BY category`),
        conversations: all(`SELECT id, title, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5`, user.id),
        dailyUsage: all(`SELECT date(created_at) AS day, COUNT(*) AS requests FROM usage_logs WHERE user_id = ? AND datetime(created_at) >= datetime('now','-14 day') GROUP BY day ORDER BY day`, user.id),
        agents: all(`SELECT key, name, description FROM agents WHERE enabled = 1 LIMIT 6`),
      };
  }
}

portalRouter.get(
  '/:portal/dashboard',
  requireAuth,
  requirePortal(':portal'),
  asyncRoute(async (req, res) => {
    const portal = req.params.portal;
    if (!PORTALS.includes(portal)) throw notFound('Unknown portal');
    // A founder browsing another portal still gets that portal's view, scoped to the founder account.
    const viewUser = { ...req.user, portal };
    res.json({ portal, ...dashboards(viewUser) });
  }),
);

/* ------------------------------------------------------------------ *
 * Portal settings
 * ------------------------------------------------------------------ */
portalRouter.get(
  '/:portal/settings',
  requireAuth,
  requirePortal(':portal'),
  asyncRoute(async (req, res) => {
    const rows = all(`SELECT key, value, updated_at FROM portal_settings WHERE portal = ? ORDER BY key`, req.params.portal);
    const globals = all(`SELECT key, value, updated_at FROM portal_settings WHERE portal = 'global' ORDER BY key`);
    res.json({ settings: rows, global: globals, canEdit: userSatisfies(req.user, ['settings.write']) });
  }),
);

portalRouter.put(
  '/:portal/settings',
  requireAuth,
  requirePortal(':portal'),
  requirePermission('settings.write'),
  asyncRoute(async (req, res) => {
    const updates = req.body?.settings;
    if (!updates || typeof updates !== 'object') throw badRequest('settings object is required');
    const stmt = db.prepare(
      `INSERT INTO portal_settings (portal, key, value, updated_at, updated_by) VALUES (?,?,?,datetime('now'),?)
       ON CONFLICT(portal, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now'), updated_by = excluded.updated_by`,
    );
    for (const [key, value] of Object.entries(updates)) {
      if (!/^[a-z0-9_.]{1,64}$/i.test(key)) throw badRequest(`Invalid setting key: ${key}`);
      stmt.run(req.params.portal, key, String(value).slice(0, 500), req.user.id);
    }
    audit(req, 'settings.update', { entity: 'portal_settings', entityId: req.params.portal, meta: { keys: Object.keys(updates) } });
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */
portalRouter.get(
  '/notifications',
  requireAuth,
  asyncRoute(async (req, res) => {
    const rows = all(`SELECT id, title, body, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40`, req.user.id);
    const unread = one(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`, req.user.id).c;
    res.json({ notifications: rows, unread });
  }),
);

portalRouter.post(
  '/notifications/read',
  requireAuth,
  asyncRoute(async (req, res) => {
    const id = req.body?.id;
    if (id === 'all') {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id);
    }
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */
portalRouter.get(
  '/profile',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = one(
      `SELECT u.id, u.email, u.name, u.created_at, u.last_login_at, u.totp_enabled, u.email_verified,
              r.name AS role_name, r.key AS role, r.portal
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      req.user.id,
    );
    const staff = one('SELECT employee_code, department, designation, joined_at, phone FROM staff_profiles WHERE user_id = ?', req.user.id);
    res.json({ profile: user, staff: staff.id ? staff : null, permissions: req.user.permissions });
  }),
);

portalRouter.patch(
  '/profile',
  requireAuth,
  asyncRoute(async (req, res) => {
    const name = req.body?.name;
    if (typeof name === 'string' && name.trim().length >= 2) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim().slice(0, 80), req.user.id);
      audit(req, 'profile.update', { entity: 'users', entityId: req.user.id });
    }
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------------ *
 * Reports (aggregate, permission-gated)
 * ------------------------------------------------------------------ */
portalRouter.get(
  '/:portal/reports',
  requireAuth,
  requirePortal(':portal'),
  requirePermission('reports.read', 'usage.read.all', 'usage.read.self'),
  asyncRoute(async (req, res) => {
    const scopeAll = userSatisfies(req.user, ['usage.read.all']);
    const where = scopeAll ? '1=1' : 'user_id = ?';
    const params = scopeAll ? [] : [req.user.id];
    res.json({
      scopedTo: scopeAll ? 'platform' : 'self',
      byTool: all(`SELECT tool_key AS label, COUNT(*) AS value, SUM(tokens_in+tokens_out) AS tokens FROM usage_logs WHERE ${where} GROUP BY tool_key ORDER BY value DESC`, ...params),
      byDay: all(`SELECT date(created_at) AS day, COUNT(*) AS value FROM usage_logs WHERE ${where} AND datetime(created_at) >= datetime('now','-30 day') GROUP BY day ORDER BY day`, ...params),
      byRole: scopeAll ? all(`SELECT r.name AS label, COUNT(DISTINCT ul.user_id) AS value FROM usage_logs ul JOIN users u ON u.id=ul.user_id JOIN roles r ON r.id=u.role_id GROUP BY r.id`) : [],
      totals: one(`SELECT COUNT(*) AS requests, COALESCE(SUM(tokens_in+tokens_out),0) AS tokens, COALESCE(SUM(cost),0) AS cost FROM usage_logs WHERE ${where}`, ...params),
    });
  }),
);

export { RESOURCES };
