# OpenClaw Mission Control

Read-only observability for OpenClaw runtime state, with **Neon Postgres** as the primary datastore.

## Components

- **Backend service (`/`)**
  - Collects read-only snapshots from OpenClaw runtime surfaces.
  - Persists snapshots + read-model tables in Postgres (Neon-first).
  - Exposes GET-only API for dashboard consumption.
- **Frontend (`apps/mission-control-web`)**
  - Next.js + TypeScript dashboard.
  - Vercel-compatible deploy target.
  - Reads directly from Neon on the server side (SELECT-only read-model queries).
  - `MISSION_CONTROL_API_BASE_URL` is deprecated for the primary dashboard flow.

## Read-only API contracts

- `GET /api/contracts`
- `GET /api/overview`
- `GET /api/agents`
- `GET /api/memory`
- `GET /api/cron`
- `GET /api/health`

No mutating routes are exposed.

## Backend env contract (Neon)

Required:

- `DATABASE_URL` — **runtime pooled** Neon URL (used by API + collectors).
- `DATABASE_URL_DIRECT` — **direct/admin** Neon URL (used by migrations + seed).

Recommended:

- `MISSION_CONTROL_API_TOKEN` — protects `/api/*` routes.
- `SESSION_ACTIVE_WINDOW_MS` — recency window to classify sessions as `active` (default `900000` / 15m).
- `SESSIONS_LIST_LIMIT` — max sessions to ingest per collector pass (default `500`).

Optional stage fallbacks (used when `DATABASE_URL` is missing):

- `DATABASE_URL_DEV`
- `DATABASE_URL_STAGING`
- `DATABASE_URL_PROD`
- `MISSION_CONTROL_ENV`

See `.env.example` for full variables.

## Frontend env contract (Neon + Vercel)

Required:

- `DATABASE_URL` — pooled Neon URL used by Next.js server-side data reads.

Optional:

- `MISSION_CONTROL_API_TOKEN` — only needed if you still expose protected backend API routes for legacy/auxiliary use.

Deprecated (not used by core pages):

- `MISSION_CONTROL_API_BASE_URL`

No Cloudflare/ngrok tunnel is required for normal frontend operation.

## Neon wiring behavior (important)

- `npm run migrate` and `npm run seed` use `DATABASE_URL_DIRECT`.
- `npm run dev` / `npm run start` run API + collectors on `DATABASE_URL`.
- If `DATABASE_URL` is unset, runtime falls back to `DATABASE_URL_DIRECT` before stage-specific values.

## Run locally

### Backend

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

### Frontend

```bash
cd apps/mission-control-web
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://127.0.0.1:3000`

## Verify end-to-end (Neon + web, with optional backend API)

1) **Verify DB connectivity (Neon)**

```bash
npm run verify:db
```

2) **Verify frontend reads non-zero data directly from Neon (without `MISSION_CONTROL_API_BASE_URL`)**

```bash
cd apps/mission-control-web
cp .env.example .env.local # ensure DATABASE_URL is set
npm run dev
```

Open `http://127.0.0.1:3000` and verify dashboard KPIs are populated.

3) **Verify active session observability in UI**

- Open `/agents`.
- Confirm KPI cards show **Active** and **Subagents Active** counts.
- In **Live Sessions**, verify rows include:
  - run type (`main` / `subagent` / `cron` / `agent`)
  - agent id, session key, label, model
  - `Last update`
  - `Elapsed` timer
- Leave the page open: timer increments every second and page auto-refreshes every 15s.

## Quality gates

### Backend

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:ci
```

### Frontend

```bash
cd apps/mission-control-web
npm run lint
npm run test
npm run build
npm run test:ci
```

## Deployment

Neon + Vercel runbook (includes exact Preview + Production env wiring):
- [`HYBRID_DEPLOYMENT.md`](./HYBRID_DEPLOYMENT.md)

Release + rollback checklist:
- [`RELEASE.md`](./RELEASE.md)
