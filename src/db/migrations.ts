import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';
import { sha256 } from '../lib/hash.js';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export const applyMigrations = async (db: Pool, migrationsDir: string): Promise<MigrationResult> => {
  const client = await db.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const fileName of files) {
      const absolutePath = path.join(migrationsDir, fileName);
      const sql = fs.readFileSync(absolutePath, 'utf8');
      const checksum = sha256(sql);
      const existing = await client.query<{ checksum: string }>('SELECT checksum FROM _migrations WHERE name = $1', [fileName]);

      if (existing.rowCount && existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${fileName}`);
        }
        skipped.push(fileName);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name, checksum) VALUES ($1, $2)', [fileName, checksum]);
        await client.query('COMMIT');
        applied.push(fileName);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    return { applied, skipped };
  } finally {
    client.release();
  }
};
