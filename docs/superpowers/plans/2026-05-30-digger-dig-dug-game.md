# Digger (Dig Dug throwback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a faithful, backend-free, browser-based Dig Dug throwback (cute cartoon theme, music + SFX, keyboard + touch, full arcade loop).

**Architecture:** Static ES-module project served over `python3 -m http.server`. Pure-logic modules (grid, scoring, rocks, AI, veggie, movement) are DOM-free and unit-tested under `node --test`. Entities, I/O (input/audio/storage), rendering (canvas), and the `game.js` state machine compose those into a fixed-timestep loop driven by `main.js`.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5 Canvas 2D, Web Audio API, localStorage, `node:test` (dev only, zero runtime deps).

---

## Shared interfaces (single source of truth — keep names consistent across tasks)

### `src/constants.js`
```js
export const TILE = 32;
export const COLS = 16;
export const ROWS = 12;
export const HUD_H = TILE;                 // 32
export const PLAYFIELD_W = COLS * TILE;    // 512
export const PLAYFIELD_H = ROWS * TILE;    // 384
export const CANVAS_W = PLAYFIELD_W;       // 512
export const CANVAS_H = HUD_H + PLAYFIELD_H; // 416

export const LAYER_ROWS = 3;               // rows per soil layer
export const NUM_LAYERS = 4;               // ROWS / LAYER_ROWS
export const LAYER_COLORS = ['#d9a066', '#c77b3b', '#a9543b', '#4a5a82'];
export const TUNNEL_COLOR = '#241a12';
export const BG_COLOR = '#0e0a16';

// Pixel speeds (px/sec)
export const PLAYER_SPEED = 96;
export const ENEMY_SPEED = 64;
export const GHOST_SPEED = 42;
export const ROCK_FALL_SPEED = 240;

// Pump / inflation
export const PUMP_REACH = TILE * 1.5;      // 48 px
export const MAX_INFLATE = 4;              // pops when level reaches MAX_INFLATE
export const INFLATE_DEFLATE_SEC = 0.7;    // seconds to lose one stage when not pumping
export const PUMP_EXTEND_SEC = 0.12;       // harpoon extend animation

// Rocks
export const ROCK_WOBBLE_SEC = 0.6;

// Fygar fire
export const FIRE_TELEGRAPH_SEC = 0.5;
export const FIRE_DURATION_SEC = 0.8;
export const FIRE_RANGE_TILES = 3;

// Enemy ghosting
export const GHOST_INTERVAL_SEC = 6;       // base; level config lowers it
export const GHOST_DURATION_MAX_SEC = 3.5;

// Lives / scoring
export const START_LIVES = 3;
export const EXTRA_LIFE_FIRST = 20000;
export const EXTRA_LIFE_REPEAT = 60000;

export const POOKA_SCORE = [200, 300, 400, 500];     // by layer 0..3
export const FYGAR_SCORE = [400, 600, 800, 1000];    // by layer 0..3 (x2 if horizontal)
export const ROCK_CHAIN_SCORE = [1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000];
export const VEGGIE_SCORE = [400, 600, 800, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];

export const Dir = { NONE:'none', UP:'up', DOWN:'down', LEFT:'left', RIGHT:'right' };
export const DIR_VEC = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0], none:[0,0] };
```

### `src/grid.js`
```
class Grid {
  constructor(cols, rows)
  cols, rows
  inBounds(c, r) -> bool
  isSolid(c, r) -> bool        // out of bounds: top/left/right/bottom treated as solid (blocks movement & supports rocks)
  isTunnel(c, r) -> bool       // inBounds && !solid
  dig(c, r) -> bool            // returns true if a solid cell was cleared
  setSolid(c, r, solid)
  layerAt(r) -> int            // clamp(floor(r / LAYER_ROWS), 0, NUM_LAYERS-1)
  reset()                      // all solid
  carveRect(c0, r0, c1, r1)    // inclusive, sets empty
  carveCells(listOf[c,r])
}
// helpers (pure, exported):
tileToPx(c, r) -> {x, y}       // center px of a cell (playfield coords)
pxToTile(x, y) -> {c, r}
isAlignedToCol(x) -> bool      // |x - (col center)| < EPS
isAlignedToRow(y) -> bool
```

### `src/scoring.js` (pure)
```
pookaScore(layer) -> int
fygarScore(layer, horizontal) -> int
rockChainScore(countCrushed) -> int   // 1-based; clamps to table length
veggieScore(levelIndex) -> int        // clamps to table length
extraLifeCount(score) -> int          // how many extra lives earned at this cumulative score
```

### `src/rocks.js` (pure logic + entity)
```
// pure:
isSupported(grid, c, r, otherRockCells:Set<"c,r">) -> bool   // solid/rock/floor directly below
fallTargetRow(grid, c, r, otherRockCells) -> int             // row it lands on top of
// entity:
class Rock { c, r, x, y, state:'idle'|'wobble'|'falling'|'broken', update(dt, grid, rocks), ... }
class RockField { rocks:Rock[]; update(dt, grid, entities) -> {crushed:[], landed:bool, started:int}; ... }
```

### `src/veggie.js`
```
shouldSpawnVeggie(rocksFallen, alreadySpawned) -> bool   // pure: rocksFallen >= 2 && !alreadySpawned
class Veggie { x, y, type, value, ttl, alive, update(dt) }
```

### `src/ai.js` (pure enemy decision logic)
```
chooseTunnelDir(grid, fromC, fromR, targetC, targetR, currentDir, rng) -> Dir
  // greedy toward target along tunnels; avoids reversing unless dead-end; rng picks ties
ghostStep(x, y, targetX, targetY, speed, dt) -> {x, y}   // straight-line drift toward target
shouldGhost(timer, interval) -> bool
```

### `src/entities/` — created inline in `enemies.js`, `player.js`
```
// player.js
class Player { x, y, dir, facing, alive, pumping, harpoon, reset(cell), update(dt, grid, input, ...) }

// enemies.js
class Enemy {
  type:'pooka'|'fygar'
  x, y, dir, facing
  state:'normal'|'ghost'|'hooked'|'inflated'|'fleeing'|'dead'
  inflate:0..MAX_INFLATE
  fire:{active, telegraph, dir, len}    // fygar only
  update(dt, grid, player, level, rng)
}
class EnemyField { enemies:Enemy[]; aliveCount(); update(...); }
```

### `src/input.js`
```
class Input { state:{up,down,left,right,pump,start,pause,mute}; pressed(name)->bool (edge); endFrame(); attach(canvas, touchEls) }
```

### `src/audio.js`
```
class AudioEngine {
  unlock()           // resume context on first gesture
  setMuted(bool); toggleMute()
  sfx(name)          // 'dig','pump','inflate','pop','wobble','rockfall','rockbreak','fire','veggie','death','extralife','levelclear','gameover','start'
  setMoving(bool)    // gates walking music
  update(dt)
}
```

### `src/storage.js`
```
getHighScore() -> int
setHighScore(n)
getMuted() -> bool
setMuted(bool)
```

### `src/levels.js`
```
getLevel(n) -> {
  index, layerColors, tunnels:[[c,r]...]|carveFn, playerStart:[c,r],
  enemies:[{type, c, r}], rocks:[[c,r]...], veggieType, veggieValue,
  enemySpeed, ghostInterval, fireInterval
}
```

### `src/sprites.js` / `src/render.js` / `src/particles.js` / `src/game.js` / `src/main.js`
Drawing + orchestration; verified by running the server (see tasks).

---

## File structure

```
index.html                 canvas, HUD overlay, touch controls, loads src/main.js
package.json               {"type":"module","scripts":{"test":"node --test"}}, zero deps
README.md                  how to run + test
.gitignore                 (exists)
src/constants.js           tunables (above)
src/grid.js                tile world + px/tile helpers
src/scoring.js             score tables (pure)
src/ai.js                  enemy decision logic (pure)
src/rocks.js               rock support/fall logic + Rock/RockField
src/veggie.js              veggie trigger (pure) + Veggie entity
src/player.js              Dig Dug entity
src/pump.js                harpoon + inflation linkage
src/enemies.js             Pooka/Fygar entities + EnemyField
src/particles.js           particle system
src/input.js               keyboard + touch
src/audio.js               Web Audio synth (SFX + music)
src/storage.js             localStorage
src/sprites.js             procedural sprite drawing
src/render.js              world/HUD/overlay drawing
src/levels.js              level configs + difficulty scaling
src/game.js                state machine + orchestration
src/main.js                bootstrap + fixed-timestep loop
test/grid.test.js          node:test
test/scoring.test.js
test/rocks.test.js
test/ai.test.js
test/veggie.test.js
test/levels.test.js
```

---

## Tasks

### Task 1: Scaffold + run check
**Files:** Create `package.json`, `index.html`, `README.md`, `src/constants.js`, `src/main.js` (stub).
- [ ] Create `package.json`: `{ "name":"digger","private":true,"type":"module","scripts":{"test":"node --test"} }`.
- [ ] Create `src/constants.js` with the full constants block above.
- [ ] Create `index.html` with a `<canvas id="game">`, HUD/overlay containers, touch-control DOM, and `<script type="module" src="src/main.js">`.
- [ ] Create `src/main.js` stub that imports constants, sizes the canvas, and paints the background (proves modules load).
- [ ] Create `README.md` documenting `python3 -m http.server 8000` to play and `node --test` to test.
- [ ] **Verify:** run `python3 -m http.server 8000 &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/` → `200`; confirm no parse errors by `node --input-type=module -e "import('./src/constants.js').then(m=>console.log('ok',m.TILE))"` → `ok 32`.
- [ ] **Commit:** `chore: scaffold static ES-module project`.

### Task 2: Grid (TDD)
**Files:** Create `src/grid.js`, `test/grid.test.js`.
- [ ] Write failing tests: new Grid all solid; `dig` clears + returns true then false; `isTunnel` after dig; `layerAt(0..11)` → `0,0,0,1,1,1,2,2,2,3,3,3`; out-of-bounds `isSolid` true; `carveRect` clears inclusive range; `tileToPx`/`pxToTile` round-trip on a cell center; `isAlignedToRow/Col` true at centers, false at off-centers.
- [ ] Run `node --test test/grid.test.js` → FAIL.
- [ ] Implement `src/grid.js` to pass.
- [ ] Run → PASS. **Commit:** `feat: tile grid with dig + layer + px helpers`.

### Task 3: Scoring (TDD)
**Files:** Create `src/scoring.js`, `test/scoring.test.js`.
- [ ] Tests: `pookaScore(0..3)`→table; `fygarScore(layer,false)`→table, `fygarScore(layer,true)`→×2; `rockChainScore(1)`→1000, `(3)`→4000, `(99)`→last; `veggieScore(0)`→400, `(99)`→last; `extraLifeCount`: 0 at 19999, 1 at 20000, 1 at 79999, 2 at 80000 (first 20k, repeat 60k).
- [ ] Run → FAIL. Implement. Run → PASS. **Commit:** `feat: scoring tables`.

### Task 4: Rock logic (TDD)
**Files:** Create `src/rocks.js` (pure parts first), `test/rocks.test.js`.
- [ ] Tests for `isSupported` (solid below = supported; empty below = not; floor row = supported; another rock below = supported) and `fallTargetRow` (falls to row above first solid/rock/floor).
- [ ] Run → FAIL. Implement pure functions. Run → PASS. **Commit:** `feat: rock support + fall-target logic`.

### Task 5: AI logic (TDD)
**Files:** Create `src/ai.js`, `test/ai.test.js`.
- [ ] Tests on a small fixed maze string: `chooseTunnelDir` moves toward target along a straight tunnel; turns at a junction toward target; does not pick a solid-walled direction; prefers not reversing in a corridor. `shouldGhost(timer,interval)` boundary. `ghostStep` moves toward target by `speed*dt` and clamps at target.
- [ ] Run → FAIL. Implement (greedy with Manhattan preference + deterministic rng for ties). Run → PASS. **Commit:** `feat: enemy tunnel-pathing + ghost logic`.

### Task 6: Veggie trigger (TDD)
**Files:** Create `src/veggie.js`, `test/veggie.test.js`.
- [ ] Tests: `shouldSpawnVeggie(0,false)`→false, `(2,false)`→true, `(2,true)`→false. Veggie `update` decrements ttl and sets `alive=false` at 0.
- [ ] Run → FAIL. Implement. Run → PASS. **Commit:** `feat: veggie spawn trigger + entity`.

### Task 7: Levels (TDD on scaling + sanity)
**Files:** Create `src/levels.js`, `test/levels.test.js`.
- [ ] Hand-author levels 1–5 (distinct tunnel patterns, enemy/rock placements, veggie types) + a generator for n>5 that scales enemy count (cap 8), speed, lowers ghost/fire intervals.
- [ ] Tests: `getLevel(1)` has player start in-bounds, ≥1 enemy, all enemy/rock cells in-bounds; enemy count grows with n and caps at 8; speed non-decreasing; `getLevel(7).index===7`.
- [ ] Run → FAIL. Implement. Run → PASS. **Commit:** `feat: level configs + difficulty scaling`.

### Task 8: Storage
**Files:** Create `src/storage.js`. (Tested via game; optional small test with a localStorage stub.)
- [ ] Implement get/set high score + muted, namespaced `digger.*`, tolerant of missing/corrupt values.
- [ ] **Verify:** `node --input-type=module -e "globalThis.localStorage={store:{},getItem(k){return this.store[k]??null},setItem(k,v){this.store[k]=String(v)}}; const s=await import('./src/storage.js'); s.setHighScore(123); console.log(s.getHighScore())"` → `123`.
- [ ] **Commit:** `feat: localStorage persistence`.

### Task 9: Player + Pump + inflation
**Files:** Create `src/player.js`, `src/pump.js`.
- [ ] Implement lane-constrained 4-dir movement with turn-at-center, digging on entering soil (returns dug-cell events for particles/sfx), facing, and a `firePump`/`releasePump` API. `pump.js` handles harpoon extension and inflation stage changes + deflation timer; exposes the hooked enemy + pop event.
- [ ] **Verify (logic smoke):** import player+grid under node, simulate a few `update` steps moving right through soil, assert x increased and the entered cell is now tunnel.
- [ ] **Commit:** `feat: player movement/digging + pump inflation`.

### Task 10: Enemies + Rock entities + Particles
**Files:** Create `src/enemies.js`, finish `src/rocks.js` (Rock/RockField), `src/particles.js`.
- [ ] `enemies.js`: Pooka/Fygar using `ai.js`; states normal/ghost/hooked/inflated/fleeing/dead; Fygar fire telegraph→jet; last-enemy flee to top-left.
- [ ] `rocks.js`: Rock lifecycle idle→wobble→falling→broken using pure logic from Task 4; `RockField.update` returns crushed entities + chain count + started count.
- [ ] `particles.js`: spawn/update/draw dirt puffs, pop burst, rock shards, sparkles.
- [ ] **Verify (logic smoke):** node-simulate a rock with soil dug beneath → enters wobble then falling; an enemy placed in its column gets crushed.
- [ ] **Commit:** `feat: enemies, rock entities, particles`.

### Task 11: Input + Audio
**Files:** Create `src/input.js`, `src/audio.js`.
- [ ] `input.js`: keyboard (arrows/WASD/Space/Z/Enter/P/M) + on-screen D-pad/pump/mute touch; unified held + edge state; `endFrame` clears edges.
- [ ] `audio.js`: Web Audio synth — oscillator+gain SFX for every event name; an original looping chiptune sequencer gated by `setMoving`; `unlock()` on first gesture; mute persists.
- [ ] **Verify:** loaded in browser (Task 14) — keys move a test sprite, sounds play; no console errors.
- [ ] **Commit:** `feat: keyboard+touch input and Web Audio engine`.

### Task 12: Sprites + Render
**Files:** Create `src/sprites.js`, `src/render.js`.
- [ ] `sprites.js`: cute cartoon procedural drawing — DigDug (4 facings + dig wobble), Pooka (inflation stages + ghost), Fygar (+ fire + inflation), rock (idle/wobble/shards), veggies, pump harpoon.
- [ ] `render.js`: soil layer bands + texture, rounded organic tunnels, entities via sprites, particles, HUD (score/high/lives/round/mute), and overlay screens (title/ready/clear/gameover/pause). Screen-shake + optional scanline/vignette.
- [ ] **Verify:** visual via Task 14.
- [ ] **Commit:** `feat: procedural sprites + canvas renderer`.

### Task 13: Game state machine
**Files:** Create `src/game.js`.
- [ ] Implement states TITLE→READY→PLAYING→(DYING|LEVEL_CLEAR)→…→GAME_OVER→TITLE, score/lives/level, extra-life awards, enemy-clear detection (incl. flee), veggie spawn after 2 rocks, death handling, level transitions, high-score save. Wires player/enemies/rocks/veggie/particles/audio together each tick.
- [ ] **Verify:** via Task 14 full playthrough.
- [ ] **Commit:** `feat: game state machine + orchestration`.

### Task 14: Bootstrap loop + full verification
**Files:** Finish `src/main.js`.
- [ ] Fixed-timestep accumulator (60 Hz), input→game.update→render, canvas scaling to viewport (crisp), audio unlock on first input, pause on tab blur.
- [ ] **Verify:** `node --test` (all green); start server; load page; confirm: title→start, move/dig with sound, pump+pop an enemy, drop a rock to crush, grab veggie, clear level → next, die → lose life → game over → high score saved; touch controls appear/work in a narrow viewport; no console errors.
- [ ] **Commit:** `feat: main loop + scaling + full game wired`.

### Task 15: Polish pass
**Files:** touch render/audio/constants as needed.
- [ ] Tune speeds/feel, add squash-stretch on inflate, screen shake on rock land/death, level-clear fanfare, extra-life jingle, scanline toggle. Re-verify playthrough.
- [ ] **Commit:** `polish: juice, tuning, audio cues`.

---

## Self-Review

**Spec coverage:** dig/tunnel (T2,9), pump-to-pop + inflation (T9), Pooka/Fygar + ghost + fire + flee (T5,10), rocks + chain crush (T4,10), veggie after 2 rocks (T6,13), depth+chain+veggie scoring + extra life (T3,13), levels + scaling (T7), states/lives/high score (T8,13), keyboard+touch (T11), procedural music+SFX (T11), cute render (T12), persistence (T8), tests for pure logic (T2–7), Approach-B run model (T1). All spec sections map to a task.

**Placeholder scan:** no "TODO/TBD/handle edge cases" steps; canvas/audio modules are verified by running (acknowledged in spec §14).

**Type consistency:** names (`isSolid`, `isTunnel`, `dig`, `layerAt`, `chooseTunnelDir`, `isSupported`, `fallTargetRow`, `shouldSpawnVeggie`, `getLevel`, `sfx`, `setMoving`, `getHighScore`) are defined once in the interfaces section and reused verbatim in tasks.
