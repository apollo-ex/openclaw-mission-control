import path from 'node:path';

export interface AppConfig {
  host: string;
  port: number;
  dbPath: string;
  workspaceRoot: string;
  hotIntervalMs: number;
  warmIntervalMs: number;
  collectorMaxRetries: number;
  collectorBackoffBaseMs: number;
  collectorBackoffMaxMs: number;
}

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

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const host = env.HOST?.trim() || '127.0.0.1';
  const port = toInt(env.PORT, 4242, 'PORT');

  return {
    host,
    port,
    dbPath: path.resolve(env.MISSION_CONTROL_DB_PATH?.trim() || './data/mission-control.sqlite'),
    workspaceRoot: path.resolve(env.OPENCLAW_WORKSPACE?.trim() || '/Users/apollo/.openclaw/workspace'),
    hotIntervalMs: toInt(env.HOT_INTERVAL_MS, 10_000, 'HOT_INTERVAL_MS'),
    warmIntervalMs: toInt(env.WARM_INTERVAL_MS, 120_000, 'WARM_INTERVAL_MS'),
    collectorMaxRetries: toInt(env.COLLECTOR_MAX_RETRIES, 3, 'COLLECTOR_MAX_RETRIES'),
    collectorBackoffBaseMs: toInt(env.COLLECTOR_BACKOFF_BASE_MS, 500, 'COLLECTOR_BACKOFF_BASE_MS'),
    collectorBackoffMaxMs: toInt(env.COLLECTOR_BACKOFF_MAX_MS, 10_000, 'COLLECTOR_BACKOFF_MAX_MS')
  };
};
