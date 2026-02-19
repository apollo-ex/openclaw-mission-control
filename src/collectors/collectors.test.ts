import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectors } from './collectors.js';

test('buildCollectors wires expected task names and cadence intervals', () => {
  const tasks = buildCollectors({
    host: '127.0.0.1',
    port: 4242,
    dbPath: '/tmp/test.sqlite',
    workspaceRoot: '/tmp/workspace',
    hotIntervalMs: 5000,
    warmIntervalMs: 25000,
    collectorMaxRetries: 3,
    collectorBackoffBaseMs: 100,
    collectorBackoffMaxMs: 2000
  });

  assert.deepEqual(
    tasks.map((task) => task.name),
    ['sessions_hot', 'cron_hot', 'health_hot', 'memory_warm']
  );

  assert.equal(tasks[0]?.cadence.kind, 'hot');
  assert.equal(tasks[0]?.cadence.intervalMs, 5000);
  assert.equal(tasks[3]?.cadence.kind, 'warm');
  assert.equal(tasks[3]?.cadence.intervalMs, 25000);
});
