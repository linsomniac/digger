// AIDEV-NOTE: Procedural, deterministic-per-level layout generator. getLevel(n)
// seeds a mulberry32 PRNG from the level index, so level N has the SAME layout
// every game but each level differs from the next. The board starts almost
// entirely filled; only these tunnels are carved:
//   - a 1-wide vertical shaft from the top edge down to the center (player entry)
//   - a 3-wide horizontal chamber at the center where the player spawns
//   - 4-6 sealed "monster holes" (each a 3x1 or 1x3 pocket), kept a 1-cell soil
//     moat from each other and a 3-cell moat from the player path (so a freshly
//     spawned, idle player always survives the spawn-invulnerability lapse with a
//     reaction beat), so enemies must ghost/dig out of their pockets (classic feel).
// Plus 4-6 rocks, each embedded in solid soil with solid soil below so they start
// supported and can be undermined. Pure + DOM-free (testable). getLevel(n) is
// 1-based and returns the same shape game.js already consumes:
//   { index, layerColors, carve:[[c0,r0,c1,r1]...], playerStart:[c,r],
//     enemies:[{type,c,r}...], rocks:[[c,r]...], veggieType, veggieValue,
//     enemySpeed, ghostInterval, fireInterval }
import { COLS, ROWS, ENEMY_SPEED, GHOST_INTERVAL_SEC, LAYER_COLORS } from './constants.js';
import { veggieScore } from './scoring.js';
import { veggieTypeForLevel } from './veggie.js';
import { mulberry32, randInt, shuffle } from './rng.js';

const CENTER_COL = Math.floor(COLS / 2); // 8 on a 16-wide board
const CENTER_ROW = Math.floor(ROWS / 2); // 6 on a 12-tall board
const MIN_HOLES = 4;
const MAX_HOLES = 6;
const HOLE_LEN = 3; // every monster hole is 3 cells long
const MAX_PER_HOLE = HOLE_LEN; // a 3-cell pocket seats at most 3 enemies
const PLAYER_MOAT = 3; // cells of soil between any hole and the player shaft/chamber

const key = (c, r) => `${c},${r}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Stable, well-mixed seed so each level's layout is fixed but distinct from its
// neighbours (mulberry32 decorrelates adjacent seeds).
function seedForLevel(n) {
  return (Math.imul(n, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
}

// Add the (2*radius+1)^2 block around (c,r) to `set` — a `radius`-cell moat so
// carved regions never touch. radius 1 keeps monster holes sealed / rocks
// unstacked; radius 2 around the player tunnels guarantees a reaction beat after
// spawn (no enemy can be seated adjacent-but-one to the chamber and reach it the
// instant invulnerability lapses).
function addMargin(set, c, r, radius = 1) {
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) set.add(key(c + dc, r + dr));
  }
}

// The player's tunnels: a 1-wide shaft from the surface down to the centre,
// opening into a 3-wide horizontal chamber at the player's cell.
function carvePlayerStart(tunnels) {
  for (let r = 0; r <= CENTER_ROW; r++) tunnels.add(key(CENTER_COL, r)); // shaft
  for (let c = CENTER_COL - 1; c <= CENTER_COL + 1; c++) tunnels.add(key(c, CENTER_ROW)); // chamber
}

// All candidate hole anchors (both orientations), kept 1 cell off the top row so
// holes read as buried pockets rather than extra surface openings.
function holeCandidates() {
  const cands = [];
  for (let r = 1; r <= ROWS - 1; r++) {
    for (let c = 0; c <= COLS - HOLE_LEN; c++) cands.push({ horiz: true, c, r });
  }
  for (let r = 1; r <= ROWS - HOLE_LEN; r++) {
    for (let c = 0; c <= COLS - 1; c++) cands.push({ horiz: false, c, r });
  }
  return cands;
}

function holeCells({ horiz, c, r }) {
  const cells = [];
  for (let i = 0; i < HOLE_LEN; i++) cells.push(horiz ? [c + i, r] : [c, r + i]);
  return cells;
}

// Greedily place targetHoles non-overlapping, soil-moated pockets from a shuffled
// candidate list. Robust: the dense candidate set guarantees we reach the target.
function placeHoles(rng, tunnels) {
  const reserved = new Set();
  for (const cell of tunnels) {
    const [c, r] = cell.split(',').map(Number);
    addMargin(reserved, c, r, PLAYER_MOAT); // 2-cell soil moat from the player path
  }
  const target = randInt(rng, MIN_HOLES, MAX_HOLES);
  const cands = shuffle(holeCandidates(), rng);
  const holes = [];
  for (const cand of cands) {
    if (holes.length >= target) break;
    const cells = holeCells(cand);
    if (cells.some(([c, r]) => reserved.has(key(c, r)))) continue;
    holes.push({ ...cand, cells });
    for (const [c, r] of cells) {
      tunnels.add(key(c, r));
      addMargin(reserved, c, r);
    }
  }
  return holes;
}

// Seat `count` enemies across the holes: one per hole first, then a second and
// third pass (<=3 per pocket). At low levels a hole or two stays empty; at high
// levels pockets pack 2-3.
function seatEnemies(holes, count, numFygar, rng) {
  const perHole = holes.map(() => 0);
  let remaining = count;
  let i = 0;
  let guard = 0;
  while (remaining > 0 && guard++ < count * holes.length + 1) {
    const h = i % holes.length;
    if (perHole[h] < MAX_PER_HOLE) {
      perHole[h]++;
      remaining--;
    }
    i++;
  }

  const enemies = [];
  for (let h = 0; h < holes.length; h++) {
    // Seat from the MIDDLE of the pocket outward, the two ends in seeded order. A
    // lone occupant thus starts centered — free to head either way toward the
    // player — instead of jammed against an end wall where every monster would be
    // forced the same direction (the "synchronized at round start" look).
    const order = [1, ...shuffle([0, 2], rng)];
    for (let k = 0; k < perHole[h]; k++) {
      const [c, r] = holes[h].cells[order[k]];
      enemies.push({ type: 'pooka', c, r });
    }
  }

  // Spread fygars evenly through the list (at least one) rather than clustering.
  let fygarsLeft = clamp(numFygar, 1, enemies.length);
  const stride = Math.max(1, Math.floor(enemies.length / fygarsLeft));
  for (let idx = 0; idx < enemies.length && fygarsLeft > 0; idx += stride) {
    enemies[idx].type = 'fygar';
    fygarsLeft--;
  }
  for (let idx = 0; idx < enemies.length && fygarsLeft > 0; idx++) {
    if (enemies[idx].type !== 'fygar') {
      enemies[idx].type = 'fygar';
      fygarsLeft--;
    }
  }
  return enemies;
}

// Place 4-6 rocks in solid soil with solid soil directly below (supported, and
// undermine-able). A 1-cell moat keeps them from starting stacked/adjacent.
function placeRocks(rng, tunnels) {
  const reserved = new Set();
  const cands = [];
  for (let r = 0; r <= ROWS - 2; r++) {
    for (let c = 0; c <= COLS - 1; c++) cands.push([c, r]);
  }
  shuffle(cands, rng);
  const target = randInt(rng, MIN_HOLES, MAX_HOLES); // reuse the 4-6 range
  const rocks = [];
  for (const [c, r] of cands) {
    if (rocks.length >= target) break;
    if (tunnels.has(key(c, r))) continue; // a rock sits in soil, not a tunnel
    if (tunnels.has(key(c, r + 1))) continue; // must be supported at the start
    if (reserved.has(key(c, r))) continue; // spacing from other rocks
    rocks.push([c, r]);
    addMargin(reserved, c, r);
  }
  return rocks;
}

function holesToCarveRects(holes) {
  return holes.map(({ cells }) => {
    const cs = cells.map(([c]) => c);
    const rs = cells.map(([, r]) => r);
    return [Math.min(...cs), Math.min(...rs), Math.max(...cs), Math.max(...rs)];
  });
}

export function getLevel(n) {
  const rng = mulberry32(seedForLevel(n));

  // Difficulty curve (unchanged): enemies 3 -> 8, at least one fygar, faster and
  // ghostier/firier as levels climb.
  const count = clamp(3 + (n - 1), 3, 8);
  const numFygar = clamp(Math.floor(n / 2), 1, count);

  const tunnels = new Set();
  carvePlayerStart(tunnels);
  const holes = placeHoles(rng, tunnels); // mutates `tunnels` with hole cells
  const enemies = seatEnemies(holes, count, numFygar, rng);
  const rocks = placeRocks(rng, tunnels);

  const carve = [
    [CENTER_COL, 0, CENTER_COL, CENTER_ROW], // vertical shaft, surface -> centre
    [CENTER_COL - 1, CENTER_ROW, CENTER_COL + 1, CENTER_ROW], // 3-wide chamber
    ...holesToCarveRects(holes),
  ];

  return {
    index: n,
    layerColors: LAYER_COLORS,
    carve,
    playerStart: [CENTER_COL, CENTER_ROW],
    enemies,
    rocks,
    veggieType: veggieTypeForLevel(n - 1),
    veggieValue: veggieScore(n - 1),
    enemySpeed: ENEMY_SPEED + (n - 1) * 4,
    ghostInterval: Math.max(2.5, GHOST_INTERVAL_SEC - (n - 1) * 0.4),
    fireInterval: Math.max(2.0, 5 - (n - 1) * 0.3),
  };
}
