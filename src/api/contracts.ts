export const API_VERSION = '2026-02-19.v1' as const;

export const API_ENDPOINTS = {
  contracts: '/api/contracts',
  overview: '/api/overview',
  agents: '/api/agents',
  memory: '/api/memory',
  cron: '/api/cron',
  health: '/api/health'
} as const;

export type OpenclawStatus = 'ok' | 'degraded' | 'offline' | 'unknown';

export interface ApiContractResponse {
  ok: true;
  apiVersion: typeof API_VERSION;
  readOnly: true;
  endpoints: typeof API_ENDPOINTS;
  notes: string[];
}

export interface CollectorStateDto {
  collectorName: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorCount: number;
  stale: boolean;
  lastError: string | null;
}

export interface OverviewDto {
  ok: true;
  apiVersion: typeof API_VERSION;
  generatedAt: string;
  readOnly: true;
  summary: {
    agents: number;
    sessions: number;
    activeSessions: number;
    memoryDocs: number;
    cronJobs: number;
    cronRuns: number;
    collectorErrors: number;
    staleCollectors: number;
    latestStatus: OpenclawStatus;
  };
}

export interface AgentDto {
  agentId: string;
  role: string | null;
  configured: boolean;
  updatedAt: string;
}

export interface SessionDto {
  sessionKey: string;
  label: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  runtimeMs: number | null;
  model: string | null;
  agentId: string | null;
  updatedAt: string;
}

export interface AgentsDto {
  ok: true;
  apiVersion: typeof API_VERSION;
  generatedAt: string;
  readOnly: true;
  agents: AgentDto[];
  sessions: SessionDto[];
}

export interface MemoryDocDto {
  path: string;
  kind: string;
  updatedAt: string;
  summary: string;
  redacted: boolean;
}

export interface MemoryDto {
  ok: true;
  apiVersion: typeof API_VERSION;
  generatedAt: string;
  readOnly: true;
  redactedDocs: number;
  docs: MemoryDocDto[];
}

export interface CronJobDto {
  jobId: string;
  name: string;
  scheduleKind: string;
  enabled: boolean;
  nextRunAt: string | null;
  updatedAt: string;
  detailsMarkdown: string;
}

export interface CronRunDto {
  runId: string;
  jobId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  summary: string;
  updatedAt: string;
}

export interface CronDto {
  ok: true;
  apiVersion: typeof API_VERSION;
  generatedAt: string;
  readOnly: true;
  jobs: CronJobDto[];
  runs: CronRunDto[];
}

export interface HealthSampleDto {
  ts: string;
  openclawStatus: OpenclawStatus;
  stale: boolean;
  errors: string[];
}

export interface HealthDto {
  ok: true;
  apiVersion: typeof API_VERSION;
  generatedAt: string;
  readOnly: true;
  latest: HealthSampleDto | null;
  collectors: CollectorStateDto[];
}
