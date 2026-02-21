import type { AgentsResponse, CronResponse, HealthResponse, StreamResponse } from './contracts';

export type TopologyNodeKind = 'agent' | 'session' | 'cron' | 'health';

export interface TopologyNodeData {
  [key: string]: unknown;
  kind: TopologyNodeKind;
  title: string;
  subtitle: string;
  status: 'active' | 'healthy' | 'degraded' | 'error' | 'inactive' | 'neutral';
  output: string;
  activity: string[];
  sessionKey?: string | null;
  agentId?: string | null;
}

export interface TopologyEdgeData {
  [key: string]: unknown;
  relation: string;
  status: 'healthy' | 'degraded' | 'error' | 'neutral';
}

export interface TopologyGraph {
  nodes: Array<{ id: string; data: TopologyNodeData; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; data: TopologyEdgeData }>;
}

const healthStatus = (status: HealthResponse['latest'] extends infer T ? T : never): TopologyNodeData['status'] => {
  const s = (status as HealthResponse['latest'])?.openclawStatus;
  if (s === 'ok') return 'healthy';
  if (s === 'offline') return 'error';
  if (s === 'degraded') return 'degraded';
  return 'neutral';
};

export const buildTopologyGraph = (
  agentsPayload: AgentsResponse,
  cronPayload: CronResponse,
  healthPayload: HealthResponse,
  streamPayload: StreamResponse
): TopologyGraph => {
  const nodes: TopologyGraph['nodes'] = [];
  const edges: TopologyGraph['edges'] = [];

  const activeSessions = agentsPayload.sessions.filter((session) => session.status === 'active').slice(0, 14);

  const toolsBySession = new Map<string, number>();
  for (const tool of streamPayload.tools) {
    if (!tool.sessionKey) continue;
    toolsBySession.set(tool.sessionKey, (toolsBySession.get(tool.sessionKey) ?? 0) + 1);
  }

  const messagesBySession = new Map<string, number>();
  for (const msg of streamPayload.messages) {
    if (!msg.sessionKey) continue;
    messagesBySession.set(msg.sessionKey, (messagesBySession.get(msg.sessionKey) ?? 0) + 1);
  }

  const activeByAgent = new Map<string, typeof activeSessions>();
  for (const session of activeSessions) {
    const key = session.agentId ?? 'unassigned-agent';
    const current = activeByAgent.get(key) ?? [];
    current.push(session);
    activeByAgent.set(key, current);
  }

  const activityBySession = new Map<string, string[]>();
  for (const msg of streamPayload.messages) {
    if (!msg.sessionKey) continue;
    const current = activityBySession.get(msg.sessionKey) ?? [];
    if (current.length < 3) {
      current.push(`${msg.role}: ${(msg.textPreview ?? 'no text').slice(0, 42)}`);
    }
    activityBySession.set(msg.sessionKey, current);
  }

  for (const tool of streamPayload.tools) {
    if (!tool.sessionKey) continue;
    const current = activityBySession.get(tool.sessionKey) ?? [];
    if (current.length < 4) {
      current.push(`tool: ${tool.toolName ?? 'unknown'}${tool.durationMs !== null ? ` (${tool.durationMs}ms)` : ''}`);
    }
    activityBySession.set(tool.sessionKey, current);
  }

  const agentList = agentsPayload.agents.slice(0, 10);

  agentList.forEach((agent, i) => {
    const actives = activeByAgent.get(agent.agentId)?.length ?? 0;
    const agentActivity = (activeByAgent.get(agent.agentId) ?? [])
      .flatMap((session) => activityBySession.get(session.sessionKey) ?? [])
      .slice(0, 3);

    nodes.push({
      id: `agent:${agent.agentId}`,
      position: { x: 30, y: 70 + i * 140 },
      data: {
        kind: 'agent',
        title: agent.agentId,
        subtitle: agent.configured ? 'configured' : 'needs config',
        status: actives > 0 ? 'active' : 'inactive',
        output: `${actives} active sessions`,
        activity: agentActivity.length > 0 ? agentActivity : ['idle'],
        agentId: agent.agentId
      }
    });
  });

  activeSessions.forEach((session, i) => {
    const toolCount = toolsBySession.get(session.sessionKey) ?? 0;
    const messageCount = messagesBySession.get(session.sessionKey) ?? 0;
    nodes.push({
      id: `session:${session.sessionKey}`,
      position: { x: 470, y: 70 + i * 120 },
      data: {
        kind: 'session',
        title: session.label || session.sessionKey,
        subtitle: session.runType,
        status: 'active',
        output: `${messageCount} msgs · ${toolCount} tool calls`,
        activity: activityBySession.get(session.sessionKey) ?? ['no recent events'],
        sessionKey: session.sessionKey,
        agentId: session.agentId
      }
    });

    const source = `agent:${session.agentId ?? 'unassigned-agent'}`;
    edges.push({
      id: `edge:${source}->session:${session.sessionKey}`,
      source,
      target: `session:${session.sessionKey}`,
      data: {
        relation: 'produces',
        status: 'healthy'
      }
    });
  });

  cronPayload.jobs.slice(0, 8).forEach((job, i) => {
    const lastRun = cronPayload.runs.find((run) => run.jobId === job.jobId);
    const hasError = Boolean(lastRun && /fail|error/i.test(lastRun.status));

    nodes.push({
      id: `cron:${job.jobId}`,
      position: { x: 960, y: 90 + i * 120 },
      data: {
        kind: 'cron',
        title: job.name,
        subtitle: job.enabled ? 'enabled' : 'disabled',
        status: hasError ? 'error' : job.enabled ? 'healthy' : 'inactive',
        output: `next: ${job.nextRunAt ? new Date(job.nextRunAt).toLocaleTimeString() : '—'}`,
        activity: [lastRun ? `last: ${lastRun.status}` : 'no recent runs']
      }
    });

    if (activeSessions[i]) {
      edges.push({
        id: `edge:cron:${job.jobId}->session:${activeSessions[i].sessionKey}`,
        source: `cron:${job.jobId}`,
        target: `session:${activeSessions[i].sessionKey}`,
        data: {
          relation: 'triggers',
          status: hasError ? 'error' : 'neutral'
        }
      });
    }
  });

  nodes.push({
    id: 'health:global',
    position: { x: 960, y: 20 },
    data: {
      kind: 'health',
      title: 'Health Monitor',
      subtitle: healthPayload.latest?.openclawStatus ?? 'unknown',
      status: healthStatus(healthPayload.latest),
      output: `${healthPayload.collectors.filter((c) => c.stale || c.errorCount > 0).length} collector alerts`,
      activity: (healthPayload.latest?.errors ?? []).slice(0, 3).map((e) => `error: ${e.slice(0, 42)}`)
    }
  });

  return { nodes, edges };
};
