// AIDEV-NOTE: Pump behavior — each discrete press = one inflation stage; HOLDING
// the button must NOT auto-repeat. Stop tapping -> the enemy deflates and frees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid, tileToPx } from '../src/grid.js';
import { Pump } from '../src/pump.js';
import { Enemy } from '../src/enemies.js';
import { Dir, INFLATE_DEFLATE_SEC } from '../src/constants.js';

const STEP = 1 / 60;

function setup() {
  const g = new Grid(8, 5);
  g.carveRect(0, 2, 7, 2); // horizontal tunnel at row 2
  const pp = tileToPx(2, 2);
  const player = { x: pp.x, y: pp.y, facing: Dir.RIGHT, alive: true };
  const ep = tileToPx(3, 2); // one tile right, within harpoon reach
  const e = new Enemy('pooka', 3, 2, 60);
  e.x = ep.x;
  e.y = ep.y;
  e.state = 'normal';
  return { g, player, e };
}

test('holding the button does NOT auto-inflate — a single press is a single pump', () => {
  const { g, player, e } = setup();
  const pump = new Pump();
  pump.fire(player, g);
  // Hold for 0.6s (under the deflate grace) with no further presses.
  const frames = Math.ceil(0.6 / STEP);
  for (let i = 0; i < frames; i++) pump.update(STEP, g, player, [e], []);
  assert.equal(e.state, 'hooked', 'the stab connected');
  assert.equal(e.inflate, 1, 'exactly one pump from the stab — holding never adds more');
});

test('each discrete press inflates one stage and pops at MAX_INFLATE', () => {
  const { g, player, e } = setup();
  const pump = new Pump();
  pump.fire(player, g);
  for (let i = 0; i < 6; i++) pump.update(STEP, g, player, [e], []); // let it hook
  assert.equal(e.state, 'hooked');
  assert.equal(e.inflate, 1, 'stab counts as the first pump');

  const events = [];
  let guard = 0;
  while (e.state === 'hooked' && guard++ < 20) {
    pump.pumpPress(g, events); // a tap
    pump.update(STEP, g, player, [e], events); // one frame between taps
  }
  assert.equal(e.state, 'dead', 'repeated taps eventually pop it');
  assert.ok(events.some((ev) => ev.type === 'pop'), 'a pop event was emitted');
});

test('a hooked enemy deflates and is freed when the player stops tapping', () => {
  const { g, player, e } = setup();
  const pump = new Pump();
  pump.fire(player, g);
  for (let i = 0; i < 6; i++) pump.update(STEP, g, player, [e], []);
  pump.pumpPress(g, []); // -> inflate 2
  assert.ok(e.inflate >= 2);

  const frames = Math.ceil((INFLATE_DEFLATE_SEC * (e.inflate + 1)) / STEP);
  for (let i = 0; i < frames; i++) pump.update(STEP, g, player, [e], []);
  assert.equal(e.inflate, 0, 'fully deflated');
  assert.equal(pump.active, false, 'harpoon retracted');
  assert.equal(e.state, 'normal', 'enemy freed');
});
