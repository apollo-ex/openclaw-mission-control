import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { CronJobRecord, CronRunRecord, MemoryDocRecord, SessionRecord, SourceMetadata, StatusSnapshot } from '../adapters/types.js';
import type { RedactionResult } from '../security/redaction.js';

const makeId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

const makeIdempotency = (...parts: string[]): string => parts.join('::');

export interface SourceSnapshotInput {
  sourceType: string;
  capturedAt: string;
  payloadHash: string;
  metadata: SourceMetadata;
  payload?: unknown;
}

export const upsertSourceSnapshot = (db: DatabaseSync, input: SourceSnapshotInput): string => {
  const idempotencyKey = makeIdempotency(input.sourceType, input.capturedAt, input.payloadHash);
  const existing = db
    .prepare('SELECT id FROM source_snapshots WHERE idempotency_key = ?')
    .get(idempotencyKey) as { id: string } | undefined;

  if (existing) {
    return existing.id;
  }

  const snapshotId = makeId('snapshot');

  db.prepare(
    `
      INSERT INTO source_snapshots (
        id,
        idempotency_key,
        source_type,
        captured_at,
        payload_hash,
        meta_json,
        payload_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    snapshotId,
    idempotencyKey,
    input.sourceType,
    input.capturedAt,
    input.payloadHash,
    JSON.stringify(input.metadata),
    input.payload ? JSON.stringify(input.payload) : null
  );

  return snapshotId;
};

export const upsertSessions = (db: DatabaseSync, rows: SessionRecord[], sourceSnapshotId: string): void => {
  const updatedAt = new Date().toISOString();
  const stmt = db.prepare(
    `
      INSERT INTO sessions (
        session_key,
        label,
        status,
        started_at,
        ended_at,
        runtime_ms,
        model,
        agent_id,
        source_snapshot_id,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_key) DO UPDATE SET
        label = excluded.label,
        status = excluded.status,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        runtime_ms = excluded.runtime_ms,
        model = excluded.model,
        agent_id = excluded.agent_id,
        source_snapshot_id = excluded.source_snapshot_id,
        updated_at = excluded.updated_at
    `
  );

  for (const row of rows) {
    stmt.run(
      row.sessionKey,
      row.label,
      row.status,
      row.startedAt,
      row.endedAt,
      row.runtimeMs,
      row.model,
      row.agentId,
      sourceSnapshotId,
      updatedAt
    );
  }
};

export const upsertCronJobs = (db: DatabaseSync, rows: CronJobRecord[], sourceSnapshotId: string): void => {
  const updatedAt = new Date().toISOString();
  const stmt = db.prepare(
    `
      INSERT INTO cron_jobs (
        job_id,
        name,
        schedule_kind,
        enabled,
        next_run_at,
        source_snapshot_id,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(job_id) DO UPDATE SET
        name = excluded.name,
        schedule_kind = excluded.schedule_kind,
        enabled = excluded.enabled,
        next_run_at = excluded.next_run_at,
        source_snapshot_id = excluded.source_snapshot_id,
        updated_at = excluded.updated_at
    `
  );

  for (const row of rows) {
    stmt.run(row.jobId, row.name, row.scheduleKind, row.enabled ? 1 : 0, row.nextRunAt, sourceSnapshotId, updatedAt);
  }
};

export const upsertCronRuns = (db: DatabaseSync, rows: CronRunRecord[], sourceSnapshotId: string): void => {
  const updatedAt = new Date().toISOString();
  const stmt = db.prepare(
    `
      INSERT INTO cron_runs (
        run_id,
        job_id,
        status,
        started_at,
        ended_at,
        summary,
        source_snapshot_id,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        job_id = excluded.job_id,
        status = excluded.status,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        summary = excluded.summary,
        source_snapshot_id = excluded.source_snapshot_id,
        updated_at = excluded.updated_at
    `
  );

  for (const row of rows) {
    stmt.run(row.runId, row.jobId, row.status, row.startedAt, row.endedAt, row.summary, sourceSnapshotId, updatedAt);
  }
};

export const upsertMemoryDocs = (
  db: DatabaseSync,
  rows: Array<MemoryDocRecord & { redaction: RedactionResult }>,
  sourceSnapshotId: string
): void => {
  const stmt = db.prepare(
    `
      INSERT INTO memory_docs (
        path,
        kind,
        updated_at,
        summary,
        source_snapshot_id,
        redacted
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        kind = excluded.kind,
        updated_at = excluded.updated_at,
        summary = excluded.summary,
        source_snapshot_id = excluded.source_snapshot_id,
        redacted = excluded.redacted
    `
  );

  for (const row of rows) {
    const summary = row.redaction.value.slice(0, 240);
    stmt.run(row.path, row.kind, row.updatedAt, summary, sourceSnapshotId, row.redaction.redacted ? 1 : 0);
  }
};

export const appendEvent = (
  db: DatabaseSync,
  event: {
    ts: string;
    category: string;
    severity: string;
    title: string;
    details: string;
    sourceRef?: string;
  }
): void => {
  const eventId = makeId('event');
  const idempotencyKey = makeIdempotency(event.category, event.severity, event.title, event.ts);

  db.prepare(
    `
      INSERT INTO events (
        event_id,
        idempotency_key,
        ts,
        category,
        severity,
        title,
        details,
        source_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `
  ).run(eventId, idempotencyKey, event.ts, event.category, event.severity, event.title, event.details, event.sourceRef ?? null);
};

export const upsertHealthSample = (
  db: DatabaseSync,
  sample: StatusSnapshot,
  sourceSnapshotId: string,
  stale: boolean
): void => {
  const ts = new Date().toISOString();
  const sampleId = makeId('health');
  const idempotencyKey = makeIdempotency(sample.openclawStatus, sample.raw, ts.slice(0, 19));

  db.prepare(
    `
      INSERT INTO health_samples (
        sample_id,
        idempotency_key,
        ts,
        openclaw_status,
        host_stats_json,
        errors_json,
        stale,
        source_snapshot_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING
    `
  ).run(sampleId, idempotencyKey, ts, sample.openclawStatus, null, JSON.stringify(sample.errors), stale ? 1 : 0, sourceSnapshotId);
};

export const markCollectorSuccess = (db: DatabaseSync, collectorName: string): void => {
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO collector_state (collector_name, last_success_at, last_error_at, error_count, stale, last_error)
      VALUES (?, ?, NULL, 0, 0, NULL)
      ON CONFLICT(collector_name) DO UPDATE SET
        last_success_at = excluded.last_success_at,
        last_error_at = NULL,
        error_count = 0,
        stale = 0,
        last_error = NULL
    `
  ).run(collectorName, now);
};

export const markCollectorFailure = (db: DatabaseSync, collectorName: string, errorMessage: string, stale: boolean): void => {
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO collector_state (collector_name, last_success_at, last_error_at, error_count, stale, last_error)
      VALUES (?, NULL, ?, 1, ?, ?)
      ON CONFLICT(collector_name) DO UPDATE SET
        last_error_at = excluded.last_error_at,
        error_count = collector_state.error_count + 1,
        stale = excluded.stale,
        last_error = excluded.last_error
    `
  ).run(collectorName, now, stale ? 1 : 0, errorMessage);
};
