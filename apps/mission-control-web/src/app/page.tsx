import { AutoRefresh } from '@/components/auto-refresh';
import { TopologyPanel } from '@/components/topology-panel';
import { getAgents, getCron, getHealth, getStream } from '@/lib/api';
import { buildTopologyGraph } from '@/lib/graph-model';

export const dynamic = 'force-dynamic';

export default async function MissionControlPage() {
  const [agentsPayload, cronPayload, healthPayload, streamPayload] = await Promise.all([
    getAgents(),
    getCron(),
    getHealth(),
    getStream()
  ]);

  const graph = buildTopologyGraph(agentsPayload, cronPayload, healthPayload, streamPayload);

  return (
    <main className="mission-surface">
      <section className="command-surface simple">
        <div>
          <p className="eyebrow">OpenClaw Mission Control</p>
          <h1>Node Output Map</h1>
          <p className="lede">Simple runtime topology: each node shows what it is currently producing.</p>
        </div>
        <div className="meta-row">
          <small>
            Active sessions: {agentsPayload.activeSessions} · messages: {streamPayload.messages.length} · tool spans: {streamPayload.tools.length}
          </small>
          <AutoRefresh intervalMs={15_000} />
        </div>
      </section>

      <TopologyPanel graph={graph} />

      <section className="panel">
        <header className="panel-head compact">
          <div>
            <p className="eyebrow">Live Stream</p>
            <h2>Latest Messages + Tool Calls</h2>
          </div>
          <span className="tone-chip tone-running">{streamPayload.eventsPerMinute}/min</span>
        </header>

        <div className="stream-grid">
          <div>
            <h3>Messages</h3>
            <ul className="event-list compact-list">
              {streamPayload.messages.slice(0, 8).map((msg, index) => (
                <li key={`${msg.sessionKey ?? 'unknown'}-${msg.messageTs}-${index}`}>
                  <span className={`event-dot ${msg.role === 'assistant' ? 'tone-running' : msg.role === 'toolResult' ? 'tone-healthy' : 'tone-neutral'}`} />
                  <div>
                    <strong>{msg.role}</strong>
                    <p>{msg.textPreview ?? 'no text payload'}</p>
                    <small>{msg.sessionKey ?? 'unmapped'} · {new Date(msg.messageTs).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Tool Calls</h3>
            <ul className="event-list compact-list">
              {streamPayload.tools.slice(0, 8).map((tool) => (
                <li key={tool.toolCallId}>
                  <span className={`event-dot ${tool.isError ? 'tone-error' : 'tone-healthy'}`} />
                  <div>
                    <strong>{tool.toolName ?? 'unknown-tool'}</strong>
                    <p>{tool.durationMs !== null ? `${tool.durationMs}ms` : 'pending'} · {tool.toolCallId.slice(0, 22)}</p>
                    <small>{tool.sessionKey ?? 'unmapped'} · {new Date(tool.startedAt ?? tool.finishedAt ?? Date.now()).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
