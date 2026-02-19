import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, withErrorBoundary } from './errors.js';
import type { Logger } from './logger.js';

const makeLogger = (errors: unknown[]): Logger => ({
  info: () => {},
  warn: () => {},
  debug: () => {},
  error: (_message, context) => {
    errors.push(context);
  }
});

const makeMockRes = () => {
  const headers = new Map<string, string>();
  let body = '';

  const res = {
    headersSent: false,
    statusCode: 0,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(chunk?: string) {
      if (chunk) {
        body += chunk;
      }
    }
  } as unknown as ServerResponse;

  return {
    res,
    headers,
    getBody: () => body
  };
};

test('withErrorBoundary maps HttpError to response body', async () => {
  const errors: unknown[] = [];
  const { res, headers, getBody } = makeMockRes();

  const handler = withErrorBoundary(async () => {
    throw new HttpError(418, 'teapot');
  }, makeLogger(errors));

  await handler({ method: 'GET', url: '/brew' } as IncomingMessage, res);

  assert.equal(res.statusCode, 418);
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(getBody()), { ok: false, error: 'teapot' });
  assert.equal(errors.length, 1);
});

test('withErrorBoundary maps generic errors to 500', async () => {
  const errors: unknown[] = [];
  const { res, getBody } = makeMockRes();

  const handler = withErrorBoundary(async () => {
    throw new Error('boom');
  }, makeLogger(errors));

  await handler({ method: 'POST', url: '/x' } as IncomingMessage, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(JSON.parse(getBody()), {
    ok: false,
    error: 'Internal server error'
  });
  assert.equal(errors.length, 1);
});
