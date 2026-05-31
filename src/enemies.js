// AIDEV-NOTE: Pooka + Fygar. Tunnel-chase via ai.chooseTunnelDir, periodic ghost
// mode (drift through soil), Fygar horizontal fire (blocked by soil — stops at the
// first not-fully-dug block, see _fireReach), and last-enemy flee. Frozen
// while hooked (pump.js drives that). After the player runs away, a still-inflated
// enemy stays frozen and slowly deflates back to normal over a few seconds, then
// resumes. Ghosts and inflated enemies are non-lethal (fair).
import {
  Dir,
  TILE,
  GHOST_SPEED,
  GHOST_DURATION_MAX_SEC,
  FLEE_AFTER_SEC,
  FIRE_TELEGRAPH_SEC,
  FIRE_DURATION_SEC,
  FIRE_RANGE_TILES,
  INFLATE_RELEASE_SEC,
} from './constants.js';
import { pxToTile, tileToPx, nearestColCenter, nearestRowCenter } from './grid.js';
import { chooseTunnelDir, ghostStep, shouldGhost } from './ai.js';
import { stepEntity, atCellCenter } from './move.js';

function distTiles(a, b) {
  return Math.hypot((a.x - b.x) / TILE, (a.y - b.y) / TILE);
}

export class Enemy {
  constructor(type, c, r, speed, ghostPhase = 0, startDelay = 0) {
    const p = tileToPx(c, r);
    this.type = type; // 'pooka' | 'fygar'
    this.x = p.x;
    this.y = p.y;
    this.homeCell = [c, r];
    this.dir = Dir.NONE;
    this.facing = Dir.LEFT;
    this.speed = speed;
    this.state = 'normal'; // normal | ghost | hooked | fleeing | dead
    this.inflate = 0;
    this.deflateT = 0; // release-deflation timer (after the player runs away)
    this.escaped = false;
    this.startDelay = startDelay; // brief wake-up hold so the pack doesn't lurch in lockstep
    this.bornT = 0; // time alive this round (resets on respawn) — gates the wake-up hold
    this.ghostTimer = ghostPhase;
    this.ghostElapsed = 0;
    this.fireTimer = 0;
    this.fireState = 'none'; // none | telegraph | active
    this.fireT = 0;
    this.fireLen = 0;
    this.fireDir = Dir.LEFT;
    this.anim = Math.random() * 10;
  }

  reset() {
    const p = tileToPx(this.homeCell[0], this.homeCell[1]);
    this.x = p.x;
    this.y = p.y;
    this.dir = Dir.NONE;
    this.facing = Dir.LEFT;
    this.state = 'normal';
    this.inflate = 0;
    this.deflateT = 0;
    this.escaped = false;
    this.bornT = 0; // re-stagger the wake-up hold on respawn too
    this.ghostElapsed = 0;
    this.fireState = 'none';
    this.fireT = 0;
    this.fireLen = 0;
  }

  // Lethal to the player only when solid, present, and not inflated. An inflated
  // (caught / deflating) enemy is harmless to touch — so releasing one next to
  // you doesn't kill you, and you can safely run past it while it deflates.
  lethal() {
    if (this.inflate > 0) return false;
    return this.state === 'normal' || this.state === 'fleeing';
  }

  // AIDEV-NOTE: Fire line-of-sight. How far the breath can travel before hitting
  // soil, in pixels, capped at FIRE_RANGE_TILES. Fygar fire does NOT pass through
  // dirt — it stops at the first not-fully-dug block. Used both to decide whether
  // to breathe (clear shot only) and to clamp the live flame length each frame.
  _fireReach(grid, dir) {
    const cell = pxToTile(this.x, this.y);
    const sign = dir === Dir.LEFT ? -1 : 1;
    let tiles = 0;
    for (let i = 1; i <= FIRE_RANGE_TILES; i++) {
      if (!grid.isTunnel(cell.c + sign * i, cell.r)) break; // soil blocks the breath
      tiles++;
    }
    return tiles * TILE;
  }

  _maybeFire(grid, player, level) {
    if (this.type !== 'fygar' || this.fireState !== 'none') return false;
    if (this.fireTimer < level.fireInterval) return false;
    if (Math.abs(this.y - player.y) > TILE * 0.5) return false;
    const dir = player.x < this.x ? Dir.LEFT : Dir.RIGHT;
    const rel = (player.x - this.x) * (dir === Dir.RIGHT ? 1 : -1);
    // Only breathe when there is a clear line of tunnel to the player — never
    // through soil.
    if (rel <= 0 || rel > this._fireReach(grid, dir)) return false;
    this.fireState = 'telegraph';
    this.fireT = 0;
    this.fireDir = dir;
    this.facing = dir;
    return true;
  }

  _updateFire(dt, grid, events) {
    if (this.fireState === 'telegraph') {
      this.fireT += dt;
      if (this.fireT >= FIRE_TELEGRAPH_SEC) {
        this.fireState = 'active';
        this.fireT = 0;
        this.fireLen = 0;
        events.push({ type: 'fire', enemy: this });
      }
    } else if (this.fireState === 'active') {
      this.fireT += dt;
      // Grow the flame, but never past the first solid block in its path. Reach is
      // recomputed each frame: if the player digs the wall away the flame extends;
      // soil left undug keeps it short. The hitbox + render both read fireLen, so
      // clamping here makes them all stop at the wall together.
      this.fireLen = Math.min(
        FIRE_RANGE_TILES * TILE,
        this.fireLen + (FIRE_RANGE_TILES * TILE / 0.25) * dt,
        this._fireReach(grid, this.fireDir),
      );
      if (this.fireT >= FIRE_DURATION_SEC) {
        this.fireState = 'none';
        this.fireTimer = 0;
        this.fireLen = 0;
      }
    }
  }

  update(dt, grid, player, level, rng, events) {
    if (this.state === 'dead') return;
    this.anim += dt;

    // Frozen while hooked — pump.js owns inflation + position.
    if (this.state === 'hooked') return;

    // Released but still inflated: stay frozen in place and slowly deflate one
    // stage at a time. Once fully deflated it resumes normal behavior.
    if (this.inflate > 0) {
      this.deflateT += dt;
      if (this.deflateT >= INFLATE_RELEASE_SEC) {
        this.deflateT = 0;
        this.inflate = Math.max(0, this.inflate - 1);
      }
      return;
    }

    // Wake-up stagger: hold still for a beat at round start (and on respawn) so the
    // monsters don't all start moving on the same frame in the same direction.
    if (this.bornT < this.startDelay) {
      this.bornT += dt;
      this.dir = Dir.NONE;
      return;
    }

    if (this.type === 'fygar') this.fireTimer += dt;

    // Fire takes over movement while telegraphing/breathing.
    if (this.fireState !== 'none') {
      this._updateFire(dt, grid, events);
      return;
    }

    if (this.state === 'ghost') {
      const np = ghostStep(this.x, this.y, player.x, player.y, GHOST_SPEED, dt);
      this.x = np.x;
      this.y = np.y;
      this.facing = player.x < this.x ? Dir.LEFT : Dir.RIGHT;
      this.ghostElapsed += dt;
      const cell = pxToTile(this.x, this.y);
      const inTunnel = grid.isTunnel(cell.c, cell.r);
      if ((this.ghostElapsed > 0.4 && inTunnel) || this.ghostElapsed > GHOST_DURATION_MAX_SEC) {
        if (inTunnel) {
          this.x = nearestColCenter(this.x);
          this.y = nearestRowCenter(this.y);
          this.state = 'normal';
          this.ghostTimer = 0;
          this.dir = Dir.NONE;
        }
      }
      return;
    }

    if (this.state === 'fleeing') {
      const cell = pxToTile(this.x, this.y);
      const dir = chooseTunnelDir(grid, cell.c, cell.r, 0, 0, this.dir, rng);
      if (dir === Dir.NONE) {
        const np = ghostStep(this.x, this.y, TILE / 2, TILE / 2, GHOST_SPEED, dt);
        this.x = np.x;
        this.y = np.y;
      } else {
        const desired = atCellCenter(this) ? dir : this.dir;
        stepEntity(this, dt, grid, desired, this.speed * 1.15, false);
      }
      if (this.x < TILE && this.y < TILE * 1.5) {
        this.state = 'dead';
        this.escaped = true;
        events.push({ type: 'escape', enemy: this });
      }
      return;
    }

    // state === 'normal'
    if (this._maybeFire(grid, player, level)) return;

    const cell = pxToTile(this.x, this.y);
    const target = pxToTile(player.x, player.y);
    const desired = atCellCenter(this)
      ? chooseTunnelDir(grid, cell.c, cell.r, target.c, target.r, this.dir, rng)
      : this.dir;
    stepEntity(this, dt, grid, desired, this.speed, false);

    this.ghostTimer += dt;
    if (shouldGhost(this.ghostTimer, level.ghostInterval) && distTiles(this, player) > 1.5) {
      this.state = 'ghost';
      this.ghostElapsed = 0;
      this.ghostTimer = 0;
    }
  }
}

export class EnemyField {
  constructor(defs = [], speed = 60) {
    // Spread the wake-up delays (0..~0.5s) across the pack so they don't lurch into
    // motion in lockstep; the * 0.37 % 0.6 just scatters them rather than ramping.
    this.enemies = defs.map(
      (d, i) => new Enemy(d.type, d.c, d.r, speed, (i % 4) * 1.3, (i * 0.37) % 0.6),
    );
    this.aloneT = 0;
  }

  aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (e.state !== 'dead') n++;
    return n;
  }

  reset() {
    for (const e of this.enemies) e.reset();
    this.aloneT = 0;
  }

  update(dt, grid, player, level, rng, events) {
    const alive = this.aliveCount();
    if (alive === 1) {
      this.aloneT += dt;
      if (this.aloneT > FLEE_AFTER_SEC) {
        const last = this.enemies.find((e) => e.state !== 'dead');
        if (last && last.state === 'normal' && last.inflate === 0) last.state = 'fleeing';
      }
    } else {
      this.aloneT = 0;
    }
    for (const e of this.enemies) e.update(dt, grid, player, level, rng, events);
  }
}
