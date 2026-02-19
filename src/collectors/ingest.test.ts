import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { SourceMetadata } from '../adapters/types.js';
import { openDatabase } from '../db/client.js';
import { applyMigrations } from '../db/migrations.js';
import { ingestCronSnapshot, ingestMemorySnapshot, ingestSessionsSnapshot, ingestStatusSnapshot } from './ingest.js';

const withDb = async <T>(fn: (db: ReturnType<typeof openDatabase>) => Promise<T> | T): Promise<T> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-ingest-'));
  const dbPath = path.join(tmpRoot, 'test.sqlite');
  const db = openDatabase(dbPath);

  try {
    applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
    return await fn(db);
  } finally {
    db.close();
  }
};

const baseMetadata = (sourceType: SourceMetadata['sourceType'], sourceRef: string): SourceMetadata => ({
  sourceType,
  capturedAt: '2026-02-19T10:00:00.000Z',
  freshnessMs: 0,
  readOnly: true,
  transport: sourceType === 'memory' ? 'filesystem' : 'command',
  sourceRef
});

test('ingestSessionsSnapshot writes sessions and warning event', async () => {
  await withDb((db) => {
    ingestSessionsSnapshot(db, {
      metadata: baseMetadata('sessions', 'openclaw sessions list --json'),
      data: [
        {
          sessionKey: 'session-1',
          label: 'First session',
          status: 'active',
          startedAt: null,
          endedAt: null,
          runtimeMs: 13,
          model: 'gpt-5.3-codex',
          agentId: 'coder'
        }
      ],
      warnings: ['sessions_command_failed:transient']
    });

    const sessionRow = db
      .prepare('SELECT session_key as sessionKey, label, status FROM sessions WHERE session_key = ?')
      .get('session-1') as { sessionKey: string; label: string; status: string };

    assert.equal(sessionRow.sessionKey, 'session-1');
    assert.equal(sessionRow.label, 'First session');
    assert.equal(sessionRow.status, 'active');

    const eventRow = db
      .prepare('SELECT category, title, details FROM events WHERE category = ?')
      .get('sessions') as { category: string; title: string; details: string };

    assert.equal(eventRow.title, 'sessions_adapter_warning');
    assert.equal(eventRow.details, 'sessions_command_failed:transient');
  });
});

test('ingestCronSnapshot writes jobs/runs and warnings', async () => {
  await withDb((db) => {
    ingestCronSnapshot(db, {
      metadata: baseMetadata('cron', 'openclaw cron list --json'),
      data: {
        jobs: [
          {
            jobId: 'job-1',
            name: 'Poll',
            scheduleKind: 'hot',
            enabled: true,
            nextRunAt: null
          }
        ],
        runs: [
          {
            runId: 'run-1',
            jobId: 'job-1',
            status: 'ok',
            startedAt: null,
            endedAt: null,
            summary: 'completed'
          }
        ]
      },
      warnings: ['cron_output_not_json']
    });

    const jobs = db.prepare('SELECT COUNT(*) as count FROM cron_jobs').get() as { count: number };
    const runs = db.prepare('SELECT COUNT(*) as count FROM cron_runs').get() as { count: number };
    const events = db.prepare('SELECT COUNT(*) as count FROM events WHERE category = ?').get('cron') as { count: number };

    assert.equal(jobs.count, 1);
    assert.equal(runs.count, 1);
    assert.equal(events.count, 1);
  });
});

test('ingestMemorySnapshot redacts persisted summaries and stores metadata payload', async () => {
  await withDb((db) => {
    ingestMemorySnapshot(db, {
      metadata: baseMetadata('memory', '/tmp/workspace'),
      data: [
        {
          path: '/tmp/workspace/memory/notes.md',
          kind: 'memory',
          updatedAt: '2026-02-19T09:59:59.000Z',
          content: 'token=abc12345'
        },
        {
          path: '/tmp/workspace/memory/secrets.md',
          kind: 'memory',
          updatedAt: '2026-02-19T09:59:58.000Z',
          content: 'nothing to see'
        }
      ],
      warnings: []
    });

    const rows = db
      .prepare('SELECT path, redacted, summary FROM memory_docs ORDER BY path ASC')
      .all() as Array<{ path: string; redacted: number; summary: string }>;

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.path, '/tmp/workspace/memory/notes.md');
    assert.equal(rows[0]?.redacted, 1);
    assert.equal(rows[0]?.summary.includes('[REDACTED]'), true);
    assert.equal(rows[1]?.path, '/tmp/workspace/memory/secrets.md');
    assert.equal(rows[1]?.summary, '[REDACTED:EXCLUDED_PATH]');

    const payloadRow = db
      .prepare('SELECT payload_json as payloadJson FROM source_snapshots WHERE source_type = ? LIMIT 1')
      .get('memory') as { payloadJson: string };

    const payload = JSON.parse(payloadRow.payloadJson) as Array<{ redacted: boolean; indicators: string[] }>;
    assert.equal(payload.length, 2);
    assert.equal(payload[0]?.redacted, true);
    assert.equal(payload[1]?.indicators.includes('path_excluded'), true);
  });
});

test('ingestStatusSnapshot redacts raw/warnings and stores health sample', async () => {
  await withDb((db) => {
    ingestStatusSnapshot(db, {
      metadata: baseMetadata('status', '/tmp/.env'),
      data: {
        openclawStatus: 'degraded',
        raw: 'token=abcdef123456',
        errors: ['warning']
      },
      warnings: ['Bearer abcdefghijklmnop']
    });

    const health = db
      .prepare('SELECT openclaw_status as openclawStatus, stale FROM health_samples LIMIT 1')
      .get() as { openclawStatus: string; stale: number };

    assert.equal(health.openclawStatus, 'degraded');
    assert.equal(health.stale, 0);

    const statusEvent = db
      .prepare('SELECT details FROM events WHERE category = ? LIMIT 1')
      .get('status') as { details: string };

    assert.equal(statusEvent.details, '[REDACTED:EXCLUDED_PATH]');

    const snapshot = db
      .prepare('SELECT payload_json as payloadJson FROM source_snapshots WHERE source_type = ? LIMIT 1')
      .get('status') as { payloadJson: string };

    const payload = JSON.parse(snapshot.payloadJson) as { raw: string; redactionIndicators: string[] };
    assert.equal(payload.raw, '[REDACTED:EXCLUDED_PATH]');
    assert.equal(payload.redactionIndicators.includes('path_excluded'), true);
  });
});
