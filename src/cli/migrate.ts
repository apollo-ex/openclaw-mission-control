import path from 'node:path';
import { openDatabase } from '../db/client.js';
import { applyMigrations } from '../db/migrations.js';
import { loadConfig } from '../lib/config.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);

try {
  const result = applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
  console.log(JSON.stringify(result, null, 2));
} finally {
  db.close();
}
