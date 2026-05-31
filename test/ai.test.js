import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/grid.js';
import { chooseTunnelDir, ghostStep, shouldGhost } from '../src/ai.js';
import { Dir } from '../src/constants.js';

// A "plus"-shaped maze on a 5x5 grid: row 2 and col 2 are tunnels.
function plusMaze() {
  const g = new Grid(5, 5);
  g.carveRect(0, 2, 4, 2); // horizontal corridor
  g.carveRect(2, 0, 2, 4); // vertical corridor
  return g;
}

const rng0 = () => 0; // deterministic: always first tied option

test('moves toward a target along the shortest reducing direction', () => {
  const g = plusMaze();
  assert.equal(chooseTunnelDir(g, 2, 2, 4, 2, Dir.NONE, rng0), Dir.RIGHT);
  assert.equal(chooseTunnelDir(g, 2, 2, 2, 0, Dir.NONE, rng0), Dir.UP);
  assert.equal(chooseTunnelDir(g, 2, 2, 0, 2, Dir.NONE, rng0), Dir.LEFT);
});

test('never chooses a solid-walled direction (dead end)', () => {
  const g = plusMaze();
  // At (0,2): only RIGHT is a tunnel. Target is up-left but unreachable.
  assert.equal(chooseTunnelDir(g, 0, 2, 0, 0, Dir.NONE, rng0), Dir.RIGHT);
});

test('does not reverse in a corridor unless it is a dead end', () => {
  const g = new Grid(5, 5);
  g.carveRect(0, 2, 4, 2); // horizontal corridor only
  // Heading right, target is behind (left). Should keep going right, not reverse.
  assert.equal(chooseTunnelDir(g, 2, 2, 0, 2, Dir.RIGHT, rng0), Dir.RIGHT);
});

test('shouldGhost triggers at/after the interval', () => {
  assert.equal(shouldGhost(5.9, 6), false);
  assert.equal(shouldGhost(6, 6), true);
});

test('ghostStep drifts toward target and clamps on arrival', () => {
  const a = ghostStep(0, 0, 10, 0, 100, 0.05); // step 5
  assert.equal(a.x, 5);
  assert.equal(a.y, 0);
  const b = ghostStep(8, 0, 10, 0, 100, 1); // would overshoot -> clamp
  assert.deepEqual(b, { x: 10, y: 0 });
});
