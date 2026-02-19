import type { DbExecutor } from '../db/types.js';
import type { Logger } from '../lib/logger.js';
import type { CadenceProfile } from './cadence.js';

export interface CollectorContext {
  db: DbExecutor;
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
