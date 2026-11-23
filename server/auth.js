/**
 * CHARDHO-AI :: authentication
 * - session cookies (httpOnly, SameSite=Lax, Secure in production)
 * - server-side session records with revocation
 * - TOTP two-factor for privileged accounts
 * - no hardcoded credentials anywhere
 */
import crypto from 'node:crypto';
import { db, verifyPassword, permissionsForUser } from './db.js';

export const SESSION_COOKIE = 'chardho_session';
const SESSION_TTL_HOURS = Number(process.env.CHARDHO_SESSION_TTL_HOURS || 12);
const PRIVILEGED_ROLES = new Set(['founder', 'super_admin', 'manager', 'developer', 'support']);
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Cookie SameSite policy.
 * "Lax" (default) is the right production setting. A hosted preview panel that
 * embeds the app inside a cross-site iframe cannot send Lax cookies, so the
 * preview process may set CHARDHO_COOKIE_SAMESITE=None. CSRF stays mitigated by
 * the origin guard on mutating requests. "None" requires Secure, so it is
 * force-enabled whenever that value is used.
 */
const SAME_SITE = (() => {
  const value = String(process.env.CHARDHO_COOKIE_SAMESITE || 'Lax').toLowerCase();
  if (value === 'none') return 'None';
  if (value === 'strict') return 'Strict';
  return 'Lax';
})();
const COOKIE_SECURE = IS_PROD || SAME_SITE === 'None';

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

export function require2fa(roleKey) {
  if (process.env.CHARDHO_REQUIRE_2FA === 'false') return false;
  return PRIVILEGED_ROLES.has(roleKey);
}

/* ------------------------------- cookies ------------------------------- */
export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return [part.trim(), ''];
      return [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())];
    }),
  );
}

export function setSessionCookie(res, token) {
  const maxAge = SESSION_TTL_HOURS * 3600;
  res.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=${SAME_SITE}; Max-Age=${maxAge}${
      COOKIE_SECURE ? '; Secure' : ''
    }`,
  );
}

export function clearSessionCookie(res) {
  res.append('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=${SAME_SITE}; Max-Age=0${COOKIE_SECURE ? '; Secure' : ''}`);
}

/* ------------------------------- sessions ------------------------------ */
export function createSession(userId, { ip, userAgent, twofaVerified = false } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at, ip, user_agent, twofa_verified)
     VALUES (?,?,?,?,?,?)`,
  ).run(userId, sha256(token), expiresAt, ip || null, userAgent || null, twofaVerified ? 1 : 0);
  return { token, expiresAt };
}

export function revokeSession(token) {
  db.prepare('UPDATE sessions SET revoked_at = datetime(\'now\') WHERE token_hash = ?').run(sha256(token));
}

export function revokeAllSessions(userId, exceptToken) {
  if (exceptToken) {
    db.prepare(
      `UPDATE sessions SET revoked_at = datetime('now')
       WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?`,
    ).run(userId, sha256(exceptToken));
  } else {
    db.prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`).run(userId);
  }
}

/** Hydrate req.user from the session cookie. Never trusts client-supplied roles. */
export function attachUser(req, _res, next) {
  req.user = null;
  req.sessionToken = null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return next();

  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.revoked_at, s.twofa_verified,
              u.id, u.email, u.name, u.status, u.totp_enabled, u.email_verified,
              r.key AS role_key, r.name AS role_name, r.portal, r.home_route, r.rank
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token));

  if (!row) return next();
  if (row.revoked_at) return next();
  if (new Date(row.expires_at).getTime() < Date.now()) return next();
  if (row.status !== 'active') return next();

  const permissions = permissionsForUser(row.id);
  if (row.role_key === 'founder') permissions.push('*');

  req.user = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role_key,
    roleName: row.role_name,
    portal: row.portal,
    homeRoute: row.home_route,
    rank: row.rank,
    permissions,
    totpEnabled: !!row.totp_enabled,
    emailVerified: !!row.email_verified,
    twofaVerified: !!row.twofa_verified,
    sessionId: row.session_id,
  };
  req.sessionToken = token;
  next();
}

export function findUserByEmail(email) {
  return db
    .prepare(
      `SELECT u.*, r.key AS role_key, r.name AS role_name, r.portal, r.home_route
       FROM users u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = lower(?)`,
    )
    .get(email);
}

export function authenticate(email, password) {
  const user = findUserByEmail(email);
  // Always run a hash comparison so timing does not reveal whether the address exists.
  const stored = user?.password_hash || 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const ok = verifyPassword(password, stored);
  if (!user || !ok) return null;
  if (user.status !== 'active') return null;
  return user;
}

/* --------------------------------- TOTP -------------------------------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20) {
  const buf = crypto.randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(secret) {
  const clean = String(secret).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    value = (value << 5) | B32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpCode(secret, timeStep = Math.floor(Date.now() / 30000)) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, code, window = 1) {
  if (!secret || !code) return false;
  const cleaned = String(code).replace(/\D/g, '');
  if (cleaned.length !== 6) return false;
  const step = Math.floor(Date.now() / 30000);
  for (let i = -window; i <= window; i++) {
    const candidate = totpCode(secret, step + i);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(cleaned))) return true;
  }
  return false;
}

export function otpauthUrl(secret, email, issuer = 'CHARDHO AI') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/* ---------------------------- e-mail tokens ---------------------------- */
export function createAuthToken(userId, kind, ttlMinutes = 30) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO auth_tokens (user_id, token_hash, kind, expires_at) VALUES (?,?,?,?)').run(
    userId,
    sha256(token),
    kind,
    new Date(Date.now() + ttlMinutes * 60000).toISOString(),
  );
  return token;
}

export function consumeAuthToken(token, kind) {
  const row = db
    .prepare(
      `SELECT * FROM auth_tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL
       AND datetime(expires_at) > datetime('now')`,
    )
    .get(sha256(token), kind);
  if (!row) return null;
  db.prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  return row.user_id;
}

/* ------------------------- API keys (developer) ------------------------ */
export function issueApiKey(userId, label, scopes = []) {
  const raw = `chd_${crypto.randomBytes(24).toString('base64url')}`;
  const prefix = raw.slice(0, 10);
  db.prepare('INSERT INTO api_keys (user_id, label, prefix, key_hash, scopes) VALUES (?,?,?,?,?)').run(
    userId,
    label,
    prefix,
    sha256(raw),
    JSON.stringify(scopes),
  );
  return { key: raw, prefix }; // the raw key is shown exactly once
}

export function verifyApiKey(raw) {
  const row = db
    .prepare(
      `SELECT k.*, u.status, u.name, u.email, u.role_id FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    )
    .get(sha256(raw));
  if (!row || row.status !== 'active') return null;
  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(row.id);
  return row;
}
