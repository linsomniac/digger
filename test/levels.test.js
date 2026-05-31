// AIDEV-NOTE: levels.js is now a deterministic procedural generator. These tests
// pin the contract game.js relies on: stable shape + difficulty curve (original
// tests) PLUS the new structure — per-level determinism, a surface->centre shaft
// into a 3-wide chamber, 4-6 sealed 3x1/1x3 monster holes, enemies seated inside
// those holes, and 4-6 supported/undermine-able rocks, on a mostly-filled board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/levels.js';
import { COLS, ROWS } from '../src/constants.js';

const CENTER_COL = Math.floor(COLS / 2);
const CENTER_ROW = Math.floor(ROWS / 2);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function inBounds([c, r]) {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

function cellsOf([c0, r0, c1, r1]) {
  const out = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) out.push([c, r]);
  }
  return out;
}

function tunnelSet(level) {
  const s = new Set();
  for (const rect of level.carve) for (const [c, r] of cellsOf(rect)) s.add(`${c},${r}`);
  return s;
}

// By construction carve[0] is the shaft and carve[1] is the chamber; the rest are
// the monster holes.
function holeRects(level) {
  return level.carve.slice(2);
}

// --- original contract: bounds + difficulty curve ---------------------------

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

// --- new structure ----------------------------------------------------------

test('a level is identical every game and differs from its neighbour', () => {
  assert.deepEqual(getLevel(5), getLevel(5), 'same level is reproducible');
  assert.deepEqual(getLevel(12), getLevel(12), 'reproducible at higher levels too');
  assert.notDeepEqual(getLevel(1).carve, getLevel(2).carve, 'level 1 != level 2 layout');
});

test('the board starts almost entirely filled', () => {
  const lv = getLevel(1);
  const tunnels = tunnelSet(lv).size;
  const total = COLS * ROWS;
  assert.ok(tunnels < total * 0.3, `mostly soil: ${tunnels}/${total} carved`);
  assert.ok(tunnels > 8, 'but the player path + holes are carved');
});

test('player start is a surface shaft into a 3-wide centre chamber', () => {
  const lv = getLevel(4);
  assert.deepEqual(lv.playerStart, [CENTER_COL, CENTER_ROW]);
  const tunnels = tunnelSet(lv);
  assert.ok(tunnels.has(`${CENTER_COL},0`), 'shaft opens at the surface');
  for (let r = 0; r <= CENTER_ROW; r++) {
    assert.ok(tunnels.has(`${CENTER_COL},${r}`), `shaft carved at row ${r}`);
  }
  for (let c = CENTER_COL - 1; c <= CENTER_COL + 1; c++) {
    assert.ok(tunnels.has(`${c},${CENTER_ROW}`), `chamber carved at col ${c}`);
  }
});

test('monster holes are 4-6 sealed 3x1 / 1x3 pockets', () => {
  const lv = getLevel(3);
  const holes = holeRects(lv);
  assert.ok(holes.length >= 4 && holes.length <= 6, `expected 4-6 holes, got ${holes.length}`);
  const tunnels = tunnelSet(lv);
  for (const rect of holes) {
    const cells = cellsOf(rect);
    assert.equal(cells.length, 3, 'each hole is 3 cells');
    const w = Math.abs(rect[2] - rect[0]) + 1;
    const h = Math.abs(rect[3] - rect[1]) + 1;
    assert.ok((w === 3 && h === 1) || (w === 1 && h === 3), '3x1 or 1x3');
    // Sealed: every carved neighbour of a hole cell belongs to the SAME hole, so
    // the pocket connects to no other tunnel (player path or another hole).
    const own = new Set(cells.map(([c, r]) => `${c},${r}`));
    for (const [c, r] of cells) {
      for (const [dc, dr] of N4) {
        const nk = `${c + dc},${r + dr}`;
        if (tunnels.has(nk)) assert.ok(own.has(nk), `hole not sealed: leaks to ${nk}`);
      }
    }
  }
});

test('monster holes keep a soil moat from the player shaft/chamber', () => {
  // So a freshly spawned, idle player always survives the spawn-invulnerability
  // lapse: no enemy can be seated right next to the chamber and reach it the frame
  // invuln ends. The generator uses a 3-cell moat; assert at least a 3-cell gap.
  for (const n of [1, 12, 16, 19, 40, 200]) {
    const lv = getLevel(n);
    const playerCells = [...cellsOf(lv.carve[0]), ...cellsOf(lv.carve[1])]; // shaft + chamber
    for (const rect of holeRects(lv)) {
      for (const [hc, hr] of cellsOf(rect)) {
        for (const [pc, pr] of playerCells) {
          const cheb = Math.max(Math.abs(hc - pc), Math.abs(hr - pr));
          assert.ok(cheb >= 3, `L${n}: hole cell ${hc},${hr} only ${cheb} from player cell ${pc},${pr}`);
        }
      }
    }
  }
});

test('every enemy spawns inside a monster hole, no two stacked', () => {
  const lv = getLevel(6);
  const holeCells = new Set();
  for (const rect of holeRects(lv)) for (const [c, r] of cellsOf(rect)) holeCells.add(`${c},${r}`);
  const seen = new Set();
  for (const e of lv.enemies) {
    const k = `${e.c},${e.r}`;
    assert.ok(holeCells.has(k), `enemy at ${k} sits in a hole`);
    assert.ok(!seen.has(k), 'no two enemies share a cell');
    seen.add(k);
  }
});

test('rocks: 4-6, embedded in soil, supported and undermine-able', () => {
  const lv = getLevel(2);
  assert.ok(lv.rocks.length >= 4 && lv.rocks.length <= 6, `expected 4-6 rocks, got ${lv.rocks.length}`);
  const tunnels = tunnelSet(lv);
  const seen = new Set();
  for (const [c, r] of lv.rocks) {
    assert.ok(r + 1 < ROWS, 'has a soil cell below to dig out');
    assert.ok(!tunnels.has(`${c},${r}`), 'the rock sits in soil, not a tunnel');
    assert.ok(!tunnels.has(`${c},${r + 1}`), 'starts supported: solid soil directly below');
    const k = `${c},${r}`;
    assert.ok(!seen.has(k), 'rocks are distinct');
    seen.add(k);
  }
});
