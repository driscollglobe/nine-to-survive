# Nine to Survive — HANDOFF

Pick up here. This is the active game (MARQUE is retired/intact at `/Desktop/marque/` — reuse
its *patterns* only). Everything lives in `/Users/kevindriscoll/Desktop/nine to survive/`.
It RUNS and TESTS GREEN (**269 game + 151 world**, incl. a five-policy 50-seed sweep matrix
with every system active). Git repo, one commit per task, never pushed.
Read `SESSION_LOG.md` Sessions 5–10. Session 10 is the "corporate disaster machine" pass:
heat, chain reactions, spatial tells, interceptions, schemes, the story collection,
named failures. The game is no longer walk→work→popup: trouble crosses the floor
visibly, and the player can intercept, exploit, redirect, or weaponize it.

## Session 10's layer (know these five systems)
- **Office heat** (`g.heat` — hr/boss/brad, `addHeat`/`heatOf`/`heatLevel`): raised
  only by real player actions; consequences: HR High moves the warning bar +5,
  Boss High adds a floor walk + off-arc quick-call summons (~1-in-3 days), Brad
  High adds a raid + the once-per-run self-own morning. HUD line from Medium;
  levels on the 5:01 report. Extra raid is rolled LAST in newDay (stream-safe).
- **Chain reactions** (8, grep `CHAIN:` in ntos-game.js): truth→writing-style hunt;
  backing Priya→paranoia; ignored Kayla→cold chats (−2) + easier dead-eyed
  headline; exposed Brad→Legal line + raids END (burned/cowed); blocker+Adam→
  50/50 bypass/worse; spiral+attention→deflect only holds some days; warnings
  compound HR heat; paranoia→self-own.
- **Tells + interceptions** (world): Brad LURKS 25 min pre-raid (👀 — confront
  kills the raid; or plant the flawed file and let him steal poison); the Boss
  stands up 20 min pre-walk (📋); Dennis carries blocked files desk↔Pipe (red
  folder — walk with him = one free clear/day); Adam walks to HR "with a
  concern" ~1-in-3 days on his side stream (redirect = Soul −1, land = HR heat
  +1, or point him at Dennis); Priya sets up in the MEETING ROOM 40 min
  pre-demo — the demo card fires THERE; reach her early to collect the commit
  log or plant the backup file (card then auto-resolves as the bait).
- **Schemes** (`g.schemes`, 5): flash the screenshot (raids end, receipt kept);
  the poison file (+3 Standing, he presents it); the Adam grenade (seeded
  50/50); metadata cools HR to zero (COMPETES with its warning-defusal use);
  commit log as calibration context (+5, spent). All extra verbs/choices that
  exist only when their conditions hold.
- **Story collection**: 13 unlockables (brain: `STORY_META`/`STORY_ORDER`/
  `earnedStories` — multi-unlock, ladder lead first; shell: localStorage
  `ntos-stories-v1`). Start screen count + View-stories (locked = ??? + hint);
  end screen "★ New story discovered" / "Story recorded". Specific failure
  verdicts name the killer (Notes Person, Emotional Support Employee,
  Writing Style, Track Changes, Brad's Narrative, Followed Up to Death,
  Productivity Held) off real counters incl. the `g.stats.comply` ledger.

## Current quick facts (through Session 10, 2026-07-10, autonomous)
- **Balance**: your number is **$3,100**; a day = 2.5 real min; pay 260→1000 + $250 crunch
  bonus (Associate+). Competent play escapes **days 10–16 (47/50; tail 17/19/19)** with
  **Soul 54–88, median ~70** — worn, not gutted (Soul gains halve above 70; hot arc
  days bill −4; promotions cost Soul 9; the heat taxes are priced in). Desk-camping and
  suck-up die of Soul; rebels lose to Standing; a permanent Intern can never bank the
  number. All sweep-gated. A live `?movie=1` career on the final build escaped Day 11
  ($3,485, Soul 75) with all three heat meters High — consequences active, still in-window.
- **THE POLICY** (Session 9's center): `policyAction`/`policyCardChoice`/
  `policyIncidentChoice` — ONE pure dev-marked policy in the brain, consumed by BOTH
  `?movie=1` and the headless soak (identity asserted by exact-equality sweeps). Cards are
  scored (s + 1.3·so, <35 guards), incidents get named cases. `?movie=greed` = burnout mode.
- **Arc selection**: each run draws **2–3 story arcs** (weighted, Brad 0.5) from
  {brad_second_job, boss_spiral, hr_survey, kayla_presentation, priya_credit}; undrawn arcs
  are fully dormant. Marcus (mentor) is always on. Lead stories across 50 competent seeds:
  kayla 18 / metadata 15 / brad 10 / marcus 4 / boss 2 / priya 1.
- **Story ladder**: `storyKey`/`storyLine` — Brad exposed > Kayla helped > Kayla ignored >
  HR metadata > Boss survived > Marcus saved > Priya backed > Dennis broken > warning
  defused > escaped clean > escaped dead inside. Share copy leads with the highest rung.
- **Persistence**: everything rides `g` (npcState, arcs, activeArcs, receipts, feed,
  incidents, dennisBlockerToday) through the existing localStorage save.

## CHARACTER LAW (non-negotiable)
- **Marcus is the SURVIVOR** — coasting master, funny, useful, never a fraud.
- **Brad owns the SCANDAL** — credit thief, second job, the firing you can watch.
- **Adam is the MEDDLER** (Session 9) — old school, self-important, bald with a shine,
  convinced the office would collapse without him. Fair game: his self-importance.
  Affectionate enough to be a character, not a strawman.
- **Tone**: punch the company, the incentives, the fake language, the systems. Never the
  person suffering (Kayla's arc is the reference treatment).

## The cast on the floor (9 actors)
You (badger), Brad, Dennis, The Boss, Meredith (HR), Kayla, Marcus, Priya, **Adam** —
Adam has his own bullpen desk (18,15), seeded moods/status in his voice, and the
**interception**: walk within 1.7 tiles of him idle and he sometimes (seeded, ≤2/day,
cooldown) holds you mid-stride 2.5 real seconds ("quick thought—"), ~15% usefully: a free
Dennis approval clear (he and Dennis go way back). His randomness rides a SIDE stream keyed
off (seed, day) so no pre-Adam staging ever shifted.

## The systems (what makes stories happen)
- **ARCS table + advanceArcs(g)** (brain, morning, local RNG off `g.runSeed`): five story
  arcs as data entries. `worldFlagsFor(g)` is the one brain→world bridge. Arc incidents ride
  the card event queue, gate 5 PM like cards, re-stage if unanswered, and get a substitute
  deliverer if their owner left the floor — a day can never strand.
- **Brad**: laptop → calls/stairs → deck detour → discovery card (screenshot/cover/ride) →
  seeded firing (0.4×2 mornings) you can WATCH, or the moment passes and you're holding a
  screenshot. Cover = raids off for the run.
- **Boss spiral**: hot 4–6 days (walks +1, crunch +0.25, daily summons answered on foot);
  sympathize = soft catches + daily tax; deflect/dodge = hard catches. One human beat.
- **HR survey**: bland/truth/help/metadata; metadata defuses exactly one warning.
- **Kayla's panic day**: sit with her (bonded: chats +2 forever) / take a task / watch it
  (Soul −3, "ignored" story) / tell HR (the webinar eats 9:00–10:30 next morning).
- **Priya's arc (Session 9)**: she builds it (pinned, feed), Brad (or the Boss) demos it,
  "the team" is thanked. Back publicly / DM / collect priya_commit_log (burns later on
  Credit Reassigned: +8/+6) / let it slide / bait the demo (seeded 50/50, high comedy).
- **Dennis the blocker (Session 9)**: ~1-in-4 days, ~30% of post-morning tasks NEED
  APPROVAL (red desk stack, HUD count, cannot ship). Clear via: the Pipe wait (visible 6s
  bar), flattery (Soul −2, once/day), burning a receipt (least-precious-first), or Marcus's
  held phrase. Ignoring = unfinished at 5 PM; never deadlocks.
- **Receipts**: screenshot_brad_deck, hr_survey_metadata, priya_commit_log — share copy,
  extra card choices, warning defusal, Dennis clears. Held vs lifetime counts on g.
- **Feed / headlines / awards / share**: brain-owned, deterministic, real events only.

## Files
- `ntos-game.js` (`?v=n20`) — the BRAIN: career rules, five arcs, incidents, receipts, feed,
  heat + chains, schemes, story ladder + STORY_META collection, specific-failure verdicts,
  dayHeadline/dayAward, **the policy** (dev-marked section at the bottom).
  Zero bare Math.random; local generators for anything that must not shift streams.
- `ntos-world.js` (`?v=w19`) — the OFFICE: 9 actors, flags-driven staging (clues, detours,
  firing escort, summons, kitchen, webinar, approvals, interception, lurk/telegraphs,
  Dennis carry, Adam concern walk, meeting-room demos), event queue with substitution,
  interception verbs (confront/flash/bait/walk-with/redirect/grenade/pre-demo/cool-HR),
  materials-based floor render. Never touches meters.
- `index.html` — the SHELL: canvas world, HUD (+blocked count, receipts, heat line),
  #office feed, card/incident overlay, popup context verbs (all of the above), day report
  (headline, award, heat, feed log), the story-collection overlay + unlock recording
  (the ONLY localStorage owner), movie autopilot consuming THE policy, save/resume, watchdog.
- `ntos-standalone.html` (372 KB) — rebuilt by `build_standalone.py` after ANY change.
- `game-test.js` (269) + `world-test.js` (151, ~5 min: acceptance sweeps + the five-policy
  matrix + tells/interceptions) — `osascript -l JavaScript <file>`. **The matrix is the
  definition of done**: movie≡competent, competent escapes most runs 10–16, desk/suck-up
  die of Soul, rebel loses to Standing, zero hangs.
- `TASKS.md` — previous session's brief (Session 10 ran from a chat brief; see SESSION_LOG).
  `assets/` — badger logo (inlined as data URI).

## Workflow rules
1. Rules/lore → brain; staging/movement/render → world; wiring → shell. Strictly.
2. World-first doctrine: if it could be a popup, make it a thing in the world.
3. New randomness = local generators keyed off the run seed (see Adam's side stream for the
   pattern that provably shifts nothing).
4. After edits: BOTH suites → rebuild standalone → preview. Bump `?v=` (n# / w#).
5. The soak/matrix is sacred. If a change breaks it, the change is wrong or the assertion
   update must be argued in the commit message.

## Known risks / next
1. Competent play runs Boss attention High most runs (perfect ship-days); at the desk
   the extra walk is mostly upside (+2 passes). Watch whether humans read "Boss High"
   as threat or trophy; tune the perfect-day source if it feels like a reward.
2. The flash and the poison file are strictly better than eating raids once you hold
   the pieces — if playtests say "no-brainer," give them a price.
3. Pre-planted demos auto-resolve (you chose in the empty room). Verify it reads as
   payoff, not railroad.
4. Promotion-margin tail (17/19/19 escape days) persists under Dennis+heat taxes;
   a promotion-variance system would smooth the review cliff.
5. Zero rebel survivors at this tuning; add a survival valve if that tail matters.
6. PIP arc is still the natural next ARCS entry (warnings → PIP → HR-pod summons; all
   machinery exists — and HR heat now feeds it naturally). Run meta later; the story
   collection is the hook it would hang from.
