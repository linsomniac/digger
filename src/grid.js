// AIDEV-NOTE: The tile world. DOM-free so it is unit-testable under node:test.
// cells: 1 = solid soil, 0 = empty tunnel. Out-of-bounds reads as solid so it
// blocks movement and supports rocks at the playfield edges.
import { COLS, ROWS, TILE, LAYER_ROWS, NUM_LAYERS } from './constants.js';

export class Grid {
  constructor(cols = COLS, rows = ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.cells = new Uint8Array(cols * rows).fill(1);
  }

  idx(c, r) {
    return r * this.cols + c;
  }

  inBounds(c, r) {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  isSolid(c, r) {
    if (!this.inBounds(c, r)) return true;
    return this.cells[this.idx(c, r)] === 1;
  }

  isTunnel(c, r) {
    return this.inBounds(c, r) && this.cells[this.idx(c, r)] === 0;
  }

  // Returns true if a solid cell was actually cleared (used for dig SFX/particles).
  dig(c, r) {
    if (!this.inBounds(c, r)) return false;
    const i = this.idx(c, r);
    if (this.cells[i] === 1) {
      this.cells[i] = 0;
      return true;
    }
    return false;
  }

  setSolid(c, r, solid) {
    if (this.inBounds(c, r)) this.cells[this.idx(c, r)] = solid ? 1 : 0;
  }

  layerAt(r) {
    const l = Math.floor(r / LAYER_ROWS);
    return Math.max(0, Math.min(NUM_LAYERS - 1, l));
  }

  reset() {
    this.cells.fill(1);
  }

  // Inclusive rectangle carve.
  carveRect(c0, r0, c1, r1) {
    const a = Math.min(c0, c1);
    const b = Math.max(c0, c1);
    const d = Math.min(r0, r1);
    const e = Math.max(r0, r1);
    for (let r = d; r <= e; r++) {
      for (let c = a; c <= b; c++) this.setSolid(c, r, false);
    }
  }

  carveCells(list) {
    for (const [c, r] of list) this.setSolid(c, r, false);
  }
}

// --- pixel <-> tile helpers (playfield coordinates; y=0 is top of playfield) ---

export function tileToPx(c, r) {
  return { x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 };
}

export function pxToTile(x, y) {
  return { c: Math.floor(x / TILE), r: Math.floor(y / TILE) };
}

export function nearestColCenter(x) {
  return Math.round((x - TILE / 2) / TILE) * TILE + TILE / 2;
}

export function nearestRowCenter(y) {
  return Math.round((y - TILE / 2) / TILE) * TILE + TILE / 2;
}

export function isAlignedToCol(x, eps = 0.01) {
  return Math.abs(x - nearestColCenter(x)) <= eps;
}

export function isAlignedToRow(y, eps = 0.01) {
  return Math.abs(y - nearestRowCenter(y)) <= eps;
}
