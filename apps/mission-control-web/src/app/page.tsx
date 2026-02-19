import { getOverview } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const overview = await getOverview();

  return (
    <section>
      <h1>Mission Control Overview</h1>
      <small>
        API {overview.apiVersion} · Generated {new Date(overview.generatedAt).toLocaleString()}
      </small>
      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Agents</h3>
          <div>{overview.summary.agents}</div>
        </div>
        <div className="card">
          <h3>Sessions</h3>
          <div>
            {overview.summary.activeSessions} active / {overview.summary.sessions} total
          </div>
        </div>
        <div className="card">
          <h3>Memory Docs</h3>
          <div>{overview.summary.memoryDocs}</div>
        </div>
        <div className="card">
          <h3>Cron</h3>
          <div>
            {overview.summary.cronJobs} jobs / {overview.summary.cronRuns} runs
          </div>
        </div>
        <div className="card">
          <h3>Collector Issues</h3>
          <div>
            {overview.summary.collectorErrors} errors / {overview.summary.staleCollectors} stale
          </div>
        </div>
        <div className="card">
          <h3>Latest Status</h3>
          <div>{overview.summary.latestStatus}</div>
        </div>
      </div>
    </section>
  );
}
