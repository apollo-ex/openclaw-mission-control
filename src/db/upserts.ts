import crypto from 'node:crypto';
import type { CronJobRecord, CronRunRecord, MemoryDocRecord, SessionRecord, SourceMetadata, StatusSnapshot } from '../adapters/types.js';
import type { RedactionResult } from '../security/redaction.js';
import type { DbExecutor } from './types.js';

const makeId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`;

const makeIdempotency = (...parts: string[]): string => parts.join('::');

export interface SourceSnapshotInput {
  sourceType: string;
  capturedAt: string;
  payloadHash: string;
  metadata: SourceMetadata;
  payload?: unknown;
}

export const upsertSourceSnapshot = async (db: DbExecutor, input: SourceSnapshotInput): Promise<string> => {
  const idempotencyKey = makeIdempotency(input.sourceType, input.capturedAt, input.payloadHash);
  const existing = await db.query<{ id: string }>('SELECT id FROM source_snapshots WHERE idempotency_key = $1', [idempotencyKey]);

  if (existing.rowCount && existing.rows[0]) {
    return existing.rows[0].id;
  }

  const snapshotId = makeId('snapshot');

  await db.query(
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
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
    `,
    [
      snapshotId,
      idempotencyKey,
      input.sourceType,
      input.capturedAt,
      input.payloadHash,
      JSON.stringify(input.metadata),
      input.payload ? JSON.stringify(input.payload) : null
    ]
  );

  return snapshotId;
};

export const upsertSessions = async (db: DbExecutor, rows: SessionRecord[], sourceSnapshotId: string): Promise<void> => {
  const updatedAt = new Date().toISOString();

  for (const row of rows) {
    await db.query(
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      `,
      [
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
      ]
    );
  }
};

export const upsertCronJobs = async (db: DbExecutor, rows: CronJobRecord[], sourceSnapshotId: string): Promise<void> => {
  const updatedAt = new Date().toISOString();

  for (const row of rows) {
    await db.query(
      `
        INSERT INTO cron_jobs (
          job_id,
          name,
          schedule_kind,
          enabled,
          next_run_at,
          source_snapshot_id,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(job_id) DO UPDATE SET
          name = excluded.name,
          schedule_kind = excluded.schedule_kind,
          enabled = excluded.enabled,
          next_run_at = excluded.next_run_at,
          source_snapshot_id = excluded.source_snapshot_id,
          updated_at = excluded.updated_at
      `,
      [row.jobId, row.name, row.scheduleKind, row.enabled, row.nextRunAt, sourceSnapshotId, updatedAt]
    );
  }
};

export const upsertCronRuns = async (db: DbExecutor, rows: CronRunRecord[], sourceSnapshotId: string): Promise<void> => {
  const updatedAt = new Date().toISOString();

  for (const row of rows) {
    await db.query(
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(run_id) DO UPDATE SET
          job_id = excluded.job_id,
          status = excluded.status,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          summary = excluded.summary,
          source_snapshot_id = excluded.source_snapshot_id,
          updated_at = excluded.updated_at
      `,
      [row.runId, row.jobId, row.status, row.startedAt, row.endedAt, row.summary, sourceSnapshotId, updatedAt]
    );
  }
};

export const upsertMemoryDocs = async (
  db: DbExecutor,
  rows: Array<MemoryDocRecord & { redaction: RedactionResult }>,
  sourceSnapshotId: string
): Promise<void> => {
  for (const row of rows) {
    const summary = row.redaction.value.slice(0, 240);

    await db.query(
      `
        INSERT INTO memory_docs (
          path,
          kind,
          updated_at,
          summary,
          source_snapshot_id,
          redacted
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(path) DO UPDATE SET
          kind = excluded.kind,
          updated_at = excluded.updated_at,
          summary = excluded.summary,
          source_snapshot_id = excluded.source_snapshot_id,
          redacted = excluded.redacted
      `,
      [row.path, row.kind, row.updatedAt, summary, sourceSnapshotId, row.redaction.redacted]
    );
  }
};

export const appendEvent = async (
  db: DbExecutor,
  event: {
    ts: string;
    category: string;
    severity: string;
    title: string;
    details: string;
    sourceRef?: string;
  }
): Promise<void> => {
  const eventId = makeId('event');
  const idempotencyKey = makeIdempotency(event.category, event.severity, event.title, event.ts);

  await db.query(
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(idempotency_key) DO NOTHING
    `,
    [eventId, idempotencyKey, event.ts, event.category, event.severity, event.title, event.details, event.sourceRef ?? null]
  );
};

export const upsertHealthSample = async (
  db: DbExecutor,
  sample: StatusSnapshot,
  sourceSnapshotId: string,
  stale: boolean
): Promise<void> => {
  const ts = new Date().toISOString();
  const sampleId = makeId('health');
  const idempotencyKey = makeIdempotency(sample.openclawStatus, sample.raw, ts.slice(0, 19));

  await db.query(
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
      ) VALUES ($1, $2, $3, $4, NULL, $5::jsonb, $6, $7)
      ON CONFLICT(idempotency_key) DO NOTHING
    `,
    [sampleId, idempotencyKey, ts, sample.openclawStatus, JSON.stringify(sample.errors), stale, sourceSnapshotId]
  );
};

export const markCollectorSuccess = async (db: DbExecutor, collectorName: string): Promise<void> => {
  const now = new Date().toISOString();

  await db.query(
    `
      INSERT INTO collector_state (collector_name, last_success_at, last_error_at, error_count, stale, last_error)
      VALUES ($1, $2, NULL, 0, FALSE, NULL)
      ON CONFLICT(collector_name) DO UPDATE SET
        last_success_at = excluded.last_success_at,
        last_error_at = NULL,
        error_count = 0,
        stale = FALSE,
        last_error = NULL
    `,
    [collectorName, now]
  );
};

export const markCollectorFailure = async (
  db: DbExecutor,
  collectorName: string,
  errorMessage: string,
  stale: boolean
): Promise<void> => {
  const now = new Date().toISOString();

  await db.query(
    `
      INSERT INTO collector_state (collector_name, last_success_at, last_error_at, error_count, stale, last_error)
      VALUES ($1, NULL, $2, 1, $3, $4)
      ON CONFLICT(collector_name) DO UPDATE SET
        last_error_at = excluded.last_error_at,
        error_count = collector_state.error_count + 1,
        stale = excluded.stale,
        last_error = excluded.last_error
    `,
    [collectorName, now, stale, errorMessage]
  );
};
