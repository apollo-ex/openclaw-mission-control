import path from 'node:path';
import { openDatabase } from '../db/client.js';
import { applyMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { loadConfig } from '../lib/config.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const db = openDatabase(config.databaseUrl);

  try {
    await applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
    await seedDatabase(db);
    console.log('seeded');
  } finally {
    await db.end();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
