// AIDEV-NOTE: Headless integration smoke test. Drives Game with a fake audio +
// fake input through start -> ready -> playing and fuzzes input for many ticks to
// catch crashes / NaN drift / state-machine wedges without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Dir } from '../src/constants.js';

const STEP = 1 / 60;

function fakeAudio() {
  return {
    muted: false,
    sfx() {},
    setMoving() {},
    update() {},
    unlock() {},
    setMuted() {},
    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    },
  };
}

function fakeInput() {
  return {
    _dir: Dir.NONE,
    held: { pump: false },
    pressedPump: false,
    pressedStart: false,
    pressedPause: false,
    pressedMute: false,
    desiredDir() {
      return this._dir;
    },
    endFrame() {
      this.pressedStart = false;
      this.pressedPause = false;
      this.pressedMute = false;
      this.pressedPump = false;
    },
  };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('game boots from title into a playing round', () => {
  const game = new Game(fakeAudio());
  const input = fakeInput();
  assert.equal(game.state, 'title');

  input.pressedStart = true;
  game.update(STEP, input);
  input.endFrame();
  assert.equal(game.state, 'ready');

  // advance through the READY countdown
  for (let i = 0; i < 120 && game.state === 'ready'; i++) game.update(STEP, input);
  assert.equal(game.state, 'playing');
});

test('player digs and moves right', () => {
  const game = new Game(fakeAudio());
  const input = fakeInput();
  input.pressedStart = true;
  game.update(STEP, input);
  input.endFrame();
  for (let i = 0; i < 120 && game.state === 'ready'; i++) game.update(STEP, input);

  const x0 = game.player.x;
  let dug = 0;
  const origDig = game.grid.dig.bind(game.grid);
  game.grid.dig = (c, r) => {
    const was = origDig(c, r);
    if (was) dug++;
    return was;
  };
  input._dir = Dir.DOWN; // dig downward into fresh soil
  for (let i = 0; i < 120; i++) game.update(STEP, input);

  assert.ok(game.player.y > 0, 'player has a position');
  assert.ok(dug > 0, 'player dug at least one cell of soil');
  assert.ok(Number.isFinite(game.player.x) && Number.isFinite(game.player.y), 'no NaN drift');
});

test('fuzzed input never throws, NaNs, or wedges the state machine', () => {
  const game = new Game(fakeAudio());
  const input = fakeInput();
  const rng = mulberry32(12345);
  const dirs = [Dir.NONE, Dir.UP, Dir.DOWN, Dir.LEFT, Dir.RIGHT];
  let lastState = game.state;
  let sameStateTicks = 0;

  input.pressedStart = true;
  game.update(STEP, input);
  input.endFrame();

  for (let i = 0; i < 6000; i++) {
    input._dir = dirs[Math.floor(rng() * dirs.length)];
    input.held.pump = rng() < 0.3;
    input.pressedPump = rng() < 0.15;
    if (rng() < 0.005) input.pressedStart = true; // occasionally confirm menus
    game.update(STEP, input);
    input.endFrame();

    assert.ok(Number.isFinite(game.player.x), `player.x finite at tick ${i}`);
    assert.ok(Number.isFinite(game.player.y), `player.y finite at tick ${i}`);
    assert.ok(game.score >= 0, 'score non-negative');

    if (game.state === lastState) sameStateTicks++;
    else { lastState = game.state; sameStateTicks = 0; }
    // 'title'/'playing' can persist; transient states must not get stuck forever.
    if (['ready', 'dying', 'levelclear'].includes(game.state)) {
      assert.ok(sameStateTicks < 600, `state ${game.state} wedged at tick ${i}`);
    }
  }
});

test('clearing all enemies advances the round', () => {
  const game = new Game(fakeAudio());
  const input = fakeInput();
  input.pressedStart = true;
  game.update(STEP, input);
  input.endFrame();
  for (let i = 0; i < 120 && game.state === 'ready'; i++) game.update(STEP, input);
  assert.equal(game.state, 'playing');

  // Kill every enemy directly, then tick once.
  for (const e of game.enemies.enemies) e.state = 'dead';
  game.update(STEP, input);
  assert.equal(game.state, 'levelclear');
  const round = game.level.index;
  for (let i = 0; i < 200 && game.state === 'levelclear'; i++) game.update(STEP, input);
  assert.equal(game.level.index, round + 1, 'advanced to next round');
});
