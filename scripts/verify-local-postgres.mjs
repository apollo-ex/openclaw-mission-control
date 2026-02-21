import pg from 'pg';

const { Client } = pg;

const defaultUrl = 'postgresql://openclaw_test_user@localhost:5432/openclaw_test_db';
const connectionString = process.env.DATABASE_URL ?? defaultUrl;

const client = new Client({ connectionString });

try {
  await client.connect();
  const result = await client.query(
    'select current_user as user, current_database() as db, now() as server_time, version() as version'
  );
  console.log('✅ Postgres/Neon connection OK');
  console.table(result.rows);
} catch (error) {
  console.error('❌ Postgres/Neon connection failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
