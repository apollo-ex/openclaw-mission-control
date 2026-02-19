import crypto from 'node:crypto';
import path from 'node:path';
import { Pool } from 'pg';
import { applyMigrations } from './migrations.js';

const DEFAULT_TEST_DATABASE_URL = 'postgresql://openclaw_test_user:openclaw_local_dev_pw_2026@localhost:5432/openclaw_test_db';

const buildSchemaName = (): string => `mc_test_${crypto.randomUUID().replace(/-/g, '')}`;

export interface TestDatabaseContext {
  db: Pool;
  close: () => Promise<void>;
  schema: string;
}

export const createTestDatabase = async (): Promise<TestDatabaseContext> => {
  const databaseUrl = process.env.MISSION_CONTROL_TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL;
  const schema = buildSchemaName();

  const adminPool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10_000
  });

  await adminPool.query(`CREATE SCHEMA "${schema}"`);

  const db = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10_000,
    options: `-c search_path=${schema},public`
  });

  try {
    await db.query('SELECT 1');
    await applyMigrations(db, path.resolve(process.cwd(), 'migrations'));
  } catch (error) {
    await db.end().catch(() => {});
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await adminPool.end().catch(() => {});
    throw error;
  }

  const close = async (): Promise<void> => {
    await db.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  };

  return { db, close, schema };
};
