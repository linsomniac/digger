# Digger 🪱⛏️

A cute, faithful **Dig Dug** throwback that runs entirely in your browser — no backend,
no build step, no dependencies. Dig tunnels through the soil, pump the monsters until they
pop, and drop rocks to crush them. Clear every monster to advance to the next round.

![Digger](docs/superpowers/specs/2026-05-30-digger-dig-dug-game-design.md)

## Play

Because browsers block ES-module imports over `file://`, run it from a tiny static server:

```bash
cd digger
python3 -m http.server 8000
# then open http://localhost:8000
```

That's it — no `npm install`, no compilation.

## Controls

| Action | Keyboard | Touch |
| ------ | -------- | ----- |
| Move / dig | Arrow keys or WASD | On-screen D-pad |
| Pump (fire harpoon) | Space or Z | Pump button |
| Start / confirm | Space or Enter | Tap the screen |
| Pause | P | Pause button |
| Mute | M | 🔇 button |

## How to play

- **Dig** tunnels by walking into the soil.
- **Pump** a monster (face it, tap pump repeatedly) until it inflates and **pops**. Deeper
  monsters are worth more points.
- **Pookas** (round goggled blobs) chase you and can turn into ghosts to drift through dirt.
- **Fygars** (green dragons) do the same *and* breathe fire — don't stand in front of one.
- **Rocks** fall when you dig out the soil beneath them and **crush** anything below
  (including you!). Crushing several monsters with one rock scores a big chain bonus.
- Drop **two rocks** and a **bonus veggie** appears in the center — grab it for points.
- Clear all monsters to advance. The last one will try to flee to the surface!

Your high score is saved in the browser (`localStorage`).

## Develop / test

Pure-logic modules are unit-tested with Node's built-in runner (no dependencies):

```bash
node --test
```

Everything else (rendering, audio, input, integration) is verified by playing.

## Project layout

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the build
plan. Source lives in `src/` (ES modules); tests in `test/`.
