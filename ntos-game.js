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

  // A fixed 9-to-5: ten encounters in clock order. Each choice moves Standing (s) and
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
    { title:'Intern',    pay:180 },
    { title:'Associate', pay:300 },
    { title:'Senior',    pay:450 },
    { title:'Manager',   pay:620 },
    { title:'Director',  pay:800 }
  ];
  const FU_TARGET      = 6000;  // your number: bank this and you can walk out (the win)
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

  // Sample DAY_ENCOUNTERS distinct encounters for the day, replayed in clock order.
  function planDay(g){
    const pool = ENCOUNTERS.map((_, i) => i);
    for(let i = pool.length - 1; i > 0; i--){
      const j = Math.floor(rand(g) * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, DAY_ENCOUNTERS).sort((a, b) => a - b);
  }

  // Fresh career. Day 1, Intern, seeded plan for the first day.
  function newGame(seed){
    const g = {
      standing: START.standing, soul: START.soul, money: START.money,
      day: 1, week: 1, jobIdx: 0,
      idxInDay: 0, plan: null,
      failed: null, escaped: false, over: false,
      lastChoice: null, dayReport: null,
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
    coffee:     { s: 0, so:+2 }
  };
  function applyWorldEffect(g, kind){
    const e = WORLD_EFFECTS[kind];
    if(!e) return null;
    const b = { s: g.standing, so: g.soul };
    g.standing = clamp(g.standing + (e.s || 0));
    g.soul     = clamp(g.soul + (e.so || 0));
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    else if(g.soul <= 0 && !g.failed){ g.failed = 'soul'; g.over = true; }
    return { kind, ds: g.standing - b.s, dso: g.soul - b.so };
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
    const missed = Math.max(0, stats.tasksTotal - stats.tasksDone);
    const report = { day: g.day, week: g.week, title: jobTitle(g), pay, burn, drain,
                     tasksDone: stats.tasksDone, tasksTotal: stats.tasksTotal,
                     missed, decay: DECAY_S,
                     broke: false, promoted: false, warned: false, newTitle: null };
    // the treadmill: yesterday's hero + whatever died in the inbox
    g.standing = clamp(g.standing - DECAY_S - missed * TASK_MISS_S);
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    g.money += pay - burn;
    if(g.money < 0){ g.money = 0; report.broke = true; if(!g.failed) soulHit(g, BROKE_SOUL); }
    if(!g.failed) soulHit(g, drain);
    if(!g.failed && g.day % 5 === 0){ // Friday review
      if(g.standing >= PROMOTE_AT && g.jobIdx < LADDER.length - 1){
        g.jobIdx++; g.standing = PROMOTE_RESET; soulHit(g, PROMOTE_SOUL);
        report.promoted = true; report.newTitle = jobTitle(g);
      } else if(g.standing < WARN_AT){
        soulHit(g, WARN_SOUL); report.warned = true;
      }
    }
    report.money = g.money;
    g.dayReport = report;
    return g.failed ? 'gameover' : 'dayend';
  }

  // The morning after a survived day: new date, fresh plan.
  function nextDay(g){
    g.day++; g.week = Math.floor((g.day - 1) / 5) + 1;
    g.idxInDay = 0; g.plan = planDay(g); g.dayReport = null;
  }

  // Fire drill (a crunch, not a fire): deliver under a timer or eat a Standing hit.
  const CRUNCH_WIN = 4, CRUNCH_LOSE = 10;
  function applyCrunch(g, success){
    const before = g.standing;
    g.standing = clamp(g.standing + (success ? CRUNCH_WIN : -CRUNCH_LOSE));
    if(g.standing <= 0 && !g.failed){ g.failed = 'standing'; g.over = true; }
    return { ds: g.standing - before, success };
  }

  // The coffee machine: one small mercy per day.
  const COFFEE_SOUL = 2;
  function applyCoffee(g){
    if(g.coffeeDay === g.day) return null;
    g.coffeeDay = g.day;
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

  return {
    START, ENCOUNTERS, LADDER,
    FU_TARGET, DAY_ENCOUNTERS, BURN_BASE, BURN_STEP,
    PROMOTE_AT, PROMOTE_RESET, PROMOTE_SOUL, WARN_AT, WARN_SOUL, BROKE_SOUL,
    CRUNCH_WIN, CRUNCH_LOSE, COFFEE_SOUL, DECAY_S, TASK_MISS_S, WORLD_EFFECTS,
    clamp, fmt, burnFor, soulDrainFor,
    newGame, planDay, currentEncounter, isFinalEncounter, jobTitle,
    applyChoice, advance, closeDay, nextDay, canWalkOut, walkOut, verdict,
    applyCrunch, applyCoffee, applyWorldEffect
  };
})();

// browser + headless-test exposure (no-op if neither exists)
if (typeof window !== 'undefined') window.NineToSurvive = NineToSurvive;
if (typeof module !== 'undefined' && module.exports) module.exports = NineToSurvive;
