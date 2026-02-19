import { getOverview } from '@/lib/api';

export const dynamic = 'force-dynamic';

const statusPillClass = (status: string): string => {
  if (status === 'ok') return 'pill ok';
  if (status === 'degraded') return 'pill warn';
  if (status === 'offline') return 'pill danger';
  return 'pill';
};

export default async function OverviewPage() {
  const overview = await getOverview();

  return (
    <section>
      <div className="page-head">
        <h1>Overview Deck</h1>
        <small>
          API {overview.apiVersion} · Generated {new Date(overview.generatedAt).toLocaleString()}
        </small>
      </div>

      <div className="grid">
        <article className="kpi">
          <h3>Agents</h3>
          <div className="value">{overview.summary.agents}</div>
        </article>
        <article className="kpi">
          <h3>Sessions</h3>
          <div className="value">{overview.summary.sessions}</div>
        </article>
        <article className="kpi">
          <h3>Active Now</h3>
          <div className="value">{overview.summary.activeSessions}</div>
        </article>
        <article className="kpi">
          <h3>Memory Docs</h3>
          <div className="value">{overview.summary.memoryDocs}</div>
        </article>
        <article className="kpi">
          <h3>Cron Jobs</h3>
          <div className="value">{overview.summary.cronJobs}</div>
        </article>
        <article className="kpi">
          <h3>Cron Runs</h3>
          <div className="value">{overview.summary.cronRuns}</div>
        </article>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card" style={{ gridColumn: 'span 8' }}>
          <h2>System Signal</h2>
          <div className="stack">
            <div className="signal">
              <pre>
{`collector_errors=${overview.summary.collectorErrors}
stale_collectors=${overview.summary.staleCollectors}
status=${overview.summary.latestStatus}`}
              </pre>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 4' }}>
          <h2>Status Beacon</h2>
          <p>
            <span className={statusPillClass(overview.summary.latestStatus)}>{overview.summary.latestStatus}</span>
          </p>
          <small>Read-only endpoint health derived from latest collector snapshots.</small>
        </div>
      </div>
    </section>
  );
}
