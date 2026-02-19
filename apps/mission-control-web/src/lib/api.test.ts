import test from 'node:test';
import assert from 'node:assert/strict';
import { getOverview, resolveApiBaseUrl, resolveApiToken } from './api';

test('resolveApiBaseUrl defaults to localhost and trims trailing slash', () => {
  assert.equal(resolveApiBaseUrl({}), 'http://127.0.0.1:4242');
  assert.equal(resolveApiBaseUrl({ MISSION_CONTROL_API_BASE_URL: 'https://example.com/' }), 'https://example.com');
});

test('resolveApiToken returns null when unset', () => {
  assert.equal(resolveApiToken({}), null);
  assert.equal(resolveApiToken({ MISSION_CONTROL_API_TOKEN: 'abc' }), 'abc');
});

test('getOverview fetches read-only overview payload', async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    assert.equal(String(input), 'https://api.example.com/api/overview');
    assert.equal(init?.method, 'GET');
    assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer token-123');

    return new Response(
      JSON.stringify({
        ok: true,
        apiVersion: 'v1',
        generatedAt: new Date().toISOString(),
        readOnly: true,
        summary: {
          agents: 1,
          sessions: 1,
          activeSessions: 1,
          memoryDocs: 1,
          cronJobs: 1,
          cronRuns: 1,
          collectorErrors: 0,
          staleCollectors: 0,
          latestStatus: 'ok'
        }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const originalBaseUrl = process.env.MISSION_CONTROL_API_BASE_URL;
  const originalToken = process.env.MISSION_CONTROL_API_TOKEN;

  process.env.MISSION_CONTROL_API_BASE_URL = 'https://api.example.com';
  process.env.MISSION_CONTROL_API_TOKEN = 'token-123';

  t.after(() => {
    process.env.MISSION_CONTROL_API_BASE_URL = originalBaseUrl;
    process.env.MISSION_CONTROL_API_TOKEN = originalToken;
  });

  const payload = await getOverview();
  assert.equal(payload.readOnly, true);
  assert.equal(payload.summary.latestStatus, 'ok');
});
