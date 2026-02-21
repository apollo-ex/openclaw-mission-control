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
    const startedAt = row.startedAt ?? (row.status === 'active' ? row.lastUpdateAt ?? updatedAt : null);
    const endedAt = row.status === 'active' ? null : row.endedAt;

    await db.query(
      `
        INSERT INTO sessions (
          session_key,
          session_id,
          label,
          status,
          started_at,
          ended_at,
          runtime_ms,
          model,
          agent_id,
          session_kind,
          run_type,
          last_update_at,
          source_snapshot_id,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT(session_key) DO UPDATE SET
          session_id = excluded.session_id,
          label = excluded.label,
          status = excluded.status,
          started_at = CASE
            WHEN excluded.status = 'active' AND sessions.status <> 'active' THEN
              COALESCE(excluded.started_at, excluded.last_update_at, sessions.started_at)
            WHEN excluded.status = 'active' THEN
              COALESCE(sessions.started_at, excluded.started_at, excluded.last_update_at)
            ELSE COALESCE(excluded.started_at, sessions.started_at)
          END,
          ended_at = CASE
            WHEN excluded.status = 'active' THEN NULL
            ELSE COALESCE(excluded.ended_at, sessions.ended_at)
          END,
          runtime_ms = excluded.runtime_ms,
          model = excluded.model,
          agent_id = excluded.agent_id,
          session_kind = excluded.session_kind,
          run_type = excluded.run_type,
          last_update_at = COALESCE(excluded.last_update_at, sessions.last_update_at),
          source_snapshot_id = excluded.source_snapshot_id,
          updated_at = excluded.updated_at
      `,
      [
        row.sessionKey,
        row.sessionId,
        row.label,
        row.status,
        startedAt,
        endedAt,
        row.runtimeMs,
        row.model,
        row.agentId,
        row.sessionKind,
        row.runType,
        row.lastUpdateAt,
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

export interface SessionStreamOffsetInput {
  sessionId: string;
  sessionKey: string | null;
  transcriptPath: string;
  lastByteOffset: number;
  lastLineNumber: number;
}

export const upsertSessionStreamOffset = async (db: DbExecutor, input: SessionStreamOffsetInput): Promise<void> => {
  await db.query(
    `
      INSERT INTO session_stream_offsets (
        session_id,
        session_key,
        transcript_path,
        last_byte_offset,
        last_line_number,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT(session_id) DO UPDATE SET
        session_key = excluded.session_key,
        transcript_path = excluded.transcript_path,
        last_byte_offset = excluded.last_byte_offset,
        last_line_number = excluded.last_line_number,
        updated_at = NOW()
    `,
    [input.sessionId, input.sessionKey, input.transcriptPath, input.lastByteOffset, input.lastLineNumber]
  );
};

export interface SessionEventInput {
  sessionId: string;
  sessionKey: string | null;
  eventId: string;
  parentEventId: string | null;
  eventType: string;
  eventTs: string;
  sourceLine: number;
  rawJson: unknown;
}

export const insertSessionEvent = async (db: DbExecutor, input: SessionEventInput): Promise<void> => {
  await db.query(
    `
      INSERT INTO session_events (
        session_id,
        session_key,
        event_id,
        parent_event_id,
        event_type,
        event_ts,
        source_line,
        raw_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT(session_id, event_id) DO NOTHING
    `,
    [
      input.sessionId,
      input.sessionKey,
      input.eventId,
      input.parentEventId,
      input.eventType,
      input.eventTs,
      input.sourceLine,
      JSON.stringify(input.rawJson)
    ]
  );
};

export interface SessionMessageInput {
  sessionId: string;
  sessionKey: string | null;
  eventId: string;
  role: string;
  messageTs: string;
  textPreview: string | null;
  provider: string | null;
  model: string | null;
  stopReason: string | null;
  usageInput: number | null;
  usageOutput: number | null;
  usageTotal: number | null;
}

export const upsertSessionMessage = async (db: DbExecutor, input: SessionMessageInput): Promise<void> => {
  await db.query(
    `
      INSERT INTO session_messages (
        session_id,
        session_key,
        event_id,
        role,
        message_ts,
        text_preview,
        provider,
        model,
        stop_reason,
        usage_input,
        usage_output,
        usage_total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT(session_id, event_id) DO UPDATE SET
        session_key = excluded.session_key,
        role = excluded.role,
        message_ts = excluded.message_ts,
        text_preview = excluded.text_preview,
        provider = excluded.provider,
        model = excluded.model,
        stop_reason = excluded.stop_reason,
        usage_input = excluded.usage_input,
        usage_output = excluded.usage_output,
        usage_total = excluded.usage_total
    `,
    [
      input.sessionId,
      input.sessionKey,
      input.eventId,
      input.role,
      input.messageTs,
      input.textPreview,
      input.provider,
      input.model,
      input.stopReason,
      input.usageInput,
      input.usageOutput,
      input.usageTotal
    ]
  );
};

export interface ToolCallInput {
  sessionId: string;
  sessionKey: string | null;
  toolCallId: string;
  eventIdCall: string | null;
  toolName: string | null;
  argumentsJson: unknown;
  startedAt: string;
}

export const upsertToolCall = async (db: DbExecutor, input: ToolCallInput): Promise<void> => {
  await db.query(
    `
      INSERT INTO tool_spans (
        session_id,
        session_key,
        tool_call_id,
        event_id_call,
        tool_name,
        arguments_json,
        started_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
      ON CONFLICT(session_id, tool_call_id) DO UPDATE SET
        session_key = excluded.session_key,
        event_id_call = COALESCE(excluded.event_id_call, tool_spans.event_id_call),
        tool_name = COALESCE(excluded.tool_name, tool_spans.tool_name),
        arguments_json = COALESCE(excluded.arguments_json, tool_spans.arguments_json),
        started_at = COALESCE(excluded.started_at, tool_spans.started_at),
        updated_at = NOW()
    `,
    [input.sessionId, input.sessionKey, input.toolCallId, input.eventIdCall, input.toolName, JSON.stringify(input.argumentsJson), input.startedAt]
  );
};

export interface ToolResultInput {
  sessionId: string;
  sessionKey: string | null;
  toolCallId: string;
  eventIdResult: string | null;
  toolName: string | null;
  resultJson: unknown;
  isError: boolean;
  finishedAt: string;
}

export const upsertToolResult = async (db: DbExecutor, input: ToolResultInput): Promise<void> => {
  await db.query(
    `
      INSERT INTO tool_spans (
        session_id,
        session_key,
        tool_call_id,
        event_id_result,
        tool_name,
        result_json,
        is_error,
        finished_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW())
      ON CONFLICT(session_id, tool_call_id) DO UPDATE SET
        session_key = excluded.session_key,
        event_id_result = COALESCE(excluded.event_id_result, tool_spans.event_id_result),
        tool_name = COALESCE(excluded.tool_name, tool_spans.tool_name),
        result_json = COALESCE(excluded.result_json, tool_spans.result_json),
        is_error = excluded.is_error,
        finished_at = COALESCE(excluded.finished_at, tool_spans.finished_at),
        duration_ms = CASE
          WHEN tool_spans.started_at IS NOT NULL AND excluded.finished_at IS NOT NULL
            THEN GREATEST(0, (EXTRACT(EPOCH FROM (excluded.finished_at - tool_spans.started_at)) * 1000)::int)
          ELSE tool_spans.duration_ms
        END,
        updated_at = NOW()
    `,
    [
      input.sessionId,
      input.sessionKey,
      input.toolCallId,
      input.eventIdResult,
      input.toolName,
      JSON.stringify(input.resultJson),
      input.isError,
      input.finishedAt
    ]
  );
};
