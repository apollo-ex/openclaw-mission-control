'use client';

import { TopologyGraph } from './topology-graph';
import type { TopologyGraph as TopologyGraphType } from '@/lib/graph-model';

interface TopologyPanelProps {
  graph: TopologyGraphType;
  generatedAt: string;
}

function formatGeneratedAtLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Updated: unknown';
  return `Updated: ${date.toISOString().replace('T', ' ').replace('Z', ' UTC')}`;
}

function isStale(iso: string, thresholdMs = 15 * 60 * 1000): boolean {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > thresholdMs;
}

export function TopologyPanel({ graph, generatedAt }: TopologyPanelProps) {
  const stale = isStale(generatedAt);

  return (
    <section className="topology-layout canvas-only">
      <div className="topology-main canvas-only">
        <div className={`freshness-badge ${stale ? 'is-stale' : 'is-fresh'}`}>
          {formatGeneratedAtLabel(generatedAt)}
        </div>
        <TopologyGraph nodes={graph.nodes} edges={graph.edges} />
      </div>
    </section>
  );
}
