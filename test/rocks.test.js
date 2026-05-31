import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid.js';
import { isSupported, fallTargetRow } from '../src/rocks.js';

test('rock is supported by solid soil below', () => {
  const g = new Grid(5, 5); // all solid
  g.carveCells([[2, 1]]); // tunnel where the rock sits
  assert.equal(isSupported(g, 2, 1, new Set()), true); // (2,2) still solid
});

test('rock is unsupported when the cell below is empty', () => {
  const g = new Grid(5, 5);
  g.carveCells([
    [2, 1],
    [2, 2],
  ]);
  assert.equal(isSupported(g, 2, 1, new Set()), false);
});

test('rock at the bottom row is supported by the floor', () => {
  const g = new Grid(5, 5);
  g.carveCells([[2, 4]]);
  assert.equal(isSupported(g, 2, 4, new Set()), true); // (2,5) out of bounds = floor
});

test('rock is supported by another resting rock below', () => {
  const g = new Grid(5, 5);
  g.carveCells([
    [2, 1],
    [2, 2],
  ]);
  const occupied = new Set(['2,2']);
  assert.equal(isSupported(g, 2, 1, occupied), true);
});

test('fallTargetRow stops above the first solid cell', () => {
  const g = new Grid(5, 6);
  g.carveCells([
    [2, 1],
    [2, 2],
    [2, 3],
  ]); // empty 1..3, solid at 4
  assert.equal(fallTargetRow(g, 2, 1, new Set()), 3);
});

test('fallTargetRow stops above a resting rock', () => {
  const g = new Grid(5, 6);
  g.carveCells([
    [2, 1],
    [2, 2],
    [2, 3],
  ]);
  assert.equal(fallTargetRow(g, 2, 1, new Set(['2,3'])), 2);
});
