import { Pool, type PoolConfig } from 'pg';

const isNeonConnection = (databaseUrl: string): boolean => {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname.endsWith('.neon.tech') || parsed.searchParams.get('sslmode') === 'require';
  } catch {
    return false;
  }
};

export const openDatabase = (databaseUrl: string): Pool => {
  const config: PoolConfig = {
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  };

  if (isNeonConnection(databaseUrl)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new Pool(config);
};
