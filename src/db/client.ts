import { Pool } from 'pg';

export const openDatabase = (databaseUrl: string): Pool => {
  return new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
};
