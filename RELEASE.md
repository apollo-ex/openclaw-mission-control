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

## GitHub release steps

```bash
git add .
git commit -m "feat: add nextjs mission control web dashboard"
git push origin main
```

If remote does not exist yet:
```bash
gh repo create apollo-ex/openclaw-mission-control --public --source=. --remote=origin --push
```

## Vercel deployment steps (frontend app)

Deploy from `apps/mission-control-web`:

```bash
cd apps/mission-control-web
vercel link --yes
vercel --prod --yes
```

Set backend URL for hybrid mode:

```bash
vercel env add MISSION_CONTROL_API_BASE_URL production
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

## Known release risks

- OpenClaw CLI JSON output may drift from parser assumptions.
- `status` parsing is heuristic string classification.
- Hybrid mode requires a reachable backend endpoint for Vercel frontend (tunnel/private network).
- Frontend pages render API failures if `MISSION_CONTROL_API_BASE_URL` is misconfigured.
