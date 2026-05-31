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

  // crushables: array of {x, y, alive} (player + enemies). Returns event list:
  //   {type:'start', rock} | {type:'crush', rock, entity, chainIndex} | {type:'land', rock}
  update(dt, grid, crushables) {
    const events = [];

    for (const rk of this.rocks) {
      if (rk.state === 'broken') {
        rk.shardT += dt;
        if (rk.shardT > 0.6) rk.dead = true;
        continue;
      }

      if (rk.state === 'idle') {
        const occ = this.occupiedSet(rk);
        if (!isSupported(grid, rk.c, rk.r, occ)) {
          rk.state = 'wobble';
          rk.wobbleT = 0;
        }
        continue;
      }

      if (rk.state === 'wobble') {
        // If something re-supports it (rare), settle again.
        const occ = this.occupiedSet(rk);
        if (isSupported(grid, rk.c, rk.r, occ)) {
          rk.state = 'idle';
          continue;
        }
        rk.wobbleT += dt;
        if (rk.wobbleT >= ROCK_WOBBLE_SEC) {
          rk.state = 'falling';
          rk.landRow = fallTargetRow(grid, rk.c, rk.r, occ);
          rk.crushed.clear();
          events.push({ type: 'start', rock: rk });
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
