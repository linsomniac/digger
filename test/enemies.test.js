// AIDEV-NOTE: Round-start de-synchronization. Monsters should not all lurch the
// same way on frame 1. They wake up staggered (per-enemy startDelay) and the level
// generator seats a lone pocket occupant in the MIDDLE cell, so it is free to head
// either way toward the player instead of being forced against an end wall.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, tileToPx } from '../src/grid.js';
import { Enemy, EnemyField } from '../src/enemies.js';
import { getLevel } from '../src/levels.js';

const STEP = 1 / 60;
const calm = { fireInterval: 999, ghostInterval: 999 }; // no fire/ghost during the test

test('EnemyField staggers wake-up delays across the pack', () => {
  const defs = Array.from({ length: 5 }, () => ({ type: 'pooka', c: 1, r: 1 }));
  const ef = new EnemyField(defs, 60);
  const delays = ef.enemies.map((e) => e.startDelay);
  assert.ok(new Set(delays).size > 1, 'a spread of delays, not all identical');
  assert.ok(delays.some((d) => d === 0), 'at least one starts immediately');
  assert.ok(delays.some((d) => d > 0), 'at least one waits a beat');
});

test('a delayed enemy holds position until its wake-up delay elapses, then moves', () => {
  const g = new Grid(8, 4);
  g.carveRect(1, 2, 6, 2); // horizontal corridor on row 2
  const e = new Enemy('pooka', 2, 2, 60, 0, 0.3); // 0.3s wake-up delay
  const x0 = e.x;
  const pp = tileToPx(6, 2);
  const player = { x: pp.x, y: pp.y, alive: true };

  for (let i = 0; i < 15; i++) e.update(STEP, g, player, calm, () => 0, []); // 0.25s < 0.3s
  assert.equal(e.x, x0, 'stays put during the wake-up delay');

  for (let i = 0; i < 25; i++) e.update(STEP, g, player, calm, () => 0, []); // past the delay
  assert.ok(e.x > x0, 'moves toward the player once awake');
});

test('a lone pocket occupant starts in the middle cell, not jammed against an end', () => {
  const lv = getLevel(1);
  const holes = lv.carve.slice(2); // shaft + chamber are carve[0], carve[1]
  let checked = 0;
  for (const [c0, r0, c1, r1] of holes) {
    const lo = [Math.min(c0, c1), Math.min(r0, r1)];
    const hi = [Math.max(c0, c1), Math.max(r0, r1)];
    const mid = [Math.round((c0 + c1) / 2), Math.round((r0 + r1) / 2)];
    const inHole = lv.enemies.filter(
      (e) => e.c >= lo[0] && e.c <= hi[0] && e.r >= lo[1] && e.r <= hi[1],
    );
    if (inHole.length === 1) {
      assert.deepEqual([inHole[0].c, inHole[0].r], mid, 'lone occupant centred in its pocket');
      checked++;
    }
  }
  assert.ok(checked > 0, 'level 1 has single-occupant pockets to check');
});
