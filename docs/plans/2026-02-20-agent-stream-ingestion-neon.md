# Mission Control: Agent Message + Tool Stream Ingestion Plan (Neon)

Date: 2026-02-20  
Author: coder (hyperscan pass)

## 1) Scope and goal

Design a background observability pipeline that ingests **granular OpenClaw runtime events** into Neon (messages, tool calls, tool results, run lifecycle), then exposes real-time/near-real-time views in Mission Control.

Target outcome:
- Per-session timeline (user/assistant/tool messages)
- Tool call spans with arguments/result metadata
- Near-live updates in Mission Control UI
- No agent behavior changes required (passive ingestion)

---

## 2) Hyperscan audit summary (current system)

Current Mission Control already has:
- Read-only collectors: sessions/cron/memory/status
- Snapshot + read-model ingest pattern (`source_snapshots` + normalized tables)
- Neon-ready env model (`DATABASE_URL`, `DATABASE_URL_DIRECT`)
- UI pages wired to DB-backed read models

Current observability gap:
- `sessions` table stores only coarse metadata (active/ended/runtime/model/run_type)
- No first-class tables for:
  - message timeline
  - tool calls / tool results
  - per-run event stream

Important runtime source discovered:
- OpenClaw session transcripts are `.jsonl` files containing structured events like:
  - `type: "message"` with message roles (user/assistant/toolResult)
  - `content.type: "toolCall"`
  - `role: "toolResult"` with tool outputs
- `openclaw sessions --json` exposes `transcriptPath` per session in many cases

This means we can ingest granular telemetry **without modifying agents** by consuming transcript streams.

---

## 3) Recommended architecture

## Ingestion approach (recommended)

### Source of truth: transcript JSONL tailing

Use a new background collector that:
1. enumerates active/recent sessions (`openclaw sessions --json`)
2. resolves `sessionId` + `transcriptPath`
3. tails/parses each JSONL incrementally (offset checkpoints)
4. writes normalized events to Neon

Why this is best:
- captures full fidelity (messages + tool calls + tool results)
- passive (no changes to user-facing agents)
- robust replay/backfill possible from files

### Optional secondary source
- Keep existing `sessions_list` collector for fast liveness metadata and backstop when transcriptPath is temporarily missing.

---

## 4) Data model additions (Neon)

Add migration `003_event_stream.sql` (proposed):

1. `session_stream_offsets`
- `session_id` PK
- `transcript_path`
- `last_byte_offset`
- `last_line_number`
- `updated_at`

2. `session_events`
- `id` bigserial PK
- `session_id`, `session_key`
- `event_ts`
- `event_type` (session/model_change/thinking_level_change/message/custom/...)
- `event_id`, `parent_event_id`
- `raw_json` jsonb
- unique index `(session_id, event_id)`

3. `session_messages`
- `id` bigserial PK
- `session_id`, `session_key`
- `event_id`
- `role` (user/assistant/toolResult/system)
- `text_preview`
- `has_thinking` bool
- `provider`, `model`, `stop_reason`
- `usage_input`, `usage_output`, `usage_total`
- `message_ts`

4. `tool_spans`
- `id` bigserial PK
- `session_id`, `session_key`
- `tool_call_id` unique
- `event_id_call`, `event_id_result`
- `tool_name`
- `arguments_json` jsonb
- `result_json` jsonb
- `is_error` bool
- `started_at`, `finished_at`, `duration_ms`

5. `run_windows` (optional but useful)
- group events into assistant-run windows for easier UI timelines

Indexing:
- `(session_id, event_ts desc)`
- `(session_key, event_ts desc)`
- `(tool_name, started_at desc)`
- GIN on `arguments_json` / `result_json` if query-heavy

Retention:
- hot window (e.g., 30d) in primary tables
- optional archive table for long-term export

---

## 5) Collector design

New collector: `session_stream_collector`

Loop:
1. list candidate sessions (`openclaw sessions --json --active <N>` + newest)
2. for each transcript file:
   - seek from checkpoint
   - parse appended lines safely
   - upsert events/messages/tool spans
   - update checkpoint in same DB transaction batch
3. emit collector_state metrics

Failure safety:
- malformed line quarantine table + continue
- idempotency via unique constraints (`session_id,event_id`, `tool_call_id`)
- if file rotated/truncated: auto reset offset with audit warning

Cadence:
- baseline every 3-5s for near-live
- lower-frequency backfill pass (e.g., every 2-5 min)

---

## 6) Real-time UI plan

API additions:
- `GET /api/sessions/:sessionKey/timeline?cursor=...&limit=...`
- `GET /api/sessions/:sessionKey/tools?cursor=...&limit=...`
- `GET /api/live/overview` (aggregate quick stats)
- optional SSE: `GET /api/stream` for incremental push

UI additions:
1. Session Timeline view
   - chronological events
   - role color coding
   - expandable tool args/results

2. Tool Activity board
   - active tool spans
   - failures by tool
   - per-agent tool throughput

3. Run Inspector
   - one run/thread with parent-child event relationships

---

## 7) Security and privacy controls

Required controls before broad enablement:
- redact secrets in tool args/results at ingest boundary
- avoid storing full thinking payload content by default
- configurable payload depth:
  - `full` (debug)
  - `metadata_only` (default recommended)
- tenant/session scoping in API reads
- optional row-level policy if multi-tenant later

Suggested env flags:
- `MC_STREAM_CAPTURE_ENABLED=true`
- `MC_STREAM_CAPTURE_MODE=metadata_only|full`
- `MC_STREAM_REDACT_PATTERNS=...`
- `MC_STREAM_RETENTION_DAYS=30`

---

## 8) Delivery plan (phased)

### Phase A (1-2 days): foundations
- migration `003_event_stream.sql`
- transcript tail parser module
- checkpoints + idempotent upserts
- collector + tests for parse/idempotency/resume

### Phase B (1 day): read API
- timeline/tools endpoints
- pagination + cursors
- contract tests

### Phase C (1-2 days): UI
- Session Timeline page
- Tool spans panel
- mobile-friendly event cards

### Phase D (1 day): hardening
- redaction policy enforcement
- retention job
- performance tuning + indexes

---

## 9) Neon integration details

Neon setup strategy:
- Branches:
  - `main` (prod)
  - `mc-dev` (integration)
  - optional per-PR branches
- apply migrations via `DATABASE_URL_DIRECT`
- runtime reads/writes via pooled `DATABASE_URL`

Operational guardrails:
- run collector as hosted backend service (not laptop-bound)
- no tunnels in steady-state
- healthcheck endpoint should include stream lag metrics:
  - max ingestion lag seconds
  - events/min rate
  - parser error count

---

## 10) Risks and mitigations

1. High volume growth
- Mitigation: retention + partitioning + selective capture mode

2. Sensitive content leakage
- Mitigation: default metadata-only capture + redaction pipeline

3. Event schema drift across OpenClaw versions
- Mitigation: raw_json preservation + tolerant parser + schema version field

4. Duplicate/out-of-order events
- Mitigation: deterministic keys + idempotent constraints + watermark logic

---

## 11) Decision recommendation

Proceed with transcript-based stream ingestion as the primary implementation.

It satisfies the core requirement (agents unaware, background capture, granular logs) while fitting Mission Control’s existing read-only + collector architecture and Neon migration path.
