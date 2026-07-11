# Handoff: Nine to Survive — Visual Identity (Phases 1–4)

## Overview
This package is the complete visual + simulation **production bible** for *Nine to Survive*, the office-survival game. It defines the game's art direction, color, typography, HUD, characters, environment, and the living-office social simulation. The goal of the handoff is to guide implementation of this identity **into the existing game codebase** (the `ntos-*.js` / `index.html` project), replacing the current "prototype" look with the identity described here.

## About the Design Files
The single file in this bundle — **`Nine to Survive - Visual Bible.dc.html`** — is a **design reference**, not production code to copy. It is an interactive HTML document (31 sections) that renders every rule, palette, mockup, and motion example so you can *see* the target. Open it in a browser and scroll; the left rail jumps to any section.

Your task is **not** to ship this HTML. It is to **recreate the look, motion, HUD, and world it specifies inside the game's existing environment** (the current HTML5 + JS/Canvas game), using that project's established patterns. Where the bible shows a mockup (HUD, office scene, start screen), treat it as the visual target to match; where it describes systems (traits, relationships, ambient life), treat it as a design spec for gameplay/animation work.

## Fidelity
**High-fidelity for visuals, spec-level for simulation.**
- **Visual sections (art direction, color, type, lighting, motion, icons, components, HUD, start screen, office, characters, wireframes — §1–14, §16–18, §22):** hi-fi. Colors, fonts, spacing, radii, shadows, and motion timings are final — match them precisely.
- **Simulation sections (§15 critique, §19 ambient life, §23–31 living office):** design spec. Implement the *behavior* described; exact tuning values are the gameplay team's to balance.

## How to read the bible (section map)
- **01–05** Art direction, mood board, philosophy, **color system**, **typography** — the core tokens.
- **06–08** Lighting principles, **motion language** (all loops are live in the doc), iconography.
- **09** Component library (buttons, chips, meters, dialogue card, tooltip).
- **10** **HUD redesign** — the in-game overlay, corner by corner.
- **11** Start screen. **12** The office hero scene (layered depth). **13** Character system + full cast.
- **14** Wireframes for every screen. **15** Self-critique + Character Language v3.
- **16** The building (19 rooms). **17** Sediment catalog (120+ environmental-storytelling artifacts). **18** Desk archetypes.
- **19** Ambient life system (4 layers, ~90 behaviors). **20** Social map. **21** Office evolution.
- **23–28** Living office, hidden traits, relationships, politics, company life, memories.
- **29** 100+ emergent story examples. **30** Human moments. **31** Why players will talk about it.

---

## Design Tokens (extract these first)

### Color — core neutrals (the whole world is built from these)
| Token | Hex | Use |
|---|---|---|
| Paper Hi | `#FBF6EA` | brightest surfaces, cards |
| Paper | `#F3EBDA` | default light surface |
| Sand | `#E4D8C0` | page / floor base |
| Ash | `#928D84` | mid neutral |
| Graphite | `#6E6960` | secondary text on light |
| Badger | `#45413A` | the player character body |
| Ink | `#15120C` | text, HUD panels, darkest anchor |

Whites are warm and desaturated (never pure `#FFF`); blacks are warm too. Body text on paper: `#2C2820`–`#3A342B`. Muted label text: `#6A6250` / `#8A6F43`.

### Color — HUD meter accents (muted, rationed — never decorative)
| Meter | Hex | Meaning |
|---|---|---|
| Money — Brass | `#B98A4E` | escape fund |
| Soul — Verdigris | `#5E9188` | what's left of you |
| Standing — Slate | `#6E7398` | how they see you |
| Heat — Ember | `#B0553A` | **the only alarm color** — danger/loss only |
| Folder — Manila | `#D9BC82` | receipts / leverage |

**Rationing rule:** any screen is ~90% neutral. Accents appear only where a meter or receipt lives. Ember is the single alarm color — never use it decoratively.

### The signature look (Phase 3, non-negotiable)
**Double key-light in every frame:** warm 5pm honey-gold (`~#F2D9A4`→`#B98D56`) flooding one side, cold monitor-cyan (`~#8FB7C9`) pushing back from the other. Gold vs. screen-glow = freedom vs. the job. This collision must appear in every screenshot, menus included. It is the game's identity at thumbnail size.

### Typography
- **Display / titles:** Archivo Expanded, weight 800–900, UPPERCASE, letter-spacing ≈ -0.01em. (Wordmarks, verdicts, meter values.)
- **Data / system:** Space Mono, 400/700. (Clocks, money, labels, tooltips, annotations — "the office's own handwriting.")
- **Body / UI / dialogue:** Hanken Grotesk, 400/500/700.
- Google Fonts import used in the doc: `Archivo`, `Archivo Expanded`, `Hanken Grotesk`, `Space Mono`.
- **Type scale (in-game minimum 15px):** D1 64 / H2 32 / H4 20 / body 17 / label 12 (mono, letter-spacing .14em). For 1920×1080, never below 24px in-world.

### Spacing / shape / shadow
- Card radius 11–16px; pill/chip radius 16–20px; HUD chips ~12–14px.
- Buttons: chunky, with a **hard bottom shadow** (`0 4px 0 <darker>`), press = translateY(3px) + shadow shrink (physical "drop onto desk"). No glass, no blur.
- Contact shadows are **warm-tinted, soft, single** per object — never hard black. One light pool + one dark anchor per room (value scripting, §15/§16).
- Texture: a subtle film-grain/paper overlay sits over scenes (see `.nts-grain` in the doc) — keep the world from looking too clean.

### Motion language (small amplitude, long periods, offset phases — nothing ever freezes)
Keyframes defined in the doc's `<style>` (names → intent):
`ntsBreathe/BreatheBig` idle breathing ±2px · `ntsGlow` monitor/light glow · `ntsSteam` coffee steam · `ntsSwivel` chair · `ntsBlink` · `ntsPrint` printer paper · `ntsFloat` · `ntsSway` HVAC plant · `ntsType` typing · `ntsSheen` glass reflection · `ntsDoor` door open 42° · `ntsFlicker` fluorescent · `ntsWalkPast` background walkers · `ntsVibrate` phone · `ntsPaperDrift` · `ntsDing` microwave · `ntsShiftWeight` standing idle · `ntsDustA` dust motes.
**Rules:** loop periods are prime-numbered seconds so nothing syncs; ease-in-out for idles, spring for reactions; if you *notice* motion, it's too big; ambient "chains" (cause→effect) fire ≤ twice/day.

### Assets (in `assets/`)
- `logo-circle.png` — the circular badger wordmark logo (cover, start screen, HUD corner). Use the project's existing logo if higher-res exists.
- `badger.png` — mascot art reference for the player character.
Fonts are Google Fonts (see above). No other binary assets are required; everything else in the bible is CSS-drawn as a *reference* — reimplement equivalent art in the game's renderer.

---

## Key screens to recreate (visual targets)

### HUD (§10) — "premium strategy game, not debug read-out"
Corners only; center 60% is always the office. All chips are ink panels (`rgba(21,18,12,.9)`), warm text, soft shadow, slightly diegetic.
- **Top-left — Escape Fund (hero):** big Archivo number `$2,340 / 3,100` + brass progress bar. The one number that answers "how close am I to the door?"
- **Top-center:** clock + `DAY 07 / 16`.
- **Top-right:** Soul (verdigris, segmented pips + value) and Standing (slate, letter grade).
- **Left rail — Heat:** stacked *faces* (Boss / HR / Brad) that glow ember only when hot — you feel *who* is angry, not an abstract number.
- **Bottom-left:** one live Objective, present tense, plain language (never a quest log).
- **Bottom-right:** Folder (receipt count) + Allies (overlapping avatars).

### Start screen (§11)
Living office at dusk behind the menu (glowing/breathing desks, dust, passersby), floating circular logo + Archivo Expanded wordmark, four-item menu anchored bottom (NEW RUN / RESUME / STORIES x/13 / settings). Story count is the hook.

### Office scene (§12) — layered miniature world
Three depth layers always: **background** (rooms behind glass, skyline + walkers past windows, flickering fluorescents), **midground** (the desks you play in, each with a dozen+ placed objects), **blurred foreground** (plant / desk-corner that occludes frame edges). Gentle dimetric camera, warm rake light, vignette. Every desk reads its owner before dialogue (Brad = crime scene, Priya = monument, Dennis = 19-yr sediment, Marcus = coasting).

### Characters (§13, §15 v3)
Assembled from a **construction kit** (body / head / face / clothes / one signature prop), not hand-drawn one-offs. Bold 3px ink outlines, deadpan expressive faces (five-mood matrix), contrapposto weight, 3/4 stance, working hands, per-person walk cycles, "idle = doing something." Must pass the pure-black silhouette test. Cast: You (badger) + ~20 recurring coworkers, 8–10 active per run.

## Interactions & behavior
- **Button press:** 120ms translateY + hard-shadow collapse. **Hover (world/cards):** 180ms lift + shadow grow (spring). **Tooltip:** ink card, appears after ~400ms hover, single caret.
- **Lighting as gameplay:** time-of-day shifts the whole palette (9:00 optimistic cool → 12:30 bright → 4:45 tired gold → 8:10 lonely). As Heat rises, warm sun drains and fluorescent takes over (floor cools/flattens). Light is a silent meter.
- **Living office (§23–31):** employees act on hidden traits (§24) via posture/schedule/seating/silence — never exposed as numbers. Relationships evolve on 4 dims (warmth/respect/obligation/history, §25) and never stay static >3 days. Politics rebalances (every win = a debt + witness + grudge). Memory ledger drives long arcs; the "unfading four" never decay. See §29 for 100+ target emergent stories.

## State (game already models most of this — align, don't rebuild)
Meters: Money, Soul, Standing, Heat. Collections: Folder/receipts, Allies. Progression: Day n/16, Objectives, Stories unlocked. Per-NPC: 16 hidden traits, relationship edges, memory ledger. Company weather: quarterly reviews, layoffs, RTO, reorg, bonus season (§27).

## Files in this bundle
- `Nine to Survive - Visual Bible.dc.html` — the full 31-section reference document. **Open this in a browser first.**
- `assets/logo-circle.png`, `assets/badger.png` — brand/mascot references.

## Files in the existing project to map against
The current game lives in `index.html` + `ntos-game.js` + `ntos-world.js` (+ `ntos-standalone.html`). Implement the identity there: swap palette/type tokens, rebuild the HUD to §10, re-skin the world renderer to §12, and layer in the ambient-life + social systems (§19, §23–31) against the existing game state. Keep the game's existing state/logic; this is a presentation + simulation-depth upgrade, not a rewrite.

> Note: the bible was authored as an HTML "Design Component" (`.dc.html`) for previewing. That format is a **reference harness only** — do not carry it into the game; reimplement in the project's own stack.
