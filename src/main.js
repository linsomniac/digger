// AIDEV-NOTE: Temporary scaffold bootstrap (Task 1). Replaced with the full
// fixed-timestep loop in Task 14.
import { CANVAS_W, CANVAS_H, BG_COLOR } from './constants.js';

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');
ctx.fillStyle = BG_COLOR;
ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
ctx.fillStyle = '#ffd27f';
ctx.font = '16px monospace';
ctx.textAlign = 'center';
ctx.fillText('DIGGER — loading…', CANVAS_W / 2, CANVAS_H / 2);
