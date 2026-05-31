// AIDEV-NOTE: The harpoon/pump. Hooks an enemy in front of the player and inflates
// it ONE stage per discrete button press — NO auto-repeat while held. Holding the
// button does nothing after the initial stab; you must tap again to pump again.
// Stop tapping and the enemy slowly deflates one stage at a time and is released;
// reaching MAX_INFLATE pops it. Emits events; game.js applies scoring + particles.
import {
  PUMP_REACH,
  MAX_INFLATE,
  INFLATE_DEFLATE_SEC,
  PUMP_EXTEND_SEC,
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
    this.sincePump = 0;
    const cell = pxToTile(player.x, player.y);
    const [dx, dy] = DIR_VEC[this.dir];
    this.maxLen = grid.isTunnel(cell.c + dx, cell.r + dy) ? PUMP_REACH : TILE * 0.45;
  }

  // A discrete pump tap — inflates one stage when already hooked.
  pumpPress(grid, events) {
    if (this.active && this.hooked) this._inflate(grid, events);
  }

  // Release (player moved or let go): retract the harpoon. A hooked enemy is NOT
  // reset — it keeps its current inflation and stays frozen, then deflates on its
  // own (enemies.js) over a few seconds before resuming.
  cancel() {
    if (this.hooked && this.hooked.state === 'hooked') {
      this.hooked.state = 'normal'; // inflate>0 keeps it frozen via enemy.update
      this.hooked.deflateT = 0; // start the release-deflation countdown
    }
    this.active = false;
    this.hooked = null;
    this.len = 0;
  }

  _inflate(grid, events) {
    const e = this.hooked;
    e.inflate += 1;
    e.deflateT = 0; // fresh pump resets the release countdown
    this.sincePump = 0;
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

  update(dt, grid, player, enemies, events) {
    if (!this.active) return;

    // Extend the harpoon.
    this.len = Math.min(this.maxLen, this.len + (PUMP_REACH / PUMP_EXTEND_SEC) * dt);

    if (!this.hooked) {
      const e = this._tryHook(player, enemies);
      if (e) {
        this.hooked = e;
        e.state = 'hooked';
        e.inflate = Math.max(1, e.inflate); // the stab itself is the first pump
        e.deflateT = 0;
        this.sincePump = 0;
        events.push({ type: 'hook', enemy: e });
      } else if (this.len >= this.maxLen) {
        // Missed stab, fully extended -> retract.
        this.cancel();
      }
      return;
    }

    // Hooked: lock the harpoon onto the enemy.
    const e = this.hooked;
    const [dx, dy] = DIR_VEC[this.dir];
    this.len = Math.abs(dx) * Math.abs(e.x - player.x) + Math.abs(dy) * Math.abs(e.y - player.y);

    // No auto-pump: inflation happens ONLY on discrete presses (pumpPress). If the
    // player stops tapping, the enemy slowly deflates one stage at a time; at zero
    // the harpoon retracts and the enemy is freed.
    this.sincePump += dt;
    if (this.sincePump >= INFLATE_DEFLATE_SEC) {
      this.sincePump = 0;
      e.inflate -= 1;
      if (e.inflate <= 0) {
        e.inflate = 0;
        e.state = 'normal';
        e.deflateT = 0;
        this.active = false;
        this.hooked = null;
        this.len = 0;
      }
    }
  }
}
