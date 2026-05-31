// AIDEV-NOTE: Pure enemy decision logic. No DOM, no entity state mutation —
// takes a grid + positions and returns a direction. Unit-tested.
import { Dir, DIR_VEC, OPPOSITE } from './constants.js';

const ALL_DIRS = [Dir.UP, Dir.DOWN, Dir.LEFT, Dir.RIGHT];

// Greedy tunnel pathing: among passable neighbours, pick the one that reduces
// Manhattan distance to the target. Avoid reversing unless it is the only option
// (prevents jittering back and forth in a corridor). rng() in [0,1) breaks ties.
export function chooseTunnelDir(grid, fromC, fromR, targetC, targetR, currentDir, rng = Math.random) {
  let passable = ALL_DIRS.filter((d) => {
    const [dx, dy] = DIR_VEC[d];
    return grid.isTunnel(fromC + dx, fromR + dy);
  });

  if (passable.length === 0) return Dir.NONE;

  // Don't reverse unless it's a dead end.
  if (currentDir && currentDir !== Dir.NONE && passable.length > 1) {
    const noReverse = passable.filter((d) => d !== OPPOSITE[currentDir]);
    if (noReverse.length > 0) passable = noReverse;
  }

  const dist = (d) => {
    const [dx, dy] = DIR_VEC[d];
    return Math.abs(fromC + dx - targetC) + Math.abs(fromR + dy - targetR);
  };

  let best = Infinity;
  for (const d of passable) best = Math.min(best, dist(d));
  const tied = passable.filter((d) => dist(d) === best);
  return tied[Math.floor(rng() * tied.length) % tied.length];
}

// Straight-line drift through dirt toward a point (ghost mode). Clamps at target.
export function ghostStep(x, y, tx, ty, speed, dt) {
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  const step = speed * dt;
  if (dist <= step || dist === 0) return { x: tx, y: ty };
  return { x: x + (dx / dist) * step, y: y + (dy / dist) * step };
}

export function shouldGhost(timer, interval) {
  return timer >= interval;
}
