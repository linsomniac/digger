// AIDEV-NOTE: Tiny particle system for juice (dirt puffs, pop bursts, rock shards,
// veggie sparkles). Bounded, allocation-light, DOM-only at draw time.
export class Particles {
  constructor() {
    this.list = [];
  }

  _add(p) {
    if (this.list.length < 400) this.list.push(p);
  }

  burst(x, y, color, n = 12, speed = 90) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const s = speed * (0.5 + Math.random());
      this._add({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.3,
        max: 0.8,
        size: 2 + Math.random() * 3,
        color,
        grav: 60,
      });
    }
  }

  dirt(x, y, color) {
    for (let i = 0; i < 4; i++) {
      this._add({
        x, y,
        vx: (Math.random() - 0.5) * 50,
        vy: -Math.random() * 40,
        life: 0.3 + Math.random() * 0.2,
        max: 0.5,
        size: 2 + Math.random() * 2,
        color,
        grav: 200,
      });
    }
  }

  shards(x, y, color) {
    for (let i = 0; i < 14; i++) {
      this._add({
        x, y,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 120,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        size: 2 + Math.random() * 3,
        color,
        grav: 320,
      });
    }
  }

  sparkle(x, y, color = '#fff6c8') {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 80;
      this._add({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life: 0.6 + Math.random() * 0.4,
        max: 1.0,
        size: 2 + Math.random() * 2,
        color,
        grav: 40,
      });
    }
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
