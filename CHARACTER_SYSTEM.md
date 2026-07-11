# CHARACTER & ROOM SYSTEM — Nine to Survive

The office is built from **data tables**, not hand-drawn one-offs. A character, a
desk, and a room are each one row. This is the "construction kit" the Visual
Bible calls for (body / head / face / clothes / one signature prop assembled from
parts). Add a row, get a new thing — the renderer already knows how to draw it.

All three tables live near the top of `ntos-world.js`.

---

## The three templates

### `CAST` — character template
```js
{ id:'priya', name:'Priya', role:'Actually does the work',
  color:'#7C6FD6',            // silhouette body colour (the token for this person)
  bear:false,                 // true only for the player badger
  chat:true,                  // can you walk over and talk to refill Soul?
  spot:{x:19, y:20},          // home tile (where they idle / sit)
  lines:{ good:'…', meh:'…', bad:'…' } }  // mood microcopy shown on the floor
```
The renderer (`drawActor`) turns this into a shadow → body ellipse (`color`) →
head dome → mood face, plus any special props keyed off `id`/`state` (Adam's
shine, Dennis's red folder, Brad's 👀 lurk, the Boss's ❗). **Silhouette test:**
each body colour + head shape should be identifiable in pure black from across
the floor.

### `FURNITURE` — prop / desk template
```js
{ id:'desk-you', label:'YOUR DESK',
  x:8, y:15, w:2, d:1,        // grid position + footprint (blocks pathing)
  h:0.55,                     // iso height (× 34px)
  color:'#8a6f4d' }           // box colour (the token for this prop)
```
`drawBox` extrudes it into an iso box (auto-shaded sides via `shade()`), then
adds per-`id` dressing: desks get a chair + monitor, the couch gets cushions,
the coffee machine a light, the exit a glowing sign, etc.

### `ZONES` — room template
```js
{ label:'THE BULLPEN', x:6, y:13, w:16, d:9, color:'rgba(47,107,224,0.10)' }
```
Each zone is a labelled floor region. Its **surface material** is the matching
entry in `FLOOR_STYLES` (same index order): `carpet` / `wood` / `checker`, each
with two tones. The label is painted as a floor decal beneath the furniture.

---

## Adding a character (checklist)

1. **Add a `CAST` row.** Give it a unique `id`, a distinct `color`, a `spot`,
   and three `lines`. Set `chat:true` if talking to them should refill Soul.
2. **Give them a desk** (optional): add a `FURNITURE` row `desk-<id>` at a free
   tile so they have somewhere to sit. Keep footprints off walk paths people
   need.
3. **Wire behaviour in the BRAIN**, not here, if they drive a story: add/extend
   an entry in the `ARCS` table in `ntos-game.js` and surface staging through
   `worldFlagsFor(g)`. Movement/telegraphs go in `ntos-world.js`; the *decision*
   of what happens stays in the brain.
4. **New randomness rides a local generator** keyed off the run seed — copy
   Adam's side-stream pattern in `newDay()` so you provably shift no existing
   seed.
5. **Respect Character Law** (`HANDOFF.md`): Marcus = survivor, Brad = scandal,
   Adam = meddler. Punch the company and its incentives, never the person
   suffering.
6. **Test + rebuild:** both suites `0 failed`, `python3 build_standalone.py`,
   bump `?v=`. If the sweep matrix moves, the change is wrong *or* you must argue
   the new assertions in the commit message.

## Adding a room (checklist)

1. **Add a `ZONES` row** (label + rect + faint tint).
2. **Add the matching `FLOOR_STYLES` entry** at the **same index** (choose
   `carpet`/`wood`/`checker` + two tones) so the floor reads as a real surface.
3. **Furnish it** with `FURNITURE` rows.
4. **Add any interaction spot** (a named `*_SPOT` const) if standing there should
   do something, and draw its ring in `render()` under the interaction-ring
   block.
5. Test + rebuild + bump `?v=`.

---

## Who edits what

| You want to… | Edit | Owner |
|---|---|---|
| Change how a character *looks* (colour, prop, silhouette) | `CAST` row / `drawActor` in `ntos-world.js` | **Ting** (art) |
| Change how a character *behaves* (story, meters, choices) | `ARCS` / rules in `ntos-game.js` | **Kevin** (design) |
| Add / move furniture or a room | `FURNITURE` / `ZONES` / `FLOOR_STYLES` | Ting places, Kevin blesses gameplay |
| Restyle colours, fonts, HUD | `ntos-theme.css` `:root` + `WT` | **Ting** |
| Rebalance pay / Soul / heat / arcs | `ntos-game.js` | **Kevin** |

Rule of thumb: **the brain decides, the world stages, the shell shows.** If it's
a number that affects survival, it's Kevin's. If it's how a thing reads on
screen, it's Ting's. Neither has to touch the other's file.
