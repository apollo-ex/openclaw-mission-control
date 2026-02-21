import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionControlApi } from './api';
import { resolveDatabaseUrl } from './db';
import type { QueryExecutor } from './read-model';

test('resolveDatabaseUrl requires DATABASE_URL', () => {
  assert.equal(resolveDatabaseUrl({ DATABASE_URL: ' postgresql://example.neon.tech/db ' }), 'postgresql://example.neon.tech/db');
  assert.throws(() => resolveDatabaseUrl({}), /DATABASE_URL is required/);
});

test('getOverview reads from DB and ignores legacy API bridge env', async (t) => {
  const db: QueryExecutor = {
    query: async <R extends Record<string, unknown>>(text: string) => {
      if (text.includes("FROM sessions WHERE status = 'active'")) return { rows: [{ count: '5' }] as unknown as R[] };
      if (text.includes('FROM collector_state WHERE error_count > 0')) return { rows: [{ count: '1' }] as unknown as R[] };
      if (text.includes('FROM collector_state WHERE stale = TRUE')) return { rows: [{ count: '2' }] as unknown as R[] };
      if (text.includes('FROM agents')) return { rows: [{ count: '9' }] as unknown as R[] };
      if (text.includes('FROM sessions')) return { rows: [{ count: '17' }] as unknown as R[] };
      if (text.includes('FROM memory_docs')) return { rows: [{ count: '31' }] as unknown as R[] };
      if (text.includes('FROM cron_jobs')) return { rows: [{ count: '3' }] as unknown as R[] };
      if (text.includes('FROM cron_runs')) return { rows: [{ count: '11' }] as unknown as R[] };
      if (text.includes('SELECT openclaw_status FROM health_samples')) return { rows: [{ openclaw_status: 'ok' }] as unknown as R[] };
      throw new Error(`Unexpected query: ${text}`);
    }
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('fetch should not be called for DB-backed reads');
  }) as typeof fetch;

  const originalBridge = process.env.MISSION_CONTROL_API_BASE_URL;
  process.env.MISSION_CONTROL_API_BASE_URL = 'https://deprecated-bridge.example.com';

  t.after(() => {
    globalThis.fetch = originalFetch;
    process.env.MISSION_CONTROL_API_BASE_URL = originalBridge;
  });

  const api = createMissionControlApi(db);
  const payload = await api.getOverview();

  assert.equal(payload.readOnly, true);
  assert.equal(payload.summary.agents, 9);
  assert.equal(payload.summary.activeSessions, 5);
  assert.equal(payload.summary.latestStatus, 'ok');
});

test('getAgents keeps active sessions and subagent runType visibility', async () => {
  const db: QueryExecutor = {
    query: async <R extends Record<string, unknown>>(text: string) => {
      if (text.includes('FROM agents')) {
        return {
          rows: [
            {
              agent_id: 'local-observer',
              role: 'observer',
              configured: true,
              updated_at: '2026-02-20T20:00:00.000Z'
            }
          ] as unknown as R[]
        };
      }

      if (text.includes('FROM sessions')) {
        return {
          rows: [
            {
              session_key: 'session-main',
              session_id: 'sid-main',
              label: 'Main Session',
              status: 'active',
              started_at: '2026-02-20T19:59:00.000Z',
              ended_at: null,
              runtime_ms: 15_000,
              model: 'gpt-5.3-codex',
              agent_id: 'local-observer',
              session_kind: 'direct',
              run_type: 'subagent',
              last_update_at: '2026-02-20T20:00:00.000Z',
              updated_at: '2026-02-20T20:00:00.000Z'
            }
          ] as unknown as R[]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  };

  const api = createMissionControlApi(db);
  const payload = await api.getAgents();

  assert.equal(payload.activeSessions, 1);
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.sessions[0]?.runType, 'subagent');
  assert.equal(payload.sessions[0]?.status, 'active');
  assert.equal(typeof payload.sessions[0]?.elapsedMs, 'number');
});

test('DB errors fall back to safe read-only payloads', async () => {
  const db: QueryExecutor = {
    query: async () => {
      throw new Error('db unavailable');
    }
  };

  const api = createMissionControlApi(db);
  const payload = await api.getHealth();

  assert.equal(payload.readOnly, true);
  assert.equal(payload.latest, null);
  assert.deepEqual(payload.collectors, []);
});
