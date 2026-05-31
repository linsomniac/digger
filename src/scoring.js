// AIDEV-NOTE: Pure scoring tables. Faithful depth + chain scoring.
import {
  POOKA_SCORE,
  FYGAR_SCORE,
  ROCK_CHAIN_SCORE,
  VEGGIE_SCORE,
  EXTRA_LIFE_FIRST,
  EXTRA_LIFE_REPEAT,
} from './constants.js';

function clampIdx(i, len) {
  return Math.max(0, Math.min(len - 1, i | 0));
}

export function pookaScore(layer) {
  return POOKA_SCORE[clampIdx(layer, POOKA_SCORE.length)];
}

export function fygarScore(layer, horizontal) {
  const base = FYGAR_SCORE[clampIdx(layer, FYGAR_SCORE.length)];
  return horizontal ? base * 2 : base;
}

// countCrushed is 1-based (1 = first enemy hit by a single falling rock).
export function rockChainScore(countCrushed) {
  if (countCrushed < 1) return 0;
  return ROCK_CHAIN_SCORE[clampIdx(countCrushed - 1, ROCK_CHAIN_SCORE.length)];
}

// levelIndex is 0-based.
export function veggieScore(levelIndex) {
  return VEGGIE_SCORE[clampIdx(levelIndex, VEGGIE_SCORE.length)];
}

// How many extra lives a cumulative score has earned: first at EXTRA_LIFE_FIRST,
// then one every EXTRA_LIFE_REPEAT.
export function extraLifeCount(score) {
  if (score < EXTRA_LIFE_FIRST) return 0;
  return 1 + Math.floor((score - EXTRA_LIFE_FIRST) / EXTRA_LIFE_REPEAT);
}
