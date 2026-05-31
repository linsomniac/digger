// AIDEV-NOTE: Unified keyboard + touch input. desiredDir() returns the most
// recently pressed movement direction still held (intuitive turning). Edge flags
// (pressed*) are cleared by endFrame() each tick. onGesture fires once for audio unlock.
import { Dir } from './constants.js';

const KEY_DIR = {
  ArrowUp: Dir.UP, KeyW: Dir.UP,
  ArrowDown: Dir.DOWN, KeyS: Dir.DOWN,
  ArrowLeft: Dir.LEFT, KeyA: Dir.LEFT,
  ArrowRight: Dir.RIGHT, KeyD: Dir.RIGHT,
};

export class Input {
  constructor() {
    this.held = { up: false, down: false, left: false, right: false, pump: false };
    this.pressedStart = false;
    this.pressedPause = false;
    this.pressedMute = false;
    this.pressedPump = false;
    this.dirStack = [];
    this.onGesture = null;
    this._gestured = false;
  }

  _gesture() {
    if (!this._gestured && this.onGesture) {
      this._gestured = true;
      this.onGesture();
    }
  }

  _pushDir(d) {
    if (!this.held[d]) {
      this.held[d] = true;
      this.dirStack = this.dirStack.filter((x) => x !== d);
      this.dirStack.push(d);
    }
  }

  _releaseDir(d) {
    this.held[d] = false;
    this.dirStack = this.dirStack.filter((x) => x !== d);
  }

  desiredDir() {
    for (let i = this.dirStack.length - 1; i >= 0; i--) {
      if (this.held[this.dirStack[i]]) return this.dirStack[i];
    }
    return Dir.NONE;
  }

  endFrame() {
    this.pressedStart = false;
    this.pressedPause = false;
    this.pressedMute = false;
    this.pressedPump = false;
  }

  attach(doc = document) {
    doc.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const d = KEY_DIR[e.code];
      if (d) {
        e.preventDefault();
        this._gesture();
        this._pushDir(d);
        this.pressedStart = true; // any key starts/advances menus
        return;
      }
      if (e.code === 'Space' || e.code === 'KeyZ') {
        e.preventDefault();
        this._gesture();
        if (!this.held.pump) this.pressedPump = true;
        this.held.pump = true;
        this.pressedStart = true;
        return;
      }
      if (e.code === 'Enter') { this._gesture(); this.pressedStart = true; return; }
      if (e.code === 'KeyP') { this.pressedPause = true; return; }
      if (e.code === 'KeyM') { this.pressedMute = true; return; }
    });

    doc.addEventListener('keyup', (e) => {
      const d = KEY_DIR[e.code];
      if (d) this._releaseDir(d);
      if (e.code === 'Space' || e.code === 'KeyZ') this.held.pump = false;
    });

    // Touch / pointer controls.
    const markTouch = () => document.body.classList.add('touch');

    const dpad = document.getElementById('dpad');
    if (dpad) {
      dpad.querySelectorAll('button[data-dir]').forEach((btn) => {
        const d = btn.getAttribute('data-dir');
        const down = (ev) => { ev.preventDefault(); markTouch(); this._gesture(); this._pushDir(d); };
        const up = (ev) => { ev.preventDefault(); this._releaseDir(d); };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('pointercancel', up);
      });
    }

    const pumpBtn = document.getElementById('pump');
    if (pumpBtn) {
      pumpBtn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); markTouch(); this._gesture();
        this.pressedPump = true; this.held.pump = true;
      });
      const up = (ev) => { ev.preventDefault(); this.held.pump = false; };
      pumpBtn.addEventListener('pointerup', up);
      pumpBtn.addEventListener('pointerleave', up);
      pumpBtn.addEventListener('pointercancel', up);
    }

    const muteBtn = document.getElementById('btnMute');
    if (muteBtn) muteBtn.addEventListener('click', () => { this._gesture(); this.pressedMute = true; });
    const pauseBtn = document.getElementById('btnPause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => { this.pressedPause = true; });

    // Tap on the playfield to start / advance menus.
    const canvas = document.getElementById('game');
    if (canvas) {
      canvas.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType === 'touch') markTouch();
        this._gesture();
        this.pressedStart = true;
      });
    }

    window.addEventListener('blur', () => {
      this.held = { up: false, down: false, left: false, right: false, pump: false };
      this.dirStack = [];
    });
  }
}
