export interface ApiEnvelope {
  ok: true;
  apiVersion: string;
  generatedAt: string;
  readOnly: true;
}

export interface OverviewResponse extends ApiEnvelope {
  summary: {
    agents: number;
    sessions: number;
    activeSessions: number;
    memoryDocs: number;
    cronJobs: number;
    cronRuns: number;
    collectorErrors: number;
    staleCollectors: number;
    latestStatus: 'ok' | 'degraded' | 'offline' | 'unknown';
  };
}

export interface AgentRecord {
  agentId: string;
  role: string | null;
  configured: boolean;
  updatedAt: string;
}

export interface SessionRecord {
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

export interface AgentsResponse extends ApiEnvelope {
  agents: AgentRecord[];
  sessions: SessionRecord[];
}

export interface MemoryDocRecord {
  path: string;
  kind: string;
  updatedAt: string;
  summary: string;
  redacted: boolean;
}

export interface MemoryResponse extends ApiEnvelope {
  redactedDocs: number;
  docs: MemoryDocRecord[];
}

export interface CronJobRecord {
  jobId: string;
  name: string;
  scheduleKind: string;
  enabled: boolean;
  nextRunAt: string | null;
  updatedAt: string;
  detailsMarkdown: string;
}

export interface CronRunRecord {
  runId: string;
  jobId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  summary: string;
  updatedAt: string;
}

export interface CronResponse extends ApiEnvelope {
  jobs: CronJobRecord[];
  runs: CronRunRecord[];
}

export interface CollectorStateRecord {
  collectorName: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  errorCount: number;
  stale: boolean;
  lastError: string | null;
}

export interface HealthSample {
  ts: string;
  openclawStatus: 'ok' | 'degraded' | 'offline' | 'unknown';
  stale: boolean;
  errors: string[];
}

export interface HealthResponse extends ApiEnvelope {
  latest: HealthSample | null;
  collectors: CollectorStateRecord[];
}
