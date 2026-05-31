// AIDEV-NOTE: Single source of truth for all tunables. Pure data, no imports.
// Logic modules import from here; keep this DOM-free so it loads under node:test.

export const TILE = 32;
export const COLS = 16;
export const ROWS = 12;
export const HUD_H = TILE; // 32
export const PLAYFIELD_W = COLS * TILE; // 512
export const PLAYFIELD_H = ROWS * TILE; // 384
export const CANVAS_W = PLAYFIELD_W; // 512
export const CANVAS_H = HUD_H + PLAYFIELD_H; // 416

export const LAYER_ROWS = 3; // rows per soil layer
export const NUM_LAYERS = 4; // ROWS / LAYER_ROWS
// Top (sky-lit sand) -> deep. Cute, warm, readable palette.
export const LAYER_COLORS = ['#e6b06b', '#cf7f3c', '#a85236', '#46568a'];
export const LAYER_COLORS_DARK = ['#c9914f', '#b06a2c', '#8c3f28', '#36436d'];
export const TUNNEL_COLOR = '#221812';
export const TUNNEL_EDGE = '#3a2a1d';
export const BG_COLOR = '#0e0a16';

// Pixel speeds (px/sec)
export const PLAYER_SPEED = 92;
export const ENEMY_SPEED = 60;
export const GHOST_SPEED = 44;
export const ROCK_FALL_SPEED = 250;

// Pump / inflation
export const PUMP_REACH = TILE * 1.5; // 48 px harpoon reach
export const MAX_INFLATE = 4; // pops when inflate level reaches this
export const INFLATE_DEFLATE_SEC = 0.7; // seconds to lose one stage while still hooked but not pumping
export const INFLATE_RELEASE_SEC = 1.7; // seconds per stage to deflate after the player runs away (~5s from a 3-pump)
export const PUMP_EXTEND_SEC = 0.1; // harpoon extend animation duration
export const PUMP_INFLATE_COOLDOWN = 0.14; // min seconds between inflate presses registering

// Rocks
export const ROCK_WOBBLE_SEC = 0.6;

// Fygar fire
export const FIRE_TELEGRAPH_SEC = 0.5;
export const FIRE_DURATION_SEC = 0.8;
export const FIRE_RANGE_TILES = 3;

// Enemy ghosting
export const GHOST_INTERVAL_SEC = 6.5; // base; level config lowers it
export const GHOST_DURATION_MAX_SEC = 3.5;
export const FLEE_AFTER_SEC = 8; // last enemy starts fleeing after this long alone

// Lives / scoring
export const START_LIVES = 3;
export const EXTRA_LIFE_FIRST = 20000;
export const EXTRA_LIFE_REPEAT = 60000;

export const POOKA_SCORE = [200, 300, 400, 500]; // by layer 0..3
export const FYGAR_SCORE = [400, 600, 800, 1000]; // by layer 0..3 (x2 if horizontal)
export const ROCK_CHAIN_SCORE = [1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000];
export const VEGGIE_SCORE = [400, 600, 800, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];

export const Dir = Object.freeze({
  NONE: 'none',
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
});

export const DIR_VEC = Object.freeze({
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
  none: [0, 0],
});

export const OPPOSITE = Object.freeze({
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
  none: 'none',
});
