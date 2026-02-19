import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';

test('loadConfig returns defaults when env vars are absent', () => {
  const config = loadConfig({} as NodeJS.ProcessEnv);

  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 4242);
  assert.equal(config.databaseUrl.startsWith('postgresql://'), true);
  assert.equal(config.apiToken, null);
  assert.equal(config.hotIntervalMs, 10_000);
  assert.equal(config.warmIntervalMs, 120_000);
  assert.equal(config.collectorMaxRetries, 3);
  assert.equal(config.collectorBackoffBaseMs, 500);
  assert.equal(config.collectorBackoffMaxMs, 10_000);
  assert.equal(config.workspaceRoot.startsWith('/'), true);
});

test('loadConfig parses explicit env overrides', () => {
  const config = loadConfig({
    HOST: '0.0.0.0',
    PORT: '8080',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/custom_db',
    MISSION_CONTROL_API_TOKEN: 'token-123',
    OPENCLAW_WORKSPACE: './tmp/workspace',
    HOT_INTERVAL_MS: '2000',
    WARM_INTERVAL_MS: '9000',
    COLLECTOR_MAX_RETRIES: '5',
    COLLECTOR_BACKOFF_BASE_MS: '50',
    COLLECTOR_BACKOFF_MAX_MS: '500'
  });

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 8080);
  assert.equal(config.databaseUrl, 'postgresql://postgres:postgres@localhost:5432/custom_db');
  assert.equal(config.apiToken, 'token-123');
  assert.equal(config.hotIntervalMs, 2000);
  assert.equal(config.warmIntervalMs, 9000);
  assert.equal(config.collectorMaxRetries, 5);
  assert.equal(config.collectorBackoffBaseMs, 50);
  assert.equal(config.collectorBackoffMaxMs, 500);
  assert.equal(config.workspaceRoot, './tmp/workspace');
});

test('loadConfig throws on invalid numeric env values', () => {
  assert.throws(() => loadConfig({ PORT: '0' }), /Invalid PORT/);
  assert.throws(() => loadConfig({ HOT_INTERVAL_MS: '-5' }), /Invalid HOT_INTERVAL_MS/);
  assert.throws(() => loadConfig({ COLLECTOR_BACKOFF_MAX_MS: 'nan' }), /Invalid COLLECTOR_BACKOFF_MAX_MS/);
});
