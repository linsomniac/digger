// AIDEV-NOTE: Bonus veggie. shouldSpawnVeggie is pure (tested); Veggie is a tiny
// entity with a lifetime. Spawns once after two rocks have fallen (faithful).
export function shouldSpawnVeggie(rocksFallen, alreadySpawned) {
  return rocksFallen >= 2 && !alreadySpawned;
}

export const VEGGIE_TYPES = [
  'carrot',
  'turnip',
  'mushroom',
  'cucumber',
  'eggplant',
  'pepper',
  'tomato',
  'onion',
  'pumpkin',
  'pineapple',
  'star',
];

export function veggieTypeForLevel(levelIndex) {
  const i = Math.max(0, Math.min(VEGGIE_TYPES.length - 1, levelIndex));
  return VEGGIE_TYPES[i];
}

export class Veggie {
  constructor(x, y, type, value, ttl = 12) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.value = value;
    this.ttl = ttl;
    this.alive = true;
    this.bob = 0; // render bob phase
  }

  update(dt) {
    if (!this.alive) return;
    this.ttl -= dt;
    this.bob += dt;
    if (this.ttl <= 0) this.alive = false;
  }
}
