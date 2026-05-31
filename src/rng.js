// AIDEV-NOTE: Tiny deterministic PRNG (mulberry32). Pure + DOM-free so it loads
// under node:test. Used by levels.js to generate a fixed-but-distinct layout per
// level: same seed -> same sequence, so level N looks identical every game.
// Deliberately NOT Math.random — that would make layouts differ between games.

// Returns a function () -> float in [0, 1). `seed` is coerced to a uint32.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Inclusive integer in [lo, hi].
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// In-place Fisher-Yates using the supplied rng. Returns the same array.
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
