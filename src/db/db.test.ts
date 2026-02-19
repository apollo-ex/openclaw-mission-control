import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from './client.js';
import { applyMigrations } from './migrations.js';
import { seedDatabase } from './seed.js';
import { appendEvent, upsertSessions, upsertSourceSnapshot } from './upserts.js';

const createTestDb = async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-db-'));
  const dbPath = path.join(tmpRoot, 'test.sqlite');
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const db = openDatabase(dbPath);
  applyMigrations(db, migrationsDir);
  return { db, tmpRoot, dbPath, migrationsDir };
};

test('migrations apply and re-run safely', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-db-'));
  const dbPath = path.join(tmpRoot, 'test.sqlite');
  const migrationsDir = path.resolve(process.cwd(), 'migrations');

  const db = openDatabase(dbPath);
  try {
    const first = applyMigrations(db, migrationsDir);
    const second = applyMigrations(db, migrationsDir);

    assert.equal(first.applied.length >= 1, true);
    assert.equal(second.applied.length, 0);
  } finally {
    db.close();
  }
});

test('migration checksum mismatch is detected', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-migration-mismatch-'));
  const migrationsDir = path.join(tmpRoot, 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });

  const migrationPath = path.join(migrationsDir, '001_test.sql');
  await fs.writeFile(migrationPath, 'CREATE TABLE test_table (id TEXT PRIMARY KEY);\n');

  const dbPath = path.join(tmpRoot, 'test.sqlite');
  const db = openDatabase(dbPath);

  try {
    applyMigrations(db, migrationsDir);

    await fs.writeFile(migrationPath, 'CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT);\n');

    assert.throws(() => applyMigrations(db, migrationsDir), /Migration checksum mismatch/);
  } finally {
    db.close();
  }
});

test('session upsert is idempotent on primary key', async () => {
  const { db } = await createTestDb();

  try {
    const snapshotId = upsertSourceSnapshot(db, {
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

    upsertSessions(
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

    upsertSessions(
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

    const row = db
      .prepare('SELECT session_key as sessionKey, label, status FROM sessions WHERE session_key = ?')
      .get('s-1') as { sessionKey: string; label: string; status: string };

    assert.equal(row.sessionKey, 's-1');
    assert.equal(row.label, 'one-updated');
    assert.equal(row.status, 'recent');

    const count = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    assert.equal(count.count, 1);
  } finally {
    db.close();
  }
});

test('seedDatabase is safe to re-run', async () => {
  const { db } = await createTestDb();

  try {
    seedDatabase(db);
    seedDatabase(db);

    const agents = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    const collector = db
      .prepare('SELECT collector_name as collectorName FROM collector_state WHERE collector_name = ?')
      .get('sessions_hot') as { collectorName: string };

    assert.equal(agents.count, 1);
    assert.equal(collector.collectorName, 'sessions_hot');
  } finally {
    db.close();
  }
});

test('appendEvent deduplicates by idempotency key', async () => {
  const { db } = await createTestDb();

  try {
    const payload = {
      ts: '2026-01-01T00:00:00.000Z',
      category: 'status',
      severity: 'warning',
      title: 'same-title',
      details: 'same-details',
      sourceRef: 'openclaw gateway status'
    };

    appendEvent(db, payload);
    appendEvent(db, payload);

    const count = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    assert.equal(count.count, 1);
  } finally {
    db.close();
  }
});
