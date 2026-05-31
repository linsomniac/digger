// AIDEV-NOTE: Tests for the two added mechanics: (1) holding a rock up by digging
// up beneath it, and (2) a pumped enemy staying frozen then deflating after the
// player runs away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, tileToPx, pxToTile } from '../src/grid.js';
import { RockField } from '../src/rocks.js';
import { Enemy } from '../src/enemies.js';
import { ROCK_WOBBLE_SEC, INFLATE_RELEASE_SEC, PLAYER_SPEED, Dir } from '../src/constants.js';

const STEP = 1 / 60;

test('a rock is held while the player digs up beneath it', () => {
  const g = new Grid(6, 8);
  const rf = new RockField([[3, 3]]); // rock at (3,3)
  g.carveCells([[3, 4]]); // empty cell below -> unsupported

  const p = tileToPx(3, 4); // player directly below the rock
  const player = { x: p.x, y: p.y, alive: true };

  // Hold for well past the normal wobble->fall time.
  const frames = Math.ceil((ROCK_WOBBLE_SEC + 1) / STEP);
  for (let i = 0; i < frames; i++) rf.update(STEP, g, [player], player, true);

  assert.equal(rf.rocks[0].state, 'wobble', 'unsupported but propped, not fallen');
  assert.equal(rf.rocks[0].held, true, 'flagged as held');
  assert.ok(rf.rocks[0].state !== 'falling', 'a held rock never falls');
});

test('a rock falls shortly after the player stops digging up', () => {
  const g = new Grid(6, 8);
  const rf = new RockField([[3, 3]]);
  g.carveCells([[3, 4]]);
  const p = tileToPx(3, 4);
  const player = { x: p.x, y: p.y, alive: true };

  // Hold briefly...
  for (let i = 0; i < 20; i++) rf.update(STEP, g, [player], player, true);
  assert.notEqual(rf.rocks[0].state, 'falling');

  // ...then release (stop digging up). It should begin falling within wobble time.
  let fell = false;
  const frames = Math.ceil((ROCK_WOBBLE_SEC + 0.5) / STEP);
  for (let i = 0; i < frames; i++) {
    rf.update(STEP, g, [player], player, false);
    if (rf.rocks[0] && rf.rocks[0].state === 'falling') fell = true;
  }
  assert.ok(fell, 'rock starts falling after the player stops holding it');
});

test('restingCells lists suspended rocks so the player is blocked', () => {
  const g = new Grid(6, 8);
  const rf = new RockField([[3, 3]]);
  const cells = rf.restingCells();
  assert.ok(cells.has('3,3'), 'a resting rock blocks its cell');
});

test('a player walking horizontally under a rock clears it before it drops', () => {
  // Player tunnel along row 3, but (5,3) starts as soil so walking into it both
  // digs it AND undermines the rock at (5,2) directly above — the exact case the
  // player reported being squished in. The fuse must outlast the walk-through.
  const g = new Grid(12, 6);
  for (let c = 0; c < 12; c++) if (c !== 5) g.setSolid(c, 3, false);
  const rf = new RockField([[5, 2]]);

  const start = tileToPx(1, 3);
  const player = { x: start.x, y: start.y, alive: true };
  const STEP = 1 / 60;
  let undermined = false;
  let crushed = false;

  for (let i = 0; i < 1200; i++) {
    player.x += PLAYER_SPEED * STEP;
    const c = pxToTile(player.x, player.y).c;
    // Mimic stepEntity digging the cell ahead: as the player reaches col 4 they
    // carve (5,3), undermining the rock (conservative — earlier than real play).
    if (!undermined && c >= 4) {
      g.setSolid(5, 3, false);
      undermined = true;
    }
    for (const ev of rf.update(STEP, g, [player], player, false)) {
      if (ev.type === 'crush' && ev.entity === player) crushed = true;
    }
    if (player.x > tileToPx(11, 3).x) break;
  }

  assert.equal(undermined, true, 'sanity: the rock was undermined mid-walk');
  assert.equal(crushed, false, 'a moving player is not squished walking under it');
});

test('a released, still-inflated enemy stays frozen then deflates to normal', () => {
  const g = new Grid(8, 8);
  g.carveRect(0, 3, 7, 3); // a clear corridor along row 3
  const e = new Enemy('pooka', 2, 3, 60);
  e.state = 'normal'; // as left by pump.cancel()
  e.inflate = 2; // pumped twice before the player ran
  e.deflateT = 0;

  const x0 = e.x;
  const player = { x: tileToPx(6, 3).x, y: tileToPx(6, 3).y, alive: true };
  const level = { ghostInterval: 999, fireInterval: 999 };
  const rng = () => 0;

  // Inflated => frozen and harmless.
  for (let i = 0; i < 10; i++) e.update(STEP, g, player, level, rng, []);
  assert.equal(e.x, x0, 'does not move while inflated');
  assert.ok(e.inflate > 0, 'still inflated a moment after release');
  assert.equal(e.lethal(), false, 'inflated enemy is not lethal to touch');

  // After ~2 release stages it should be fully deflated and dangerous again.
  const frames = Math.ceil((INFLATE_RELEASE_SEC * 2 + 0.1) / STEP);
  for (let i = 0; i < frames; i++) e.update(STEP, g, player, level, rng, []);
  assert.equal(e.inflate, 0, 'fully deflated');
  assert.equal(e.lethal(), true, 'lethal again once back to normal');
});
