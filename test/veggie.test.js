import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSpawnVeggie, veggieTypeForLevel, Veggie } from '../src/veggie.js';

test('veggie spawns only after two rocks have fallen, once', () => {
  assert.equal(shouldSpawnVeggie(0, false), false);
  assert.equal(shouldSpawnVeggie(1, false), false);
  assert.equal(shouldSpawnVeggie(2, false), true);
  assert.equal(shouldSpawnVeggie(2, true), false); // already spawned
  assert.equal(shouldSpawnVeggie(5, true), false);
});

test('veggie type advances by level and clamps', () => {
  assert.equal(veggieTypeForLevel(0), 'carrot');
  assert.equal(veggieTypeForLevel(1), 'turnip');
  assert.equal(veggieTypeForLevel(999), 'star');
});

test('veggie expires when its ttl runs out', () => {
  const v = new Veggie(10, 20, 'carrot', 400, 1);
  v.update(0.5);
  assert.equal(v.alive, true);
  v.update(0.6);
  assert.equal(v.alive, false);
});
