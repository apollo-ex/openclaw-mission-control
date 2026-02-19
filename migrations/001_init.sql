CREATE TABLE IF NOT EXISTS _migrations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  payload_hash TEXT NOT NULL,
  meta_json JSONB NOT NULL,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  role TEXT,
  configured BOOLEAN NOT NULL DEFAULT FALSE,
  source_snapshot_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  runtime_ms INTEGER,
  model TEXT,
  agent_id TEXT,
  source_snapshot_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS cron_jobs (
  job_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_kind TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  next_run_at TIMESTAMPTZ,
  source_snapshot_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS cron_runs (
  run_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  summary TEXT NOT NULL,
  source_snapshot_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY(job_id) REFERENCES cron_jobs(job_id),
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS memory_docs (
  path TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  source_snapshot_id TEXT,
  redacted BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  ts TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_samples (
  sample_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  ts TIMESTAMPTZ NOT NULL,
  openclaw_status TEXT NOT NULL,
  host_stats_json JSONB,
  errors_json JSONB,
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  source_snapshot_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS collector_state (
  collector_name TEXT PRIMARY KEY,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT
);
