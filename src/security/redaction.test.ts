import test from 'node:test';
import assert from 'node:assert/strict';
import { redactText, shouldExcludePath } from './redaction.js';

test('redactText masks secret patterns', () => {
  const input = 'token=abc12345 and sk-abcdefghijklmnopqrstuvwxyz';
  const result = redactText(input, '/tmp/file.md');

  assert.equal(result.redacted, true);
  assert.equal(result.value.includes('[REDACTED]'), true);
});

test('redactText excludes sensitive paths', () => {
  const result = redactText('plain text', '/tmp/.env');
  assert.equal(result.redacted, true);
  assert.equal(result.value, '[REDACTED:EXCLUDED_PATH]');
  assert.deepEqual(result.indicators, ['path_excluded']);
});

test('redactText keeps non-secret text unchanged', () => {
  const result = redactText('hello world', '/tmp/notes.md');
  assert.equal(result.redacted, false);
  assert.equal(result.value, 'hello world');
  assert.deepEqual(result.indicators, []);
});

test('shouldExcludePath detects common secret file names', () => {
  assert.equal(shouldExcludePath('/tmp/.env'), true);
  assert.equal(shouldExcludePath('/tmp/id_rsa'), true);
  assert.equal(shouldExcludePath('/tmp/secrets.json'), true);
  assert.equal(shouldExcludePath('/tmp/regular.md'), false);
});
