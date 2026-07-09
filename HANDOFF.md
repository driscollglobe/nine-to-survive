# Nine to Survive — HANDOFF

Pick up here. This is the active game (MARQUE is retired/intact at `/Desktop/marque/` — reuse
its *patterns* only). Everything lives in `/Users/kevindriscoll/Desktop/nine to survive/`.
It RUNS and TESTS GREEN (52/52 game + 33/33 world).

## The resolved design (user's calls, 2026-07-09 — evolved across the day)
- **WIN: F-you money.** Bank **$6,000** ("your number") and walk out before the place
  finishes you. Title screen is "Your Number".
- **FORM (final, after TWO course-corrections): a REAL-TIME game.** The user was emphatic:
  not a card game with a decorative world — "a fucking real life game like RollerCoaster
  Tycoon where I'm interacting with the world." The world IS the game: you drive your bear
  (click-to-move), work is physical (tasks pile on your desk; you ship them BY BEING THERE),
  threats cross the floor in real time and you position against them, and soul recovery
  means physically leaving your desk while the clock runs. Cards are rare spice (2/day),
  fired by their owner NPC walking over. If a future feature is "a popup," ask whether it
  can be a THING IN THE WORLD instead — that's the standing direction.

## What the game is now
A run = a career of workdays. Each day = 4 encounters sampled (seeded PRNG) from the pool,
played in clock order. Three meters:
- **Standing** — org's view. 0 = managed out. Fridays (day % 5) it decides promotions:
  ≥ 68 → promoted (pay up, Standing → 55, Soul −5); < 35 → warning (Soul −4).
- **Soul** — what's left of you. 0 = promoted to management (bad end). Passive drain each
  day end (−1 / −2 wk3+ / −3 wk5+), so you can't stall.
- **Money** — start $300. Daily pay (Intern $180 → Associate $300 → Senior $450 → Manager
  $620 → Director $800) minus burn ($130 + $25/week creep). Overdraft = Soul −6.
  **$6,000 = walk-out button = the win.** Endings: escape whole (Soul ≥ 50), escape hollow,
  fired, management.

Balance (asserted by tests, seeds fixed): third-way policy escapes day ~23 with Soul ~97;
always-comply dies by Soul day ~3; always-rebel is fired ~day 20. The thesis is playable.

## The real-time loop (Sessions 3–4 — see SESSION_LOG for detail)
`ntos-world.js` (`NtosWorld`) owns the office: 40×26 iso grid, furniture + labeled zone rugs,
cast of 8 (You = a bear, Brad, Dennis, The Boss, Meredith-HR, Kayla, Marcus, Priya) with
seeded daily moods (emoji overhead; click for status popup; peers get a "Walk over & chat"
button), BFS pathing, idle wandering, constant clock (2.2 game-min/sec ≈ 3.6-min days).
- **Click-to-move** (`movePlayer`) — click floor, bear walks, blue marker.
- **Tasks**: 8/day drip into your inbox (paper stack + red ×N on your desk). Being at your
  desk works them (~11s each, progress bar) → `taskDone` +2 Standing −1 Soul. `closeDay`
  applies daily Standing decay −6 and −1 per unfinished task: the treadmill.
- **Boss floor-walks** ×2/day (❗ + toast telegraph): at desk = +2; empty chair = −6
  (−9 on his bad days — mood is mechanical).
- **Brad raids** 1–2/day: unattended inbox = task stolen −3; sitting there = foiled +1/+1.
- **Recovery is spatial, once/day each**: coffee +2, couch +6 Soul/−1 Standing, chats with
  Kayla/Marcus/Priya +5/+3/+2 by mood — all require leaving your desk on the clock.
- **Cards (2/day)**: owner NPC walks to your desk at the card's clock minute; world pauses.
- **Fire drill** ~45% of days: 8s timer, mash WORK ×12 → `applyCrunch` +4 / −10.
- **5 PM** → `dayover` signal → `closeDay(g, stats)` → payday report → clock in tomorrow.
All floor outcomes flow through ONE table: `NineToSurvive.WORLD_EFFECTS` via
`applyWorldEffect(g, kind)` — tune the economy there. World emits a signal QUEUE from
`step(w, dt)`; the shell's `handleSignal()` applies effects + narrated toasts.

## Files (mirrors MARQUE's structure)
- `ntos-game.js` (`?v=n4`) — the BRAIN (career rules; no DOM; seeded mulberry32, never bare
  `Math.random`). LADDER/FU_TARGET/burn/drains/DECAY_S/TASK_MISS_S, `newGame(seed)`,
  `planDay`, `applyChoice`, `advance` → `'ok'|'gameover'` (cards don't end days),
  `closeDay(g, {tasksDone, tasksTotal})` → `'dayend'|'gameover'` (decay + inbox debt +
  payday + Friday review), `canWalkOut/walkOut`, `verdict`, `applyCrunch`, `applyCoffee`,
  `WORLD_EFFECTS` + `applyWorldEffect`.
- `ntos-world.js` (`?v=w2`) — the OFFICE (above). Headless-safe: pure `step(w, dt)` returns
  one queued signal per call; `render()`/`screenToTile()` are the only canvas code.
- `index.html` — the SHELL. Play = full-viewport canvas + floating HUD (incl. INBOX line) +
  drag-pan/wheel-zoom/click verbs + card overlay + crunch modal + status popup + toasts;
  rAF loop → `handleSignal()`. Start / dayend (5:01 report + walk-out) / end screens.
- `ntos-standalone.html` — fully-inlined shareable; `build_standalone.py` inlines BOTH
  modules. **Rebuild after any change.**
- `game-test.js` (59) + `world-test.js` (44) — `osascript -l JavaScript <file>` (JSC, no
  node). Policy sims are now full days-on-the-floor — keep green when tuning the economy.
- `assets/` — **drop the bear mascot as `assets/mascot.png`** (start screen falls back to 🤷).
- Preview config `nine-to-survive` in `/Desktop/untitled folder 2/.claude/launch.json` —
  `autoPort: true` (another chat may hold 4186).

## Workflow rules (same as MARQUE)
1. Career rules → `ntos-game.js`; world/staging logic → `ntos-world.js` (both DOM-free +
   seed-deterministic). Presentation/wiring → `index.html`.
2. Bump the `?v=` cache-busters when a module changes (`n#` game, `w#` world).
3. After edits: run BOTH test files → `python3 build_standalone.py` → verify in the browser
   preview. Keep index + standalone in sync.
4. Note: headless preview tabs are rAF-throttled — walks look slow there, fine at real fps.

## Next steps (world-first: prefer THINGS IN THE WORLD over popups)
1. **PIP / HR arc** (user explicitly wants this): chain review warnings → PIP state →
   Meredith physically summons YOU to the HR pod (walk there or eat Standing).
2. **Dennis as a physical blocker**: some tasks marked "needs approval" — carry them to
   The Pipe and stand there while he "has questions."
3. **Meetings**: calendar entries; be in the MEETING ROOM at the hour or take the hit.
4. **Mascot art** → `assets/mascot.png` (user has it).
5. **Content depth**: grow the encounter pool; then a balance pass on WORLD_EFFECTS.
6. Later: run meta (unlocks, traits, coping items) — the roguelike layer.
