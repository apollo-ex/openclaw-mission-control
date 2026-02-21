CREATE TABLE IF NOT EXISTS session_stream_offsets (
  session_id TEXT PRIMARY KEY,
  session_key TEXT,
  transcript_path TEXT NOT NULL,
  last_byte_offset BIGINT NOT NULL DEFAULT 0,
  last_line_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  session_key TEXT,
  event_id TEXT NOT NULL,
  parent_event_id TEXT,
  event_type TEXT NOT NULL,
  event_ts TIMESTAMPTZ NOT NULL,
  source_line BIGINT,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_ts ON session_events(session_id, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_session_events_session_key_ts ON session_events(session_key, event_ts DESC);

CREATE TABLE IF NOT EXISTS session_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  session_key TEXT,
  event_id TEXT NOT NULL,
  role TEXT NOT NULL,
  message_ts TIMESTAMPTZ NOT NULL,
  text_preview TEXT,
  provider TEXT,
  model TEXT,
  stop_reason TEXT,
  usage_input INTEGER,
  usage_output INTEGER,
  usage_total INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session_ts ON session_messages(session_id, message_ts DESC);
CREATE INDEX IF NOT EXISTS idx_session_messages_session_key_ts ON session_messages(session_key, message_ts DESC);

CREATE TABLE IF NOT EXISTS tool_spans (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  session_key TEXT,
  tool_call_id TEXT NOT NULL,
  event_id_call TEXT,
  event_id_result TEXT,
  tool_name TEXT,
  arguments_json JSONB,
  result_json JSONB,
  is_error BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, tool_call_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_spans_session_started ON tool_spans(session_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_spans_tool_started ON tool_spans(tool_name, started_at DESC);
