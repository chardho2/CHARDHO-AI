/**
 * CHARDHO-AI :: database layer
 * Uses Node's built-in SQLite (node:sqlite, Node >= 22.5) so there are no native
 * build steps and no paid/managed database dependency.
 */
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = process.env.CHARDHO_DATA_DIR || path.resolve('data');
export const DB_PATH = process.env.CHARDHO_DB_PATH || path.join(DATA_DIR, 'chardho.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

/* ------------------------------------------------------------------ *
 * Password hashing (scrypt, no third-party dependency)
 * ------------------------------------------------------------------ */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */
db.exec(`
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  portal TEXT NOT NULL,
  home_route TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 1,
  rank INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  group_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active',
  email_verified INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS portal_settings (
  portal TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER,
  PRIMARY KEY (portal, key)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT,
  twofa_verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_providers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  base_url TEXT,
  key_env_var TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY,
  provider_id INTEGER REFERENCES ai_providers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  context_window INTEGER NOT NULL DEFAULT 8192,
  enabled INTEGER NOT NULL DEFAULT 1,
  cost_per_1k_input REAL NOT NULL DEFAULT 0,
  cost_per_1k_output REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_tools (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  free_limit_daily INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  model_id INTEGER REFERENCES ai_models(id) ON DELETE SET NULL,
  system_prompt TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflows (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL DEFAULT 'manual',
  definition TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id INTEGER PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  output TEXT
);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_code TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  designation TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (date('now')),
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  status TEXT NOT NULL DEFAULT 'present',
  note TEXT,
  UNIQUE (user_id, work_date)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY,
  subject TEXT NOT NULL,
  description TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tool_key TEXT,
  model_slug TEXT,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  secret_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deployments (
  id INTEGER PRIMARY KEY,
  environment TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'error',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('password_reset','email_verify')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`);

/* ------------------------------------------------------------------ *
 * Permission catalogue
 * ------------------------------------------------------------------ */
export const PERMISSION_CATALOGUE = [
  ['portal.founder.access', 'Enter Founder portal', 'Portals'],
  ['portal.superadmin.access', 'Enter Super Admin portal', 'Portals'],
  ['portal.manager.access', 'Enter Manager portal', 'Portals'],
  ['portal.staff.access', 'Enter Staff portal', 'Portals'],
  ['portal.developer.access', 'Enter Developer portal', 'Portals'],
  ['portal.app.access', 'Enter AI User portal', 'Portals'],
  ['portal.support.access', 'Enter Support portal', 'Portals'],

  ['users.read', 'View users', 'Users'],
  ['users.write', 'Create / edit users', 'Users'],
  ['users.delete', 'Deactivate users', 'Users'],
  ['roles.manage', 'Create roles & assign permissions', 'Users'],
  ['permissions.manage', 'Grant/revoke permissions', 'Users'],

  ['ai_tools.read', 'View AI tools', 'AI'],
  ['ai_tools.write', 'Configure AI tools', 'AI'],
  ['ai_models.read', 'View AI models', 'AI'],
  ['ai_models.write', 'Configure AI models', 'AI'],
  ['ai_providers.read', 'View AI providers', 'AI'],
  ['ai_providers.write', 'Configure AI providers', 'AI'],
  ['agents.read', 'View agents', 'AI'],
  ['agents.write', 'Create / edit agents', 'AI'],
  ['agents.run', 'Run agents', 'AI'],

  ['tasks.read', 'View tasks', 'Work'],
  ['tasks.read.all', 'View every task', 'Work'],
  ['tasks.write', 'Update own tasks', 'Work'],
  ['tasks.assign', 'Assign tasks to others', 'Work'],
  ['attendance.read', 'View own attendance', 'Work'],
  ['attendance.read.all', 'View all attendance', 'Work'],
  ['attendance.write', 'Check in / out', 'Work'],
  ['staff.manage', 'Manage staff profiles', 'Work'],
  ['approvals.manage', 'Approve leave & workflows', 'Work'],
  ['reports.read', 'View reports', 'Work'],

  ['tickets.read', 'View own tickets', 'Support'],
  ['tickets.read.all', 'View all tickets', 'Support'],
  ['tickets.write', 'Reply to tickets', 'Support'],
  ['tickets.assign', 'Assign & prioritise tickets', 'Support'],

  ['apikeys.read', 'View API keys', 'Developer'],
  ['apikeys.manage', 'Create / revoke API keys', 'Developer'],
  ['webhooks.manage', 'Manage webhooks', 'Developer'],
  ['logs.read', 'Read error & integration logs', 'Developer'],
  ['deploy.read', 'View deployments', 'Developer'],
  ['sandbox.use', 'Use the sandbox tester', 'Developer'],

  ['audit.read', 'Read audit logs', 'Security'],
  ['security.read', 'View security posture', 'Security'],
  ['sessions.manage', 'Revoke user sessions', 'Security'],
  ['backup.manage', 'Create & restore backups', 'Security'],
  ['settings.write', 'Change portal settings', 'Security'],

  ['usage.read.self', 'View own usage', 'Usage'],
  ['usage.read.all', 'View platform-wide usage', 'Usage'],
  ['billing.read', 'View cost & billing', 'Usage'],

  ['content.edit', 'Edit website content', 'Content'],
  ['content.moderate', 'Moderate user content', 'Content'],
  ['chat.use', 'Use the AI workspace', 'AI'],
  ['images.generate', 'Generate images', 'AI'],
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOGUE.map(([k]) => k);

/** Founder-only: nobody else may ever hold these, even if someone edits the DB by hand. */
export const FOUNDER_ONLY = new Set(['roles.manage', 'permissions.manage', 'backup.manage', 'billing.read']);

const ROLE_DEFS = [
  {
    key: 'founder', name: 'Founder', portal: 'founder', home: '/founder', rank: 10,
    permissions: '*',
  },
  {
    key: 'super_admin', name: 'Super Admin', portal: 'super-admin', home: '/super-admin', rank: 20,
    permissions: ALL_PERMISSION_KEYS.filter((p) => !FOUNDER_ONLY.has(p)),
  },
  {
    key: 'manager', name: 'Manager', portal: 'manager', home: '/manager', rank: 30,
    permissions: [
      'portal.manager.access', 'users.read', 'tasks.read', 'tasks.read.all', 'tasks.write', 'tasks.assign',
      'attendance.read', 'attendance.read.all', 'attendance.write', 'staff.manage', 'approvals.manage',
      'reports.read', 'tickets.read', 'tickets.read.all', 'tickets.write', 'tickets.assign',
      'usage.read.all', 'agents.read', 'ai_tools.read', 'audit.read', 'chat.use',
    ],
  },
  {
    key: 'staff', name: 'Staff', portal: 'staff', home: '/staff', rank: 40,
    permissions: [
      'portal.staff.access', 'tasks.read', 'tasks.write', 'attendance.read', 'attendance.write',
      'reports.read', 'tickets.read', 'tickets.write', 'notifications.read',
    ].filter((p) => p !== 'notifications.read'),
  },
  {
    key: 'developer', name: 'Developer', portal: 'developer', home: '/developer', rank: 50,
    permissions: [
      'portal.developer.access', 'apikeys.read', 'apikeys.manage', 'webhooks.manage', 'logs.read',
      'deploy.read', 'sandbox.use', 'ai_models.read', 'ai_providers.read', 'agents.read',
      'usage.read.all', 'reports.read', 'tasks.read', 'chat.use',
    ],
  },
  {
    key: 'support', name: 'Support Agent', portal: 'support', home: '/support', rank: 60,
    permissions: [
      'portal.support.access', 'tickets.read', 'tickets.read.all', 'tickets.write', 'tickets.assign',
      'users.read', 'usage.read.self', 'reports.read',
    ],
  },
  {
    key: 'user', name: 'Free User', portal: 'app', home: '/app', rank: 90,
    permissions: [
      'portal.app.access', 'chat.use', 'agents.read', 'agents.run', 'ai_tools.read',
      'images.generate', 'usage.read.self', 'tickets.read', 'tickets.write',
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */
const isSeeded = () => {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  return row.c > 0;
};

function rnd(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rnd(arr.length)]; }
function daysAgo(d) {
  const t = new Date(Date.now() - d * 86400000);
  return t.toISOString().replace('T', ' ').slice(0, 19);
}
function dateAgo(d) { return daysAgo(d).slice(0, 10); }

/** Random, cryptographically strong password. Never a hardcoded default. */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  const bytes = crypto.randomBytes(20);
  for (let i = 0; i < 20; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function seed({ quiet = false } = {}) {
  if (isSeeded()) return { seeded: false };

  const log = quiet ? () => {} : (...a) => console.log(...a);

  /* roles */
  const insRole = db.prepare('INSERT INTO roles (key, name, portal, home_route, rank) VALUES (?,?,?,?,?)');
  for (const r of ROLE_DEFS) insRole.run(r.key, r.name, r.portal, r.home, r.rank);
  const roles = Object.fromEntries(db.prepare('SELECT * FROM roles').all().map((r) => [r.key, r]));

  /* permissions */
  const insPerm = db.prepare('INSERT INTO permissions (key, label, group_name) VALUES (?,?,?)');
  for (const [key, label, group] of PERMISSION_CATALOGUE) insPerm.run(key, label, group);
  const perms = Object.fromEntries(db.prepare('SELECT * FROM permissions').all().map((p) => [p.key, p]));

  const insRP = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?,?)');
  for (const r of ROLE_DEFS) {
    const roleId = roles[r.key].id;
    const keys = r.permissions === '*' ? ALL_PERMISSION_KEYS : r.permissions;
    for (const k of keys) {
      // Defensive: founder-only permissions can never be attached to another role.
      if (r.key !== 'founder' && FOUNDER_ONLY.has(k)) continue;
      if (perms[k]) insRP.run(roleId, perms[k].id);
    }
  }

  /* users — one per role. Passwords are random and written to .secrets/ */
  const accounts = [
    { email: 'founder@chardho.example', name: 'Chardho Founder', role: 'founder' },
    { email: 'superadmin@chardho.example', name: 'Platform Administrator', role: 'super_admin' },
    { email: 'manager@chardho.example', name: 'Operations Manager', role: 'manager' },
    { email: 'staff@chardho.example', name: 'Staff Member', role: 'staff' },
    { email: 'developer@chardho.example', name: 'Platform Developer', role: 'developer' },
    { email: 'support@chardho.example', name: 'Support Agent', role: 'support' },
    { email: 'user@chardho.example', name: 'Demo Free User', role: 'user' },
  ];
  const insUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, role_id, email_verified, created_at, last_login_at)
    VALUES (?,?,?,?,1,?,?)`);
  const insUR = db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?,?)');
  const credentials = [];

  accounts.forEach((a, i) => {
    const password = generatePassword();
    const res = insUser.run(a.email, hashPassword(password), a.name, roles[a.role].id, daysAgo(160 - i * 3), daysAgo(rnd(3)));
    insUR.run(res.lastInsertRowid, roles[a.role].id);
    credentials.push({ portal: roles[a.role].portal, home: roles[a.role].home_route, email: a.email, password, role: a.role });
  });

  /* a handful of extra free users for the founder's dashboards to be meaningful */
  const extraUsers = [];
  const firstNames = ['Aarav', 'Divya', 'Karthik', 'Meera', 'Rohan', 'Sneha', 'Vikram', 'Ananya', 'Farhan', 'Priya', 'Nikhil', 'Ishita'];
  const lastNames = ['Reddy', 'Sharma', 'Naidu', 'Iyer', 'Kapoor', 'Menon', 'Rao', 'Verma', 'Khan', 'Pillai'];
  for (let i = 0; i < 24; i++) {
    const email = `${firstNames[i % firstNames.length].toLowerCase()}.${lastNames[i % lastNames.length].toLowerCase()}${i}@example.com`;
    const res = insUser.run(email, hashPassword(crypto.randomBytes(18).toString('base64url')), `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`, roles.user.id, daysAgo(120 - i * 4), daysAgo(rnd(20)));
    insUR.run(res.lastInsertRowid, roles.user.id);
    extraUsers.push(Number(res.lastInsertRowid));
  }

  const users = db.prepare('SELECT u.*, r.key AS role_key FROM users u JOIN roles r ON r.id = u.role_id').all();
  const byRole = (k) => users.filter((u) => u.role_key === k);

  /* staff profile for staff + a manager relation */
  const staffUser = byRole('staff')[0];
  const managerUser = byRole('manager')[0];
  db.prepare(`INSERT INTO staff_profiles (user_id, employee_code, department, designation, joined_at, manager_id, phone)
              VALUES (?,?,?,?,?,?,?)`)
    .run(staffUser.id, 'CHD-0007', 'Operations', 'AI Operations Associate', dateAgo(240), managerUser.id, '+91 90000 00007');

  /* attendance for the last 12 work days */
  const insAtt = db.prepare(`INSERT OR REPLACE INTO attendance (user_id, work_date, check_in, check_out, status, note)
                             VALUES (?,?,?,?,?,?)`);
  for (let d = 1; d <= 12; d++) {
    const day = dateAgo(d);
    const dow = new Date(day).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const late = d === 4;
    insAtt.run(staffUser.id, day, late ? '10:24' : '09:12', '18:05', late ? 'late' : 'present', late ? 'Traffic delay' : null);
  }

  /* tasks */
  const insTask = db.prepare(`INSERT INTO tasks (title, description, assigned_to, created_by, status, priority, due_date, progress, created_at, updated_at)
                              VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const taskSeed = [
    ['Audit AI tool usage limits', 'Review daily fair-use limits for the free tier and propose adjustments.', 'in_progress', 'high', 55],
    ['Publish agent marketplace listings', 'Write descriptions and screenshots for six new agents.', 'review', 'medium', 90],
    ['Onboard support ticket triage', 'Define priority matrix and SLA for the support portal.', 'todo', 'medium', 0],
    ['Fix streaming glitch in AI chat', 'Messages occasionally drop the last token on mobile Safari.', 'blocked', 'urgent', 30],
    ['Prepare monthly operations report', 'Usage, cost and team throughput for the founder review.', 'todo', 'low', 0],
  ];
  taskSeed.forEach(([title, description, status, priority, progress], i) => {
    insTask.run(title, description, staffUser.id, managerUser.id, status, priority, dateAgo(-(i + 2)), progress, daysAgo(6 - i), daysAgo(i));
  });
  /* a manager-owned task so scope filtering is visibly different */
  insTask.run('Approve Q4 vendor contracts', 'Vendor spend approval ahead of the quarterly close.', managerUser.id, byRole('founder')[0].id, 'todo', 'high', dateAgo(-5), 10, daysAgo(2), daysAgo(2));

  /* support tickets from real users */
  const insTicket = db.prepare(`INSERT INTO support_tickets (subject, description, user_id, assigned_to, status, priority, created_at, updated_at, resolved_at)
                                VALUES (?,?,?,?,?,?,?,?,?)`);
  const supportUser = byRole('support')[0];
  [
    ['Image generator returns blank output', 'Every prompt returns an empty frame since this morning.', 'open', 'high', null],
    ['How do I export a conversation?', 'Looking for a JSON export of my chat history.', 'resolved', 'low', supportUser.id],
    ['Billing question about fair-use limits', 'What happens when I hit the daily cap?', 'pending', 'medium', null],
    ['Agent stops after two steps', 'My custom agent never finishes the workflow.', 'open', 'urgent', null],
    ['Feature request: dark export theme', 'PDF exports are hard to read at night.', 'closed', 'low', supportUser.id],
  ].forEach(([subject, description, status, priority, assigned], i) => {
    insTicket.run(subject, description, pick(extraUsers), assigned, status, priority, daysAgo(10 - i), daysAgo(4 - (i % 4)), status === 'resolved' || status === 'closed' ? daysAgo(2) : null);
  });

  /* AI providers / models / tools */
  const insProv = db.prepare('INSERT INTO ai_providers (name, slug, base_url, key_env_var, enabled, is_paid) VALUES (?,?,?,?,?,?)');
  insProv.run('Local deterministic engine', 'local', null, 'CHARDHO_LOCAL_ENGINE_KEY', 1, 0);
  insProv.run('OpenAI-compatible', 'openai_compatible', 'https://api.openai.com/v1', 'OPENAI_API_KEY', 0, 1);
  insProv.run('Anthropic-compatible', 'anthropic_compatible', 'https://api.anthropic.com', 'ANTHROPIC_API_KEY', 0, 1);
  const providers = db.prepare('SELECT * FROM ai_providers').all();

  const insModel = db.prepare(`INSERT INTO ai_models (provider_id, name, slug, context_window, enabled, cost_per_1k_input, cost_per_1k_output)
                               VALUES (?,?,?,?,?,?,?)`);
  insModel.run(providers[0].id, 'Chardho Core (local)', 'chardho-core', 8192, 1, 0, 0);
  insModel.run(providers[1].id, 'GPT-class model', 'gpt-class', 128000, 0, 0.0025, 0.01);
  insModel.run(providers[2].id, 'Claude-class model', 'claude-class', 200000, 0, 0.003, 0.015);
  const models = db.prepare('SELECT * FROM ai_models').all();

  const insTool = db.prepare(`INSERT INTO ai_tools (key, name, category, description, enabled, free_limit_daily)
                              VALUES (?,?,?,?,?,?)`);
  [
    ['chat', 'AI Chatbot', 'Chat', 'Conversational assistant with saved history.', 1, 100],
    ['writer', 'AI Writing', 'Writing', 'Draft, rewrite and summarise copy.', 1, 40],
    ['coder', 'AI Coding', 'Code', 'Explain, refactor and generate code.', 1, 30],
    ['image', 'AI Image Generation', 'Media', 'Create brand-ready visuals from prompts.', 1, 10],
    ['pdf', 'AI PDF Assistant', 'Documents', 'Ask questions about uploaded documents.', 1, 15],
    ['site-builder', 'AI Website Builder', 'Build', 'Generate landing pages from a brief.', 1, 5],
    ['agents', 'AI Agents', 'Automation', 'Run multi-step autonomous agents.', 1, 20],
    ['projects', 'Project Management', 'Workspace', 'Plan, track and report on projects.', 1, 50],
    ['files', 'File Management', 'Workspace', 'Personal file storage for AI outputs.', 1, 50],
  ].forEach(([key, name, category, description, enabled, limit]) => insTool.run(key, name, category, description, enabled, limit));

  const insAgent = db.prepare(`INSERT INTO agents (key, name, description, model_id, system_prompt, enabled) VALUES (?,?,?,?,?,?)`);
  [
    ['growth-strategist', 'Growth Strategist', 'Builds multi-channel acquisition plans with budget estimates.', 'You are a growth strategist for CHARDHO LLP.'],
    ['support-copilot', 'Support Copilot', 'Drafts support replies in the CHARDHO tone of voice.', 'You are a support copilot. Be concise and warm.'],
    ['code-reviewer', 'Code Reviewer', 'Reviews pull requests for security and clarity.', 'You review code for security defects first.'],
    ['market-researcher', 'Market Researcher', 'Summarises competitor and market signals.', 'You produce structured market research briefs.'],
    ['content-editor', 'Content Editor', 'Tightens marketing copy and checks claims.', 'You edit copy without inventing facts.'],
  ].forEach(([key, name, description, prompt]) => insAgent.run(key, name, description, models[0].id, prompt, 1));

  const agents = db.prepare('SELECT * FROM agents').all();

  /* a demo conversation for the free user */
  const demoUser = byRole('user')[0];
  const conv = db.prepare('INSERT INTO conversations (user_id, agent_id, title, created_at, updated_at) VALUES (?,?,?,?,?)')
    .run(demoUser.id, agents[0].id, 'Launch plan for a local bakery', daysAgo(2), daysAgo(2));
  const insMsg = db.prepare('INSERT INTO messages (conversation_id, role, content, tokens, created_at) VALUES (?,?,?,?,?)');
  insMsg.run(conv.lastInsertRowid, 'user', 'Help me plan a 30-day launch for a bakery in Kandukur.', 18, daysAgo(2));
  insMsg.run(conv.lastInsertRowid, 'assistant', 'Here is a four-week plan: week one focuses on a pre-launch list, week two on a tasting event, week three on local partnerships, week four on a referral push. Want me to break week one into daily tasks?', 64, daysAgo(2));

  /* workflows */
  const insWf = db.prepare('INSERT INTO workflows (name, description, trigger, definition, enabled) VALUES (?,?,?,?,?)');
  insWf.run('New lead → qualify → assign', 'Scores inbound demo requests and routes hot leads to a manager.', 'webhook', '{"steps":["score","assign"]}', 1);
  insWf.run('Weekly usage digest', 'Emails the founder a usage and cost summary.', 'schedule', '{"cron":"0 9 * * 1"}', 1);
  insWf.run('Ticket escalation', 'Escalates urgent unresolved tickets after 4 hours.', 'event', '{"event":"ticket.created"}', 1);
  const wfs = db.prepare('SELECT * FROM workflows').all();
  const insWfRun = db.prepare('INSERT INTO workflow_executions (workflow_id, status, started_at, finished_at, output) VALUES (?,?,?,?,?)');
  wfs.forEach((w) => {
    for (let i = 0; i < 3; i++) {
      insWfRun.run(w.id, i === 2 ? 'failed' : 'success', daysAgo(i + 1), daysAgo(i + 1), i === 2 ? '{"error":"timeout"}' : '{"ok":true}');
    }
  });

  /* usage logs across the last 30 days */
  const insUsage = db.prepare(`INSERT INTO usage_logs (user_id, tool_key, model_slug, tokens_in, tokens_out, cost, created_at)
                               VALUES (?,?,?,?,?,?,?)`);
  const tools = ['chat', 'writer', 'coder', 'image', 'pdf', 'agents', 'site-builder'];
  for (let d = 0; d < 30; d++) {
    const perDay = 6 + rnd(18);
    for (let i = 0; i < perDay; i++) {
      const u = rnd(10) === 0 ? pick(users).id : pick(extraUsers);
      const tin = 40 + rnd(900);
      const tout = 80 + rnd(1400);
      insUsage.run(u, pick(tools), 'chardho-core', tin, tout, 0, daysAgo(d));
    }
  }

  /* notifications */
  const insNotif = db.prepare('INSERT INTO notifications (user_id, title, body, is_read, created_at) VALUES (?,?,?,?,?)');
  users.forEach((u, i) => {
    insNotif.run(u.id, 'Welcome to CHARDHO AI', 'Your workspace is ready. Explore the AI tools in your portal.', i > 3 ? 1 : 0, daysAgo(rnd(9)));
  });
  insNotif.run(staffUser.id, 'New task assigned', 'Audit AI tool usage limits was assigned to you.', 0, daysAgo(1));
  insNotif.run(managerUser.id, 'Leave request pending', 'A staff member requested leave for next Monday.', 0, daysAgo(1));
  insNotif.run(byRole('founder')[0].id, 'Cost threshold alert', 'Daily AI cost is within the free-tier budget. No action needed.', 0, daysAgo(0));

  /* deployments / error logs for the developer portal */
  const insDep = db.prepare('INSERT INTO deployments (environment, version, status, note, created_at) VALUES (?,?,?,?,?)');
  insDep.run('production', 'v0.1.0', 'success', 'Initial multi-portal release', daysAgo(3));
  insDep.run('staging', 'v0.1.1-rc1', 'success', '3D scene performance pass', daysAgo(1));
  insDep.run('preview', 'v0.1.1-rc2', 'running', 'RBAC test sweep', daysAgo(0));

  const insErr = db.prepare('INSERT INTO error_logs (level, source, message, meta, created_at) VALUES (?,?,?,?,?)');
  [
    ['error', 'api/chat', 'Upstream model timeout after 30s', '{"route":"/api/ai/chat"}', 1],
    ['warn', 'three/hero', 'WebGL context lost on low-memory device', '{"fallback":"2d"}', 2],
    ['error', 'api/auth', 'Failed login attempt (rate limited)', '{"ip":"203.0.113.9"}', 3],
    ['info', 'deploy', 'Staging build promoted', '{}', 4],
  ].forEach(([level, source, message, meta, d]) => insErr.run(level, source, message, meta, daysAgo(d)));

  /* portal settings defaults */
  const insSet = db.prepare('INSERT OR IGNORE INTO portal_settings (portal, key, value, updated_by) VALUES (?,?,?,?)');
  const settings = [
    ['global', 'platform_name', 'CHARDHO AI'],
    ['global', 'company', 'CHARDHO LLP'],
    ['global', 'support_email', 'support@chardho.example'],
    ['global', 'registration_open', 'true'],
    ['global', 'require_2fa_for_privileged', 'true'],
    ['global', 'maintenance_mode', 'false'],
    ['app', 'default_free_daily_requests', '50'],
    ['app', 'image_generation_enabled', 'true'],
    ['developer', 'sandbox_rate_limit_per_min', '60'],
    ['founder', 'cost_alert_threshold_usd', '25'],
  ];
  for (const [portal, key, value] of settings) insSet.run(portal, key, value, byRole('founder')[0].id);

  /* audit log baseline */
  const insAudit = db.prepare('INSERT INTO audit_logs (actor_id, actor_email, action, entity, entity_id, meta, ip, created_at) VALUES (?,?,?,?,?,?,?,?)');
  insAudit.run(byRole('founder')[0].id, byRole('founder')[0].email, 'system.seed', 'platform', 'init', '{"note":"initial seed"}', '127.0.0.1', daysAgo(5));

  writeCredentials(credentials);
  log('\n  Seeded CHARDHO-AI database.\n');
  return { seeded: true, credentials };
}

function writeCredentials(credentials) {
  // Credentials live beside the database they belong to, never in the process CWD.
  // (A test run with its own CHARDHO_DB_PATH must not overwrite real credentials.)
  const dir = path.join(path.dirname(DB_PATH), 'credentials');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'seed-credentials.txt');
  const lines = [
    'CHARDHO-AI :: generated portal credentials',
    'These were generated randomly at seed time. There are no hardcoded passwords anywhere in the codebase.',
    'Change them after first login. This file is git-ignored.',
    '',
    ...credentials.map((c) => `${c.portal.padEnd(12)} ${c.home.padEnd(14)} ${c.email.padEnd(34)} ${c.password}`),
    '',
  ];
  fs.writeFileSync(file, lines.join('\n'), { mode: 0o600 });
  console.log(`\n  Portal credentials written to ${file}\n  ${credentials.length} accounts created (one per role).\n`);
}

export function permissionsForUser(userId) {
  const rows = db.prepare(`
    SELECT DISTINCT p.key FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ?
  `).all(userId);
  return rows.map((r) => r.key);
}

export function roleForUser(userId) {
  return db.prepare(`
    SELECT r.* FROM roles r JOIN users u ON u.role_id = r.id WHERE u.id = ?
  `).get(userId);
}
