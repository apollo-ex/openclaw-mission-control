import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
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
import { redactText } from '../security/redaction.js';

const hashPayload = (payload: unknown): string => {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

export const ingestSessionsSnapshot = (db: DatabaseSync, snapshot: CollectedSnapshot<SessionRecord[]>): void => {
  const snapshotId = upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(snapshot.data),
    metadata: snapshot.metadata,
    payload: snapshot.data
  });

  upsertSessions(db, snapshot.data, snapshotId);

  for (const warning of snapshot.warnings) {
    appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'sessions',
      severity: 'warning',
      title: 'sessions_adapter_warning',
      details: warning,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};

export const ingestCronSnapshot = (db: DatabaseSync, snapshot: CollectedSnapshot<CronSnapshot>): void => {
  const snapshotId = upsertSourceSnapshot(db, {
    sourceType: snapshot.metadata.sourceType,
    capturedAt: snapshot.metadata.capturedAt,
    payloadHash: hashPayload(snapshot.data),
    metadata: snapshot.metadata,
    payload: snapshot.data
  });

  upsertCronJobs(db, snapshot.data.jobs, snapshotId);
  upsertCronRuns(db, snapshot.data.runs, snapshotId);

  for (const warning of snapshot.warnings) {
    appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'cron',
      severity: 'warning',
      title: 'cron_adapter_warning',
      details: warning,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};

export const ingestMemorySnapshot = (db: DatabaseSync, snapshot: CollectedSnapshot<MemoryDocRecord[]>): void => {
  const redactedDocs = snapshot.data.map((doc) => ({
    ...doc,
    redaction: redactText(doc.content, doc.path)
  }));

  const snapshotId = upsertSourceSnapshot(db, {
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

  upsertMemoryDocs(db, redactedDocs, snapshotId);

  for (const warning of snapshot.warnings) {
    appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'memory',
      severity: 'warning',
      title: 'memory_adapter_warning',
      details: warning,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};

export const ingestStatusSnapshot = (db: DatabaseSync, snapshot: CollectedSnapshot<StatusSnapshot>): void => {
  const redactedRaw = redactText(snapshot.data.raw, snapshot.metadata.sourceRef);

  const snapshotId = upsertSourceSnapshot(db, {
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

  upsertHealthSample(db, { ...snapshot.data, raw: redactedRaw.value }, snapshotId, false);

  for (const warning of snapshot.warnings) {
    const redactedWarning = redactText(warning, snapshot.metadata.sourceRef);
    appendEvent(db, {
      ts: snapshot.metadata.capturedAt,
      category: 'status',
      severity: 'warning',
      title: 'status_adapter_warning',
      details: redactedWarning.value,
      sourceRef: snapshot.metadata.sourceRef
    });
  }
};
