# Nine to Survive — HANDOFF

Pick up here. This is the active game (MARQUE is retired/intact at `/Desktop/marque/` — reuse
its *patterns* only). Everything lives in `/Users/kevindriscoll/Desktop/nine to survive/`.
It RUNS and TESTS GREEN (**229 game + 128 world**, incl. a five-policy 50-seed sweep matrix
and a 100-career soak with every system active). Git repo, one commit per task, never pushed.
Read `SESSION_LOG.md` Sessions 5–9 — Session 9 opens with a git audit worth knowing about.

## Current quick facts (through Session 9, 2026-07-10, autonomous)
- **Balance**: your number is **$3,100**; a day = 2.5 real min; pay 260→1000 + $250 crunch
  bonus (Associate+). Competent play escapes **days 10–16 (48/50; two Dennis-taxed 19s)**
  with **Soul 58–89, median ~71** — worn, not gutted (Soul gains halve above 70; hot arc
  days bill −4; promotions cost Soul 9). Desk-camping and suck-up die of Soul; rebels lose
  to Standing; a permanent Intern can never bank the number. All sweep-gated.
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
- `ntos-game.js` (`?v=n19`) — the BRAIN: career rules, five arcs, incidents, receipts, feed,
  story ladder, dayHeadline/dayAward, **the policy** (dev-marked section at the bottom).
  Zero bare Math.random; local generators for anything that must not shift streams.
- `ntos-world.js` (`?v=w18`) — the OFFICE: 9 actors, flags-driven staging (clues, detours,
  firing escort, summons, kitchen, webinar, approvals, interception), event queue with
  substitution, materials-based floor render. Never touches meters.
- `index.html` — the SHELL: canvas world, HUD (+blocked count, receipts line), #office feed,
  card/incident overlay, popup context verbs (chat/sit-with/take-task/quick-call/report/
  Pipe/flatter/receipt/phrase), day report (headline, award, feed log), movie autopilot
  consuming THE policy, save/resume, watchdog.
- `ntos-standalone.html` (318 KB) — rebuilt by `build_standalone.py` after ANY change.
- `game-test.js` (229) + `world-test.js` (128, ~4 min: acceptance sweeps + the five-policy
  matrix + Adam) — `osascript -l JavaScript <file>`. **The matrix is the definition of
  done**: movie≡competent, competent escapes most runs 10–16, desk/suck-up die of Soul,
  rebel loses to Standing, zero hangs.
- `TASKS.md` — current session's brief. `assets/` — badger logo (inlined as data URI).

## Workflow rules
1. Rules/lore → brain; staging/movement/render → world; wiring → shell. Strictly.
2. World-first doctrine: if it could be a popup, make it a thing in the world.
3. New randomness = local generators keyed off the run seed (see Adam's side stream for the
   pattern that provably shifts nothing).
4. After edits: BOTH suites → rebuild standalone → preview. Bump `?v=` (n# / w#).
5. The soak/matrix is sacred. If a change breaks it, the change is wrong or the assertion
   update must be argued in the commit message.

## Known risks / next
1. Two promotion-margin seeds escape day 19 under Dennis's tax (gate covers it; a
   promotion-variance system would smooth the review-cliff).
2. Zero rebel survivors at this tuning; add a survival valve if that tail matters.
3. Adam's interception vs human patience — watch playtests (≤2/day + cooldown today).
4. Receipts can pile up unused (the policy hoards them deliberately); consider a valve.
5. PIP arc is still the natural next ARCS entry (warnings → PIP → HR-pod summons; all
   machinery exists). Meetings (webinar freeze is the prototype). Run meta later.
