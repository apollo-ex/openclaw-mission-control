import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from './hash.js';

test('sha256 is deterministic and stable-length', () => {
  const a = sha256('mission-control');
  const b = sha256('mission-control');
  const c = sha256('different');

  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(a, c);
});
