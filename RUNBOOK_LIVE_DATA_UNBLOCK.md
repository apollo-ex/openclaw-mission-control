# RUNBOOK_LIVE_DATA_UNBLOCK

## Objective
Unblock live data in production for `openclaw-mission-control` (collector -> Neon -> mission-control-web).

---

## Current-state findings (2026-02-21, non-destructive checks)

### 1) Backend API URL expected by web app

**Finding:** for core dashboard pages, the web app does **not** require a backend API base URL.

Code evidence:
- `apps/mission-control-web/src/lib/db.ts`
  - `DATABASE_URL` is required for server-side reads.
  - `MISSION_CONTROL_API_BASE_URL` is only a deprecated legacy bridge env and triggers a warning.
- `apps/mission-control-web/src/lib/api.ts`
  - data path is DB-backed (`getQueryExecutor()` + read-model queries), not fetch to backend API.

**Conclusion:**
- `MISSION_CONTROL_API_BASE_URL` is **not required** for live dashboard data.
- Current frontend Vercel env still contains `MISSION_CONTROL_API_BASE_URL` (legacy; safe to remove to reduce confusion).

---

### 2) Required Neon vars mapping by service

| Service | Runtime role | Required vars | Optional vars | Verified in Vercel |
|---|---|---|---|---|
| `openclaw-mission-control` (backend project) | Collectors + read-only API runtime | `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT` (direct/admin for migrate/seed) | `MISSION_CONTROL_API_TOKEN`, `SESSION_ACTIVE_WINDOW_MS`, `SESSIONS_LIST_LIMIT`, `MISSION_CONTROL_ENV` | `DATABASE_URL` + `DATABASE_URL_DIRECT` present in Preview + Production |
| `mission-control-web` (frontend project) | Next.js server-side read-model queries | `DATABASE_URL` (pooled, same Neon DB as backend runtime) | `MISSION_CONTROL_API_TOKEN` (legacy protected API usage only) | `DATABASE_URL` present in Preview + Production |

Observed Neon host/database alignment check:
- Backend `DATABASE_URL` and frontend `DATABASE_URL` point to the same Neon pooled host + same DB name (`mission_control`).

---

### 3) Primary blocker still preventing live data

`openclaw-mission-control` backend production deployment on Vercel is failing:
- `vercel inspect <latest-backend-deployment> --logs` shows:
  - `Error: No Output Directory named "public" found after the Build completed...`

This means no continuously running production collector runtime is active on Vercel.

Non-destructive DB freshness check (using production frontend `DATABASE_URL`) showed data is stale:
- latest `session_events`: ~419 minutes old
- latest `health_samples`: ~419 minutes old
- latest `collector_state.last_success_at`: ~419 minutes old

**Conclusion:** env wiring is mostly present; the remaining unblock is runtime hosting for collectors (daemon process), not a missing frontend API URL.

---

## Exact steps to set/repair required envs

## A) Vercel envs (backend project: `openclaw-mission-control`)

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control

# Audit
vercel env ls

# Set required (Production)
vercel env add DATABASE_URL production
vercel env add DATABASE_URL_DIRECT production

# Set required (Preview)
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL_DIRECT preview

# Optional tuning
vercel env add SESSION_ACTIVE_WINDOW_MS production
vercel env add SESSIONS_LIST_LIMIT production
vercel env add MISSION_CONTROL_ENV production
```

## B) Vercel envs (frontend project: `mission-control-web`)

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web

# Audit
vercel env ls

# Set required (Production/Preview)
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview

# Remove deprecated bridge var (recommended cleanup)
vercel env rm MISSION_CONTROL_API_BASE_URL production -y
vercel env rm MISSION_CONTROL_API_BASE_URL preview -y
```

## C) Backend runtime host (required for live collectors)

Because root backend is daemon-style, run it on a persistent Node host (not default Vercel static output flow):

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control
npm ci
cp .env.example .env
```

Set at minimum in `.env`:
- `DATABASE_URL=<neon pooled url>`
- `DATABASE_URL_DIRECT=<neon direct url>`
- `MISSION_CONTROL_ENV=production`

Then start runtime:

```bash
npm run migrate
nohup npm run start > ./data/mission-control.log 2>&1 &
```

(Use your preferred process manager if available; requirement is a continuously running process.)

---

## Verification commands/checks (prove live path is active)

## 1) Verify Vercel env presence

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control
vercel env ls

cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
vercel env ls
```

Expected:
- backend has `DATABASE_URL` + `DATABASE_URL_DIRECT`
- frontend has `DATABASE_URL`

## 2) Verify backend runtime health (host where collectors run)

```bash
curl -sS http://127.0.0.1:4242/health | jq
curl -sS http://127.0.0.1:4242/api/contracts | jq
```

## 3) Verify DB freshness is live (critical)

Run with production DB URL loaded:

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
vercel env pull .env.tmp --environment production --yes
set -a; source .env.tmp; set +a

node - <<'NODE'
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const { rows:[r] } = await pool.query(`
    with latest as (
      select
        (select now()) as now_ts,
        (select max(created_at) from session_events) as latest_event_at,
        (select max(ts) from health_samples) as latest_health_at,
        (select max(last_success_at) from collector_state) as latest_collector_success_at
    )
    select
      now_ts,
      latest_event_at,
      latest_health_at,
      latest_collector_success_at,
      extract(epoch from (now_ts - latest_event_at))/60 as event_stale_min,
      extract(epoch from (now_ts - latest_health_at))/60 as health_stale_min,
      extract(epoch from (now_ts - latest_collector_success_at))/60 as collector_stale_min
    from latest;
  `);
  console.log(JSON.stringify(r, null, 2));
  await pool.end();
})();
NODE

rm -f .env.tmp
```

Pass criteria:
- `event_stale_min <= 5`
- `health_stale_min <= 5`
- `collector_stale_min <= 5`

## 4) Verify frontend production deployment is Ready

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
vercel ls mission-control-web --prod
```

---

## Rollback

## 1) Env rollback (Vercel)

Before changes, back up envs:

```bash
# backend
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control
vercel env pull .env.backup --environment production --yes

# frontend
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
vercel env pull .env.backup --environment production --yes
```

If change causes issues:
- remove bad var(s): `vercel env rm <NAME> production -y`
- re-add previous value(s): `vercel env add <NAME> production`
- redeploy frontend if needed.

## 2) Frontend deployment rollback

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control/apps/mission-control-web
vercel ls mission-control-web --prod
vercel rollback <deployment-url-or-id> --yes
```

## 3) Backend runtime rollback

```bash
cd /Users/apollo/.openclaw/workspace/projects/openclaw-mission-control
git checkout <last-known-good-sha>
npm ci
npm run migrate
nohup npm run start > ./data/mission-control.log 2>&1 &
```

---

## Decision summary

- Missing production requirement is **not** frontend backend-API URL.
- Required Neon envs are present in Vercel for backend/frontend.
- Remaining blocker is **collector runtime host availability** (backend daemon not running continuously in production).
