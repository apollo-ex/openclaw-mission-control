import test from 'node:test';
import assert from 'node:assert/strict';
import { CadenceProfile } from './cadence.js';

test('CadenceProfile.hot and warm construct expected kinds', () => {
  const hot = CadenceProfile.hot(1000);
  const warm = CadenceProfile.warm(30000);

  assert.equal(hot.kind, 'hot');
  assert.equal(hot.intervalMs, 1000);
  assert.equal(warm.kind, 'warm');
  assert.equal(warm.intervalMs, 30000);
});
