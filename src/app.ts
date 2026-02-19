import crypto from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { DbExecutor } from './db/types.js';
import { getContractResponse, readAgents, readCron, readHealth, readMemory, readOverview } from './api/read-model.js';
import { withErrorBoundary, HttpError } from './lib/errors.js';
import { sendJson } from './lib/http.js';
import type { Logger } from './lib/logger.js';

const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const readHeader = (value: string | string[] | undefined): string | null => {
  if (!value) {
    return null;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
};

const getProvidedToken = (req: IncomingMessage): string | null => {
  const authHeader = readHeader(req.headers.authorization);
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const bearerToken = authHeader.slice('bearer '.length).trim();
    if (bearerToken) {
      return bearerToken;
    }
  }

  return readHeader(req.headers['x-mission-control-token']);
};

const isAuthorized = (req: IncomingMessage, expectedToken: string | null): boolean => {
  if (!expectedToken) {
    return true;
  }

  const providedToken = getProvidedToken(req);
  if (!providedToken) {
    return false;
  }

  return timingSafeEqual(providedToken, expectedToken);
};

const routeRequest =
  (db: DbExecutor, apiToken: string | null) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method || 'GET';
    const requestUrl = req.url || '/';
    const pathname = new URL(requestUrl, 'http://127.0.0.1').pathname;

    if (pathname.startsWith('/api/') && !isAuthorized(req, apiToken)) {
      throw new HttpError(401, 'Unauthorized');
    }

    if (method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, status: 'ok' });
      return;
    }

    if (method === 'GET' && pathname === '/api/contracts') {
      sendJson(res, 200, getContractResponse());
      return;
    }

    if (method === 'GET' && pathname === '/api/overview') {
      sendJson(res, 200, await readOverview(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/agents') {
      sendJson(res, 200, await readAgents(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/memory') {
      sendJson(res, 200, await readMemory(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/cron') {
      sendJson(res, 200, await readCron(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, await readHealth(db));
      return;
    }

    throw new HttpError(404, `Route not found: ${method} ${pathname}`);
  };

export const createAppServer = (logger: Logger, db: DbExecutor, apiToken: string | null) => {
  return createServer((req, res) => {
    const handler = withErrorBoundary(routeRequest(db, apiToken), logger);
    void handler(req, res);
  });
};
