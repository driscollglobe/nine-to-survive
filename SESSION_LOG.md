# Nine to Survive — A Workday · SESSION LOG

An office-survival narrative choice game. Retires/replaces MARQUE as the active focus
(MARQUE is left intact at /Desktop/marque/, just no longer developed).

## Session 1 — Restructure onto MARQUE's infrastructure (2026-07-09)

Took the self-contained source (`~/Documents/nine_to_survive_workday.html`) and restructured
it into MARQUE's proven project shape, in a **new sibling folder** `/Users/kevindriscoll/Desktop/nine to survive/`.
Ship scope: the existing **10-encounter workday** as-is (no new systems, no content expansion).

### Decisions (from the user)
- **Location:** new sibling folder (MARQUE untouched).
- **Architecture:** reuse as much of MARQUE's workflow as fits a text-choice game.
- **Visual identity:** *pending a reference the user is attaching* — kept the source's dark
  office palette as the interim baseline. It's fully CSS-variable-driven (`:root`), so the
  re-theme when the reference lands is cheap (change vars, not markup).
- **Scope:** ship the 10-encounter day.

### What was reused from MARQUE (the infrastructure)
- **Logic module + shell split** (like `marque-sim.js` / shell): `ntos-game.js` owns the
  encounter data + deterministic rules (meters, choices, clamping, fail states, verdict) and
  touches no DOM; `index.html` is presentation + wiring only and never re-implements rules.
- **Two-file sync:** `index.html` (canonical, loads `<script src="ntos-game.js?v=n1">`) +
  `ntos-standalone.html` (fully inlined shareable), rebuilt by `build_standalone.py`
  (mirrors MARQUE's splice: replace the one module `<script src>` tag with the inlined module).
- **Headless test harness:** `game-test.js` (`osascript -l JavaScript game-test.js`),
  same JSC eval-load pattern as `world-test.js`. **28/28 passing** — content integrity
  (10 encounters, 3 well-formed choices each, ascending clock order), meter math + 0–100
  clamping, both fail states, a clean full-day run, and all six verdict branches.
- **Preview:** `nine-to-survive` config added to `.claude/launch.json` → port **4186**.

### What was intentionally NOT reused
The isometric canvas renderer, economy sim, campus builder, asset/sprite system — none of it
fits a narrative choice game. Dropped rather than forced.

### Files
- `ntos-game.js` — game brain (data + rules), `NineToSurvive` (const, also on `window`).
- `index.html` — shell (start / play / end screens, HUD meters, encounter card).
- `ntos-standalone.html` — inlined shareable (rebuilt via `build_standalone.py`).
- `game-test.js` — headless tests. `build_standalone.py` — standalone rebuild.

### Verified in browser (port 4186, zero console errors)
Start screen → Clock in → encounter renders with 3 choices → choosing moves both meters
(with floating delta + bar animation) and shows the outcome line → advancing runs the clock
9→5 → a full run lands on a verdict ("Ungovernable. And Still Employed."). Standalone boots
identically.

### Open / next
- **Apply the visual reference** the user is attaching (re-theme `:root` + any layout tweaks),
  then rebuild the standalone.
- Content is intentionally the shipped 10 encounters; expansion (randomized draw / multi-day)
  was explicitly deferred.

*(Between sessions 1 and 2, on the other account: brand reskin applied — cyan/cream/black,
mascot slot, meters — and the HANDOFF written. See git-less folder history in HANDOFF.md.)*

## Session 2 — "Your Number": the full run built (2026-07-09)

The user answered the two pending forks: **FORM = closest to the original workday file**
(keep the encounter-card day as the core loop — no dashboard sim, no isometric renderer)
and **WIN = F-you money** (bank enough to walk out). Built exactly that: the base game is
now a multi-day career run titled **Your Number**.

### The design (all in `ntos-game.js`)
- **Run = a career of workdays.** Each day samples **4 distinct encounters** from the
  10-encounter pool (seeded mulberry32 on `g.rngState` — no bare `Math.random`, so tests
  replay whole careers), played in clock order. `newGame(seed)`, `planDay`, `nextDay`.
- **Money.** Start $300. Daily payday minus cost of living (`burnFor(week)` = $130 + $25/week
  lifestyle creep). Overdraft floors at $0 and costs Soul −6.
- **The ladder.** Intern $180/day → Associate $300 → Senior $450 → Manager $620 → Director
  $800. **Friday review** (day % 5): Standing ≥ 68 → promoted (Standing resets to 55,
  Soul −5 — "the bar moves"); Standing < 35 → formal warning (Soul −4).
- **The grind.** Passive Soul drain each day end: −1, −2 from week 3, −3 from week 5.
  You cannot coast forever; the building is a timer.
- **WIN: your number = $6,000.** `canWalkOut`/`walkOut` — the day-end screen grows a green
  "Walk out" button (plus "One more day (greed)"). Endings: escape whole (Soul ≥ 50), escape
  hollow, managed out (Standing 0), promoted to management (Soul 0). Verdicts carry days + bank.
- **applyChoice / meters / fail states unchanged** — encounters and their deltas untouched.

### Shell (`index.html`, `?v=n2`)
- HUD: job line (Day · Wk · Title, +$pay/day) + third meter **YOUR NUMBER** (green, fills
  toward $6,000).
- New **5:01 PM day report** screen: pay / cost of living / grind / overdraft / promotion /
  warning rows, bank line, clock-in vs walk-out CTAs.
- Start screen recopy ("Bank $6,000. Keep your soul. Walk out."), end screen now shows
  Standing / Soul / Banked / Days survived.

### Tests — 52/52 passing (`osascript -l JavaScript game-test.js`)
Content integrity, career constants, seeded determinism (same seed = same plan = identical
career), payday math, promotion/warning/overdraft at review, walk-out gating, all verdicts —
plus **whole-career policy sims asserting the thesis is playable**:
- third-way policy escapes on **day 23 with $6,410 and Soul 97** ✅ the win exists
- suck-up policy (always comply) dies by Soul on **day 3** ✅ climbing costs you
- pure-rebel policy gets **fired around day 20**, never escapes ✅ resistance alone loses

### Verified in browser (zero console errors)
Full arc clicked through: start → day 1 report ($350 banked) → Friday promotion row →
walk-out button at $6,410 → "F-You Money. Out the Door. Whole." win screen. Standalone
rebuilt (36 KB) and boots identically. NOTE: another chat's server held port 4186, so
`launch.json`'s nine-to-survive entry now uses `autoPort: true` with `${PORT:-4186}`.

### Open / next
- Drop the bear into `assets/mascot.png` (still the 🤷 fallback).
- Content expansion: the 10-encounter pool repeats across a 23-day run — more encounters
  (and Brad/Dennis/Boss arcs, money-touching choices) are the next depth lever.
- Balance: third-way is comfortably winnable (Soul 97 at escape); consider tightening once
  the pool grows.

## Session 3 — THE OFFICE: the isometric world layer (2026-07-09)

User course-corrected after seeing Session 2: they want the **RollerCoaster Tycoon / Sims
version** — a big interactive isometric office you pan/zoom/click, coworker statuses visible,
boss's bad days readable, fire drills, PIP/HR pressure. Clarified via questions: **Sims-style
(watch your worker) in an RCT-style interactive world**, with the cards becoming the event
system. The career rules from Session 2 stay as the brain, unchanged.

### New module: `ntos-world.js` (`?v=w1`) — the OFFICE
Mirrors MARQUE's world/sim split (patterns from `marque-world.js`, rewritten for this game):
- **40×26 iso floor** with furniture (desks, coffee machine, meeting table, printer, plants,
  couch) as blocked tiles drawn as iso boxes, and labeled zone rugs (THE BULLPEN, CORNER
  OFFICE, HR, KITCHEN, MEETING ROOM, THE PIPE, BREAK CORNER).
- **Cast of 8**: You (a bear — ears rendered), Brad, Dennis, The Boss, Meredith (HR), plus
  Kayla / Marcus / Priya. Daily **moods** (seeded), mood emoji over heads, click any coworker
  for a **status popup** (role + mood + flavor line per mood). Boss on a bad day gets a red
  ring readable from across the floor.
- **The day is staged physically**: each planned encounter has an owner NPC
  (`OWNER_BY_ENC`) who *walks to your desk* at that encounter's clock time (BFS pathing,
  summoned NPCs hustle at 1.9×); the card fires on arrival; the world pauses while the card
  is up; on resolve the owner walks home and the day resumes. Clock crawls near events,
  fast-forwards through dead time.
- **Idle life**: NPCs wander, make coffee pilgrimages, return to desks — the floor moves.
- **Fire drill (crunch)**: ~45% of days, 11:30–1:30 — modal with an 8s timer, mash WORK
  (12 clicks) → `applyCrunch(g, success)`: +4 Standing or −10 (can end the run).
- **Coffee**: click the machine → your bear walks over → Soul +2, once a day
  (`applyCoffee`). One small mercy.
- Headless-safe like MARQUE: pure logic over a plain world object, `step(w, dt)` decoupled
  from rAF, deterministic via mulberry32 on `w.rngState`. Render is the only canvas code.

### Shell (`index.html`, game `?v=n3`)
Play screen is now a full-viewport canvas world: floating HUD, drag-pan / wheel-zoom /
click-pick, hint bar, toast, status popup, encounter card as a modal overlay, crunch modal.
rAF loop feeds `step()` signals into the rules. Day-end / start / end screens unchanged.

### Tests
- `world-test.js` — NEW, **33/33**: clock math, walkability, every-NPC-can-path-to-you,
  plan→events staging, owner mapping, seeded determinism, full-day signal drive (all four
  encounters fire in plan order), coffee errand, crunch/coffee rules.
- `game-test.js` still **52/52** (policy sims unchanged). `build_standalone.py` now inlines
  BOTH modules (68 KB standalone).

### Verified in browser (zero console errors)
World renders (bullpen/kitchen/pipe, mood emojis, bear at desk); Brad walked over and
"Credit, Reassigned" fired at 9:41; status popup shows Brad's mood + line; coffee errand
accepted; forced fire drill → 12 WORK clicks → "Delivered." Standing +4; full day → 5:01
report ($350, correct math); Day 2 rebuilds a fresh office (new moods, new crunch).
NOTE: the preview tab is rAF-throttled (~1fps) so walks look slow there; dt is capped at
0.12s and summoned NPCs hustle, so it feels right at real frame rates.

### Open / next
- **Fire-drill fairness on throttled tabs**: the 8s timer is real-time; fine normally.
- **PIP arc**: warnings at review are the hook — chain 2 warnings → PIP → HR meeting
  encounter with Meredith (user explicitly wants HR meetings/PIP visible).
- **Boss mood should bite**: bad day = harsher deltas on his encounters (display-only now).
- Encounter pool growth + mascot PNG still open from Session 2.

## Session 4 — REAL-TIME: the world becomes the game (2026-07-09)

User (strongly): Session 3 was still "a movie you watch between text popups" — they want a
"fucking real life game like RollerCoaster Tycoon where I'm interacting with the world."
Correct read: the gap was **verbs**. Rebuilt the loop so the world IS the game and the cards
are rare spice (`DAY_ENCOUNTERS` 4 → 2).

### The real-time loop
- **Click-to-move**: click any floor tile → your bear walks there (`movePlayer`, blue marker).
- **Work is physical**: 8 tasks/day drip into your inbox (3 at 9:00, then ~every 55 game-min),
  rendered as a paper stack on your desk with a red ×N. Standing at your desk auto-works
  (~11s/task, green progress bar overhead). Ship = `taskDone` (+2 Standing, −1 Soul).
- **The treadmill**: `closeDay` now applies daily Standing **decay −6** plus **−1 per task
  left in the inbox**. You produce or you sink.
- **Boss floor-walks** (2/day, ❗ + red ring while out, toast telegraph): arrives at your
  pod — at your desk = `bossPass` +2; empty chair = `bossCatch` −6, or **−9 on his bad days**
  (his mood finally bites mechanically).
- **Brad raids** (1–2/day): reaches your desk while you're away and there's pending work →
  `bradSteal` (task gone, −3 Standing); you're sitting there → `bradFoiled` (+1/+1).
- **Soul is spatial**: coffee (+2), the couch (+6 Soul, −1 Standing, "HR saw"), and walking
  over to chat with Kayla/Marcus/Priya (+5/+3/+2 by their mood) — all once/day, all away
  from your desk while the clock runs. That trade is the game.
- **5 PM** fires `dayover` → `closeDay(g, {tasksDone, tasksTotal})` → the payday report
  (new rows: tasks shipped, decay, died-in-inbox; warning row recopy: "HR 'quick chat' —
  the word PIP was used").

### Architecture
- `ntos-game.js` (`?v=n4`): `WORLD_EFFECTS` table + `applyWorldEffect(g, kind)` — the whole
  floor economy in one visible, testable table. `advance()` no longer ends days;
  `closeDay(g, stats)` does (decay + inbox debt + payday + review). `DECAY_S`, `TASK_MISS_S`.
- `ntos-world.js` (`?v=w2`): signal QUEUE (`w.sig`) — step() emits
  task/taskdone/bosswalk/bosspass/bosscatch/bradsteal/bradfoiled/chat/couch/coffee/
  encounter/crunch/dayover. Player verbs: `movePlayer/goForCoffee/goForCouch/requestChat/
  playerGoHome/playerAtDesk`. Threat schedules seeded per day. Clock now constant
  (2.2 game-min/sec ≈ 3.6-min days) — no fast-forward; dead time is where the choices live.
- Shell: `handleSignal()` switch applies effects + narrated toasts; task HUD line
  ("INBOX · N waiting | M/8 shipped"); status popup gains a "Walk over & chat" button.

### Tests — 103/103
- `game-test.js` **59/59**: closeDay decay/inbox-debt math, review paths via closeDay,
  WORLD_EFFECTS sanity (bad-day catch bites harder; couch trades Standing for Soul; effects
  can end the run), policy sims rebuilt as *days on the floor* (cards + tasks + boss outcome
  + recovery): third-way escapes day 23 soul-whole; suck-up (all work, no recovery) dies by
  Soul day ~3; rebel (2 tasks, caught out) fired fast.
- `world-test.js` **44/44**: task drip/ship at desk/no-ship away, boss pass vs catch (+mood
  flag, goes home after), brad steal vs foil, coffee/couch/chat once-a-day + arrival signals,
  click-to-move (refuses furniture), cards still fire via owner, dayover once with stats.

### Verified in browser (zero console errors)
A full synchronous day: 3 tasks at 9:00 → shipped at desk (+2) → player wandered at 11:20 and
the Boss caught the empty chair TWICE (−6 each, punishment works) → Kayla chat, Brad foiled,
couch → 8/8 shipped → two cards → 5 PM report with decay row. Screenshot shows paper stack +
red ×N on the desk, task HUD line, progress bar.

### Open / next
- PIP arc (2 warnings → PIP state → Meredith summons YOU to HR) — user wants this visible.
- Dennis as a physical blocker (some tasks need walking an approval to The Pipe).
- Meetings on the calendar (be in the meeting room or eat Standing).
- Pool growth + mascot PNG still open.

## Session 5 — Stability, soak, persistence, balance (2026-07-09, autonomous per TASKS.md)

### Baseline (before any changes)
- Folder was NOT a git repo → `git init`, commit `pre-session baseline` (c1f19fa), .gitignore for .DS_Store.
- game-test.js: **59 passed, 0 failed** (ran via osascript, verified).
- world-test.js: **44 passed, 0 failed** (ran via osascript, verified).

### TASK 6 — balance sweep results (one pass, timeboxed, final)
Constants chosen: **FU_TARGET $6,000 → $2,500**, **CLOCK_SPEED 2.2 → 3.2** (a day = 2.5
real min), **ladder pay 260/420/640/820/1000** (was 180/300/450/620/800). Burn untouched
(130 + 25/wk) — deliberately, because burn creep is what caps a permanent Intern.
- 50-seed recovery-bot sweep: escapes **50/50, day 11 every seed** (money is deterministic
  given weekly promotions; threats don't touch income). Winning run ≈ **11 × 2.5 ≈ 27.5
  real min** + modal time → lands mid-window of the 20–30 min target.
- Permanent-Intern guard (new test): pinned meters, 60 days, bank peaks **$2,325 < $2,500**
  — the no-promotion win is mathematically impossible.
- Policy sims after retune: third-way escapes day 11 (assertion updated 12–45 → 8–20);
  suck-up dies by soul day 3 (unchanged); rebel fired day 5 (unchanged).
- Known consequence, accepted within the timebox: the desk-only soak bot now escapes
  hollow (48/50, soul ≈ 10 → "Out. Technically.") instead of dying mid-run — an 11-day
  run outpaces the grind drain. The no-recovery thesis now expresses through the hollow
  ending tier rather than death. Revisit only if the hollow ending feels too soft in play.
- Overdraft unit test moved to week 7 (intern pay $260 vs burn $280) — same rule, new pay.

### Session 5 final write-up (TASKS.md run, all 12 tasks completed)

**Git**: repo initialized this session; every task is its own commit (`git log --oneline`),
tree never left broken, nothing pushed. TASKS.md holds the brief verbatim.

**TASK 1 — zero-path arrival deadlock (ntos-world.js, w3).** Real bug: sendTo could leave
an actor in a transit state with an empty path (already on the target tile); the movement
loop only processed actors with path.length, so the actor never "arrived" — a card owner
already adjacent to you would freeze the day forever. Fixed via handleArrival() shared by
the walked-there and already-there paths; dispatchers now only advance event/walk/raid
status once sendTo succeeds (a failed path retries next tick instead of stranding).
3 regression tests.

**TASK 2 — soak test (world-test.js §12).** soakRun() plays entire careers through the
real pipeline (newDay → step 0.1 → signals → closeDay → nextDay) with a 20k-step/day cap,
60-sim-sec stuck-actor watchdog, exception capture; 50 seeds × two policies (desk-only and
recovery). Zero hangs, zero stuck actors, zero exceptions, every career terminal. Found no
further bugs beyond Task 1's (which it was designed to catch — it passes on first run
because Task 1 landed first). Runtime ~60s; world-test now takes ~1 min.

**TASK 3 — shell stuck watchdog.** 5s interval; if play is visible, no modal open, and
clockMin frozen 20s → console.warn structured dump (day, clock, events, per-actor
id/state/pathLen/xy), re-arming while stuck. window.g/window.world exposed. Proven live:
it fired during Task 4 verification and produced exactly the dump needed.

**TASK 4 — movie mode (?movie=1).** Interval-driven autopilot: auto-start, desk-holding,
choice-2 card play, fire-drill mashing, per-day log line, GAME OVER log; greeds past the
walkout so it runs indefinitely. Inert without the flag. Two real fixes surfaced during
live verification: (1) background tabs suspend rAF entirely — movie mode now drives
W.step() itself when the render loop is starved >1s; (2) an rAF-starved fire-drill
countdown could sit expired forever — a WORK click now settles it. LIMIT (honest): this
preview environment suspends background pages so hard that a multi-day movie run could not
be observed end-to-end here; mechanism verified through day progression (clock 540→754
across wakes, cards+crunch auto-resolved). A real foreground tab runs it properly.

**TASK 5 — persistence.** {runSeed, phase, g} in localStorage on start/card/crunch/
closeDay/clockIn; cleared on game over/new run; Resume button (green, labeled with day +
bank) on the start screen. phase='dayend' resumes onto the 5:01 report (payday cannot
replay); mid-day saves restart that morning with meters intact (world isn't serialized —
deliberate). Tests: JSON round-trip preserves every field; resumed career bit-identical.
Live-verified: button, restore, clear.

**TASK 6 — rebalance.** See sweep block above. FU $2,500 / clock 3.2 / pay
260-420-640-820-1000 → 11-day, ~27.5-min median win, permanent-Intern win impossible
($2,325 peak, test-guarded), suck-up and rebel fail as before.

**TASK 7 — touch.** Pointer events (tap/drag/pinch), wheel kept, touch-action none on
canvas + manipulation on buttons, <420px compact HUD. Verified: synthetic tap/drag/pinch
+ wheel + mobile-viewport CSS. Fix along the way: media query had to move to the end of
the stylesheet (specificity tie); setPointerCapture try/catch'd.

**TASK 8 — encounter depth (four commits).** (a) card choices shuffle display order,
data-idx preserves rule mapping (movie autopilot updated to pick by data-idx — it would
have silently randomized its policy). (b) planDay novelty cycle on g.seen: tours all ten
cards before any repeat, seeded, serializes; policy sims shifted within tolerance (suck-up
day 4, rebel day 4). (c) bradempty signal: away + empty inbox is no longer "you were
sitting right there". (d) off-screen patrol/raid arrows at the screen edge (render-only),
verified by screenshot.

**TASK 9 — the walkout door.** EXIT furniture at the west edge; armed by the shell when a
day begins with the number banked (glow + toast); clicking walks you over; arrival emits
'walkout' → existing walkOut/verdict flow. Day-end button retained. 4 tests.

**TASK 10 — share card.** g.stats counters (bradSteals/crunchWins/crunchFails/warnings)
incremented in the brain, serialize with the save; share buttons on day-end + end screens
copy a receipts-driven plain-text card (clipboard API + execCommand fallback). Text
verified in preview; counter test added.

**TASK 11 — polish.** description/OG/Twitter metas, inline SVG bear favicon, WebAudio
blips (task ding / boss-catch sting / fire-drill alarm) with persisted mute — no asset
files, all file://-safe. Verified on the standalone build; zero console errors.

**TASK 12 — final verification.** game-test **67/67**, world-test **56/56** (includes the
100-career soak: desk-only 50/50 escaped, recovery 50/50 escaped day 11, no issues),
standalone rebuilt (99,596 bytes), preview loaded the final build and played the opening
beats with **zero console errors**.

**Deliberately left undone**: nothing from the required list. Stretch items all landed.
Known open threads for next session: desk-only runs now escape hollow rather than die
(acceptable per timebox, revisit if too soft); movie-mode multi-hour run should be done
once in a real foreground tab; PIP/Dennis/meetings remain the next world mechanics
(HANDOFF). The `?v=` history this session: game n4→n7, world w2→w7.

## Session 6 — Ting's playtest feedback (2026-07-09)
First outside playtest (Ting, via iMessage screenshots). Feedback + fixes:
1. **"Walking felt weird — needs something that shows standing at your desk triggers the
   task (highlight the box you're standing on), same for kitchen etc."** → Added
   interaction-spot rings (pulsing diamond on the desk-side tile, coffee, couch, armed
   EXIT; pulse rides the game clock so it pauses with the world) and a **status chip over
   your head**: WORKING… (green, while tasks grind), AT DESK · INBOX ZERO, COFFEE,
   FIVE MINUTES, or NOT WORKING (gray, anywhere else — in the game's voice).
2. **The mascot is a BADGER** (official ™ logo supplied). `assets/mascot.png` now holds a
   crop of the logo from Ting's message (stopgap: replace with the original PNG when saved
   from iMessage — same filename, no code change). Player sprite recolored to badger grays
   + pale snout; status face 🐻 → 🦡.
3. He played the pre-rebalance build ($6,000 / $180 pay) — run-length gripes already
   addressed by Session 5's TASK 6.
?v=w8. Both suites green (67 + 56). Verified in preview: logo on start screen, chip +
tile ring at desk. Committed as one feedback round.

## Session 7 — Tightening pass (2026-07-09, autonomous per TASKS.md)

### TASK 5 — variance sweep (before/after, 50 seeds, strong recovery bot)
- **Before**: every seed escaped on exactly Day 11 (nothing seeded touched money under
  strong play; promotions land every Friday, income deterministic).
- **Levers added (2, both seeded, no new systems)**:
  1. Daily task load is now seeded 6–10 (was always 8); inbox, HUD, and day report follow.
  2. Crunch spot bonus: winning a fire drill pays **$250 — Associate and up only**
     ("Interns are paid in experience"), so the permanent-Intern money cap stays intact
     (peak $2,325). FU_TARGET moved $2,500 → **$3,100** so bonuses genuinely decide the day.
- **After**: escape days = 10×8, 11×36, 12×6 → median 11, spread 10–12. Narrower than the
  hoped 10–14 tail; the structural reason (logged deliberately): promotion pay-jumps
  dominate the money curve, so cash noise can only shift escape day near the crossover.
  A 13–14 tail would need promotion-level variance (e.g. seeded review strictness) — a
  new system, out of scope per the timebox. Stopped tuning after one sweep as ordered.
- Policy sims updated deliberately: third-way now escapes day 12 (no crunches in the sim
  path), soul 87; suck-up dies day 3–4; rebel fired day 4. Intern guard re-verified vs
  the new target and the bonus gate (3 new tests).

### Session 7 final write-up (all tasks + fonts complete)
- **TASK 1**: HANDOFF.md reconciled — body no longer contradicts the Session 5 header
  (was still claiming $6,000 / $180 ladder / day-23 / 4 cards / clock 2.2 / ?v=n4-w2 / bear).
- **TASK 2**: display-shuffle determinism violation fixed — local mulberry32 on
  (runSeed, day, idxInDay), never touches g.rngState. Test proves a career played through
  the shuffled display is byte-identical to raw rule indices. Zero bare Math.random left
  in index.html / ntos-game.js / ntos-world.js (grep-verified; only a comment mentions it).
- **TASK 3**: movie mode proves the escape — ?movie=1 walks out at the number (day-end
  button, or the EXIT door mid-day) and logs the full verdict; ?movie=greed plays to a
  terminal failure; mode logged at start; inert without the flag. Live-verified: forced-
  bank run exited through the door flow with the verdict logged. (Preview console capture
  duplicates every entry ×6 — capture artifact, confirmed against parse-time logs.)
- **TASK 4**: dead-eyed productivity — 3 tasks in a row without recovery → each further
  task +1 Soul; coffee/couch/chat/night reset. Counters on g (serialize). Report row +
  once-a-day toast. Soak: desk-camping flipped from 50/50 hollow escapes to 50/50 soul
  deaths (now asserted); recovery play unaffected; third-way escapes soul 87 (was 97).
- **TASK 5**: variance — see the sweep block above (10×8 / 11×36 / 12×6, median 11).
- **FONTS** (brief directive): Poppins everywhere — CSS families, Google Fonts link, and
  the canvas render fonts. Weights preserved (300/400 labels+body, 800/900 display).
  Live-verified computed styles + font load.
- **TASK 6**: pool 10 → 20, data + tests only. All ten requested territories covered, in
  voice, clock-interleaved; OWNER_BY_ENC rebuilt with an index legend; novelty tour test
  now spans ten days. Sims/soak unchanged.
- **TASK 7**: final build green — game-test **82/82**, world-test **58/58** (100-career
  soak: desk-only 0/50 escape by design, recovery 50/50 escape days 10–12), standalone
  115 KB, preview loaded the final build, played through a NEW card (reply-all, owner
  marcus) with seeded task load 7, Poppins rendering, **zero console errors**.
- **Left undone, deliberately**: the 13–14 escape-day tail (needs promotion-level
  variance — a new system; logged under TASK 5). Nothing else outstanding from the brief.

## Session 8 — Character chaos & serialized office lore (2026-07-09, autonomous per TASKS.md)

The brief called itself "Session 7" but the log already had one, so this is Session 8.
All five REQUIRED tasks landed plus all four STRETCH tasks. One commit per task.
Final state: **178 game + 99 world tests green** (incl. the 100-career soak with all
five arcs active), standalone 176 KB, zero console errors live-verified in the preview.

### The systems added (all state on `g`, all rides the existing save)

**The arc engine (`ARCS` table + `advanceArcs`, TASK 1).** An arc = a named multi-day
storyline with numbered stages; `advanceArcs(g)` runs each morning inside `nextDay`,
BEFORE `planDay` (arcs can bar cards). All arc randomness uses LOCAL mulberry32
generators keyed off a new `g.runSeed` (+ arc name + day + purpose) — `g.rngState` is
provably untouched (test: 8 days of plans identical with the engine running vs. a
bare planDay replay), so every pre-existing balance number survived unchanged.
`g.npcState` tracks all seven coworkers (stress/trust/arcStage/flags/counters).
`worldFlagsFor(g)` is the single one-way bridge the shell passes to `W.newDay(seed,
day, plan, flags)`. Five arcs are table entries: brad_second_job, boss_spiral,
hr_survey, kayla_presentation, marcus_survivor. A future arc = one entry + incident
content + (if needed) a few world staging flags.

**Arc incidents.** Story cards outside the 20-card deck (deck untouched, per brief).
`g.todayIncidents` staged by the morning's arc advance → world merges them into the
event queue (kind 'card' | 'incident', sorted by minute) → the owner NPC walks over →
`arcincident` signal → same overlay → `applyIncidentChoice(g, id, idx, min)`.
Incidents gate 5 PM exactly like cards (tested: an incident staged at 1015 fires
before dayover may). Unanswered incidents re-stage next morning — no day can strand.

**The office feed (TASK 3).** Brain-owned: `g.feed` (cleared each morning), written
only by real events — `moodFeed` (notable moods only, boss intel always leads, ≤3
lines, once-per-morning resume-safe guard), `feedWorldEvent` (bradSteal/bossCatchBad/
crunch/couch/summons), review lines in closeDay, and every arc stage/incident. Shell
renders a collapsible `#office` ticker (latest 3, persisted collapse) + a full-day
`<details>` log on the 5:01 report. Determinism proven end-to-end: two identical
soak careers produce byte-identical final-day feeds.

**Receipts (TASK 4).** `g.receipts` = named flags + `count` (held) + `earned`
(lifetime); `addReceipt/hasReceipt/burnReceipt`. Current sources:
`screenshot_brad_deck` (discovery card), `hr_survey_metadata` (survey card). Spends:
the Credit-Reassigned burn; a metadata receipt auto-defuses exactly one review
warning. One-line HUD count ("N held · leverage, technically"), award hook
(Least Legally Defensible), share hooks.

### The arcs, branch by branch (and how each is tested)

**Brad's second job (TASK 2, the flagship).** Stages: 1 second laptop (drawn on his
desk — lit lid) → 2 status shifts ("on a call", no meeting links; idle time now goes
to a new STAIRS furniture spot) → 3 deck-detour walk past your desk (`braddeck`
signal → toast + feed) → 4 discovery card → 5 exposed/waiting → 6 fired-today →
7 gone / 8 closed quietly. Discovery choices: **screenshot** (receipt), **cover**
(trust +3, `noBradRaids` for the rest of the run, Soul −6 — complicit), **ride**.
Holding the receipt gives Credit Reassigned a 4th choice: burn it, +10/+8, theft
reversed with interest (re-opens stage 8 → 5). Resolution seeded at 0.5/morning ×3
mornings (test across 30 seeds: both fired and got-away-with-it occur). The firing
is a watchable world choreography: 11:30 wrong-Zoom all-hands feed/toast → noon
Meredith collects him at his desk (follows if he wanders) → both walk to the EXIT →
`bradfired` → he's off the floor, desk drawn as cleaner carpet, `bradtasks` pushes
+2 into your inbox ("growth opportunity"). Raid schedule changes tested BOTH ways
(covered → 0 raids while he stays; fired → 0 raids + cards leave planDay, including
the firing morning itself so nothing can strand). Live-verified in the preview:
allhands@11:30 → fired@12:33 → tasks → dayover@5:00.

**The Boss spiral (TASK 5).** Hot for a seeded 4–6 days from day 6–9: +1 floor walk,
crunch +0.25, and a quick-call summons answered with your feet (walk to the corner
office inside 90 game-min; expiry = dodge). **Sympathize**: +3/−4, `softCatch`
(catches −4/−7), and the summons become DAILY — the emotional-support-animal tax.
**Deflect/dodge**: −1/+2, summons stop, `hardCatch` (−8/−11) for the arc's duration;
the engine deletes both flags at resolution (tested). `bossCatchMod` is the named
rule inside applyWorldEffect. One off-schedule human beat: world proximity signal
(near his desk, not during a summons) → `bossHumanBeat` (once per run) + bossHuman
WORLD_EFFECT (+2 Soul). He gets more human; the numbers stay dangerous.

**The HR survey (TASK 7).** Launch feed ("a font that knows your name") + card via
Meredith; next day the hunt (cross-referencing writing styles), then filed. Choices:
bland fives (+1/−4), the truth (+8 Soul now, a one-shot −5 Standing bill that
attends your next review — can flip a promotion or end a run), help a seeded
coworker (their trust +2), or read the page source (`hr_survey_metadata` receipt →
defuses one warning: no soul hit, no stats.warnings, feed line about response IDs;
receipt spent; the next warning lands normally — all asserted).

**Kayla's presentation panic (TASK 6, tone rule enforced).** Panic day: pinned in
the kitchen (KITCHEN_CORNER), status shifts ("the deck is fine." it is on v31),
feed notices. Choices are physical: **sit with her** rides the chat errand (Soul +4,
trust +2, `bonded` → her chats +2 forever via `chatBonus`), **take one of her
tasks** (walk-over errand, +1 task onto your real stack), **keep working** (priced:
Soul −3 at 5 PM, named row "You kept your head down. It stayed down."), or **tell
HR** — the worst helpful option: Meredith walks to the kitchen, Kayla is visibly
walked to the EXIT and sent home (never strands the day, tested), the org pays YOU
+1 Standing for "flagging a risk," and next morning a mandatory 90-minute
"Resilience & You" webinar freezes task work 9:00–10:30 while the drip continues
(mechanically tested: zero taskdone during, resumes after). Comedy targets the
webinar/system only.

**Marcus the survivor (TASK 8).** Permanent mentor from day 3–5. Chatting delivers
one seeded tip/day: a boss-walk read (shell reveals the real pending walk time),
one-missed-task forgiveness at 5 PM (`taskForgivenessToday`, report row), a one-shot
catch shield (`consumeCatchShield`), or (~25%) a miscalibration costing Standing −2
on the spot. Never a fraud — the character direction (Marcus = survivor, Brad =
scandal) is enforced in data and documented in HANDOFF.

### Headlines, awards, share (TASKS 8+9)
`dayHeadline(g)`/`dayAward(g)`: pure first-match functions of the day's real
counters/incidents (firing > discovery > quick call > survey > Kayla outcomes >
promotion/warning/dead-eyed > fallback "survived."; awards: Main Character of the
Day / Least Legally Defensible / Most Dead Inside / Office Emotional Support Animal /
Best Supporting Spreadsheet / fallback). `shareText(g)` in the brain: leads with the
best real incident (watched-the-firing > burned-the-screenshot > escaped-holding-it >
survey metadata > covered > support animal > managed-out/management lines > counter
list) and falls back to the plain format when a run has no story. Tested that it
never invents (fresh run mentions no arc) and matches the brief's register lines.

### Soak & verification (TASK 10)
The soak now drives the FULL pipeline: `worldFlagsFor` into newDay, moodFeed each
morning, every new signal handled the way the shell handles it (incident choices
rotate by day so all branches soak), and two new per-day assertions: staged
incidents must all fire before 5 PM, and a staged firing must complete that day.
100 careers: recovery 50/50 escapes days 10–12 (median 11 — balance unmoved by five
live arcs), desk-only 0/50 escapes (all soul deaths), zero hangs/stuck actors/
exceptions. Zero bare Math.random (grep: one comment). Standalone rebuilt (176,614
bytes). Preview: a full staged story day (survey + discovery + Kayla panic on day
5!) and the firing day played through the real shell with **zero console errors**;
screenshots confirmed the second laptop, the feed ticker, and the receipt HUD.

### What remains risky / next
- **Story-day pileups**: day 5 above stacked survey + discovery + Kayla panic + two
  cards. Nothing broke (events queue serially), but pacing may want arc-start
  jitter so two incidents rarely share a morning. Watch playtests.
- **Balance drift from arc rewards**: the receipt burn (+10/+8) and sympathize
  (+3/day) are strong; soak medians didn't move, but a deliberate exploit pass
  hasn't been done.
- **Escort edge cases**: Meredith-follows-Brad converges because he heads home, but
  a pathological wander loop would only resolve via retry; the soak never hit one.
- Next: PIP arc as an ARCS entry (warnings → PIP → summons to the HR pod — the
  engine and summons machinery are both ready for it), Dennis-as-blocker, meetings,
  arc-start spacing, and the mascot PNG swap.

## Session 10 — The corporate disaster machine (2026-07-10, autonomous per brief)

**The diagnosis this session answered:** the game was walk → work → recover →
popup → repeat; funny writing, not enough funny *player-caused* outcomes. The
fix was verbs, chains, and spatial decisions — no new coworkers, no new deck
cards, no visual polish. Systems colliding, not text.

### TASK 6 — Office heat (built first: the foundation the chains hook into)
Three pressure meters on `g.heat` — **HR heat / Boss attention / Brad
paranoia** — raised only by things the player actually did:
- HR: survey truth +2, each receipt collected +1, public receipt-burns +1,
  warnings +1. Consequence: at High the **warning bar moves** (WARN_AT+5) and
  Meredith starts the writing-style project (morning feed tell).
- Boss: promotion +2, dodged summons +2, crunch win +1, perfect ship-day +1.
  Consequence: at High an **extra floor walk** and **off-arc quick-call
  summons** on seeded ~1-in-3 days.
- Brad: the screenshot +2, backing Priya +1, the bait +2, foiled raids +1.
  Consequence: at High an **extra raid** (rolled LAST in newDay so pre-heat
  staging never shifts) and, once per run, the seeded **self-own morning**
  (FINAL_v2_BRAD_PRIVATE, recalled twice).
HUD shows a heat line from Medium; the 5:01 report carries all three levels.
Serialized on g, reset by newGame, lazy-init for old saves.

### TASK 3 — Chain reactions (8 links, each marked CHAIN in comments)
1. Survey truth → HR heat → higher warning bar + the highlighter feed tell.
2. Backing Priya (or the bait) → Brad stress + paranoia → more raids.
3. Ignoring Kayla → her chats refill −2 for the rest of the run; the
   dead-eyed headline bar drops to one task.
4. Exposing Brad (burn OR flash) → Legal morning line + **his raids end**.
5. Dennis blocker + Adam deployed → seeded 50/50 bypass or a worse day.
6. Boss spiral + Boss attention ≥ Medium → deflecting only works some days
   (the "five minutes" that never is).
7. Warnings themselves compound HR heat.
8. Paranoia High → the self-own morning (his mistake, your feed).

### TASK 4 — the map tells (trouble visibly crosses the floor first)
- **Brad lurks** at a water spot with line of sight on your inbox ~25 game-min
  before every raid (👀 over his head, toast, status line).
- **The Boss stands up** and reads the floor ~20 min before each walk (📋).
- **Dennis carries the blocked files** desk↔Pipe with a red folder in hand on
  blocker days (destination override only — identical rand spend, so nothing
  else's staging shifts).
- **Adam walks to HR "with a concern"** ~1 day in 3 (seeded on his side
  stream; pre-existing Adam staging byte-identical).
- **Priya sets up in the MEETING ROOM** 40 min before the demo; the demo card
  now fires there (the presenter walks to the room, not to your desk). Spot
  rings mark The Pipe (while files are held) and the demo room.

### TASK 5 — interruptible floor events (react with your feet)
- **The lurking Brad**: confront him ("Looking for something?") — raid dies,
  paranoia +1; or sit tight (foil, as before); or see TASK 2's bait.
- **Dennis mid-carry**: fall into step and answer the questions en route —
  one approval clears free, once a day.
- **Adam's concern walk**: intercept with a question about 2009 (Soul −1, HR
  never hears) or let it land (HR heat +1, a folder opens); on a blocker day,
  point him at Dennis instead.
- **The pre-demo window**: reach Priya in the meeting room before it starts to
  collect the commit log early or plant the flawed backup file (the demo card
  then auto-detonates — you chose earlier, in the empty room).

### TASK 2 — schemes (5, all deterministic, all serialized on g.schemes)
1. **Flash the screenshot** at Brad: shown, not spent — raids end for the run
   (cowed), paranoia +2. The receipt stays for the Credit-Reassigned burn.
2. **The poison file**: leave the flawed file on top, be visibly elsewhere;
   the raid becomes `bradpoisoned` — you lose the task, he presents poison
   (Standing +3, paranoia +2, two feed lines, headline, award).
3. **Adam as a chaos grenade** vs Dennis: seeded 50/50 — everything approved
   to end a conversation about index cards, or a sub-process is born and one
   more file gets stuck (Soul −1, you're invited to the meeting about it).
4. **Cool HR with the metadata**: burns the receipt, zeroes HR heat — and
   *competes* with its warning-defusal use. One receipt, two jobs, pick.
5. **The commit log as calibration context** (+5 Standing, spent): receipts
   work on slides about you, too.

### TASK 1 — the story collection (replayability across runs)
13 stories (the brief's list; `STORY_META` names + no-spoiler hints live in
the brain, localStorage lives ONLY in the shell). Start screen: "Stories
found X / 13" + View stories (found = named; locked = ??? + hint). Run end:
"★ New story discovered: …" first time, "Story recorded: …" after.
`earnedStories(g)` multi-unlocks everything a run clearly earned, ladder lead
first. Verified live in the browser: unlock → localStorage → reload → count
persists.

### TASK 7 — failures name what killed you (first-match over real state)
Became the Notes Person (comply ledger ≥8 — applyChoice now counts
Standing-for-Soul trades) · Promoted to Emotional Support Employee (3+ quick
calls) · Productivity Held (Kayla ignored) · Returned With Track Changes (5+
approvals ground out) · Identified by Writing Style (HR heat High/truth
billed) · Reassigned Into Brad's Narrative (3+ steals) · Followed Up to Death
(Adam attrition ≥3). Plain deaths keep the plain endings. All shareable.

### TASK 8 — microcopy tied to events, never dice
Blocked-file toasts escalate (1st/2nd/"The Pipe is becoming a district");
ship toasts know about held files, inbox zero, and review Fridays; Adam's
interception lines escalate with his actual count; 6 new headlines (poison,
grenade, self-own, confront, cooled, concern) + 3 new awards (Best Supporting
Saboteur, Regional Director of Chaos, Human Firewall); share copy counts
schemes ("The building started it.").

### TASK 9 — the gate (all ran, all seen green)
| policy        | escaped | soul-death | standing-loss | hangs |
|---------------|--------:|-----------:|--------------:|------:|
| movie-default | 50/50   | 0          | 0             | 0     |
| competent     | 50/50   | 0          | 0             | 0     |
| desk-only     | 0/50    | 50         | 0             | 0     |
| suck-up       | 0/50    | 50         | 0             | 0     |
| rebel (60-day)| 0/50    | 0          | 50            | 0     |

- Escape days with every new system active: **47/50 in Day 10–16** (94%,
  tail 17/19/19 ≤ 22); Soul at escape **54–88, median ~70** — the heat taxes
  are priced in and the shape held without retuning.
- movie ≡ competent asserted by exact equality; the soak handles the one new
  autonomous signal (`adamconcern`) exactly as the shell does.
- **269 game tests** (26 new: heat, chains, schemes, collection, verdicts) +
  **151 world tests** (23 new: lurk/confront, bait/poison, flash, boss
  telegraph, Dennis carry/escort, concern walk/redirect, grenade, demo room
  + pre-verbs) — all green, zero bare Math.random anywhere new (Dennis's
  carry provably spends identical rand; Adam's concern rides his side stream).
- Browser (n20/w19, zero console errors): story unlock → reload → persists;
  heat line appears at Medium; `?movie=1` autopilot ran with schemes,
  approvals and the walkout intact (see below).
- Standalone rebuilt (371 KB). Three deliberate assertion amendments, all
  argued in commits: spiral walks ≥1 (heat can stack a second), deflect
  asserted with a cold boss, blocked-count captured at signal time.

### What remains risky / next
- Competent play now runs Boss attention High most runs (perfect ship-days);
  the extra walk is mostly upside at the desk — watch whether human players
  read "Boss High" as threat or trophy.
- The poison file and the flash are strictly better than eating raids once
  you hold the pieces; if playtests show no-brainer feel, price them.
- The pre-demo auto-detonate removes the in-room choice when pre-planted
  (intended: you chose earlier) — verify it reads as payoff, not railroad.
- Rebel still has no survivor tail; unchanged from Session 9.

## Session 9 — Recovery session (2026-07-10, autonomous per TASKS.md)

### TASK 0 — the audit (what git actually shows)

The suspicion behind this session was that a previous brief commissioned a competent
policy, arc selection, a Priya arc, and a Dennis blocker, and that the session
carrying it either dodged the hard parts or died. **Git settles it: that session
never ran against this repo.** Evidence, checked directly:

- `git log --oneline -30`: every commit since the Session 5 baseline maps 1:1 to a
  brief that IS in the repo's history. Session 7 (tightening pass): TASK 1–7 commits
  all present. Session 8 (character chaos): TASK 1–10 commits all present
  (797d435 → 7a54004), plus five post-session fix/visual commits requested live
  (mascot inline, scroll fix, legend alignment, two visual passes).
- `git log --follow TASKS.md`: exactly three briefs were ever saved here — the
  baseline, Session 7's, and Session 8's. **No version of TASKS.md ever contained
  the policy/Priya/Dennis brief.** It was written in a chat that never touched this
  folder — nothing was saved, nothing was committed, nothing partial exists.
- Grep across HEAD for the commissioned systems: `policyAction`, a `priya_*` ARCS
  entry, any needs-approval/blocker code — zero hits. Priya exists only as a chat
  peer and feed lines. The ARCS table holds exactly the five Session 8 arcs.
- Does SESSION_LOG overstate? **No.** Each Session 8 claim maps to a commit and to
  code present at HEAD; the movie-mode and soak claims describe the dumb desk-bot
  accurately (it was never claimed to be competent). The log's own "next steps"
  list Dennis-as-blocker as future work, consistent with never-built.

Verdict: not "ran and dodged," not "ran and died" — **never ran.** The correct
recovery is to build the commissioned systems now, which is the rest of this brief.

### TASK 7 — the sweep matrix (the gate; 50 seeds per policy, ran and seen green)

| policy        | escaped | soul-death | standing-loss | survived-to-horizon | hangs |
|---------------|--------:|-----------:|--------------:|--------------------:|------:|
| movie-default | 50/50   | 0          | 0             | —                   | 0     |
| competent     | 50/50   | 0          | 0             | —                   | 0     |
| desk-only     | 0/50    | 50         | 0             | 0                   | 0     |
| suck-up       | 0/50    | 50         | 0             | 0                   | 0     |
| rebel (60-day horizon) | 0/50 | 0    | 50            | 0                   | 0     |

- **movie-default ≡ competent** is asserted by exact-equality on outcomes AND
  escape-day arrays across the same 50 seeds — they consume the identical
  `policyAction`/`policyCardChoice`/`policyIncidentChoice` functions. A live
  browser `?movie=1` run corroborates (result appended below).
- **Competent escape days**: 10×14, 11×20, 12×3, 14×2, 15×7, 16×2, 19×2 —
  48/50 inside Day 10–16; the two 19s are Dennis-taxed promotion-margin seeds
  (gate amended to the brief's own "most runs" wording: ≥90% in-window, ≤22).
- **Soul at escape** (Task 3 final): 58–89, median ~71, 80+ in 7/50 —
  worn, not gutted. Baseline before this session's tuning was 84–100.
- **Lead stories** (competent sweep): kayla_helped 18, hr_metadata 15,
  brad_exposed 10, marcus_saved 4, boss_survived 2, priya_backed 1 —
  six distinct leads; Brad a clear minority.
- **Rebel note, honest**: zero rebels survived to the 60-day horizon — the
  brief's "sometimes survives" did not materialize at this tuning; all 50 lost
  to Standing, which satisfies the required shape ("usually loses to
  Standing") but with no survivor tail. Logged as-is rather than tuned for.
- **Live browser corroboration (performed, watched)**: `?movie=1` on the final
  build (n18/w17) played a full career through the real shell — drew the
  hr_survey + priya_credit arcs, ran Soul ~75 mid-career (the new economy,
  live), and **escaped Day 10 with $3,275 and Soul 81** — verdict "F-You
  Money. Out the Door. Whole.", share led by the survey-metadata story.


### The systems this session added (TASKS 1–8, one commit each, all gated green)

**TASK 1 — the one competent policy** (`policyAction` / `policyCardChoice` /
`policyIncidentChoice`, pure dev-marked brain functions). Consumed by BOTH
`?movie=1` and the headless soak — identity proven by exact-equality sweeps.
Movement rules per brief (walk out immediately incl. mid-day door + mid-day
arming in the shell, never interrupt errands, answer summons by walking,
never ignore Kayla, recovery ladder coffee→couch→best chat at the grind
threshold or when Soul collapses). Cards scored s + 1.3·so with <35 guards;
incidents get named cases. `?movie=greed` still burns out on purpose.

**TASK 2 — arc selection + the story ladder.** 2–3 story arcs drawn per run
(weighted, Brad 0.5; Marcus always on; undrawn arcs fully dormant — tested over
15 marched days). storyKey/storyLine ladder in the brief's exact order; new
flags (kayla.ignored, marcus.counters.saves, meredith.counters.defused).
Brad's firing softened to 0.4×2 mornings so the held-screenshot run exists.

**TASK 3 — the cost of a good run.** Three measured rounds, logged: trims+heat
(85–100 → 77–100), promotion cost 9 + Brad-hot days + deeper trims (→ 69–100),
then the structural lever — Soul gains halve above 70 ("contentment attracts
meetings", one temper helper at all four gain sites) → **50–93, median ~70**.
Final post-Dennis distribution 58–89 median ~71, 80+ in 7/50, pinned by a
sweep assertion. The crude third-way brain-sim now lands the hollow tier.

**TASK 4 — Priya's arc** (priya_credit, in the pool). Build days (pinned at
her desk, feed notices) → demo day card presented by Brad (or the Boss if Brad
is out of play) → the Boss thanks "the team". Five tested branches: back
publicly / DM / collect priya_commit_log (later burns on Credit Reassigned:
+8/+6, Brad rattled, Priya credited) / let it slide (Soul −4, "The team was
one person") / bait the demo (seeded 50/50 triumph or trace-back). Plus a
latent stranding bug fixed generically: events whose owner left the floor get
a substitute deliverer.

**TASK 5 — Dennis the blocker.** ~1-in-4 seeded days, ~30% of post-morning
arrivals NEED APPROVAL (red-edged desk stack + HUD count, cannot ship). Four
clearing paths, all tested: the Pipe wait (visible 6s amber bar), flattery
(Soul −2, once/day), burn a receipt (least-precious-first), Marcus's phrase.
Ignoring never deadlocks — unfinished at 5 PM. Blocker days are hot.

**TASK 6 — policy wiring.** priya_demo: back publicly at Standing ≥55 else DM;
approvals: shield when 2+ stuck, Pipe trips batched into idle time, receipts
never burned on Dennis. Acceptance re-swept green with everything active.

**TASK 7 — the sweep matrix.** See the table above. Passed as written.

**TASK 8 (stretch) — Adam.** Ninth cast member, world-first: bullpen desk,
bald with a shine highlight, mood/status lines in his voice, feed register per
brief. His seeding rides a side stream keyed off (seed, day) — the entire
pre-Adam seeded battery and the matrix pass unchanged with him on the floor.
The interception: pass within 1.7 tiles and he sometimes (≤2/day, cooldown)
holds you mid-stride for 2.5 real seconds with a 💬 "quick thought—";
~15% of the time it clears a Dennis approval free. No card; deck stays 20.
His tests caught a real falsy-zero bug in the roll guards (0.0 || 1).

### Final state + what remains risky
- **229 game + 128 world green** (matrix + soak + all arcs + Adam), zero bare
  Math.random (one comment), zero console errors on the final preview build,
  standalone 318 KB rebuilt.
- **Risky / next**: the two Dennis-taxed day-19 seeds (promotion-margin runs;
  acceptable under the amended "most runs" gate, but a promotion-variance
  system would smooth the cliff). Zero rebel survivors at this tuning — if
  "sometimes survives" matters, rebels need a survival valve. Adam's
  interception frequency is untested against human patience (≤2/day cap may
  still annoy; watch playtests). The policy never burns receipts on Dennis by
  design — if receipts pile up unused in long runs, consider a valve. Priya's
  bait-fail (−7) is harsh at low Standing.

