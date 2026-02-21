# Release Checklist & Rollback Notes

## Pre-release (must pass)

1. Install and baseline backend
   ```bash
   npm ci
   cp .env.example .env
   npm run migrate
   npm run seed
   ```
2. Strict backend quality gate
   ```bash
   npm run test:ci
   ```
3. Frontend quality gate
   ```bash
   cd apps/mission-control-web
   npm ci
   npm run test:ci
   ```
4. Smoke test backend API
   ```bash
   npm run dev
   curl -s http://127.0.0.1:4242/health
   curl -s http://127.0.0.1:4242/api/contracts
   ```

## Neon + Vercel env setup

Backend Vercel project (`openclaw-mission-control`):

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

Frontend Vercel project (`mission-control-web`):

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

No Cloudflare tunnel is required for normal frontend rendering when `DATABASE_URL` is configured.

## GitHub release steps

```bash
git add .
git commit -m "chore: migrate mission control db config to neon standard"
git push origin main
```

If remote does not exist yet:
```bash
gh repo create apollo-ex/openclaw-mission-control --private --source=. --remote=origin --push
```

## Vercel deployment steps (frontend app)

Deploy from `apps/mission-control-web`:

```bash
cd apps/mission-control-web
vercel link --yes
vercel --prod --yes
```

Verify deployment URL:
```bash
curl -I https://<frontend-production-url>
```

Hybrid mode runbook:
- [`HYBRID_DEPLOYMENT.md`](./HYBRID_DEPLOYMENT.md)

## Rollback plan

### Local runtime rollback
1. Stop current process.
2. Checkout last known good commit:
   ```bash
   git checkout <good-commit-sha>
   npm ci
   npm run migrate
   npm run dev
   ```

### GitHub rollback
- Revert offending commit and push:
  ```bash
  git revert <bad-commit-sha>
  git push origin main
  ```

### Vercel rollback (frontend)
- Redeploy prior known-good commit from `apps/mission-control-web`:
  ```bash
  git checkout <good-commit-sha>
  cd apps/mission-control-web
  vercel --prod --yes
  ```
- Or promote previous deployment in Vercel dashboard.

### Neon rollback
- Point `DATABASE_URL` and `DATABASE_URL_DIRECT` back to the previous known-good Postgres endpoint.
- Re-run `npm run migrate` (idempotent migration tracking in `_migrations`).
- Validate `/api/health` and `/api/overview` before traffic cutover.

## Known release risks

- OpenClaw CLI JSON output may drift from parser assumptions.
- `status` parsing is heuristic string classification.
- Frontend `DATABASE_URL` misconfiguration causes stale/fallback UI data.
- Neon credential rotation without Vercel env sync can break frontend/server reads.
