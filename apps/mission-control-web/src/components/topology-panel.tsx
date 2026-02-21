'use client';

import { TopologyGraph } from './topology-graph';
import type { TopologyGraph as TopologyGraphType } from '@/lib/graph-model';

interface TopologyPanelProps {
  graph: TopologyGraphType;
}

export function TopologyPanel({ graph }: TopologyPanelProps) {
  return (
    <section className="topology-layout canvas-only">
      <div className="topology-main canvas-only">
        <TopologyGraph nodes={graph.nodes} edges={graph.edges} />
      </div>
    </section>
  );
}
