// AIDEV-NOTE: Procedural Web Audio engine — oscillator/noise SFX + an ORIGINAL
// looping chiptune that plays only while the player moves (faithful). No audio
// files. AudioContext is created/resumed on the first user gesture (unlock()).
const BASE = 523.25; // C5
const semi = (s) => BASE * Math.pow(2, s / 12);

// Original jaunty loop (not the copyrighted Dig Dug theme).
const MELODY = [0, 7, 12, 7, 4, 7, 4, 0, 5, 9, 12, 9, 7, 4, 2, 0];
const BASS = [-24, -17, -29, -22]; // C2, F2-ish roots cycling

export class AudioEngine {
  constructor(muted = false) {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = muted;
    this.moving = false;
    this.stepDur = 0.15;
    this.stepT = 0;
    this.step = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      // white-noise buffer for percussive/explosion SFX
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMoving(b) {
    this.moving = b;
  }

  _tone(freq, dur, { type = 'square', gain = 0.18, slideTo = null, when = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, { gain = 0.3, lp = 2000, hp = 0, when = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node.connect(f);
      node = f;
    }
    if (hp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'dig': this._tone(110 + Math.random() * 30, 0.05, { type: 'triangle', gain: 0.08 }); break;
      case 'pump': this._tone(280, 0.09, { type: 'square', gain: 0.14, slideTo: 620 }); break;
      case 'inflate': this._tone(440, 0.08, { type: 'square', gain: 0.12, slideTo: 700 }); break;
      case 'hook': this._tone(900, 0.04, { type: 'square', gain: 0.1 }); break;
      case 'pop':
        this._noise(0.22, { gain: 0.35, lp: 3500 });
        this._tone(500, 0.22, { type: 'sawtooth', gain: 0.16, slideTo: 80 });
        break;
      case 'wobble': this._tone(70, 0.18, { type: 'sawtooth', gain: 0.08, slideTo: 55 }); break;
      case 'rockfall': this._tone(300, 0.35, { type: 'triangle', gain: 0.14, slideTo: 70 }); break;
      case 'rockbreak': this._noise(0.3, { gain: 0.4, lp: 2200 }); break;
      case 'fire': this._noise(0.5, { gain: 0.3, lp: 1400, hp: 300 }); break;
      case 'veggie':
        [0, 4, 7, 12].forEach((s, i) => this._tone(semi(s + 12), 0.12, { type: 'square', gain: 0.12, when: i * 0.06 }));
        break;
      case 'death':
        [0, -2, -4, -7, -12].forEach((s, i) => this._tone(semi(s), 0.18, { type: 'square', gain: 0.16, when: i * 0.12 }));
        break;
      case 'extralife':
        [0, 7, 12, 16, 19].forEach((s, i) => this._tone(semi(s), 0.12, { type: 'square', gain: 0.14, when: i * 0.08 }));
        break;
      case 'levelclear':
        [0, 4, 7, 12, 7, 12].forEach((s, i) => this._tone(semi(s), 0.14, { type: 'square', gain: 0.16, when: i * 0.11 }));
        break;
      case 'gameover':
        [0, -3, -5, -8, -12, -15].forEach((s, i) => this._tone(semi(s), 0.22, { type: 'sawtooth', gain: 0.16, when: i * 0.16 }));
        break;
      case 'start':
        [0, 4, 7, 12].forEach((s, i) => this._tone(semi(s), 0.12, { type: 'square', gain: 0.16, when: i * 0.05 }));
        break;
      default: break;
    }
  }

  update(dt) {
    if (!this.ctx || this.muted || !this.moving) return;
    this.stepT += dt;
    if (this.stepT < this.stepDur) return;
    this.stepT -= this.stepDur;
    const s = this.step;
    const m = MELODY[s % MELODY.length];
    if (m !== null) this._tone(semi(m), this.stepDur * 0.9, { type: 'square', gain: 0.05 });
    if (s % 4 === 0) {
      this._tone(semi(BASS[(s / 4) % BASS.length]), this.stepDur * 3.5, { type: 'triangle', gain: 0.07 });
    }
    if (s % 2 === 1) this._noise(0.03, { gain: 0.02, hp: 5000 });
    this.step++;
  }
}
