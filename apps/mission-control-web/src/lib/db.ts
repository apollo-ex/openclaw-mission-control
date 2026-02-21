import { Pool, type PoolConfig } from 'pg';
import type { QueryExecutor } from './read-model';

interface MissionControlWebEnv {
  DATABASE_URL?: string;
  MISSION_CONTROL_API_BASE_URL?: string;
}

interface MissionControlGlobal {
  __missionControlWebPool?: Pool;
  __missionControlWebPoolUrl?: string;
  __missionControlWebWarnedBridgeEnv?: boolean;
}

const globalScope = globalThis as typeof globalThis & MissionControlGlobal;

const isNeonConnection = (databaseUrl: string): boolean => {
  try {
    const parsed = new URL(databaseUrl);
    return parsed.hostname.endsWith('.neon.tech') || parsed.searchParams.get('sslmode') === 'require';
  } catch {
    return false;
  }
};

export const resolveDatabaseUrl = (env: MissionControlWebEnv = process.env as MissionControlWebEnv): string => {
  const raw = env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error('DATABASE_URL is required for mission-control-web server-side Neon reads.');
  }
  return raw;
};

export const warnIfLegacyBridgeEnvConfigured = (env: MissionControlWebEnv = process.env as MissionControlWebEnv): void => {
  const legacyBaseUrl = env.MISSION_CONTROL_API_BASE_URL?.trim();
  if (!legacyBaseUrl || globalScope.__missionControlWebWarnedBridgeEnv) {
    return;
  }

  globalScope.__missionControlWebWarnedBridgeEnv = true;
  // eslint-disable-next-line no-console
  console.warn('[mission-control-web] MISSION_CONTROL_API_BASE_URL is deprecated for core pages; using Neon DATABASE_URL reads instead.');
};

export const getQueryExecutor = (env: MissionControlWebEnv = process.env as MissionControlWebEnv): QueryExecutor => {
  const databaseUrl = resolveDatabaseUrl(env);

  if (!globalScope.__missionControlWebPool || globalScope.__missionControlWebPoolUrl !== databaseUrl) {
    const config: PoolConfig = {
      connectionString: databaseUrl,
      max: 6,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    };

    if (isNeonConnection(databaseUrl)) {
      config.ssl = { rejectUnauthorized: false };
    }

    globalScope.__missionControlWebPool = new Pool(config);
    globalScope.__missionControlWebPoolUrl = databaseUrl;
  }

  return globalScope.__missionControlWebPool;
};
