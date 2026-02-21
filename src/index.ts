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
  const db = openDatabase(config.databaseUrl);
  const migrationDb = config.databaseUrlDirect === config.databaseUrl ? db : openDatabase(config.databaseUrlDirect);

  try {
    const migrationResult = await applyMigrations(migrationDb, path.resolve(process.cwd(), 'migrations'));
    logger.info('migrations_complete', migrationResult);

    await seedDatabase(migrationDb);
    logger.info('seed_complete');
  } finally {
    if (migrationDb !== db) {
      await migrationDb.end();
    }
  }

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

  const server = createAppServer(logger, db, config.apiToken);
  server.listen(config.port, config.host, () => {
    logger.info('mission_control_started', {
      host: config.host,
      port: config.port,
      databaseUrl: config.databaseUrl.replace(/:[^:@]+@/, ':***@'),
      databaseUrlDirect: config.databaseUrlDirect.replace(/:[^:@]+@/, ':***@')
    });
  });

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('mission_control_shutdown');
    scheduler.stop();

    server.close(async () => {
      await db.end();
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
