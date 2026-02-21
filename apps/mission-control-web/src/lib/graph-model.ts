import type { AgentsResponse, CronResponse, HealthResponse, StreamResponse } from './contracts';
import { layoutWithDagre } from './layout-dagre';

export type TopologyNodeKind = 'channel' | 'agent' | 'session' | 'cron' | 'health';

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

const statusFromHealth = (s: string | undefined): TopologyNodeData['status'] => {
  if (s === 'ok') return 'healthy';
  if (s === 'degraded') return 'degraded';
  if (s === 'offline') return 'error';
  return 'neutral';
};

const clip = (v: string, n = 42): string => (v.length > n ? `${v.slice(0, n)}…` : v);

const channelFromSessionKey = (sessionKey: string): string => {
  if (sessionKey.includes(':telegram:')) return 'telegram';
  if (sessionKey.includes(':whatsapp:')) return 'whatsapp';
  if (sessionKey.includes(':signal:')) return 'signal';
  if (sessionKey.includes(':discord:')) return 'discord';
  if (sessionKey.includes(':slack:')) return 'slack';
  if (sessionKey.includes(':cron:')) return 'cron';
  return 'other';
};

export const buildTopologyGraph = (
  agentsPayload: AgentsResponse,
  cronPayload: CronResponse,
  healthPayload: HealthResponse,
  streamPayload: StreamResponse
): TopologyGraph => {
  const nodes: TopologyGraph['nodes'] = [];
  const edges: TopologyGraph['edges'] = [];

  const activeSessions = agentsPayload.sessions.filter((s) => s.status === 'active').slice(0, 16);
  const knownSessionKeys = new Set(activeSessions.map((s) => s.sessionKey));

  const messagesBySession = new Map<string, string[]>();
  const toolsBySession = new Map<string, string[]>();

  for (const msg of streamPayload.messages) {
    if (!msg.sessionKey || !knownSessionKeys.has(msg.sessionKey)) continue;
    const arr = messagesBySession.get(msg.sessionKey) ?? [];
    if (arr.length < 2) arr.push(`${msg.role}: ${clip(msg.textPreview ?? 'no text')}`);
    messagesBySession.set(msg.sessionKey, arr);
  }

  for (const tool of streamPayload.tools) {
    if (!tool.sessionKey || !knownSessionKeys.has(tool.sessionKey)) continue;
    const arr = toolsBySession.get(tool.sessionKey) ?? [];
    if (arr.length < 2) arr.push(`tool: ${tool.toolName ?? 'unknown'}${tool.durationMs !== null ? ` (${tool.durationMs}ms)` : ''}`);
    toolsBySession.set(tool.sessionKey, arr);
  }

  const activeByAgent = new Map<string, typeof activeSessions>();
  const activeByChannel = new Map<string, typeof activeSessions>();

  for (const session of activeSessions) {
    const agentKey = session.agentId ?? 'unassigned-agent';
    const byAgent = activeByAgent.get(agentKey) ?? [];
    byAgent.push(session);
    activeByAgent.set(agentKey, byAgent);

    const channelKey = channelFromSessionKey(session.sessionKey);
    const byChannel = activeByChannel.get(channelKey) ?? [];
    byChannel.push(session);
    activeByChannel.set(channelKey, byChannel);
  }

  const orderedChannels = ['telegram', 'whatsapp', 'signal', 'discord', 'slack', 'cron', 'other'];
  for (const channel of orderedChannels) {
    const sessions = activeByChannel.get(channel) ?? [];
    if (sessions.length === 0) continue;

    const channelActivity = sessions
      .flatMap((s) => [...(messagesBySession.get(s.sessionKey) ?? []), ...(toolsBySession.get(s.sessionKey) ?? [])])
      .slice(0, 2);

    nodes.push({
      id: `channel:${channel}`,
      position: { x: 0, y: 0 },
      data: {
        kind: 'channel',
        title: channel,
        subtitle: 'connected channel',
        status: 'active',
        output: `${sessions.length} active sessions`,
        activity: channelActivity.length > 0 ? channelActivity : ['traffic active']
      }
    });
  }

  for (const agent of agentsPayload.agents.slice(0, 12)) {
    const active = activeByAgent.get(agent.agentId) ?? [];
    const lines = active.flatMap((s) => [...(messagesBySession.get(s.sessionKey) ?? []), ...(toolsBySession.get(s.sessionKey) ?? [])]).slice(0, 2);

    nodes.push({
      id: `agent:${agent.agentId}`,
      position: { x: 0, y: 0 },
      data: {
        kind: 'agent',
        title: agent.agentId,
        subtitle: active.length > 0 ? 'active' : 'idle',
        status: active.length > 0 ? 'active' : 'inactive',
        output: `${active.length} active sessions`,
        activity: lines.length > 0 ? lines : ['no recent activity'],
        agentId: agent.agentId
      }
    });
  }

  for (const session of activeSessions) {
    const msgs = messagesBySession.get(session.sessionKey) ?? [];
    const tools = toolsBySession.get(session.sessionKey) ?? [];

    nodes.push({
      id: `session:${session.sessionKey}`,
      position: { x: 0, y: 0 },
      data: {
        kind: 'session',
        title: session.label || session.sessionKey,
        subtitle: session.runType,
        status: 'active',
        output: `${msgs.length} msg · ${tools.length} tool`,
        activity: [...msgs, ...tools].slice(0, 2),
        sessionKey: session.sessionKey,
        agentId: session.agentId
      }
    });

    const agentNodeId = `agent:${session.agentId ?? 'unassigned-agent'}`;
    const channelNodeId = `channel:${channelFromSessionKey(session.sessionKey)}`;

    edges.push({
      id: `edge:${agentNodeId}->session:${session.sessionKey}`,
      source: agentNodeId,
      target: `session:${session.sessionKey}`,
      data: { relation: 'produces', status: 'healthy' }
    });

    if (!edges.some((edge) => edge.source === channelNodeId && edge.target === agentNodeId)) {
      edges.push({
        id: `edge:${channelNodeId}->${agentNodeId}`,
        source: channelNodeId,
        target: agentNodeId,
        data: { relation: 'routes', status: 'neutral' }
      });
    }
  }

  const latestRunByJobId = new Map<string, string>();
  for (const run of cronPayload.runs) {
    if (!latestRunByJobId.has(run.jobId)) latestRunByJobId.set(run.jobId, run.status);
  }

  for (const job of cronPayload.jobs.slice(0, 10)) {
    const runStatus = latestRunByJobId.get(job.jobId);
    const hasError = runStatus ? /fail|error/i.test(runStatus) : false;

    nodes.push({
      id: `cron:${job.jobId}`,
      position: { x: 0, y: 0 },
      data: {
        kind: 'cron',
        title: job.name,
        subtitle: job.enabled ? 'enabled' : 'disabled',
        status: hasError ? 'error' : job.enabled ? 'healthy' : 'inactive',
        output: `next ${job.nextRunAt ? new Date(job.nextRunAt).toLocaleTimeString() : '—'}`,
        activity: [runStatus ? `last: ${runStatus}` : 'no recent runs']
      }
    });

    if (activeSessions[0]) {
      edges.push({
        id: `edge:cron:${job.jobId}->session:${activeSessions[0].sessionKey}`,
        source: `cron:${job.jobId}`,
        target: `session:${activeSessions[0].sessionKey}`,
        data: { relation: 'triggers', status: hasError ? 'error' : 'neutral' }
      });
    }
  }

  nodes.push({
    id: 'health:global',
    position: { x: 0, y: 0 },
    data: {
      kind: 'health',
      title: 'health',
      subtitle: healthPayload.latest?.openclawStatus ?? 'unknown',
      status: statusFromHealth(healthPayload.latest?.openclawStatus),
      output: `${healthPayload.collectors.filter((c) => c.stale || c.errorCount > 0).length} alerts`,
      activity: (healthPayload.latest?.errors ?? []).slice(0, 2).map((e) => clip(`error: ${e}`)).concat((healthPayload.latest?.errors?.length ?? 0) === 0 ? ['no active health errors'] : [])
    }
  });

  const laidOut = layoutWithDagre(nodes, edges, {
    direction: 'LR',
    nodeWidth: 230,
    nodeHeight: 130,
    rankSep: 160,
    nodeSep: 58
  });

  return { nodes: laidOut, edges };
};
