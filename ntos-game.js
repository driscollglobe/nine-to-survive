/* ntos-game.js — Nine to Survive: Your Number · pure game brain (no DOM)
 *
 * The logic-and-data module, mirroring MARQUE's sim/world split: this file owns the
 * encounter content and the deterministic rules (meters, days, money, the ladder,
 * fail states, verdicts); the shell (index.html) owns presentation only and never
 * re-implements rules here. Deterministic given a seed (mulberry32 on g.rngState,
 * no bare Math.random) so game-test.js can assert entire careers headlessly.
 *
 * The run: survive workday after workday of encounter cards, get paid daily, get
 * promoted at Friday reviews, and bank FU_TARGET ("your number") to walk out — the
 * win. Standing 0 = managed out. Soul 0 = promoted to management. Both are endings.
 *
 * Loaded in the browser via <script src>; also eval-loaded headlessly by game-test.js.
 */
const NineToSurvive = (() => {
  // Starting state. Standing = how the org sees you; Soul = how much of you is left;
  // Money = the walk-out fund.
  const START = { standing: 50, soul: 65, money: 300 };

  // A fixed 9-to-5: twenty encounters in clock order. Each choice moves Standing (s) and
  // Soul (so); (o) is the outcome line. The third choice is usually the "keep both alive"
  // path — the game's whole thesis.
  const ENCOUNTERS = [
    {
      tag:"9:03 · Useless Meeting Survivor", clock:"9:03",
      title:"The Sync With No Agenda",
      scene:"A 30-minute “quick sync” lands on your calendar. Organizer: someone two levels up. Agenda: blank. Attendees: eleven. It starts in four minutes.",
      choices:[
        {t:"Join, camera on, nod thoughtfully for thirty minutes.", s:8, so:-6, o:"You said “great point, let’s align on that” twice. Nobody knows what was decided. But you looked engaged, and looking engaged is the job."},
        {t:"Decline: “Could this be an email?”", s:-10, so:12, o:"The organizer replies “let’s discuss live.” There is no live. You’ve made an enemy and, more importantly, a point."},
        {t:"Join muted, camera off, do actual work.", s:2, so:3, o:"You got a real hour of work done while appearing present. This is the closest thing to a win this building offers."}
      ]
    },
    {
      tag:"9:12 · Reply-All Apocalypse", clock:"9:12",
      title:"RE: RE: RE: Please Remove Me From This List",
      scene:"Someone in Facilities replied-all to 4,000 people about a missing yogurt. Forty people have now replied-all asking to be removed. The thread is growing. Your cursor hovers.",
      choices:[
        {t:"Reply-all with a joke. Someone has to.", s:6, so:-4, o:"Eleven laughing emojis, one from a VP. You're now “the funny one,” which is a job you'll hold forever, unpaid."},
        {t:"Email Facilities directly with instructions: reply, not reply-all.", s:-2, so:8, o:"They reply-all to thank you. The thread doubles. You did the right thing and the building ate it, which is the usual exchange rate."},
        {t:"Mute the thread. Watch the fire from a distance.", s:0, so:3, o:"The thread dies by 11. You lost nothing but your faith in group email, which was already gone."}
      ]
    },
    {
      tag:"9:41 · Office Bully Resistance", clock:"9:41",
      title:"Credit, Reassigned",
      scene:"In standup, Brad presents your analysis. Word for word. Your name never comes up. The boss says, “Great initiative, Brad.”",
      choices:[
        {t:"Let it go. Pick your battles.", s:0, so:-13, o:"You said nothing. Brad is now “the data guy.” You are now the person who lets Brad be the data guy. Both titles stick."},
        {t:"“Actually I built that — happy to walk everyone through it.”", s:6, so:11, o:"The room goes quiet in the good way. Brad suddenly needs to check his phone. Noted, respected, and very slightly feared."},
        {t:"DM the boss after: “FYI, that was my analysis.”", s:3, so:-2, o:"The boss replies “👍.” It’ll happen again. But the 👍 is, technically, a record. You’re building a folder."}
      ]
    },
    {
      tag:"9:55 · Calibration Season", clock:"9:55",
      title:"The Meeting About You, Without You",
      scene:"Performance calibration is at 10. Your name is on a slide you'll never see, discussed by people you've met twice. Meredith asks if you'd like to “submit context.”",
      choices:[
        {t:"Submit two pages of context. Bulleted. Cheerful.", s:7, so:-7, o:"Your context is now “input.” The slide doesn't change. Somewhere, a VP nods at a bar chart of your year."},
        {t:"“My work is my context.”", s:-6, so:10, o:"Meredith writes “declined to engage.” Dignity: kept. Narrative: someone else's now."},
        {t:"Three bullets and the folder link. Ten minutes, no more.", s:2, so:0, o:"Enough context to be defensible, little enough to keep your morning. The slide stays wrong, but wrong in a survivable way."}
      ]
    },
    {
      tag:"10:22 · The Ambush", clock:"10:22",
      title:"“You have a sec? Quick call.”",
      scene:"The boss Slacks: “you free? quick call.” No topic. No agenda. Your stomach does the thing it does.",
      choices:[
        {t:"“Sure! calling now 😊”", s:5, so:-5, o:"It was to ask if you’d seen the new coffee machine. You lost fourteen minutes and a small, non-refundable piece of yourself."},
        {t:"“Happy to — what’s it about so I can prep?”", s:-2, so:7, o:"“oh, nothing major.” It was nothing major. You’ve now trained the boss, faintly, that you require a topic. Small, real win."},
        {t:"Wait 20 min, then: “In a meeting — can I help async?”", s:-1, so:4, o:"Async worked fine. It always would have. The call was never necessary. The call is never necessary."}
      ]
    },
    {
      tag:"10:40 · Synergy Unlocked", clock:"10:40",
      title:"“Exciting Organizational Update”",
      scene:"An all-staff email announces a reorg “to unlock synergies.” Your team now reports through someone named Chad you've never heard of. The org chart looks like a subway map after an earthquake.",
      choices:[
        {t:"Email Chad immediately: “Excited to partner!”", s:8, so:-8, o:"Chad replies with a calendar link. You're now “aligned.” You mourn nothing publicly, which is noticed and approved of."},
        {t:"Say what everyone is thinking, in the team channel.", s:-8, so:11, o:"Four private “THANK YOU”s, zero public ones. The channel goes quiet. You said the true thing and now it's evidence."},
        {t:"Change nothing. Keep shipping. Let the chart settle.", s:1, so:2, o:"Three reorgs from now, none of this will have mattered. You knew that on day one. This is the knowledge that keeps you alive here."}
      ]
    },
    {
      tag:"11:15 · Mandatory Fun", clock:"11:15",
      title:"Virtual Team Trivia",
      scene:"HR has scheduled team-bonding trivia. Attendance is “optional (strongly encouraged).” Cameras are “expected.”",
      choices:[
        {t:"Show up, be peppy, win the trivia.", s:7, so:-8, o:"You’re now “so fun.” You will be invited to all of these forever. This is a trap wearing the costume of a compliment."},
        {t:"“Conflict, sorry!” Reclaim the hour.", s:-6, so:9, o:"There was no conflict. There is now an hour. HR logs you “low engagement.” You log yourself “a whole person.”"},
        {t:"Show up, answer one question, ghost at fifteen minutes.", s:1, so:0, o:"Minimum viable morale. Present enough to be seen, gone before your soul got billed. Textbook."}
      ]
    },
    {
      tag:"11:35 · Workflow Mapping", clock:"11:35",
      title:"Nate From McKinley Wants 30 Minutes",
      scene:"A consultant half your age is “mapping workflows.” He asks you to describe what you do, step by step, into a laptop that will decide whether what you do exists in Q3.",
      choices:[
        {t:"Perform enthusiasm. Inflate everything by 40%.", s:5, so:-9, o:"Nate types “high-value contributor.” You watched a spreadsheet decide to keep you alive and helped it feel good about it."},
        {t:"Answer honestly, including the part where half the job is meetings about the job.", s:-5, so:9, o:"Nate stops typing twice. Honesty in a workflow interview is like juggling on a tightrope: technically impressive, structurally unwise."},
        {t:"Describe outcomes, not hours. Make the value hard to delete.", s:3, so:1, o:"You gave the machine nothing to cut and nothing false to quote. Nate nods slowly. It's the best available outcome and you both know it."}
      ]
    },
    {
      tag:"12:05 · The Ritual", clock:"12:05",
      title:"Sign the Card for… Gerald?",
      scene:"A farewell card arrives for Gerald, 11 years in Logistics, whom you have never met. Fourteen people have written “good luck with everything!” There is a collection envelope. Kayla holds the pen.",
      choices:[
        {t:"Write something long and warm. Chip in $10.", s:3, so:-3, o:"Your fake warmth is indistinguishable from everyone else's fake warmth. That's what the card is for. Gerald will read none of it."},
        {t:"Pass it along unsigned.", s:-3, so:4, o:"Kayla raises an eyebrow. Somewhere, a norm was broken. Gerald, who does not know you exist, remains unaffected."},
        {t:"“Good luck, Gerald.” No money. Move on.", s:1, so:1, o:"Four words, zero dollars, full compliance with the ritual at minimum cost. The envelope stays mysterious. This is the way."}
      ]
    },
    {
      tag:"12:30 · I Don’t Give a Sheet", clock:"12:30",
      title:"“Let’s Take This Offline”",
      scene:"In a thread where you’re clearly right, someone senior writes: “Great points — let’s take this offline.” The offline will never happen. The record now ends with them sounding reasonable.",
      choices:[
        {t:"“Sounds good!”", s:3, so:-6, o:"It went offline. It died offline. Their version is the version now, and you helped bury the evidence."},
        {t:"“Sure — I’ll post a quick summary here first.” Then post it.", s:2, so:9, o:"The receipts are now in the channel, timestamped. “Offline” is where accountability goes to die, and you just kept it breathing."},
        {t:"Say nothing. Screenshot everything.", s:0, so:3, o:"You have a folder now. It’s a coping mechanism and an insurance policy. Mostly a coping mechanism."}
      ]
    },
    {
      tag:"1:15 · The Metaphor", clock:"1:15",
      title:"“We're a Family Here”",
      scene:"All-hands. The boss says the company is a family, twice, in front of a slide about “doing more with less.” The chat is a wall of clapping emojis. Someone you know was “transitioned out” Tuesday.",
      choices:[
        {t:"Add your clap emoji. Blend in.", s:4, so:-7, o:"Your clap joins two hundred others. Families don't have severance packages, but the metaphor sails on, and so do you."},
        {t:"Ask in the Q&A: “Do families do layoffs?”", s:-10, so:13, o:"The question gets 47 upvotes and is skipped. You are now “not a culture fit” in a document you'll never see. Worth it. Probably."},
        {t:"Cameras off. Emoji withheld. Attendance: technically.", s:-1, so:4, o:"You were present the way furniture is present. The metaphor didn't touch you. That's a win by local rules."}
      ]
    },
    {
      tag:"1:45 · The Invisible Labor", clock:"1:45",
      title:"“Can Someone Take Notes?”",
      scene:"The meeting opens. “Can someone grab notes?” Eleven people. Silence. Every head turns, subtly, toward you.",
      choices:[
        {t:"Take the notes. Again.", s:2, so:-9, o:"You’re the notes person now. Notes people get thanked. Notes people don’t get promoted. The difference is your career."},
        {t:"“I took them last time — maybe we rotate?”", s:-1, so:8, o:"The silence goes loud. Someone else gets volun-told. You’ve broken an ancient curse, and everyone in the room noticed."},
        {t:"“Happy to — I’ll share them so we’re all accountable.”", s:4, so:2, o:"You turned the invisible-labor trap into leverage. The notes are yours now, and so is the record of who promised what."}
      ]
    },
    {
      tag:"2:05 · Itemized Grief", clock:"2:05",
      title:"Expense Report: REJECTED",
      scene:"Your $61 client lunch came back rejected over a $4 side of fries “not itemized per policy.” Resubmission requires three fields, one approval, and a small piece of your remaining will. Dennis is cc'd, for reasons.",
      choices:[
        {t:"Resubmit with an apology note and a scan of the receipt.", s:3, so:-6, o:"Approved in 40 minutes, which proves the first rejection was a choice. The system works, in the sense that it happened to you."},
        {t:"Reply asking the policy to justify itself. Cc Finance leadership.", s:-4, so:8, o:"Finance responds with the policy PDF, highlighted. You've made an enemy who controls reimbursements. The fries were not worth a nemesis. Or maybe they were."},
        {t:"Eat the $4. Delete the thread.", s:0, so:2, o:"You paid four dollars to make a chore stop existing. Finance wins the battle, loses a data point. Cheapest peace you'll buy all week."}
      ]
    },
    {
      tag:"2:30 · Senior Job Hugger", clock:"2:30",
      title:"Dennis Has Questions",
      scene:"You need one approval to ship. It sits with Dennis. Dennis has kept this job nineteen years by never approving anything on the first ask. Dennis “has some questions.”",
      choices:[
        {t:"Answer all fourteen questions in a two-page reply.", s:2, so:-7, o:"Dennis now has six follow-up questions. Dennis is not a bottleneck. Dennis is the pipe."},
        {t:"Loop in Dennis’s boss: “Trying to unblock — can you help?”", s:5, so:3, o:"Dennis approves in nine minutes, wounded and vengeful. You shipped. Dennis will “have questions” about your next twelve things."},
        {t:"Wait him out. Resend the same request, cheerful, daily.", s:0, so:5, o:"Day three, Dennis breaks. Persistence beats a job-hugger, because he’s tired and you have a folder of cheerful timestamps."}
      ]
    },
    {
      tag:"2:50 · Open Plan", clock:"2:50",
      title:"The Loud Talker, Adjacent",
      scene:"The sales guy two desks over is on his fourth speakerphone call. He says “circle back” the way other people breathe. Priya's headphones are at max. Your progress bar is not moving.",
      choices:[
        {t:"Endure it. Smile when he high-fives the air.", s:3, so:-8, o:"He finishes with “boom, easy.” You've absorbed forty minutes of secondhand synergy. It's in your bones now."},
        {t:"Ask him, flatly, to take it in a booth.", s:-3, so:9, o:"He says “my bad, chief” and does it again after lunch. But for one shining hour: silence. Everyone within four desks owes you, quietly."},
        {t:"Headphones, white noise, one pointed look.", s:0, so:3, o:"The look lands. He drops six decibels, roughly one “circle back” worth. You'll take it."}
      ]
    },
    {
      tag:"3:15 · The Noun", clock:"3:15",
      title:"“Great for Your Visibility”",
      scene:"The boss: “Big client thing this weekend — would be huge for your visibility if you jumped in.” No extra pay. Just the noun.",
      choices:[
        {t:"“Absolutely, count me in!”", s:9, so:-13, o:"You traded a weekend for a noun. “Visibility” is what they offer when they’ve run out of money and shame. You’re now visible and tired."},
        {t:"“I’ve got plans — happy to help Monday.”", s:-8, so:13, o:"“No worries!” (worries.) You kept your weekend and your kid’s game. Somehow the client thing gets done without you. It always does."},
        {t:"“I can do two hours Saturday morning, then I’m out.”", s:2, so:-1, o:"Bounded it. Two hours, hard stop, stated up front. Not a martyr, not a no. The rarest move in the building: a limit."}
      ]
    },
    {
      tag:"3:40 · Personal Brand", clock:"3:40",
      title:"Brad Is “Humbled to Announce”",
      scene:"Brad's LinkedIn post about “grinding while others sleep” features a 5 AM gym selfie and the word “blessed.” It has 400 likes. Two are from your leadership team. He watches you read it.",
      choices:[
        {t:"Like it. Comment “🔥 inspiring!”", s:5, so:-8, o:"Brad nods at you across the bullpen like a general reviewing troops. Your comment is part of his personal brand now. So are you."},
        {t:"Scroll past. Liking nothing is a statement too.", s:-2, so:6, o:"Brad notices the silence — they always notice. Your feed stays clean. Your soul stays yours. His metrics dip by exactly one."},
        {t:"Like it without commenting. The minimum tribute.", s:2, so:-1, o:"One thumb, zero words. The algorithm is fed, the alliance maintained, the self only slightly discounted. Transactional and complete."}
      ]
    },
    {
      tag:"4:05 · The Self-Assessment", clock:"4:05",
      title:"Rate Your Own Performance",
      scene:"Annual review. Rate yourself 1–5 and “provide evidence.” Too high: arrogant. Too low: they’ll believe you.",
      choices:[
        {t:"A modest 3. Stay humble.", s:-4, so:-3, o:"You wrote “3 — met expectations.” They met your low expectations of yourself and adjusted the raise to match. Humility is a pay cut."},
        {t:"A 5, with every win and the receipts.", s:7, so:3, o:"You wrote it the way Brad would — except true. Turns out advocating for yourself is just Brad’s whole strategy, minus the lying."},
        {t:"A 4, and quietly cc the wins to your own inbox.", s:3, so:4, o:"Confident, not delusional, with a paper trail for the next place. This is the sweet spot and you know it."}
      ]
    },
    {
      tag:"4:30 · The Anonymous Survey", clock:"4:30",
      title:"“Share Feedback on Devon's Departure?”",
      scene:"Devon quit loudly on Tuesday. HR invites you to “share context” about why — a survey, anonymous, “we promise.” Question one asks how likely Devon's reasons are to also be your reasons, 1 through 5.",
      choices:[
        {t:"Everything is great! 5s across the board.", s:4, so:-9, o:"Your five stars join the wall of five stars behind which nothing changes. Devon's reasons remain everyone's reasons. Anonymously."},
        {t:"Answer honestly. All of it. Names, dates, the sync.", s:-7, so:10, o:"The survey is “anonymous” the way glass is “private.” Someone in People Ops now has a folder that matches your writing style. Devon would be proud."},
        {t:"Decline the survey. Text Devon congratulations instead.", s:0, so:5, o:"The only honest exit interview happens over text, to the person who left. “It's better out here,” Devon writes. You believe them."}
      ]
    },
    {
      tag:"4:57 · The Closer", clock:"4:57",
      title:"“Super Quick Thing Before You Go”",
      scene:"Bag on your shoulder. One foot out the door. Slack: “super quick thing — should take 5 min.” It is 4:57. It is never five minutes.",
      choices:[
        {t:"Drop the bag. “Sure, what’s up?”", s:6, so:-11, o:"Fifty minutes. It was fifty minutes. You got home late having learned only that “quick” is a lie with a calendar."},
        {t:"“Heading out — first thing tomorrow?”", s:-3, so:12, o:"“np!” It waited until tomorrow with zero consequences, proving it always could have. You kept the boundary and the evening."},
        {t:"“Drop it in a message and I’ll knock it out at 9.”", s:1, so:5, o:"You converted an ambush into a ticket — documented, scoped, and not eating your night. The 4:57 special, defused."}
      ]
    }
  ];

  const clamp = (v) => Math.max(0, Math.min(100, v));
  const fmt = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ---- The career ------------------------------------------------------------
  const LADDER = [
    { title:'Intern',    pay:260 },
    { title:'Associate', pay:420 },
    { title:'Senior',    pay:640 },
    { title:'Manager',   pay:820 },
    { title:'Director',  pay:1000 }
  ];
  // Your number. Sized so a permanent Intern can NEVER reach it: intern net income
  // peaks around $2,325 lifetime as burn creep overtakes pay — you must climb.
  // (Crunch spot bonuses are level-gated below, so they can't leak to Interns.)
  const FU_TARGET      = 3100;
  const DAY_ENCOUNTERS = 2;     // cards are spice now; the real-time office is the game
  const BURN_BASE      = 130;   // daily cost of living, week 1
  const BURN_STEP      = 25;    // lifestyle creep: burn rises this much per week
  const PROMOTE_AT     = 68;    // standing needed at the Friday review
  const PROMOTE_RESET  = 55;    // "the bar moves": standing after a promotion
  const PROMOTE_SOUL   = 5;     // what each rung costs you
  const WARN_AT        = 35;    // below this at review = formal warning
  const WARN_SOUL      = 4;     // the dread
  const BROKE_SOUL     = 6;     // overdraft anxiety when pay can't cover the burn

  const burnFor      = (week) => BURN_BASE + BURN_STEP * (week - 1);
  const soulDrainFor = (week) => week >= 5 ? 3 : week >= 3 ? 2 : 1; // the grind compounds

  // Deterministic PRNG (mulberry32 stepped on g.rngState). Same seed = same career.
  function rand(g){
    g.rngState = (g.rngState + 0x6D2B79F5) | 0;
    let t = Math.imul(g.rngState ^ (g.rngState >>> 15), 1 | g.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Clearly-scoped local generators for the arc engine: seeded off g.runSeed (and
  // never touching g.rngState), so adding or reordering arcs can never shift the
  // day-plan stream or any established balance numbers.
  function hashStr(s){
    let h = 2166136261 | 0;
    for(let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h | 0;
  }
  function localRand(seed){
    let s = seed | 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // one-shot arc roll, unique per (run, arc, day, purpose)
  function arcRand(g, key, salt){
    return localRand((g.runSeed ^ hashStr(key) ^ Math.imul(g.day, 2654435761) ^ hashStr(salt || '')) | 0);
  }

  // Brad's cards, by ENCOUNTERS index. Once he's fired (or being walked out
  // today), he stops delivering them — a dead man can't reassign your credit.
  const BRAD_ENCS = [2, 9, 16];
  function bradOutOfPlay(g){
    if(!g.npcState || !g.npcState.brad) return false;
    const a = (g.arcs && g.arcs.brad_second_job) || { stage: 0 };
    return !!g.npcState.brad.flags.fired || a.stage === 6 || a.stage === 7;
  }

  // Sample DAY_ENCOUNTERS distinct encounters for the day, replayed in clock order.
  // Prefers cards not yet seen this cycle (tracked on g.seen, so it serializes),
  // so a run tours the whole pool before anything repeats; then the cycle resets.
  // Seeded and deterministic: same seed = same tour. Consults the Brad arc:
  // with him out of play his cards leave the pool (identical rng stream otherwise).
  function planDay(g){
    if(!g.seen) g.seen = [];
    const pickFrom = (cands, n) => {
      const pool = cands.slice();
      for(let i = pool.length - 1; i > 0; i--){
        const j = Math.floor(rand(g) * (i + 1));
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      return pool.slice(0, n);
    };
    const barred = bradOutOfPlay(g) ? BRAD_ENCS : [];
    const inPool = [];
    for(let i = 0; i < ENCOUNTERS.length; i++) if(barred.indexOf(i) < 0) inPool.push(i);
    const fresh = inPool.filter(i => g.seen.indexOf(i) < 0);
    let plan;
    if(fresh.length >= DAY_ENCOUNTERS){
      plan = pickFrom(fresh, DAY_ENCOUNTERS);
      plan.forEach(i => g.seen.push(i));
      if(g.seen.length >= inPool.length) g.seen = [];      // toured the pool: reset
    } else {
      plan = fresh.slice();                                // odd remainder: finish the cycle...
      const rest = inPool.filter(i => plan.indexOf(i) < 0);
      plan = plan.concat(pickFrom(rest, DAY_ENCOUNTERS - plan.length));
      g.seen = plan.slice();                               // ...and start the next with today
    }
    return plan.sort((a, b) => a - b);
  }

  // The office lore layer: everyone you work with carries persistent state now.
  // stress/trust move with incidents; flags hold arc secrets; counters feed
  // headlines and share copy. All plain data — it rides the existing save.
  const NPC_IDS = ['brad', 'boss', 'meredith', 'dennis', 'kayla', 'marcus', 'priya'];
  function freshNpcState(){
    const st = {};
    NPC_IDS.forEach(id => { st[id] = { stress: 0, trust: 0, arcStage: 0, flags: {}, counters: {} }; });
    return st;
  }

  // Fresh career. Day 1, Intern, seeded plan for the first day.
  function newGame(seed){
    const g = {
      standing: START.standing, soul: START.soul, money: START.money,
      day: 1, week: 1, jobIdx: 0,
      idxInDay: 0, plan: null,
      failed: null, escaped: false, over: false,
      lastChoice: null, dayReport: null,
      stats: { bradSteals: 0, crunchWins: 0, crunchFails: 0, warnings: 0 },
      taskStreak: 0, deadEyedToday: 0,
      npcState: freshNpcState(),
      arcs: {},              // per-arc runtime state, keyed by ARCS name — pure data
      todayIncidents: [],    // [{id, owner, atMin}] the arcs staged for today
      receipts: { count: 0, flags: {} },
      feed: [],              // today's office feed: [{m: clockMin, text}]
      runSeed: (seed == null ? 1 : seed) | 0,
      rngState: (seed == null ? 1 : seed) | 0
    };
    g.plan = planDay(g);
    return g;
  }

  function currentEncounter(g){ return ENCOUNTERS[g.plan[g.idxInDay]]; }
  function isFinalEncounter(g){ return g.idxInDay >= g.plan.length - 1; }
  function jobTitle(g){ return LADDER[g.jobIdx].title; }

  // Apply a choice to the meters. Returns the deltas + outcome + any fail state so the
  // shell can render feedback without touching the rules. Does NOT advance the clock.
  function applyChoice(g, choiceIndex){
    const enc = currentEncounter(g);
    const c = enc.choices[choiceIndex];
    if(!c) return null;
    const before = { standing: g.standing, soul: g.soul };
    g.standing = clamp(g.standing + c.s);
    g.soul     = clamp(g.soul + c.so);
    // fail states: either meter bottoming out ends the day early
    if(g.standing <= 0){ g.failed = 'standing'; g.over = true; }
    else if(g.soul <= 0){ g.failed = 'soul'; g.over = true; }
    g.lastChoice = {
      choiceIndex,
      ds: g.standing - before.standing,
      dso: g.soul - before.soul,
      outcome: c.o
    };
    return g.lastChoice;
  }

  // A soul cost outside a choice (drain, promotion, warning, overdraft). Can end the run.
  function soulHit(g, n){
    g.soul = clamp(g.soul - n);
    if(g.soul <= 0 && !g.failed){ g.failed = 'soul'; g.over = true; }
  }

  // ---- The world's verbs: everything you DO on the floor lands here -----------
  // The office (ntos-world.js) signals these; the shell applies them. One table so
  // the whole real-time economy is visible, testable, and tunable in one place.
  const WORLD_EFFECTS = {
    taskDone:   { s:+2, so:-1 },   // shipped work: the org notices, the grind takes
    bossPass:   { s:+2, so: 0 },   // he walked by; you were at your desk
    bossCatch:  { s:-6, so:-1 },   // he walked by an empty chair
    bossCatchBad:{ s:-9, so:-2 },  // ...on one of his bad days
    bradSteal:  { s:-3, so:-2 },   // your work is his work now
    bradFoiled: { s:+1, so:+1 },   // he hovered; you were sitting right there
    chatGood:   { s: 0, so:+5 },   // five minutes of being human
    chatMeh:    { s: 0, so:+3 },
    chatBad:    { s: 0, so:+2 },   // you listened to them vent; still counts
    couch:      { s:-1, so:+6 },   // seen lounging; worth it
    coffee:     { s: 0, so:+2 },
    bossHuman:  { s: 0, so:+2 }    // he was, briefly, a person
  };
  // The Boss-spiral trap, priced: his confidant gets softer catches; the one
  // who deflected gets harder ones — for the arc's duration only (the arc
  // engine clears both flags when the spiral resolves).
  function bossCatchMod(g){
    const boss = g.npcState && g.npcState.boss;
    if(!boss) return 0;
    if(boss.flags.softCatch) return +2;
    if(boss.flags.hardCatch) return -2;
    return 0;
  }
  // Dead-eyed productivity: ship GRIND_STREAK tasks in a row with no recovery
  // (coffee / couch / chat) and every further consecutive task bills 1 extra Soul.
  const GRIND_STREAK = 3;
  const GRIND_SOUL   = 1;
  function applyWorldEffect(g, kind){
    const e = WORLD_EFFECTS[kind];
    if(!e) return null;
    if(kind === 'bradSteal' && g.stats) g.stats.bradSteals++;
    const b = { s: g.standing, so: g.soul };
    const sMod = (kind === 'bossCatch' || kind === 'bossCatchBad')
      ? bossCatchMod(g) + consumeCatchShield(g) : 0;
    g.standing = clamp(g.standing + (e.s || 0) + sMod);
    g.soul     = clamp(g.soul + (e.so || 0));
    let deadEyed = false;
    if(kind === 'taskDone'){
      g.taskStreak = (g.taskStreak || 0) + 1;
      if(g.taskStreak > GRIND_STREAK){
        g.soul = clamp(g.soul - GRIND_SOUL);
        g.deadEyedToday = (g.deadEyedToday || 0) + 1;
        deadEyed = true;
      }
    } else if(kind === 'couch' || kind === 'chatGood' || kind === 'chatMeh' || kind === 'chatBad' || kind === 'coffee'){
      g.taskStreak = 0;   // you looked up; the streak forgives
    }
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    else if(g.soul <= 0 && !g.failed){ g.failed = 'soul'; g.over = true; }
    return { kind, ds: g.standing - b.s, dso: g.soul - b.so, deadEyed };
  }

  // ---- The office feed (brain side): the brain owns what is feed-worthy --------
  // Entries are deterministic and come only from real events, moods, arc stages,
  // and incidents. The shell just renders g.feed; it invents nothing.
  function pushFeed(g, min, text){
    if(!g.feed) g.feed = [];
    g.feed.push({ m: min | 0, text });
  }

  // Morning gossip: only when a mood is actually notable — the feed reports the
  // office, it does not decorate it. Boss news is mechanical intel and always
  // leads; then at most two more lines, picked deterministically.
  const MOOD_FEED = {
    'boss|bad':      'The corner office calendar went private.',
    'meredith|good': 'Meredith renamed #layoff-rumors to #culture-questions.',
    'dennis|bad':    'Dennis changed the filename convention again.',
    'priya|bad':     'Priya has been in the kitchen for 11 minutes.',
    'priya|meh':     'Priya booked a focus block. Three people booked over it.',
    'kayla|good':    'Kayla has been smiling at her phone all morning. Nobody asks. Everybody knows.',
    'marcus|good':   'Marcus reacted with the eyes emoji to the all-hands invite.',
    'brad|good':     'Brad posted “thrilled to share” at 9:04 AM.'
  };
  function moodFeed(g, moods){
    if(g.feedMoodDay === g.day) return false;   // once per morning, resume-safe
    g.feedMoodDay = g.day;
    const cands = [];
    (moods || []).forEach(mm => {
      const id = mm.id === 'hr' ? 'meredith' : mm.id;   // world id → cast id
      const line = MOOD_FEED[id + '|' + mm.mood];
      if(line) cands.push({ id, line });
    });
    const bossLine = cands.find(c => c.id === 'boss');
    const rest = cands.filter(c => c.id !== 'boss');
    const r = arcRand(g, 'feed', 'morning');
    const picks = bossLine ? [bossLine] : [];
    while(rest.length && picks.length < (bossLine ? 3 : 2))
      picks.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
    picks.forEach((p, i) => pushFeed(g, 542 + i * 2, p.line));
    return true;
  }

  // Floor events worth gossiping about. The shell calls this next to
  // applyWorldEffect; the brain decides what's feed-worthy and how it reads.
  const EVENT_FEED = {
    bradSteal:    'Brad moved a file of yours into a folder called “Team Wins.”',
    bossCatchBad: 'Everyone heard it. Everyone kept typing.',
    crunch:       '“Quick fire drill, all hands on deck.” The deck is you.',
    couch:        'Someone updated the wellness dashboard. It counts.',
    summons:      '“got a sec” — the Boss, to you, with no agenda attached.'
  };
  function feedWorldEvent(g, kind, min){
    const line = EVENT_FEED[kind];
    if(!line) return false;
    pushFeed(g, min, line);
    return true;
  }

  // ---- Receipts: evidence is a resource ----------------------------------------
  // Named flags + counts on g (serializes with the save). `count` = held now,
  // `earned` = lifetime — awards and share copy read both.
  function addReceipt(g, name){
    if(!g.receipts) g.receipts = { count: 0, flags: {} };
    if(g.receipts.flags[name]) return false;
    g.receipts.flags[name] = true;
    g.receipts.count++;
    g.receipts.earned = (g.receipts.earned || 0) + 1;
    return true;
  }
  function hasReceipt(g, name){ return !!(g.receipts && g.receipts.flags[name]); }
  function burnReceipt(g, name){
    if(!hasReceipt(g, name)) return false;
    delete g.receipts.flags[name];
    g.receipts.count--;
    return true;
  }

  // ---- The arc engine: serialized office lore -----------------------------------
  // An arc is a named multi-day storyline with numbered stages. advanceArcs(g)
  // runs every morning inside nextDay and decides stage progression
  // deterministically from the run seed + npcState — via LOCAL generators only,
  // so adding, removing, or reordering arcs can never shift the day-plan stream
  // or any established balance numbers. Arcs write plain-data stage flags; the
  // world reads them (through worldFlagsFor) to stage physical clues, and
  // planDay consults them (a fired Brad stops delivering Brad cards).
  // A future arc = one more entry in this table plus its incident handlers.
  const ARCS = {

    // BRAD IS MOONLIGHTING. Ambitious, performative, insecure — and on two
    // payrolls. Stages: 0 dormant · 1 the second laptop appears · 2 “on a call”
    // + stairwell trips · 3 the deck detour past your desk · 4 the discovery
    // card · 5 exposed, waiting · 6 fired today (watch the floor) · 7 gone ·
    // 8 closed quietly (you covered, or the moment somehow passed).
    brad_second_job: {
      npc: 'brad',
      advance(g, a){
        const brad = g.npcState.brad;
        if(a.stage === 0){
          if(a.startDay == null)
            a.startDay = 2 + Math.floor(localRand((g.runSeed ^ hashStr('brad_start')) | 0)() * 3);
          if(g.day >= a.startDay){
            a.stage = 1; brad.stress = 1;
            pushFeed(g, 540, 'Brad deleted a message.');
          }
        } else if(a.stage === 1){
          a.stage = 2; brad.stress = 2;
          pushFeed(g, 555, 'Brad: “on a call.” It is 9:15.');
        } else if(a.stage === 2){
          a.stage = 3;
          a.deckAt = 610 + Math.floor(arcRand(g, 'brad', 'deck')() * 210);   // 10:10–1:40
        } else if(a.stage === 3 || a.stage === 4){
          // the morning after the slip — and every morning until it's answered:
          // the discovery card comes. It cannot strand a day; incidents gate
          // 5 PM exactly like cards do.
          a.stage = 4;
          g.todayIncidents.push({ id: 'brad_discovery', owner: 'brad',
            atMin: 620 + Math.floor(arcRand(g, 'brad', 'discovery')() * 250) });
        } else if(a.stage === 5){
          // exposed and unreported: some mornings, payroll does the math
          a.waited = (a.waited || 0) + 1;
          if(arcRand(g, 'brad', 'fired')() < 0.5){
            a.stage = 6; brad.stress = 3;
            pushFeed(g, 540, 'All-hands moved to 11:30. “Please plan to attend.” Nobody plans to attend. Everybody attends.');
          } else if(a.waited >= 3){
            a.stage = 8;
            pushFeed(g, 540, 'Brad archived a channel nobody knew existed. The moment passed. Somehow the moment passed.');
          }
        } else if(a.stage === 6){
          a.stage = 7;
          brad.flags.fired = true;    // idempotent with the world event's report
          pushFeed(g, 540, 'Brad’s desk is a rectangle of cleaner carpet. IT reclaimed “an asset.” The org chart heals over him by lunch.');
        }
      }
    },

    // THE BOSS IS GOING THROUGH SOMETHING. Week two or later his bad days get a
    // cause and a pattern. Stages: 0 dormant · 1 hot · 2 resolved. While hot the
    // world stages an extra floor walk, a raised crunch chance, and “quick call”
    // summons: sympathize and Standing climbs, his catches soften, and the
    // summons become daily; deflect (or dodge) and they stop, but his catches
    // hit harder for the arc's duration. More human. Not less dangerous.
    boss_spiral: {
      npc: 'boss',
      advance(g, a){
        const boss = g.npcState.boss;
        if(a.stage === 0){
          if(a.startDay == null){
            const r = localRand((g.runSeed ^ hashStr('boss_start')) | 0);
            a.startDay = 6 + Math.floor(r() * 4);        // week two: day 6–9
            a.hotDays  = 4 + Math.floor(r() * 3);        // hot for 4–6 days
          }
          a.summonsToday = null;
          if(g.day >= a.startDay){
            a.stage = 1; boss.stress = 2;
            pushFeed(g, 540, 'Boss is typing…');
            pushFeed(g, 541, 'Boss is typing…');
            pushFeed(g, 544, 'The corner office door is closed. It is never closed.');
            a.summonsToday = 620 + Math.floor(arcRand(g, 'boss', 'summons')() * 200);
          }
        } else if(a.stage === 1){
          a.summonsToday = null;
          if(g.day >= a.startDay + a.hotDays){
            a.stage = 2;
            delete boss.flags.softCatch;   // the modifiers live only while it's hot
            delete boss.flags.hardCatch;
            pushFeed(g, 540, 'The corner office door is open again. Nobody mentions the week. That is the arrangement.');
          } else if(boss.flags.sympathetic){
            // you are the office's emotional support animal now: daily summons
            a.summonsToday = 620 + Math.floor(arcRand(g, 'boss', 'summons')() * 200);
            pushFeed(g, 540, 'Boss is typing…');
          } else if(!boss.flags.deflected){
            // no answer yet: the quick call keeps being requested
            a.summonsToday = 620 + Math.floor(arcRand(g, 'boss', 'summons')() * 200);
          }
        }
      }
    },

    // KAYLA'S BIG PRESENTATION. She's overwhelmed, and the office is a machine
    // for making that worse. Staged spatially: she's in the kitchen, her status
    // shifts, the feed notices. The comedy target is the webinar, the invite,
    // and the system — never her. Stages: 0 dormant · 1 panic day ·
    // 2 aftermath (webinar day if HR was "helpful") · 3 filed.
    kayla_presentation: {
      npc: 'kayla',
      advance(g, a){
        const k = g.npcState.kayla;
        if(a.stage === 0){
          if(a.startDay == null)
            a.startDay = 5 + Math.floor(localRand((g.runSeed ^ hashStr('kayla_start')) | 0)() * 4);
          if(g.day >= a.startDay){
            a.stage = 1; k.counters.panicDay = g.day;
            pushFeed(g, 543, 'Kayla presents to leadership at 4:00. The deck is on version 31.');
            pushFeed(g, 570, 'Kayla is in the kitchen. She has been “getting water” for forty minutes.');
          }
        } else if(a.stage === 1){
          a.stage = 2;
          if(k.flags.toldHR){
            a.webinarDay = g.day;
            pushFeed(g, 540, 'Mandatory invite: “Resilience & You,” 90 minutes, camera expected. The system that caused the problem is hosting a seminar on surviving it.');
          } else if(k.flags.satWith || k.flags.tookTask){
            pushFeed(g, 545, 'Kayla’s presentation went fine. Leadership asked one question: “can we get this as an email?”');
          } else {
            pushFeed(g, 545, 'Kayla presented on three hours of sleep. Leadership praised the “hustle” and scheduled more of it.');
          }
        } else if(a.stage === 2){
          a.stage = 3;
        }
      }
    },

    // THE ANONYMOUS SURVEY IS NOT. Meredith launches a Pulse Survey; the next
    // day she starts identifying authors, for culture. Stages: 0 dormant ·
    // 1 survey day (the card comes) · 2 the hunt · 3 filed. The comedy target
    // is the survey, the font, and the metadata. Never the respondents.
    hr_survey: {
      npc: 'meredith',
      advance(g, a){
        const mer = g.npcState.meredith;
        if(a.stage === 0){
          if(a.startDay == null)
            a.startDay = 4 + Math.floor(localRand((g.runSeed ^ hashStr('survey_start')) | 0)() * 4);
          if(g.day >= a.startDay){
            a.stage = 1;
            pushFeed(g, 543, 'Meredith launched the Pulse Survey. “Anonymous,” it says, in a font that knows your name.');
            g.todayIncidents.push({ id: 'hr_survey', owner: 'hr',
              atMin: 640 + Math.floor(arcRand(g, 'hr', 'survey')() * 220) });
          }
        } else if(a.stage === 1){
          // unanswered somehow? it re-arrives, like all mandatory optional things
          if(!mer.counters.surveyDay){
            g.todayIncidents.push({ id: 'hr_survey', owner: 'hr',
              atMin: 640 + Math.floor(arcRand(g, 'hr', 'survey')() * 220) });
          } else {
            a.stage = 2;
            pushFeed(g, 548, 'Meredith is cross-referencing writing styles. For culture.');
            pushFeed(g, 560, 'Meredith asked IT for “aggregate metadata.” IT went quiet.');
          }
        } else if(a.stage === 2){
          a.stage = 3;
          pushFeed(g, 545, 'The Pulse Survey results are in: engagement is up. Nobody remembers agreeing to that.');
        }
      }
    },

    // MARCUS HAS SEEN EVERYTHING. The survivor: funny, useful, slightly
    // spiritually dead, never a fraud. Stages: 0 dormant · 1 mentor (permanent —
    // coasting does not resolve). Once live, chatting with him delivers a tip.
    marcus_survivor: {
      npc: 'marcus',
      advance(g, a){
        if(a.stage === 0){
          if(a.startDay == null)
            a.startDay = 3 + Math.floor(localRand((g.runSeed ^ hashStr('marcus_start')) | 0)() * 3);
          if(g.day >= a.startDay){
            a.stage = 1;
            pushFeed(g, 546, 'Marcus set his status to “surviving.” It has been his status since 2019.');
          }
        }
      }
    }
  };

  // Run every arc's stage logic. Called each morning from nextDay; fixed key
  // order + local generators = deterministic no matter how the floor was played.
  function advanceArcs(g){
    if(!g.arcs) g.arcs = {};
    Object.keys(ARCS).sort().forEach(key => {
      if(!g.arcs[key]) g.arcs[key] = { stage: 0 };
      ARCS[key].advance(g, g.arcs[key]);
      const npc = g.npcState[ARCS[key].npc];
      if(npc) npc.arcStage = g.arcs[key].stage;
    });
  }

  // ---- Arc incidents: story cards, fired by the world like any card ------------
  // Not deck expansion — these exist only when an arc stages them, and their
  // choices move npcState, receipts, and arc stages along with the meters.
  const ARC_INCIDENTS = {
    brad_discovery: {
      tag: 'Incident · The Second Laptop',
      title: 'Wrong Deck, Brad.',
      scene: 'Brad spins his chair to reach his coffee and his second laptop faces you, awake and honest, for four full seconds: a slide deck wearing another company’s logo. Header: “Q3 GTM — CONFIDENTIAL.” Their Q3. His name is on the title slide. He hasn’t noticed. You have unbroken line of sight and a phone.',
      choices: [
        { key:'screenshot', t:'Screenshot it. Both monitors. Timestamp visible.', s:0, so:+2,
          o:'Click. It lives in your camera roll now, between a parking receipt and a photo of a sandwich. You feel the specific warmth of holding something that outranks the org chart.' },
        { key:'cover', t:'“Brad. Screen.” Cover for him.', s:0, so:-6,
          o:'He slams the lid and looks at you the way drowning men look at driftwood. “You’re solid,” he whispers. Complicit. The word is complicit. Your inbox, at least, is now a protected wetland.' },
        { key:'ride', t:'See nothing. Sip your coffee. Let it ride.', s:0, so:+1,
          o:'You turn back to your monitor and let the universe keep its own books. Whatever happens to Brad now was always going to happen. You are merely no longer load-bearing.' }
      ]
    },
    hr_survey: {
      tag: 'Incident · The Pulse Survey',
      title: '“Anonymous. We Promise.”',
      scene: 'The survey has eleven questions, a progress bar, and a required login. Question one asks how likely you are to recommend this workplace, 1 through 5. Question eleven asks for “any other context,” in a free-text box exactly the size of a career. The URL contains your employee ID.',
      choices: [
        { key:'bland', t:'Fives across the board. “No notes!”', s:+1, so:-4,
          o:'Submitted in ninety seconds. Your five stars join the wall of five stars behind which nothing changes. Somewhere a dashboard turns a satisfying green, and a little more of you goes gray.' },
        { key:'truth', t:'Tell the truth. All of it. Names, dates, the sync.', s:0, so:+8,
          o:'You write it plainly and hit submit. It reads like testimony because it is. The survey is anonymous the way glass is private — expect your words to attend your next review without you.' },
        { key:'help', t:'First, help a coworker phrase theirs safely.', s:0, so:+3,
          o:'You translate their rage into “opportunities for process clarity.” It is a masterpiece of deniability. They owe you one, quietly, forever.' },
        { key:'metadata', t:'Open the page source. Read the URL. Screenshot the “anonymous” form’s user ID field.', s:0, so:+2,
          o:'response_id, employee_ref, session_token. You save it all. Anonymity has a schema, and now you have a copy. This will be useful the day a warning needs withdrawing.' }
      ]
    },
    boss_quick_call: {
      tag: 'Incident · The Quick Call',
      title: '“You free? Quick call.”',
      scene: 'The door closes. The Boss asks how you’re “finding the quarter,” then answers it himself for six minutes. On his monitor: an org chart with red outlines on some boxes. One of the red outlines is around his own box. He notices you noticing. “Realignment planning,” he says. “Anyway.”',
      choices: [
        { key:'sympathize', t:'“That sounds like a lot. How are YOU holding up?”', s:+3, so:-4,
          o:'He talks for nineteen minutes. You learn about the reorg, a nemesis in Finance, and a boat he did not buy. You are his person now. The rate is one quick call per day until whichever ends first: the spiral, or you.' },
        { key:'deflect', t:'“Happy to pick this up async — I’ve got a deliverable at two.”', s:-1, so:+2,
          o:'“Right. Of course. Deliverables.” The door opens with a punctuation you will hear again the next time he passes your empty chair. The summons stop. The ledger doesn’t.' }
      ]
    }
  };

  // Meter movement for anything that isn't a deck card: same clamps, same fail
  // states, one place.
  function applyStoryDelta(g, s, so){
    const b = { s: g.standing, so: g.soul };
    g.standing = clamp(g.standing + (s || 0));
    g.soul     = clamp(g.soul + (so || 0));
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    else if(g.soul <= 0 && !g.failed){ g.failed = 'soul'; g.over = true; }
    return { ds: g.standing - b.s, dso: g.soul - b.so };
  }

  // Resolve an arc incident choice: meters move, npcState/receipts/arc stages
  // follow. `min` is the world clock (for the feed's timestamps).
  function applyIncidentChoice(g, id, choiceIndex, min){
    const def = ARC_INCIDENTS[id];
    if(!def || !def.choices[choiceIndex]) return null;
    const c = def.choices[choiceIndex];
    const d = applyStoryDelta(g, c.s, c.so);
    const brad = g.npcState.brad;
    if(id === 'brad_discovery'){
      const a = g.arcs.brad_second_job;
      brad.counters.discoveries = (brad.counters.discoveries || 0) + 1;
      brad.counters.discoveryDay = g.day;
      if(c.key === 'screenshot'){
        addReceipt(g, 'screenshot_brad_deck');
        brad.stress = 3; a.stage = 5;
        pushFeed(g, min, 'Brad deleted a message.');
        pushFeed(g, (min || 0) + 2, 'Brad deleted another message.');
      } else if(c.key === 'cover'){
        brad.trust += 3; brad.flags.covered = true; a.stage = 8;
        pushFeed(g, min, 'Brad sent you a gif of a saluting otter, in a channel with two members. This is a binding contract now.');
      } else {
        a.stage = 5;
        pushFeed(g, min, 'Brad turned his desk eleven degrees away from the aisle. Feng shui, he said.');
      }
    }
    if(id === 'hr_survey'){
      const mer = g.npcState.meredith;
      mer.counters.surveyDay = g.day;
      if(c.key === 'truth'){
        mer.flags.truthTold = true;
        pushFeed(g, min, 'Someone submitted seven paragraphs. Meredith has opened a thesaurus.');
      } else if(c.key === 'help'){
        const peers = ['kayla', 'priya', 'marcus'];
        const who = peers[Math.floor(arcRand(g, 'hr', 'peer')() * peers.length)];
        g.npcState[who].trust += 2;
        mer.counters.helped = who;
        pushFeed(g, min, who.charAt(0).toUpperCase() + who.slice(1) + '’s survey response is a masterpiece of deniability. You are thanked in the metadata.');
      } else if(c.key === 'metadata'){
        addReceipt(g, 'hr_survey_metadata');
        pushFeed(g, min, 'Someone viewed the survey’s page source for eleven minutes. Anonymously, of course.');
      } else {
        pushFeed(g, min, 'Early Pulse results: morale is “strong.” The word is doing a lot of shifts.');
      }
    }
    if(id === 'boss_quick_call'){
      const boss = g.npcState.boss;
      boss.counters.quickCalls = (boss.counters.quickCalls || 0) + 1;
      boss.counters.callDay = g.day;
      if(c.key === 'sympathize'){
        boss.trust += 1;
        boss.flags.sympathetic = true; boss.flags.softCatch = true;
        delete boss.flags.deflected; delete boss.flags.hardCatch;
        pushFeed(g, min, 'The corner office door was closed for nineteen minutes. You were on the wrong side of it. Or the right side. Unclear.');
      } else {
        boss.flags.deflected = true; boss.flags.hardCatch = true;
        delete boss.flags.sympathetic; delete boss.flags.softCatch;
        pushFeed(g, min, 'The quick call was quick. The silence after it wasn’t.');
      }
    }
    g.lastChoice = { choiceIndex, ds: d.ds, dso: d.dso, outcome: c.o };
    return g.lastChoice;
  }

  // ---- Marcus's coasting tips: delivered through chats once his arc is live -----
  // Some help mechanically; roughly one in four miscalibrates, because detachment
  // is a skill with error bars. Seeded per (run, day); once per day via the
  // existing one-chat-per-peer rule.
  const MARCUS_TIPS = [
    { kind:'bosswalk', text:'Marcus, without looking up: “He does his second lap after lunch. Be a chair.”',
      feed:'Marcus has seen this exact all-hands before, including the typo.' },
    { kind:'delay', text:'“That one in your stack? Nobody reads it before Thursday. Let it breathe.” One missed task forgiven at 5 PM.',
      feed:'Marcus says the reorg will be reversed by October.' },
    { kind:'shield', text:'“When he asks where you were, say ‘load-bearing deliverable.’ Works exactly once.” Next catch softened.',
      feed:'Marcus declined a meeting so calmly it became philosophical.' },
    { kind:'miscal', text:'“The 2:30 is skippable. Trust me.” It was not skippable. Standing −2.',
      feed:'Marcus said “this too shall pass.” It has not passed.' }
  ];
  function marcusTip(g, min){
    const m = g.npcState.marcus;
    if(((g.arcs || {}).marcus_survivor || { stage: 0 }).stage < 1) return null;
    if(m.counters.tipDay === g.day) return null;
    m.counters.tipDay = g.day;
    m.counters.tips = (m.counters.tips || 0) + 1;
    const r = arcRand(g, 'marcus', 'tip');
    const tip = r() < 0.25 ? MARCUS_TIPS[3] : MARCUS_TIPS[Math.floor(r() * 3)];
    if(tip.kind === 'delay') g.taskForgivenessToday = true;
    else if(tip.kind === 'shield') m.flags.shield = true;
    else if(tip.kind === 'miscal'){ applyStoryDelta(g, -2, 0); m.counters.miscals = (m.counters.miscals || 0) + 1; }
    pushFeed(g, min, tip.feed);
    return { kind: tip.kind, text: tip.text };
  }
  // Marcus's phrase deflects exactly one catch (consumed on use).
  function consumeCatchShield(g){
    const m = g.npcState && g.npcState.marcus;
    if(!m || !m.flags.shield) return 0;
    delete m.flags.shield;
    return +2;
  }

  // ---- Kayla's panic day: the player's options, priced -----------------------------
  function kaylaSitWith(g, min){
    const k = g.npcState.kayla;
    if(k.flags.satWith) return null;
    k.flags.satWith = true; k.flags.bonded = true; k.trust += 2;
    const d = applyStoryDelta(g, 0, +4);
    pushFeed(g, min, 'Two chairs in the kitchen. No agenda. It helped more than the deck did.');
    return { dso: d.dso, text: 'You sit with her. No advice, no pep talk, just company and a shared opinion about slide 14. The clock keeps billing you. Worth it.' };
  }
  function kaylaTaskTaken(g, min){
    const k = g.npcState.kayla;
    if(k.flags.tookTask) return null;
    k.flags.tookTask = true; k.trust += 1;
    const d = applyStoryDelta(g, 0, +1);
    pushFeed(g, min, 'A deliverable quietly changed owners. No email announced it. That is how you know it was kind.');
    return { dso: d.dso, text: 'You take the competitor summary off her stack and onto yours. Her deck loses a subplot; your inbox gains one.' };
  }
  function kaylaSentHome(g, min){
    const k = g.npcState.kayla;
    if(k.flags.toldHR) return null;
    k.flags.toldHR = true; k.trust -= 2;
    const d = applyStoryDelta(g, +1, 0);   // the org rewards "flagging a risk"
    pushFeed(g, min, 'Meredith walked to the kitchen with her Concerned Face. Kayla is being sent home “out of an abundance of care.”');
    pushFeed(g, (min || 0) + 4, 'The presentation was moved, not cancelled. The problem was moved, not solved.');
    return { ds: d.ds, text: 'You mention it to Meredith, gently, meaning well. HR solves the person instead of the workload. Kayla is sent home. A calendar invite is already forming somewhere, like weather.' };
  }
  // The dead-eyed play: you watched and kept shipping. Priced at day end.
  const WATCHED_SOUL = 3;
  function kaylaWatchedPrice(g, report){
    const a = (g.arcs || {}).kayla_presentation;
    const k = g.npcState && g.npcState.kayla;
    if(!a || a.stage !== 1 || !k) return;
    if(k.flags.satWith || k.flags.tookTask || k.flags.toldHR) return;
    soulHit(g, WATCHED_SOUL);
    report.watchedKayla = true;
    pushFeed(g, 1018, 'Productivity held steady today. The dashboard is very proud of everyone.');
  }
  // Sitting with her that day permanently improves what her chats give back.
  function chatBonus(g, who){
    if(who === 'kayla' && g.npcState.kayla.flags.bonded){
      const d = applyStoryDelta(g, 0, +2);
      return d.dso;
    }
    return 0;
  }

  // Never found time for the quick call: the office reads that as an answer.
  function bossSummonsDodged(g, min){
    const boss = g.npcState.boss;
    if(boss.flags.deflected || boss.flags.sympathetic) return false;
    boss.flags.deflected = true; boss.flags.hardCatch = true;
    pushFeed(g, min, '“got a sec” expired unanswered. It has been noted somewhere with columns.');
    return true;
  }

  // The one genuinely human beat, off-schedule, once per run. World moment, not
  // a card: the world spots the proximity, the brain owns the words and the gate.
  function bossHumanBeat(g, min){
    const boss = g.npcState.boss;
    if(boss.flags.humanBeat) return null;
    boss.flags.humanBeat = true;
    pushFeed(g, min, 'The Boss stood at the window for four minutes. The window does not have KPIs.');
    return 'You catch the Boss rehearsing “streamlining is a kindness” at the window. He nods. Human, briefly.';
  }

  // The receipt play: holding the screenshot gives Brad's Credit-Reassigned card
  // a fourth choice that burns it to reverse the theft, with interest.
  const CREDIT_ENC = 2;
  function extraChoicesFor(g, encIdx){
    if(encIdx === CREDIT_ENC && hasReceipt(g, 'screenshot_brad_deck') && !bradOutOfPlay(g)){
      return [{ key: 'burn_screenshot',
        t: '“Quick question before we move on — Brad, how’s Q3 tracking at the other place?” Screen-share the screenshot.' }];
    }
    return [];
  }
  function applyExtraChoice(g, encIdx, key, min){
    if(key !== 'burn_screenshot' || encIdx !== CREDIT_ENC) return null;
    if(!burnReceipt(g, 'screenshot_brad_deck')) return null;
    const d = applyStoryDelta(g, +10, +8);   // the theft, reversed, with interest
    const brad = g.npcState.brad;
    brad.trust -= 3; brad.stress = 3; brad.flags.burned = true;
    const a = g.arcs.brad_second_job;
    if(a && a.stage === 8 && !brad.flags.covered){ a.stage = 5; a.waited = 0; }  // the moment un-passes
    pushFeed(g, min, 'The projector saw everything. So did Meredith.');
    g.lastChoice = { choiceIndex: 'burn_screenshot', ds: d.ds, dso: d.dso,
      outcome: 'You put his other logo on the big screen, right next to your analysis. The room does the math at different speeds; the boss gets there last, then all at once. Your work is yours again, retroactively, with interest. Brad’s calendar goes “busy” for the rest of the afternoon.' };
    return g.lastChoice;
  }

  // ---- Brad-arc world moments: the world stages them, the brain records them ----
  function bradDeckSeen(g, min){
    const brad = g.npcState.brad;
    if(brad.flags.deckSeen) return false;
    brad.flags.deckSeen = true;
    pushFeed(g, min, 'Brad walked the long way past your desk carrying slides for a company that is not this company. Slide 4 said “Our Q3.” Not our our.');
    return true;
  }
  function bradAllHands(g, min){
    pushFeed(g, min, 'Brad joined the all-hands from a conference room with another company’s name in the Zoom background. Legal joined the thread. Everyone became normal.');
  }
  function bradFiredReport(g, min){
    const brad = g.npcState.brad;
    brad.flags.fired = true; brad.flags.walkedOut = true;
    brad.counters.firedDay = g.day;
    if(g.arcs.brad_second_job && g.arcs.brad_second_job.stage === 6) g.arcs.brad_second_job.stage = 7;
    pushFeed(g, min, 'Meredith walked Brad to the door holding a box he was not allowed to carry himself. “We wish him well,” she said, in the past tense, while he was still in the room.');
  }
  function bradTasksAbsorbed(g, min){
    pushFeed(g, min, 'Two of Brad’s deliverables just landed in your inbox. The email says “congratulations on the growth opportunity.” It is not a growth opportunity.');
  }

  // Everything the world needs to stage today, as plain data. The world module
  // never reads g directly — this is the one bridge, and it's one-way.
  function worldFlagsFor(g){
    const A  = g.arcs || {};
    const b  = A.brad_second_job || { stage: 0 };
    const bo = A.boss_spiral || { stage: 0 };
    const ka = A.kayla_presentation || { stage: 0 };
    const brad = (g.npcState && g.npcState.brad) || { flags: {} };
    const kayla = (g.npcState && g.npcState.kayla) || { flags: {} };
    return {
      kaylaPanic:     ka.stage === 1 && !kayla.flags.toldHR,
      webinarUntil:   (ka.stage === 2 && ka.webinarDay === g.day) ? 630 : null,
      bradLaptop:     b.stage >= 1 && b.stage <= 6,   // the second laptop, drawn
      bradCalls:      b.stage >= 2 && b.stage <= 6,   // status shifts + stairwell trips
      bradDeckAt:     b.stage === 3 ? b.deckAt : null,
      bradFiredToday: b.stage === 6,
      bradGone:       b.stage === 7,     // stage 8 = closed quietly; he's still here
      noBradRaids:    !!brad.flags.covered || b.stage === 6 || b.stage === 7,
      bossArcHot:     bo.stage === 1,
      extraBossWalks: bo.stage === 1 ? 1 : 0,
      crunchBoost:    bo.stage === 1 ? 0.25 : 0,
      bossSummonsAt:  (bo.stage === 1 && bo.summonsToday) || null,
      incidents:      (g.todayIncidents || []).slice()
    };
  }

  // Advance past a resolved card. Cards no longer end the day — 5 PM does.
  // Returns 'gameover' | 'ok'.
  const DECAY_S     = 6;   // "what have you done for them lately" — daily standing decay
  const TASK_MISS_S = 1;   // per task left in the inbox at 5 PM
  function advance(g){
    if(g.failed){ g.over = true; return 'gameover'; }
    g.idxInDay++;
    return 'ok';
  }

  // Close out the day at 5 PM: unfinished work + decay, payday, cost of living,
  // the grind, and (Fridays) the review. stats come from the world's day.
  // Returns 'gameover' | 'dayend'; builds g.dayReport for the 5:01 screen.
  function closeDay(g, stats){
    stats = stats || { tasksDone: 0, tasksTotal: 0 };
    if(g.failed){ g.over = true; return 'gameover'; }
    const pay = LADDER[g.jobIdx].pay;
    const burn = burnFor(g.week);
    const drain = soulDrainFor(g.week);
    let missed = Math.max(0, stats.tasksTotal - stats.tasksDone);
    let forgiven = false;
    if(g.taskForgivenessToday && missed > 0){ missed--; forgiven = true; }   // Marcus was right
    const report = { day: g.day, week: g.week, title: jobTitle(g), pay, burn, drain,
                     tasksDone: stats.tasksDone, tasksTotal: stats.tasksTotal,
                     missed, forgiven, decay: DECAY_S,
                     deadEyed: g.deadEyedToday || 0,
                     broke: false, promoted: false, warned: false, newTitle: null };
    // the treadmill: yesterday's hero + whatever died in the inbox
    g.standing = clamp(g.standing - DECAY_S - missed * TASK_MISS_S);
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    g.money += pay - burn;
    if(g.money < 0){ g.money = 0; report.broke = true; if(!g.failed) soulHit(g, BROKE_SOUL); }
    if(!g.failed) soulHit(g, drain);
    if(!g.failed) kaylaWatchedPrice(g, report);
    if(!g.failed && g.day % 5 === 0){ // Friday review
      // the "anonymous" survey attends your review without you — once
      const mer = g.npcState && g.npcState.meredith;
      if(mer && mer.flags.truthTold && !mer.flags.truthBilled){
        mer.flags.truthBilled = true;
        g.standing = clamp(g.standing - 5);
        report.truthBill = true;
        pushFeed(g, 1019, 'Your survey answers attended your review. Anonymously.');
        if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
      }
      if(g.failed){ /* the bill can end it */ }
      else if(g.standing >= PROMOTE_AT && g.jobIdx < LADDER.length - 1){
        g.jobIdx++; g.standing = PROMOTE_RESET; soulHit(g, PROMOTE_SOUL);
        report.promoted = true; report.newTitle = jobTitle(g);
        pushFeed(g, 1020, 'A promotion was announced. The word “journey” was used twice.');
      } else if(g.standing < WARN_AT){
        if(hasReceipt(g, 'hr_survey_metadata')){
          // the receipt defuses exactly one warning, then it's spent
          burnReceipt(g, 'hr_survey_metadata');
          report.warningDefused = true;
          pushFeed(g, 1020, 'The warning was withdrawn after you asked, politely, about survey response IDs.');
        } else {
          soulHit(g, WARN_SOUL); report.warned = true;
          if(g.stats) g.stats.warnings++;
          pushFeed(g, 1020, 'Meredith created a document. The filename contains your name and the word “alignment.”');
        }
      }
    }
    report.money = g.money;
    g.dayReport = report;
    return g.failed ? 'gameover' : 'dayend';
  }

  // ---- The day's headline + award: drawn from what actually happened -----------
  // Deterministic, first-match priority, no invented events. The fallbacks are
  // the only lines allowed to admit nothing happened.
  function dayHeadline(g){
    const rep = g.dayReport || {};
    const d = 'Day ' + (rep.day || g.day) + ': ';
    const brad = g.npcState.brad, boss = g.npcState.boss;
    if(brad.counters.firedDay === rep.day)
      return d + 'Brad was walked out holding a box he was not allowed to carry.';
    if(brad.counters.discoveryDay === rep.day)
      return d + 'a laptop faced the wrong direction for four full seconds.';
    if(boss.counters.callDay === rep.day && boss.flags.sympathetic)
      return d + 'you became the corner office’s emotional support animal.';
    if(boss.counters.callDay === rep.day)
      return d + 'a quick call was survived at async speed.';
    if(g.npcState.meredith.counters.surveyDay === rep.day)
      return d + 'HR discovered anonymity has a font.';
    if(g.npcState.kayla.counters.panicDay === rep.day && g.npcState.kayla.flags.toldHR)
      return d + 'HR solved a person instead of a workload.';
    if(g.npcState.kayla.counters.panicDay === rep.day && g.npcState.kayla.flags.satWith)
      return d + 'two chairs in the kitchen. It helped.';
    if(((g.arcs || {}).kayla_presentation || {}).webinarDay === rep.day)
      return d + '“Resilience & You” ate ninety minutes of resilience.';
    if(rep.warningDefused) return d + 'a warning met a metadata screenshot and blinked first.';
    if(rep.promoted) return d + 'promoted. The bar moved. It saw you coming.';
    if(rep.warned) return d + 'HR opened a document with your name in the filename.';
    if(rep.deadEyed >= 2) return d + 'three tasks in a row without blinking. HR calls it “flow.”';
    if(rep.forgiven) return d + 'Marcus was right about Thursday.';
    if(rep.broke) return d + 'the ATM asked if you were sure.';
    return d + 'survived.';
  }
  function dayAward(g){
    const rep = g.dayReport || {};
    const brad = g.npcState.brad, boss = g.npcState.boss;
    if(brad.counters.firedDay === rep.day || brad.counters.discoveryDay === rep.day)
      return 'Main Character of the Day';
    if(g.receipts && g.receipts.count > 0) return 'Least Legally Defensible';
    if(rep.deadEyed >= 1) return 'Most Dead Inside';
    if(boss.counters.callDay === rep.day && boss.flags.sympathetic)
      return 'Office Emotional Support Animal';
    if(rep.tasksTotal > 0 && rep.tasksDone >= rep.tasksTotal) return 'Best Supporting Spreadsheet';
    return 'Employee of the Month (Not This Month)';
  }

  // The morning after a survived day: new date, fresh plan, the night forgives.
  // Arcs advance FIRST — a fired Brad changes what planDay may pick — and they
  // use local generators, so the g.rngState stream planDay consumes is untouched.
  function nextDay(g){
    g.day++; g.week = Math.floor((g.day - 1) / 5) + 1;
    g.idxInDay = 0; g.dayReport = null;
    g.taskStreak = 0; g.deadEyedToday = 0;
    g.taskForgivenessToday = false;
    g.feed = []; g.todayIncidents = [];
    advanceArcs(g);
    g.plan = planDay(g);
  }

  // Fire drill (a crunch, not a fire): deliver under a timer or eat a Standing hit.
  // Winning one pays a spot bonus — but only from Associate up. Interns are paid
  // in experience, which keeps the permanent-Intern money cap intact.
  const CRUNCH_WIN = 4, CRUNCH_LOSE = 10, CRUNCH_BONUS = 250;
  function applyCrunch(g, success){
    if(g.stats){ if(success) g.stats.crunchWins++; else g.stats.crunchFails++; }
    const before = g.standing;
    g.standing = clamp(g.standing + (success ? CRUNCH_WIN : -CRUNCH_LOSE));
    let bonus = 0;
    if(success && g.jobIdx > 0){ bonus = CRUNCH_BONUS; g.money += bonus; }
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    return { ds: g.standing - before, success, bonus };
  }

  // The coffee machine: one small mercy per day.
  const COFFEE_SOUL = 2;
  function applyCoffee(g){
    if(g.coffeeDay === g.day) return null;
    g.coffeeDay = g.day;
    g.taskStreak = 0;   // a mercy counts as looking up
    const before = g.soul;
    g.soul = clamp(g.soul + COFFEE_SOUL);
    return { dso: g.soul - before };
  }

  // The win condition: your number, banked. Walking out ends the run as an escape.
  function canWalkOut(g){ return !g.over && g.money >= FU_TARGET; }
  function walkOut(g){
    if(!canWalkOut(g)) return false;
    g.escaped = true; g.over = true; return true;
  }

  // The ending. Driven by how the run actually ended: escape, fired, or hollowed out.
  function verdict(g){
    const days = g.day, bank = fmt(g.money);
    if(g.escaped && g.soul >= 50) return {
      tag:'Day '+days+' · You quit', tone:'ok', title:'F-You Money. Out the Door. Whole.',
      body:'You hit your number with your soul still breathing, set the badge on the desk, and walked. '+bank+' banked in '+days+' days, zero regrets. The sync will be held without you, forever. This is the win.'
    };
    if(g.escaped) return {
      tag:'Day '+days+' · You quit', tone:'soul', title:'Out. Technically.',
      body:'You hit your number and escaped — but the building kept a piece of you at every rung. '+bank+' in '+days+' days, paid at full retail. Spend some of it remembering who you were.'
    };
    if(g.failed === 'standing') return {
      tag:'Day '+days+' · Terminated', tone:'danger', title:'Managed Out',
      body:'Security walked you to your car with '+bank+' saved — not your number, but yours. You kept your dignity; the org kept the ficus. On the bright side: you never have to attend the sync again.'
    };
    if(g.failed === 'soul') return {
      tag:'Day '+days+' · Congratulations (?)', tone:'danger', title:'Promoted to Middle Management',
      body:'You schedule the syncs now. You send the 4:57 asks. You say “let’s take this offline.” The '+bank+' you saved will buy things the new you enjoys. This is the real game over.'
    };
    return {
      tag:'Day '+days, tone:'muted', title:'Still There.',
      body:'The day ended. Another one is coming. '+bank+' banked against a number of '+fmt(FU_TARGET)+'. Keep going.'
    };
  }

  // ═══ THE COMPETENT POLICY (dev/bot section — pure functions, no DOM) ═══════════
  // One deterministic policy consumed by BOTH ?movie=1 and the headless soak bot,
  // so what the autopilot demonstrates is exactly what the test suite proves.
  // It reads g plus a plain world snapshot (w) and returns the next action:
  // {type:'idle'|'walkout'|'coffee'|'couch'|'chat'(id)|'bosscall'|'home'}.

  // Cards are scored, not memorized: standing + 1.3×soul, with a penalty for
  // choices that would drop Standing under 35 and a heavy one for Soul under 35.
  function policyCardChoice(g, encIdx){
    const enc = ENCOUNTERS[encIdx];
    if(!enc) return 0;
    let best = 0, bestScore = -Infinity;
    enc.choices.forEach((c, i) => {
      let score = c.s + 1.3 * c.so;
      if(g.standing + c.s < 35) score -= 8;
      if(g.soul + c.so < 35) score -= 20;
      if(score > bestScore){ bestScore = score; best = i; }
    });
    return best;
  }

  // Incidents get named deterministic cases, not scores.
  function policyIncidentChoice(g, id){
    if(id === 'brad_discovery') return g.soul < 25 ? 2 : 0;   // screenshot, unless drowning
    if(id === 'hr_survey') return hasReceipt(g, 'hr_survey_metadata') ? 2 : 3;  // metadata, else help
    if(id === 'boss_quick_call') return g.soul >= 65 ? 0 : 1; // sympathy only from comfort
    return 0;
  }

  function policyAction(g, w){
    if(g.over || !w || !w.running) return { type: 'idle' };
    // the number is the point: leave the moment you can
    if(canWalkOut(g)){
      if(w.playerErrand && w.playerErrand.type === 'exit') return { type: 'idle' };
      return { type: 'walkout' };
    }
    if(w.playerErrand) return { type: 'idle' };              // never interrupt an errand
    const you = (w.actors || []).find(a => a.id === 'you');
    if(!you || you.path.length) return { type: 'idle' };     // mid-walk: let it finish
    // a summons is answered with your feet; the card decides the tone
    if(w.summons && w.summons.status === 'open') return { type: 'bosscall' };
    // Kayla's panic day is never ignored by default
    const kayla = g.npcState && g.npcState.kayla;
    if(w.flags && w.flags.kaylaPanic && kayla
       && !kayla.flags.satWith && !kayla.flags.tookTask && !w.chatted.kayla)
      return { type: 'chat', id: 'kayla' };
    // recover before the grind bills extra — and always when Soul is collapsing
    const needRecovery = g.soul < 35 || (g.taskStreak >= GRIND_STREAK && w.tasks.pending > 0);
    if(needRecovery){
      if(!w.coffeeUsed) return { type: 'coffee' };
      if(!w.couchUsed) return { type: 'couch' };
      let pick = null, bestS = -1;
      ['kayla', 'marcus', 'priya'].forEach(id => {
        if(w.chatted[id]) return;
        const a = (w.actors || []).find(x => x.id === id);
        if(!a || a.off) return;
        let s = a.mood === 'good' ? 5 : a.mood === 'meh' ? 3 : 2;
        if(id === 'kayla' && kayla && kayla.flags.bonded) s += 2;
        if(s > bestS){ bestS = s; pick = id; }
      });
      if(pick) return { type: 'chat', id: pick };
      // the recovery economy is spent; nothing left but the desk
    }
    return { type: 'home' };
  }

  // ---- Share copy that carries the story ----------------------------------------
  // The lead line is the run's best real incident, from counters, receipts, and
  // arc outcomes — never invented. Returns null when the run produced no story
  // (the shell then falls back to the plain format).
  function storyLine(g){
    const brad = g.npcState.brad, boss = g.npcState.boss;
    const s = g.stats || {};
    if(brad.flags.walkedOut)
      return 'I watched Brad get walked out at lunch for working two jobs. His deliverables are my “growth opportunity” now.';
    if(brad.flags.burned)
      return 'I put Brad’s other job on the projector mid-meeting. My analysis is mine again. With interest.';
    if(g.escaped && hasReceipt(g, 'screenshot_brad_deck'))
      return 'I escaped on Day ' + g.day + ' with ' + fmt(g.money) + ', ' + g.soul
        + ' Soul, and one screenshot that could end Brad’s quarter.';
    if(hasReceipt(g, 'screenshot_brad_deck'))
      return 'Holding one screenshot that could end Brad’s quarter. Haven’t decided. That’s the fun part.';
    if(hasReceipt(g, 'hr_survey_metadata'))
      return 'Survived an anonymous survey that knew my middle name. I kept the metadata.';
    if(brad.flags.covered)
      return 'I caught Brad working a second job and covered for him. My inbox is a protected wetland. My soul, less so.';
    if(boss.flags.sympathetic && (boss.counters.quickCalls || 0) >= 2)
      return 'I became the corner office’s emotional support animal. Standing: excellent. Soul: on file with HR.';
    if(g.failed === 'standing')
      return 'Managed out on Day ' + g.day + '. HR called it a transition, which is how you know it was a firing.';
    if(g.failed === 'soul')
      return 'Promoted to management on Day ' + g.day + '. Please do not congratulate me.';
    const bits = [];
    if(s.crunchWins + s.crunchFails > 0) bits.push((s.crunchWins + s.crunchFails) + ' fire drill' + (s.crunchWins + s.crunchFails > 1 ? 's' : ''));
    if(s.bradSteals > 0) bits.push(s.bradSteals + ' Brad theft' + (s.bradSteals > 1 ? 's' : ''));
    if(s.warnings > 0) bits.push(s.warnings + ' formal warning' + (s.warnings > 1 ? 's' : ''));
    if(bits.length >= 2) return 'Survived ' + bits.join(', ').replace(/, ([^,]*)$/, ', and $1') + '.';
    return null;
  }
  function shareText(g){
    const headline = g.over ? verdict(g).title : 'Still there. Still counting.';
    const story = storyLine(g);
    const lines = ['NINE TO SURVIVE — YOUR NUMBER'];
    if(story) lines.push(story);
    lines.push('Day ' + g.day + ' · ' + headline);
    lines.push('Banked ' + fmt(g.money) + ' / ' + fmt(FU_TARGET) + ' · Standing ' + g.standing + ' · Soul ' + g.soul);
    if(!story) lines.push('An unremarkable tenure, which was the plan.');
    lines.push('Ungovernable. Unapologetic.');
    return lines.join('\n');
  }

  return {
    START, ENCOUNTERS, LADDER,
    FU_TARGET, DAY_ENCOUNTERS, BURN_BASE, BURN_STEP,
    PROMOTE_AT, PROMOTE_RESET, PROMOTE_SOUL, WARN_AT, WARN_SOUL, BROKE_SOUL,
    CRUNCH_WIN, CRUNCH_LOSE, CRUNCH_BONUS, COFFEE_SOUL, DECAY_S, TASK_MISS_S, WORLD_EFFECTS,
    GRIND_STREAK, GRIND_SOUL,
    clamp, fmt, burnFor, soulDrainFor,
    newGame, planDay, currentEncounter, isFinalEncounter, jobTitle,
    applyChoice, advance, closeDay, nextDay, canWalkOut, walkOut, verdict,
    applyCrunch, applyCoffee, applyWorldEffect,
    NPC_IDS, ARCS, advanceArcs, worldFlagsFor,
    pushFeed, moodFeed, feedWorldEvent, addReceipt, hasReceipt, burnReceipt,
    ARC_INCIDENTS, applyIncidentChoice, extraChoicesFor, applyExtraChoice,
    BRAD_ENCS, bradOutOfPlay, bradDeckSeen, bradAllHands, bradFiredReport, bradTasksAbsorbed,
    bossSummonsDodged, bossHumanBeat, bossCatchMod,
    marcusTip, consumeCatchShield, dayHeadline, dayAward,
    kaylaSitWith, kaylaTaskTaken, kaylaSentHome, chatBonus, WATCHED_SOUL,
    storyLine, shareText,
    policyAction, policyCardChoice, policyIncidentChoice
  };
})();

// browser + headless-test exposure (no-op if neither exists)
if (typeof window !== 'undefined') window.NineToSurvive = NineToSurvive;
if (typeof module !== 'undefined' && module.exports) module.exports = NineToSurvive;
