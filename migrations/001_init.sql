CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  meta_json TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  role TEXT,
  configured INTEGER NOT NULL DEFAULT 0,
  source_snapshot_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  runtime_ms INTEGER,
  model TEXT,
  agent_id TEXT,
  source_snapshot_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS cron_jobs (
  job_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule_kind TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  next_run_at TEXT,
  source_snapshot_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS cron_runs (
  run_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  summary TEXT NOT NULL,
  source_snapshot_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES cron_jobs(job_id),
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS memory_docs (
  path TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_snapshot_id TEXT,
  redacted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_samples (
  sample_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  ts TEXT NOT NULL,
  openclaw_status TEXT NOT NULL,
  host_stats_json TEXT,
  errors_json TEXT,
  stale INTEGER NOT NULL DEFAULT 0,
  source_snapshot_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_snapshot_id) REFERENCES source_snapshots(id)
);

CREATE TABLE IF NOT EXISTS collector_state (
  collector_name TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_error_at TEXT,
  error_count INTEGER NOT NULL DEFAULT 0,
  stale INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
