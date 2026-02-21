export type SourceType = 'memory' | 'sessions' | 'cron' | 'status';

export interface SourceMetadata {
  sourceType: SourceType;
  capturedAt: string;
  freshnessMs: number;
  readOnly: true;
  transport: 'filesystem' | 'command';
  sourceRef: string;
}

export interface CollectedSnapshot<T> {
  metadata: SourceMetadata;
  data: T;
  warnings: string[];
}

export interface ReadonlySourceAdapter<T> {
  readonly sourceType: SourceType;
  collect(): Promise<CollectedSnapshot<T>>;
}

export interface MemoryDocRecord {
  path: string;
  kind: 'core' | 'memory';
  updatedAt: string;
  content: string;
}

export type SessionRunType = 'main' | 'subagent' | 'cron' | 'agent' | 'unknown';

export interface SessionRecord {
  sessionKey: string;
  sessionId: string | null;
  label: string;
  status: 'active' | 'recent' | 'unknown';
  startedAt: string | null;
  endedAt: string | null;
  runtimeMs: number | null;
  model: string | null;
  agentId: string | null;
  sessionKind: string | null;
  runType: SessionRunType;
  lastUpdateAt: string | null;
}

export interface CronJobRecord {
  jobId: string;
  name: string;
  scheduleKind: string;
  enabled: boolean;
  nextRunAt: string | null;
  agentId?: string;
  sessionKey?: string;
  sessionTarget?: string;
  wakeMode?: string;
  schedule?: Record<string, unknown>;
  delivery?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  state?: Record<string, unknown>;
}

export interface CronRunRecord {
  runId: string;
  jobId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  summary: string;
}

export interface CronSnapshot {
  jobs: CronJobRecord[];
  runs: CronRunRecord[];
}

export interface StatusSnapshot {
  openclawStatus: 'ok' | 'degraded' | 'offline' | 'unknown';
  raw: string;
  errors: string[];
}
