import type { DatabaseSync } from 'node:sqlite';
import type { Logger } from '../lib/logger.js';
import type { CadenceProfile } from './cadence.js';

export interface CollectorContext {
  db: DatabaseSync;
  logger: Logger;
}

export interface CollectorTask {
  name: string;
  cadence: CadenceProfile;
  run: (ctx: CollectorContext) => Promise<void>;
}

export interface SchedulerConfig {
  maxRetries: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}
