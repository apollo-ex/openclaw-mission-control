import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { createTestDatabase } from './test-utils.js';
import { applyMigrations } from './migrations.js';
import { seedDatabase } from './seed.js';
import { appendEvent, upsertSessions, upsertSourceSnapshot } from './upserts.js';

test('migrations apply and re-run safely', async () => {
  const { db, close } = await createTestDatabase();

  try {
    const second = await applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
    assert.equal(second.applied.length, 0);
    assert.equal(second.skipped.length >= 1, true);
  } finally {
    await close();
  }
});

test('migration checksum mismatch is detected', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-migration-mismatch-'));
  const migrationsDir = path.join(tmpRoot, 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });

  const migrationPath = path.join(migrationsDir, '001_test.sql');
  await fs.writeFile(migrationPath, 'CREATE TABLE test_table (id TEXT PRIMARY KEY);\n');

  const { db, close } = await createTestDatabase();

  try {
    await applyMigrations(db, migrationsDir);

    await fs.writeFile(migrationPath, 'CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT);\n');

    await assert.rejects(() => applyMigrations(db, migrationsDir), /Migration checksum mismatch/);
  } finally {
    await close();
  }
});

test('session upsert is idempotent on primary key', async () => {
  const { db, close } = await createTestDatabase();

  try {
    const snapshotId = await upsertSourceSnapshot(db, {
      sourceType: 'sessions',
      capturedAt: new Date().toISOString(),
      payloadHash: 'hash',
      metadata: {
        sourceType: 'sessions',
        capturedAt: new Date().toISOString(),
        freshnessMs: 0,
        readOnly: true,
        transport: 'command',
        sourceRef: 'test'
      }
    });

    await upsertSessions(
      db,
      [
        {
          sessionKey: 's-1',
          label: 'one',
          status: 'active',
          startedAt: null,
          endedAt: null,
          runtimeMs: null,
          model: null,
          agentId: null
        }
      ],
      snapshotId
    );

    await upsertSessions(
      db,
      [
        {
          sessionKey: 's-1',
          label: 'one-updated',
          status: 'recent',
          startedAt: null,
          endedAt: null,
          runtimeMs: 10,
          model: 'gpt',
          agentId: 'a'
        }
      ],
      snapshotId
    );

    const rowResult = await db.query<{ sessionkey: string; label: string; status: string }>(
      'SELECT session_key AS sessionKey, label, status FROM sessions WHERE session_key = $1',
      ['s-1']
    );

    const row = rowResult.rows[0];
    assert.equal(row?.sessionkey, 's-1');
    assert.equal(row?.label, 'one-updated');
    assert.equal(row?.status, 'recent');

    const countResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM sessions');
    assert.equal(Number(countResult.rows[0]?.count ?? 0), 1);
  } finally {
    await close();
  }
});

test('seedDatabase is safe to re-run', async () => {
  const { db, close } = await createTestDatabase();

  try {
    await seedDatabase(db);
    await seedDatabase(db);

    const agentsResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM agents');
    const collectorResult = await db.query<{ collector_name: string }>(
      'SELECT collector_name FROM collector_state WHERE collector_name = $1',
      ['sessions_hot']
    );

    assert.equal(Number(agentsResult.rows[0]?.count ?? 0), 1);
    assert.equal(collectorResult.rows[0]?.collector_name, 'sessions_hot');
  } finally {
    await close();
  }
});

test('appendEvent deduplicates by idempotency key', async () => {
  const { db, close } = await createTestDatabase();

  try {
    const payload = {
      ts: '2026-01-01T00:00:00.000Z',
      category: 'status',
      severity: 'warning',
      title: 'same-title',
      details: 'same-details',
      sourceRef: 'openclaw gateway status'
    };

    await appendEvent(db, payload);
    await appendEvent(db, payload);

    const countResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM events');
    assert.equal(Number(countResult.rows[0]?.count ?? 0), 1);
  } finally {
    await close();
  }
});
