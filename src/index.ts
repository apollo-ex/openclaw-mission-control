import path from 'node:path';
import { buildCollectors } from './collectors/collectors.js';
import { CollectorScheduler } from './collectors/scheduler.js';
import { openDatabase } from './db/client.js';
import { applyMigrations } from './db/migrations.js';
import { seedDatabase } from './db/seed.js';
import { createAppServer } from './app.js';
import { loadConfig } from './lib/config.js';
import { logger } from './lib/logger.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const db = openDatabase(config.dbPath);

  const migrationResult = applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
  logger.info('migrations_complete', migrationResult);

  seedDatabase(db);
  logger.info('seed_complete');

  const scheduler = new CollectorScheduler(
    { db, logger },
    buildCollectors(config),
    {
      maxRetries: config.collectorMaxRetries,
      backoffBaseMs: config.collectorBackoffBaseMs,
      backoffMaxMs: config.collectorBackoffMaxMs
    },
    logger
  );

  scheduler.start();

  const server = createAppServer(logger, db);
  server.listen(config.port, config.host, () => {
    logger.info('mission_control_started', {
      host: config.host,
      port: config.port,
      dbPath: config.dbPath
    });
  });

  const shutdown = (): void => {
    logger.info('mission_control_shutdown');
    scheduler.stop();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void main().catch((error) => {
  logger.error('startup_failed', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
