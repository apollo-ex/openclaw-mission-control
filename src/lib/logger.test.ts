import test from 'node:test';
import assert from 'node:assert/strict';
import { logger } from './logger.js';

test('logger methods are callable', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];

  console.log = (value?: unknown) => {
    logs.push(String(value));
  };
  console.warn = (value?: unknown) => {
    warns.push(String(value));
  };
  console.error = (value?: unknown) => {
    errors.push(String(value));
  };

  try {
    logger.info('info_message', { a: 1 });
    logger.warn('warn_message');
    logger.debug('debug_message');
    logger.error('error_message');
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  assert.equal(logs.length, 2);
  assert.equal(warns.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(logs[0]?.includes('info_message'), true);
  assert.equal(warns[0]?.includes('warn_message'), true);
  assert.equal(errors[0]?.includes('error_message'), true);
});
