// AIDEV-NOTE: All canvas drawing. Soil bands + organically-rounded tunnels, then
// entities via sprites.js, particles, HUD, and overlay screens. Pure draw — reads
// game state, mutates nothing. Playfield is drawn offset by HUD_H.
import {
  TILE, COLS, ROWS, HUD_H, CANVAS_W, CANVAS_H,
  PLAYFIELD_W, PLAYFIELD_H, LAYER_COLORS, LAYER_COLORS_DARK,
  TUNNEL_COLOR, BG_COLOR, Dir,
} from './constants.js';
import {
  drawDigDug, drawPooka, drawFygar, drawRock, drawVeggie,
  drawHarpoon, drawFire, drawTelegraph, drawLifeIcon,
} from './sprites.js';

function roundRectVar(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

// deterministic per-cell pseudo-random for soil speckle
function hash(c, r) {
  const n = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawWorld(ctx, grid, layerColors) {
  // soil bands
  for (let r = 0; r < ROWS; r++) {
    const l = grid.layerAt(r);
    ctx.fillStyle = layerColors[l] || LAYER_COLORS[l];
    ctx.fillRect(0, r * TILE, PLAYFIELD_W, TILE);
  }
  // speckle texture
  for (let r = 0; r < ROWS; r++) {
    ctx.fillStyle = LAYER_COLORS_DARK[grid.layerAt(r)];
    for (let c = 0; c < COLS; c++) {
      if (!grid.isSolid(c, r)) continue;
      const h1 = hash(c, r);
      const h2 = hash(c + 9, r + 3);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(c * TILE + h1 * TILE * 0.8 + 2, r * TILE + h2 * TILE * 0.8 + 2, 3, 3);
      ctx.fillRect(c * TILE + h2 * TILE * 0.7 + 6, r * TILE + h1 * TILE * 0.6 + 8, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
  // layer separators
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let l = 1; l < 4; l++) ctx.fillRect(0, l * 3 * TILE - 1, PLAYFIELD_W, 2);

  // carve tunnels (rounded, neighbour-aware so corridors connect smoothly)
  const R = TILE * 0.42;
  ctx.fillStyle = TUNNEL_COLOR;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid.isSolid(c, r)) continue;
      const up = grid.isTunnel(c, r - 1);
      const dn = grid.isTunnel(c, r + 1);
      const lf = grid.isTunnel(c - 1, r);
      const rt = grid.isTunnel(c + 1, r);
      const tl = up || lf ? 0 : R;
      const tr = up || rt ? 0 : R;
      const br = dn || rt ? 0 : R;
      const bl = dn || lf ? 0 : R;
      roundRectVar(ctx, c * TILE, r * TILE, TILE, TILE, tl, tr, br, bl);
      ctx.fill();
    }
  }
  // soft top edge shading on tunnels for depth
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid.isTunnel(c, r) && grid.isSolid(c, r - 1)) {
        ctx.fillRect(c * TILE + 3, r * TILE, TILE - 6, 4);
      }
    }
  }
}

function drawEntities(ctx, game) {
  // rocks
  for (const rk of game.rocks.rocks) {
    if (rk.state === 'broken') continue;
    drawRock(ctx, rk.x, rk.y, TILE, rk.state, rk.wobbleT);
  }
  // veggie
  if (game.veggie && game.veggie.alive) {
    drawVeggie(ctx, game.veggie.x, game.veggie.y, TILE * 0.9, game.veggie.type, game.veggie.bob);
  }
  // enemies + fire
  for (const e of game.enemies.enemies) {
    if (e.state === 'dead') continue;
    const ghost = e.state === 'ghost';
    if (e.type === 'pooka') drawPooka(ctx, e.x, e.y, TILE * 0.92, e.inflate, ghost, e.anim);
    else drawFygar(ctx, e.x, e.y, TILE * 0.92, e.inflate, ghost, e.anim, e.facing);
    if (e.fireState === 'telegraph') drawTelegraph(ctx, e.x, e.y, e.fireDir, e.fireT);
    if (e.fireState === 'active') {
      const ox = e.x + (e.fireDir === Dir.LEFT ? -TILE * 0.4 : TILE * 0.4);
      drawFire(ctx, ox, e.y, e.fireDir, e.fireLen, e.fireT);
    }
  }
  // player + harpoon
  const p = game.player;
  if (p.alive) drawDigDug(ctx, p.x, p.y, TILE * 0.95, p.facing, p.walkPhase, p.invuln);
  if (game.pump.active && p.alive) {
    const tip = game.pump.tip(p);
    drawHarpoon(ctx, p.x, p.y, tip.x, tip.y);
  }
  // particles
  game.particles.draw(ctx);
  // floating score popups (on top, so they stay readable)
  game.floaters.draw(ctx);
}

function drawHUD(ctx, game) {
  ctx.fillStyle = '#120c1e';
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.fillStyle = 'rgba(255,210,127,0.15)';
  ctx.fillRect(0, HUD_H - 2, CANVAS_W, 2);

  ctx.font = '13px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe6b0';
  ctx.fillText(`SCORE ${String(game.score).padStart(6, '0')}`, 8, HUD_H / 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(`HI ${String(game.highScore).padStart(6, '0')}`, CANVAS_W / 2 - 26, HUD_H / 2);

  // round indicator
  ctx.textAlign = 'right';
  ctx.fillStyle = '#c8f7a0';
  ctx.fillText(`ROUND ${game.level.index}`, CANVAS_W - 8, HUD_H / 2);

  // lives icons (just left of round text)
  let lx = CANVAS_W - 96;
  for (let i = 0; i < Math.min(game.lives, 5); i++) {
    drawLifeIcon(ctx, lx, HUD_H / 2, TILE * 0.6);
    lx -= 18;
  }
}

function panel(ctx, lines) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,5,16,0.72)';
  ctx.fillRect(0, HUD_H, CANVAS_W, PLAYFIELD_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = HUD_H + PLAYFIELD_H / 2 - (lines.length - 1) * 18;
  for (const ln of lines) {
    ctx.font = `${ln.size || 18}px ui-monospace, monospace`;
    ctx.fillStyle = ln.color || '#ffe6b0';
    ctx.fillText(ln.text, CANVAS_W / 2, y);
    y += (ln.gap || 30);
  }
  ctx.restore();
}

export function renderGame(ctx, game) {
  // shake
  let sx = 0, sy = 0;
  if (game.shake > 0) {
    sx = (Math.random() - 0.5) * game.shake;
    sy = (Math.random() - 0.5) * game.shake;
  }
  ctx.save();
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.translate(sx, sy + HUD_H);
  drawWorld(ctx, game.grid, game.level.layerColors);
  drawEntities(ctx, game);
  ctx.restore();

  drawHUD(ctx, game);

  // overlays
  if (game.state === 'title') {
    panel(ctx, [
      { text: 'DIGGER', size: 40, color: '#ffd27f', gap: 34 },
      { text: 'a Dig Dug throwback', size: 13, color: '#9fd8ff', gap: 40 },
      { text: 'PRESS SPACE / TAP TO DIG IN', size: 14, color: '#fff', gap: 28 },
      { text: `HI SCORE  ${String(game.highScore).padStart(6, '0')}`, size: 12, color: '#c8f7a0', gap: 24 },
      { text: 'Arrows/WASD move · Space pump · P pause · M mute', size: 10, color: '#a99', gap: 20 },
    ]);
  } else if (game.state === 'ready') {
    panel(ctx, [
      { text: `ROUND ${game.level.index}`, size: 26, color: '#ffd27f', gap: 34 },
      { text: 'READY!', size: 20, color: '#fff', gap: 24 },
    ]);
  } else if (game.state === 'levelclear') {
    panel(ctx, [{ text: 'ROUND CLEAR!', size: 26, color: '#c8f7a0', gap: 24 }]);
  } else if (game.state === 'paused') {
    panel(ctx, [
      { text: 'PAUSED', size: 28, color: '#ffd27f', gap: 30 },
      { text: 'press P to resume', size: 12, color: '#fff', gap: 20 },
    ]);
  } else if (game.state === 'gameover') {
    const lines = [{ text: 'GAME OVER', size: 32, color: '#ff8f8f', gap: 36 }];
    if (game.newHigh) lines.push({ text: 'NEW HIGH SCORE!', size: 16, color: '#ffe066', gap: 30 });
    lines.push({ text: `SCORE  ${String(game.score).padStart(6, '0')}`, size: 16, color: '#fff', gap: 30 });
    lines.push({ text: 'PRESS SPACE / TAP', size: 13, color: '#9fd8ff', gap: 20 });
    panel(ctx, lines);
  }

  ctx.restore();
}
