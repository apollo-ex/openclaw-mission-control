import { once } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from './app.js';
import type { Logger } from './lib/logger.js';

test('app server serves /health and returns JSON 404 on unknown route', async (t) => {
  const errors: unknown[] = [];

  const log: Logger = {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: (_message, context) => {
      errors.push(context);
    }
  };

  const server = createAppServer(log);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => {
    server.close();
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to bind test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true, status: 'ok' });

  const missingResponse = await fetch(`${baseUrl}/missing`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), {
    ok: false,
    error: 'Route not found: GET /missing'
  });

  assert.equal(errors.length, 1);
});
