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
  type SessionDto,
  type StreamDto
} from './contracts.js';

const nowIso = (): string => new Date().toISOString();

export const getContractResponse = (): ApiContractResponse => ({
  ok: true,
  apiVersion: API_VERSION,
  readOnly: true,
  endpoints: API_ENDPOINTS,
  notes: [
    'All API endpoints are GET-only and read from mission-control cache tables in Postgres (Neon-first).',
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

const computeElapsedMs = (row: {
  status: string;
  started_at: string | null;
  runtime_ms: number | null;
}, nowMs: number): number | null => {
  if (row.status === 'active' && row.started_at) {
    const startedAtMs = Date.parse(row.started_at);
    if (Number.isFinite(startedAtMs)) {
      return Math.max(0, nowMs - startedAtMs);
    }
  }

  return row.runtime_ms;
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
    session_id: string | null;
    label: string;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    runtime_ms: number | null;
    model: string | null;
    agent_id: string | null;
    session_kind: string | null;
    run_type: 'main' | 'subagent' | 'cron' | 'agent' | 'unknown';
    last_update_at: string | null;
    updated_at: string;
  }>(`
      SELECT
        session_key,
        session_id,
        label,
        status,
        started_at,
        ended_at,
        runtime_ms,
        model,
        agent_id,
        session_kind,
        run_type,
        last_update_at,
        updated_at
      FROM sessions
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        COALESCE(last_update_at, updated_at) DESC,
        session_key ASC
      LIMIT 200
    `);

  const nowMs = Date.now();
  const sessions = sessionsResult.rows.map<SessionDto>((row) => ({
    sessionKey: row.session_key,
    sessionId: row.session_id,
    label: row.label,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    runtimeMs: row.runtime_ms,
    elapsedMs: computeElapsedMs(row, nowMs),
    model: row.model,
    agentId: row.agent_id,
    sessionKind: row.session_kind,
    runType: row.run_type,
    lastUpdateAt: row.last_update_at,
    updatedAt: row.updated_at
  }));

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    activeSessions: sessions.filter((session) => session.status === 'active').length,
    agents: agentsResult.rows.map<AgentDto>((row) => ({
      agentId: row.agent_id,
      role: row.role,
      configured: row.configured,
      updatedAt: row.updated_at
    })),
    sessions
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

const safeString = (value: unknown, fallback = '—'): string => (typeof value === 'string' && value.trim().length > 0 ? value : fallback);

const formatDateMs = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return new Date(value).toISOString();
};

const cronDetailsMarkdown = (raw: Record<string, unknown> | null): string => {
  if (!raw) {
    return 'No extended cron metadata available.';
  }

  const schedule = (raw.schedule ?? {}) as Record<string, unknown>;
  const delivery = (raw.delivery ?? {}) as Record<string, unknown>;
  const state = (raw.state ?? {}) as Record<string, unknown>;
  const payload = (raw.payload ?? {}) as Record<string, unknown>;

  const lines = [
    `### Schedule`,
    `- Kind: ${safeString(schedule.kind, safeString(raw.scheduleKind, 'unknown'))}`,
    `- Expr: ${safeString(schedule.expr)}`,
    `- TZ: ${safeString(schedule.tz)}`,
    '',
    `### Target`,
    `- Agent: ${safeString(raw.agentId)}`,
    `- Session Key: ${safeString(raw.sessionKey)}`,
    `- Session Target: ${safeString(raw.sessionTarget)}`,
    `- Wake Mode: ${safeString(raw.wakeMode)}`,
    '',
    `### Delivery`,
    `- Mode: ${safeString(delivery.mode)}`,
    `- Channel: ${safeString(delivery.channel)}`,
    `- To: ${safeString(delivery.to)}`,
    '',
    `### Last Execution State`,
    `- Last Status: ${safeString(state.lastStatus)}`,
    `- Last Run: ${formatDateMs(state.lastRunAtMs)}`,
    `- Last Duration (ms): ${typeof state.lastDurationMs === 'number' ? state.lastDurationMs : '—'}`,
    `- Consecutive Errors: ${typeof state.consecutiveErrors === 'number' ? state.consecutiveErrors : '—'}`,
    `- Next Run: ${formatDateMs(state.nextRunAtMs)}`,
    ''
  ];

  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    lines.push('### Script / Prompt', '', payload.message);
  }

  return lines.join('\n');
};

const normalizeJobId = (job: Record<string, unknown>): string => String(job.jobId ?? job.job_id ?? job.id ?? 'unknown');

const readLatestCronRawJobs = async (db: DbExecutor): Promise<Map<string, Record<string, unknown>>> => {
  const result = await db.query<{ payload_json: { jobs?: unknown } | null }>(`
      SELECT payload_json
      FROM source_snapshots
      WHERE source_type = 'cron'
      ORDER BY captured_at DESC
      LIMIT 1
    `);

  const payload = result.rows[0]?.payload_json;
  if (!payload || !Array.isArray(payload.jobs)) {
    return new Map();
  }

  const map = new Map<string, Record<string, unknown>>();

  for (const item of payload.jobs) {
    if (typeof item === 'object' && item !== null) {
      const record = item as Record<string, unknown>;
      map.set(normalizeJobId(record), record);
    }
  }

  return map;
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

  const rawByJobId = await readLatestCronRawJobs(db);

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
      updatedAt: row.updated_at,
      detailsMarkdown: cronDetailsMarkdown(rawByJobId.get(row.job_id) ?? null)
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

export const readStream = async (db: DbExecutor): Promise<StreamDto> => {
  const messagesResult = await db.query<{
    session_key: string | null;
    role: string;
    message_ts: string;
    text_preview: string | null;
    model: string | null;
  }>(`
      SELECT session_key, role, message_ts, text_preview, model
      FROM session_messages
      ORDER BY message_ts DESC
      LIMIT 100
    `);

  const toolsResult = await db.query<{
    session_key: string | null;
    tool_call_id: string;
    tool_name: string | null;
    is_error: boolean;
    started_at: string | null;
    finished_at: string | null;
    duration_ms: number | null;
  }>(`
      SELECT session_key, tool_call_id, tool_name, is_error, started_at, finished_at, duration_ms
      FROM tool_spans
      ORDER BY COALESCE(finished_at, started_at, updated_at) DESC
      LIMIT 100
    `);

  const rateResult = await db.query<{ events_per_minute: string }>(`
      SELECT COUNT(*)::text AS events_per_minute
      FROM session_events
      WHERE event_ts >= NOW() - INTERVAL '1 minute'
    `);

  return {
    ok: true,
    apiVersion: API_VERSION,
    generatedAt: nowIso(),
    readOnly: true,
    eventsPerMinute: Number(rateResult.rows[0]?.events_per_minute ?? 0),
    messages: messagesResult.rows.map((row) => ({
      sessionKey: row.session_key,
      role: row.role,
      messageTs: row.message_ts,
      textPreview: row.text_preview,
      model: row.model
    })),
    tools: toolsResult.rows.map((row) => ({
      sessionKey: row.session_key,
      toolCallId: row.tool_call_id,
      toolName: row.tool_name,
      isError: row.is_error,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      durationMs: row.duration_ms
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
