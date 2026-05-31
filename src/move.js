// AIDEV-NOTE: Shared lane-constrained movement for player + enemies. Entities glide
// along row/column lanes; perpendicular turns happen only at cell centers. The loop
// carries leftover distance across a center so turning is same-frame and speed is
// preserved. Player digs (dig=true) so soil never blocks; enemies (dig=false) stop
// at soil. CRITICAL: arrival snapping is what makes intersections turnable.
import { DIR_VEC, OPPOSITE, Dir, TILE } from './constants.js';
import {
  isAlignedToCol,
  isAlignedToRow,
  nearestColCenter,
  nearestRowCenter,
  pxToTile,
  tileToPx,
} from './grid.js';

export function atCellCenter(ent) {
  return isAlignedToCol(ent.x, 0.75) && isAlignedToRow(ent.y, 0.75);
}

// Moves ent toward `dir` by speed*dt. Returns [c,r] cells freshly dug (dig=true only).
export function stepEntity(ent, dt, grid, dir, speed, dig) {
  const dug = [];
  if (!dir || dir === Dir.NONE) {
    ent.dir = Dir.NONE;
    return dug;
  }

  // Along-axis change and reversal are allowed immediately; perpendicular waits
  // for a center (handled in the loop).
  if (ent.dir === Dir.NONE || dir === ent.dir || dir === OPPOSITE[ent.dir]) ent.dir = dir;

  let remaining = speed * dt;
  let guard = 0;
  while (remaining > 1e-6 && guard++ < 8) {
    if (dir !== ent.dir && atCellCenter(ent)) {
      ent.x = nearestColCenter(ent.x);
      ent.y = nearestRowCenter(ent.y);
      ent.dir = dir; // perpendicular turn at the intersection
    }

    const d = ent.dir;
    const [dx, dy] = DIR_VEC[d];
    if (dx === 0 && dy === 0) break;

    if (dx !== 0) ent.y = nearestRowCenter(ent.y);
    if (dy !== 0) ent.x = nearestColCenter(ent.x);

    const cell = pxToTile(ent.x, ent.y);
    const ahead = { c: cell.c + dx, r: cell.r + dy };
    const blocked =
      !grid.inBounds(ahead.c, ahead.r) || (!dig && grid.isSolid(ahead.c, ahead.r));
    if (blocked) {
      ent.x = nearestColCenter(ent.x);
      ent.y = nearestRowCenter(ent.y);
      ent.facing = d;
      break;
    }

    if (dig && grid.dig(ahead.c, ahead.r)) dug.push([ahead.c, ahead.r]);

    const aheadCenter = tileToPx(ahead.c, ahead.r);
    const cur = dx !== 0 ? ent.x : ent.y;
    const tgt = dx !== 0 ? aheadCenter.x : aheadCenter.y;
    const distToCenter = Math.abs(tgt - cur);
    const move = Math.min(remaining, distToCenter);

    if (dx !== 0) ent.x += dx * move;
    else ent.y += dy * move;
    remaining -= move;
    ent.facing = d;

    if (move >= distToCenter - 1e-6) {
      // Arrived at the ahead cell center — snap, then loop may turn again.
      if (dx !== 0) ent.x = aheadCenter.x;
      else ent.y = aheadCenter.y;
    } else {
      break;
    }
  }
  return dug;
}
