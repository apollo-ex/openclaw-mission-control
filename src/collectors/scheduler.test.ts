import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDatabase } from '../db/test-utils.js';
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
  const { db, close } = await createTestDatabase();

  try {
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

    const result = await db.query<{ stale: boolean; error_count: number }>(
      'SELECT stale, error_count FROM collector_state WHERE collector_name = $1',
      ['always_fails']
    );

    const state = result.rows[0];
    assert.equal(state?.stale, true);
    assert.equal((state?.error_count ?? 0) >= 1, true);
  } finally {
    await close();
  }
});

test('CollectorScheduler marks success and ignores overlapping executions', async () => {
  const { db, close } = await createTestDatabase();

  let active = 0;
  let overlapAttempted = false;
  let runs = 0;

  try {
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

    const result = await db.query<{ stale: boolean; error_count: number; last_success_at: string | null }>(
      'SELECT stale, error_count, last_success_at FROM collector_state WHERE collector_name = $1',
      ['eventually_succeeds']
    );

    const state = result.rows[0];
    assert.equal(runs >= 2, true);
    assert.equal(overlapAttempted, false);
    assert.equal(state?.stale, false);
    assert.equal(state?.error_count, 0);
    assert.equal(Boolean(state?.last_success_at), true);
  } finally {
    await close();
  }
});
