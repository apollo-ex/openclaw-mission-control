import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { withErrorBoundary, HttpError } from './lib/errors.js';
import { sendJson } from './lib/http.js';
import type { Logger } from './lib/logger.js';

const routeRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const method = req.method || 'GET';
  const url = req.url || '/';

  if (method === 'GET' && url === '/health') {
    sendJson(res, 200, { ok: true, status: 'ok' });
    return;
  }

  throw new HttpError(404, `Route not found: ${method} ${url}`);
};

export const createAppServer = (logger: Logger) => {
  return createServer((req, res) => {
    const handler = withErrorBoundary(routeRequest, logger);
    void handler(req, res);
  });
};
