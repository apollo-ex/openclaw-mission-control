'use client';

import { useMemo, useState } from 'react';
import { TopologyGraph } from './topology-graph';
import type { TopologyGraph as TopologyGraphType, TopologyNodeData } from '@/lib/graph-model';

interface TopologyPanelProps {
  graph: TopologyGraphType;
}

export function TopologyPanel({ graph }: TopologyPanelProps) {
  const [selected, setSelected] = useState<TopologyNodeData | null>(null);

  const initial = useMemo(() => graph.nodes[0]?.data ?? null, [graph.nodes]);
  const current = selected ?? initial;

  return (
    <section className="topology-layout">
      <div className="topology-main">
        <TopologyGraph nodes={graph.nodes} edges={graph.edges} onSelect={setSelected} />
      </div>
      <aside className="topology-inspector">
        <p className="eyebrow">Node Inspector</p>
        {current ? (
          <>
            <h3>{current.title}</h3>
            <ul>
              <li>
                <span>Type</span>
                <strong>{current.kind}</strong>
              </li>
              <li>
                <span>Status</span>
                <strong>{current.status}</strong>
              </li>
              <li>
                <span>State</span>
                <strong>{current.subtitle}</strong>
              </li>
              <li>
                <span>Producing</span>
                <strong>{current.output}</strong>
              </li>
              {current.sessionKey ? (
                <li>
                  <span>Session</span>
                  <strong>{current.sessionKey}</strong>
                </li>
              ) : null}
              {current.agentId ? (
                <li>
                  <span>Agent</span>
                  <strong>{current.agentId}</strong>
                </li>
              ) : null}
            </ul>
          </>
        ) : (
          <p className="empty-note">No nodes yet.</p>
        )}
      </aside>
    </section>
  );
}
