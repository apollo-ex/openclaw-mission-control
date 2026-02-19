# task_plan.md

## Objective
Implement P0/P1 kickoff for OpenClaw Mission Control (MC-001..MC-004 minimum, begin MC-005).

## Ticket plan
- [x] MC-001: Bootstrap service, env/config, logger, error boundary, `/health`.
- [x] MC-002: Read-only typed source adapters with freshness/source metadata.
- [x] MC-003: SQLite schema + migrations + seed + idempotent upserts.
- [x] MC-004: Collector scheduler with hot/warm cadence, retry/backoff, stale markers.
- [x] MC-005 (partial): redaction utility and ingest-boundary integration for text payloads.

## Verification plan
- Run migrations + seed on fresh DB.
- Run unit tests for adapters/redaction/db/scheduler behavior.
- Start dev server and verify `/health` returns `ok`.
