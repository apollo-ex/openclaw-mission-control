# Release Checklist & Rollback Notes

## Pre-release (must pass)

1. Install and baseline
   ```bash
   npm ci
   cp .env.example .env
   npm run migrate
   npm run seed
   ```
2. Strict quality gate
   ```bash
   npm run test:ci
   ```
3. Smoke test service
   ```bash
   npm run dev
   curl -s http://127.0.0.1:4242/health
   ```

## GitHub release steps

```bash
git add .
git commit -m "feat: finish mission control mvp with strict test gating"
git push origin main
```

If remote does not exist yet:
```bash
gh repo create apollo-ex/openclaw-mission-control --public --source=. --remote=origin --push
```

## Vercel deployment steps (if desired for web surface)

This project is currently backend/local-service oriented. If a web dashboard is added later:

```bash
vercel link --yes
vercel --prod --yes
```

Verify deployment URL:
```bash
curl -I https://<production-url>
```

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

### Vercel rollback (if deployed)
- Redeploy prior known-good commit:
  ```bash
  git checkout <good-commit-sha>
  vercel --prod --yes
  ```
- Or promote previous deployment in Vercel dashboard.

## Known release risks

- OpenClaw CLI JSON output may drift from parser assumptions.
- `status` parsing is heuristic string classification.
- No production UI layer yet; this is local observability backend MVP.
