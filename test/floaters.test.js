// AIDEV-NOTE: Floating score popups — rise, fade, expire, and are spawned by the
// scoring sites (pump pop, rock crush, veggie pickup) at the spot it happened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Floaters, floaterAlpha } from '../src/floaters.js';
import { Game } from '../src/game.js';

const audio = { muted: false, sfx() {}, setMoving() {}, toggleMute() { return true; } };

test('add records a popup at a position with its score as text', () => {
  const f = new Floaters();
  f.add(100, 50, 200);
  assert.equal(f.list.length, 1);
  assert.equal(f.list[0].text, '200', 'score coerced to a string');
  assert.deepEqual([f.list[0].x, f.list[0].y], [100, 50]);
});

test('a popup floats upward and expires after its lifetime', () => {
  const f = new Floaters();
  f.add(10, 100, 500);
  const y0 = f.list[0].y;
  for (let i = 0; i < 10; i++) f.update(1 / 60);
  assert.equal(f.list.length, 1, 'still alive shortly after');
  assert.ok(f.list[0].y < y0, 'drifts upward (y decreases)');
  for (let i = 0; i < 60; i++) f.update(1 / 60); // ~1s more, past its life
  assert.equal(f.list.length, 0, 'removed once its life elapses');
});

test('floaterAlpha is opaque early, then fades to zero', () => {
  assert.equal(floaterAlpha(0, 1), 1, 'full at birth');
  assert.equal(floaterAlpha(0.5, 1), 1, 'still full mid-life');
  const late = floaterAlpha(0.8, 1);
  assert.ok(late > 0 && late < 1, 'fading near the end');
  assert.equal(floaterAlpha(1, 1), 0, 'gone at the end');
});

test('the popup list is bounded so a long chain cannot grow it unbounded', () => {
  const f = new Floaters();
  for (let i = 0; i < 100; i++) f.add(i, i, i);
  assert.ok(f.list.length <= 40, 'capped');
});

test('scoring a pop or a rock crush spawns a floater where it happened', () => {
  const g = new Game(audio);
  g.loadLevel(1);
  assert.equal(g.floaters.list.length, 0, 'starts clean');

  g.handleEvents([{ type: 'pop', enemy: { type: 'pooka', x: 120, y: 80 }, layer: 0, horizontal: false }]);
  g.handleEvents([{ type: 'crush', entity: { x: 200, y: 160, state: 'normal' }, chainIndex: 1 }]);

  assert.equal(g.floaters.list.length, 2, 'one floater per scoring hit');
  assert.ok(g.floaters.list.some((fl) => fl.x === 120 && fl.y === 80), 'pop floater at the kill spot');
  assert.ok(g.floaters.list.some((fl) => fl.x === 200 && fl.y === 160), 'crush floater at the kill spot');
  assert.ok(g.floaters.list.every((fl) => Number(fl.text) > 0), 'shows a positive score');
});
