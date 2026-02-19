import type { AgentsResponse, CronResponse, HealthResponse, MemoryResponse, OverviewResponse } from './contracts';

const FALLBACK_BASE_URL = 'http://127.0.0.1:4242';

interface MissionControlEnv {
  MISSION_CONTROL_API_BASE_URL?: string;
  MISSION_CONTROL_API_TOKEN?: string;
}

const fallbackEnvelope = () => ({
  ok: true as const,
  apiVersion: 'v1',
  generatedAt: new Date().toISOString(),
  readOnly: true as const
});

export const resolveApiBaseUrl = (env: MissionControlEnv = process.env as MissionControlEnv): string => {
  const raw = env.MISSION_CONTROL_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : FALLBACK_BASE_URL;
};

export const resolveApiToken = (env: MissionControlEnv = process.env as MissionControlEnv): string | null => {
  const raw = env.MISSION_CONTROL_API_TOKEN?.trim();
  return raw ? raw : null;
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const baseUrl = resolveApiBaseUrl();
  const apiToken = resolveApiToken();

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Mission Control API request failed: ${response.status} ${path}`);
  }

  return (await response.json()) as T;
};

const withFallback = async <T>(loader: () => Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await loader();
  } catch {
    return fallback();
  }
};

export const getOverview = (): Promise<OverviewResponse> =>
  withFallback(
    () => fetchJson<OverviewResponse>('/api/overview'),
    () => ({
      ...fallbackEnvelope(),
      summary: {
        agents: 0,
        sessions: 0,
        activeSessions: 0,
        memoryDocs: 0,
        cronJobs: 0,
        cronRuns: 0,
        collectorErrors: 1,
        staleCollectors: 1,
        latestStatus: 'unknown'
      }
    })
  );

export const getAgents = (): Promise<AgentsResponse> =>
  withFallback(
    () => fetchJson<AgentsResponse>('/api/agents'),
    () => ({ ...fallbackEnvelope(), agents: [], sessions: [] })
  );

export const getMemory = (): Promise<MemoryResponse> =>
  withFallback(
    () => fetchJson<MemoryResponse>('/api/memory'),
    () => ({ ...fallbackEnvelope(), redactedDocs: 0, docs: [] })
  );

export const getCron = (): Promise<CronResponse> =>
  withFallback(
    () => fetchJson<CronResponse>('/api/cron'),
    () => ({ ...fallbackEnvelope(), jobs: [], runs: [] })
  );

export const getHealth = (): Promise<HealthResponse> =>
  withFallback(
    () => fetchJson<HealthResponse>('/api/health'),
    () => ({ ...fallbackEnvelope(), latest: null, collectors: [] })
  );
