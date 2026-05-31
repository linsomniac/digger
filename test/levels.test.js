import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/levels.js';
import { COLS, ROWS } from '../src/constants.js';

function inBounds([c, r]) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

test('level 1 is well-formed', () => {
  const lv = getLevel(1);
  assert.equal(lv.index, 1);
  assert.ok(inBounds(lv.playerStart), 'player start in bounds');
  assert.ok(lv.enemies.length >= 3, 'has enemies');
  for (const e of lv.enemies) assert.ok(inBounds([e.c, e.r]), 'enemy in bounds');
  for (const rk of lv.rocks) assert.ok(inBounds(rk), 'rock in bounds');
  assert.ok(lv.enemies.some((e) => e.type === 'fygar'), 'has at least one fygar');
});

test('difficulty scales with level and caps enemy count at 8', () => {
  const l1 = getLevel(1);
  const l3 = getLevel(3);
  const l20 = getLevel(20);
  assert.ok(l3.enemies.length > l1.enemies.length, 'more enemies later');
  assert.equal(l20.enemies.length, 8, 'caps at 8');
  assert.ok(l20.enemySpeed > l1.enemySpeed, 'faster later');
  assert.ok(l20.ghostInterval < l1.ghostInterval, 'ghosts more often later');
});

test('high levels still resolve and stay in bounds', () => {
  const lv = getLevel(7);
  assert.equal(lv.index, 7);
  for (const e of lv.enemies) assert.ok(inBounds([e.c, e.r]));
});
