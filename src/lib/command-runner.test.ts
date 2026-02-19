import test from 'node:test';
import assert from 'node:assert/strict';
import { shellCommandRunner } from './command-runner.js';

test('shellCommandRunner returns stdout/stderr on success', async () => {
  const result = await shellCommandRunner('node', ['-e', 'process.stdout.write("ok\\n"); process.stderr.write("warn\\n");']);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'ok');
  assert.equal(result.stderr, 'warn');
});

test('shellCommandRunner captures non-zero exits', async () => {
  const result = await shellCommandRunner('node', ['-e', 'process.stdout.write("partial\\n"); process.stderr.write("boom\\n"); process.exit(3);']);

  assert.equal(result.exitCode, 3);
  assert.equal(result.stdout, 'partial');
  assert.equal(result.stderr, 'boom');
});
