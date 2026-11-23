# CHARDHO AI

**CHARDHO AI – Free All-in-One AI Agent & Marketing Automation Platform**
A premium 3D web platform with seven isolated portals and server-side role-based access control, built by **CHARDHO LLP**.

This repository is a working implementation — not a set of dashboard mock-ups. Every portal authenticates against the API, every permission is enforced on the server, and the test suite proves it (29 passing tests).

---

## Run it

```bash
npm install
npm run dev          # API on :8787 + Vite on :5173 (one origin, /api is proxied)
```

Open the URL printed by Vite. On first start the server creates the database and **one account per role**, printing generated credentials to `data/credentials/seed-credentials.txt`.

```bash
npm run build        # production bundle
npm start            # single process: serves dist/ and the API on :8787
npm test             # 29 API + authorisation tests against a throwaway database
```

Requirements: **Node 22.5+** (uses the built-in `node:sqlite`). No external database, no paid services, no API keys required.

### Running inside a hosted preview

A preview panel usually embeds the app in a cross-site iframe, which breaks two
secure defaults. Both are opt-in, and neither weakens a normal deployment:

```bash
PORT=5173 NODE_ENV=production \
  CHARDHO_FRAME_ANCESTORS="'self' https://*.e2b.app" \
  CHARDHO_COOKIE_SAMESITE=None \
  node server/index.js
```

- `CHARDHO_FRAME_ANCESTORS` allow-lists embedding origins. When set, `X-Frame-Options`
  is dropped (it cannot express a list) and the CSP `frame-ancestors` directive governs instead.
- `CHARDHO_COOKIE_SAMESITE=None` lets the session cookie travel inside a cross-site
  iframe. It force-enables `Secure`, and CSRF stays covered by the origin guard.

Both default to the strict setting (`'self'` and `Lax`), so leave them unset in production
and open the preview in its own tab if you prefer.

### First sign-in

1. Open `/login` and use an account from `data/credentials/seed-credentials.txt`.
2. Privileged roles (Founder, Super Admin, Manager, Developer, Support) **must** enrol TOTP on first login. The screen shows a setup key — paste it into Google Authenticator (or any TOTP app) and enter the six-digit code.
3. You are redirected automatically to the portal your role owns.

> Passwords are randomly generated at seed time. There is no default password, no demo password, and nothing hardcoded in the source.

---

## The seven portals

| Portal | Route | Role | 2FA | Purpose |
|---|---|---|---|---|
| Founder | `/founder` | `founder` | Required | Complete ownership: permissions, AI configuration, cost, security, backups |
| Super Admin | `/super-admin` | `super_admin` | Required | User management, models, moderation, monitoring |
| Manager | `/manager` | `manager` | Required | Staff, tasks, attendance, approvals, reports |
| Staff | `/staff` | `staff` | Optional | Assigned work, attendance, work reports |
| Developer | `/developer` | `developer` | Required | API keys, webhooks, error logs, deployments, sandbox |
| AI User | `/app` | `user` | Optional | Every free AI tool, agents, chat history, usage |
| Support | `/support` | `support` | Required | Tickets, priorities, assignment, resolution history |

Each portal has its own sidebar, dashboard, profile, notifications and settings. The **Founder** holds master access and can switch between all seven; every other role is confined to its own portal.

These are application routes, not separate websites. They become publicly reachable once the platform is deployed.

---

## Security model

The security boundary is the **API**, not the interface. Hiding a menu item is a convenience; the server re-checks every request.

| Control | Where | Notes |
|---|---|---|
| Hashed passwords | `server/db.js` | scrypt (N=16384, r=8, p=1) with a per-user salt |
| Session cookies | `server/auth.js` | `HttpOnly`, `SameSite=Lax`, `Secure` in production, 12h TTL |
| Server-side sessions | `sessions` table | Revocable individually or for every device at once |
| TOTP 2FA | `server/auth.js` | RFC 6238, ±1 window, mandatory for privileged roles |
| Role-based access | `server/security.js` | Permissions read from the database on **every** request |
| Portal isolation | `requirePortal()` | A staff session is rejected by `/api/portal/founder/*` |
| Row-level scoping | `server/routes/portal.js` | Users only ever receive rows they own |
| CSRF protection | `originGuard()` | Origin check on mutations + SameSite cookies |
| Rate limiting | `rateLimit()` | Login 10/10min, registration 5/h, API keys 60/min |
| Audit log | `audit()` | Actor, action, entity, IP for administrative events |
| API keys | `issueApiKey()` | SHA-256 hashed, shown once, revocable, scoped |
| No admin signup | `POST /api/auth/register` | Always creates a Free User; client-supplied roles are ignored |
| No stored provider secrets | `ai_providers` | Only the env var **name** is stored; the key stays in `process.env` |
| Founder-only actions | `FOUNDER_ONLY` set | Enforced in code, so a database edit cannot escalate a role |

Additional hardening: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and a production CSP; no `x-powered-by`; 512 kB JSON body limit; startup fails closed if the database cannot be read.

---

## Architecture

```
server/
  index.js        Express entry: hardening, routers, static dist, error handler
  db.js           SQLite schema (24 tables), permission catalogue, seeding
  auth.js         sessions, scrypt, TOTP, e-mail tokens, API keys
  security.js     RBAC middleware, audit, rate limits, CSRF, validation
  routes/         auth · public · portal · admin · work · ai · dev
src/
  three/          R3F hero scene (globe, neural mesh, rings) + 2D fallback
  components/     design system (buttons, charts, tables, modals, counters)
  pages/          marketing pages, auth screens
  portals/        registry, shell, dashboards, 30+ portal screens
tests/api.test.js 29 security and behaviour tests
```

**Stack:** React 19, React Router 7, Vite 7, Tailwind CSS 4, Three.js + React Three Fiber + Drei, GSAP, Framer Motion, Express 4, `node:sqlite`.

### 3D and performance

The 3D scene is a dynamic import and its `modulepreload` hint is stripped at build
time, so three.js (1.1 MB raw / 315 kB gzip) is fetched only when the hero scene
actually mounts. The initial payload is ~370 kB raw / ~110 kB gzip. Phones,
reduced-motion users and devices with low memory/cores get the CSS-only fallback.

- The hero is a procedural wireframe AI globe with a pulsing neural mesh, fresnel atmosphere, orbiting rings, floating solids and star field.
- **Lazy loaded**: Three.js (~315 kB gzipped) only downloads when the scene is actually rendered.
- **2D fallback** for phones, devices with ≤4 GB RAM or ≤4 cores, `prefers-reduced-data`, missing WebGL, or a lost context.
- `prefers-reduced-motion` disables camera parallax and animation loops rather than merely slowing them.
- Pause off-screen animation, capped DPR (≤1.7), instanced point geometry.

### When something breaks

A render error used to blank the page and leave no trace. Now:

- `AppErrorBoundary` wraps the whole app and shows a recovery card (reload / home)
  instead of a white screen.
- `window.onerror` and `unhandledrejection` are captured too, so async failures
  that React boundaries cannot see are not lost.
- Reports go to `POST /api/client-errors`, which is rate limited per IP, strips
  control characters, truncates every field, and writes to `error_logs`. They then
  appear in the Developer portal's error monitor next to server-side faults.

Reporting is best-effort and can never throw into the app. Each distinct error is
sent once per page load.

### Data model

`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `auth_tokens`, `portal_settings`, `audit_logs`, `ai_tools`, `ai_models`, `ai_providers`, `agents`, `conversations`, `messages`, `workflows`, `workflow_executions`, `staff_profiles`, `attendance`, `tasks`, `support_tickets`, `notifications`, `usage_logs`, `api_keys`, `webhooks`, `deployments`, `error_logs`.

---

## API

Public: `GET /api/public/stats · tools · agents · platform · health`, `POST /api/public/contact`.

Session-authenticated: `/api/auth/*`, `/api/portal/*`, `/api/admin/*`, `/api/work/*`, `/api/ai/*`, `/api/dev/*`.

Server-to-server with an API key:

```bash
curl https://your-domain/api/v1/tools -H "Authorization: Bearer chd_..."
```

Full endpoint table: `/documentation` in the running app.

---

## Free tier

Every AI tool is free within a per-tool daily limit that the Founder or Super Admin sets in the portal. Limits are enforced server-side (`fair_use_limit`, HTTP 429) and shown in the workspace. Founder and Super Admin are exempt.

---

## Deliberate decisions and current limitations

These are stated plainly so nobody discovers them in production.

- **No paid AI provider is enabled.** The default engine is a deterministic local implementation in `server/routes/ai.js`. It produces structured plans, outlines and code notes — it is not a large language model. `callProvider()` is the integration point; enabling a provider requires the Owner's approval and a key in the environment.
- **Image generation is procedural.** `/api/ai/images` renders deterministic SVG concept art. It is not a diffusion model.
- **E-mail delivery is not wired.** Verification and reset tokens are returned in the API response when `CHARDHO_EXPOSE_SETUP_TOKENS=true` (development only). Connect an SMTP or transactional provider before enabling that in production.
- **SQLite, single node.** Appropriate for this stage; move to Postgres before multi-instance deployment. Backups use `VACUUM INTO` and live on the same disk — copy them off-host for real disaster recovery.
- **Moderation covers conversations.** Removing one notifies the owner and is audited. Automated content classification is not implemented.
- **No deployment target is configured.** Real TLS, a reverse proxy, off-host backups and uptime monitoring are deployment tasks, not code artefacts.
- **Not yet production-deployed.** The preview runs the full stack locally.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | API + Vite with hot reload |
| `npm run build` | Production bundle |
| `npm start` | Serve `dist/` + API in one process |
| `npm test` | API, RBAC and security tests |
| `npm run seed` | Seed a database manually |
| `node scripts/e2e-check.mjs` | Sign in to all seven portals through the proxy and print a status table |
| `node scripts/endpoint-sweep.mjs` | Hit all 48 data endpoints per role and report any non-2xx |

Both verification scripts honour `CHARDHO_BASE_URL`, `CHARDHO_CREDENTIALS` and
`CHARDHO_DB_PATH`, so they can be run against a throwaway instance instead of the
database you are demoing — a dry run that enrols 2FA stays out of your live data:

```bash
rm -rf /tmp/verify && mkdir -p /tmp/verify
PORT=8788 CHARDHO_DATA_DIR=/tmp/verify NODE_ENV=production npm start &
CHARDHO_BASE_URL=http://localhost:8788 \
  CHARDHO_CREDENTIALS=/tmp/verify/credentials/seed-credentials.txt \
  CHARDHO_DB_PATH=/tmp/verify/chardho.db node scripts/e2e-check.mjs
```

Node prints a `node:sqlite` ExperimentalWarning on boot; every npm script passes
`--disable-warning=ExperimentalWarning` so the startup log stays clean. The flag
suppresses that one warning only, not all warnings.

---

## Tests

```
tests 29 · suites 10 · pass 29 · fail 0
```

Covering: wrong-password handling without account enumeration, mandatory 2FA and its enforcement before portal access, server-side logout/revocation, portal isolation for every role, founder master access, unauthenticated rejection across all seven portals, row-level scoping of conversations and tasks, role-escalation attempts through registration, founder-only permission grants, CSRF origin blocking, security headers, rate limiting, audit-log recording, API key lifecycle and revocation, attendance rules, task authorisation, AI persistence and zero-cost guarantees, and database integrity (no plaintext passwords, no stored provider secrets).

---

© CHARDHO LLP. Portal URLs are application routes; free tier subject to fair-use limits.
