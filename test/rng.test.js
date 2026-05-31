// AIDEV-NOTE: The seeded PRNG must be deterministic (same seed -> same stream)
// and well-distributed enough that different seeds diverge. levels.js leans on
// this for reproducible-per-level layouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, shuffle } from '../src/rng.js';

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 50; i++) assert.equal(a(), b(), 'same seed -> identical stream');
});

test('different seeds produce different streams', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let same = 0;
  for (let i = 0; i < 50; i++) if (a() === b()) same++;
  assert.ok(same < 3, 'distinct seeds should rarely coincide');
});

test('randInt stays within the inclusive range and hits both ends', () => {
  const rng = mulberry32(99);
  let lo = false;
  let hi = false;
  for (let i = 0; i < 2000; i++) {
    const v = randInt(rng, 4, 6);
    assert.ok(v >= 4 && v <= 6, 'within [4,6]');
    if (v === 4) lo = true;
    if (v === 6) hi = true;
  }
  assert.ok(lo && hi, 'covers both endpoints over many draws');
});

test('shuffle is a deterministic permutation for a given seed', () => {
  const base = Array.from({ length: 20 }, (_, i) => i);
  const a = shuffle(base.slice(), mulberry32(7));
  const b = shuffle(base.slice(), mulberry32(7));
  assert.deepEqual(a, b, 'same seed -> same permutation');
  assert.deepEqual([...a].sort((x, y) => x - y), base, 'is a permutation (no loss)');
  assert.notDeepEqual(a, base, 'actually reorders');
});
