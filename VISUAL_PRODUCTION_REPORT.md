# VISUAL PRODUCTION REPORT — v1

The first production-quality visual pass, implementing the Design Bible into the
game's existing architecture. Gameplay, balance and mechanics are **unchanged**;
420 logic checks stay green. This is a presentation upgrade on a proven game.

> Guiding call: perfectly execute the highest-impact 20%, never rush the final
> 80%. The office should immediately feel handcrafted, premium, lived-in — not AI
> generated. Everything below was verified running in the browser.

---

## What shipped, against the Bible's priority list

### 1. Typography — DONE
Three type roles, one family each, driven by `--font-*` tokens:
- **Archivo Expanded** (800–900, uppercase) — the wordmark, meter values, button
  labels, verdicts.
- **Space Mono** — clocks, money, the HUD's system labels, the day-report rows,
  card tags. "The office's own handwriting."
- **Hanken Grotesk** — all prose, dialogue and choices.

### 2. Colour — DONE
Whole palette swapped to the Bible's **paper + graphite** neutrals with
**Brass / Verdigris / Slate / Ember / Manila** meter accents. ~90% neutral,
accents rationed to meters and receipts. Ember is the only alarm colour. The old
bright-cyan brand is gone.

### 3. Lighting — DONE (the signature look)
The **double key-light** is painted in *every* frame:
- **Menus:** a warm 5pm honey-gold flood from the top-left collides with a cold
  monitor-cyan from the bottom-right, over a deep warm ground. Cards float on it.
- **The office canvas:** a soft-light overlay does the same collision on the
  floor, and it **ramps with the clock** — the gold strengthens toward 5 o'clock
  (`dayT = clockMin/480`), so late afternoon reads visibly warmer/tireder than
  9am. A top-edge sun-bloom grows through the day. Everything is driven from one
  object, `WT.LIGHT`.

### 4. HUD — DONE (Bible §10)
The in-game HUD is now a **dark ink panel** with warm text, a blurred backdrop, a
live "● EMPLOYEE MONITORING" recording dot, Space Mono labels, Archivo values,
and brass/verdigris/slate meter fills tuned to read against the ink.

### 5. Office atmosphere — DONE
Warm paper walls, glass that carries the warm-sky/cool-glint collision, warm-
tinted (never black) contact shadows, a cinematic vignette, and a film-grain /
paper-tooth overlay over the whole frame so nothing looks too clean.

### 6. Character presentation — REBUILT from a construction-kit rig
**Superseded the first pass** (which was still one body-ellipse + head-dome per
actor). The cast is now assembled from a shared `RIG` config + a procedural
`drawFigure` renderer (Bible §13/§15): distinct **build** (height/width/shoulder/
hip), **posture** (contrapposto default; rigid only for the Boss; hunch/collapse/
lounge/shrug/hover), **clothing silhouettes** (quarter-zip, cardigan, suit+tie,
blazer, hoodie, henley, polo, blouse), two-tone **hair** (swoop, comb-over, bob,
ponytail, bald+shine, hood), class-marker **shoes**, **working hands** holding
**one dominant prop** (phone, binder, earpiece, clipboard, giant mug, laptop), a
**five-mood face matrix** (fine/tired/alarmed/scheming/dead — lid/brow/mouth
only), and **per-person gait** (Brad bounces, Dennis shuffles, the Boss marches,
Priya walks 8% faster…). The badger is unmistakably non-human. See
`CHARACTER_GAP_AUDIT.md` for the before→after per character, and
`character-test.html` for the six acceptance lineups.

### 7. Ambient animation — DONE (subtle)
The key-light **breathes** on a slow ~14s cycle; interaction rings and mood
telegraphs already pulse off the game clock. Amplitudes are deliberately tiny —
if you notice the motion, it's too big. `prefers-reduced-motion` is respected.

### 8. Menus — DONE
Start and end screens rebuilt on the new language: the floating, glowing,
gently-bobbing badger logo; the uppercase Archivo Expanded wordmark; the whole
menu lit by the double key-light.

### 9. Cards — DONE
Encounter cards and the 5:01 day-report are warm paper cards with Space Mono
tags, clear hierarchy, and **chunky buttons with a hard bottom shadow** that
physically drop onto the desk on press (`translateY(3px)` + shadow collapse).

### 10. Responsive layout — DONE
Mobile-first (max-width 460px menus, full-bleed canvas in play) with a phone
breakpoint that shrinks the HUD so the floor stays playable; scales up cleanly to
desktop.

---

## Architecture of the change (why it was safe)

- **Two token blocks do the work:** `:root` in `ntos-theme.css` (DOM) and `WT` in
  `ntos-world.js` (canvas). Re-skinning is now a token edit, not a hunt.
- **No gameplay code was touched.** The renderer is the only thing that changed
  in the world module, and the tests never call the renderer — so the visual pass
  *cannot* move the 420 logic checks or the sacred sweep matrix.
- **The standalone stays one file.** `build_standalone.py` now inlines the
  stylesheet too, so organised multi-file source still ships as a single HTML.

## Verification (all observed live in the browser preview)
| Requirement | Result |
|---|---|
| Game launches | ✅ start screen renders, fonts + light load |
| Player moves | ✅ click-to-move + movie autopilot walk the badger |
| Interactions work | ✅ desk work ships tasks, feed updates live |
| Cards work | ✅ encounter modal renders + is styled |
| The day ends | ✅ 5:01 report card renders; auto-advances |
| Saving works | ✅ movie run persisted across days; Resume present |
| Movie mode | ✅ ran multiple full days start→report→next |
| Console | ✅ no errors across menus, live play, and autopilot |
| Tests | ✅ 269 game + 151 world, `0 failed` |

## Lived-in polish increment (third commit)
A render-only pass to seat everything inside the signature light and make the
floor feel inhabited (Bible §18 "each desk reads its owner"):
- **Diegetic monitor glow** — every screen casts a soft, faintly-flickering cool
  pool on its desk: the cold half of the key-light, sourced in-world.
- **Character rim-light** — a warm key rim catches the upper-left of every
  silhouette; a cool fill rim answers on the lower-right, so the cast belongs to
  the double key-light instead of sitting on top of it.
- **Coffee steam** — one always-on wisp curling off the pot: the floor's pulse.
- **Signature desk clutter** — Marcus's three coasting mugs, Priya's little
  award-nobody-noticed, Dennis's 19-year paper stack, Kayla's quietly-kept plant.
All are small by design (if you notice them, they're too big) and gated on zoom
so they never muddy the far view. `ntos-world.js` → `w21`.

## Deliverable
Playable single-file build at
`builds/nine-to-survive-visual-v1/index.html`.

## Honest edges (full list in `KNOWN_ISSUES.md`)
Heat doesn't yet drain the daylight (time-of-day only); character art is
silhouette-level, not the full construction kit; ambient life is minimal; the
layout isn't yet art-directed for a wide 1080p hero shot. All are additive next
steps on this foundation — none require a rewrite.
