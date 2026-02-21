# progress.md

## 2026-02-19
- Created project scaffold under `projects/openclaw-mission-control`.
- Added bootstrap HTTP server + `/health` route + config/logger/error boundary.
- Implemented read-only adapter layer (memory/sessions/cron/status) with metadata/freshness.
- Added SQLite migration system + initial schema + upsert helpers + seed util.
- Implemented collector scheduler skeleton (hot/warm cadence, retries/backoff, stale flags).
- Added initial redaction pipeline and integrated into ingest path.
- Added focused unit tests and local run scripts.
- Expanded to finish-ready MVP docs + quality gates:
  - Added `QUEUE.md` with explicit definition-of-done and prioritized statuses.
  - Added `RELEASE.md` release checklist + rollback notes.
  - Added CI workflow `.github/workflows/ci.yml` with lint + coverage-threshold tests + build.
  - Expanded test suite (unit/integration/smoke-style) across adapters/collectors/db/app/lib.
- Verified locally: `npm run test`, `npm run test:coverage`, `npm run test:ci`, and `curl http://127.0.0.1:4242/health`.
- Published to GitHub: `https://github.com/apollo-ex/openclaw-mission-control`.
- Attempted Vercel production deploy; blocked by output-directory mismatch for daemon-style service.

## 2026-02-20
- Migrated Mission Control DB configuration to Neon-first contract:
  - Added `DATABASE_URL_DIRECT` support for migration/seed workflows.
  - Added optional stage-specific URL fallbacks (`DATABASE_URL_DEV|STAGING|PROD`).
  - Removed hardcoded local DB password from repo defaults.
- Updated DB client connection handling for Neon SSL-compatible URLs.
- Updated runtime startup flow to run migrations/seed through direct URL when provided.
- Updated docs/runbooks (`README`, `HYBRID_DEPLOYMENT`, `RELEASE`, `QUEUE`) for Neon + Vercel env wiring.
- Redeployed frontend to Vercel; alias remains `https://mission-control-web-rho.vercel.app` and returns HTTP 200.
- Verified local quality gates:
  - Backend: `npm run test:ci`
  - Frontend: `npm run test:ci`
  - Backend smoke: `/health` and `/api/contracts`
- Added granular session stream ingestion + stream UI panel (messages/tool calls) and deployed.
- Started new UI architecture pass (graph-first operator view):
  - audited current main page via agent-browser desktop/mobile screenshots
  - documented key bottlenecks in `findings.md`
  - reset `task_plan.md` for phased node/edge redesign execution
