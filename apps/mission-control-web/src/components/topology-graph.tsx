'use client';

import { memo, useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type EdgeMarker,
  type Node,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TopologyEdgeData, TopologyNodeData } from '@/lib/graph-model';

interface TopologyGraphProps {
  nodes: Array<{ id: string; data: TopologyNodeData; position: { x: number; y: number } }>;
  edges: Array<{ id: string; source: string; target: string; data: TopologyEdgeData }>;
}

const markerEnd: EdgeMarker = {
  type: 'arrowclosed',
  width: 16,
  height: 16,
  color: '#7da0d8'
};

const nodeClass = (status: TopologyNodeData['status']): string => `flow-node flow-${status}`;

const nodeTypes = {
  topology: memo(({ data }: NodeProps<Node<TopologyNodeData>>) => {
    return (
      <div className={nodeClass(data.status)}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <p>{data.kind.toUpperCase()}</p>
        <strong>{data.title}</strong>
        <small>{data.subtitle}</small>
        <div>{data.output}</div>
        <ul>
          {data.activity.slice(0, 2).map((line, idx) => (
            <li key={`${data.title}-${idx}`}>{line}</li>
          ))}
        </ul>
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </div>
    );
  })
};

nodeTypes.topology.displayName = 'TopologyNode';

const nodeColor = (node: Node): string => {
  const status = (node.data as TopologyNodeData | undefined)?.status;
  if (status === 'error') return '#ff6f91';
  if (status === 'degraded') return '#ffcd6e';
  if (status === 'active') return '#6ec4ff';
  if (status === 'healthy') return '#61f0bb';
  if (status === 'inactive') return '#6d7f9f';
  return '#9fb5dd';
};

export function TopologyGraph({ nodes, edges }: TopologyGraphProps) {
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        type: 'topology',
        draggable: false,
        selectable: false
      })),
    [nodes]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        animated: edge.data.status === 'error',
        markerEnd,
        label: edge.data.relation,
        style: {
          strokeWidth: edge.data.status === 'error' ? 2.4 : 1.8,
          stroke: edge.data.status === 'error' ? '#ff6f91' : edge.data.status === 'healthy' ? '#61f0bb' : '#7da0d8',
          strokeDasharray: edge.data.status === 'degraded' ? '6 4' : undefined
        },
        labelStyle: { fill: '#9fb5dd', fontSize: 10 }
      })),
    [edges]
  );

  return (
    <div className="graph-wrap" role="img" aria-label="Mission control topology graph">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.45}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnDoubleClick={false}
        elevateEdgesOnSelect={false}
      >
        <Background gap={24} size={1} color="#1f3359" />
        <MiniMap nodeColor={nodeColor} pannable />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
