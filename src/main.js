// AIDEV-NOTE: Bootstrap + fixed-timestep loop. 60 Hz logical updates with an
// accumulator; render once per animation frame. Canvas is a fixed logical size,
// scaled to the viewport with crisp pixels. Audio unlocks on first user gesture.
import { CANVAS_W, CANVAS_H } from './constants.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { renderGame } from './render.js';
import { getMuted } from './storage.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const audio = new AudioEngine(getMuted());
const input = new Input();
input.onGesture = () => audio.unlock();
input.attach(document);

const game = new Game(audio);

const muteBtn = document.getElementById('btnMute');
function syncMuteGlyph() {
  if (muteBtn) muteBtn.textContent = game.muted ? '🔇' : '🔊';
}
syncMuteGlyph();

function scaleCanvas() {
  const padW = 40;
  const padH = 60;
  const availW = Math.max(160, window.innerWidth - padW);
  const availH = Math.max(160, window.innerHeight - padH);
  const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
  canvas.style.width = `${Math.round(CANVAS_W * scale)}px`;
  canvas.style.height = `${Math.round(CANVAS_H * scale)}px`;
}
scaleCanvas();
window.addEventListener('resize', scaleCanvas);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.setState('paused');
});

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // avoid spiral after a tab stall
  acc += dt;
  while (acc >= STEP) {
    game.update(STEP, input);
    input.endFrame();
    acc -= STEP;
  }
  renderGame(ctx, game);
  syncMuteGlyph();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
