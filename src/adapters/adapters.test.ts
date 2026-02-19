import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CronAdapter } from './cron-adapter.js';
import { MemoryAdapter } from './memory-adapter.js';
import { SessionsAdapter } from './sessions-adapter.js';
import { StatusAdapter } from './status-adapter.js';
import type { ReadonlySourceAdapter } from './types.js';

type AssertFalse<T extends false> = T;
type _NoWriteMethodOnReadonlyAdapter = AssertFalse<'write' extends keyof ReadonlySourceAdapter<unknown> ? true : false>;
void (0 as unknown as _NoWriteMethodOnReadonlyAdapter);

test('MemoryAdapter collects core docs and memory docs from filesystem', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-memory-'));
  await fs.mkdir(path.join(root, 'memory'));

  await fs.writeFile(path.join(root, 'SOUL.md'), 'soul');
  await fs.writeFile(path.join(root, 'USER.md'), 'user');
  await fs.writeFile(path.join(root, 'MEMORY.md'), 'memory');
  await fs.writeFile(path.join(root, 'memory', 'a.md'), '# note');

  const adapter = new MemoryAdapter(root);
  const snapshot = await adapter.collect();

  assert.equal(snapshot.metadata.sourceType, 'memory');
  assert.equal(snapshot.metadata.readOnly, true);
  assert.equal(snapshot.data.length, 4);
  assert.equal(snapshot.warnings.length, 0);
});

test('MemoryAdapter surfaces warnings for missing docs and unavailable memory folder', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-memory-missing-'));
  const adapter = new MemoryAdapter(root);

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.length, 0);
  assert.equal(snapshot.warnings.includes('missing_core_doc:SOUL.md'), true);
  assert.equal(snapshot.warnings.includes('missing_core_doc:USER.md'), true);
  assert.equal(snapshot.warnings.includes('missing_core_doc:MEMORY.md'), true);
  assert.equal(snapshot.warnings.includes('memory_dir_unavailable'), true);
});

test('SessionsAdapter handles command errors safely', async () => {
  const adapter = new SessionsAdapter(async () => ({
    stdout: '',
    stderr: 'boom',
    exitCode: 1
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.length, 0);
  assert.equal(snapshot.metadata.readOnly, true);
  assert.equal(snapshot.warnings[0]?.startsWith('sessions_command_failed:'), true);
});

test('SessionsAdapter normalizes JSON rows and unknown values', async () => {
  const adapter = new SessionsAdapter(async () => ({
    stdout: JSON.stringify([
      {
        session_key: 's-legacy',
        label: 'Legacy',
        status: 'active',
        startedAt: '2026-01-01T00:00:00.000Z',
        runtimeMs: 42,
        model: 'gpt-5',
        agentId: 'coder'
      },
      {
        id: 's-2',
        status: 'weird'
      },
      42
    ]),
    stderr: '',
    exitCode: 0
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.warnings.length, 0);
  assert.equal(snapshot.data.length, 2);
  assert.equal(snapshot.data[0]?.sessionKey, 's-legacy');
  assert.equal(snapshot.data[0]?.status, 'active');
  assert.equal(snapshot.data[1]?.sessionKey, 's-2');
  assert.equal(snapshot.data[1]?.label, 'unlabeled');
  assert.equal(snapshot.data[1]?.status, 'unknown');
});

test('SessionsAdapter warns on invalid JSON', async () => {
  const adapter = new SessionsAdapter(async () => ({
    stdout: '{not-json}',
    stderr: '',
    exitCode: 0
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.length, 0);
  assert.deepEqual(snapshot.warnings, ['sessions_output_not_json']);
});

test('CronAdapter parses jobs/runs and handles missing fields', async () => {
  const adapter = new CronAdapter(async () => ({
    stdout: JSON.stringify({
      jobs: [
        { id: 'job-1', name: 'Sweep', schedule_kind: 'hot', enabled: 1 },
        { jobId: 'job-2', enabled: false }
      ],
      runs: [
        { run_id: 'run-1', job_id: 'job-1', status: 'ok', summary: 'done' },
        { id: 'run-2', jobId: 'job-2' }
      ]
    }),
    stderr: '',
    exitCode: 0
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.warnings.length, 0);
  assert.equal(snapshot.data.jobs.length, 2);
  assert.equal(snapshot.data.runs.length, 2);
  assert.equal(snapshot.data.jobs[0]?.jobId, 'job-1');
  assert.equal(snapshot.data.jobs[0]?.enabled, true);
  assert.equal(snapshot.data.jobs[1]?.name, 'unnamed');
  assert.equal(snapshot.data.runs[1]?.summary, '');
});

test('CronAdapter returns warning payload on command failure', async () => {
  const adapter = new CronAdapter(async () => ({
    stdout: '',
    stderr: 'permission denied',
    exitCode: 2
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.jobs.length, 0);
  assert.equal(snapshot.data.runs.length, 0);
  assert.equal(snapshot.warnings[0], 'cron_command_failed:permission denied');
});

test('StatusAdapter classifies healthy/degraded/offline/unknown output', async () => {
  const healthy = new StatusAdapter(async () => ({ stdout: 'Gateway is running and healthy', stderr: '', exitCode: 0 }));
  const degraded = new StatusAdapter(async () => ({ stdout: 'warning: degraded state', stderr: '', exitCode: 0 }));
  const offline = new StatusAdapter(async () => ({ stdout: 'daemon stopped', stderr: '', exitCode: 0 }));
  const unknown = new StatusAdapter(async () => ({ stdout: 'mystery state', stderr: '', exitCode: 0 }));

  assert.equal((await healthy.collect()).data.openclawStatus, 'ok');
  assert.equal((await degraded.collect()).data.openclawStatus, 'degraded');
  assert.equal((await offline.collect()).data.openclawStatus, 'offline');
  assert.equal((await unknown.collect()).data.openclawStatus, 'unknown');
});

test('StatusAdapter captures command errors as unknown status', async () => {
  const adapter = new StatusAdapter(async () => ({
    stdout: '',
    stderr: 'binary missing',
    exitCode: 1
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.openclawStatus, 'unknown');
  assert.deepEqual(snapshot.data.errors, ['binary missing']);
  assert.equal(snapshot.warnings[0], 'status_command_failed:binary missing');
});
