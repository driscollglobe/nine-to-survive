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
