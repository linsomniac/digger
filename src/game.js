// AIDEV-NOTE: Game orchestration + state machine. Wires input -> player/pump,
// updates enemies/rocks/veggie/particles, resolves events (scoring, sfx, deaths),
// and drives title/ready/playing/dying/levelclear/gameover/paused transitions.
import {
  Dir, TILE, START_LIVES, LAYER_COLORS_DARK,
} from './constants.js';
import { Grid, tileToPx } from './grid.js';
import { Player } from './player.js';
import { Pump } from './pump.js';
import { EnemyField } from './enemies.js';
import { RockField } from './rocks.js';
import { Veggie, shouldSpawnVeggie } from './veggie.js';
import { Particles } from './particles.js';
import { getLevel } from './levels.js';
import { pookaScore, fygarScore, rockChainScore, extraLifeCount } from './scoring.js';
import { getHighScore, setHighScore, setMuted } from './storage.js';

const READY_SEC = 1.4;
const DEATH_SEC = 1.3;
const CLEAR_SEC = 1.7;

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.grid = new Grid();
    this.player = new Player();
    this.pump = new Pump();
    this.enemies = new EnemyField([]);
    this.rocks = new RockField([]);
    this.veggie = null;
    this.particles = new Particles();
    this.level = getLevel(1);
    this.score = 0;
    this.highScore = getHighScore();
    this.lives = START_LIVES;
    this.lastExtra = 0;
    this.rocksFallen = 0;
    this.veggieSpawned = false;
    this.newHigh = false;
    this.shake = 0;
    this.state = 'title';
    this.stateT = 0;
    this.muted = audio.muted;
    this.rng = Math.random;
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  startGame() {
    this.score = 0;
    this.lives = START_LIVES;
    this.lastExtra = 0;
    this.newHigh = false;
    this.audio.sfx('start');
    this.loadLevel(1);
  }

  loadLevel(n) {
    this.level = getLevel(n);
    this.grid.reset();
    for (const [c0, r0, c1, r1] of this.level.carve) this.grid.carveRect(c0, r0, c1, r1);
    this.player.reset(this.level.playerStart);
    this.enemies = new EnemyField(this.level.enemies, this.level.enemySpeed);
    this.rocks = new RockField(this.level.rocks);
    this.veggie = null;
    this.rocksFallen = 0;
    this.veggieSpawned = false;
    this.pump.reset();
    this.particles = new Particles();
    this.setState('ready');
  }

  respawn() {
    this.player.reset(this.level.playerStart);
    this.enemies.reset();
    this.pump.reset();
    this.setState('ready');
  }

  addScore(n) {
    this.score += n;
    const earned = extraLifeCount(this.score);
    if (earned > this.lastExtra) {
      this.lives += earned - this.lastExtra;
      this.lastExtra = earned;
      this.audio.sfx('extralife');
    }
  }

  killPlayer() {
    if (this.player.invuln > 0 || !this.player.alive) return;
    this.player.alive = false;
    this.lives -= 1;
    this.pump.cancel();
    this.audio.sfx('death');
    this.audio.setMoving(false);
    this.particles.burst(this.player.x, this.player.y, '#fff', 22, 120);
    this.shake = 9;
    this.setState('dying');
  }

  gameOver() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      setHighScore(this.score);
      this.newHigh = true;
    }
    this.audio.sfx('gameover');
    this.setState('gameover');
  }

  spawnVeggie() {
    const p = tileToPx(this.level.playerStart[0], this.level.playerStart[1]);
    this.veggie = new Veggie(p.x, p.y, this.level.veggieType, this.level.veggieValue, 14);
    this.veggieSpawned = true;
  }

  levelClear() {
    this.audio.sfx('levelclear');
    this.audio.setMoving(false);
    this.setState('levelclear');
  }

  update(dt, input) {
    this.stateT += dt;
    this.shake = Math.max(0, this.shake - dt * 36);

    if (input.pressedMute) {
      this.muted = this.audio.toggleMute();
      setMuted(this.muted);
    }

    switch (this.state) {
      case 'title':
        this.audio.setMoving(false);
        if (input.pressedStart) this.startGame();
        break;
      case 'ready':
        this.audio.setMoving(false);
        if (this.stateT >= READY_SEC) this.setState('playing');
        break;
      case 'playing':
        if (input.pressedPause) { this.audio.setMoving(false); this.setState('paused'); break; }
        this.updatePlaying(dt, input);
        break;
      case 'paused':
        if (input.pressedPause) this.setState('playing');
        break;
      case 'dying':
        this.audio.setMoving(false);
        if (this.stateT >= DEATH_SEC) {
          if (this.lives > 0) this.respawn();
          else this.gameOver();
        }
        break;
      case 'levelclear':
        this.audio.setMoving(false);
        if (this.stateT >= CLEAR_SEC) this.loadLevel(this.level.index + 1);
        break;
      case 'gameover':
        this.audio.setMoving(false);
        if (this.stateT > 0.6 && input.pressedStart) this.setState('title');
        break;
      default:
        break;
    }

    this.particles.update(dt);
  }

  updatePlaying(dt, input) {
    const events = [];
    const moveDir = input.desiredDir();
    const pumpHeld = input.held.pump;
    const wantMove = moveDir !== Dir.NONE && !pumpHeld;

    if (input.pressedPump) {
      if (!this.pump.active) { this.pump.fire(this.player, this.grid); this.audio.sfx('pump'); }
      else this.pump.pumpPress(this.grid, events);
    }

    // Resting rocks block the player's movement (you can push up under one to
    // hold it). diggingUp tells the rock field to keep that rock propped.
    const restingRocks = this.rocks.restingCells();
    const diggingUp = wantMove && moveDir === Dir.UP;

    if (wantMove) {
      if (this.pump.active) this.pump.cancel();
      this.player.move(dt, this.grid, moveDir, events, restingRocks);
      this.audio.setMoving(true);
    } else {
      this.player.idle(dt);
      this.audio.setMoving(false);
    }

    this.pump.update(dt, this.grid, this.player, this.enemies.enemies, pumpHeld, events);
    this.enemies.update(dt, this.grid, this.player, this.level, this.rng, events);

    const crushables = [this.player, ...this.enemies.enemies.filter((e) => e.state !== 'dead')];
    for (const ev of this.rocks.update(dt, this.grid, crushables, this.player, diggingUp)) events.push(ev);

    if (this.veggie) this.veggie.update(dt);

    this.handleEvents(events);

    if (shouldSpawnVeggie(this.rocksFallen, this.veggieSpawned)) this.spawnVeggie();

    if (this.veggie && this.veggie.alive) {
      if (Math.hypot(this.player.x - this.veggie.x, this.player.y - this.veggie.y) < TILE * 0.7) {
        this.addScore(this.veggie.value);
        this.audio.sfx('veggie');
        this.particles.sparkle(this.veggie.x, this.veggie.y);
        this.veggie.alive = false;
      }
    }

    if (this.player.alive && this.player.invuln <= 0) this.checkPlayerHit();

    if (this.player.alive && this.enemies.aliveCount() === 0) this.levelClear();
  }

  handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'dig': {
          const [c, r] = ev.cell;
          const p = tileToPx(c, r);
          this.audio.sfx('dig');
          this.particles.dirt(p.x, p.y, LAYER_COLORS_DARK[this.grid.layerAt(r)]);
          break;
        }
        case 'hook': this.audio.sfx('hook'); break;
        case 'inflate': this.audio.sfx('inflate'); break;
        case 'pop': {
          const e = ev.enemy;
          const sc = e.type === 'fygar' ? fygarScore(ev.layer, ev.horizontal) : pookaScore(ev.layer);
          this.addScore(sc);
          this.audio.sfx('pop');
          this.particles.burst(e.x, e.y, e.type === 'fygar' ? '#9fe87a' : '#ffb0a0', 16, 110);
          this.shake = 4;
          break;
        }
        case 'fire': this.audio.sfx('fire'); break;
        case 'escape': break;
        case 'start': this.audio.sfx('rockfall'); break;
        case 'crush': {
          const ent = ev.entity;
          if (ent === this.player) {
            this.killPlayer();
          } else if (ent.state !== 'dead') {
            this.addScore(rockChainScore(ev.chainIndex));
            ent.state = 'dead';
            this.audio.sfx('pop');
            this.particles.burst(ent.x, ent.y, '#ffd27f', 14, 110);
          }
          break;
        }
        case 'land':
          this.audio.sfx('rockbreak');
          this.rocksFallen += 1;
          this.shake = 7;
          this.particles.shards(ev.rock.x, ev.rock.y, '#a7a9b4');
          break;
        default: break;
      }
    }
  }

  checkPlayerHit() {
    const p = this.player;
    for (const e of this.enemies.enemies) {
      if (e.state === 'dead') continue;
      if (e.lethal() && Math.hypot(p.x - e.x, p.y - e.y) < TILE * 0.6) {
        this.killPlayer();
        return;
      }
      if (e.fireState === 'active') {
        const sign = e.fireDir === Dir.LEFT ? -1 : 1;
        const x0 = e.x + sign * TILE * 0.3;
        const x1 = e.x + sign * (TILE * 0.3 + e.fireLen);
        const lo = Math.min(x0, x1);
        const hi = Math.max(x0, x1);
        if (Math.abs(p.y - e.y) < TILE * 0.5 && p.x >= lo && p.x <= hi) {
          this.killPlayer();
          return;
        }
      }
    }
  }
}
