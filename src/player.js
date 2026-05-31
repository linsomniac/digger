// AIDEV-NOTE: Dig Dug. Lane movement + digging via shared move.js. Pump/inflation
// is owned by pump.js; the player just exposes position + facing for it.
import { PLAYER_SPEED, Dir } from './constants.js';
import { tileToPx } from './grid.js';
import { stepEntity } from './move.js';

export class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.dir = Dir.NONE;
    this.facing = Dir.RIGHT;
    this.alive = true;
    this.walkPhase = 0; // animation
    this.invuln = 0; // seconds of post-respawn invincibility
  }

  reset(cell) {
    const p = tileToPx(cell[0], cell[1]);
    this.x = p.x;
    this.y = p.y;
    this.dir = Dir.NONE;
    this.facing = Dir.RIGHT;
    this.alive = true;
    this.walkPhase = 0;
    this.invuln = 1.5;
  }

  // dir: desired direction this frame (Dir.NONE = stand still). Returns dig events.
  // blockedCells: cells the player cannot enter (resting rocks).
  move(dt, grid, dir, events, blockedCells = null) {
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    const dug = stepEntity(this, dt, grid, dir, PLAYER_SPEED, true, blockedCells);
    if (this.dir !== Dir.NONE) this.walkPhase += dt * 10;
    for (const cell of dug) events.push({ type: 'dig', cell });
    return dug;
  }

  idle(dt) {
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    this.dir = Dir.NONE;
  }
}
