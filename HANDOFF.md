# Nine to Survive — HANDOFF

Pick up here. This is the active game (MARQUE is retired/intact at `/Desktop/marque/` — reuse
its *patterns* only). Everything lives in `/Users/kevindriscoll/Desktop/nine to survive/`.
It RUNS and TESTS GREEN (**82 game + 58 world**, incl. a 100-career soak). The folder is now
a **git repo** (Session 5): one commit per task, nothing pushed, `TASKS.md` holds that
session's brief. Read SESSION_LOG Session 5 for the stability/persistence/balance details.

## Current quick facts (Sessions 5–7, 2026-07-09, autonomous)
- **Balance**: your number is **$3,100**; a day = 2.5 real min (CLOCK_SPEED 3.2); pay
  260/420/640/820/1000 + $250 crunch spot bonus (Associate+ only); seeded task load
  6–10/day; escape days 10–12, median 11 ≈ 27 min. Permanent-Intern win is impossible
  (bank peaks $2,325) and test-guarded. Desk-camping with no recovery DIES by Soul
  (dead-eyed productivity).
- **Persistence**: localStorage save/resume (`ntos-save-v1`, phase-aware). Clear on
  game over / new run.
- **Soak**: `world-test.js` §12 plays 100 full careers headlessly; keep it green.
- **Dev tools**: `?movie=1` autopilot walks out at the number / `?movie=greed` plays to failure (survives rAF-starved tabs); shell stuck-watchdog
  console.warns a state dump if the clock freezes; `window.g`/`window.world` exposed.
- **World additions**: EXIT door (armed when the number is banked → walk out through it),
  off-screen BOSS/BRAD arrows, honest brad outcomes (steal/foiled/empty), choice display
  shuffle (data-idx = rule index), planDay novelty cycle (g.seen), share buttons, WebAudio
  blips + mute, pointer/touch input with pinch zoom, mobile HUD.

## The resolved design (user's calls, 2026-07-09 — evolved across the day)
- **WIN: F-you money.** Bank **$3,100** ("your number") and walk out before the place
  finishes you — via the day-end button or by physically walking through the armed EXIT
  door. Title screen is "Your Number".
- **FORM (final, after TWO course-corrections): a REAL-TIME game.** The user was emphatic:
  not a card game with a decorative world — "a fucking real life game like RollerCoaster
  Tycoon where I'm interacting with the world." The world IS the game: you drive the badger
  (click-to-move), work is physical (tasks pile on your desk; you ship them BY BEING THERE),
  threats cross the floor in real time and you position against them, and soul recovery
  means physically leaving your desk while the clock runs. Cards are rare spice (2/day),
  fired by their owner NPC walking over. If a future feature is "a popup," ask whether it
  can be a THING IN THE WORLD instead — that's the standing direction.

## What the game is now
A run = a career of workdays. Each day = **2 encounters** sampled by planDay's novelty
cycle (tours the whole pool before repeats, seeded on g.rngState), played in clock order.
Three meters:
- **Standing** — org's view. 0 = managed out. Fridays (day % 5) it decides promotions:
  ≥ 68 → promoted (pay up, Standing → 55, Soul −5); < 35 → warning (Soul −4). It also
  **decays −6 every day** plus −1 per task left in the inbox — the treadmill.
- **Soul** — what's left of you. 0 = promoted to management (bad end). Passive drain each
  day end (−1 / −2 wk3+ / −3 wk5+), so you can't stall.
- **Money** — start $300. Daily pay (Intern $260 → Associate $420 → Senior $640 → Manager
  $820 → Director $1,000) minus burn ($130 + $25/week creep). Overdraft = Soul −6.
  **$3,100 = your number = the win.** Sized so a permanent Intern can NEVER reach it
  (intern bank peaks $2,325; crunch spot bonuses are level-gated away from Interns —
  both test-guarded). Endings: escape
  whole (Soul ≥ 50), escape hollow, fired, management.

Balance (asserted by tests, seeds fixed): strong recovery play escapes **days 10–12,
median 11** (~27 real minutes); always-comply dies by Soul day ~3; always-rebel is fired
day ~4. Desk-camping with zero recovery now DIES by Soul (dead-eyed productivity:
3 tasks in a row without a break → each further task +1 Soul). Thesis playable.

## The real-time loop (Sessions 3–6 — see SESSION_LOG for detail)
`ntos-world.js` (`NtosWorld`) owns the office: 40×26 iso grid, furniture + labeled zone rugs,
cast of 8 (You = the badger, Brad, Dennis, The Boss, Meredith-HR, Kayla, Marcus, Priya —
peers now also deliver cards) with
seeded daily moods (emoji overhead; click for status popup; peers get a "Walk over & chat"
button), BFS pathing, idle wandering, constant clock (**3.2 game-min/sec = 2.5-min days**).
- **Click-to-move** (`movePlayer`) — click floor, the badger walks, blue marker. Interaction
  spots have pulsing rings; a status chip over your head says what standing there is doing
  (WORKING… / AT DESK · INBOX ZERO / COFFEE / FIVE MINUTES / NOT WORKING).
- **Tasks**: seeded 6–10/day drip into your inbox (paper stack + red ×N on your desk). Being at your
  desk works them (~11s each, progress bar) → `taskDone` +2 Standing −1 Soul. `closeDay`
  applies daily Standing decay −6 and −1 per unfinished task.
- **Boss floor-walks** ×2/day (❗ + toast telegraph, off-screen edge arrow): at desk = +2;
  empty chair = −6 (−9 on his bad days — mood is mechanical).
- **Brad raids** 1–2/day (off-screen arrow too): unattended inbox = task stolen −3;
  sitting there = foiled +1/+1; away with an empty inbox = its own empty-handed line.
- **Recovery is spatial, once/day each**: coffee +2, couch +6 Soul/−1 Standing, chats with
  Kayla/Marcus/Priya +5/+3/+2 by mood — all require leaving your desk on the clock.
- **Cards (2/day)**: owner NPC walks to your desk at the card's clock minute; world pauses.
  Choice display order shuffles (data-idx keeps the rule mapping).
- **Fire drill** ~45% of days: 8s timer, mash WORK ×12 → `applyCrunch` +4 / −10; a win
  pays a $250 spot bonus from Associate up ("Interns are paid in experience").
- **EXIT door** (west edge): armed + glowing when the number is banked; walking through it
  ends the run via the normal verdict flow.
- **5 PM** → `dayover` signal → `closeDay(g, stats)` → payday report → clock in tomorrow.
All floor outcomes flow through ONE table: `NineToSurvive.WORLD_EFFECTS` via
`applyWorldEffect(g, kind)` — tune the economy there. World emits a signal QUEUE from
`step(w, dt)`; the shell's `handleSignal()` applies effects + narrated toasts + SFX.

## Files (mirrors MARQUE's structure)
- `ntos-game.js` (`?v=n10`) — the BRAIN (career rules; no DOM; seeded mulberry32, never bare
  `Math.random`). LADDER/FU_TARGET/burn/drains/DECAY_S/TASK_MISS_S, `newGame(seed)`,
  `planDay` (novelty cycle on g.seen), `applyChoice`, `advance` → `'ok'|'gameover'`,
  `closeDay(g, {tasksDone, tasksTotal})` → `'dayend'|'gameover'` (decay + inbox debt +
  payday + Friday review), `canWalkOut/walkOut`, `verdict`, `applyCrunch`, `applyCoffee`,
  `WORLD_EFFECTS` + `applyWorldEffect`, run counters on `g.stats`, dead-eyed streak on `g.taskStreak`. Pool is **20 encounters**.
- `ntos-world.js` (`?v=w11`) — the OFFICE (above). Headless-safe: pure `step(w, dt)` returns
  one queued signal per call; `render()`/`screenToTile()` are the only canvas code.
- `index.html` — the SHELL. Play = full-viewport canvas + floating HUD (incl. INBOX line) +
  pointer/touch input (tap/drag/pinch) + card overlay + crunch modal + status popup +
  toasts + share buttons + WebAudio blips w/ persisted mute; rAF loop → `handleSignal()`;
  stuck-watchdog; `?movie=1` autopilot; localStorage save/resume. Start / dayend / end.
- `ntos-standalone.html` — fully-inlined shareable; `build_standalone.py` inlines BOTH
  modules. **Rebuild after any change.**
- `game-test.js` (82) + `world-test.js` (58, ~1 min — includes the 100-career soak) —
  `osascript -l JavaScript <file>` (JSC, no node). Policy sims are full days-on-the-floor
  and the soak drives the real pipeline — keep BOTH green when tuning anything.
- `TASKS.md` — the CURRENT session's brief (verbatim), overwritten each autonomous session.
- `assets/mascot.png` — the official ™ shrugging-badger logo (screenshot crop; swap in
  Ting's original PNG under the same filename when saved from iMessage).
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
4. **Mascot art**: swap `assets/mascot.png` for Ting's original logo PNG (same filename).
5. **Content depth**: grow the encounter pool; then a balance pass on WORLD_EFFECTS.
6. Later: run meta (unlocks, traits, coping items) — the roguelike layer.
