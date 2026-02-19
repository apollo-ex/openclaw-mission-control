import type { DatabaseSync } from 'node:sqlite';
import {
  API_ENDPOINTS,
  API_VERSION,
  type AgentDto,
  type AgentsDto,
  type ApiContractResponse,
  type CollectorStateDto,
  type CronDto,
  type CronJobDto,
  type CronRunDto,
  type HealthDto,
  type HealthSampleDto,
  type MemoryDocDto,
  type MemoryDto,
  type OpenclawStatus,
  type OverviewDto,
  type SessionDto
} from './contracts.js';

const nowIso = (): string => new Date().toISOString();

const toBoolean = (value: number): boolean => value === 1;

export const getContractResponse = (): ApiContractResponse => ({
  ok: true,
  apiVersion: API_VERSION,
  readOnly: true,
  endpoints: API_ENDPOINTS,
  notes: [
    'All API endpoints are GET-only and read from local mission-control cache tables.',
    'No OpenClaw mutating operations are performed by this service.'
  ]
});

const readLatestStatus = (db: DatabaseSync): OpenclawStatus => {
  const row = db
    .prepare('SELECT openclaw_status FROM health_samples ORDER BY ts DESC LIMIT 1')
    .get() as { openclaw_status: OpenclawStatus } | undefined;

  return row?.openclaw_status ?? 'unknown';
};

export const readOverview = (db: DatabaseSync): OverviewDto => {
  const readCount = (table: string): number => {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
    return row.count;
  };

  const activeSessions = (
    db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE status = 'active'").get() as { count: number }
  ).count;
  const collectorErrors = (
    db.prepare('SELECT COUNT(*) AS count FROM collector_state WHERE error_count > 0').get() as { count: number }
  ).count;
  const staleCollectors = (
    db.prepare('SELECT COUNT(*) AS count FROM collector_state WHERE stale = 1').get() as { count: number }
  ).count;

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    summary: {
      agents: readCount('agents'),
      sessions: readCount('sessions'),
      activeSessions,
      memoryDocs: readCount('memory_docs'),
      cronJobs: readCount('cron_jobs'),
      cronRuns: readCount('cron_runs'),
      collectorErrors,
      staleCollectors,
      latestStatus: readLatestStatus(db)
    }
  };
};

const readCollectors = (db: DatabaseSync): CollectorStateDto[] => {
  const rows = db
    .prepare(
      `
      SELECT collector_name, last_success_at, last_error_at, error_count, stale, last_error
      FROM collector_state
      ORDER BY collector_name ASC
      `
    )
    .all() as Array<{
    collector_name: string;
    last_success_at: string | null;
    last_error_at: string | null;
    error_count: number;
    stale: number;
    last_error: string | null;
  }>;

  return rows.map((row) => ({
    collectorName: row.collector_name,
    lastSuccessAt: row.last_success_at,
    lastErrorAt: row.last_error_at,
    errorCount: row.error_count,
    stale: toBoolean(row.stale),
    lastError: row.last_error
  }));
};

export const readAgents = (db: DatabaseSync): AgentsDto => {
  const agents = db
    .prepare(
      `
      SELECT agent_id, role, configured, updated_at
      FROM agents
      ORDER BY updated_at DESC, agent_id ASC
      `
    )
    .all() as Array<{
    agent_id: string;
    role: string | null;
    configured: number;
    updated_at: string;
  }>;

  const sessions = db
    .prepare(
      `
      SELECT session_key, label, status, started_at, ended_at, runtime_ms, model, agent_id, updated_at
      FROM sessions
      ORDER BY COALESCE(runtime_ms, 0) DESC, updated_at DESC, session_key ASC
      LIMIT 100
      `
    )
    .all() as Array<{
    session_key: string;
    label: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    runtime_ms: number | null;
    model: string | null;
    agent_id: string | null;
    updated_at: string;
  }>;

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    agents: agents.map<AgentDto>((row) => ({
      agentId: row.agent_id,
      role: row.role,
      configured: toBoolean(row.configured),
      updatedAt: row.updated_at
    })),
    sessions: sessions.map<SessionDto>((row) => ({
      sessionKey: row.session_key,
      label: row.label,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      runtimeMs: row.runtime_ms,
      model: row.model,
      agentId: row.agent_id,
      updatedAt: row.updated_at
    }))
  };
};

export const readMemory = (db: DatabaseSync): MemoryDto => {
  const docs = db
    .prepare(
      `
      SELECT path, kind, updated_at, summary, redacted
      FROM memory_docs
      ORDER BY updated_at DESC, path ASC
      LIMIT 200
      `
    )
    .all() as Array<{
    path: string;
    kind: string;
    updated_at: string;
    summary: string;
    redacted: number;
  }>;

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    redactedDocs: docs.filter((doc) => toBoolean(doc.redacted)).length,
    docs: docs.map<MemoryDocDto>((row) => ({
      path: row.path,
      kind: row.kind,
      updatedAt: row.updated_at,
      summary: row.summary,
      redacted: toBoolean(row.redacted)
    }))
  };
};

export const readCron = (db: DatabaseSync): CronDto => {
  const jobs = db
    .prepare(
      `
      SELECT job_id, name, schedule_kind, enabled, next_run_at, updated_at
      FROM cron_jobs
      ORDER BY name ASC
      `
    )
    .all() as Array<{
    job_id: string;
    name: string;
    schedule_kind: string;
    enabled: number;
    next_run_at: string | null;
    updated_at: string;
  }>;

  const runs = db
    .prepare(
      `
      SELECT run_id, job_id, status, started_at, ended_at, summary, updated_at
      FROM cron_runs
      ORDER BY COALESCE(started_at, updated_at) DESC, run_id ASC
      LIMIT 200
      `
    )
    .all() as Array<{
    run_id: string;
    job_id: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    summary: string;
    updated_at: string;
  }>;

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    jobs: jobs.map<CronJobDto>((row) => ({
      jobId: row.job_id,
      name: row.name,
      scheduleKind: row.schedule_kind,
      enabled: toBoolean(row.enabled),
      nextRunAt: row.next_run_at,
      updatedAt: row.updated_at
    })),
    runs: runs.map<CronRunDto>((row) => ({
      runId: row.run_id,
      jobId: row.job_id,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      summary: row.summary,
      updatedAt: row.updated_at
    }))
  };
};

export const readHealth = (db: DatabaseSync): HealthDto => {
  const latest = db
    .prepare(
      `
      SELECT ts, openclaw_status, stale, errors_json
      FROM health_samples
      ORDER BY ts DESC
      LIMIT 1
      `
    )
    .get() as
    | {
        ts: string;
        openclaw_status: OpenclawStatus;
        stale: number;
        errors_json: string | null;
      }
    | undefined;

  const latestDto: HealthSampleDto | null = latest
    ? {
        ts: latest.ts,
        openclawStatus: latest.openclaw_status,
        stale: toBoolean(latest.stale),
        errors: latest.errors_json ? (JSON.parse(latest.errors_json) as string[]) : []
      }
    : null;

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    latest: latestDto,
    collectors: readCollectors(db)
  };
};
