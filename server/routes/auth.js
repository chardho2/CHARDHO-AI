/**
 * CHARDHO-AI :: authentication routes
 */
import express from 'express';
import {
  authenticate, createSession, revokeSession, revokeAllSessions, setSessionCookie,
  clearSessionCookie, generateTotpSecret, verifyTotp, otpauthUrl, createAuthToken,
  consumeAuthToken, require2fa, findUserByEmail,
} from '../auth.js';
import { db, hashPassword, verifyPassword, permissionsForUser } from '../db.js';
import {
  asyncRoute, badRequest, unauthorized, forbidden, notFound, audit, rateLimit,
  requireAuth, requireFields, stringField, emailField, passwordField, HttpError,
} from '../security.js';

export const authRouter = express.Router();

const EXPOSE_TOKENS = process.env.CHARDHO_EXPOSE_SETUP_TOKENS !== 'false' && process.env.NODE_ENV !== 'production';

function publicUser(user) {
  const permissions = permissionsForUser(user.id ?? user.user_id);
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(user.role_id);
  if (role.key === 'founder') permissions.push('*');
  return {
    id: user.id ?? user.user_id,
    email: user.email,
    name: user.name,
    role: role.key,
    roleName: role.name,
    portal: role.portal,
    homeRoute: role.home_route,
    permissions,
    totpEnabled: !!user.totp_enabled,
    emailVerified: !!user.email_verified,
  };
}

/* -------------------------------- login -------------------------------- */
authRouter.post(
  '/login',
  rateLimit({ key: (req) => `login:${req.headers['x-forwarded-for'] || req.socket.remoteAddress}:${req.body?.email || ''}`, limit: 10, windowMs: 10 * 60 * 1000 }),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = emailField(req.body.email);
    const password = String(req.body.password);

    const user = authenticate(email, password);
    if (!user) {
      db.prepare('INSERT INTO audit_logs (actor_id, actor_email, action, entity, meta, ip) VALUES (?,?,?,?,?,?)').run(
        null, email, 'auth.login_failed', 'auth', '{"reason":"invalid_credentials"}', req.ip,
      );
      throw unauthorized('Email or password is incorrect');
    }

    const privileged = require2fa(user.role_key);
    db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

    if (privileged && !user.totp_enabled) {
      // First login for a privileged account: stage enrolment, do NOT grant portal access yet.
      const secret = user.totp_secret || generateTotpSecret();
      if (!user.totp_secret) db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);
      const { token } = createSession(user.id, { ip: req.ip, userAgent: req.headers['user-agent'], twofaVerified: false });
      setSessionCookie(res, token);
      db.prepare('INSERT INTO audit_logs (actor_id, actor_email, action, entity, ip) VALUES (?,?,?,?,?)').run(
        user.id, user.email, 'auth.2fa_enrolment_started', 'auth', req.ip,
      );
      return res.json({
        twoFactor: { required: true, state: 'enrol', secret, otpauth: otpauthUrl(secret, user.email) },
        user: publicUser(user),
      });
    }

    if (privileged) {
      const { token } = createSession(user.id, { ip: req.ip, userAgent: req.headers['user-agent'], twofaVerified: false });
      setSessionCookie(res, token);
      return res.json({ twoFactor: { required: true, state: 'verify' }, user: publicUser(user) });
    }

    const { token } = createSession(user.id, { ip: req.ip, userAgent: req.headers['user-agent'], twofaVerified: true });
    setSessionCookie(res, token);
    db.prepare('INSERT INTO audit_logs (actor_id, actor_email, action, entity, ip) VALUES (?,?,?,?,?)').run(
      user.id, user.email, 'auth.login', 'auth', req.ip,
    );
    res.json({ twoFactor: { required: false }, user: publicUser(user) });
  }),
);

/* ------------------------------ 2FA verify ----------------------------- */
authRouter.post(
  '/2fa/verify',
  rateLimit({ key: (req) => `2fa:${req.ip}`, limit: 12, windowMs: 5 * 60 * 1000 }),
  asyncRoute(async (req, res) => {
    if (!req.user) throw unauthorized('Start signing in again');
    requireFields(req.body, ['code']);
    const row = db.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!row?.totp_secret) throw badRequest('No two-factor enrolment in progress');
    if (!verifyTotp(row.totp_secret, req.body.code)) {
      audit(req, 'auth.2fa_failed', { entity: 'auth' });
      throw badRequest('That code is not valid. Check your authenticator and try again.');
    }
    db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.user.id);
    db.prepare('UPDATE sessions SET twofa_verified = 1 WHERE id = ?').run(req.user.sessionId);
    audit(req, row.totp_enabled ? 'auth.2fa_verified' : 'auth.2fa_enrolled', { entity: 'auth' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ ok: true, user: publicUser(user) });
  }),
);

authRouter.post(
  '/2fa/disable',
  requireAuth,
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['password']);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(String(req.body.password), row.password_hash)) throw unauthorized('Password is incorrect');
    if (req.user.role === 'founder') throw forbidden('The Founder account must keep two-factor authentication enabled');
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.user.id);
    audit(req, 'auth.2fa_disabled', { entity: 'users', entityId: req.user.id });
    res.json({ ok: true });
  }),
);

/* ------------------------------ registration --------------------------- */
authRouter.post(
  '/register',
  rateLimit({ key: (req) => `register:${req.ip}`, limit: 5, windowMs: 60 * 60 * 1000 }),
  asyncRoute(async (req, res) => {
    const open = db.prepare(`SELECT value FROM portal_settings WHERE portal='global' AND key='registration_open'`).get();
    if (open && open.value === 'false') throw forbidden('Registration is currently closed');

    requireFields(req.body, ['name', 'email', 'password']);
    const name = stringField(req.body.name, 'name', { min: 2, max: 80 });
    const email = emailField(req.body.email);
    const password = passwordField(req.body.password);

    if (findUserByEmail(email)) throw badRequest('An account with that email already exists');

    // Public registration can ONLY create a Free User. Roles are never accepted from the client.
    const role = db.prepare(`SELECT id FROM roles WHERE key = 'user'`).get();
    const result = db
      .prepare(`INSERT INTO users (email, password_hash, name, role_id, email_verified) VALUES (?,?,?,?,0)`)
      .run(email, hashPassword(password), name, role.id);
    const userId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?,?)').run(userId, role.id);

    const verifyToken = createAuthToken(userId, 'email_verify', 60 * 24);
    db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?,?,?)').run(
      userId, 'Welcome to CHARDHO AI', 'Verify your email to unlock the full free tier.',
    );
    db.prepare('INSERT INTO audit_logs (actor_id, actor_email, action, entity, entity_id, ip) VALUES (?,?,?,?,?,?)').run(
      userId, email, 'auth.register', 'users', String(userId), req.ip,
    );

    res.status(201).json({
      ok: true,
      message: 'Account created. Sign in to open your AI workspace.',
      ...(EXPOSE_TOKENS ? { devVerification: { token: verifyToken, url: `/api/auth/verify-email?token=${verifyToken}` } } : {}),
    });
  }),
);

authRouter.get(
  '/verify-email',
  asyncRoute(async (req, res) => {
    const token = String(req.query.token || '');
    const userId = consumeAuthToken(token, 'email_verify');
    if (!userId) throw badRequest('That verification link is invalid or has expired');
    db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId);
    res.redirect('/login?verified=1');
  }),
);

/* ---------------------------- password reset --------------------------- */
authRouter.post(
  '/forgot-password',
  rateLimit({ key: (req) => `forgot:${req.ip}`, limit: 5, windowMs: 15 * 60 * 1000 }),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['email']);
    const email = emailField(req.body.email);
    const user = findUserByEmail(email);
    // Always the same response: never reveal whether an address is registered.
    const body = { ok: true, message: 'If that address is registered, a reset link has been sent.' };
    if (user) {
      const token = createAuthToken(user.id, 'password_reset', 30);
      audit(req, 'auth.password_reset_requested', { entity: 'users', entityId: user.id });
      if (EXPOSE_TOKENS) body.devReset = { token, url: `/reset-password?token=${token}` };
    }
    res.json(body);
  }),
);

authRouter.post(
  '/reset-password',
  rateLimit({ key: (req) => `reset:${req.ip}`, limit: 10, windowMs: 15 * 60 * 1000 }),
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['token', 'password']);
    const password = passwordField(req.body.password);
    const userId = consumeAuthToken(String(req.body.token), 'password_reset');
    if (!userId) throw badRequest('That reset link is invalid or has expired');
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hashPassword(password), userId);
    revokeAllSessions(userId);
    db.prepare('INSERT INTO audit_logs (actor_id, action, entity, entity_id, ip) VALUES (?,?,?,?,?)').run(
      userId, 'auth.password_reset', 'users', String(userId), req.ip,
    );
    res.json({ ok: true });
  }),
);

/* -------------------------------- session ------------------------------ */
authRouter.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    user: { ...publicUser(dbUser), twofaVerified: req.user.twofaVerified, requires2fa: require2fa(req.user.role) },
  });
});

authRouter.post('/logout', (req, res) => {
  if (req.user) audit(req, 'auth.logout', { entity: 'auth' });
  if (req.sessionToken) revokeSession(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post(
  '/password',
  requireAuth,
  asyncRoute(async (req, res) => {
    requireFields(req.body, ['currentPassword', 'newPassword']);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(String(req.body.currentPassword), row.password_hash)) throw unauthorized('Current password is incorrect');
    const next = passwordField(req.body.newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
    revokeAllSessions(req.user.id, req.sessionToken);
    audit(req, 'auth.password_changed', { entity: 'users', entityId: req.user.id });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/sessions',
  requireAuth,
  asyncRoute(async (req, res) => {
    const rows = db.prepare(
      `SELECT id, created_at, expires_at, ip, user_agent, revoked_at, twofa_verified
       FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`,
    ).all(req.user.id);
    res.json({ sessions: rows.map((r) => ({ ...r, current: r.id === req.user.sessionId })) });
  }),
);

authRouter.delete(
  '/sessions/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const row = db.prepare('SELECT id, user_id FROM sessions WHERE id = ?').get(req.params.id);
    if (!row) throw notFound('Session not found');
    if (row.user_id !== req.user.id && req.user.role !== 'founder') throw forbidden();
    db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?`).run(row.id);
    audit(req, 'auth.session_revoked', { entity: 'sessions', entityId: row.id });
    res.json({ ok: true });
  }),
);

/* ------------------------- first-run / bootstrap ----------------------- */
/** Reports whether the platform still needs its first founder account, without leaking data. */
authRouter.get('/bootstrap-status', (_req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  res.json({ needsSetup: count === 0 });
});

export { publicUser, HttpError };
