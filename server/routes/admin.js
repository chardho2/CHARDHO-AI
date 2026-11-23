/**
 * CHARDHO-AI :: administration
 * User management, permission grants, AI configuration, audit, backups.
 */
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, hashPassword, ALL_PERMISSION_KEYS, FOUNDER_ONLY, DATA_DIR } from '../db.js';
import {
  asyncRoute, requireAuth, requirePermission, audit, notFound, badRequest, forbidden,
  requireFields, stringField, emailField, oneOf,
} from '../security.js';
import { revokeAllSessions } from '../auth.js';

export const adminRouter = express.Router();

const ROLES = ['founder', 'super_admin', 'manager', 'staff', 'developer', 'support', 'user'];

/* ------------------------------- users -------------------------------- */
adminRouter.get(
  '/users',
  requireAuth,
  requirePermission('users.read'),
  asyncRoute(async (_req, res) => {
    const rows = db.prepare(
      `SELECT u.id, u.email, u.name, r.key AS role, r.name AS role_name, u.status,
              u.email_verified, u.totp_enabled, u.created_at, u.last_login_at
       FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id ASC`,
    ).all();
    res.json({ users: rows });
  }),
);

adminRouter.post(
  '/users',
  requireAuth,
  requirePermission('users.write'),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'role']);
    const name = stringField(req.body.name, 'name', { min: 2, max: 80 });
    const email = emailField(req.body.email);
    const roleKey = oneOf(req.body.role, ROLES, 'role');

    // Only the Founder may create another Founder or grant founder-level access.
    if (roleKey === 'founder' && req.user.role !== 'founder') {
      throw forbidden('Only the Founder can create another Founder account');
    }
    if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email)) {
      throw badRequest('An account with that email already exists');
    }

    // A generated temporary password is returned once; there is no hardcoded default.
    const tempPassword = `Chd-${crypto.randomBytes(9).toString('base64url')}!4`;
    const role = db.prepare('SELECT * FROM roles WHERE key = ?').get(roleKey);
    const result = db.prepare(
      `INSERT INTO users (email, password_hash, name, role_id, email_verified, must_change_password)
       VALUES (?,?,?,?,1,1)`,
    ).run(email, hashPassword(tempPassword), name, role.id);
    const id = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)').run(id, role.id);
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(
      id, 'Account created', `Your ${role.name} account was created. Change your temporary password on first sign-in.`,
    );
    audit(req, 'users.create', { entity: 'users', entityId: id, meta: { role: roleKey } });
    res.status(201).json({ ok: true, id, tempPassword, homeRoute: role.home_route });
  }),
);

adminRouter.patch(
  '/users/:id',
  requireAuth,
  requirePermission('users.write'),
  asyncRoute(async (req, res) => {
    const target = db.prepare('SELECT u.*, r.key AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id = ?').get(req.params.id);
    if (!target) throw notFound('User not found');
    if (target.role === 'founder' && req.user.role !== 'founder') throw forbidden('Only the Founder can modify the Founder account');
    if (target.id === req.user.id && req.body.status && req.body.status !== 'active') {
      throw badRequest('You cannot deactivate your own account');
    }

    const updates = [];
    const params = [];
    if (req.body.name !== undefined) {
      updates.push('name = ?');
      params.push(stringField(req.body.name, 'name', { min: 2, max: 80 }));
    }
    if (req.body.status !== undefined) {
      updates.push('status = ?');
      params.push(oneOf(req.body.status, ['active', 'suspended'], 'status'));
    }
    if (req.body.role !== undefined) {
      const roleKey = oneOf(req.body.role, ROLES, 'role');
      if (roleKey === 'founder' && req.user.role !== 'founder') throw forbidden('Only the Founder can grant Founder access');
      const role = db.prepare('SELECT id FROM roles WHERE key = ?').get(roleKey);
      updates.push('role_id = ?');
      params.push(role.id);
      db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(target.id);
      db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)').run(target.id, role.id);
    }
    if (!updates.length) throw badRequest('No supported fields to update');

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params, target.id);
    if (req.body.status === 'suspended') revokeAllSessions(target.id);
    audit(req, 'users.update', { entity: 'users', entityId: target.id, meta: { fields: Object.keys(req.body) } });
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/users/:id/reset-password',
  requireAuth,
  requirePermission('users.write'),
  asyncRoute(async (req, res) => {
    const target = db.prepare('SELECT u.*, r.key AS role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id = ?').get(req.params.id);
    if (!target) throw notFound('User not found');
    if (target.role === 'founder' && req.user.role !== 'founder') throw forbidden('Only the Founder can reset the Founder password');
    const tempPassword = `Chd-${crypto.randomBytes(9).toString('base64url')}!4`;
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hashPassword(tempPassword), target.id);
    revokeAllSessions(target.id);
    audit(req, 'users.password_reset_by_admin', { entity: 'users', entityId: target.id });
    res.json({ ok: true, tempPassword });
  }),
);

/* ------------------------- roles & permissions ------------------------- */
adminRouter.get(
  '/roles',
  requireAuth,
  requirePermission('users.read'),
  asyncRoute(async (_req, res) => {
    const roles = db.prepare('SELECT * FROM roles ORDER BY rank').all();
    const perms = db.prepare('SELECT * FROM permissions ORDER BY group_name, key').all();
    const mapping = db.prepare(
      `SELECT r.key AS role, p.key AS permission FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id`,
    ).all();
    const byRole = {};
    for (const r of roles) byRole[r.key] = mapping.filter((m) => m.role === r.key).map((m) => m.permission);
    res.json({ roles, permissions: perms, mapping: byRole, founderOnly: [...FOUNDER_ONLY] });
  }),
);

adminRouter.put(
  '/roles/:role/permissions',
  requireAuth,
  requirePermission('permissions.manage'),
  asyncRoute(async (req, res) => {
    const role = db.prepare('SELECT * FROM roles WHERE key = ?').get(req.params.role);
    if (!role) throw notFound('Role not found');
    if (role.key === 'founder') throw forbidden('Founder permissions are fixed and cannot be edited');
    if (!Array.isArray(req.body?.permissions)) throw badRequest('permissions array is required');

    const requested = req.body.permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p));
    const blocked = requested.filter((p) => FOUNDER_ONLY.has(p));
    if (blocked.length) throw forbidden(`These permissions are founder-only: ${blocked.join(', ')}`);

    const ids = requested
      .map((key) => db.prepare('SELECT id FROM permissions WHERE key = ?').get(key)?.id)
      .filter(Boolean);
    db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
    const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)');
    for (const id of ids) ins.run(role.id, id);
    audit(req, 'roles.permissions_update', { entity: 'roles', entityId: role.key, meta: { count: ids.length } });
    res.json({ ok: true, permissions: requested });
  }),
);

/* -------------------------- AI configuration -------------------------- */
adminRouter.patch(
  '/tools/:key',
  requireAuth,
  requirePermission('ai_tools.write'),
  asyncRoute(async (req, res) => {
    const tool = db.prepare('SELECT * FROM ai_tools WHERE key = ?').get(req.params.key);
    if (!tool) throw notFound('Tool not found');
    const enabled = req.body.enabled === undefined ? tool.enabled : req.body.enabled ? 1 : 0;
    const limit = req.body.free_limit_daily === undefined ? tool.free_limit_daily
      : Math.min(Math.max(Number(req.body.free_limit_daily) || 0, 0), 10000);
    db.prepare('UPDATE ai_tools SET enabled = ?, free_limit_daily = ? WHERE key = ?').run(enabled, limit, tool.key);
    audit(req, 'ai_tools.update', { entity: 'ai_tools', entityId: tool.key, meta: { enabled: !!enabled, limit } });
    res.json({ ok: true });
  }),
);

adminRouter.patch(
  '/models/:slug',
  requireAuth,
  requirePermission('ai_models.write'),
  asyncRoute(async (req, res) => {
    const model = db.prepare('SELECT * FROM ai_models WHERE slug = ?').get(req.params.slug);
    if (!model) throw notFound('Model not found');
    if (req.body.enabled !== undefined) {
      db.prepare('UPDATE ai_models SET enabled = ? WHERE slug = ?').run(req.body.enabled ? 1 : 0, model.slug);
    }
    audit(req, 'ai_models.update', { entity: 'ai_models', entityId: model.slug, meta: { enabled: req.body.enabled } });
    res.json({ ok: true });
  }),
);

adminRouter.patch(
  '/providers/:slug',
  requireAuth,
  requirePermission('ai_providers.write'),
  asyncRoute(async (req, res) => {
    const provider = db.prepare('SELECT * FROM ai_providers WHERE slug = ?').get(req.params.slug);
    if (!provider) throw notFound('Provider not found');
    if (req.body.enabled !== undefined) {
      db.prepare('UPDATE ai_providers SET enabled = ? WHERE slug = ?').run(req.body.enabled ? 1 : 0, provider.slug);
    }
    // Secrets are read from environment variables at runtime; they are never written to the database.
    audit(req, 'ai_providers.update', { entity: 'ai_providers', entityId: provider.slug, meta: { enabled: req.body.enabled } });
    res.json({ ok: true, keyPresent: !!process.env[provider.key_env_var] });
  }),
);

/* ------------------------------- audit -------------------------------- */
adminRouter.get(
  '/audit',
  requireAuth,
  requirePermission('audit.read'),
  asyncRoute(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ logs: rows });
  }),
);

/* ---------------------------- security view --------------------------- */
adminRouter.get(
  '/security',
  requireAuth,
  requirePermission('security.read'),
  asyncRoute(async (_req, res) => {
    const users = db.prepare(
      `SELECT u.id, u.email, r.key AS role, u.totp_enabled, u.last_login_at FROM users u
       JOIN roles r ON r.id=u.role_id WHERE r.rank <= 60 ORDER BY r.rank`,
    ).all();
    const failed = db.prepare(
      `SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'auth.login_failed' AND datetime(created_at) > datetime('now','-24 hour')`,
    ).get().c;
    res.json({
      privilegedUsers: users,
      failedLogins24h: failed,
      twoFactorEnforced: process.env.CHARDHO_REQUIRE_2FA !== 'false',
      sessions: db.prepare(
        `SELECT s.id, u.email, s.ip, s.created_at, s.expires_at, s.twofa_verified
         FROM sessions s JOIN users u ON u.id=s.user_id
         WHERE s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now') ORDER BY s.id DESC LIMIT 50`,
      ).all(),
    });
  }),
);

/* ------------------------------ backups ------------------------------- */
adminRouter.get(
  '/backups',
  requireAuth,
  requirePermission('backup.manage'),
  asyncRoute(async (_req, res) => {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({ file: f, size: fs.statSync(path.join(dir, f)).size, created_at: fs.statSync(path.join(dir, f)).mtime.toISOString() }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    res.json({ backups: files, directory: dir });
  }),
);

adminRouter.post(
  '/backups',
  requireAuth,
  requirePermission('backup.manage'),
  asyncRoute(async (req, res) => {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `chardho-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    audit(req, 'backup.create', { entity: 'backups', entityId: path.basename(file) });
    res.status(201).json({ ok: true, file: path.basename(file), size: fs.statSync(file).size });
  }),
);

/* -------------------------- content settings -------------------------- */
adminRouter.get(
  '/platform',
  requireAuth,
  asyncRoute(async (_req, res) => {
    const rows = db.prepare(`SELECT key, value FROM portal_settings WHERE portal = 'global'`).all();
    res.json({ platform: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  }),
);

/* --------------------------- content moderation ------------------------ */
adminRouter.get(
  '/moderation',
  requireAuth,
  requirePermission('content.moderate'),
  asyncRoute(async (_req, res) => {
    const conversations = db.prepare(
      `SELECT c.id, c.title, c.created_at, u.email AS owner,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages,
              (SELECT substr(m.content, 1, 120) FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
       FROM conversations c JOIN users u ON u.id = c.user_id
       ORDER BY c.updated_at DESC LIMIT 50`,
    ).all();
    res.json({ conversations });
  }),
);

adminRouter.delete(
  '/moderation/conversations/:id',
  requireAuth,
  requirePermission('content.moderate'),
  asyncRoute(async (req, res) => {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!conv) throw notFound('Conversation not found');
    db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(
      conv.user_id, 'Conversation removed',
      'A conversation was removed by a moderator because it breached the acceptable use policy.',
    );
    audit(req, 'moderation.conversation_removed', { entity: 'conversations', entityId: conv.id, meta: { owner: conv.user_id } });
    res.json({ ok: true });
  }),
);

export { ROLES };
