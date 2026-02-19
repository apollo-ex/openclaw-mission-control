# Hybrid Deployment Mode (Local Backend + Vercel Frontend)

Mission Control now supports a hybrid model:

- **Backend (`/`)** runs locally and keeps the read-only collector/cache behavior.
- **Frontend (`apps/mission-control-web`)** deploys to Vercel as a Next.js app.

This preserves the local-first contract while still allowing remote dashboard access.

## Security and contract guardrails

1. Backend API is **GET-only** (`/api/contracts`, `/api/overview`, `/api/agents`, `/api/memory`, `/api/cron`, `/api/health`).
2. Frontend only consumes these read endpoints.
3. No frontend route executes OpenClaw write/mutation commands.
4. Redaction remains at backend ingest boundary.

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

## Vercel deployment with local backend

### 1) Deploy frontend from `apps/mission-control-web`

```bash
vercel link --yes
vercel --prod --yes
```

### 2) Provide backend URL to frontend

Set Vercel env var in the frontend project:

```bash
vercel env add MISSION_CONTROL_API_BASE_URL production
```

The value must be a reachable HTTPS endpoint for your local backend.

### 3) Expose local backend safely

Common options:

- Cloudflare Tunnel
- Tailscale Funnel
- ngrok

Use an authenticated/private tunnel whenever possible.

### 4) Verify

```bash
curl -I https://<frontend-production-url>
curl -I https://<backend-tunnel-url>/api/health
```

## Failure modes

- `Mission Control API request failed` in frontend: backend tunnel URL unavailable or env var missing.
- Browser page loads but tables are empty: collectors have not ingested snapshots yet.
- 5xx from backend API: check local mission-control logs and DB migration status.
