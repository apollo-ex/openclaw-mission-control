import { getHealth } from '@/lib/api';

export const dynamic = 'force-dynamic';

const healthPill = (status: string): string => {
  if (status === 'ok') return 'pill ok';
  if (status === 'degraded') return 'pill warn';
  if (status === 'offline') return 'pill danger';
  return 'pill';
};

export default async function HealthPage() {
  const payload = await getHealth();

  return (
    <section>
      <div className="page-head">
        <h1>Health Telemetry</h1>
        <small>
          Latest status: {payload.latest?.openclawStatus ?? 'unknown'}
          {payload.latest?.stale ? ' (stale)' : ''}
        </small>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Latest Sample</h2>
        {payload.latest ? (
          <div className="stack">
            <p>
              <span className={healthPill(payload.latest.openclawStatus)}>{payload.latest.openclawStatus}</span>
            </p>
            <div className="signal">
              <pre>
{`timestamp=${new Date(payload.latest.ts).toLocaleString()}
stale=${payload.latest.stale ? 'yes' : 'no'}
errors=${payload.latest.errors.length > 0 ? payload.latest.errors.join('; ') : 'none'}`}
              </pre>
            </div>
          </div>
        ) : (
          <p>No health samples yet.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Collector Circuit</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Error Count</th>
                <th>Stale</th>
                <th>Last Success</th>
                <th>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {payload.collectors.map((collector) => (
                <tr key={collector.collectorName}>
                  <td>{collector.collectorName}</td>
                  <td>{collector.errorCount}</td>
                  <td>
                    <span className={collector.stale ? 'pill danger' : 'pill ok'}>{collector.stale ? 'yes' : 'no'}</span>
                  </td>
                  <td>{collector.lastSuccessAt ? new Date(collector.lastSuccessAt).toLocaleString() : '—'}</td>
                  <td>{collector.lastError ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
