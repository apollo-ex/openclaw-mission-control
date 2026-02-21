export interface AppConfig {
  host: string;
  port: number;
  databaseUrl: string;
  databaseUrlDirect: string;
  apiToken: string | null;
  workspaceRoot: string;
  hotIntervalMs: number;
  warmIntervalMs: number;
  collectorMaxRetries: number;
  collectorBackoffBaseMs: number;
  collectorBackoffMaxMs: number;
  sessionActiveWindowMs: number;
  sessionsListLimit: number;
}

const DEFAULT_DATABASE_URL = 'postgresql://openclaw_test_user@localhost:5432/openclaw_test_db';

const toInt = (value: string | undefined, fallback: number, label: string): number => {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return parsed;
};

const resolveRuntimeDatabaseUrl = (env: NodeJS.ProcessEnv): string => {
  const preferred = env.DATABASE_URL?.trim();
  if (preferred) {
    return preferred;
  }

  const direct = env.DATABASE_URL_DIRECT?.trim();
  if (direct) {
    return direct;
  }

  const target = (env.MISSION_CONTROL_ENV ?? env.NODE_ENV ?? '').trim().toLowerCase();
  if (target === 'production' || target === 'prod') {
    return env.DATABASE_URL_PROD?.trim() || DEFAULT_DATABASE_URL;
  }

  if (target === 'staging' || target === 'stage') {
    return env.DATABASE_URL_STAGING?.trim() || DEFAULT_DATABASE_URL;
  }

  if (target === 'development' || target === 'dev') {
    return env.DATABASE_URL_DEV?.trim() || DEFAULT_DATABASE_URL;
  }

  return env.DATABASE_URL_DEV?.trim() || DEFAULT_DATABASE_URL;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const host = env.HOST?.trim() || '127.0.0.1';
  const port = toInt(env.PORT, 4242, 'PORT');
  const databaseUrl = resolveRuntimeDatabaseUrl(env);

  return {
    host,
    port,
    databaseUrl,
    databaseUrlDirect: env.DATABASE_URL_DIRECT?.trim() || databaseUrl,
    apiToken: env.MISSION_CONTROL_API_TOKEN?.trim() || null,
    workspaceRoot: env.OPENCLAW_WORKSPACE?.trim() || '/Users/apollo/.openclaw/workspace',
    hotIntervalMs: toInt(env.HOT_INTERVAL_MS, 10_000, 'HOT_INTERVAL_MS'),
    warmIntervalMs: toInt(env.WARM_INTERVAL_MS, 120_000, 'WARM_INTERVAL_MS'),
    collectorMaxRetries: toInt(env.COLLECTOR_MAX_RETRIES, 3, 'COLLECTOR_MAX_RETRIES'),
    collectorBackoffBaseMs: toInt(env.COLLECTOR_BACKOFF_BASE_MS, 500, 'COLLECTOR_BACKOFF_BASE_MS'),
    collectorBackoffMaxMs: toInt(env.COLLECTOR_BACKOFF_MAX_MS, 10_000, 'COLLECTOR_BACKOFF_MAX_MS'),
    sessionActiveWindowMs: toInt(env.SESSION_ACTIVE_WINDOW_MS, 15 * 60 * 1000, 'SESSION_ACTIVE_WINDOW_MS'),
    sessionsListLimit: toInt(env.SESSIONS_LIST_LIMIT, 500, 'SESSIONS_LIST_LIMIT')
  };
};
