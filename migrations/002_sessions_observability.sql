ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS session_kind TEXT,
  ADD COLUMN IF NOT EXISTS run_type TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_update_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_update_at ON sessions(last_update_at DESC);
