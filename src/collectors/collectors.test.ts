import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectors } from './collectors.js';

test('buildCollectors wires expected task names and cadence intervals', () => {
  const tasks = buildCollectors({
    host: '127.0.0.1',
    port: 4242,
    databaseUrl: 'postgresql://openclaw_test_user@localhost:5432/openclaw_test_db',
    databaseUrlDirect: 'postgresql://openclaw_test_user@localhost:5432/openclaw_test_db',
    apiToken: null,
    workspaceRoot: '/tmp/workspace',
    hotIntervalMs: 5000,
    warmIntervalMs: 25000,
    collectorMaxRetries: 3,
    collectorBackoffBaseMs: 100,
    collectorBackoffMaxMs: 2000,
    sessionActiveWindowMs: 900000,
    sessionsListLimit: 500
  });

  assert.deepEqual(
    tasks.map((task) => task.name),
    ['sessions_hot', 'cron_hot', 'health_hot', 'memory_warm', 'session_stream_hot']
  );

  assert.equal(tasks[0]?.cadence.kind, 'hot');
  assert.equal(tasks[0]?.cadence.intervalMs, 5000);
  assert.equal(tasks[3]?.cadence.kind, 'warm');
  assert.equal(tasks[3]?.cadence.intervalMs, 25000);
  assert.equal(tasks[4]?.cadence.kind, 'hot');
  assert.equal(tasks[4]?.cadence.intervalMs, 5000);
});
