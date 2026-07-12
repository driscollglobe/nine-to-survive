# CLAUDE.md — read this first (auto-loaded by Claude Code)

You are working on **Nine to Survive — "Your Number"**, a real-time office-survival
browser game. It is plain **HTML + JavaScript + Canvas** — no framework, no build
step, no `npm install`, no dependencies. To play it, double-click
`ntos-standalone.html`.

> **This hand-off is for gameplay / LOGIC work.** The art and visual layer are in a
> good state; the person opening this is here to work on **rules, systems, balance,
> and content** — which live in **`ntos-game.js`** (the "brain"). Start there.

---

## Do this first (5 minutes)

1. **Read [`HANDOFF.md`](HANDOFF.md)** — the current state and a full tour of every
   gameplay system (arcs, office heat, chain reactions, tells/interceptions,
   schemes, the story collection, failure verdicts, "the policy"). This is the
   logic bible. Then skim [`SESSION_LOG.md`](SESSION_LOG.md) for how it got here.
2. **Run both test suites** (requires a **Mac** — they run on JavaScriptCore via
   `osascript`, no Node needed):
   ```
   cd "path/to/nine to survive"
   osascript -l JavaScript game-test.js     # ~instant · the brain (269 checks)
   osascript -l JavaScript world-test.js    # ~5 min · the office + the sweep matrix (151 checks)
   ```
   Both must print `0 failed`. If they don't on a clean checkout, stop and say so.
3. **Play it:** open `ntos-standalone.html` in a browser. Add `?movie=1` to the URL
   to watch it play itself to the win (a dev autopilot — great for eyeballing
   balance).
4. Skim [`ARCHITECTURE.md`](ARCHITECTURE.md) for the file layout.

---

## The three layers (this is the whole mental model)

```
BRAIN   ntos-game.js   ← career RULES: meters (Money/Soul/Standing/Heat), the 5
                         story arcs, incidents, receipts, the office feed, heat +
                         chain reactions, schemes, the story ladder + collection,
                         failure verdicts, and "the policy" (autopilot).  ← YOUR FILE
WORLD   ntos-world.js  ← the isometric OFFICE: 9 actors, pathfinding, real-time
                         step(), staging, AND the only canvas render() code.
SHELL   index.html     ← the DOM: HUD, overlays, the rAF loop, save/resume, movie
        + ntos-theme.css  autopilot, and all the wiring between world and brain.
```

The bridges are deliberately narrow:
- **Brain → World:** `worldFlagsFor(g)` produces a flat `flags` object the world
  reads for staging.
- **World → Shell:** `step(world, dt)` returns a **signal** string
  (`taskdone`, `bosscatch`, `bradsteal`, `encounter`, `crunch`, `dayover`, …).
- **Shell → Brain:** the shell applies each signal via
  `NineToSurvive.applyWorldEffect(g, kind)` and repaints.

Because the world never mutates meters and the brain never draws, you can change
rules in `ntos-game.js` without touching art at all.

---

## Golden rules — do not break these

1. **No bare `Math.random`.** The whole game is reproducible from a seed. Use the
   local generators keyed off the run seed (`g.runSeed`). New randomness must
   follow the existing pattern — grep `mulberry32` and see Adam's "side stream" in
   `newDay` for the template that provably shifts no existing seed.
2. **The sweep matrix in `world-test.js` is the definition of done.** It asserts,
   across many seeds, that `?movie=1` ≡ the "competent" policy, that competent play
   escapes most runs in days ~10–16, that desk-campers/suck-ups die of Soul, that
   rebels lose Standing, and that nothing hangs. If your change moves it, either the
   change is wrong **or** you must argue the new assertions in your commit message.
3. **Never hand-edit `ntos-standalone.html`.** It is generated. After changing any
   source file, run `python3 build_standalone.py` to rebuild it (it inlines
   `ntos-theme.css` + `ntos-game.js` + `ntos-world.js` into the one shareable file).
4. **After any change:** run *both* test suites (`0 failed`) → rebuild the standalone
   → bump the `?v=` cache tag on the file you touched (`ntos-game.js?v=nNN` /
   `ntos-world.js?v=wNN` in `index.html`).
5. **Keep the layers separate.** Rules → brain. Movement/staging/render → world.
   Wiring/DOM → shell. If it could be a popup, prefer making it a thing in the world
   ("world-first doctrine").
6. **Character & tone law** (see `HANDOFF.md`): Marcus = the survivor (never a
   fraud), Brad = the scandal, Adam = the meddler. Punch the company and its
   incentives, never the person suffering.

---

## Where everything lives

| File | What it is | Edit for… |
|---|---|---|
| **`ntos-game.js`** | **The brain — all gameplay rules & content** | **logic, balance, arcs, content** |
| `ntos-world.js` | The office: actors, pathing, `step()`, and `render()` | office staging / movement / art |
| `index.html` | The shell: HUD, overlays, rAF loop, save, movie mode, wiring | UI wiring, presentation |
| `ntos-theme.css` | All shell styling + design tokens | look & feel |
| `ntos-standalone.html` | The whole game inlined into one file — **generated** | never (rebuild it) |
| `build_standalone.py` | Rebuilds the standalone | the build |
| `game-test.js` | 269 brain checks | add tests for new rules |
| `world-test.js` | 151 world checks incl. the sweep matrix | acceptance / balance sweeps |
| `assets/` | Logo/mascot (inlined into the build) | — |
| `design/` | The visual bible (reference only, not shipped) | read-only reference |
| `builds/` | Frozen shippable snapshots | copy in, don't edit |

### Documentation index
- [`HANDOFF.md`](HANDOFF.md) — **current state + every gameplay system** (start here for logic)
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — file layout, the render pipeline, determinism
- [`SESSION_LOG.md`](SESSION_LOG.md) — full build history, session by session
- [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) — honest edges + the natural next gameplay steps (e.g. the PIP arc)
- [`CHARACTER_SYSTEM.md`](CHARACTER_SYSTEM.md) — how the cast is built (art rig + how to add a coworker)
- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) · [`VISUAL_PRODUCTION_REPORT.md`](VISUAL_PRODUCTION_REPORT.md) · [`CHARACTER_GAP_AUDIT.md`](CHARACTER_GAP_AUDIT.md) — the visual work (context, not your focus)
- [`START_HERE.md`](START_HERE.md) — the friendly human intro to the project
- [`TASKS.md`](TASKS.md) — an example of how the owner briefs work

---

## Adding gameplay content (the common logic task)

Most new content is a **story arc**. Arcs are **data** in the `ARCS` table in
`ntos-game.js`, advanced each morning by `advanceArcs(g)`; their incidents ride the
same card/event queue as encounters and gate 5 PM. The natural next arc (all the
machinery already exists, and HR heat feeds it) is the **PIP arc**
(warnings → PIP → HR-pod summons) — see `KNOWN_ISSUES.md`. To add one: add an `ARCS`
entry + its incidents, surface any staging need through `worldFlagsFor(g)`, add
tests to `game-test.js`, and confirm the sweep matrix still passes.

New encounter/incident cards, receipts, feed lines, heat effects, chains, and
verdicts are all brain-owned and deterministic — every source of randomness rides a
seeded local generator. Grep for `CHAIN:` (the chain reactions), `STORY_META`
(the collection), and the dev-marked **policy** section at the bottom of
`ntos-game.js` (consumed by both `?movie=1` and the headless soak).

---

## Environment notes
- **Tests need macOS** (they use `osascript -l JavaScript`; there is no Node in this
  project on purpose). On non-Mac you can still edit, rebuild, and playtest in the
  browser — you just can't run the automated suites.
- **Git:** this export is on branch **`visual-production-v1`** (where the recent
  visual work lives; it was intentionally never merged to `main`). Do your logic
  work here or branch from it. One commit per task; write why in the message.
- The whole thing is one folder with full git history — `git log` shows every change
  ever made.

**TL;DR for your Claude Code:** logic lives in `ntos-game.js`; read `HANDOFF.md`;
keep it deterministic (no bare `Math.random`); the `world-test.js` sweep matrix is
the definition of done; after edits run both suites, rebuild the standalone, bump
`?v=`. Never edit `ntos-standalone.html` by hand.
