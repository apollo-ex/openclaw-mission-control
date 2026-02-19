import path from 'node:path';
import { openDatabase } from '../db/client.js';
import { applyMigrations } from '../db/migrations.js';
import { seedDatabase } from '../db/seed.js';
import { loadConfig } from '../lib/config.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);

try {
  applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
  seedDatabase(db);
  console.log('seeded');
} finally {
  db.close();
}
