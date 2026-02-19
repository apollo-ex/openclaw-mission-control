import { getAgents } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const payload = await getAgents();

  return (
    <section>
      <div className="page-head">
        <h1>Agent Grid</h1>
        <small>
          {payload.agents.length} agents · {payload.sessions.length} sessions
        </small>
      </div>

      <div className="grid" style={{ marginBottom: 12 }}>
        <article className="kpi">
          <h3>Registered</h3>
          <div className="value">{payload.agents.length}</div>
        </article>
        <article className="kpi">
          <h3>Sessions</h3>
          <div className="value">{payload.sessions.length}</div>
        </article>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Registered Agents</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Role</th>
                <th>Configured</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {payload.agents.map((agent) => (
                <tr key={agent.agentId}>
                  <td>{agent.agentId}</td>
                  <td>{agent.role ?? '—'}</td>
                  <td>
                    <span className={agent.configured ? 'pill ok' : 'pill warn'}>{agent.configured ? 'yes' : 'no'}</span>
                  </td>
                  <td>{new Date(agent.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent Sessions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Label</th>
                <th>Status</th>
                <th>Runtime (ms)</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {payload.sessions.map((session) => (
                <tr key={session.sessionKey}>
                  <td>{session.sessionKey}</td>
                  <td>{session.label}</td>
                  <td>
                    <span className={session.status === 'active' ? 'pill ok' : 'pill'}>{session.status}</span>
                  </td>
                  <td>{session.runtimeMs ?? '—'}</td>
                  <td>{session.model ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
