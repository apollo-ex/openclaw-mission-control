# task_plan.md

## Objective
Overhaul Mission Control main UI into a clear node/edge operator view: "this node produces this output" with minimal confusion between active/inactive runtime elements.

## Phased plan (UI overhaul)
- [x] Phase 0: Audit current main UI (desktop + mobile) and identify comprehension bottlenecks.
- [ ] Phase 1: Define simplified information architecture (Graph-first + Details + Stream).
- [ ] Phase 2: Design node/edge data model from existing payloads (agents/sessions/cron/health/stream).
- [ ] Phase 3: Build React Flow prototype (`@xyflow/react`) with read-only custom nodes/edges.
- [ ] Phase 4: Integrate detail panel (selected node/edge contextual data) and improve labels/states.
- [ ] Phase 5: Mobile strategy (fallback compact list + optional graph mini-map) and polish.
- [ ] Phase 6: Verify with agent-browser (desktop/mobile) + tests + deploy.

## Verification plan
- Validate that a user can answer in <5 seconds:
  1) Which agents/sessions are active now?
  2) What is each active node producing?
  3) Where are current errors/failures?
- Run frontend tests + build.
- Run agent-browser screenshot audit on `/` for desktop and mobile before/after.
