/**
 * CHARDHO-AI :: security layer
 * Centralised RBAC, audit logging, rate limiting and request hardening.
 * Every protected operation is authorised here on the server — never on the client.
 */
import { db } from './db.js';
import { require2fa } from './auth.js';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (m, d) => new HttpError(400, 'bad_request', m, d);
export const unauthorized = (m = 'Authentication required') => new HttpError(401, 'unauthorized', m);
export const forbidden = (m = 'You do not have access to this resource') => new HttpError(403, 'forbidden', m);
export const notFound = (m = 'Not found') => new HttpError(404, 'not_found', m);

/* ------------------------------- async -------------------------------- */
export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------- RBAC --------------------------------- */
export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'founder') return true;
  return user.permissions.includes(permission);
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requirePermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (userSatisfies(req.user, permissions)) return next();
    return next(forbidden(`Missing permission: ${permissions.join(' or ')}`));
  };
}

/** true when the user holds any of the listed permissions */
export function userSatisfies(user, permissions) {
  if (!user) return false;
  if (user.role === 'founder') return true;
  return permissions.some((p) => user.permissions.includes(p));
}

const PORTAL_ROUTES = {
  founder: '/founder',
  'super-admin': '/super-admin',
  manager: '/manager',
  staff: '/staff',
  developer: '/developer',
  app: '/app',
  support: '/support',
};

/**
 * Portal isolation.
 * - the Founder may enter any portal (master access, as requested)
 * - every other account may only enter the portal bound to its own role
 * - privileged roles must have completed 2FA before any portal data is served
 */
export function requirePortal(portal) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    // Supports both a literal portal name ("staff") and a route param (":portal").
    const target = portal.startsWith(':') ? req.params[portal.slice(1)] : portal;
    const isFounder = req.user.role === 'founder';
    if (!isFounder && req.user.portal !== target) {
      return next(forbidden(`Your role (${req.user.roleName}) cannot access the ${target} portal`));
    }
    if (require2fa(req.user.role) && !req.user.twofaVerified) {
      return next(new HttpError(403, '2fa_required', 'Two-factor authentication is required for this portal'));
    }
    next();
  };
}

export function portalRouteFor(portal) {
  return PORTAL_ROUTES[portal] || '/login';
}

/* ------------------------------- audit -------------------------------- */
export function audit(req, action, { entity, entityId, meta } = {}) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity, entity_id, meta, ip)
       VALUES (?,?,?,?,?,?,?)`,
    ).run(
      req.user?.id ?? null,
      req.user?.email ?? null,
      action,
      entity ?? null,
      entityId != null ? String(entityId) : null,
      meta ? JSON.stringify(meta) : null,
      clientIp(req),
    );
  } catch (err) {
    console.error('[audit] failed to record', action, err.message);
  }
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

/* ----------------------------- rate limit ----------------------------- */
const buckets = new Map();

export function rateLimit({ key, limit = 10, windowMs = 60000 }) {
  return (req, _res, next) => {
    const ident = typeof key === 'function' ? key(req) : key || clientIp(req);
    const now = Date.now();
    const entry = buckets.get(ident);
    if (!entry || now > entry.resetAt) {
      buckets.set(ident, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > limit) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      return next(new HttpError(429, 'rate_limited', `Too many requests. Try again in ${retry}s.`, { retryAfter: retry }));
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}, 60000).unref?.();

/* --------------------------- CSRF / origin ---------------------------- */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const extraOrigins = new Set(
  String(process.env.CHARDHO_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

/**
 * Cookie-authenticated mutations must come from our own origin.
 * Combined with SameSite=Lax this blocks cross-site request forgery.
 */
export function originGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // same-origin form posts / server-to-server API key calls
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return next(forbidden('Invalid Origin header'));
  }
  const host = req.headers.host;
  if (originHost === host || extraOrigins.has(origin)) return next();
  return next(forbidden('Cross-origin request blocked'));
}

/* ----------------------------- validation ----------------------------- */
export function requireFields(body, fields) {
  const missing = fields.filter((f) => {
    const v = body?.[f];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}`, { missing });
}

export function stringField(value, name, { min = 1, max = 5000 } = {}) {
  if (typeof value !== 'string') throw badRequest(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`${name} must be at least ${min} characters`);
  if (trimmed.length > max) throw badRequest(`${name} must be at most ${max} characters`);
  return trimmed;
}

export function emailField(value) {
  const email = stringField(value, 'email', { min: 5, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address');
  return email;
}

/** Password policy: length first, complexity second. */
export function passwordField(value) {
  if (typeof value !== 'string' || value.length < 12) throw badRequest('Password must be at least 12 characters');
  if (value.length > 200) throw badRequest('Password is too long');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (classes < 3) throw badRequest('Password must combine at least three of: lower case, upper case, digits, symbols');
  return value;
}

export const oneOf = (value, allowed, name) => {
  if (!allowed.includes(value)) throw badRequest(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
};
