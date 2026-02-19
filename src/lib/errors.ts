import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from './logger.js';

export class HttpError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type AsyncHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

export const withErrorBoundary = (handler: AsyncHandler, log: Logger): AsyncHandler => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const isHttpError = error instanceof HttpError;
      const statusCode = isHttpError ? error.statusCode : 500;
      const message = isHttpError ? error.message : 'Internal server error';

      log.error('request_failed', {
        method: req.method,
        url: req.url,
        statusCode,
        error: error instanceof Error ? error.message : String(error)
      });

      if (!res.headersSent) {
        res.statusCode = statusCode;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: message }));
      }
    }
  };
};
