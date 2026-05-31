// AIDEV-NOTE: Level configs. Three hand-authored tunnel templates are cycled and
// scaled by difficulty (enemy count/types, speed, ghost/fire cadence). getLevel(n)
// is 1-based. Pure + DOM-free (testable). carve entries are inclusive rectangles
// [c0,r0,c1,r1]; nests/rocks are tunnel/soil cells [c,r].
import { ENEMY_SPEED, GHOST_INTERVAL_SEC, LAYER_COLORS } from './constants.js';
import { veggieScore } from './scoring.js';
import { veggieTypeForLevel } from './veggie.js';

// Each template: carve rectangles, player start, ordered enemy nest cells (in
// tunnels), and rock cells (embedded in soil with soil below so they start
// supported and can be undermined).
const TEMPLATES = [
  {
    // A — ladder maze: rows 4 & 8, verticals at cols 3/7/12, surface shaft.
    carve: [
      [3, 4, 12, 4],
      [3, 8, 12, 8],
      [3, 4, 3, 8],
      [12, 4, 12, 8],
      [7, 1, 7, 8],
    ],
    player: [7, 4],
    nests: [
      [3, 4],
      [12, 4],
      [3, 8],
      [12, 8],
      [6, 8],
      [9, 8],
      [5, 4],
      [10, 4],
    ],
    rocks: [
      [5, 6],
      [10, 6],
      [8, 3],
    ],
  },
  {
    // B — three corridors (rows 3/6/9) on a center shaft (col 8).
    carve: [
      [8, 1, 8, 10],
      [3, 3, 13, 3],
      [3, 6, 13, 6],
      [3, 9, 13, 9],
    ],
    player: [8, 6],
    nests: [
      [3, 3],
      [13, 3],
      [3, 9],
      [13, 9],
      [3, 6],
      [13, 6],
      [8, 3],
      [8, 9],
    ],
    rocks: [
      [5, 4],
      [11, 7],
      [6, 7],
    ],
  },
  {
    // C — box ring with a center cross.
    carve: [
      [2, 2, 13, 2],
      [2, 10, 13, 10],
      [2, 2, 2, 10],
      [13, 2, 13, 10],
      [7, 2, 7, 10],
      [3, 6, 12, 6],
    ],
    player: [7, 6],
    nests: [
      [2, 2],
      [13, 2],
      [2, 10],
      [13, 10],
      [7, 2],
      [7, 10],
      [3, 6],
      [12, 6],
    ],
    rocks: [
      [5, 4],
      [10, 8],
      [5, 8],
    ],
  },
];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function getLevel(n) {
  const tmpl = TEMPLATES[(n - 1) % TEMPLATES.length];

  const count = clamp(3 + (n - 1), 3, 8); // start at 3, +1 per level, cap 8
  const numFygar = clamp(Math.floor(n / 2), 1, count); // at least one fygar
  const enemies = tmpl.nests.slice(0, count).map(([c, r], i) => ({
    type: i < numFygar ? 'fygar' : 'pooka',
    c,
    r,
  }));

  return {
    index: n,
    layerColors: LAYER_COLORS,
    carve: tmpl.carve,
    playerStart: tmpl.player,
    enemies,
    rocks: tmpl.rocks.map(([c, r]) => [c, r]),
    veggieType: veggieTypeForLevel(n - 1),
    veggieValue: veggieScore(n - 1),
    enemySpeed: ENEMY_SPEED + (n - 1) * 4,
    ghostInterval: Math.max(2.5, GHOST_INTERVAL_SEC - (n - 1) * 0.4),
    fireInterval: Math.max(2.0, 5 - (n - 1) * 0.3),
  };
}
