import { getHealth } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const payload = await getHealth();

  return (
    <section>
      <h1>Health</h1>
      <small>
        Latest status: {payload.latest?.openclawStatus ?? 'unknown'}
        {payload.latest?.stale ? ' (stale)' : ''}
      </small>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Latest Sample</h2>
        {payload.latest ? (
          <ul>
            <li>Timestamp: {new Date(payload.latest.ts).toLocaleString()}</li>
            <li>Status: {payload.latest.openclawStatus}</li>
            <li>Stale: {payload.latest.stale ? 'yes' : 'no'}</li>
            <li>Errors: {payload.latest.errors.length > 0 ? payload.latest.errors.join('; ') : 'none'}</li>
          </ul>
        ) : (
          <p>No health samples yet.</p>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Collectors</h2>
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
                  <td>{collector.stale ? 'yes' : 'no'}</td>
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
