# Hybrid Deployment (Neon backend data + Vercel frontend)

Mission Control supports a hybrid model:

- **Backend (`/`)** runs collector + read-only API and persists to Neon Postgres.
- **Frontend (`apps/mission-control-web`)** deploys to Vercel as a Next.js app.

## Security and contract guardrails

1. Backend API is **GET-only** (`/api/contracts`, `/api/overview`, `/api/agents`, `/api/memory`, `/api/cron`, `/api/health`).
2. Frontend core pages read directly from Neon (`DATABASE_URL`) using server-side SELECT queries only.
3. No frontend route executes OpenClaw write/mutation commands.
4. Redaction remains at backend ingest boundary.
5. Secrets live only in env vars (`DATABASE_URL`, `DATABASE_URL_DIRECT`, optional API tokens).

## Backend env contract (Neon)

```env
DATABASE_URL=postgresql://<user>:<password>@<project>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
DATABASE_URL_DIRECT=postgresql://<user>:<password>@<project>.<region>.aws.neon.tech/<db>?sslmode=require
```

- `DATABASE_URL`: runtime pooled connection
- `DATABASE_URL_DIRECT`: migration/seed/admin connection
- Optional tuning:
  - `SESSION_ACTIVE_WINDOW_MS` (default 900000)
  - `SESSIONS_LIST_LIMIT` (default 500)

## Frontend env contract (Vercel)

Required:

- `DATABASE_URL` (pooled Neon URL used by server-side reads)

Optional:

- `MISSION_CONTROL_API_TOKEN` (legacy auxiliary API usage only)

Deprecated for primary flow:

- `MISSION_CONTROL_API_BASE_URL`

Cloudflare/ngrok tunnel is not required for normal dashboard rendering.

## Local development

Terminal A (backend):

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Terminal B (frontend):

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`.

## Vercel env wiring

### Backend project (`openclaw-mission-control`)

Set **both** Preview and Production scopes:

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control

# Preview
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL_DIRECT preview
vercel env add SESSION_ACTIVE_WINDOW_MS preview
vercel env add SESSIONS_LIST_LIMIT preview
vercel env add MISSION_CONTROL_ENV preview

# Production
vercel env add DATABASE_URL production
vercel env add DATABASE_URL_DIRECT production
vercel env add SESSION_ACTIVE_WINDOW_MS production
vercel env add SESSIONS_LIST_LIMIT production
vercel env add MISSION_CONTROL_ENV production
```

### Frontend project (`mission-control-web`)

Set **both** Preview and Production scopes:

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web

# Preview
vercel env add DATABASE_URL preview
# Optional legacy token only if you still use protected backend API routes
vercel env add MISSION_CONTROL_API_TOKEN preview

# Production
vercel env add DATABASE_URL production
# Optional legacy token only if you still use protected backend API routes
vercel env add MISSION_CONTROL_API_TOKEN production
```

## Vercel deploy (frontend)

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
vercel link --yes
vercel --prod --yes
```

## Verify

```bash
curl -I https://<frontend-production-url>
```

UI checks (without `MISSION_CONTROL_API_BASE_URL` configured):
- Open `/agents` and confirm active/subagent counts are populated.
- Confirm `Live Sessions` rows show `runType`, `agentId`, `sessionKey`, `model`, and `Last update`.
- Leave the page open and verify elapsed timers increment live (1s tick) and data refreshes automatically (~15s).

## Failure modes

- Frontend all-zero fallback payloads: verify frontend `DATABASE_URL` is set correctly in Vercel and points to the same Neon database as the collector.
- Empty tables with healthy collector runtime: collectors have not ingested snapshots yet.
- Active sessions unexpectedly zero: check backend logs for `sessions_gateway_failed:*` warnings and verify `openclaw gateway call sessions.list --json` works on host.
- Backend 5xx: check backend logs, Neon connectivity, and migration status (`npm run migrate`).
- Root backend Vercel deploy currently expects a static output directory; backend API should run on a reachable Node host until a serverless adapter is introduced.
