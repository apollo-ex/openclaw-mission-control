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
    <main className="mission-surface canvas-only">
      <TopologyPanel graph={graph} generatedAt={streamPayload.generatedAt} />
    </main>
  );
}
