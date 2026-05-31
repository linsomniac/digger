// AIDEV-NOTE: Rocks. Pure support/fall logic (isSupported, fallTargetRow) is
// unit-tested; Rock/RockField add the wobble->fall->shatter lifecycle, crush
// detection, and chain tracking. RockField.update returns events; the caller
// (game.js) applies scoring + kills so this module stays DOM-free.
import { TILE, ROCK_WOBBLE_SEC, ROCK_FALL_SPEED } from './constants.js';
import { tileToPx } from './grid.js';

const key = (c, r) => `${c},${r}`;

// A rock is supported if the cell directly below is solid soil, the floor, or
// another resting rock.
export function isSupported(grid, c, r, occupied) {
  if (grid.isSolid(c, r + 1)) return true; // solid soil or out-of-bounds floor
  return occupied.has(key(c, r + 1));
}

// Row the rock will come to rest in: the last empty cell before a solid/rock/floor.
export function fallTargetRow(grid, c, r, occupied) {
  let tr = r;
  while (grid.isTunnel(c, tr + 1) && !occupied.has(key(c, tr + 1))) tr++;
  return tr;
}

export class Rock {
  constructor(c, r) {
    this.c = c;
    this.r = r;
    const p = tileToPx(c, r);
    this.x = p.x;
    this.y = p.y;
    this.state = 'idle'; // idle | wobble | falling | broken
    this.wobbleT = 0;
    this.held = false; // player is propping it up from directly below
    this.landRow = r;
    this.crushed = new Set(); // entity refs crushed during the current fall
    this.shardT = 0;
    this.dead = false; // safe to remove from the field
  }

  resting() {
    return this.state === 'idle' || this.state === 'wobble';
  }
}

export class RockField {
  constructor(cells = []) {
    this.rocks = cells.map(([c, r]) => new Rock(c, r));
  }

  occupiedSet(except = null) {
    const s = new Set();
    for (const rk of this.rocks) {
      if (rk === except || rk.state === 'broken') continue;
      if (rk.resting()) s.add(key(rk.c, rk.r));
    }
    return s;
  }

  // Cells of all resting rocks — passed to the player's movement so a suspended
  // rock blocks entry (the player props it up by pushing into it from below).
  restingCells() {
    const s = new Set();
    for (const rk of this.rocks) {
      if (rk.resting()) s.add(key(rk.c, rk.r));
    }
    return s;
  }

  // A rock is "held" when the player is in the cell directly below it AND is
  // actively digging upward — propping it up so the fall timer can't start.
  _isHeld(rk, player, diggingUp) {
    if (!diggingUp || !player || player.alive === false) return false;
    const pc = Math.floor(player.x / TILE);
    const pr = Math.floor(player.y / TILE);
    return pc === rk.c && pr === rk.r + 1;
  }

  // crushables: array of {x, y, alive} (player + enemies). player + playerDiggingUp
  // drive the "hold the rock up" mechanic. Returns event list:
  //   {type:'start', rock} | {type:'crush', rock, entity, chainIndex} | {type:'land', rock}
  update(dt, grid, crushables, player = null, playerDiggingUp = false) {
    const events = [];

    for (const rk of this.rocks) {
      if (rk.state === 'broken') {
        rk.shardT += dt;
        if (rk.shardT > 0.6) rk.dead = true;
        continue;
      }

      if (rk.state === 'idle' || rk.state === 'wobble') {
        const occ = this.occupiedSet(rk);
        if (isSupported(grid, rk.c, rk.r, occ)) {
          // Settled (or re-supported): reset.
          rk.state = 'idle';
          rk.wobbleT = 0;
          rk.held = false;
          continue;
        }

        // Unsupported. If the player is propping it up, freeze the countdown;
        // the fall timer only runs once they stop digging up / move away.
        rk.held = this._isHeld(rk, player, playerDiggingUp);
        if (rk.state === 'idle') rk.state = 'wobble';
        if (rk.held) {
          rk.wobbleT = 0;
        } else {
          rk.wobbleT += dt;
          if (rk.wobbleT >= ROCK_WOBBLE_SEC) {
            rk.state = 'falling';
            rk.landRow = fallTargetRow(grid, rk.c, rk.r, occ);
            rk.crushed.clear();
            events.push({ type: 'start', rock: rk });
          }
        }
        continue;
      }

      if (rk.state === 'falling') {
        rk.y += ROCK_FALL_SPEED * dt;
        rk.r = Math.floor(rk.y / TILE);

        // Crush anything overlapping in this column.
        for (const e of crushables) {
          if (!e || e.alive === false || rk.crushed.has(e)) continue;
          if (Math.floor(e.x / TILE) === rk.c && Math.abs(e.y - rk.y) < TILE * 0.55) {
            rk.crushed.add(e);
            events.push({ type: 'crush', rock: rk, entity: e, chainIndex: rk.crushed.size });
          }
        }

        const landY = tileToPx(rk.c, rk.landRow).y;
        if (rk.y >= landY) {
          rk.y = landY;
          rk.r = rk.landRow;
          rk.state = 'broken';
          rk.shardT = 0;
          events.push({ type: 'land', rock: rk });
        }
      }
    }

    // Reap finished shards.
    this.rocks = this.rocks.filter((rk) => !rk.dead);
    return events;
  }
}
