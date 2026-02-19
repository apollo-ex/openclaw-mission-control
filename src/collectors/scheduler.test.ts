import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../db/client.js';
import { applyMigrations } from '../db/migrations.js';
import { CadenceProfile } from './cadence.js';
import { CollectorScheduler } from './scheduler.js';
import type { Logger } from '../lib/logger.js';

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const silentLogger = (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
});

test('CollectorScheduler marks stale on permanent failure', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-scheduler-'));
  const dbPath = path.join(tmpRoot, 'test.sqlite');
  const db = openDatabase(dbPath);

  try {
    applyMigrations(db, path.resolve(process.cwd(), 'migrations'));

    const scheduler = new CollectorScheduler(
      { db, logger: silentLogger() },
      [
        {
          name: 'always_fails',
          cadence: CadenceProfile.hot(1_000),
          run: async () => {
            throw new Error('expected');
          }
        }
      ],
      {
        maxRetries: 1,
        backoffBaseMs: 5,
        backoffMaxMs: 10
      },
      silentLogger()
    );

    scheduler.start();
    await wait(80);
    scheduler.stop();
    await wait(25);

    const state = db
      .prepare('SELECT stale, error_count as errorCount FROM collector_state WHERE collector_name = ?')
      .get('always_fails') as { stale: number; errorCount: number };

    assert.equal(state.stale, 1);
    assert.equal(state.errorCount >= 1, true);
  } finally {
    db.close();
  }
});

test('CollectorScheduler marks success and ignores overlapping executions', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-scheduler-success-'));
  const dbPath = path.join(tmpRoot, 'test.sqlite');
  const db = openDatabase(dbPath);

  let active = 0;
  let overlapAttempted = false;
  let runs = 0;

  try {
    applyMigrations(db, path.resolve(process.cwd(), 'migrations'));

    const scheduler = new CollectorScheduler(
      { db, logger: silentLogger() },
      [
        {
          name: 'eventually_succeeds',
          cadence: CadenceProfile.hot(20),
          run: async () => {
            runs += 1;
            if (active > 0) {
              overlapAttempted = true;
            }
            active += 1;
            await wait(45);
            active -= 1;
          }
        }
      ],
      {
        maxRetries: 0,
        backoffBaseMs: 1,
        backoffMaxMs: 1
      },
      silentLogger()
    );

    scheduler.start();
    await wait(130);
    scheduler.stop();
    await wait(60);

    const state = db
      .prepare('SELECT stale, error_count as errorCount, last_success_at as lastSuccessAt FROM collector_state WHERE collector_name = ?')
      .get('eventually_succeeds') as { stale: number; errorCount: number; lastSuccessAt: string | null };

    assert.equal(runs >= 2, true);
    assert.equal(overlapAttempted, false);
    assert.equal(state.stale, 0);
    assert.equal(state.errorCount, 0);
    assert.equal(Boolean(state.lastSuccessAt), true);
  } finally {
    db.close();
  }
});
