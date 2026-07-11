# IMPLEMENTATION PLAN — Nine to Survive production pass

The plan for turning a tested prototype into a production project with a real
visual identity, and where the phases sit.

## Principles (in priority order)
1. **Never break the game.** 269 brain + 151 world checks stay green; the 5-policy
   sweep matrix is the definition of done. Gameplay, balance and mechanics are
   frozen this pass — this is presentation + foundation only.
2. **Polish over scope.** A smaller, finished, handcrafted result beats a broad
   broken one. When forced to choose, choose polish.
3. **Foundation before features.** Build the seams (token layers, organised CSS,
   docs, reusable templates) that months of art work will sit on.

## Stage 1 — Production foundation  ✅ (commit: "Create production-ready foundation")
- [x] Extract all shell CSS into `ntos-theme.css`, reorganised into 9 documented
      sections led by a `:root` **design-token** block.
- [x] `index.html` now links the stylesheet; `build_standalone.py` inlines it so
      the standalone stays a single shareable file. Build guards added.
- [x] Introduce the canvas **`WT` token seam** in `ntos-world.js` (walls, glass,
      shadows, vignette, `LIGHT`) — identical values, pure foundation.
- [x] Confirm the `CAST` / `FURNITURE` / `ZONES` data tables as the reusable
      character / prop / room template system; document the add-a-row workflow.
- [x] Author `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `CHARACTER_SYSTEM.md`,
      `IMPLEMENTATION_PLAN.md`, `KNOWN_ISSUES.md`.
- [x] Both suites green; standalone rebuilt.

## Stage 2 — Visual production v1  ✅ (commit: "Implement visual production v1")
Highest-impact 20%, executed completely, in Bible priority order:
1. [x] **Typography** — Archivo Expanded / Space Mono / Hanken Grotesk via the
   three `--font-*` roles.
2. [x] **Colour** — paper + graphite neutrals; Brass/Verdigris/Slate/Ember/Manila
   meter accents, rationed.
3. [x] **Lighting** — the signature double key-light (warm gold vs. cold cyan) in
   every frame; time-of-day gold ramp off `clockMin`.
4. [x] **HUD** — ink panels, warm text, hard-shadow chips (§10 feel).
5. [x] **Office atmosphere** — warm rake light, cooler glass, grain + vignette.
6. [x] **Character presentation** — silhouette-first bodies on the new palette.
7. [x] **Ambient animation** — small, prime-period idles; nothing freezes.
8. [x] **Menus** — start/end screens on the new language, double-key-lit.
9. [x] **Cards** — paper cards, chunky buttons with the physical press.
10. [x] **Responsive** — HUD/floor stay playable phone → desktop.
- [x] Playable build in `builds/nine-to-survive-visual-v1/`.
- [x] Verified in browser preview: launch, move, cards, day-end, save, movie mode,
   clean console. `VISUAL_PRODUCTION_REPORT.md` records the evidence.

## Not this pass (later phases — see the Bible & `KNOWN_ISSUES.md`)
Full social simulation (§23–31), all 19 building floors (§16), the 120-item
sediment catalog (§17), new mechanics/balance/characters, procedural office
generation. The foundation is built so these can land without a rewrite.

## The loop for every future change
`edit source` → `osascript -l JavaScript game-test.js` +
`osascript -l JavaScript world-test.js` (both `0 failed`) →
`python3 build_standalone.py` → eyeball in preview → bump `?v=` → commit.
