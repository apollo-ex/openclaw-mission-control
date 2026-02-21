import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';

test('loadConfig returns defaults when env vars are absent', () => {
  const config = loadConfig({} as NodeJS.ProcessEnv);

  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 4242);
  assert.equal(config.databaseUrl.startsWith('postgresql://'), true);
  assert.equal(config.databaseUrlDirect, config.databaseUrl);
  assert.equal(config.apiToken, null);
  assert.equal(config.hotIntervalMs, 10_000);
  assert.equal(config.warmIntervalMs, 120_000);
  assert.equal(config.collectorMaxRetries, 3);
  assert.equal(config.collectorBackoffBaseMs, 500);
  assert.equal(config.collectorBackoffMaxMs, 10_000);
  assert.equal(config.sessionActiveWindowMs, 900_000);
  assert.equal(config.sessionsListLimit, 500);
  assert.equal(config.workspaceRoot.startsWith('/'), true);
});

test('loadConfig parses explicit env overrides', () => {
  const config = loadConfig({
    HOST: '0.0.0.0',
    PORT: '8080',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/custom_db',
    DATABASE_URL_DIRECT: 'postgresql://postgres:postgres@localhost:5432/custom_db_direct',
    MISSION_CONTROL_API_TOKEN: 'token-123',
    OPENCLAW_WORKSPACE: './tmp/workspace',
    HOT_INTERVAL_MS: '2000',
    WARM_INTERVAL_MS: '9000',
    COLLECTOR_MAX_RETRIES: '5',
    COLLECTOR_BACKOFF_BASE_MS: '50',
    COLLECTOR_BACKOFF_MAX_MS: '500',
    SESSION_ACTIVE_WINDOW_MS: '600000',
    SESSIONS_LIST_LIMIT: '200'
  });

  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 8080);
  assert.equal(config.databaseUrl, 'postgresql://postgres:postgres@localhost:5432/custom_db');
  assert.equal(config.databaseUrlDirect, 'postgresql://postgres:postgres@localhost:5432/custom_db_direct');
  assert.equal(config.apiToken, 'token-123');
  assert.equal(config.hotIntervalMs, 2000);
  assert.equal(config.warmIntervalMs, 9000);
  assert.equal(config.collectorMaxRetries, 5);
  assert.equal(config.collectorBackoffBaseMs, 50);
  assert.equal(config.collectorBackoffMaxMs, 500);
  assert.equal(config.sessionActiveWindowMs, 600000);
  assert.equal(config.sessionsListLimit, 200);
  assert.equal(config.workspaceRoot, './tmp/workspace');
});

test('loadConfig resolves stage-specific DATABASE_URL fallback', () => {
  const config = loadConfig({
    MISSION_CONTROL_ENV: 'staging',
    DATABASE_URL_STAGING: 'postgresql://staging-user@localhost:5432/staging_db'
  });

  assert.equal(config.databaseUrl, 'postgresql://staging-user@localhost:5432/staging_db');
  assert.equal(config.databaseUrlDirect, 'postgresql://staging-user@localhost:5432/staging_db');
});

test('loadConfig uses DATABASE_URL_DIRECT as runtime fallback when DATABASE_URL is unset', () => {
  const config = loadConfig({
    DATABASE_URL_DIRECT: 'postgresql://direct-user@localhost:5432/direct_db'
  });

  assert.equal(config.databaseUrl, 'postgresql://direct-user@localhost:5432/direct_db');
  assert.equal(config.databaseUrlDirect, 'postgresql://direct-user@localhost:5432/direct_db');
});

test('loadConfig throws on invalid numeric env values', () => {
  assert.throws(() => loadConfig({ PORT: '0' }), /Invalid PORT/);
  assert.throws(() => loadConfig({ HOT_INTERVAL_MS: '-5' }), /Invalid HOT_INTERVAL_MS/);
  assert.throws(() => loadConfig({ COLLECTOR_BACKOFF_MAX_MS: 'nan' }), /Invalid COLLECTOR_BACKOFF_MAX_MS/);
});
