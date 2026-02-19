import type { DbExecutor } from '../db/types.js';
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

const readLatestStatus = async (db: DbExecutor): Promise<OpenclawStatus> => {
  const result = await db.query<{ openclaw_status: OpenclawStatus }>('SELECT openclaw_status FROM health_samples ORDER BY ts DESC LIMIT 1');
  return result.rows[0]?.openclaw_status ?? 'unknown';
};

export const readOverview = async (db: DbExecutor): Promise<OverviewDto> => {
  const readCount = async (table: 'agents' | 'sessions' | 'memory_docs' | 'cron_jobs' | 'cron_runs'): Promise<number> => {
    const result = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
    return Number(result.rows[0]?.count ?? 0);
  };

  const activeSessionsResult = await db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM sessions WHERE status = 'active'");
  const collectorErrorsResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM collector_state WHERE error_count > 0');
  const staleCollectorsResult = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM collector_state WHERE stale = TRUE');

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    summary: {
      agents: await readCount('agents'),
      sessions: await readCount('sessions'),
      activeSessions: Number(activeSessionsResult.rows[0]?.count ?? 0),
      memoryDocs: await readCount('memory_docs'),
      cronJobs: await readCount('cron_jobs'),
      cronRuns: await readCount('cron_runs'),
      collectorErrors: Number(collectorErrorsResult.rows[0]?.count ?? 0),
      staleCollectors: Number(staleCollectorsResult.rows[0]?.count ?? 0),
      latestStatus: await readLatestStatus(db)
    }
  };
};

const readCollectors = async (db: DbExecutor): Promise<CollectorStateDto[]> => {
  const result = await db.query<{
    collector_name: string;
    last_success_at: string | null;
    last_error_at: string | null;
    error_count: number;
    stale: boolean;
    last_error: string | null;
  }>(`
      SELECT collector_name, last_success_at, last_error_at, error_count, stale, last_error
      FROM collector_state
      ORDER BY collector_name ASC
    `);

  return result.rows.map((row) => ({
    collectorName: row.collector_name,
    lastSuccessAt: row.last_success_at,
    lastErrorAt: row.last_error_at,
    errorCount: row.error_count,
    stale: row.stale,
    lastError: row.last_error
  }));
};

export const readAgents = async (db: DbExecutor): Promise<AgentsDto> => {
  const agentsResult = await db.query<{
    agent_id: string;
    role: string | null;
    configured: boolean;
    updated_at: string;
  }>(`
      SELECT agent_id, role, configured, updated_at
      FROM agents
      ORDER BY updated_at DESC, agent_id ASC
    `);

  const sessionsResult = await db.query<{
    session_key: string;
    label: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    runtime_ms: number | null;
    model: string | null;
    agent_id: string | null;
    updated_at: string;
  }>(`
      SELECT session_key, label, status, started_at, ended_at, runtime_ms, model, agent_id, updated_at
      FROM sessions
      ORDER BY COALESCE(runtime_ms, 0) DESC, updated_at DESC, session_key ASC
      LIMIT 100
    `);

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    agents: agentsResult.rows.map<AgentDto>((row) => ({
      agentId: row.agent_id,
      role: row.role,
      configured: row.configured,
      updatedAt: row.updated_at
    })),
    sessions: sessionsResult.rows.map<SessionDto>((row) => ({
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

export const readMemory = async (db: DbExecutor): Promise<MemoryDto> => {
  const result = await db.query<{
    path: string;
    kind: string;
    updated_at: string;
    summary: string;
    redacted: boolean;
  }>(`
      SELECT path, kind, updated_at, summary, redacted
      FROM memory_docs
      ORDER BY updated_at DESC, path ASC
      LIMIT 200
    `);

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    redactedDocs: result.rows.filter((doc) => doc.redacted).length,
    docs: result.rows.map<MemoryDocDto>((row) => ({
      path: row.path,
      kind: row.kind,
      updatedAt: row.updated_at,
      summary: row.summary,
      redacted: row.redacted
    }))
  };
};

export const readCron = async (db: DbExecutor): Promise<CronDto> => {
  const jobsResult = await db.query<{
    job_id: string;
    name: string;
    schedule_kind: string;
    enabled: boolean;
    next_run_at: string | null;
    updated_at: string;
  }>(`
      SELECT job_id, name, schedule_kind, enabled, next_run_at, updated_at
      FROM cron_jobs
      ORDER BY name ASC
    `);

  const runsResult = await db.query<{
    run_id: string;
    job_id: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    summary: string;
    updated_at: string;
  }>(`
      SELECT run_id, job_id, status, started_at, ended_at, summary, updated_at
      FROM cron_runs
      ORDER BY COALESCE(started_at, updated_at) DESC, run_id ASC
      LIMIT 200
    `);

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    jobs: jobsResult.rows.map<CronJobDto>((row) => ({
      jobId: row.job_id,
      name: row.name,
      scheduleKind: row.schedule_kind,
      enabled: row.enabled,
      nextRunAt: row.next_run_at,
      updatedAt: row.updated_at
    })),
    runs: runsResult.rows.map<CronRunDto>((row) => ({
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

export const readHealth = async (db: DbExecutor): Promise<HealthDto> => {
  const latestResult = await db.query<{
    ts: string;
    openclaw_status: OpenclawStatus;
    stale: boolean;
    errors_json: string[] | null;
  }>(`
      SELECT ts, openclaw_status, stale, errors_json
      FROM health_samples
      ORDER BY ts DESC
      LIMIT 1
    `);

  const latest = latestResult.rows[0];

  const latestDto: HealthSampleDto | null = latest
    ? {
        ts: latest.ts,
        openclawStatus: latest.openclaw_status,
        stale: latest.stale,
        errors: Array.isArray(latest.errors_json) ? latest.errors_json : []
      }
    : null;

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    latest: latestDto,
    collectors: await readCollectors(db)
  };
};
