// AIDEV-NOTE: Fygar fire must respect line-of-sight — it cannot pass through soil.
// It only arms with a clear tunnel to the player, and the live flame is clamped to
// stop at the first not-fully-dug block (so the visual + hitbox both stop there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, tileToPx } from '../src/grid.js';
import { Enemy } from '../src/enemies.js';
import { Dir, TILE, FIRE_RANGE_TILES } from '../src/constants.js';

const STEP = 1 / 60;
const level = { fireInterval: 2, ghostInterval: 999 };

function fygarAt(c, r) {
  const e = new Enemy('fygar', c, r, 60);
  e.state = 'normal';
  e.fireTimer = 999; // off cooldown
  return e;
}
function playerAt(c, r) {
  const p = tileToPx(c, r);
  return { x: p.x, y: p.y, alive: true };
}

test('a fygar will not breathe fire through a soil wall', () => {
  const g = new Grid(8, 5);
  // Tunnels at cols 2,3 (fygar side) and 5,6 (player side); col 4 stays SOLID.
  for (const c of [2, 3, 5, 6]) g.setSolid(c, 3, false);
  const e = fygarAt(2, 3);
  const player = playerAt(5, 3);
  assert.equal(e._maybeFire(g, player, level), false, 'no line of sight -> no fire');
  assert.equal(e.fireState, 'none');
});

test('a fygar breathes fire when it has a clear tunnel to the player', () => {
  const g = new Grid(8, 5);
  g.carveRect(2, 3, 4, 3); // clear tunnel cols 2..4 on row 3
  const e = fygarAt(2, 3);
  const player = playerAt(4, 3);
  assert.equal(e._maybeFire(g, player, level), true, 'clear line of sight -> fires');
  assert.equal(e.fireState, 'telegraph');
});

test('the flame stops at the first undug block', () => {
  const g = new Grid(8, 5);
  for (const c of [2, 3]) g.setSolid(c, 3, false); // one clear tile ahead, (4,3) solid
  const e = fygarAt(2, 3);
  e.fireState = 'active';
  e.fireLen = 0;
  e.fireDir = Dir.RIGHT;
  for (let i = 0; i < 30; i++) e._updateFire(STEP, g, []); // ~0.5s of breathing
  assert.equal(e.fireLen, TILE, 'flame clamped to the single clear tile, not through the wall');
});

test('an unobstructed flame reaches full range', () => {
  const g = new Grid(8, 5);
  g.carveRect(1, 3, 6, 3); // long clear corridor
  const e = fygarAt(2, 3);
  e.fireState = 'active';
  e.fireLen = 0;
  e.fireDir = Dir.RIGHT;
  for (let i = 0; i < 30; i++) e._updateFire(STEP, g, []);
  assert.equal(e.fireLen, FIRE_RANGE_TILES * TILE, 'full-range flame in an open tunnel');
});

test('digging the wall away mid-breath lets the flame extend', () => {
  const g = new Grid(8, 5);
  for (const c of [2, 3]) g.setSolid(c, 3, false); // (4,3) solid initially
  const e = fygarAt(2, 3);
  e.fireState = 'active';
  e.fireLen = 0;
  e.fireDir = Dir.RIGHT;
  for (let i = 0; i < 10; i++) e._updateFire(STEP, g, []);
  assert.equal(e.fireLen, TILE, 'short while the wall stands');
  g.setSolid(4, 3, false); // player digs through
  g.setSolid(5, 3, false);
  for (let i = 0; i < 30; i++) e._updateFire(STEP, g, []);
  assert.ok(e.fireLen > TILE, 'flame extends once the block is dug out');
});
