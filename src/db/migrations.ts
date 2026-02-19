import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { sha256 } from '../lib/hash.js';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export const applyMigrations = (db: DatabaseSync, migrationsDir: string): MigrationResult => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const applied: string[] = [];
  const skipped: string[] = [];

  const selectStmt = db.prepare('SELECT checksum FROM _migrations WHERE name = ?');
  const insertStmt = db.prepare('INSERT INTO _migrations (name, checksum) VALUES (?, ?)');

  for (const fileName of files) {
    const absolutePath = path.join(migrationsDir, fileName);
    const sql = fs.readFileSync(absolutePath, 'utf8');
    const checksum = sha256(sql);
    const existing = selectStmt.get(fileName) as { checksum: string } | undefined;

    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(`Migration checksum mismatch for ${fileName}`);
      }
      skipped.push(fileName);
      continue;
    }

    db.exec('BEGIN');
    try {
      db.exec(sql);
      insertStmt.run(fileName, checksum);
      db.exec('COMMIT');
      applied.push(fileName);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return { applied, skipped };
};
