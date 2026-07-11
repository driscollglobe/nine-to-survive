# CHARACTER & ROOM SYSTEM — Nine to Survive

Characters are **assembled from a shared construction kit** (Bible §13), not
hand-drawn. A rig config picks a value per row — build, posture, head, hair, face,
clothing, shoes, arm/hand pose, one dominant prop, gait — and a procedural renderer
draws the person. Rooms and props are data tables too. Add a row, get a new one.

Everything lives in `ntos-world.js`. Gameplay/behaviour data is `CAST`; **art data
is `RIG`** (they're kept separate on purpose — brain vs. art).

---

## 1. The character rig (`RIG`) — the construction kit

`RIG` is keyed by character id (matching `CAST`). One entry = one person:

```js
brad: { h:1.17, w:0.86, shoulder:1.03, hip:0.82,   // BUILD
        posture:'leanfwd',                          // STANCE (contrapposto/hunch/rigid/…)
        head:'oval', hair:'swoop', hairCol:'#2a2019',// HEAD + two-tone hair
        skin:'tan',                                  // FACE base (5-mood at render time)
        top:'quarterzip', topCol:'#3f6ca8',          // CLOTHING silhouette + tone
        bottom:'slacks', botCol:'#39414d',
        shoes:'sneakwhite', shoeCol:'#efeae0',       // SHOES (class marker)
        arms:'phone', prop:'phone', airpod:true,     // HANDS + the ONE dominant prop
        walk:'bounce', spd:1.13 }                    // GAIT + speed modifier
```

The kit rows (pick one per row — Bible §13):

| Row | Options in the renderer |
|---|---|
| **build** | `h` (height) · `w` (overall width) · `shoulder` · `hip` multipliers |
| **posture** | `contra` (default contrapposto) · `leanfwd` · `hunch` · `collapse` · `shrug` · `lounge` · `hoverhips` · `rigid` · `upright` |
| **head** | `round` · `oval` · `square` (+ `bighead`) |
| **hair** | `swoop` · `combover` · `bob` · `ponytail` · `buzz` · `short` · `bald` · `hood` · `phones` |
| **face** | five-mood at render (fine/tired/alarmed/scheming/dead) + `glasses` |
| **top** | `quarterzip` · `suit`(+`tie`) · `cardigan` · `blazer` · `hoodie` · `henley` · `polo` · `blouse` · `tee` |
| **shoes** | `sneak` · `sneakwhite` · `oxblood` · `loafer` · `dress` · `slipon` · `boot` · `flat` |
| **arms/hands** | `shrug` · `phone` · `holdchest` · `earphone` · `clipboard` · `pocket` · `mug` · `laptop` · `hips` |
| **prop** (ONE) | `phone` · `binder` · `earpiece` · `clipboard` · `mug` · `laptop` · `null` |
| **extras** | `lanyard` · `airpod` · `shine` · `phones` (headphones) |
| **gait** | `walk` (bounce/march/shuffle/drift/amble/brisk/precise/strut) · `spd` |

## 2. The renderer (`drawFigure`)

`drawFigure(ctx, px, py, z, rig, o)` composes a chunky, outlined figure from the
rig at screen point `(px,py)` (feet), scale `z`. Layers back-to-front: contact
shadow → far arm → legs (walk cycle) → torso (clothing silhouette + fold line) →
head + hair → near arm + working hand → **dominant prop** → five-mood face.

`o = { mood, moving, walkPhase, idlePhase, faceLeft, silhouette, face }`. It applies
**Character Language v3** (§15): contrapposto weight by default (vertical spine only
for the Boss), 3/4 read, hands always occupied, per-person walk cadence, and idle
micro-motion so no one ever truly stands still. `silhouette:true` fills everything
ink for the black test.

`drawActor` (the in-game path) looks up `RIG[a.id]`, maps the game mood
(`good/meh/bad` + state) to the five-mood face, derives `moving`/`faceLeft` from the
actor's path, and calls `drawFigure` — then draws all the gameplay overlays
(telegraphs ❗👀📋, Dennis's carry folder, Adam's 💬, work/approval bars, the status
chip, the name). **No meter or logic code lives here.**

## 3. Per-character match checklist (Bible §13 → rig)

| Character | Bible target | Rig realises it |
|---|---|---|
| **You** | badger, headphones, resigned half-lids, shrug, only animal | `badger`, `hair:'phones'` (ears+fur+band), forced half-lid face, `arms:'shrug'`, graphite tone |
| **Brad** | taller/leaner, forward lean, quarter-zip, swoop, one AirPod, phone, bouncy | `h1.17 w.86`, `leanfwd`, `quarterzip`, `swoop`, `airpod`, `prop:'phone'`, `walk:'bounce'` |
| **Dennis** | short/wide/hunched, cardigan, glasses, comb-over, binder, shuffle | `h.9 w1.22`, `hunch`, `cardigan`, `glasses`, `combover`, `prop:'binder'`, `walk:'shuffle'` |
| **Boss** | tallest/broadest, rigid, dark suit + red tie, phone at ear, march | `h1.27 w1.15`, `rigid`, `suit`+`tie`, `earpiece`+`arms:'earphone'`, `walk:'march'` |
| **Meredith** | upright, blazer, bob, lanyard, clipboard, short steps | `upright`, `blazer`, `bob`, `lanyard`, `prop:'clipboard'`, `walk:'precise'` |
| **Kayla** | smaller, collapsed, hood/headphones, slip-ons, drifts, tired | `h.86`, `collapse`, `hood`+`phones`, `slipon`, `arms:'pocket'`, `walk:'drift'` |
| **Marcus** | broad/relaxed, henley, giant mug, slow amble | `w1.17`, `lounge`, `henley`, `prop:'mug'` (oversized), `walk:'amble'` |
| **Priya** | slim/upright, ponytail, laptop, fast, purposeful | `h1.02 w.82`, `upright`, `ponytail`, `prop:'laptop'`, `walk:'brisk' spd1.19` |
| **Adam** | bald + shine, tucked polo, hands on hips, lanyard, hovering | `bald`+`shine`, `polo`, `arms:'hips'`, `lanyard`, `hoverhips` |

Verified on `character-test.html` (six lineups: color / pure-black / gameplay-zoom /
walking / five-mood matrix / props). Acceptance: recognizable at gameplay zoom
without labels; distinct in pure black; gait identifies in motion; no two majors
share body+posture+prop; You is unmistakably the badger.

## 4. Adding a character
1. Add a **`CAST`** row (id, name, role, `color`, `spot`, mood `lines`) — behaviour.
2. Add a **`RIG`** row (same id) — pick one value per kit row above — art.
3. If they drive a story, extend the `ARCS` table in `ntos-game.js` (the *decision*
   stays in the brain; movement/telegraphs go in the world).
4. New randomness rides a local generator keyed off the run seed (copy Adam's side
   stream in `newDay`).
5. Test both suites `0 failed`, `python3 build_standalone.py`, bump `?v=`, and eyeball
   on `character-test.html` (drop the new id into the lineups).

## 5. Rooms & props (unchanged data tables)
- **`ZONES`** — one row per room (label + rect + tint); its floor surface is the
  matching **`FLOOR_STYLES`** entry (carpet/wood/checker).
- **`FURNITURE`** — one row per desk/prop (grid pos, footprint, height, colour);
  `drawBox` extrudes it and adds per-`id` dressing + signature desk clutter.
Add a room = a `ZONES` row + a `FLOOR_STYLES` entry + `FURNITURE` rows.

## 6. Who edits what
| To change… | Edit | Owner |
|---|---|---|
| How a character **looks** (build, hair, clothing, prop, gait) | `RIG` / `drawFigure` | **Ting** (art) |
| How a character **behaves** (story, meters, choices) | `CAST` / `ARCS` in `ntos-game.js` | **Kevin** (design) |
| Rooms / furniture placement | `ZONES` / `FURNITURE` / `FLOOR_STYLES` | Ting places, Kevin blesses gameplay |
| Colours / fonts / HUD | `ntos-theme.css` `:root` + `WT` | **Ting** |

Rule of thumb: **the brain decides, the world stages, the shell shows.** Numbers
that affect survival are Kevin's; how a thing reads on screen is Ting's.
