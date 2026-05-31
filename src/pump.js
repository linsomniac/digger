// AIDEV-NOTE: The harpoon/pump. Hooks an enemy in front of the player, inflates it
// on each pump (auto-inflates while held, snappier on taps), deflates if you stop,
// and pops it at MAX_INFLATE. Emits events; game.js applies scoring + particles.
import {
  PUMP_REACH,
  MAX_INFLATE,
  INFLATE_DEFLATE_SEC,
  PUMP_EXTEND_SEC,
  PUMP_INFLATE_COOLDOWN,
  TILE,
  DIR_VEC,
  Dir,
} from './constants.js';
import { pxToTile } from './grid.js';

export class Pump {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.dir = Dir.RIGHT;
    this.len = 0;
    this.maxLen = PUMP_REACH;
    this.hooked = null;
    this.autoT = 0;
    this.sincePump = 0;
  }

  tip(player) {
    const [dx, dy] = DIR_VEC[this.dir];
    return { x: player.x + dx * this.len, y: player.y + dy * this.len };
  }

  fire(player, grid) {
    if (this.active) return;
    this.active = true;
    this.dir = player.facing || Dir.RIGHT;
    this.len = 0;
    this.hooked = null;
    this.autoT = 0;
    this.sincePump = 0;
    const cell = pxToTile(player.x, player.y);
    const [dx, dy] = DIR_VEC[this.dir];
    this.maxLen = grid.isTunnel(cell.c + dx, cell.r + dy) ? PUMP_REACH : TILE * 0.45;
  }

  // A discrete pump tap — inflates immediately when already hooked.
  pumpPress(grid, events) {
    if (this.active && this.hooked) this._inflate(grid, events);
  }

  // Release (player moved or let go with no hook): retract + free the enemy.
  cancel() {
    if (this.hooked && this.hooked.state === 'hooked') {
      this.hooked.state = 'normal';
      this.hooked.inflate = 0;
    }
    this.active = false;
    this.hooked = null;
    this.len = 0;
  }

  _inflate(grid, events) {
    const e = this.hooked;
    e.inflate += 1;
    this.sincePump = 0;
    this.autoT = 0;
    events.push({ type: 'inflate', enemy: e });
    if (e.inflate >= MAX_INFLATE) {
      const r = pxToTile(e.x, e.y).r;
      const horizontal = this.dir === Dir.LEFT || this.dir === Dir.RIGHT;
      events.push({ type: 'pop', enemy: e, layer: grid.layerAt(r), horizontal });
      e.state = 'dead';
      e.inflate = 0;
      this.active = false;
      this.hooked = null;
      this.len = 0;
    }
  }

  _tryHook(player, enemies) {
    const horiz = this.dir === Dir.LEFT || this.dir === Dir.RIGHT;
    const sign = this.dir === Dir.RIGHT || this.dir === Dir.DOWN ? 1 : -1;
    for (const e of enemies) {
      if (e.state !== 'normal' && e.state !== 'fleeing') continue;
      if (horiz) {
        if (Math.abs(e.y - player.y) > TILE * 0.5) continue;
        const rel = (e.x - player.x) * sign;
        if (rel > 0 && rel <= this.len + TILE * 0.45) return e;
      } else {
        if (Math.abs(e.x - player.x) > TILE * 0.5) continue;
        const rel = (e.y - player.y) * sign;
        if (rel > 0 && rel <= this.len + TILE * 0.45) return e;
      }
    }
    return null;
  }

  update(dt, grid, player, enemies, pumpHeld, events) {
    if (!this.active) return;

    // Extend the harpoon.
    this.len = Math.min(this.maxLen, this.len + (PUMP_REACH / PUMP_EXTEND_SEC) * dt);

    if (!this.hooked) {
      const e = this._tryHook(player, enemies);
      if (e) {
        this.hooked = e;
        e.state = 'hooked';
        e.inflate = Math.max(1, e.inflate);
        this.sincePump = 0;
        this.autoT = 0;
        events.push({ type: 'hook', enemy: e });
      } else if (!pumpHeld && this.len >= this.maxLen) {
        // Missed stab, button released -> retract.
        this.cancel();
        return;
      }
    }

    if (this.hooked) {
      const e = this.hooked;
      // Lock harpoon onto the enemy.
      const [dx, dy] = DIR_VEC[this.dir];
      this.len = Math.abs(dx) * Math.abs(e.x - player.x) + Math.abs(dy) * Math.abs(e.y - player.y);

      if (pumpHeld) {
        this.autoT += dt;
        if (this.autoT >= PUMP_INFLATE_COOLDOWN) this._inflate(grid, events);
      } else {
        this.sincePump += dt;
        if (this.sincePump >= INFLATE_DEFLATE_SEC) {
          this.sincePump = 0;
          e.inflate -= 1;
          if (e.inflate <= 0) {
            e.inflate = 0;
            e.state = 'normal';
            this.active = false;
            this.hooked = null;
            this.len = 0;
          }
        }
      }
    }
  }
}
