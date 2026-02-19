import { CronAdapter, MemoryAdapter, SessionsAdapter, StatusAdapter } from '../adapters/index.js';
import type { AppConfig } from '../lib/config.js';
import { CadenceProfile } from './cadence.js';
import { ingestCronSnapshot, ingestMemorySnapshot, ingestSessionsSnapshot, ingestStatusSnapshot } from './ingest.js';
import type { CollectorTask } from './types.js';

export const buildCollectors = (config: AppConfig): CollectorTask[] => {
  const sessionsAdapter = new SessionsAdapter();
  const cronAdapter = new CronAdapter();
  const statusAdapter = new StatusAdapter();
  const memoryAdapter = new MemoryAdapter(config.workspaceRoot);

  return [
    {
      name: 'sessions_hot',
      cadence: CadenceProfile.hot(config.hotIntervalMs),
      run: async ({ db }) => {
        const snapshot = await sessionsAdapter.collect();
        ingestSessionsSnapshot(db, snapshot);
      }
    },
    {
      name: 'cron_hot',
      cadence: CadenceProfile.hot(config.hotIntervalMs),
      run: async ({ db }) => {
        const snapshot = await cronAdapter.collect();
        ingestCronSnapshot(db, snapshot);
      }
    },
    {
      name: 'health_hot',
      cadence: CadenceProfile.hot(config.hotIntervalMs),
      run: async ({ db }) => {
        const snapshot = await statusAdapter.collect();
        ingestStatusSnapshot(db, snapshot);
      }
    },
    {
      name: 'memory_warm',
      cadence: CadenceProfile.warm(config.warmIntervalMs),
      run: async ({ db }) => {
        const snapshot = await memoryAdapter.collect();
        ingestMemorySnapshot(db, snapshot);
      }
    }
  ];
};
