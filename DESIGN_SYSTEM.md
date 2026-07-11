# DESIGN SYSTEM — Nine to Survive

The visual language, and exactly where every knob lives. Target look (from
`design/Nine to Survive - Visual Bible.dc.html`): **paper + graphite, warm 5pm
sunlight colliding with cold monitor glow, ~90% neutral with rationed accents.**

There are two token blocks. Learn these two and you can restyle the whole game.

---

## 1. DOM tokens — `ntos-theme.css` → `:root`

Everything the HTML UI renders reads from here. Change a value once, it
propagates everywhere.

### Colour — core neutrals (the world is built from these)
| Token | v1 value | Bible name | Use |
|---|---|---|---|
| `--paper-hi` | `#FBF6EA` | Paper Hi | brightest surfaces, cards |
| `--panel` | `#F3EBDA` | Paper | default light surface |
| `--panel3` | `#E4D8C0` | Sand | page / track base |
| `--muted2` | `#928D84` | Ash | mid neutral |
| `--muted` | `#6E6960` | Graphite | secondary text |
| `--ink` | `#15120C` | Ink | text, HUD panels, darkest anchor |

### Colour — meter accents (muted, rationed — never decorative)
| Token | Value | Meter | Meaning |
|---|---|---|---|
| `--money` | `#B98A4E` (Brass) | Money | escape fund |
| `--soul` | `#5E9188` (Verdigris) | Soul | what's left of you |
| `--standing` | `#6E7398` (Slate) | Standing | how they see you |
| `--danger` | `#B0553A` (Ember) | Heat | **the only alarm colour** |
| `--folder` | `#D9BC82` (Manila) | Receipts | leverage |

> **Rationing rule.** Any screen is ~90% neutral. Accents appear only where a
> meter or receipt lives. Ember (`--danger`) is the single alarm colour — never
> use it for decoration.

### Type roles (three families, one job each)
| Token | Family | Used for |
|---|---|---|
| `--font-display` | **Archivo Expanded** 800–900, UPPERCASE | wordmarks, verdicts, meter values |
| `--font-data` | **Space Mono** 400/700 | clocks, money, labels, tooltips — "the office's handwriting" |
| `--font-body` | **Hanken Grotesk** 400–700 | prose, dialogue, choices |

Loaded via one Google Fonts `<link>` in `index.html`. Type scale (in-game min
15px): D1 64 / H2 32 / H4 20 / body 17 / label 12 (mono, `.14em` tracking).

### Shape / shadow
`--r-card 16 / --r-panel 14 / --r-chip 12 / --r-pill 100`. Buttons are chunky
with a **hard bottom shadow** (`0 4px 0 <darker>`); press = `translateY(3px)` +
shadow collapse (physical "drop onto the desk"). No glass, no blur. Contact
shadows are warm-tinted, soft, single — never hard black.

### Texture
`.nts-grain` overlays a faint film-grain/paper noise over full-bleed scenes so
the world never looks too clean. One light pool + one dark anchor per frame.

---

## 2. Canvas tokens — `ntos-world.js` → `WT`

The office is drawn on a `<canvas>`, so its colours can't be CSS. They live in
`WT` in the render section:

- `wallBackFace/Cap`, `wallSideFace/Cap` — the two back walls.
- `window`, `windowGlint` — the glass. **This is where the sky/monitor colour
  reads at thumbnail size.**
- `floorSkirtA/B`, `contactShadow`, `vignette` — the grounding shadows.
- `LIGHT` — the signature **double key-light**: a warm 5pm honey-gold flood
  (`~#F2D9A4→#B98D56`) on one side, a cold monitor-cyan (`~#8FB7C9`) pushing
  back from the other. Applied as an overlay in `render()`. Gold vs. glow =
  freedom vs. the job; it must appear in *every* frame.

Per-object accents are **already tokenised** as data: a character's colour is
`CAST[i].color`, a desk's is `FURNITURE[i].color`. To recolour Brad, edit his
row — not the renderer.

### Time-of-day (light as a silent meter)
`render()` derives daytime progress from `world.clockMin` (9:00 → 5:00). The
palette shifts across the day: 9:00 optimistic cool → 12:30 bright → 4:45 tired
gold → later, lonely. The Bible's intent: as Heat rises, warm sun drains and
fluorescent takes over (the floor cools and flattens). v1 implements the
time-of-day gold ramp; Heat-driven draining is a documented next step
(`KNOWN_ISSUES.md`).

---

## 3. Motion language

Small amplitude, long periods, offset phases — **nothing ever freezes, and if
you *notice* motion it's too big.** Loop periods are prime-numbered seconds so
nothing syncs. Ease-in-out for idles; spring for reactions. Ambient cause→effect
"chains" fire ≤ twice/day.

Named loops from the Bible (implement as equivalents in the renderer / CSS):
`ntsBreathe` idle ±2px · `ntsGlow` monitor/light · `ntsSteam` coffee ·
`ntsSwivel` chair · `ntsBlink` · `ntsFlicker` fluorescent · `ntsSway` plant ·
`ntsType` typing · `ntsDust` motes · `ntsWalkPast` background walkers.

Interaction timings: button press 120ms; card/world hover 180ms lift; tooltip
appears after ~400ms hover.

---

## 4. How to restyle (recipes)

**Change the whole palette:** edit `:root` in `ntos-theme.css` (DOM) and `WT` in
`ntos-world.js` (canvas). Rebuild. Done.

**Swap a font:** change one `--font-*` token + the Google Fonts `<link>`.

**Recolour a character/desk:** edit the `color:` field on that row in `CAST` /
`FURNITURE`.

**Re-light the office:** edit `WT.LIGHT`. Nothing else changes the mood.

**After any visual change:** `python3 build_standalone.py`, open `index.html` (or
the standalone) to eyeball, then run both test suites to confirm logic is
untouched. Bump the `?v=` tag.
