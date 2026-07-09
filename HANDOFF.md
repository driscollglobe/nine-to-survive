# Nine to Survive — HANDOFF

Pick up here. This is the active game (MARQUE is retired/intact at `/Desktop/marque/` — reuse
its *patterns* only). Everything lives in `/Users/kevindriscoll/Desktop/nine to survive/`.
It RUNS and TESTS GREEN (**178 game + 99 world**, incl. a 100-career soak with all five story
arcs active). The folder is a **git repo**: one commit per task, nothing pushed, `TASKS.md`
holds the current session's brief. Read SESSION_LOG Sessions 5–8 for how it got here.

## Current quick facts (Sessions 5–8, 2026-07-09, autonomous)
- **Balance**: your number is **$3,100**; a day = 2.5 real min (CLOCK_SPEED 3.2); pay
  260/420/640/820/1000 + $250 crunch spot bonus (Associate+ only); seeded task load
  6–10/day; escape days 10–12, median 11 ≈ 27 min — **unchanged with all arcs live**
  (soak-guarded). Permanent-Intern win impossible (bank peaks $2,325, test-guarded).
  Desk-camping with no recovery DIES by Soul (dead-eyed productivity).
- **The lore layer (Session 8)**: arc engine + npcState + incidents + feed + receipts +
  headlines/awards + story share. See below.
- **Persistence**: localStorage save/resume (`ntos-save-v1`, phase-aware) — npcState,
  arcs, receipts, feed, and staged incidents all live on `g`, so they ride it free.
- **Soak**: `world-test.js` §12 plays 100 full careers through the REAL pipeline (arcs,
  incidents, feed, summons, firings) and asserts staged story beats always land before
  5 PM. Keep it green.
- **Dev tools**: `?movie=1` / `?movie=greed` autopilot (handles 2-choice incident cards);
  shell stuck-watchdog; `window.g`/`window.world` exposed.

## CHARACTER DIRECTION (non-negotiable, from the user)
- **Marcus is the SURVIVOR** — the coasting master who has seen every reorg and believes
  in none of it. Funny, useful, slightly spiritually dead, **never a fraud**.
- **Brad is the SCANDAL** — ambitious, performative, insecure, already the credit thief;
  the second-job arc belongs to him.
- **Tone rule**: punch the company, the incentives, the fake language, the systems.
  Never mock the person suffering (see the Kayla arc for the reference treatment: the
  joke is the webinar, never her).

## The resolved design (user's calls — evolved across the day)
- **WIN: F-you money.** Bank **$3,100** and walk out — day-end button or physically
  through the armed EXIT door. Title: "Your Number".
- **FORM: a REAL-TIME game** (after two course-corrections; the user was emphatic).
  The world IS the game: drive the badger, work is physical, threats cross the floor,
  recovery means leaving your desk. Cards are rare spice (2/day + arc incidents).
  **World-first doctrine**: if a feature could be a popup, make it a thing in the world.

## The lore layer (Session 8) — how stories happen
- **`ARCS` table + `advanceArcs(g)`** (brain): an arc = named multi-day storyline with
  numbered stages, advanced every morning in `nextDay` BEFORE `planDay`. All arc
  randomness = LOCAL mulberry32 off `g.runSeed` (never `g.rngState`, so plans and
  balance never shift). **Adding an arc = one table entry + incident content +
  world staging flags.** Five arcs live: `brad_second_job`, `boss_spiral`, `hr_survey`,
  `kayla_presentation`, `marcus_survivor`.
- **`g.npcState`** — all seven coworkers: stress/trust/arcStage/flags/counters.
- **`worldFlagsFor(g)`** — the ONE bridge: plain data the shell passes to
  `W.newDay(seed, day, plan, flags)`; the world stages clues physically from it
  (Brad's second laptop is drawn; his idle time goes to the STAIRS; Kayla is pinned in
  the kitchen; extra boss walks; the webinar freezes task work; the firing choreography).
- **Arc incidents** — story cards outside the 20-card deck: staged on
  `g.todayIncidents`, merged into the world event queue (kind 'card'|'incident'),
  owner walks over, same overlay, resolved via `applyIncidentChoice`. They gate 5 PM
  like cards and re-stage next morning if unanswered — a day can never strand.
- **The feed** — `g.feed`, brain-owned, deterministic, real events only (`moodFeed`,
  `feedWorldEvent`, arc/incident/review lines). Shell: collapsible `#office` ticker
  (latest 3) + full-day log on the 5:01 report. Same seed = same feed (soak-proven).
- **Receipts** — `g.receipts` named flags + held/lifetime counts. Sources:
  `screenshot_brad_deck`, `hr_survey_metadata`. Spends: the Credit-Reassigned burn
  (4th choice, +10/+8, reverses the theft); metadata auto-defuses ONE review warning.
  HUD shows a one-line held count.
- **Headlines/awards/share** — `dayHeadline(g)` + `dayAward(g)` on the day-end screen,
  `shareText(g)` leads with the run's best REAL incident; all pure functions of run
  state, all tested to never invent.

### Arc cheat-sheet (stages the world reads)
- **Brad**: 1 laptop → 2 "on a call"+stairs → 3 deck detour (`braddeck`) → 4 discovery
  card (screenshot/cover/ride) → 5 waiting (0.5/morning ×3) → 6 FIRED TODAY (11:30
  wrong-Zoom all-hands → noon Meredith escort → EXIT → +2 absorbed tasks) → 7 gone
  (no raids, cards leave planDay) / 8 closed quietly. Cover = raids off for the run.
- **Boss**: hot 4–6 days from day 6–9 (+1 walk, crunch +0.25, daily summons — walk to
  the corner office or it's a dodge). Sympathize: catches soften, summons daily.
  Deflect/dodge: summons stop, catches harden. Modifiers expire with the arc
  (`bossCatchMod`). One off-schedule human beat (world moment, once/run).
- **Survey**: launch → card (bland/truth/help/metadata) → the hunt → filed. Truth =
  one-shot −5 Standing at your next review.
- **Kayla**: panic day in the kitchen — sit with her (chat errand; bonded = her chats
  +2 forever) / take a task (+1 on your stack) / keep working (Soul −3 at 5 PM) /
  tell HR (she's sent home, you get +1 Standing, next morning "Resilience & You"
  eats 9:00–10:30 of task time).
- **Marcus**: mentor from day 3–5, one tip per chat/day: boss-walk read, task
  forgiveness, one-shot catch shield, or a −2 Standing miscalibration (~25%).

## The real-time loop (Sessions 3–6 — see SESSION_LOG for detail)
`ntos-world.js` (`NtosWorld`): 40×26 iso grid, furniture + zone rugs (+ STAIRS), cast
of 8 with seeded daily moods, BFS pathing, constant clock (3.2 game-min/sec).
Click-to-move; tasks drip 6–10/day and ship AT your desk (~11s each); `closeDay`
decay −6 and −1/unfinished task; boss floor-walks (at desk +2 / caught −6, −9 bad
days, ± arc modifiers); Brad raids (steal/foiled/empty — unless covered/fired);
recovery = coffee/couch/chats, once each/day; fire drill ~45% (+arc boost), $250
bonus Associate+; EXIT door armed at the number; 5 PM → dayover → payday report
(now with headline, award, feed log) → clock in. All floor outcomes flow through
`NineToSurvive.WORLD_EFFECTS` via `applyWorldEffect` (+ named rules `bossCatchMod`,
`consumeCatchShield`); the world emits a signal queue from `step(w, dt)`; the
shell's `handleSignal()` applies effects + toasts + SFX and forwards feed-worthy
events to the brain.

## Files (mirrors MARQUE's structure)
- `ntos-game.js` (`?v=n12`) — the BRAIN. Career rules + the lore layer: `ARCS`,
  `advanceArcs`, `worldFlagsFor`, `ARC_INCIDENTS`, `applyIncidentChoice`,
  `extraChoicesFor`/`applyExtraChoice`, receipts, feed (`pushFeed`/`moodFeed`/
  `feedWorldEvent`), Brad/Boss/Kayla/Marcus handlers, `dayHeadline`/`dayAward`,
  `storyLine`/`shareText`. No DOM; seeded mulberry32 on `g.rngState` + clearly-scoped
  local generators on `g.runSeed`; zero bare Math.random.
- `ntos-world.js` (`?v=w13`) — the OFFICE. Flags-driven staging (laptop, stairs,
  deck detour, firing escort, summons, Kayla kitchen, webinar), event queue with
  incidents, verbs incl. `goForBossCall`, `takeKaylaTask`, `reportKayla`. Never
  touches meters; render is the only canvas code.
- `index.html` — the SHELL. Canvas world + HUD (+ receipts line) + `#office` feed
  ticker + card/incident overlay + crunch modal + status popups (context buttons:
  chat / sit-with / take-task / quick call / mention-to-HR) + day report (headline,
  award, feed log) + share + movie mode + watchdog + save/resume.
- `ntos-standalone.html` — fully-inlined shareable (176 KB); `build_standalone.py`
  inlines both modules. **Rebuild after any change.**
- `game-test.js` (178) + `world-test.js` (99, ~1.5 min — includes the 100-career
  arc-active soak) — `osascript -l JavaScript <file>` (JSC, no node). Keep BOTH green.
- `TASKS.md` — the current session's brief (verbatim). `assets/mascot.png` — official
  badger logo (swap for Ting's original PNG when saved, same filename).
- Preview config `nine-to-survive` in `/Desktop/untitled folder 2/.claude/launch.json`
  (`autoPort: true`, base 4186).

## Workflow rules (same as MARQUE)
1. Career rules + lore → `ntos-game.js`; staging/movement → `ntos-world.js` (both
   DOM-free + deterministic). Presentation/wiring → `index.html`.
2. Bump `?v=` cache-busters when a module changes (`n#` game, `w#` world).
3. After edits: run BOTH test suites → `python3 build_standalone.py` → verify in the
   browser preview. Keep index + standalone in sync.
4. Headless preview tabs are rAF-throttled — drive `W.step` manually when verifying.

## Next steps (world-first; the arc engine is ready for all of these)
1. **PIP arc** as an ARCS entry: chain review warnings → PIP stage flags → Meredith
   summons YOU to the HR pod (the boss-summons machinery generalizes directly).
2. **Arc-start spacing**: two incidents can share a morning (works fine, but pacing
   may want jitter so big story days are rarer).
3. **Exploit/balance pass** on arc rewards (receipt burn +10/+8, daily sympathize).
4. **Dennis as a physical blocker** (carry approvals to The Pipe) — could also mint a
   `dennis_approval_timestamp` receipt.
5. **Meetings** on a calendar (be in the MEETING ROOM or take the hit; the webinar
   freeze is the prototype).
6. Mascot PNG swap; later: run meta (unlocks, traits) — the roguelike layer.
