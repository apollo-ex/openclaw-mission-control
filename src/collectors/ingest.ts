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
  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(snapshot.data),
    metadata: snapshot.metadata,
    payload: snapshot.data
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
  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(snapshot.data),
    metadata: snapshot.metadata,
    payload: snapshot.data
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

  const snapshotId = await upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload({ ...snapshot.data, raw: redactedRaw.value }),
    metadata: snapshot.metadata,
    payload: {
      ...snapshot.data,
      raw: redactedRaw.value,
      redactionIndicators: redactedRaw.indicators
    }
  });

  await upsertHealthSample(db, { ...snapshot.data, raw: redactedRaw.value }, snapshotId, false);

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
