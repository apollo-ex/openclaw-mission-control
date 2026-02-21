# Mission Control MVP Queue

Status legend: `DONE` `IN_PROGRESS` `BLOCKED` `QUEUED`

## Definition of Done (MVP release gate)

Release is considered done only when all are true:
1. Local quality gate passes: `npm run test:ci`
2. Read-only/local-first contract maintained (no mutating OpenClaw commands)
3. CI workflow exists and enforces lint + coverage-threshold tests + build
4. Release checklist and rollback notes documented
5. GitHub repo published with commits and `main` pushed
6. Vercel deployment attempted; result documented (URL or concrete blocker)

## Priority Queue

| Priority | ID | Task | Status | Notes |
|---|---|---|---|---|
| P0 | MC-001 | Bootstrap service, `/health`, config, error boundaries | DONE | Implemented in `src/index.ts`, `src/app.ts`, `src/lib/*` |
| P0 | MC-002 | Read-only adapters for sessions/cron/status/memory | DONE | No write methods exposed in adapter interface |
| P0 | MC-003 | Postgres schema, migrations, seed, idempotent upserts | DONE | Migration + idempotency tests in `src/db/db.test.ts` |
| P0 | MC-004 | Collector scheduler with retry/backoff + stale handling | DONE | Retry + stale + overlap behavior tested |
| P1 | MC-005 | Redaction pipeline at ingest boundary | DONE | Memory/status payload redaction + warning redaction tested |
| P1 | MC-006 | Robust test suite (unit/integration/smoke) | DONE | Adapter + ingest + DB + scheduler + app + lib tests |
| P1 | MC-007 | Strict test gating via coverage thresholds | DONE | `npm run test:coverage` with line/function/branch minima |
| P1 | MC-008 | CI workflow for lint/test/build | DONE | `.github/workflows/ci.yml` |
| P1 | MC-009 | Release checklist + rollback notes | DONE | `RELEASE.md` |
| P1 | MC-010 | GitHub publish with commits | DONE | Published: `https://github.com/apollo-ex/openclaw-mission-control` |
| P1 | MC-011 | Vercel deployment attempt | BLOCKED | Build passed but deployment failed: no Vercel output directory (`public`) for daemon-style service |

## Next Queue (Deployment Track)

| Priority | ID | Task | Status | Notes |
|---|---|---|---|---|
| P0 | MC-012 | Scaffold Next.js TypeScript web app (`apps/mission-control-web`) | DONE | App Router scaffold + TypeScript + build scripts added |
| P0 | MC-013 | Expose read-only API contracts for UI consumption | DONE | Added GET-only contracts + `/api/{contracts,overview,agents,memory,cron,health}` |
| P1 | MC-014 | Wire dashboard pages (Overview/Agents/Memory/Cron/Health) | DONE | Next.js pages wired to read-only backend API client |
| P1 | MC-015 | Add hybrid deploy mode doc (local backend + Vercel frontend) | DONE | Added `HYBRID_DEPLOYMENT.md` and release/readme updates |
| P1 | MC-016 | Vercel deploy + verification | IN_PROGRESS | Frontend deploy succeeds (`mission-control-web-rho.vercel.app`) and is healthy; backend root deploy still fails on Vercel output-directory expectation, so full live data requires a reachable backend API URL plus Neon env wiring |

## Exit Checklist

- [x] Queue and done definition documented
- [x] Local-first read-only guardrails preserved
- [x] Tests added across adapters/collectors/db/app/lib
- [x] Coverage thresholds enforced in scripts
- [x] CI pipeline added
- [x] Release + rollback runbook added
- [x] GitHub remote created and pushed
- [ ] Vercel deployment verified (attempted; blocked by output-directory mismatch)
- [x] Next.js deployment track executed (MC-012..MC-016; MC-016 blocked by backend reachability)
