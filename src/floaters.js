// AIDEV-NOTE: Floating score popups. When you score at a spot — a monster popped or
// crushed, a veggie grabbed — the points briefly rise and fade where it happened.
// State/lifetime is DOM-free + unit-tested; render.js does the canvas text. Bounded
// list, allocation-light, matching the Particles module's shape.
const RISE = 24; // px/sec the number drifts upward
const LIFE = 0.9; // seconds visible
const MAX = 40; // hard cap so a chain of pops can't grow it unbounded

// Full opacity for most of the life, then a smooth fade over the last 40%.
export function floaterAlpha(t, life) {
  const k = t / life;
  return k < 0.6 ? 1 : Math.max(0, (1 - k) / 0.4);
}

export class Floaters {
  constructor() {
    this.list = [];
  }

  // x,y: playfield pixels (where it happened). text: the score. color: CSS color.
  add(x, y, text, color = '#ffffff') {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ x, y, text: String(text), color, t: 0, life: LIFE });
  }

  update(dt) {
    for (const f of this.list) {
      f.t += dt;
      f.y -= RISE * dt;
    }
    this.list = this.list.filter((f) => f.t < f.life);
  }

  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px ui-monospace, monospace';
    for (const f of this.list) {
      const y = Math.max(7, f.y); // don't let it drift up into the HUD strip
      ctx.globalAlpha = floaterAlpha(f.t, f.life);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(f.text, f.x + 1, y + 1); // drop shadow for legibility on any tile
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
