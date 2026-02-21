import dagre from 'dagre';

type NodeLike<T> = { id: string; data: T; position: { x: number; y: number } };
type EdgeLike<E> = { id: string; source: string; target: string; data: E };

interface LayoutOptions {
  direction?: 'LR' | 'TB';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

export function layoutWithDagre<T, E>(
  nodes: Array<NodeLike<T>>,
  edges: Array<EdgeLike<E>>,
  options: LayoutOptions = {}
): Array<NodeLike<T>> {
  const {
    direction = 'LR',
    nodeWidth = 220,
    nodeHeight = 120,
    rankSep = 120,
    nodeSep = 60
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: (pos?.x ?? 0) - nodeWidth / 2,
        y: (pos?.y ?? 0) - nodeHeight / 2
      }
    };
  });
}
