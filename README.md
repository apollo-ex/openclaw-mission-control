# OpenClaw Mission Control (MVP)

Local-first, read-only observability service for OpenClaw runtime state.

## Scope (current MVP)
- ✅ Bootstrap service + `/health` endpoint
- ✅ Read-only source adapters (sessions/cron/status/memory)
- ✅ SQLite schema + migrations + idempotent upserts
- ✅ Collector scheduler (hot/warm cadence, retry/backoff, stale markers)
- ✅ Redaction at ingest boundary
- ✅ Strict test gating + CI workflow

## Planning and release docs
- Execution queue: [`QUEUE.md`](./QUEUE.md)
- Release + rollback notes: [`RELEASE.md`](./RELEASE.md)

## Run locally
```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Health check:
```bash
curl -s http://127.0.0.1:4242/health
```

## Quality gates
```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:ci
```

`test:coverage` enforces minimum thresholds:
- lines: 90%
- functions: 90%
- branches: 80%

## CI
GitHub Actions workflow: `.github/workflows/ci.yml`
- lint/typecheck
- test coverage gate
- build
