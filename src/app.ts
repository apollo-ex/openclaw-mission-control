import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { getContractResponse, readAgents, readCron, readHealth, readMemory, readOverview } from './api/read-model.js';
import { withErrorBoundary, HttpError } from './lib/errors.js';
import { sendJson } from './lib/http.js';
import type { Logger } from './lib/logger.js';

const routeRequest =
  (db: DatabaseSync) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method || 'GET';
    const requestUrl = req.url || '/';
    const pathname = new URL(requestUrl, 'http://127.0.0.1').pathname;

    if (method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { ok: true, status: 'ok' });
      return;
    }

    if (method === 'GET' && pathname === '/api/contracts') {
      sendJson(res, 200, getContractResponse());
      return;
    }

    if (method === 'GET' && pathname === '/api/overview') {
      sendJson(res, 200, readOverview(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/agents') {
      sendJson(res, 200, readAgents(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/memory') {
      sendJson(res, 200, readMemory(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/cron') {
      sendJson(res, 200, readCron(db));
      return;
    }

    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, readHealth(db));
      return;
    }

    throw new HttpError(404, `Route not found: ${method} ${pathname}`);
  };

export const createAppServer = (logger: Logger, db: DatabaseSync) => {
  return createServer((req, res) => {
    const handler = withErrorBoundary(routeRequest(db), logger);
    void handler(req, res);
  });
};
