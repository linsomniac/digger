import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Grid,
  tileToPx,
  pxToTile,
  isAlignedToCol,
  isAlignedToRow,
} from '../src/grid.js';
import { TILE } from '../src/constants.js';

test('new grid is all solid', () => {
  const g = new Grid(4, 3);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 4; c++) assert.equal(g.isSolid(c, r), true);
});

test('dig clears a cell and reports whether it was solid', () => {
  const g = new Grid(4, 3);
  assert.equal(g.dig(1, 1), true); // was solid
  assert.equal(g.dig(1, 1), false); // already empty
  assert.equal(g.isTunnel(1, 1), true);
  assert.equal(g.isSolid(1, 1), false);
});

test('out-of-bounds reads as solid (walls/floor)', () => {
  const g = new Grid(4, 3);
  assert.equal(g.isSolid(-1, 0), true);
  assert.equal(g.isSolid(0, -1), true);
  assert.equal(g.isSolid(4, 0), true);
  assert.equal(g.isSolid(0, 3), true);
  assert.equal(g.isTunnel(-1, 0), false);
});

test('layerAt maps rows to 4 depth bands', () => {
  const g = new Grid();
  const expected = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  for (let r = 0; r < 12; r++) assert.equal(g.layerAt(r), expected[r]);
  assert.equal(g.layerAt(99), 3); // clamps
});

test('carveRect clears an inclusive rectangle', () => {
  const g = new Grid(6, 6);
  g.carveRect(1, 1, 3, 2);
  for (let r = 1; r <= 2; r++)
    for (let c = 1; c <= 3; c++) assert.equal(g.isTunnel(c, r), true);
  assert.equal(g.isSolid(0, 1), true);
  assert.equal(g.isSolid(4, 1), true);
  assert.equal(g.isSolid(1, 3), true);
});

test('px<->tile round-trips on a cell center', () => {
  const p = tileToPx(3, 5);
  assert.equal(p.x, 3 * TILE + TILE / 2);
  assert.equal(p.y, 5 * TILE + TILE / 2);
  const t = pxToTile(p.x, p.y);
  assert.deepEqual(t, { c: 3, r: 5 });
});

test('alignment helpers detect cell centers', () => {
  const p = tileToPx(2, 4);
  assert.equal(isAlignedToCol(p.x), true);
  assert.equal(isAlignedToRow(p.y), true);
  assert.equal(isAlignedToCol(p.x + 5), false);
  assert.equal(isAlignedToRow(p.y - 5), false);
});
