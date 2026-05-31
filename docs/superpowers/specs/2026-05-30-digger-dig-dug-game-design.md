# Digger — a faithful Dig Dug throwback (browser game)

**Date:** 2026-05-30
**Status:** Approved design (brainstorming → spec)

## 1. Summary

A browser-based, backend-free arcade game that is a faithful throwback to *Dig Dug*:
dig tunnels through colored soil layers, pump enemies until they pop, and drop rocks to
crush them. Rendered in a **cute/cartoon** style with the **classic underground** theme,
procedurally generated audio (music + SFX), and full keyboard + touch support.

Everything runs client-side. The game is served as static files (no backend, no build
step). A simple static file server (`python3 -m http.server`) is used during development
and to play, because browsers block ES-module `import` over `file://`.

### Goals
- Faithful Dig Dug mechanics: digging, pump-to-pop, ghosting enemies, falling rocks,
  bonus veggies, depth-based and chain scoring, last-enemy flee.
- Full arcade loop: title → ready → play → death → level-clear → game-over, with lives,
  score, persistent high score, and increasing difficulty across levels.
- Cute cartoon presentation with juicy feedback (squash/stretch, particles, screen shake).
- Procedural audio: oscillator SFX + an **original** chiptune "walking music" loop that
  plays only while moving.
- Works on desktop (keyboard) and mobile/tablet (on-screen controls).
- Clean, modular ES-module codebase with pure-logic units unit-tested headlessly.

### Non-goals (YAGNI)
- No online leaderboard, accounts, or any network calls.
- No level editor, no multiplayer.
- No external image/audio asset files (everything drawn/synthesized at runtime).
- No reproduction of copyrighted Dig Dug art or the original melody — we compose an
  original tune "in the spirit of" the arcade feel.
- No build/bundler step (Approach B): source is shipped as-is and served statically.

## 2. Run / dev model (Approach B)

- **Play / dev:** `python3 -m http.server 8000` in the project root, then open
  `http://localhost:8000`. No dependencies to install, no build.
- **Tests (optional, dev only):** `node --test` runs the pure-logic unit tests. Node is
  required only for testing, never for playing.
- `index.html` loads `src/main.js` via `<script type="module">`. Source files are `.js`
  ES modules. A minimal `package.json` (`{"type":"module"}`, `"test":"node --test"`,
  **zero dependencies**) exists solely so Node treats the `.js` source as ESM when running
  tests. Installing nothing is required to run the game.

## 3. Architecture

One responsibility per module; pure-logic modules avoid DOM so they are unit-testable.

```
index.html            Canvas + HUD/overlay DOM + on-screen touch controls; loads src/main.js
package.json          {"type":"module"}, test script; zero dependencies
src/main.js           Bootstrap: create canvas, init input/audio/storage, run the loop
src/constants.js      Tunables: tile size, grid dims, speeds, pump timing, scoring tables, palette
src/game.js           State machine + orchestration: score/lives/level, spawn, update/render dispatch
src/grid.js           Tile world: soil layers, dig(), isSolid(), isTunnel(), depth→layer, carve patterns
src/player.js         Dig Dug entity: 4-dir lane movement, digging, pump control, death
src/pump.js           Harpoon projectile + inflation linkage to a hooked enemy
src/enemies.js        Pooka + Fygar: tunnel-chase AI, ghost mode, inflation, Fygar fire, last-enemy flee
src/rocks.js          Boulders: support check, wobble, fall, crush detection, chain scoring
src/veggie.js         Bonus item: spawn trigger (after 2 rock drops), lifetime, collect
src/levels.js         Per-level config + difficulty scaling generator
src/sprites.js        Procedural cute-cartoon sprite drawing (DigDug, Pooka, Fygar, rock, veggies, pump)
src/render.js         All canvas drawing: soil bands, tunnels, sprites, particles, HUD, polish
src/particles.js      Lightweight particle system (dirt puffs, pop burst, rock shards, sparkles)
src/audio.js          Web Audio synth: oscillator SFX + looping walking-music sequencer; mute
src/input.js          Keyboard + on-screen touch → unified input state (held + edge)
src/storage.js        localStorage persistence (high score, mute preference)
test/                 node:test unit tests for pure logic
```

### Module dependency sketch
`main.js` → `game.js` → (`grid`, `player`, `enemies`, `rocks`, `pump`, `veggie`,
`levels`, `particles`) for logic; `render.js` + `sprites.js` for drawing; `input.js`,
`audio.js`, `storage.js` for I/O. `constants.js` is imported widely and depends on nothing.
Logic modules never import `render`/`audio`/DOM, so they can be tested under Node.

## 4. Game loop

- `requestAnimationFrame` drives the frame; a fixed-timestep accumulator (60 Hz logical
  update) keeps physics deterministic, with interpolation-free rendering each frame.
- Each tick: read input → `game.update(dt)` → `render(game)`. The state machine decides
  which update/render path runs (title vs play vs transitions).

## 5. World & dig model

- **Grid:** `COLS × ROWS` tiles of soil below a top HUD strip. Defaults (tunable in
  `constants.js`): `TILE = 32`, `COLS = 16`, `ROWS = 12`, HUD height `= TILE`. Logical
  canvas ≈ `512 × 416`, scaled to the viewport with crisp/pixelated scaling and
  letterboxing.
- **Cells:** each cell is either solid soil (belonging to a depth layer) or empty tunnel.
- **Soil layers (depth bands):** 4 colored bands, 3 rows each, from light/sandy at top to
  deep blue-gray at bottom. Layer index (0–3) drives depth scoring.
- **Digging:** entities move along lane centers (row centers when moving horizontally,
  column centers when moving vertically). Moving into a solid cell **digs** it (cell →
  empty), carving a 1-tile-wide tunnel. Turns are only allowed when aligned to a tile
  center (snap tolerance). Movement speed is constant whether digging fresh soil or
  running an existing tunnel.
- **Tunnel rendering:** empty cells render as soft, rounded, organic carved areas over the
  soil (neighbor-aware rounding), not hard squares.
- **Per-level start state:** each level begins with a pre-dug tunnel pattern and a central
  start chamber for the player, defined by `levels.js`.

## 6. Mechanics (faithful)

### Player (Dig Dug)
- 4-directional movement; digs as it moves; faces its travel direction.
- **Pump:** press/hold pump to extend a segmented harpoon in the facing direction through
  empty cells only, up to ~1.5 tiles (tunable). If the tip reaches an enemy, that enemy is
  **hooked**. While aiming/pumping the player is stationary (faithful lock).
- Death on contact with a non-inflated enemy, Fygar fire, or a falling rock.

### Pump & inflation (`pump.js`)
- Each pump press inflates a hooked enemy one stage: `0 → 1 → 2 → 3`. Reaching the final
  stage **pops** the enemy (destroyed; score by depth layer).
- If the player stops pumping, inflation decays over time; on reaching 0 the enemy is
  released and resumes its AI.
- A hooked/inflated enemy cannot move; intangible (ghost) enemies cannot be hooked.

### Enemies (`enemies.js`)
- **Pooka:** round goggled creature. Chases the player through tunnels (greedy/BFS toward
  player with mild randomness at intersections). Periodically enters **ghost mode**
  (eyes-only): moves in a straight line through soil toward the player's position, then
  rematerializes at a reachable tunnel cell. Ghosts cannot be pumped and do not dig.
- **Fygar:** dragon. Same movement + ghost behavior, plus **horizontal fire breath**: when
  aligned with the player along a clear tunnel within range, it telegraphs, then emits a
  fire jet 1–3 tiles long for a short duration; fire kills the player. Fygar is stationary
  while breathing. Worth more than Pooka; **horizontal pop scores 2×** a vertical pop.
- **Last-enemy flee:** when the final enemy remains (or count drops below a threshold after
  a timer), it heads for the upper-left surface and escapes off-screen. Once gone the level
  is cleared (no points for an escaped enemy).
- Enemies start embedded in their own soil chambers at level-defined cells.

### Rocks (`rocks.js`)
- Embedded at level-defined cells. A rock is **supported** while the cell directly below is
  solid (soil/rock/floor). When the cell below becomes empty, the rock **wobbles**
  (~0.6 s) then **falls** straight down through empty cells until it hits soil/rock/floor.
- During the fall, any enemy or the player in the rock's path is **crushed** (killed).
- One falling rock crushing multiple enemies awards a **chain bonus** (increasing per
  enemy). After landing it **shatters** (debris particles) and disappears — rocks do not
  become permanent terrain.
- Players drop rocks by digging the soil beneath them; standing under a wobbling rock is
  fatal, so the player must clear out.

### Bonus veggie (`veggie.js`)
- After **2 rocks have fallen** (faithful trigger), a bonus item appears in the central
  start chamber for a limited time. Collecting it awards bonus points. The item type and
  value advance by level (carrot → turnip → mushroom → cucumber → eggplant → …).

## 7. Scoring (concrete defaults, tunable)

- **Pooka pop** by layer depth (0–3): `[200, 300, 400, 500]`.
- **Fygar pop** by layer depth (0–3): `[400, 600, 800, 1000]`; **×2 if popped while
  horizontal** (aligned/breathing).
- **Rock crush chain** (1..8 enemies in one fall):
  `[1000, 2500, 4000, 6000, 8000, 10000, 12000, 15000]`.
- **Veggie** by level (capped list): `[400, 600, 800, 1000, 2000, 3000, 4000, 5000, 6000,
  7000, 8000]`.
- **Extra life:** first at `20000`, then every `60000` (tunable).
- High score persists in `localStorage`.

## 8. Levels & difficulty (`levels.js`)

- `getLevel(n)` returns a config: enemy list (types + spawn/chamber cells), rock cells,
  starting tunnel pattern, soil layer colors, veggie type, base enemy speed, ghost
  interval, and Fygar fire interval/chance.
- The first ~4–6 levels are hand-authored distinct layouts; beyond that a generator scales
  difficulty (patterns cycle, parameters toughen — faithful "rounds get harder").
- **Scaling:** enemy count grows (≈4 → 7–8), enemies speed up, ghosting becomes more
  frequent, more Fygars appear, fire fires more often.
- HUD shows the current round using the level's veggie icon(s).

## 9. Game states (`game.js`)

`TITLE → READY → PLAYING → (DYING | LEVEL_CLEAR) → … → GAME_OVER → TITLE`

- **TITLE:** "DIGGER" title, high score, "press Space / tap to start"; optional idle
  animation.
- **READY:** brief "ROUND n / READY" intro.
- **PLAYING:** main gameplay.
- **DYING:** death animation + pause; then respawn (lives remain) or → GAME_OVER.
- **LEVEL_CLEAR:** short fanfare + transition to next round.
- **GAME_OVER:** final score; "NEW HIGH SCORE" when beaten; back to TITLE.
- **PAUSE:** optional toggle (P / on-screen) during PLAYING.
- **Lives:** start 3. On death, dug tunnels persist and already-fallen rocks stay gone;
  player and enemies reset to start positions for the current round.

## 10. Input (`input.js`)

- **Keyboard:** Arrows or WASD = move (4-dir); Space or Z = pump; Enter/Space = start /
  confirm; P = pause; M = mute.
- **Touch:** on-screen D-pad (bottom-left) + pump button (bottom-right); tap to start;
  mute icon in HUD. Controls auto-show on touch devices.
- Exposes a unified state object `{ up, down, left, right, pump, start, pause, mute }`
  with both held and edge (just-pressed) signals, so game logic is input-source agnostic.

## 11. Rendering & cute-cartoon look (`render.js`, `sprites.js`, `particles.js`)

- **Soil:** colored depth bands with subtle granular texture.
- **Tunnels:** dark, soft, rounded carved areas (neighbor-aware) for an organic look.
- **DigDug:** round-headed cute character (goggles/helmet, white suit, big eyes), facing
  direction, gentle walk wobble, digging animation.
- **Pooka:** round orange/red blob with big goggles; inflation drawn as progressively
  larger spheres; ghost mode = translucent floating eyes.
- **Fygar:** green cartoon dragon; cute flame particles for fire breath; inflation likewise.
- **Rocks:** rounded gray boulders with highlight; shake while wobbling; shatter into
  shards on landing.
- **Pump harpoon:** segmented spear with an arrow tip.
- **Particles:** dirt puffs while digging, pop bursts, rock shards, veggie sparkles.
- **Polish:** squash-and-stretch, screen shake on rock impact/death, soft vignette and an
  optional scanline overlay (toggle). Readable, friendly palette.
- **HUD:** score (left), high score (top center), lives as DigDug icons, round as veggie
  icon, mute icon.

## 12. Audio (`audio.js`)

- A tiny synth built on Web Audio oscillators + gain envelopes, with a small note
  sequencer for the looping **walking music** (an **original** chiptune loop in the spirit
  of the arcade — not the copyrighted melody). Music plays **only while the player moves**
  and pauses when stopped (faithful).
- **SFX:** dig tick, pump blip, inflate boop (per stage), pop burst, rock wobble rumble,
  rock fall, rock shatter, Fygar fire whoosh, veggie sparkle, death descend, extra-life
  jingle, level-clear fanfare, game-over.
- `AudioContext` is created/resumed on first user gesture (autoplay policy). Mute toggle
  persists via `storage.js`.

## 13. Persistence (`storage.js`)

- `localStorage` keys namespaced under `digger.*` (e.g., `digger.highScore`,
  `digger.muted`). Reads tolerate missing/corrupt values with sensible defaults.

## 14. Testing

- **Headless unit tests** (`node --test`, zero deps) for pure logic:
  - `grid`: dig/isSolid/isTunnel, depth→layer mapping, carve patterns.
  - `rocks`: support detection, fall resolution path, chain-count computation.
  - scoring: depth and chain tables, Fygar horizontal ×2.
  - `enemies`: direction choice given a small fixed maze; ghost trigger logic.
  - `veggie`: spawn-after-2-rocks trigger.
- Logic modules must stay DOM-free so they import cleanly under Node.
- **Rendering / audio / input / integration:** verified by running the static server and
  playing, plus a smoke check.

## 15. Open risks / notes

- **ES modules over `file://`** are blocked → we rely on a static server (Approach B,
  chosen). Documented in the README.
- **`.js` MIME under `python3 -m http.server`** is served correctly by modern Python; if a
  very old Python is encountered, the README will note `python3 --version` ≥ 3.x.
- **Original audio only** — no copyrighted melody or assets. Keep the tune original.
- **Performance:** all-canvas procedural rendering at the target resolution is light;
  particle counts are bounded.
```
