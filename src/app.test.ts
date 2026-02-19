import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from './app.js';
import { seedDatabase } from './db/seed.js';
import { createTestDatabase } from './db/test-utils.js';
import type { Logger } from './lib/logger.js';

const makeDatabase = async () => {
  const context = await createTestDatabase();
  const db = context.db;

  await seedDatabase(db);

  await db.query(
    `
      INSERT INTO sessions (session_key, label, status, started_at, ended_at, runtime_ms, model, agent_id, source_snapshot_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
    `,
    [
      'session-1',
      'Mission Control Scheduler',
      'active',
      '2026-02-19T10:00:00.000Z',
      null,
      15000,
      'gpt-5.3-codex',
      'local-observer',
      '2026-02-19T10:00:01.000Z'
    ]
  );

  await db.query(
    `
      INSERT INTO cron_jobs (job_id, name, schedule_kind, enabled, next_run_at, source_snapshot_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, NULL, $6)
    `,
    ['cron-1', 'sessions_hot', 'interval', true, '2026-02-19T10:01:00.000Z', '2026-02-19T10:00:01.000Z']
  );

  await db.query(
    `
      INSERT INTO cron_runs (run_id, job_id, status, started_at, ended_at, summary, source_snapshot_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
    `,
    ['run-1', 'cron-1', 'success', '2026-02-19T09:59:00.000Z', '2026-02-19T09:59:05.000Z', 'collector succeeded', '2026-02-19T09:59:05.000Z']
  );

  await db.query(
    `
      INSERT INTO memory_docs (path, kind, updated_at, summary, source_snapshot_id, redacted)
      VALUES ($1, $2, $3, $4, NULL, $5)
    `,
    ['/Users/apollo/.openclaw/workspace/AGENTS.md', 'core', '2026-02-19T09:58:00.000Z', 'Agent system prompt and behavior', false]
  );

  await db.query(
    `
      INSERT INTO health_samples (sample_id, idempotency_key, ts, openclaw_status, host_stats_json, errors_json, stale, source_snapshot_id)
      VALUES ($1, $2, $3, $4, NULL, $5::jsonb, $6, NULL)
    `,
    ['health-1', 'health::1', '2026-02-19T10:00:02.000Z', 'ok', '[]', false]
  );

  return context;
};

test('app server serves read-only API routes', async (t) => {
  const errors: unknown[] = [];

  const log: Logger = {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: (_message, context) => {
      errors.push(context);
    }
  };

  const { db, close } = await makeDatabase();
  t.after(async () => {
    await close();
  });

  const server = createAppServer(log, db, null);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => {
    server.close();
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to bind test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true, status: 'ok' });

  const contractsResponse = await fetch(`${baseUrl}/api/contracts`);
  assert.equal(contractsResponse.status, 200);
  const contractsBody = await contractsResponse.json();
  assert.equal(contractsBody.ok, true);
  assert.equal(contractsBody.readOnly, true);
  assert.equal(typeof contractsBody.endpoints.overview, 'string');

  const overviewResponse = await fetch(`${baseUrl}/api/overview`);
  assert.equal(overviewResponse.status, 200);
  const overviewBody = await overviewResponse.json();
  assert.equal(overviewBody.summary.activeSessions, 1);
  assert.equal(overviewBody.summary.latestStatus, 'ok');

  const agentsResponse = await fetch(`${baseUrl}/api/agents`);
  assert.equal(agentsResponse.status, 200);
  const agentsBody = await agentsResponse.json();
  assert.equal(agentsBody.agents.length >= 1, true);
  assert.equal(agentsBody.sessions.length, 1);
  assert.equal(agentsBody.sessions[0].sessionKey, 'session-1');

  const memoryResponse = await fetch(`${baseUrl}/api/memory`);
  assert.equal(memoryResponse.status, 200);
  const memoryBody = await memoryResponse.json();
  assert.equal(memoryBody.docs.length, 1);
  assert.equal(memoryBody.docs[0].redacted, false);

  const cronResponse = await fetch(`${baseUrl}/api/cron`);
  assert.equal(cronResponse.status, 200);
  const cronBody = await cronResponse.json();
  assert.equal(cronBody.jobs.length, 1);
  assert.equal(cronBody.runs[0].status, 'success');

  const statusResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(statusResponse.status, 200);
  const statusBody = await statusResponse.json();
  assert.equal(statusBody.latest.openclawStatus, 'ok');

  const missingResponse = await fetch(`${baseUrl}/missing`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), {
    ok: false,
    error: 'Route not found: GET /missing'
  });

  assert.equal(errors.length, 1);
});

test('app server enforces token auth when configured', async (t) => {
  const log: Logger = {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {}
  };

  const { db, close } = await makeDatabase();
  t.after(async () => {
    await close();
  });

  const server = createAppServer(log, db, 'secret-token');
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => {
    server.close();
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to bind test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const unauthorized = await fetch(`${baseUrl}/api/overview`);
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${baseUrl}/api/overview`, {
    headers: {
      Authorization: 'Bearer secret-token'
    }
  });
  assert.equal(authorized.status, 200);
});
