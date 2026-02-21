'use client';

import { memo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TopologyEdgeData, TopologyNodeData } from '@/lib/graph-model';

interface TopologyGraphProps {
  nodes: Array<{ id: string; data: TopologyNodeData; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; data: TopologyEdgeData }>;
  onSelect?: (node: TopologyNodeData | null) => void;
}

const nodeClass = (status: TopologyNodeData['status']): string => `flow-node flow-${status}`;

const GraphNode = memo(({ data }: NodeProps<Node<TopologyNodeData>>) => {
  return (
    <div className={nodeClass(data.status)}>
      <Handle type="target" position={Position.Left} />
      <p>{data.kind.toUpperCase()}</p>
      <strong>{data.title}</strong>
      <small>{data.subtitle}</small>
      <div>{data.output}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
GraphNode.displayName = 'GraphNode';

export function TopologyGraph({ nodes, edges, onSelect }: TopologyGraphProps) {
  const rfNodes: Node[] = nodes.map((node) => ({
    ...node,
    type: 'topology'
  }));

  const rfEdges: Edge[] = edges.map((edge) => ({
    ...edge,
    animated: edge.data.status === 'error',
    label: edge.data.relation,
    style: {
      stroke: edge.data.status === 'error' ? '#ff6f91' : edge.data.status === 'healthy' ? '#61f0bb' : '#7da0d8'
    },
    labelStyle: { fill: '#9fb5dd', fontSize: 11 }
  }));

  return (
    <div className="graph-wrap" role="img" aria-label="Mission control topology graph">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={{ topology: GraphNode }}
        fitView
        onNodeClick={(_, node) => onSelect?.((node.data as TopologyNodeData) ?? null)}
      >
        <Background gap={20} size={1} color="#1f3359" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
