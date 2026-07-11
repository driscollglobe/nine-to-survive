# KNOWN ISSUES — Nine to Survive

State as of the visual production pass. Nothing here blocks play; these are the
honest edges and the next places to push.

## Visual / presentation (this pass)
- **Heat does not yet drain the light.** The Bible wants rising Heat to bleed the
  warm sun out and let fluorescent flatten the floor. v1 ships the time-of-day
  gold ramp only; `render()` doesn't receive Heat (the brain owns it). Next:
  pass a `heat` hint through `worldFlagsFor(g)` into `WT.LIGHT`.
- **Canvas text uses the data/display fonts only after they load.** Web fonts
  aren't guaranteed ready on the first frame, so the first ~1s of canvas labels
  may fall back to a system stack, then swap. Harmless; a `document.fonts.ready`
  repaint would remove the flash.
- **Characters were rebuilt from a construction-kit rig** (§13/§15): distinct
  builds, posture (contrapposto/hunch/rigid/…), clothing silhouettes, two-tone
  hair, class-marker shoes, working hands + one dominant prop, a five-mood face
  matrix, and per-person walk cadence. Verified on `character-test.html` (six
  lineups). Remaining finer gaps for a later art phase: figures face **3/4 only**
  (no 4-direction heading sprites — they mirror L/R when walking); hands are
  simple mittens (no per-finger detail); the §15 "imperfection budget" (1–4°
  drift/rotation) is applied to props/desks but not yet to the figures; the
  ~20-person extended cast (Cheryl, Victor, Nina, …) still needs RIG rows.
- **Ambient life is minimal.** v1 has idle motion and the existing telegraphs;
  the ~90-behaviour ambient system (§19) and background window-walkers (§12) are
  future work.
- **Desktop framing.** Layout is mobile-first (max-width 460px menus; full-bleed
  canvas in play). It scales up cleanly but isn't yet art-directed for a wide
  1920×1080 hero shot the way the Bible mockups are.

## Gameplay (carried over from HANDOFF — unchanged this pass)
1. Competent play runs Boss attention **High** most runs; at the desk the extra
   walk is mostly upside. Watch whether players read "Boss High" as threat or
   trophy.
2. The screenshot flash and the poison file are strictly better than eating raids
   once you hold the pieces — if playtests say "no-brainer," price them.
3. Pre-planted demos auto-resolve. Verify it reads as payoff, not railroad.
4. Promotion-margin tail (escape days 17/19/19) persists under Dennis + heat
   taxes; a promotion-variance system would smooth the review cliff.
5. Zero rebel survivors at this tuning; add a survival valve if that tail matters.
6. PIP arc is the natural next `ARCS` entry (warnings → PIP → HR-pod summons; the
   machinery exists and HR heat feeds it).

## Process / infra
- **`node` is not installed** in this environment. Tests run via
  `osascript -l JavaScript` (JavaScriptCore, Mac only). Keep test files
  runtime-agnostic — no Node APIs.
- **`ntos-standalone.html` is generated.** If it ever diverges from source,
  someone hand-edited it. Re-run `python3 build_standalone.py`; never edit it.
- **`.DS_Store` and screenshots** occasionally show up untracked; they're noise,
  keep them out of commits.
