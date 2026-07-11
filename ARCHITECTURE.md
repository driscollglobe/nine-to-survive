# ARCHITECTURE — Nine to Survive

How the code is organised, and the one rule that keeps it maintainable:
**presentation is separated from gameplay.** You can restyle the whole game
without touching a rule, and rebalance the whole game without touching a pixel.

---

## The three layers

```
        ┌─────────────────────────────────────────────────────────────┐
        │  SHELL          index.html + ntos-theme.css                  │
        │  (presentation) DOM, HUD, overlays, canvas host, the rAF     │
        │                 loop, save/resume, movie autopilot, CSS.     │
        │                 Owns localStorage. Talks to both modules.    │
        └───────────────▲───────────────────────────▲─────────────────┘
                        │ signals                    │ render(world,…)
        ┌───────────────┴───────────┐   ┌────────────┴─────────────────┐
        │  BRAIN   ntos-game.js      │   │  WORLD   ntos-world.js        │
        │  Career RULES: meters,     │   │  The OFFICE: 9 actors, grid,  │
        │  arcs, incidents, receipts,│   │  pathing, staging, the real-  │
        │  heat, chains, schemes,    │   │  time step(), and the ONLY    │
        │  story ladder, verdicts,   │   │  canvas render(). Never       │
        │  THE policy (autopilot).   │   │  touches meters.              │
        └────────────────────────────┘   └───────────────────────────────┘
```

| Layer | File(s) | Owns | Never does |
|---|---|---|---|
| **Brain** | `ntos-game.js` | Career rules, all meters (Money/Soul/Standing/Heat), arcs, receipts, feed, story collection, failure verdicts, `?movie=` policy | Move actors, draw, touch the DOM |
| **World** | `ntos-world.js` | The isometric office: grid, projection, pathfinding, actor staging, real-time `step()`, and the canvas `render()` | Change a meter, own game rules |
| **Shell** | `index.html`, `ntos-theme.css` | DOM/HUD, CSS, the rAF loop, wiring world-signals → brain-effects, save/resume, movie autopilot | Contain gameplay maths or office logic |

The bridge is deliberately narrow:
- **Brain → World:** `worldFlagsFor(g)` produces a flat `flags` object the world
  reads for staging (who's fired, whose demo is prepped, etc.).
- **World → Shell:** `step(world, dt)` returns a **signal** string
  (`taskdone`, `bosscatch`, `bradsteal`, `encounter`, `crunch`, `dayover`, …).
- **Shell → Brain:** the shell applies each signal via
  `NineToSurvive.applyWorldEffect(g, kind)` and repaints the meters.

Because the world never mutates meters and the brain never draws, either can be
rewritten in isolation.

---

## Files at a glance

| File | Role | Safe to hand-edit? |
|---|---|---|
| `index.html` | Shell markup + the game's JavaScript glue | Yes |
| `ntos-theme.css` | **All** shell styling + design tokens (`:root`) | Yes — this is the visual dial |
| `ntos-game.js` | Brain (rules). Version tag `?v=nNN` | Yes |
| `ntos-world.js` | World (office + renderer). Version tag `?v=wNN` | Yes |
| `ntos-standalone.html` | The whole game inlined into one file | **NEVER** — it is generated |
| `build_standalone.py` | Rebuilds the standalone: inlines `ntos-theme.css` + both JS modules | Yes |
| `game-test.js` | 269 brain checks (`osascript -l JavaScript game-test.js`) | Yes |
| `world-test.js` | 151 world checks incl. the 5-policy sweep matrix (~5 min) | Yes |
| `builds/` | Frozen, shippable snapshots (see `IMPLEMENTATION_PLAN.md`) | Copy in, don't edit |
| `design/` | The Visual Bible — reference only, never shipped | Read-only |

---

## The render pipeline (one frame)

`loop(t)` in `index.html`:

1. `dt` = clamped delta since last frame.
2. `signal = W.step(world, dt)` — advance the office (move actors, tick tasks,
   fire events). If a signal returns, `handleSignal()` routes it to the brain.
3. Update the HUD text nodes (clock, inbox, receipts, heat).
4. `W.render(world, ctx, cam, vw, vh)` — draw the office to the canvas.
5. `requestAnimationFrame(loop)`.

`render()` draws in strict back-to-front order: floor materials → floor skirt →
zone edges + name decals → back walls (with windows) → interaction rings →
move marker → a painter-sorted list of furniture + actors → atmospheric overlay
(vignette / key-light) → off-screen threat arrows.

The tests **never** call `render()` — it is the only DOM-adjacent code. That is
why visual work cannot break the 420 logic checks.

---

## Design tokens: two twinned token layers

Presentation is driven from two small token blocks, one per medium:

- **DOM tokens** — `:root { … }` at the top of `ntos-theme.css`. Colours, the
  three type roles (`--font-display/-data/-body`), radii, shadows.
- **Canvas tokens** — `WT = { … }` in the render section of `ntos-world.js`.
  Wall/glass/shadow/vignette colours plus `LIGHT` (the double key-light config).
  Per-character and per-prop accents live in the `CAST` / `FURNITURE` data
  tables, so they're already tokenised.

Re-skinning the game = editing these two blocks. See `DESIGN_SYSTEM.md`.

---

## Determinism (do not break this)

The whole game is reproducible from a seed. Rules:

1. **No bare `Math.random`.** Randomness uses local generators keyed off the run
   seed (`mulberry32` on `w.rngState`; brain arcs off `g.runSeed`). New random
   behaviour must follow the pattern (see Adam's side stream in `newDay`).
2. `?movie=1` autopilot and the headless soak both consume **one** dev-marked
   policy at the bottom of `ntos-game.js`. Their identity is asserted by
   exact-equality sweeps in `world-test.js` — **the sweep matrix is the
   definition of done.**
3. After any change: run both suites (must say `0 failed`), then
   `python3 build_standalone.py`, then bump the `?v=` tag on the file you
   touched.

---

## Add-things pointers

- New room → `CHARACTER_SYSTEM.md` "Adding a room".
- New character → `CHARACTER_SYSTEM.md` "Adding a character".
- New colour / font / restyle → `DESIGN_SYSTEM.md`.
- What's shaky / next → `KNOWN_ISSUES.md`.
