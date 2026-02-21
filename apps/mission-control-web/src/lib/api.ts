import type { AgentsResponse, CronResponse, HealthResponse, MemoryResponse, OverviewResponse } from './contracts';
import { getQueryExecutor, warnIfLegacyBridgeEnvConfigured } from './db';
import { readAgents, readCron, readHealth, readMemory, readOverview, type QueryExecutor } from './read-model';

const fallbackEnvelope = () => ({
  ok: true as const,
  apiVersion: '2026-02-20.v2',
  generatedAt: new Date().toISOString(),
  readOnly: true as const
});

const withFallback = async <T>(loader: () => Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await loader();
  } catch {
    return fallback();
  }
};

export const createMissionControlApi = (db: QueryExecutor) => ({
  getOverview: (): Promise<OverviewResponse> =>
    withFallback(
      () => readOverview(db),
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
    ),

  getAgents: (): Promise<AgentsResponse> =>
    withFallback(
      () => readAgents(db),
      () => ({ ...fallbackEnvelope(), activeSessions: 0, agents: [], sessions: [] })
    ),

  getMemory: (): Promise<MemoryResponse> =>
    withFallback(
      () => readMemory(db),
      () => ({ ...fallbackEnvelope(), redactedDocs: 0, docs: [] })
    ),

  getCron: (): Promise<CronResponse> =>
    withFallback(
      () => readCron(db),
      () => ({ ...fallbackEnvelope(), jobs: [], runs: [] })
    ),

  getHealth: (): Promise<HealthResponse> =>
    withFallback(
      () => readHealth(db),
      () => ({ ...fallbackEnvelope(), latest: null, collectors: [] })
    )
});

const defaultApi = () => {
  warnIfLegacyBridgeEnvConfigured();
  return createMissionControlApi(getQueryExecutor());
};

export const getOverview = (): Promise<OverviewResponse> => defaultApi().getOverview();
export const getAgents = (): Promise<AgentsResponse> => defaultApi().getAgents();
export const getMemory = (): Promise<MemoryResponse> => defaultApi().getMemory();
export const getCron = (): Promise<CronResponse> => defaultApi().getCron();
export const getHealth = (): Promise<HealthResponse> => defaultApi().getHealth();
