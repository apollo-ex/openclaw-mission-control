# Mission Control UI Overhaul Plan (Node/Edge-first)

Date: 2026-02-20

## Goal
Make the main screen answer, at a glance:
1. What nodes exist right now?
2. Which nodes are active vs inactive?
3. What each active node is producing right now?
4. Where failures are in the graph?

Current issue: the home page blends too many panels and forces users to mentally stitch relationships.

## Key redesign decision
Adopt **graph-first layout**:
- Left/center: read-only node-edge graph (runtime topology)
- Right: focused details panel for selected node/edge
- Bottom (or tab): compact live event stream (messages/tool calls/errors)

This replaces the current “many independent cards” mental model.

## React Flow viability
Use `@xyflow/react` (v12.x) for graph rendering.

Why it fits:
- custom node components (Agent, Session, Cron, Health)
- styled edges with status color (healthy/running/error)
- pan/zoom for dense topologies
- easy click-select interactions for details panel

Risks:
- mobile complexity if full graph always rendered
- mitigation: fallback compact node list on small viewports, optional graph toggle

## Data model for graph

## Node types
- `agent:<agentId>`
- `session:<sessionKey>`
- `cron:<jobId>`
- `health:global`

## Edge semantics
- Agent -> Session (ownership/execution)
- Session -> Tool stream (activity edge intensity)
- Cron -> Session or Agent (scheduled trigger)
- Health -> Node (alert edge when stale/error)

## Node status mapping
- active/running => blue
- healthy => green
- degraded/stale => amber
- error/failure => red
- inactive/unknown => neutral gray

## Information architecture

## Main page sections (new)
1. **Topology Graph** (primary)
2. **Details Inspector** (contextual)
3. **Live Stream Rail** (latest messages/tool calls)

## Remove/de-emphasize
- multiple standalone cards that duplicate metrics without relationships
- mixed runtime lanes showing active/inactive interleaved without graph context

## Implementation phases

### Phase 1: Graph data builder
- Create `src/lib/graph-model.ts` that transforms existing API payloads to `{nodes,edges}`.
- Add deterministic IDs and status fields.

### Phase 2: React Flow shell
- Install `@xyflow/react`.
- Create `components/topology-graph.tsx` (client component).
- Render nodes/edges with status styling.

### Phase 3: Custom nodes + edges
- Add custom node renderers with minimal, high-signal fields:
  - title
  - state chip
  - “producing X” line
- Add edge labels where useful (`runs`, `triggers`, `errors`).

### Phase 4: Inspector panel
- Click node/edge to inspect details from existing payloads.
- Keep details compact and operator-focused.

### Phase 5: Mobile strategy
- `< 760px`: default to compact grouped list + optional “Open Graph” button.
- preserve fast readability; avoid forcing pan/zoom as default.

### Phase 6: Validation
- Agent-browser screenshot checks desktop + mobile.
- Confirm the 5-second operator questions are answerable.

## Acceptance criteria
- Active entities are visually obvious without reading long lists.
- Inactive nodes are visually de-emphasized, not mixed confusingly with active nodes.
- “Node produces what?” is shown in each selected node inspector.
- Errors/stale paths are immediately visible in graph coloring.
- Mobile layout remains readable and not overcrowded.

## Rollout strategy
1. Ship graph view behind feature flag (`MC_UI_GRAPH_ENABLED=true`).
2. Keep current layout as fallback.
3. Validate with real usage, then flip default.

## Next action
Begin Phase 1 + 2 in code:
- install `@xyflow/react`
- build graph transform from current payloads
- render first read-only topology graph with selection state
