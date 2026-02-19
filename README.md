# OpenClaw Mission Control

Local-first, read-only observability for OpenClaw runtime state.

## Components

- **Backend service (`/`)**
  - Collects read-only snapshots from OpenClaw surfaces
  - Persists to local SQLite cache
  - Exposes read-only HTTP API for dashboards
- **Frontend (`apps/mission-control-web`)**
  - Next.js + TypeScript dashboard
  - Vercel-compatible deploy target
  - Consumes backend read-only API contracts

## Read-only API contracts

- `GET /api/contracts`
- `GET /api/overview`
- `GET /api/agents`
- `GET /api/memory`
- `GET /api/cron`
- `GET /api/health`

No mutating routes are exposed.

## Run locally

### Backend

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

### Frontend

```bash
cd apps/mission-control-web
npm install
cp .env.example .env.local
npm run dev
```

Open: `http://127.0.0.1:3000`

## Quality gates

### Backend

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

### Frontend

```bash
cd apps/mission-control-web
npm run lint
npm run test
npm run build
npm run test:ci
```

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`
- backend lint/typecheck
- backend test coverage gate
- backend build

## Deployment

Hybrid deployment runbook:
- [`HYBRID_DEPLOYMENT.md`](./HYBRID_DEPLOYMENT.md)

Release + rollback checklist:
- [`RELEASE.md`](./RELEASE.md)
