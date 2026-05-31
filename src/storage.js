// AIDEV-NOTE: localStorage persistence, namespaced + crash-tolerant so the game
// still runs in private-mode / storage-disabled browsers.
const HS_KEY = 'digger.highScore';
const MUTE_KEY = 'digger.muted';

function read(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    globalThis.localStorage?.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

export function getHighScore() {
  const n = parseInt(read(HS_KEY) ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function setHighScore(n) {
  write(HS_KEY, Math.max(0, Math.floor(n)));
}

export function getMuted() {
  return read(MUTE_KEY) === '1';
}

export function setMuted(muted) {
  write(MUTE_KEY, muted ? '1' : '0');
}
