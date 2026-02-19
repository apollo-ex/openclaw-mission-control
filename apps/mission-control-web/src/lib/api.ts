import type { AgentsResponse, CronResponse, HealthResponse, MemoryResponse, OverviewResponse } from './contracts';

const FALLBACK_BASE_URL = 'http://127.0.0.1:4242';

export const resolveApiBaseUrl = (
  env: { MISSION_CONTROL_API_BASE_URL?: string } = process.env as { MISSION_CONTROL_API_BASE_URL?: string }
): string => {
  const raw = env.MISSION_CONTROL_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : FALLBACK_BASE_URL;
};

const fetchJson = async <T>(path: string): Promise<T> => {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Mission Control API request failed: ${response.status} ${path}`);
  }

  return (await response.json()) as T;
};

export const getOverview = (): Promise<OverviewResponse> => fetchJson<OverviewResponse>('/api/overview');

export const getAgents = (): Promise<AgentsResponse> => fetchJson<AgentsResponse>('/api/agents');

export const getMemory = (): Promise<MemoryResponse> => fetchJson<MemoryResponse>('/api/memory');

export const getCron = (): Promise<CronResponse> => fetchJson<CronResponse>('/api/cron');

export const getHealth = (): Promise<HealthResponse> => fetchJson<HealthResponse>('/api/health');
