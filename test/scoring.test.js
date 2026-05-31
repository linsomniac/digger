import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pookaScore,
  fygarScore,
  rockChainScore,
  veggieScore,
  extraLifeCount,
} from '../src/scoring.js';

test('pooka score scales with depth and clamps', () => {
  assert.equal(pookaScore(0), 200);
  assert.equal(pookaScore(3), 500);
  assert.equal(pookaScore(99), 500);
});

test('fygar score scales with depth and doubles when horizontal', () => {
  assert.equal(fygarScore(0, false), 400);
  assert.equal(fygarScore(3, false), 1000);
  assert.equal(fygarScore(0, true), 800);
  assert.equal(fygarScore(3, true), 2000);
});

test('rock chain score is 1-based and clamps', () => {
  assert.equal(rockChainScore(1), 1000);
  assert.equal(rockChainScore(3), 4000);
  assert.equal(rockChainScore(99), 15000);
  assert.equal(rockChainScore(0), 0);
});

test('veggie score by level index clamps', () => {
  assert.equal(veggieScore(0), 400);
  assert.equal(veggieScore(99), 8000);
});

test('extra-life count: first at 20k then every 60k', () => {
  assert.equal(extraLifeCount(19999), 0);
  assert.equal(extraLifeCount(20000), 1);
  assert.equal(extraLifeCount(79999), 1);
  assert.equal(extraLifeCount(80000), 2);
  assert.equal(extraLifeCount(140000), 3);
});
