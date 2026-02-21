import crypto from 'node:crypto';
import type { CollectedSnapshot, CronSnapshot, MemoryDocRecord, SessionRecord, StatusSnapshot } from '../adapters/types.js';
import {
  appendEvent,
  upsertCronJobs,
  upsertCronRuns,
  upsertHealthSample,
  upsertMemoryDocs,
  upsertSessions,
  upsertSourceSnapshot
} from '../db/upserts.js';
import type { DbExecutor } from '../db/types.js';
import { redactText } from '../security/redaction.js';

const hashPayload = (payload: unknown): string => {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

export const ingestSessionsSnapshot = async (db: DbExecutor, snapshot: CollectedSnapshot<SessionRecord[]>): Promise<void> => {
  const compactSessionsPayload = {
    total: snapshot.data.length,
    active: snapshot.data.filter((row) => row.status === 'active').length,
    sessions: snapshot.data.slice(0, 200).map((row) => ({
      sessionKey: row.sessionKey,
      status: row.status,
      agentId: row.agentId,
      runType: row.runType,
      lastUpdateAt: row.lastUpdateAt
    }))
  };

  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(compactSessionsPayload),
    metadata: snapshot.metadata,
    payload: compactSessionsPayload
  });

  await upsertSessions(db, snapshot.data, snapshotId);

  for (const warning of snapshot.warnings) {
    await appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'sessions',
      severity: 'warning',
      title: 'sessions_adapter_warning',
      details: warning,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};

export const ingestCronSnapshot = async (db: DbExecutor, snapshot: CollectedSnapshot<CronSnapshot>): Promise<void> => {
  const compactCronPayload = {
    jobs: snapshot.data.jobs.map((job) => ({
      jobId: job.jobId,
      name: job.name,
      scheduleKind: job.scheduleKind,
      enabled: job.enabled,
      nextRunAt: job.nextRunAt
    })),
    runs: snapshot.data.runs.slice(0, 200).map((run) => ({
      runId: run.runId,
      jobId: run.jobId,
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      summary: run.summary
    }))
  };

  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(compactCronPayload),
    metadata: snapshot.metadata,
    payload: compactCronPayload
  });

  await upsertCronJobs(db, snapshot.data.jobs, snapshotId);
  await upsertCronRuns(db, snapshot.data.runs, snapshotId);

  for (const warning of snapshot.warnings) {
    await appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'cron',
      severity: 'warning',
      title: 'cron_adapter_warning',
      details: warning,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};

export const ingestMemorySnapshot = async (db: DbExecutor, snapshot: CollectedSnapshot<MemoryDocRecord[]>): Promise<void> => {
  const redactedDocs = snapshot.data.map((doc) => ({
    ...doc,
    redaction: redactText(doc.content, doc.path)
  }));

  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(redactedDocs.map((item) => ({ path: item.path, value: item.redaction.value }))),
    metadata: snapshot.metadata,
    payload: redactedDocs.map((doc) => ({
      path: doc.path,
      kind: doc.kind,
      updatedAt: doc.updatedAt,
      redacted: doc.redaction.redacted,
      indicators: doc.redaction.indicators
    }))
  });

  await upsertMemoryDocs(db, redactedDocs, snapshotId);

  for (const warning of snapshot.warnings) {
    await appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'memory',
      severity: 'warning',
      title: 'memory_adapter_warning',
      details: warning,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};

export const ingestStatusSnapshot = async (db: DbExecutor, snapshot: CollectedSnapshot<StatusSnapshot>): Promise<void> => {
  const redactedRaw = redactText(snapshot.data.raw, snapshot.metadata.sourceRef);

  const compactStatusPayload = {
    openclawStatus: snapshot.data.openclawStatus,
    errors: snapshot.data.errors,
    rawSummary: redactedRaw.value.slice(0, 2048),
    redactionIndicators: redactedRaw.indicators
  };

  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(compactStatusPayload),
    metadata: snapshot.metadata,
    payload: compactStatusPayload
  });

  await upsertHealthSample(db, { ...snapshot.data, raw: redactedRaw.value.slice(0, 2048) }, snapshotId, false);

  for (const warning of snapshot.warnings) {
    const redactedWarning = redactText(warning, snapshot.metadata.sourceRef);
    await appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'status',
      severity: 'warning',
      title: 'status_adapter_warning',
      details: redactedWarning.value,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};
