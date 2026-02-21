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

test('SessionsAdapter handles gateway + fallback command errors safely', async () => {
  let calls = 0;
  const adapter = new SessionsAdapter(
    async () => {
      calls += 1;
      return {
        stdout: '',
        stderr: calls === 1 ? 'gateway down' : 'sessions unavailable',
        exitCode: 1
      };
    },
    { activeWindowMs: 60_000, limit: 50 },
    ['openclaw', 'gateway', 'call', 'sessions.list', '--json'],
    ['openclaw', 'sessions', '--json']
  );

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.length, 0);
  assert.equal(snapshot.metadata.readOnly, true);
  assert.equal(snapshot.warnings.includes('sessions_gateway_failed:gateway down'), true);
  assert.equal(snapshot.warnings.includes('sessions_command_failed:sessions unavailable'), true);
});

test('SessionsAdapter normalizes gateway sessions payload with run typing + active inference', async () => {
  const now = Date.now();
  const adapter = new SessionsAdapter(
    async () => ({
      stdout: JSON.stringify({
        sessions: [
          {
            key: 'agent:coder:subagent:abc-123',
            sessionId: 'sid-sub',
            label: 'worker',
            kind: 'direct',
            updatedAt: now - 5 * 60 * 1000,
            model: 'gpt-5.3-codex'
          },
          {
            key: 'agent:main:cron:def-456',
            displayName: 'Cron: digest',
            kind: 'direct',
            updatedAt: now - 40 * 60 * 1000
          }
        ]
      }),
      stderr: '',
      exitCode: 0
    }),
    { activeWindowMs: 10 * 60 * 1000, limit: 200 }
  );

  const snapshot = await adapter.collect();

  assert.equal(snapshot.warnings.length, 0);
  assert.equal(snapshot.data.length, 2);
  assert.equal(snapshot.data[0]?.sessionKey, 'agent:coder:subagent:abc-123');
  assert.equal(snapshot.data[0]?.status, 'active');
  assert.equal(snapshot.data[0]?.runType, 'subagent');
  assert.equal(snapshot.data[0]?.agentId, 'coder');
  assert.equal(snapshot.data[1]?.runType, 'cron');
  assert.equal(snapshot.data[1]?.status, 'recent');
  assert.equal(snapshot.data[1]?.label, 'Cron: digest');
});

test('SessionsAdapter falls back to `openclaw sessions --json` payload shape', async () => {
  let calls = 0;
  const adapter = new SessionsAdapter(
    async () => {
      calls += 1;
      if (calls === 1) {
        return { stdout: '', stderr: 'gateway unavailable', exitCode: 1 };
      }

      return {
        stdout: JSON.stringify({
          sessions: [
            {
              key: 'agent:main:main',
              updatedAt: Date.now(),
              kind: 'direct',
              model: 'gpt-5.3-codex'
            }
          ]
        }),
        stderr: '',
        exitCode: 0
      };
    },
    { activeWindowMs: 30_000, limit: 20 },
    ['openclaw', 'gateway', 'call', 'sessions.list', '--json'],
    ['openclaw', 'sessions', '--json']
  );

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.length, 1);
  assert.equal(snapshot.data[0]?.runType, 'main');
  assert.equal(snapshot.warnings.includes('sessions_gateway_failed:gateway unavailable'), true);
});

test('SessionsAdapter warns on invalid JSON', async () => {
  const adapter = new SessionsAdapter(async () => ({
    stdout: '{not-json}',
    stderr: '',
    exitCode: 0
  }));

  const snapshot = await adapter.collect();

  assert.equal(snapshot.data.length, 0);
  assert.equal(snapshot.warnings.includes('sessions_gateway_non_json_output'), true);
  assert.equal(snapshot.warnings.includes('sessions_output_not_json'), true);
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
