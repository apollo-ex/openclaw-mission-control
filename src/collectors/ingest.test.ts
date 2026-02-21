import test from 'node:test';
import assert from 'node:assert/strict';
import type { SourceMetadata } from '../adapters/types.js';
import { createTestDatabase } from '../db/test-utils.js';
import { ingestCronSnapshot, ingestMemorySnapshot, ingestSessionsSnapshot, ingestStatusSnapshot } from './ingest.js';

const withDb = async <T>(fn: (db: Awaited<ReturnType<typeof createTestDatabase>>['db']) => Promise<T> | T): Promise<T> => {
  const { db, close } = await createTestDatabase();

  try {
    return await fn(db);
  } finally {
    await close();
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
  await withDb(async (db) => {
    await ingestSessionsSnapshot(db, {
      metadata: baseMetadata('sessions', 'openclaw sessions list --json'),
      data: [
        {
          sessionKey: 'session-1',
          sessionId: 'sid-1',
          label: 'First session',
          status: 'active',
          startedAt: null,
          endedAt: null,
          runtimeMs: 13,
          model: 'gpt-5.3-codex',
          agentId: 'coder',
          sessionKind: 'direct',
          runType: 'subagent',
          lastUpdateAt: '2026-02-19T10:00:00.000Z'
        }
      ],
      warnings: ['sessions_command_failed:transient']
    });

    const sessionResult = await db.query<{ session_key: string; label: string; status: string }>(
      'SELECT session_key, label, status FROM sessions WHERE session_key = $1',
      ['session-1']
    );

    const sessionRow = sessionResult.rows[0];
    assert.equal(sessionRow?.session_key, 'session-1');
    assert.equal(sessionRow?.label, 'First session');
    assert.equal(sessionRow?.status, 'active');

    const eventResult = await db.query<{ category: string; title: string; details: string }>(
      'SELECT category, title, details FROM events WHERE category = $1',
      ['sessions']
    );

    const eventRow = eventResult.rows[0];
    assert.equal(eventRow?.title, 'sessions_adapter_warning');
    assert.equal(eventRow?.details, 'sessions_command_failed:transient');
  });
});

test('ingestCronSnapshot writes jobs/runs and warnings', async () => {
  await withDb(async (db) => {
    await ingestCronSnapshot(db, {
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

    const jobs = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM cron_jobs');
    const runs = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM cron_runs');
    const events = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM events WHERE category = $1', ['cron']);

    assert.equal(Number(jobs.rows[0]?.count ?? 0), 1);
    assert.equal(Number(runs.rows[0]?.count ?? 0), 1);
    assert.equal(Number(events.rows[0]?.count ?? 0), 1);
  });
});

test('ingestMemorySnapshot redacts persisted summaries and stores metadata payload', async () => {
  await withDb(async (db) => {
    await ingestMemorySnapshot(db, {
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

    const rowsResult = await db.query<{ path: string; redacted: boolean; summary: string }>(
      'SELECT path, redacted, summary FROM memory_docs ORDER BY path ASC'
    );

    const rows = rowsResult.rows;
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.path, '/tmp/workspace/memory/notes.md');
    assert.equal(rows[0]?.redacted, true);
    assert.equal(rows[0]?.summary.includes('[REDACTED]'), true);
    assert.equal(rows[1]?.path, '/tmp/workspace/memory/secrets.md');
    assert.equal(rows[1]?.summary, '[REDACTED:EXCLUDED_PATH]');

    const payloadResult = await db.query<{ payload_json: Array<{ redacted: boolean; indicators: string[] }> }>(
      'SELECT payload_json FROM source_snapshots WHERE source_type = $1 LIMIT 1',
      ['memory']
    );

    const payload = payloadResult.rows[0]?.payload_json ?? [];
    assert.equal(payload.length, 2);
    assert.equal(payload[0]?.redacted, true);
    assert.equal(payload[1]?.indicators.includes('path_excluded'), true);
  });
});

test('ingestStatusSnapshot redacts raw/warnings and stores health sample', async () => {
  await withDb(async (db) => {
    await ingestStatusSnapshot(db, {
      metadata: baseMetadata('status', '/tmp/.env'),
      data: {
        openclawStatus: 'degraded',
        raw: 'token=abcdef123456',
        errors: ['warning']
      },
      warnings: ['Bearer abcdefghijklmnop']
    });

    const healthResult = await db.query<{ openclaw_status: string; stale: boolean }>(
      'SELECT openclaw_status, stale FROM health_samples LIMIT 1'
    );

    const health = healthResult.rows[0];
    assert.equal(health?.openclaw_status, 'degraded');
    assert.equal(health?.stale, false);

    const statusEvent = await db.query<{ details: string }>('SELECT details FROM events WHERE category = $1 LIMIT 1', ['status']);
    assert.equal(statusEvent.rows[0]?.details, '[REDACTED:EXCLUDED_PATH]');

    const snapshotResult = await db.query<{ payload_json: { rawSummary: string; redactionIndicators: string[] } }>(
      'SELECT payload_json FROM source_snapshots WHERE source_type = $1 LIMIT 1',
      ['status']
    );

    const payload = snapshotResult.rows[0]?.payload_json;
    assert.equal(payload?.rawSummary, '[REDACTED:EXCLUDED_PATH]');
    assert.equal(payload?.redactionIndicators.includes('path_excluded'), true);
  });
});
