// AIDEV-NOTE: Procedural cute-cartoon sprites drawn on the 2D canvas — no image
// assets. Everything is centered at (x,y) and roughly TILE-sized. Inflation scales
// the body and shifts colour toward pink; ghost mode draws translucent + eyes.
import { Dir, MAX_INFLATE } from './constants.js';

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function facingVec(facing) {
  if (facing === Dir.LEFT) return [-1, 0];
  if (facing === Dir.RIGHT) return [1, 0];
  if (facing === Dir.UP) return [0, -1];
  if (facing === Dir.DOWN) return [0, 1];
  return [1, 0];
}

export function drawDigDug(ctx, x, y, s, facing, walkPhase, invuln = 0) {
  if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) return; // blink
  const [fx] = facingVec(facing);
  const dir = fx < 0 ? -1 : 1;
  const bob = Math.sin(walkPhase) * s * 0.05;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1);

  // legs
  ctx.fillStyle = '#3a3f55';
  const legSwing = Math.sin(walkPhase) * s * 0.12;
  rr(ctx, -s * 0.22, s * 0.18 + legSwing, s * 0.16, s * 0.22, 3); ctx.fill();
  rr(ctx, s * 0.06, s * 0.18 - legSwing, s * 0.16, s * 0.22, 3); ctx.fill();

  // body (white suit)
  ctx.fillStyle = '#f4f0e6';
  rr(ctx, -s * 0.3, -s * 0.18, s * 0.6, s * 0.45, s * 0.16); ctx.fill();

  // head/helmet
  ctx.fillStyle = '#f6e9d8';
  ctx.beginPath();
  ctx.arc(0, -s * 0.26, s * 0.27, 0, Math.PI * 2);
  ctx.fill();
  // blue helmet top
  ctx.fillStyle = '#4f86ff';
  ctx.beginPath();
  ctx.arc(0, -s * 0.26, s * 0.27, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-s * 0.27, -s * 0.28, s * 0.54, s * 0.05);

  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s * 0.08, -s * 0.24, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#23304a';
  ctx.beginPath();
  ctx.arc(s * 0.12, -s * 0.24, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bodyColors(inflate, base, baseDark) {
  const t = inflate / MAX_INFLATE;
  if (t <= 0) return [base, baseDark];
  // lerp toward strained pink
  return ['#ff8fb0', '#e3577f'];
}

export function drawPooka(ctx, x, y, s, inflate, ghost, anim) {
  const scale = 1 + inflate * 0.22;
  ctx.save();
  ctx.translate(x, y);
  if (ghost) ctx.globalAlpha = 0.4;
  const sq = ghost ? 1 : 1 + Math.sin(anim * 6) * 0.04;
  ctx.scale(scale * sq, scale * (2 - sq));

  if (!ghost) {
    const [c, d] = bodyColors(inflate, '#ff5a3c', '#d83a22');
    // feet
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(-s * 0.18, s * 0.28, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.18, s * 0.28, s * 0.1, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(0, s * 0.12, s * 0.34, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill();
  }

  // goggles (always visible — define the ghost eyes too)
  for (const gx of [-1, 1]) {
    ctx.fillStyle = ghost ? 'rgba(255,255,255,0.9)' : '#fff7e6';
    ctx.beginPath(); ctx.arc(gx * s * 0.14, -s * 0.04, s * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(gx * s * 0.14, -s * 0.04, s * 0.16, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#caa21f'; ctx.stroke();
    ctx.fillStyle = '#1c2230';
    const pop = inflate > 0 ? s * 0.02 : 0;
    ctx.beginPath(); ctx.arc(gx * s * 0.14, -s * 0.04, s * 0.07 + pop, 0, Math.PI * 2); ctx.fill();
  }
  // strained mouth when inflating
  if (inflate > 0 && !ghost) {
    ctx.strokeStyle = '#7a1226'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, s * 0.16, s * 0.1, 0, Math.PI); ctx.stroke();
  }
  ctx.restore();
}

export function drawFygar(ctx, x, y, s, inflate, ghost, anim, facing) {
  const scale = 1 + inflate * 0.22;
  const [fx] = facingVec(facing);
  const dir = fx < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  if (ghost) ctx.globalAlpha = 0.4;

  if (!ghost) {
    const [c, d] = bodyColors(inflate, '#5fce4a', '#3a9b2c');
    // tail
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.moveTo(-s * 0.34, 0); ctx.lineTo(-s * 0.5, -s * 0.12); ctx.lineTo(-s * 0.5, s * 0.12); ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = c;
    rr(ctx, -s * 0.36, -s * 0.24, s * 0.62, s * 0.5, s * 0.2); ctx.fill();
    // belly
    ctx.fillStyle = '#dff7c2';
    rr(ctx, -s * 0.1, -s * 0.05, s * 0.32, s * 0.26, s * 0.1); ctx.fill();
    // head
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.1, s * 0.2, 0, Math.PI * 2); ctx.fill();
    // spikes
    ctx.fillStyle = d;
    for (const sx of [-0.2, -0.02, 0.16]) {
      ctx.beginPath(); ctx.moveTo(sx * s, -s * 0.24); ctx.lineTo((sx + 0.06) * s, -s * 0.38); ctx.lineTo((sx + 0.12) * s, -s * 0.24); ctx.closePath(); ctx.fill();
    }
    // snout
    ctx.fillStyle = '#bff09a';
    rr(ctx, s * 0.28, -s * 0.06, s * 0.16, s * 0.12, 3); ctx.fill();
  }
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.16, s * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c2230';
  ctx.beginPath(); ctx.arc(s * 0.23, -s * 0.16, s * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawFire(ctx, x, y, dir, len, phase) {
  const sign = dir === Dir.LEFT ? -1 : 1;
  const h = 18;
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < len; i += 8) {
    const f = 1 - i / (len + 30);
    const flick = Math.sin(phase * 20 + i) * 3;
    ctx.fillStyle = i < len * 0.4 ? '#fff1a8' : i < len * 0.75 ? '#ff9d3c' : '#ff5530';
    ctx.beginPath();
    ctx.arc(sign * i, flick, (h * f) * (0.6 + Math.random() * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTelegraph(ctx, x, y, dir, phase) {
  const sign = dir === Dir.LEFT ? -1 : 1;
  ctx.save();
  ctx.globalAlpha = 0.4 + Math.sin(phase * 30) * 0.3;
  ctx.fillStyle = '#ffcaa0';
  ctx.beginPath();
  ctx.arc(x + sign * 14, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRock(ctx, x, y, s, state, phase) {
  ctx.save();
  ctx.translate(x, y);
  if (state === 'wobble') ctx.rotate(Math.sin(phase * 30) * 0.12);
  // boulder
  ctx.fillStyle = '#8d8f9a';
  rr(ctx, -s * 0.4, -s * 0.36, s * 0.8, s * 0.72, s * 0.22); ctx.fill();
  ctx.fillStyle = '#6f7180';
  rr(ctx, -s * 0.4, s * 0.04, s * 0.8, s * 0.32, s * 0.16); ctx.fill();
  // highlight
  ctx.fillStyle = '#c4c6cf';
  ctx.beginPath(); ctx.arc(-s * 0.12, -s * 0.14, s * 0.12, 0, Math.PI * 2); ctx.fill();
  // cracks
  ctx.strokeStyle = '#55576a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.3); ctx.lineTo(s * 0.12, 0); ctx.lineTo(-s * 0.02, s * 0.2); ctx.stroke();
  ctx.restore();
}

const VEG = {
  carrot: ['#ff8a2b', '#ff6f00'],
  turnip: ['#f3e8ff', '#c39bd3'],
  mushroom: ['#ff6b6b', '#e63946'],
  cucumber: ['#74c043', '#4a8c1c'],
  eggplant: ['#8e5bd1', '#5e35a8'],
  pepper: ['#ff5252', '#c62828'],
  tomato: ['#ff6347', '#d63031'],
  onion: ['#f6d6e8', '#c98bb0'],
  pumpkin: ['#ff9a3c', '#e8590c'],
  pineapple: ['#ffd23c', '#caa21f'],
  star: ['#ffe066', '#ffb703'],
};

export function drawVeggie(ctx, x, y, s, type, bob = 0) {
  const [c, d] = VEG[type] || VEG.star;
  ctx.save();
  ctx.translate(x, y + Math.sin(bob * 3) * 2);
  // leafy top
  ctx.fillStyle = '#4caf50';
  ctx.beginPath(); ctx.moveTo(0, -s * 0.34); ctx.lineTo(-s * 0.12, -s * 0.5); ctx.lineTo(s * 0.06, -s * 0.4); ctx.lineTo(s * 0.16, -s * 0.52); ctx.lineTo(s * 0.1, -s * 0.32); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = c;
  if (type === 'carrot') {
    ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.3); ctx.lineTo(s * 0.18, -s * 0.3); ctx.lineTo(0, s * 0.4); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.32, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = d;
  ctx.beginPath(); ctx.arc(s * 0.08, s * 0.1, s * 0.1, 0, Math.PI * 2); ctx.fill();
  // sparkle
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.05, s * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawHarpoon(ctx, px, py, tipx, tipy) {
  ctx.save();
  ctx.strokeStyle = '#ffe6b0';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(tipx, tipy);
  ctx.stroke();
  // arrow tip
  const a = Math.atan2(tipy - py, tipx - px);
  ctx.fillStyle = '#fff';
  ctx.translate(tipx, tipy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-7, -4); ctx.lineTo(-7, 4); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Small HUD life icon.
export function drawLifeIcon(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f4f0e6';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4f86ff';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.4, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#23304a';
  ctx.beginPath(); ctx.arc(s * 0.12, s * 0.02, s * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
