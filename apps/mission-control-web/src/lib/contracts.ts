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
  sessionId: string | null;
  label: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  runtimeMs: number | null;
  elapsedMs: number | null;
  model: string | null;
  agentId: string | null;
  sessionKind: string | null;
  runType: 'main' | 'subagent' | 'cron' | 'agent' | 'unknown';
  lastUpdateAt: string | null;
  updatedAt: string;
}

export interface AgentsResponse extends ApiEnvelope {
  activeSessions: number;
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

export interface StreamMessageRecord {
  sessionKey: string | null;
  role: string;
  messageTs: string;
  textPreview: string | null;
  model: string | null;
}

export interface ToolSpanRecord {
  sessionKey: string | null;
  toolCallId: string;
  toolName: string | null;
  isError: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface StreamResponse extends ApiEnvelope {
  eventsPerMinute: number;
  messages: StreamMessageRecord[];
  tools: ToolSpanRecord[];
}
