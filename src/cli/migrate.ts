import path from 'node:path';
import { openDatabase } from '../db/client.js';
import { applyMigrations } from '../db/migrations.js';
import { loadConfig } from '../lib/config.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const db = openDatabase(config.databaseUrlDirect);

  try {
    const result = await applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.end();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
