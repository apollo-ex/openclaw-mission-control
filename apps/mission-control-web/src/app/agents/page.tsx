import { getAgents } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const payload = await getAgents();

  return (
    <section>
      <h1>Agents</h1>
      <small>
        API {payload.apiVersion} · {payload.agents.length} agents · {payload.sessions.length} sessions
      </small>

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
                  <td>{agent.configured ? 'yes' : 'no'}</td>
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
                <th>Runtime</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {payload.sessions.map((session) => (
                <tr key={session.sessionKey}>
                  <td>{session.sessionKey}</td>
                  <td>{session.label}</td>
                  <td>{session.status}</td>
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
