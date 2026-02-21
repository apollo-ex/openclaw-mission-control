import { AutoRefresh } from '@/components/auto-refresh';
import { RuntimeLane } from '@/components/runtime-lane';
import { getAgents, getCron, getHealth, getMemory, getOverview } from '@/lib/api';
import type { CronRunRecord } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

type Tone = 'healthy' | 'degraded' | 'error' | 'running' | 'neutral';

const toneClass = (tone: Tone): string => `tone-${tone}`;

const healthTone = (status: string): Tone => {
  if (status === 'ok') return 'healthy';
  if (status === 'degraded') return 'degraded';
  if (status === 'offline') return 'error';
  return 'neutral';
};

const cronTone = (status: string): Tone => {
  const normalized = status.toLowerCase();
  if (normalized.includes('ok') || normalized.includes('success')) return 'healthy';
  if (normalized.includes('running') || normalized.includes('active')) return 'running';
  if (normalized.includes('fail') || normalized.includes('error')) return 'error';
  return 'neutral';
};

const formatDateTime = (value: string | null): string => {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Date(parsed).toLocaleString();
};

const toMs = (value: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const eventToneForRun = (run: CronRunRecord): Tone => {
  const status = run.status.toLowerCase();
  if (status.includes('fail') || status.includes('error')) return 'error';
  if (status.includes('running')) return 'running';
  if (status.includes('success') || status.includes('ok')) return 'healthy';
  return 'neutral';
};

export default async function MissionControlPage() {
  const [overview, agentsPayload, cronPayload, healthPayload, memoryPayload] = await Promise.all([
    getOverview(),
    getAgents(),
    getCron(),
    getHealth(),
    getMemory()
  ]);

  const sessions = agentsPayload.sessions;
  const activeSessions = sessions.filter((session) => session.status === 'active');

  const activeByRunType = activeSessions.reduce(
    (acc, session) => {
      acc[session.runType] += 1;
      return acc;
    },
    { main: 0, subagent: 0, cron: 0, agent: 0, unknown: 0 }
  );

  const agentSessionStats = new Map<
    string,
    {
      active: number;
      total: number;
      subagents: number;
      lastUpdateMs: number;
    }
  >();

  for (const session of sessions) {
    const key = session.agentId ?? 'unassigned-agent';
    const existing = agentSessionStats.get(key) ?? { active: 0, total: 0, subagents: 0, lastUpdateMs: 0 };
    existing.total += 1;
    if (session.status === 'active') existing.active += 1;
    if (session.runType === 'subagent') existing.subagents += 1;
    existing.lastUpdateMs = Math.max(existing.lastUpdateMs, toMs(session.lastUpdateAt ?? session.updatedAt));
    agentSessionStats.set(key, existing);
  }

  const maxAgentSessionTotal = Math.max(...Array.from(agentSessionStats.values()).map((item) => item.total), 1);

  const latestRunByJobId = new Map<string, CronRunRecord>();
  for (const run of cronPayload.runs) {
    if (!latestRunByJobId.has(run.jobId)) {
      latestRunByJobId.set(run.jobId, run);
    }
  }

  const failingRuns = cronPayload.runs.filter((run) => {
    const status = run.status.toLowerCase();
    return status.includes('fail') || status.includes('error');
  });

  const collectorAlerts = healthPayload.collectors.filter((collector) => collector.stale || collector.errorCount > 0);

  const kindCounts = memoryPayload.docs.reduce<Map<string, number>>((acc, doc) => {
    acc.set(doc.kind, (acc.get(doc.kind) ?? 0) + 1);
    return acc;
  }, new Map());

  const memoryKinds = Array.from(kindCounts.entries()).sort((a, b) => b[1] - a[1]);

  const eventFeed = [
    ...failingRuns.slice(0, 4).map((run) => ({
      id: `cron-${run.runId}`,
      title: `Cron ${run.status}`,
      detail: `${run.jobId} · ${run.summary || 'No summary'}`,
      at: formatDateTime(run.startedAt ?? run.updatedAt),
      tone: eventToneForRun(run)
    })),
    ...(healthPayload.latest?.errors ?? []).slice(0, 4).map((error, index) => ({
      id: `health-${index}`,
      title: 'Health alert',
      detail: error,
      at: formatDateTime(healthPayload.latest?.ts ?? null),
      tone: 'error' as Tone
    }))
  ];

  return (
    <main className="mission-surface">
      <section className="command-surface">
        <div>
          <p className="eyebrow">OpenClaw · Mission Control</p>
          <h1>Unified Agentic Control Surface</h1>
          <p className="lede">Read-only operational mesh for agents, sessions, cron, health, and memory.</p>
          <div className="meta-row">
            <small>Generated {new Date(overview.generatedAt).toLocaleString()}</small>
            <AutoRefresh intervalMs={15_000} />
          </div>
        </div>

        <div className="status-stack">
          <div className="status-item">
            <span>System health</span>
            <strong className={toneClass(healthTone(overview.summary.latestStatus))}>{overview.summary.latestStatus}</strong>
          </div>
          <div className="status-item">
            <span>Active runs</span>
            <strong className="tone-running">{overview.summary.activeSessions}</strong>
          </div>
          <div className="status-item">
            <span>Collector alerts</span>
            <strong className={toneClass(collectorAlerts.length > 0 ? 'degraded' : 'healthy')}>{collectorAlerts.length}</strong>
          </div>
        </div>
      </section>

      <section className="mesh-row" aria-label="System relationship map">
        <article className="mesh-node">
          <p>Agents</p>
          <strong>{overview.summary.agents}</strong>
        </article>
        <article className="mesh-node">
          <p>Sessions</p>
          <strong>{overview.summary.sessions}</strong>
        </article>
        <article className="mesh-node">
          <p>Cron Jobs</p>
          <strong>{overview.summary.cronJobs}</strong>
        </article>
        <article className="mesh-node">
          <p>Health Events</p>
          <strong>{collectorAlerts.length + (healthPayload.latest?.errors.length ?? 0)}</strong>
        </article>
      </section>

      <section className="surface-grid">
        <article className="panel panel-runtime" id="sessions">
          <header className="panel-head">
            <div>
              <p className="eyebrow">Runtime Flow</p>
              <h2>Active Session Lanes</h2>
            </div>
            <div className="panel-kpis">
              <span className="tone-chip tone-running">main {activeByRunType.main}</span>
              <span className="tone-chip tone-degraded">subagent {activeByRunType.subagent}</span>
              <span className="tone-chip tone-neutral">cron {activeByRunType.cron}</span>
            </div>
          </header>
          <RuntimeLane sessions={sessions} />
        </article>

        <article className="panel panel-agents" id="agents">
          <header className="panel-head compact">
            <div>
              <p className="eyebrow">Topology</p>
              <h2>Agent Load Map</h2>
            </div>
          </header>
          <ul className="agent-list">
            {agentsPayload.agents.map((agent) => {
              const stats = agentSessionStats.get(agent.agentId) ?? {
                active: 0,
                total: 0,
                subagents: 0,
                lastUpdateMs: 0
              };

              const width = `${Math.max(8, Math.round((stats.total / maxAgentSessionTotal) * 100))}%`;

              return (
                <li key={agent.agentId} className="agent-row">
                  <div className="agent-row-head">
                    <strong>{agent.agentId}</strong>
                    <span className={`tone-chip ${agent.configured ? 'tone-healthy' : 'tone-degraded'}`}>
                      {agent.configured ? 'configured' : 'needs config'}
                    </span>
                  </div>
                  <div className="agent-bar">
                    <span style={{ width }} />
                  </div>
                  <div className="agent-row-meta">
                    <span>{stats.active} active</span>
                    <span>{stats.subagents} subagents</span>
                    <span>updated {formatDateTime(agent.updatedAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="panel panel-cron" id="cron">
          <header className="panel-head compact">
            <div>
              <p className="eyebrow">Scheduler</p>
              <h2>Cron Nexus</h2>
            </div>
          </header>

          <ul className="cron-list">
            {cronPayload.jobs.slice(0, 10).map((job) => {
              const latestRun = latestRunByJobId.get(job.jobId);
              return (
                <li key={job.jobId} className="cron-row">
                  <div>
                    <strong>{job.name}</strong>
                    <small>{job.jobId}</small>
                  </div>
                  <div className="cron-meta">
                    <span className={`tone-chip ${job.enabled ? 'tone-healthy' : 'tone-error'}`}>
                      {job.enabled ? 'enabled' : 'disabled'}
                    </span>
                    {latestRun ? <span className={`tone-chip ${toneClass(cronTone(latestRun.status))}`}>{latestRun.status}</span> : null}
                    <span>next {formatDateTime(job.nextRunAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="panel panel-health" id="health">
          <header className="panel-head compact">
            <div>
              <p className="eyebrow">Reliability</p>
              <h2>Health + Event Rail</h2>
            </div>
          </header>

          <div className="health-block">
            <div className="health-signal">
              <span className={toneClass(healthTone(healthPayload.latest?.openclawStatus ?? 'unknown'))}>
                {healthPayload.latest?.openclawStatus ?? 'unknown'}
              </span>
              <small>{healthPayload.latest?.stale ? 'stale sample' : 'fresh sample'}</small>
            </div>

            <ul className="collector-list">
              {healthPayload.collectors.slice(0, 6).map((collector) => (
                <li key={collector.collectorName}>
                  <span>{collector.collectorName}</span>
                  <span className={`tone-chip ${collector.stale || collector.errorCount > 0 ? 'tone-degraded' : 'tone-healthy'}`}>
                    err {collector.errorCount}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="event-list">
            {eventFeed.length > 0 ? (
              eventFeed.map((event) => (
                <li key={event.id}>
                  <span className={`event-dot ${toneClass(event.tone)}`} />
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                    <small>{event.at}</small>
                  </div>
                </li>
              ))
            ) : (
              <li>
                <span className="event-dot tone-healthy" />
                <div>
                  <strong>No active alerts</strong>
                  <p>Recent cron and health signals are clean.</p>
                </div>
              </li>
            )}
          </ul>
        </article>

        <article className="panel panel-memory" id="memory">
          <header className="panel-head compact">
            <div>
              <p className="eyebrow">Context Store</p>
              <h2>Memory Registry Snapshot</h2>
            </div>
            <span className="tone-chip tone-neutral">{memoryPayload.redactedDocs} redacted</span>
          </header>

          <div className="memory-grid">
            <div>
              <h3>By kind</h3>
              <ul className="simple-list">
                {memoryKinds.slice(0, 6).map(([kind, count]) => (
                  <li key={kind}>
                    <span>{kind}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3>Recent docs</h3>
              <ul className="simple-list">
                {memoryPayload.docs.slice(0, 6).map((doc) => (
                  <li key={doc.path}>
                    <span>{doc.path}</span>
                    <strong className={doc.redacted ? 'tone-degraded' : 'tone-healthy'}>{doc.redacted ? 'redacted' : 'clean'}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
