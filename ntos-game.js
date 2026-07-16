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
  // Above SOUL_COMFORT, Soul gains halve (round up): contentment attracts
  // meetings. Only shaves surplus — nobody struggling ever feels it.
  const SOUL_COMFORT = 70;
  function temperSoulGain(g, dso){
    return (dso > 0 && g.soul >= SOUL_COMFORT) ? Math.ceil(dso / 2) : dso;
  }
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
  const PROMOTE_SOUL   = 9;     // what each rung costs you (Session 9: the bar bites)
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
  const NPC_IDS = ['brad', 'boss', 'meredith', 'dennis', 'kayla', 'marcus', 'priya', 'adam'];
  function freshNpcState(){
    const st = {};
    // wants.role is filled by ensureWants(g) at run start (needs the seed);
    // wants.disposition is NOT stored — it's the fixed constant NPC_WANTS.
    NPC_IDS.forEach(id => { st[id] = { stress: 0, trust: 0, arcStage: 0, flags: {}, counters: {},
                                       wants: { role: null, revealed: 0 },
                                       convo: freshConvo() }; });
    return st;
  }

  // Which storylines does THIS run get? Seeded selection of 2–3 from the story
  // pool (weighted so Brad's scandal doesn't headline nearly every run); Marcus
  // is the mentor, not a storyline, and is always on. Inactive arcs stay fully
  // dormant: no clues, no stages, no incidents, no feed lines.
  const ARC_POOL = [
    { key: 'brad_second_job', wt: 0.5 },   // the scandal headlines a minority of runs
    { key: 'boss_spiral', wt: 1 },
    { key: 'hr_survey', wt: 1 },
    { key: 'kayla_presentation', wt: 1 },
    { key: 'priya_credit', wt: 1 }
  ];
  function pickArcs(runSeed){
    const r = localRand((runSeed ^ hashStr('arc_select')) | 0);
    const count = 2 + (r() < 0.5 ? 1 : 0);
    const active = { marcus_survivor: true };
    const cands = ARC_POOL.slice();
    for(let i = 0; i < count && cands.length; i++){
      const total = cands.reduce((s, c) => s + c.wt, 0);
      let roll = r() * total, idx = 0;
      while(idx < cands.length - 1 && roll > cands[idx].wt){ roll -= cands[idx].wt; idx++; }
      active[cands[idx].key] = true;
      cands.splice(idx, 1);
    }
    return active;
  }

  // ---- What each character wants FROM YOU (office-politics motive) --------------
  // Three parts, three lifetimes:
  //   disposition — fixed, authored: the constant NPC_WANTS below (never saved).
  //   role        — rolled ONCE per run from the disposition, saved on the npc.
  //   revealed    — 0..1 discovery value, saved; wiring is a later follow-up.
  // The roll rides a per-NPC side stream seeded off runSeed alone (arcRand's
  // per-key philosophy): it never touches g.rngState or the arc_select stream,
  // so it shifts no existing day-plan or balance number — and seeding PER id
  // means a future 9th character can't reshuffle the existing eight's roles.
  const WANT_TYPES = ['fealty-patron', 'true-mentor', 'hidden-debt-trap'];
  const NPC_WANTS = {
    //             fealty  mentor  trap
    brad:     { 'fealty-patron':0.35, 'true-mentor':0.05, 'hidden-debt-trap':0.60 }, // makes you complicit
    boss:     { 'fealty-patron':0.60, 'true-mentor':0.10, 'hidden-debt-trap':0.30 }, // wants a loyal subject
    meredith: { 'fealty-patron':0.20, 'true-mentor':0.10, 'hidden-debt-trap':0.70 }, // help that becomes a file
    dennis:   { 'fealty-patron':0.30, 'true-mentor':0.05, 'hidden-debt-trap':0.65 }, // favors that bind
    adam:     { 'fealty-patron':0.30, 'true-mentor':0.05, 'hidden-debt-trap':0.65 }, // to be consulted, forever
    kayla:    { 'fealty-patron':0.10, 'true-mentor':0.55, 'hidden-debt-trap':0.35 }, // a real peer who can also drain
    priya:    { 'fealty-patron':0.10, 'true-mentor':0.65, 'hidden-debt-trap':0.25 }, // the genuine ally
    marcus:   { 'fealty-patron':0.05, 'true-mentor':0.80, 'hidden-debt-trap':0.15 }  // the mentor (tips can miscalibrate)
  };
  // One weighted draw from a character's disposition. Weights need not sum to 1.
  function rollWant(runSeed, id){
    const disp = NPC_WANTS[id];
    if(!disp) return null;
    const rng = localRand((runSeed ^ hashStr('npc_wants') ^ hashStr(id)) | 0);
    const total = WANT_TYPES.reduce((s, t) => s + (disp[t] || 0), 0);
    let roll = rng() * total;
    for(let i = 0; i < WANT_TYPES.length - 1; i++){
      if(roll < disp[WANT_TYPES[i]]) return WANT_TYPES[i];
      roll -= disp[WANT_TYPES[i]];
    }
    return WANT_TYPES[WANT_TYPES.length - 1];
  }
  // A hidden-debt-trap sometimes wears a mentor's face at first — a FALSE early
  // tell that the truth overturns at sharp. Trap-only by construction (this is
  // never called for mentor/patron roles), rolled on its OWN per-NPC side stream
  // — independent of the npc_wants stream and of g.rngState — so it shifts no
  // day-plan or arc. Set once, rides the save.
  const FALSE_TELL_P = 0.4;
  // Only these four traps have authored head-fake + cold-callback lines (see
  // MOTIVE_TELLS below). A trap outside this set (a boss/kayla/priya who happened
  // to roll trap) never false-tells — it would have no correction line to land.
  // Kept in sync with MOTIVE_TELLS['hidden-debt-trap'].faintFalse by a test.
  const FALSE_TELL_IDS = ['dennis', 'meredith', 'adam', 'brad'];
  function rollFalseTell(runSeed, id){
    return localRand((runSeed ^ hashStr('false_tell') ^ hashStr(id)) | 0)() < FALSE_TELL_P;
  }
  // Idempotent: fill any npc whose want-fields aren't set yet. Deterministic from
  // runSeed, so a fresh run, a resume, or a double call all yield the same roles
  // — which is exactly what makes it a safe backfill for pre-feature saves.
  function ensureWants(g){
    if(!g || !g.npcState) return;
    NPC_IDS.forEach(id => {
      const npc = g.npcState[id];
      if(!npc) return;
      if(!npc.wants) npc.wants = { role: null, revealed: 0 };
      const w = npc.wants;
      if(w.role == null) w.role = rollWant(g.runSeed, id);
      // trap-only, and only where a callback line exists: mentors/patrons (and
      // off-cluster traps) can NEVER carry a false tell (short-circuit means their
      // false_tell stream is never even drawn — still deterministic)
      if(w.falseTell == null)
        w.falseTell = (w.role === 'hidden-debt-trap') && FALSE_TELL_IDS.indexOf(id) >= 0
                      && rollFalseTell(g.runSeed, id);
      if(w.revealed == null) w.revealed = 0;
      if(w.tellShown == null) w.tellShown = 'none';   // highest band already voiced
    });
  }

  // Conversation memory (parallel to wants; rides the save). ledger.you = what you
  // owe them, ledger.them = what they owe you, ledger.refusals = interest counter on
  // the current owed balance. All plain data, no randomness — deterministic backfill.
  function freshConvo(){
    return { yes: 0, no: 0, tenor: 0, beatsSeen: {}, lastConvoDay: 0,
             ledger: { you: 0, them: 0, refusals: 0 } };
  }
  function ensureConvo(g){
    if(!g || !g.npcState) return;
    NPC_IDS.forEach(id => {
      const npc = g.npcState[id];
      if(!npc) return;
      if(!npc.convo) npc.convo = freshConvo();
      const c = npc.convo;
      if(c.ledger == null) c.ledger = { you: 0, them: 0, refusals: 0 };
      if(c.ledger.refusals == null) c.ledger.refusals = 0;
      if(c.ledger.you == null) c.ledger.you = 0;
      if(c.ledger.them == null) c.ledger.them = 0;
      if(c.beatsSeen == null) c.beatsSeen = {};
      if(c.tenor == null) c.tenor = 0;
      if(c.yes == null) c.yes = 0;
      if(c.no == null) c.no = 0;
      if(c.lastConvoDay == null) c.lastConvoDay = 0;
    });
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
      activeArcs: pickArcs((seed == null ? 1 : seed) | 0),   // this run's storylines
      todayIncidents: [],    // [{id, owner, atMin}] the arcs staged for today
      todayCollectors: [],   // trap ids coming to collect a debt today (capped <=2)
      receipts: { count: 0, flags: {} },
      heat: { hr: 0, boss: 0, brad: 0 },   // office heat: who's watching you now
      schemes: { used: 0, flags: {} },     // the plays you ran on this building
      feed: [],              // today's office feed: [{m: clockMin, text}]
      runSeed: (seed == null ? 1 : seed) | 0,
      rngState: (seed == null ? 1 : seed) | 0
    };
    g.dennisBlockerToday = arcRand(g, 'dennis', 'blocker')() < 0.25;
    ensureWants(g);           // roll each character's motive (own side stream)
    ensureConvo(g);           // conversation memory + ledgers (zeros, no randomness)
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
    // the compliance ledger: paying Soul for Standing, again (feeds the verdict)
    if(c.s > 0 && c.so < 0 && g.stats) g.stats.comply = (g.stats.comply || 0) + 1;
    const before = { standing: g.standing, soul: g.soul };
    g.standing = clamp(g.standing + c.s);
    g.soul     = clamp(g.soul + temperSoulGain(g, c.so));
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
    chatGood:   { s: 0, so:+3 },   // five minutes of being human
    chatMeh:    { s: 0, so:+2 },
    chatBad:    { s: 0, so:+2 },   // you listened to them vent; still counts
    couch:      { s:-1, so:+3 },   // seen lounging; worth it, barely
    coffee:     { s: 0, so:+2 },
    bossHuman:  { s: 0, so:+2 },   // he was, briefly, a person
    dennisFlatter: { s: 0, so:-2 } // "nineteen years, wow" — it costs you to say it
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
    if(kind === 'bradFoiled') addHeat(g, 'brad', 1);   // CHAIN: you were RIGHT THERE — paranoia climbs
    const b = { s: g.standing, so: g.soul };
    const sMod = (kind === 'bossCatch' || kind === 'bossCatchBad')
      ? bossCatchMod(g) + consumeCatchShield(g) : 0;
    g.standing = clamp(g.standing + (e.s || 0) + sMod);
    g.soul     = clamp(g.soul + temperSoulGain(g, e.so || 0));
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
    'brad|good':     'Brad posted “thrilled to share” at 9:04 AM.',
    'adam|good':     'Adam cc’d himself.',
    'adam|meh':      'Adam replied-all to ask who approved this.',
    'adam|bad':      'Kayla told Adam to stay in his lane. Adam scheduled a follow-up about lanes.'
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
    // CHAIN: collecting evidence is itself evidence — HR heat +1 per receipt
    addHeat(g, 'hr', 1);
    return true;
  }
  function hasReceipt(g, name){ return !!(g.receipts && g.receipts.flags[name]); }
  function burnReceipt(g, name){
    if(!hasReceipt(g, name)) return false;
    delete g.receipts.flags[name];
    g.receipts.count--;
    return true;
  }

  // ---- Office heat: three ways the building starts watching you -----------------
  // Deterministic pressure meters raised by what YOU did, spent as consequences.
  // CHAIN REACTIONS (each link logged where it fires):
  //   HR heat      ← survey truth, collecting receipts, public receipt-burns,
  //                  formal warnings  → raises the warning bar at review (High),
  //                  Meredith starts reading writing styles (morning feed).
  //   Boss attention ← promotions, dodged quick calls, crunch wins, perfect
  //                  task days → an extra floor walk at High, plus off-arc
  //                  "quick call" summons on seeded days.
  //   Brad paranoia ← the screenshot, backing Priya, the bait, foiled raids
  //                  → an extra raid at High, and (once) the self-own morning.
  // All integers on g.heat, clamped 0..HEAT_MAX, serialized with the save.
  const HEAT_MAX = 8;
  const HEAT_MED = 3, HEAT_HIGH = 5;
  const HR_HEAT_WARN = 5;   // at High, the review warns below WARN_AT + this
  function addHeat(g, kind, n){
    if(!g.heat) g.heat = { hr: 0, boss: 0, brad: 0 };
    const before = g.heat[kind] || 0;
    g.heat[kind] = Math.max(0, Math.min(HEAT_MAX, before + n));
    return g.heat[kind] - before;
  }
  function heatOf(g, kind){ return (g.heat && g.heat[kind]) || 0; }
  function heatLevel(g, kind){
    const v = heatOf(g, kind);
    return v >= HEAT_HIGH ? 'High' : v >= HEAT_MED ? 'Medium' : 'Low';
  }
  // one line per meter the first morning it runs High — the tell before the tax
  const HEAT_FEED = {
    hr:   'Meredith has been reading old survey responses with a highlighter.',
    boss: 'There is a dashboard in the corner office now with a sparkline named after you.',
    brad: 'Brad locks his screen to get water. Both screens.'
  };
  function heatMorningFeed(g){
    if(!g.heatFeedDay) g.heatFeedDay = {};
    ['hr', 'boss', 'brad'].forEach((k, i) => {
      if(heatOf(g, k) >= HEAT_HIGH && !g.heatFeedDay[k]){
        g.heatFeedDay[k] = g.day;
        pushFeed(g, 551 + i, HEAT_FEED[k]);
      }
    });
    // CHAIN: Brad paranoia High → (once per run, seeded) the self-own morning.
    // His mistake, not yours — pure comedy plus headline material.
    const brad = g.npcState && g.npcState.brad;
    if(brad && heatOf(g, 'brad') >= HEAT_HIGH && !brad.flags.selfOwn && !brad.flags.fired
       && arcRand(g, 'brad', 'selfown')() < 0.3){
      brad.flags.selfOwn = true;
      brad.counters.selfOwnDay = g.day;
      brad.stress = 3;
      pushFeed(g, 558, 'Brad reply-alled a spreadsheet named FINAL_v2_BRAD_PRIVATE. It was not private. It was not final.');
      pushFeed(g, 566, 'Brad has recalled the message. Recalling a message notifies everyone twice.');
    }
    // CHAIN: exposing Brad → legal wakes up the next morning (once)
    if(brad && (brad.flags.burned || brad.flags.fired) && !g.legalFeedDay){
      g.legalFeedDay = g.day;
      pushFeed(g, 553, 'Legal asked everyone to “preserve relevant documents.” Everyone suddenly has documents.');
    }
  }

  // ---- The motive layer's VOICE: what you've figured out someone wants ----------
  // wants.revealed (0..1) is strictly COSMETIC — it drives text only, never a
  // meter, plan, flag, or anything the world reads. Three bands escalate the
  // tell: none (say nothing), faint (a hedged noticing), sharp (name it). A
  // hidden-debt-trap with falseTell shows a MENTOR-flavored faint (the head-fake),
  // then a sharpCorrected line that quotes the misread back and overturns it.
  const REVEAL_FAINT = 0.3, REVEAL_SHARP = 0.7;
  function revealBand(v){ return v >= REVEAL_SHARP ? 'sharp' : v >= REVEAL_FAINT ? 'faint' : 'none'; }
  const BAND_RANK = { none: 0, faint: 1, sharp: 2 };
  // Per role × band. Traps carry two extra variants for the false-tell path.
  const MOTIVE_TELLS = {
    'true-mentor': {
      faint: 'They keep steering you right. Odd, for this place.',
      sharp: 'They want you to make it out. That is the whole tell — no ledger, no angle.'
    },
    'fealty-patron': {
      faint: 'They warm up when you defer. There is a price on that warmth somewhere.',
      sharp: 'They do not want your work. They want your loyalty, renewed daily, out loud.'
    },
    'hidden-debt-trap': {
      faint: 'Every favor from them has a faint second edge you can not quite name.',
      sharp: 'The help was never help. They are keeping a ledger, and your name has a column now.',
      // the head-fake (mentor-flavored) and its cold callback correction
      faintFalse: {
        dennis:   'Dennis walked your file through himself today. Maybe he is in your corner after all.',
        meredith: 'Meredith checked in, unprompted. Reads almost like she is looking out for you.',
        adam:     'Adam keeps offering to help. Annoying, but maybe well-meant.',
        brad:     'Brad has been oddly generous with credit this week. Maybe you misjudged him.'
      },
      sharpCorrected: {
        dennis:   '“In your corner.” You actually wrote that down. Dennis keeps a ledger, and every favor you mistook for kindness has a line in it with your name and a number owed.',
        meredith: 'Looking out for you. Right. She was looking, and she was writing it down. The check-in was intake. You are, and were always, a file.',
        adam:     'Well-meant. That was the trap wearing a cardigan. Every “help” was a debt, and Adam has come to collect, with an appendix.',
        brad:     'Misjudged him. You almost trusted Brad. The generosity was a down payment on your silence, and the bill just arrived.'
      }
    }
  };
  // The current tell for an NPC, or null in the 'none' band. Pure read — no rng,
  // no mutation — so any voice generator can call it freely.
  function motiveTell(g, id){
    const npc = g.npcState && g.npcState[id];
    if(!npc || !npc.wants || npc.wants.role == null) return null;
    const w = npc.wants;
    const band = revealBand(w.revealed);
    if(band === 'none') return null;
    const tbl = MOTIVE_TELLS[w.role];
    if(!tbl) return null;
    if(w.role === 'hidden-debt-trap' && w.falseTell){
      if(band === 'faint') return tbl.faintFalse[id] || tbl.faint;
      return tbl.sharpCorrected[id] || tbl.sharp;   // sharp: the cold callback
    }
    return tbl[band] || null;
  }
  // Move a discovery value and report which band (if any) was newly entered this
  // call — callers use crossed==='sharp' to sharpen a Tier-A/peak toast in place.
  // Strictly cosmetic: mutates only wants.revealed.
  function revealWant(g, id, amt){
    const npc = g.npcState && g.npcState[id];
    if(!npc || !npc.wants) return { revealed: 0, crossed: null };
    const w = npc.wants;
    const from = revealBand(w.revealed);
    w.revealed = Math.min(1, Math.max(0, w.revealed + (amt || 0)));
    const to = revealBand(w.revealed);
    return { revealed: w.revealed, crossed: (BAND_RANK[to] > BAND_RANK[from]) ? to : null };
  }
  // A peak moment (Tier-A incident, flash/poison) speaks the sharp tell directly
  // the first time we're at 'sharp' and it hasn't been voiced — and marks
  // tellShown so the morning drip won't echo it. Returns the (maybe) appended text.
  function sharpenPeak(g, id, text){
    const npc = g.npcState && g.npcState[id];
    if(!npc || !npc.wants) return text;
    if(revealBand(npc.wants.revealed) !== 'sharp' || npc.wants.tellShown === 'sharp') return text;
    const line = motiveTell(g, id);
    npc.wants.tellShown = 'sharp';
    return line ? text + ' ' + line : text;
  }
  // Morning ambient drip: announce any NPC whose band has advanced past what was
  // last voiced (tellShown). Capped + deterministically ordered like moodFeed, so
  // a busy morning stays readable. Dennis is chat-only and rarely reaches even
  // faint — that fog is intentional.
  function motiveMorningFeed(g){
    if(!g.npcState) return;
    const cands = [];
    NPC_IDS.forEach(id => {
      const w = g.npcState[id] && g.npcState[id].wants;
      if(!w || w.role == null) return;
      const band = revealBand(w.revealed);
      if(BAND_RANK[band] > BAND_RANK[w.tellShown || 'none']){
        const line = motiveTell(g, id);
        if(line) cands.push({ id, band, line });
      }
    });
    if(!cands.length) return;
    // sharp reveals lead; then a deterministic shuffle among equals, at most two
    const r = arcRand(g, 'motive', 'morning');
    cands.sort((a, b) => BAND_RANK[b.band] - BAND_RANK[a.band]);
    const picks = [];
    while(cands.length && picks.length < 2){
      const topRank = BAND_RANK[cands[0].band];
      const tier = cands.filter(c => BAND_RANK[c.band] === topRank);
      const chosen = tier.splice(Math.floor(r() * tier.length), 1)[0];
      cands.splice(cands.indexOf(chosen), 1);
      picks.push(chosen);
    }
    picks.forEach((p, i) => {
      g.npcState[p.id].wants.tellShown = p.band;   // don't re-announce this band
      pushFeed(g, 545 + i * 2, p.line);
    });
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
          // exposed and unreported: some mornings, payroll does the math —
          // and some runs, the moment genuinely passes (holding the screenshot
          // unspent is its own story)
          a.waited = (a.waited || 0) + 1;
          if(arcRand(g, 'brad', 'fired')() < 0.4){
            a.stage = 6; brad.stress = 3;
            pushFeed(g, 540, 'All-hands moved to 11:30. “Please plan to attend.” Nobody plans to attend. Everybody attends.');
          } else if(a.waited >= 2){
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
          } else if(heatOf(g, 'boss') >= HEAT_MED
                    && arcRand(g, 'boss', 'spiralcall')() < 0.5){
            // CHAIN: spiral + Boss attention — deflecting a spiraling boss who
            // has you on his dashboard only works some days. He "just wants
            // five minutes." It is never five minutes.
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

    // PRIYA BUILT THE THING. Six late nights of visible grind, then Brad demos
    // it and the Boss thanks "the team." Stages: 0 dormant · 1 the build (two
    // days, feed notices, she doesn't leave her desk) · 2 demo day (the card) ·
    // 3 aftermath · 4 filed. If Brad is already out of play, the Boss presents
    // it himself — credit rolls uphill either way.
    priya_credit: {
      npc: 'priya',
      advance(g, a){
        const priya = g.npcState.priya;
        if(a.stage === 0){
          if(a.startDay == null)
            a.startDay = 4 + Math.floor(localRand((g.runSeed ^ hashStr('priya_start')) | 0)() * 4);
          if(g.day >= a.startDay){
            a.stage = 1; priya.stress = 2;
            pushFeed(g, 547, 'Priya’s commit history has no gaps this week. Including the 2 AMs.');
          }
        } else if(a.stage === 1){
          if(g.day >= a.startDay + 2){
            a.stage = 2;
            a.presenter = bradOutOfPlay(g) ? 'boss' : 'brad';
            pushFeed(g, 542, 'Demo at 2:00. Presenter: ' + (a.presenter === 'brad' ? 'Brad' : 'the Boss')
              + '. Builder: not the presenter.');
            g.todayIncidents.push({ id: 'priya_demo', owner: a.presenter,
              atMin: 780 + Math.floor(arcRand(g, 'priya', 'demo')() * 120) });
          } else {
            pushFeed(g, 552, 'Priya declined two meetings. The thing is almost the thing.');
          }
        } else if(a.stage === 2){
          if(!priya.counters.demoDay){
            // unanswered somehow: the demo re-runs (nothing strands)
            g.todayIncidents.push({ id: 'priya_demo', owner: a.presenter || 'brad',
              atMin: 780 + Math.floor(arcRand(g, 'priya', 'demo')() * 120) });
          } else {
            a.stage = 3;
            pushFeed(g, 544, 'The Boss thanked “the team” for the dashboard. The team checked its one-person Slack channel and said nothing.');
            if(priya.flags.backed)
              pushFeed(g, 560, 'Someone renamed the dashboard file to include a byline. IT did not object.');
            else if(priya.flags.baitWon)
              pushFeed(g, 560, 'Slide four is now a teaching moment. Attendance at the retro is mandatory.');
          }
        } else if(a.stage === 3){
          a.stage = 4;
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
      // arcs this run didn't draw stay fully dormant (old saves: all active)
      if(g.activeArcs && !g.activeArcs[key]) return;
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
    priya_demo: {
      tag: 'Incident · The Demo',
      title: 'Built by Priya. Presented by Someone Else.',
      scene: 'The dashboard Priya built across six late nights is on the big screen, driven with the confidence of authorship by someone who did not author it. “Something I’ve been noodling on,” he says. Priya is in the second row, holding a coffee she isn’t drinking. The commit log is one tab away. Everyone can see the screen. Only you are looking at her.',
      choices: [
        { key:'back', t:'“Quick context — this is Priya’s build. She should walk us through it.”', s:-3, so:+5,
          o:'The room recalibrates. “Obviously a team effort,” the presenter says, at a volume that means it wasn’t. Priya walks the room through it in nine flawless minutes, and something in the org chart shifts a millimeter.' },
        { key:'dm', t:'DM her: “Everyone knows. For what it’s worth.”', s:0, so:+3,
          o:'“ha. thanks.” Two seconds later: “it’s fine.” It is not fine, and you have contributed one (1) grape to the fineness. Still — witnessed beats invisible.' },
        { key:'collect', t:'Screenshot the commit log. Every line has her name on it.', s:0, so:+1,
          o:'Authorship, timestamped, saved. You fixed nothing today. You made it fixable.' },
        { key:'slide', t:'Let it slide. The demo is going great.', s:+1, so:-4,
          o:'The demo lands. The presenter bows at the neck. Priya closes her laptop with two hands, quietly, like it’s a casket. Your monitor is suddenly fascinating.' },
        { key:'bait', t:'Swap in the flawed backup file before the demo starts.', s:0, so:0,
          o:'(the swap goes in)' }
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
    g.soul     = clamp(g.soul + temperSoulGain(g, so || 0));
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
    // Tier-A reveal: these incidents put a character's true motive on display.
    // Fire the discovery once per resolution (through every return path) and, at
    // the instant it crosses into 'sharp', sharpen the toast in place so the peak
    // doesn't whisper. Strictly cosmetic — revealWant only moves wants.revealed.
    const TIER_A_TGT = { brad_discovery: 'brad', priya_demo: 'priya', hr_survey: 'meredith', boss_quick_call: 'boss' };
    const TIER_A_AMT = { brad_discovery: 0.30, priya_demo: 0.25, hr_survey: 0.30, boss_quick_call: 0.30 };
    const sealTier = (outcome) => {
      const tid = TIER_A_TGT[id];
      if(!tid) return outcome;
      revealWant(g, tid, TIER_A_AMT[id] || 0);
      if(id === 'priya_demo') revealWant(g, 'brad', 0.10);   // secondary: the thief, on display
      return sharpenPeak(g, tid, outcome);                    // the peak spoke; morning won't echo it
    };
    if(id === 'brad_discovery'){
      const a = g.arcs.brad_second_job;
      brad.counters.discoveries = (brad.counters.discoveries || 0) + 1;
      brad.counters.discoveryDay = g.day;
      if(c.key === 'screenshot'){
        addReceipt(g, 'screenshot_brad_deck');
        addHeat(g, 'brad', 2);   // CHAIN: he saw you see him — paranoia climbs
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
    if(id === 'priya_demo'){
      const priya = g.npcState.priya;
      priya.counters.demoDay = g.day;
      if(c.key === 'back'){
        priya.trust += 3; priya.flags.backed = true;
        priya.convo.ledger.them++;   // you backed her publicly — she owes you one (mentor credit)
        g.npcState.brad.stress = Math.min(3, g.npcState.brad.stress + 1);
        addHeat(g, 'brad', 1);   // CHAIN: backing Priya reads as choosing a side
        pushFeed(g, min, 'Someone said “this is Priya’s build” out loud, in the room, on the record.');
      } else if(c.key === 'dm'){
        priya.trust += 1; priya.flags.dmed = true;
      } else if(c.key === 'collect'){
        addReceipt(g, 'priya_commit_log');
        priya.flags.collected = true;
        pushFeed(g, min, 'A commit log was screenshotted. Git remembers everything. So, now, do you.');
      } else if(c.key === 'slide'){
        priya.flags.slid = true;
        pushFeed(g, min, 'The demo was flawless. The credits were fiction. Productivity held.');
      } else if(c.key === 'bait'){
        priya.flags.baited = true;
        addHeat(g, 'brad', 2);   // CHAIN: win or lose, he starts checking his files
        if(arcRand(g, 'priya', 'bait')() < 0.5){
          priya.flags.baitWon = true;
          priya.trust += 2; g.npcState.brad.stress = 3;
          const d2 = applyStoryDelta(g, +8, 0);
          g.lastChoice = { choiceIndex, ds: d.ds + d2.ds, dso: d.dso + d2.dso,
            outcome: sealTier('Slide four divides by zero, live, on the projector. The presenter, who “built this,” cannot say why. Priya, asked to help, fixes it in forty seconds with HER NAME in the file path on screen. You are a terrible person. The day is perfect.') };
          return g.lastChoice;
        }
        priya.flags.baitLost = true;
        const d3 = applyStoryDelta(g, -7, 0);
        pushFeed(g, min, 'IT traced a file swap “in about ten minutes, honestly.” HR was less impressed than IT.');
        g.lastChoice = { choiceIndex, ds: d.ds + d3.ds, dso: d.dso + d3.dso,
          outcome: sealTier('The swap traces to your login by end of day. IT is impressed. HR is not. The presenter delivers an apology deck — about you. It has your headshot in it.') };
        return g.lastChoice;
      }
    }
    if(id === 'hr_survey'){
      const mer = g.npcState.meredith;
      mer.counters.surveyDay = g.day;
      if(c.key === 'truth'){
        mer.flags.truthTold = true;
        addHeat(g, 'hr', 2);   // CHAIN: seven paragraphs have a writing style
        pushFeed(g, min, 'Someone submitted seven paragraphs. Meredith has opened a thesaurus.');
      } else if(c.key === 'help'){
        const peers = ['kayla', 'priya', 'marcus'];
        const who = peers[Math.floor(arcRand(g, 'hr', 'peer')() * peers.length)];
        g.npcState[who].trust += 2;
        g.npcState[who].convo.ledger.them++;   // you helped them phrase it safely — a quiet favor owed
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
    g.lastChoice = { choiceIndex, ds: d.ds, dso: d.dso, outcome: sealTier(c.o) };
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
    revealWant(g, 'marcus', 0.12);   // his tips ARE the mentor, in action (drip)
    pushFeed(g, min, tip.feed);
    return { kind: tip.kind, text: tip.text };
  }
  // Marcus's phrase deflects exactly one catch (consumed on use).
  function consumeCatchShield(g){
    const m = g.npcState && g.npcState.marcus;
    if(!m || !m.flags.shield) return 0;
    delete m.flags.shield;
    m.counters.saves = (m.counters.saves || 0) + 1;   // his tip just paid out
    return +2;
  }

  // ---- Kayla's panic day: the player's options, priced -----------------------------
  function kaylaSitWith(g, min){
    const k = g.npcState.kayla;
    if(k.flags.satWith) return null;
    k.flags.satWith = true; k.flags.bonded = true; k.trust += 2;
    k.convo.ledger.them++;   // you showed up for her — a favor owed (mentor credit)
    const d = applyStoryDelta(g, 0, +4);
    revealWant(g, 'kayla', 0.15);   // real company, no agenda — you see her (drip)
    pushFeed(g, min, 'Two chairs in the kitchen. No agenda. It helped more than the deck did.');
    return { dso: d.dso, text: 'You sit with her. No advice, no pep talk, just company and a shared opinion about slide 14. The clock keeps billing you. Worth it.' };
  }
  function kaylaTaskTaken(g, min){
    const k = g.npcState.kayla;
    if(k.flags.tookTask) return null;
    k.flags.tookTask = true; k.trust += 1;
    k.convo.ledger.them++;   // you took work off her plate — a favor owed
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
  // The cost of a story: on days an arc event runs hot (the Boss spiraling, the
  // survey live or hunting, Kayla's panic day), the day itself bills Soul at
  // close. Costly, not brutal — good runs should end worn, not gutted.
  const ARC_HEAT_SOUL = 4;
  function arcHeatToday(g){
    const A = g.arcs || {};
    const bo = A.boss_spiral || { stage: 0 };
    const hs = A.hr_survey || { stage: 0 };
    const ka = A.kayla_presentation || { stage: 0 };
    const br = A.brad_second_job || { stage: 0 };
    const pr = A.priya_credit || { stage: 0 };
    return bo.stage === 1 || hs.stage === 1 || hs.stage === 2 || ka.stage === 1
      || (br.stage >= 3 && br.stage <= 6)    // carrying his secret is also work
      || pr.stage === 1 || pr.stage === 2    // so is watching the credit line
      || !!g.dennisBlockerToday;             // and so is a day of numbered questions
  }

  // The dead-eyed play: you watched and kept shipping. Priced at day end.
  const WATCHED_SOUL = 3;
  function kaylaWatchedPrice(g, report){
    const a = (g.arcs || {}).kayla_presentation;
    const k = g.npcState && g.npcState.kayla;
    if(!a || a.stage !== 1 || !k) return;
    if(k.flags.satWith || k.flags.tookTask || k.flags.toldHR) return;
    soulHit(g, WATCHED_SOUL);
    k.flags.ignored = true;   // the story remembers the dead-eyed play
    report.watchedKayla = true;
    pushFeed(g, 1018, 'Productivity held steady today. The dashboard is very proud of everyone.');
  }
  // Sitting with her that day permanently improves what her chats give back.
  function chatBonus(g, who){
    revealWant(g, who, 0.10);   // every peer chat reads them a little (drip → morning feed)
    if(who === 'kayla' && g.npcState.kayla.flags.bonded){
      const d = applyStoryDelta(g, 0, +2);
      return d.dso;
    }
    // CHAIN: you watched her drown and kept shipping — her chats are "fine"
    // now ("it's fine") and refill almost nothing, for the rest of the run
    if(who === 'kayla' && g.npcState.kayla.flags.ignored){
      const d = applyStoryDelta(g, 0, -2);
      return d.dso;
    }
    return 0;
  }

  // ═══ CONVERSATIONS — a chat is a scene shaped by wants.role ════════════════════
  // Role templates own the MECHANICS (numbers, debt semantics, reveal); per-character
  // skins own the FLAVOR. wants.role picks the scene; wants.revealed never enters it
  // (role = mechanical, revealed = cosmetic). Debts (ledger) make a trap's "help" a
  // bill; the collect beat is the game's biggest reveal — the marker being called IS
  // the truth, so it pushes revealed to sharp and speaks the cold callback in place.
  const CONVO_SOUL_FLOOR = { good: 3, meh: 2, bad: 2 };   // == legacy chatGood/Meh/Bad
  const COLLECT_BASE = 5, COLLECT_STEP = 2, COLLECT_MAX = 11;   // -5, -7, -9, cap -11 (interest)
  const COLLECT_SHARP = 0.7;   // a called debt lands revealed at sharp, minimum
  const CONVO_TENOR_MIN = -4, CONVO_TENOR_MAX = 4;
  const COLLECT_CAP = 2;       // at most this many collectors cross the floor per morning
  const NPC_NAME = { brad:'Brad', boss:'The Boss', meredith:'Meredith', dennis:'Dennis',
                     kayla:'Kayla', marcus:'Marcus', priya:'Priya', adam:'Adam' };
  // The world calls Meredith 'hr'; the brain keys her 'meredith'. Conversation
  // callers pass whichever id they hold — normalize to the brain key here.
  const WORLD_TO_BRAIN = { hr: 'meredith' };
  function brainNpcId(id){ return WORLD_TO_BRAIN[id] || id; }

  // Mechanics only. Skins supply t/o. reveal is on EVERY choice (the universal drip
  // lives on `just`); the collect beat's reveal is handled specially (→ sharp).
  const CONVO_TEMPLATES = {
    'fealty-patron': {
      offer: [ {key:'defer', s:+5, so:-4, ask:'loyalty', mem:'yes', tenor:+1, reveal:0.12},
               {key:'hedge', s:+1, so: 0,               mem:'neutral', tenor:0, reveal:0.12},
               {key:'just',  s: 0, so:'floor',          mem:'neutral',          reveal:0.10} ],
      cold:  [ {key:'capitulate', s:+3, so:-6, ask:'loyalty', mem:'yes', tenor:+1, reveal:0.25},
               {key:'hold',       s:-3, so:+3,           mem:'no',  tenor:-1, reveal:0.25} ]
    },
    'true-mentor': {
      gift: [ {key:'accept', s:0, so:+4, mem:'yes', tenor:+1, reveal:0.12},
              {key:'probe',  s:0, so:+2, mem:'neutral',       reveal:0.20},
              {key:'just',   s:0, so:'floor', mem:'neutral',  reveal:0.10} ],
      // grafted onto `gift` when ledger.them>0 (extraChoicesFor-style) — NOT a beat
      spend: {key:'spend', boon:true, settleThem:1, mem:'yes', reveal:0.10}
    },
    'hidden-debt-trap': {
      bait:    [ {key:'accept',  s:0, so:+3, ask:'help', debt:+1, mem:'yes', tenor:+1, reveal:0.20},
                 {key:'decline', s:0, so: 0,             mem:'no',  tenor:-1,          reveal:0.10},
                 {key:'just',    s:0, so:'floor',        mem:'neutral',                reveal:0.10} ],
      collect: [ {key:'pay',    collect:true, mem:'yes'},          // meter+interest from skin
                 {key:'refuse', refuse:true,  mem:'no', tenor:-2}, // interest++ ; heat from skin
                 {key:'settle', settle:true,  gate:'canSettle'} ]  // receipt or a favor owed
    }
  };

  // Fallbacks so no role/choice is ever text-less (rare off-top-2 rolls).
  const GENERIC_OPEN = {
    'fealty-patron': 'They want to know you’re on-side. That’s the whole meeting.',
    'true-mentor':   'They’ve got a minute and they’re giving it to you. No angle.',
    'hidden-debt-trap': 'They lead with a favor. There is always a second half to a favor.'
  };
  const GENERIC_CHOICE = { defer:'Defer to them.', hedge:'Stay noncommittal.', just:'Just talk.',
    accept:'Accept.', decline:'Decline.', capitulate:'Give in.', hold:'Hold your line.',
    probe:'Ask them something real.', spend:'Call in the favor they owe you.',
    pay:'Pay what you owe.', refuse:'Refuse — for now.', settle:'Settle the debt clean.' };
  // Outcome fallback (role-neutral, in-voice) for an off-skin roll — the ~10% case
  // where a character draws a role it has no authored skin for. Without this the
  // outcome came back an EMPTY STRING and the conversation read as broken.
  const GENERIC_OUTCOME = {
    defer:'You defer. It lands well, and it costs you a little, the way it always does.',
    hedge:'You stay noncommittal. Neither warmth nor rupture — filed for later.',
    just:'Five minutes of being a person in a building that keeps forgetting you are one. It helps.',
    accept:'You take what’s offered. Whether it was a gift or a hook, you find out later.',
    decline:'You pass. Your ledger stays clean; the offer cools and waits.',
    capitulate:'You give them the loyalty they wanted, out loud. It buys peace and costs a sliver of you.',
    hold:'You hold your line. They note it — in a column, somewhere.',
    probe:'You ask the real question. The answer, rehearsed or not, tells you something.',
    spend:'You call in the favor they owed you. It clears, cleanly.',
    pay:'You settle what you owed. The books balance; you’re lighter by exactly that much.',
    refuse:'You put it off. The debt doesn’t close — it just gets heavier.',
    settle:'You square the account without giving up anything you can’t spare.'
  };

  // Flavor. Mentor skins: {open, gift:{accept,probe,just}, spend:{t,o}}. Trap skins:
  // {collectMeter, refuseHeat, open, bait:{...}, collect:{...}, falseOpen?}. Patron:
  // {open, offer:{...}, cold:{...}}. Missing skin/choice → generic text above.
  const CONVO_SKINS = {
    marcus: {
      'true-mentor': {
        open:'Marcus doesn’t look up from his crossword. “Pull up a chair. You’ve got the face.”',
        gift:{ accept:{t:'“What would you do?” Let him tell you.',
                       o:'Four sentences, exact, and they work. He wanted nothing for them. He never does.'},
               probe:{t:'Ask how he’s lasted nineteen years without going gray inside.',
                       o:'“I stopped auditioning for a job I already have.” You write it on nothing and keep it anyway.'},
               just:{t:'Just shoot the breeze for five.',
                       o:'Five minutes about his kid’s soccer. The building recedes. You come back a person.'} },
        spend:{t:'“Actually — I could use that favor now.”',
               o:'He makes one call. The stuck thing unsticks. “We’re square,” he says, and means it.'} },
      'hidden-debt-trap': { collectMeter:'standing', refuseHeat:null,
        open:'Marcus leans in, uncharacteristic. “I can square that approval with Dennis. We go back.”',
        bait:{ accept:{t:'“That’d save me a day. Please.”',
                       o:'Dennis folds by noon. Marcus winks. A tally mark appears somewhere with your name on it.'},
               decline:{t:'“I’ll handle Dennis myself.”',
                       o:'“Suit yourself.” He leans back out. The offer doesn’t come twice.'},
               just:{t:'Change the subject.', o:'You talk about nothing. He lets you. For now.'} },
        collect:{ pay:{t:'“Right — I owe you. I’ll back your version in the room.”',
                       o:'You vouch for Marcus’s take to leadership. It wasn’t your take. Your standing paid the tab.'},
                  refuse:{t:'“Can it wait? Bad week.”',
                       o:'“It can wait.” The tally does not wait. It accrues.'},
                  settle:{t:'Call it even — spend what he owes you, or a receipt.',
                       o:'You settle the ledger cold. He shrugs. Paper beats loyalty.'} } }
    },
    priya: {
      'true-mentor': {
        open:'Priya slides her laptop an inch toward you. “I already fixed the thing that was going to page you at 2. It’s fine.”',
        gift:{ accept:{t:'“You’re a lifesaver — walk me through it?”',
                       o:'She does, fast, generous, no scoreboard. You leave better at your own job.'},
               probe:{t:'“How are you still standing?”',
                       o:'“I ship, then I forget who took credit. The forgetting is the skill.”'},
               just:{t:'Just vent to each other for five.',
                       o:'Two people agreeing the dashboard is fine and the process is not. Restorative.'} },
        spend:{t:'“I need that thing unblocked — can you?”',
               o:'She reroutes it in three minutes with a commit you’ll never fully understand. Done.'} },
      'hidden-debt-trap': { collectMeter:'standing', refuseHeat:null,
        open:'Priya, oddly cool. “I can put your name on the commit too. Just remember it went both ways.”',
        bait:{ accept:{t:'“Deal — my name on it.”',
                       o:'Your name lands in the file path next to hers. It reads like teamwork. It’s an invoice.'},
               decline:{t:'“It’s your build. Keep it yours.”',
                       o:'“Okay.” She closes the laptop. You kept your ledger clean and your credit small.'},
               just:{t:'Deflect.', o:'You talk shop. The offer hangs in the air, unspent.'} },
        collect:{ pay:{t:'“Fair — I’ll co-sign your proposal to leadership.”',
                       o:'You attach your name to a plan that was hers. If it sinks, it sinks on your standing.'},
                  refuse:{t:'“Not this cycle.”',
                       o:'“Right.” The invoice doesn’t void. It compounds.'},
                  settle:{t:'Settle it — her owed favor, or a receipt.',
                       o:'You zero it out on paper. Cleaner than co-signing anything.'} } }
    },
    kayla: {
      'true-mentor': {
        open:'Kayla pulls a second chair over without asking. “Two chairs, no agenda. What’s actually wrong?”',
        gift:{ accept:{t:'Actually tell her.',
                       o:'She listens like it’s billable and gives none of it back as advice. Lighter, after.'},
               probe:{t:'“How do you not let it get to you?”',
                       o:'“Oh, it gets to me. I just stopped pretending it doesn’t. Try it.”'},
               just:{t:'Trade office gossip for five.',
                       o:'Who’s leaving, who should. Conspiratorial, warm, free.'} },
        spend:{t:'“Can you take one thing off my plate today?”',
               o:'A deliverable quietly changes owners. No email announces it. That’s how you know it’s real.'} },
      'hidden-debt-trap': { collectMeter:'soul', refuseHeat:null,
        open:'Kayla, tight. “Cover for me at standup? Say I’m heads-down on the deck. We’re even, right?”',
        bait:{ accept:{t:'“Go. I’ve got standup.”',
                       o:'You vouch for a heads-down she isn’t doing. Small lie, warm feeling, quiet tab opened.'},
               decline:{t:'“I can’t lie to the room for you.”',
                       o:'“Wow. Okay.” Something cools between you. Your ledger, at least, stays clean.'},
               just:{t:'Dodge the ask.', o:'You change the subject. She notices you changing the subject.'} },
        collect:{ pay:{t:'“Yeah — I’ll take your on-call this weekend.”',
                       o:'You eat her weekend rotation. Nobody thanks you. A little more of you goes quiet.'},
                  refuse:{t:'“I really can’t this time.”',
                       o:'“It’s fine.” It is not fine, and the favor doesn’t close. It just gets heavier.'},
                  settle:{t:'Settle it clean — a receipt, or what she owes you.',
                       o:'You call it square without giving up a weekend. She lets it go. Barely.'} } }
    },
    boss: {
      'fealty-patron': {
        open:'The Boss steeples his fingers. “I like people who are *aligned*. Are you aligned?”',
        offer:{ defer:{t:'“Completely. Your call, always.”',
                       o:'He glows. Your standing ticks up on the strength of a nod. A little of you signs the receipt.'},
               hedge:{t:'“I’m aligned with the work.”',
                       o:'“…Sure.” Neither warmth nor rupture. He files it under ‘watch.’'},
               just:{t:'Redirect to something concrete.',
                       o:'You steer it to a deliverable. He lets you. Five survivable minutes.'} },
        cold:{ capitulate:{t:'“Understood. I’m with you.”',
                       o:'Louder loyalty, steeper price. Standing up, and something behind your eyes down.'},
               hold:{t:'“I’ll keep doing good work. That’s my alignment.”',
                       o:'“We’ll see.” The door’s punctuation follows you to your desk. Standing bruised, self intact.'} } },
      'hidden-debt-trap': { collectMeter:'standing', refuseHeat:'boss',
        open:'Low, confidential. “I can fast-track your review. Off the record. You’d owe me one.”',
        bait:{ accept:{t:'“I’d appreciate that. A lot.”',
                       o:'“Consider it moving.” The fast-track is real. So is the ‘one.’ It has a due date you can’t see.'},
               decline:{t:'“Let it go through normal channels.”',
                       o:'“Principled. Noted.” No fast-track — and no marker against you. A fair trade.'},
               just:{t:'Pretend you didn’t hear the ‘owe.’', o:'You talk quarters. The offer idles, engine running.'} },
        collect:{ pay:{t:'“Of course — I’ll champion your reorg in the room.”',
                       o:'You spend your credibility fronting his plan to the floor. It’s his win, on your standing.'},
                  refuse:{t:'“Now’s not a good time.”',
                       o:'“Hm.” The favor stays open, and the corner office remembers with columns. It gets dearer.'},
                  settle:{t:'Settle it — receipt, or a favor he owes.',
                       o:'You close the account before it accrues. He respects it, coldly.'} } }
    },
    brad: {
      'hidden-debt-trap': { collectMeter:'standing', refuseHeat:'brad', falseOpen:true,
        open:'Brad, all teeth. “I’ll share the deck credit. You just back my version in the room. Team, right?”',
        bait:{ accept:{t:'“Sure. Team.”',
                       o:'Your name rides his slide. It looks like a partnership. It’s a lien.'},
               decline:{t:'“I’ll speak to my own work, thanks.”',
                       o:'“Cool cool cool.” He remembers this. But your credit stays yours.'},
               just:{t:'Laugh it off.', o:'You joke past it. The offer waits, grinning.'} },
        collect:{ pay:{t:'“Yeah — I’ll co-sign your numbers to leadership.”',
                       o:'You vouch for Brad’s figures in the room. They’re soft. Your standing holds the bag.'},
                  refuse:{t:'“Can’t back that one, Brad.”',
                       o:'“Interesting.” The favor doesn’t die — it inflates, and so does his paranoia.'},
                  settle:{t:'Kill it with a receipt (or a favor owed).',
                       o:'You flash paper. The debt evaporates. Brad’s smile does too.'} } },
      'fealty-patron': {
        open:'Brad, expansive. “Ride with me and you rise with me. That’s just how this works.”',
        offer:{ defer:{t:'“Happy to ride, Brad.”',
                       o:'He anoints you his guy. Standing up; a piece of you now belongs to his personal brand.'},
               hedge:{t:'“I’ll keep my head down and ship.”',
                       o:'“…Loyalty’s a currency, buddy.” He shelves you. No harm yet.'},
               just:{t:'Change lanes fast.', o:'You pivot to logistics. He lets it slide, this once.'} },
        cold:{ capitulate:{t:'“You’re right. I’m with you.”',
                       o:'You buy into the brand out loud. Standing up, dignity discounted.'},
               hold:{t:'“I rise on my own work.”',
                       o:'“Bold.” He markets against you at the next standup. Standing takes the hit.'} } }
    },
    meredith: {
      'hidden-debt-trap': { collectMeter:'soul', refuseHeat:'hr', falseOpen:true,
        open:'Meredith, warm and quiet. “Let me *lose* that flag in your file. Between us.”',
        bait:{ accept:{t:'“That would… really help. Thank you.”',
                       o:'The flag vanishes. So does a boundary. She now has a favor and a folder with your name.'},
               decline:{t:'“Leave the file as it is.”',
                       o:'“Your call.” The flag stays; so does your distance from her. Worth it.'},
               just:{t:'Deflect into HR small talk.', o:'You discuss the handbook. The offer waits in the drawer.'} },
        collect:{ pay:{t:'“Of course I’ll give ‘context’ on Devon’s exit.”',
                       o:'You feed her the quiet testimony she wanted. It’s intake. A little more of you is in the file.'},
                  refuse:{t:'“I’d rather not get into that.”',
                       o:'“Mm.” The favor stays open, and open favors, in People Ops, gain interest.'},
                  settle:{t:'Settle it — the metadata receipt, or a favor owed.',
                       o:'You remind her, hypothetically, how anonymity works. The debt closes itself.'} } },
      'fealty-patron': {
        open:'Meredith, brightly. “Culture is loyalty. And I *document* loyalty.”',
        offer:{ defer:{t:'“I’m a culture person, Meredith.”',
                       o:'She logs you Green. Standing up; you can feel the survey behind her eyes.'},
               hedge:{t:'“I try to do right by the team.”',
                       o:'“The *team*. Interesting framing.” Filed, not forgiven.'},
               just:{t:'Compliment the offsite and leave.', o:'You praise the trust-fall. She lets you go.'} },
        cold:{ capitulate:{t:'“Whatever the culture needs.”',
                       o:'You say the words on the poster. Standing up, self quietly redlined.'},
               hold:{t:'“My work is my culture.”',
                       o:'“We’ll note that.” A document forms with your name in the filename. Standing dips.'} } }
    },
    dennis: {
      'hidden-debt-trap': { collectMeter:'standing', refuseHeat:'hr', falseOpen:true,
        open:'Dennis, almost kind. “I’ll approve it today. You’ll remember who unstuck you.”',
        bait:{ accept:{t:'“Today would be huge. Thank you, Dennis.”',
                       o:'Approved in nine minutes. Unheard of. The favor is now a line item in a ledger only he can read.'},
               decline:{t:'“I’ll wait for normal approval.”',
                       o:'“Suit yourself.” It clears Thursday, unowed. Slower, cleaner.'},
               just:{t:'Ask about the old system instead.', o:'Twelve minutes on index cards. The offer keeps.'} },
        collect:{ pay:{t:'“You’re right — I’ll back your process change in the review.”',
                       o:'You endorse a sub-process nobody wanted, to leadership. It’s his win, charged to your standing.'},
                  refuse:{t:'“I can’t champion that, Dennis.”',
                       o:'“I see.” The favor doesn’t clear. Dennis keeps a ledger, and ledgers charge interest.'},
                  settle:{t:'Settle the account — receipt, or a favor owed.',
                       o:'You balance the books to the cent. He respects nothing but a balanced book.'} } },
      'fealty-patron': {
        open:'Dennis, over his glasses. “Nineteen years buys a little deference. Show some.”',
        offer:{ defer:{t:'“The institutional knowledge — invaluable, truly.”',
                       o:'He softens; approvals will flow a little easier. Standing up, a sliver of you filed under ‘flatterer.’'},
               hedge:{t:'“I respect the tenure.”',
                       o:'“*Respect.* We’ll see if you mean it.”'},
               just:{t:'Ask a real process question.', o:'He answers for nine minutes. You escape at eight.'} },
        cold:{ capitulate:{t:'“Absolutely. Your way, Dennis.”',
                       o:'You defer, fully, aloud. Standing up; the sound of your own deference lingers.'},
               hold:{t:'“I’ll follow the policy, not the man.”',
                       o:'“The policy is the man.” Your next three files grow questions. Standing bleeds.'} } }
    },
    adam: {
      'hidden-debt-trap': { collectMeter:'soul', refuseHeat:'hr', falseOpen:true,
        open:'Adam, conspiratorial. “I know a guy. I’ll make a call for you. You’ll return the favor, naturally.”',
        bait:{ accept:{t:'“If you could make that call — thanks, Adam.”',
                       o:'A call is made. A thing moves. You are now, faintly, in Adam’s orbit, which has no exit velocity.'},
               decline:{t:'“I’ve got it, but thanks.”',
                       o:'“Was not consulted, and it shows. Fine.” You stay outside the orbit. Prefer it there.'},
               just:{t:'Let him tell a 2009 story.', o:'Twelve minutes on the old approvals. The favor waits, patient.'} },
        collect:{ pay:{t:'“Sure — I’ll sit through your process working group.”',
                       o:'Ninety minutes of Adam, weekly, indefinitely. You return with less of yourself each time.'},
                  refuse:{t:'“I can’t take that on right now.”',
                       o:'“Noted, with an appendix.” The favor stays open, and Adam’s follow-ups compound.'},
                  settle:{t:'Settle it — a receipt, or a favor owed.',
                       o:'You close the loop on paper before it becomes a standing meeting. Rare mercy.'} } },
      'fealty-patron': {
        open:'Adam, self-important. “Defer to the institutional knowledge and doors open. I *am* the doors.”',
        offer:{ defer:{t:'“Lead the way, Adam.”',
                       o:'He beams and ‘makes a call.’ Standing up; you’ve agreed to be led by the doors.'},
               hedge:{t:'“I’ll keep you in the loop.”',
                       o:'“The loop. I *invented* the loop.” Filed under ‘insufficiently deferential.’'},
               just:{t:'Nod and exit.', o:'You escape mid-anecdote. He continues to the wall.'} },
        cold:{ capitulate:{t:'“You’re right, as ever.”',
                       o:'You feed the self-importance. Standing up, patience overdrawn.'},
               hold:{t:'“I’ll decide my own process.”',
                       o:'“Then you’ll hear from me. In writing.” A concern forms. Standing wobbles.'} } }
    }
  };

  // A debt can be settled by spending a favor they owe you, or by burning a receipt.
  function canSettle(g, id){
    const c = g.npcState[id].convo;
    return c.ledger.them > 0 || (g.receipts && g.receipts.count > 0);
  }
  // Build today's scene for an NPC — pure over (role, convo). No randomness.
  function conversationFor(g, id){
    id = brainNpcId(id);
    const npc = g.npcState && g.npcState[id];
    if(!npc || !npc.wants || npc.wants.role == null) return null;
    const role = npc.wants.role, c = npc.convo;
    let beat;
    if(role === 'hidden-debt-trap') beat = c.ledger.you > 0 ? 'collect' : 'bait';
    else if(role === 'fealty-patron') beat = (c.no >= 2 || c.tenor <= -2) ? 'cold' : 'offer';
    else beat = 'gift';   // true-mentor (and any off-top-2 fallback) is always gift
    const tmpl = CONVO_TEMPLATES[role] || CONVO_TEMPLATES['true-mentor'];
    const skin = (CONVO_SKINS[id] || {})[role] || null;
    const flavor = (b, key) => (skin && skin[b] && skin[b][key]) || null;
    const choices = tmpl[beat]
      .filter(m => m.gate !== 'canSettle' || canSettle(g, id))   // drop settle when unavailable
      .map(m => { const f = flavor(beat, m.key);
        return Object.assign({}, m, { t: f ? f.t : GENERIC_CHOICE[m.key] || m.key,
                                      o: f ? f.o : (GENERIC_OUTCOME[m.key] || '…') }); });
    // mentor: graft "spend the favor" onto gift when they owe you (augments, not replaces)
    if(role === 'true-mentor' && beat === 'gift' && c.ledger.them > 0){
      const m = tmpl.spend, f = skin && skin.spend;
      choices.push(Object.assign({}, m, { t: f ? f.t : GENERIC_CHOICE.spend,
                                          o: f ? f.o : GENERIC_OUTCOME.spend }));
    }
    const openText = (role === 'hidden-debt-trap' && npc.wants.falseTell && skin && skin.falseOpen)
      ? MOTIVE_TELLS['hidden-debt-trap'].faintFalse[id]     // reuse the authored head-fake
      : (skin ? skin.open : GENERIC_OPEN[role]);
    return { id, role, beat, tag: 'Conversation · ' + (NPC_NAME[id] || id),
             title: NPC_NAME[id] || id, scene: openText, choices };
  }

  // Resolve a conversation choice. mood scales the soul-floor (== legacy chat value);
  // defaults to 'meh' when the shell doesn't pass it. Returns {ds,dso,outcome,next}.
  function applyConversationChoice(g, id, i, min, mood){
    id = brainNpcId(id);
    const scene = conversationFor(g, id);
    if(!scene || !scene.choices[i]) return null;
    const m = scene.choices[i], npc = g.npcState[id], c = npc.convo;
    const so = (m.so === 'floor') ? CONVO_SOUL_FLOOR[mood || 'meh'] : (m.so || 0);
    const d = applyStoryDelta(g, m.s || 0, so);
    let ds = d.ds, dso = d.dso, outcome = m.o || '';
    if(m.debt) c.ledger.you = Math.max(0, c.ledger.you + m.debt);
    if(m.collect){
      const skin = CONVO_SKINS[id] && CONVO_SKINS[id]['hidden-debt-trap'];
      const cost = Math.min(COLLECT_MAX, COLLECT_BASE + COLLECT_STEP * (c.ledger.refusals || 0));
      const dd = (skin && skin.collectMeter === 'soul') ? applyStoryDelta(g, 0, -cost)
                                                        : applyStoryDelta(g, -cost, 0);
      ds += dd.ds; dso += dd.dso;
      c.ledger.you = Math.max(0, c.ledger.you - 1); c.ledger.refusals = 0;
    }
    if(m.refuse){
      c.ledger.refusals = (c.ledger.refusals || 0) + 1;   // interest accrues on the balance
      const skin = CONVO_SKINS[id] && CONVO_SKINS[id]['hidden-debt-trap'];
      if(skin && skin.refuseHeat) addHeat(g, skin.refuseHeat, 1);
    }
    if(m.settle){
      if(c.ledger.them > 0) c.ledger.them--; else burnReceiptForDennis(g);   // favor owed, else evidence
      c.ledger.you = Math.max(0, c.ledger.you - 1); c.ledger.refusals = 0;
    }
    if(m.settleThem) c.ledger.them = Math.max(0, c.ledger.them - 1);
    if(m.boon) g.taskForgivenessToday = true;   // the mentor's payoff: a missed task forgiven at 5
    if(m.tenor) c.tenor = Math.max(CONVO_TENOR_MIN, Math.min(CONVO_TENOR_MAX, c.tenor + m.tenor));
    if(m.mem === 'yes') c.yes++; else if(m.mem === 'no') c.no++;
    // reveal: every choice teaches a little; a called debt is the whole truth →
    // push to sharp and speak the cold callback in the same breath as the cost.
    if(scene.beat === 'collect'){
      const cur = npc.wants.revealed;
      if(cur < COLLECT_SHARP) revealWant(g, id, COLLECT_SHARP - cur);
      outcome = sharpenPeak(g, id, outcome);
    } else if(m.reveal){
      revealWant(g, id, m.reveal);
    }
    // legacy chat mechanics, folded into the resolver (the vending path is retired):
    // Marcus's coasting tip rides his mentor gift; Kayla's bonded/ignored history
    // colors what her chats give back. Deltas captured so the shell animates them.
    if(id === 'marcus' && scene.role === 'true-mentor' && m.key === 'accept'){
      const bs = g.standing, bso = g.soul;
      const tip = marcusTip(g, min);
      ds += g.standing - bs; dso += g.soul - bso;   // e.g. a miscalibrated tip costs Standing
      if(tip) outcome = outcome + ' ' + tip.text;
    }
    if(id === 'kayla' && scene.beat !== 'collect'){
      if(npc.flags.bonded){ const dk = applyStoryDelta(g, 0, +2); dso += dk.dso; }
      else if(npc.flags.ignored){ const dk = applyStoryDelta(g, 0, -2); dso += dk.dso; }
    }
    c.lastConvoDay = g.day; c.beatsSeen[scene.beat] = g.day;
    g.lastChoice = { choiceIndex: i, ds, dso, outcome, next: null };
    return g.lastChoice;
  }

  // Who comes to collect this morning — capped, prioritized (biggest debt, then
  // stalest, then cast order). Rolled on the arcRand side stream, and ONLY for a
  // trap you actually owe, so a debt-free run consumes no rng and stages nothing.
  function collectorsToday(g){
    const cands = [];
    NPC_IDS.forEach(id => {
      const w = g.npcState[id].wants, c = g.npcState[id].convo;
      if(w.role !== 'hidden-debt-trap' || c.ledger.you <= 0) return;
      let P = 0.35 + 0.15 * (c.ledger.you - 1) + 0.05 * (g.day - c.lastConvoDay);
      if(c.ledger.you >= 2) P = Math.max(P, 0.85);
      P = Math.min(0.9, P);
      if(arcRand(g, 'collect', id)() < P)
        cands.push({ id, owe: c.ledger.you, stale: g.day - c.lastConvoDay });
    });
    cands.sort((a, b) => b.owe - a.owe || b.stale - a.stale
                         || NPC_IDS.indexOf(a.id) - NPC_IDS.indexOf(b.id));
    return cands.slice(0, COLLECT_CAP).map(x => x.id);
  }

  // ---- Dennis's approvals: the brain's side of the blocker ------------------------
  const DENNIS_BURN_ORDER = ['hr_survey_metadata', 'priya_commit_log', 'screenshot_brad_deck'];
  function dennisApprovalCleared(g, min, how, n){
    const dn = g.npcState.dennis;
    dn.counters.approvalsCleared = (dn.counters.approvalsCleared || 0) + (n || 1);
    dn.counters.clearDay = g.day;
    if(how === 'waited') pushFeed(g, min, 'Dennis had questions. You stood in The Pipe and answered all of them. A filename was defended like family land.');
    else if(how === 'flattered') pushFeed(g, min, '“Nineteen years — the institutional knowledge!” Dennis approved the file while agreeing.');
    else if(how === 'receipt') pushFeed(g, min, 'Dennis received a receipt. Approvals followed at unprecedented speed.');
    else if(how === 'tip') pushFeed(g, min, 'You used Marcus’s phrase. Dennis paused, said “load-bearing, huh,” and approved everything.');
    else if(how === 'walked') pushFeed(g, min, 'Someone answered Dennis’s questions WHILE WALKING. A file cleared in transit. Witnesses exist.');
    else if(how === 'adam') pushFeed(g, min, 'Dennis approved a full stack to escape a conversation about index cards.');
  }
  // burn ANY held receipt to clear today's approvals (fixed order, least precious first)
  function burnReceiptForDennis(g){
    for(const name of DENNIS_BURN_ORDER)
      if(burnReceipt(g, name)) return name;
    return null;
  }
  // Marcus's one-shot phrase also unsticks Dennis
  function useShieldForDennis(g){
    const m = g.npcState.marcus;
    if(!m || !m.flags.shield) return false;
    delete m.flags.shield;
    m.counters.saves = (m.counters.saves || 0) + 1;
    return true;
  }

  // Adam stopped you in the aisle. Again. (Rarely, usefully.)
  function adamIntercepted(g, min, useful){
    const ad = g.npcState.adam;
    if(!ad) return;
    ad.counters.intercepts = (ad.counters.intercepts || 0) + 1;
    ad.counters.interceptDay = g.day;
    if(useful){
      ad.counters.usefulDay = g.day;
      pushFeed(g, min, 'Adam “made a call” to Dennis. An approval cleared. Nobody understands the mechanism.');
    } else {
      pushFeed(g, min, 'Adam offered unsolicited context on your way past. The context was from 2009.');
    }
  }

  // ---- Schemes: weaponizing receipts, trust, and what you can see coming --------
  // Small, deterministic, readable. Each is an extra verb that exists only when
  // its conditions are met; g.schemes counts them for headlines/awards/share.
  function schemeUsed(g, name){
    if(!g.schemes) g.schemes = { used: 0, flags: {} };
    g.schemes.flags[name] = (g.schemes.flags[name] || 0) + 1;
    g.schemes.used++;
  }
  function schemesUsed(g){ return (g.schemes && g.schemes.used) || 0; }

  // INTERCEPTION: you walked at Brad while he was casing your inbox. Raid off.
  function bradConfronted(g, min){
    const brad = g.npcState.brad;
    brad.counters.confronts = (brad.counters.confronts || 0) + 1;
    brad.counters.confrontDay = g.day;
    addHeat(g, 'brad', 1);   // CHAIN: being seen seeing him — paranoia climbs
    revealWant(g, 'brad', 0.12);   // reading him a little better (drip → morning feed)
    pushFeed(g, min, 'Brad suddenly remembered a call. The water bottle stayed at the fountain, unfilled.');
    return '“Looking for something?” He was not. He remembered a call, urgently. The raid is off.';
  }
  // SCHEME: flash the screenshot. Not spent — shown. His raids end for the run.
  function bradFlashed(g, min){
    const brad = g.npcState.brad;
    if(brad.flags.cowed) return null;
    if(!hasReceipt(g, 'screenshot_brad_deck')) return null;
    brad.flags.cowed = true;
    schemeUsed(g, 'flash');
    addHeat(g, 'brad', 2);
    revealWant(g, 'brad', 0.20);   // acting on him teaches you what he is (peak)
    pushFeed(g, min, 'Brad saw a phone wallpaper today that aged him. He has stopped visiting the bullpen.');
    return sharpenPeak(g, 'brad', 'You angle the phone, casually. He recognizes the deck. You put it away, still yours. He will not be visiting your inbox again.');
  }
  // SCHEME: the flawed file, planted where he steals from. He presents poison.
  function baitPlanted(g, min){
    pushFeed(g, min, 'A file moved to the top of a stack. Its formulas are, charitably, aspirational.');
    return 'The flawed file sits on top, gleaming. Now be visibly elsewhere.';
  }
  function bradPoisoned(g, min){
    const brad = g.npcState.brad;
    brad.counters.poisonedDay = g.day;
    schemeUsed(g, 'poison');
    addHeat(g, 'brad', 2);   // CHAIN: he cannot prove it, which is worse
    const d = applyStoryDelta(g, +3, +2);
    revealWant(g, 'brad', 0.20);   // watching the theft detonate is clarifying (peak)
    pushFeed(g, min, 'Brad presented “his” analysis. Cell C9 divides by a word. He said the word “directionally” four times.');
    pushFeed(g, (min || 0) + 6, 'Brad’s recap email walks back the analysis he “built.” Authorship is suddenly a team concept.');
    return { ds: d.ds, dso: d.dso,
      text: sharpenPeak(g, 'brad', 'Brad lifts the flawed file and presents it within the hour, confidently. It detonates on slide two. You watch from your desk, shipping actual work.') };
  }
  // INTERCEPTION: caught Dennis mid-carry — the questions get answered en route.
  function dennisWalked(g, min){
    dennisApprovalCleared(g, min, 'walked', 1);
    return 'You fall into step beside him. Nineteen questions over forty meters. He approves the file at the door of The Pipe, almost disappointed.';
  }
  // Adam reached HR: the concern lands (on someone; unclear; heat regardless)
  function adamConcernLanded(g, min){
    const ad = g.npcState.adam;
    ad.counters.concerns = (ad.counters.concerns || 0) + 1;
    ad.counters.concernDay = g.day;
    addHeat(g, 'hr', 1);   // CHAIN: a raised concern needs a folder; the folder needs names
    pushFeed(g, min, 'Adam raised a concern with HR. The concern has an appendix. Meredith opened a folder.');
    return null;
  }
  // INTERCEPTION: you asked Adam about 2009. HR never learns of the concern.
  function adamRedirected(g, min){
    const ad = g.npcState.adam;
    ad.counters.redirects = (ad.counters.redirects || 0) + 1;
    const d = applyStoryDelta(g, 0, -1);   // the anecdote has three parts. You hear all of them.
    revealWant(g, 'adam', 0.15);   // twelve minutes with Adam is twelve minutes of Adam (drip)
    pushFeed(g, min, 'Adam was headed to HR but got a better offer: someone asked how things were done in 2009.');
    return { dso: d.dso, text: '“Funny you ask—” Twelve minutes on the old approval system. HR never learns of the concern. Your Soul learns about 2009.' };
  }
  // SCHEME: point Adam at Dennis. Seeded 50/50 — bypass, or a bigger delay.
  // CHAIN: Dennis blocker + Adam meddling = either a bypass or a worse day.
  function adamGrenade(g, min){
    const ad = g.npcState.adam;
    ad.counters.grenades = (ad.counters.grenades || 0) + 1;
    ad.counters.grenadeDay = g.day;
    schemeUsed(g, 'grenade');
    revealWant(g, 'adam', 0.15);   // deploying him means understanding him (drip)
    const bypass = arcRand(g, 'adam', 'grenade')() < 0.5;
    if(bypass){
      dennisApprovalCleared(g, min, 'adam');
      pushFeed(g, min, 'Adam and Dennis talked about the old system for forty minutes. Everything got approved to end the conversation.');
      return { bypass: true,
        text: 'Adam opens with “back when approvals were INDEX CARDS—” and Dennis, cornered by his own kind, approves everything just to make it stop.' };
    }
    const d = applyStoryDelta(g, 0, -1);
    pushFeed(g, min, 'Adam raised a process concern on your behalf. Dennis found it compelling. A previously fine file now needs approval.');
    return { bypass: false, dso: d.dso,
      text: 'Adam “helps” by proposing a sub-process. Dennis loves it. Another of your files is now stuck, and there is a meeting about the sub-process. You are invited.' };
  }
  // Pre-demo window: the commit log, collected early, in the room
  function priyaPreCollect(g, min){
    if(hasReceipt(g, 'priya_commit_log')) return null;
    addReceipt(g, 'priya_commit_log');
    g.npcState.priya.flags.collected = true;
    pushFeed(g, min, 'A commit log was screenshotted in the meeting room, pre-demo. Git remembers everything. So, now, do you.');
    return 'You lean over the demo laptop. One tab: the commit log, every line with her name on it. Click. Saved. The demo hasn’t even started.';
  }
  // Pre-demo window: the flawed backup file, planted before the room fills
  function priyaPrePlant(g, min){
    const priya = g.npcState.priya;
    if(priya.flags.preBaited) return null;
    priya.flags.preBaited = true;
    schemeUsed(g, 'preplant');
    pushFeed(g, min, 'A file named backup_FINAL was quietly renamed FINAL. Nobody saw. Git saw.');
    return 'Two clicks while the room is empty. The presenter will open the backup — the one that divides by zero. You take a seat in the second row.';
  }
  // SCHEME: spend the metadata to cool HR — the OTHER use of the receipt.
  // (It also defuses a warning at review; you can't have both. A real decision.)
  function coolHR(g, min){
    if(!hasReceipt(g, 'hr_survey_metadata')) return null;
    if(heatOf(g, 'hr') < HEAT_MED) return null;
    burnReceipt(g, 'hr_survey_metadata');
    g.heat.hr = 0;
    schemeUsed(g, 'coolhr');
    const mer = g.npcState.meredith;
    mer.counters.cooled = (mer.counters.cooled || 0) + 1;
    mer.counters.cooledDay = g.day;
    revealWant(g, 'meredith', 0.20);   // turning the metadata on her is seeing her plainly (drip)
    pushFeed(g, min, 'Someone asked Meredith, hypothetically, how anonymous the survey backend is. The writing-style project ended today.');
    return 'You ask, hypothetically, about response IDs. Meredith’s highlighter caps itself. Your file gets thinner by the sound of it. The receipt is spent.';
  }

  // Never found time for the quick call: the office reads that as an answer.
  function bossSummonsDodged(g, min){
    const boss = g.npcState.boss;
    addHeat(g, 'boss', 2);   // CHAIN: an unanswered "got a sec" is an answer he remembers
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
  const CALIB_ENC  = 3;   // "The Meeting About You, Without You"
  function extraChoicesFor(g, encIdx){
    const extras = [];
    if(encIdx === CREDIT_ENC && hasReceipt(g, 'screenshot_brad_deck') && !bradOutOfPlay(g)){
      extras.push({ key: 'burn_screenshot',
        t: '“Quick question before we move on — Brad, how’s Q3 tracking at the other place?” Screen-share the screenshot.' });
    }
    if(encIdx === CREDIT_ENC && hasReceipt(g, 'priya_commit_log') && !bradOutOfPlay(g)){
      extras.push({ key: 'burn_commit_log',
        t: '“Hold on — pull up the commit log. Every line of the last one had a name on it too.”' });
    }
    // SCHEME: evidence works in calibration too — submit the commit log as
    // "context" and the slide about you gets timestamps instead of vibes
    if(encIdx === CALIB_ENC && hasReceipt(g, 'priya_commit_log')){
      extras.push({ key: 'burn_calibration',
        t: 'Attach the commit log to your “context.” Turns out receipts work on slides about you, too.' });
    }
    return extras;
  }
  function applyExtraChoice(g, encIdx, key, min){
    if(encIdx === CALIB_ENC && key === 'burn_calibration'){
      if(!burnReceipt(g, 'priya_commit_log')) return null;
      schemeUsed(g, 'calibration');
      const d = applyStoryDelta(g, +5, +2);
      g.npcState.priya.trust += 1;   // her name rides along, credited
      pushFeed(g, min, 'Someone submitted calibration context with TIMESTAMPS. The slide changed. The slide never changes.');
      g.lastChoice = { choiceIndex: 'burn_calibration', ds: d.ds, dso: d.dso,
        outcome: 'Your “context” arrives as a commit log: dates, diffs, names. The VP squints at a bar chart that suddenly has footnotes. The slide is still wrong — but wrong in your favor now, which is the local definition of justice.' };
      return g.lastChoice;
    }
    if(encIdx !== CREDIT_ENC) return null;
    if(key === 'burn_commit_log'){
      if(!burnReceipt(g, 'priya_commit_log')) return null;
      const d = applyStoryDelta(g, +8, +6);
      const brad = g.npcState.brad;
      // CHAIN: public receipt-burns are a scene — HR notices, Brad spirals
      addHeat(g, 'hr', 1); addHeat(g, 'brad', 2);
      brad.trust -= 2; brad.stress = Math.min(3, brad.stress + 1);
      g.npcState.priya.trust += 2;
      pushFeed(g, min, 'A commit log appeared on the big screen. Authorship stopped being a vibe.');
      g.lastChoice = { choiceIndex: 'burn_commit_log', ds: d.ds, dso: d.dso,
        outcome: 'You put Priya’s commit log on the screen next to Brad’s “initiative.” Same move, same guy, receipts this time. The boss looks at Brad the way auditors look at expense reports. Your analysis is yours again — and so, retroactively, is hers.' };
      return g.lastChoice;
    }
    if(key !== 'burn_screenshot') return null;
    if(!burnReceipt(g, 'screenshot_brad_deck')) return null;
    const d = applyStoryDelta(g, +10, +8);   // the theft, reversed, with interest
    const brad = g.npcState.brad;
    // CHAIN: the projector moment — HR opens a folder; Brad stops raiding
    // anyone who screen-shares evidence (see noBradRaids in worldFlagsFor)
    addHeat(g, 'hr', 1); addHeat(g, 'brad', 2);
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
    const pr = A.priya_credit || { stage: 0 };
    return {
      kaylaPanic:     ka.stage === 1 && !kayla.flags.toldHR,
      webinarUntil:   (ka.stage === 2 && ka.webinarDay === g.day) ? 630 : null,
      priyaGrind:     pr.stage === 1 || pr.stage === 2,   // heads-down until the demo lands
      dennisBlocker:  !!g.dennisBlockerToday,
      bradLaptop:     b.stage >= 1 && b.stage <= 6,   // the second laptop, drawn
      bradCalls:      b.stage >= 2 && b.stage <= 6,   // status shifts + stairwell trips
      bradDeckAt:     b.stage === 3 ? b.deckAt : null,
      bradFiredToday: b.stage === 6,
      bradGone:       b.stage === 7,     // stage 8 = closed quietly; he's still here
      // CHAIN: exposing Brad (the projector moment) or flashing him the
      // screenshot ends his raids — a burned man checks his own screen
      noBradRaids:    !!brad.flags.covered || !!brad.flags.burned || !!brad.flags.cowed
                      || b.stage === 6 || b.stage === 7,
      bossArcHot:     bo.stage === 1,
      // CHAIN: Boss attention High adds a floor walk on top of any spiral walk
      extraBossWalks: (bo.stage === 1 ? 1 : 0) + (heatOf(g, 'boss') >= HEAT_HIGH ? 1 : 0),
      // CHAIN: Brad paranoia High adds a raid — he is sure YOU are up to something
      extraBradRaids: (heatOf(g, 'brad') >= HEAT_HIGH && b.stage !== 6 && b.stage !== 7) ? 1 : 0,
      crunchBoost:    bo.stage === 1 ? 0.25 : 0,
      // CHAIN: Boss attention High summons "quick calls" even with no spiral
      // running — high performers get calendars done TO them (seeded ~1-in-3)
      bossSummonsAt:  (bo.stage === 1 && bo.summonsToday)
        || (heatOf(g, 'boss') >= HEAT_HIGH && arcRand(g, 'boss', 'heatcall')() < 0.35
            ? 640 + Math.floor(arcRand(g, 'boss', 'heatcallmin')() * 200) : null),
      incidents:      (g.todayIncidents || []).slice(),
      // map brain ids → world actor ids (Meredith is 'hr' on the floor) so the
      // world stages the right actor for the collection walk
      collectors:     (g.todayCollectors || []).map(id => id === 'meredith' ? 'hr' : id)

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
    if(g.taskForgivenessToday && missed > 0){
      missed--; forgiven = true;                                             // Marcus was right
      if(g.npcState && g.npcState.marcus)
        g.npcState.marcus.counters.saves = (g.npcState.marcus.counters.saves || 0) + 1;
    }
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
    if(!g.failed && arcHeatToday(g)){ soulHit(g, ARC_HEAT_SOUL); report.arcHeat = true; }
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
      // CHAIN: HR heat High raises the warning bar — the review reads your file first
      const warnAt = WARN_AT + (heatOf(g, 'hr') >= HEAT_HIGH ? HR_HEAT_WARN : 0);
      if(g.failed){ /* the bill can end it */ }
      else if(g.standing >= PROMOTE_AT && g.jobIdx < LADDER.length - 1){
        g.jobIdx++; g.standing = PROMOTE_RESET; soulHit(g, PROMOTE_SOUL);
        addHeat(g, 'boss', 2);   // CHAIN: every rung up is a rung closer to his calendar
        report.promoted = true; report.newTitle = jobTitle(g);
        pushFeed(g, 1020, 'A promotion was announced. The word “journey” was used twice.');
      } else if(g.standing < warnAt){
        if(g.standing >= WARN_AT) report.hrHeatWarned = true;   // heat made the difference
        if(hasReceipt(g, 'hr_survey_metadata')){
          // the receipt defuses exactly one warning, then it's spent
          burnReceipt(g, 'hr_survey_metadata');
          report.warningDefused = true;
          if(mer) mer.counters.defused = (mer.counters.defused || 0) + 1;
          pushFeed(g, 1020, 'The warning was withdrawn after you asked, politely, about survey response IDs.');
        } else {
          soulHit(g, WARN_SOUL); report.warned = true;
          addHeat(g, 'hr', 1);   // CHAIN: warnings compound — the file grows itself now
          if(g.stats) g.stats.warnings++;
          pushFeed(g, 1020, 'Meredith created a document. The filename contains your name and the word “alignment.”');
        }
      }
    }
    // CHAIN: a perfect ship-day is "high performance" — the corner office notices
    if(!g.failed && stats.tasksTotal > 0 && stats.tasksDone >= stats.tasksTotal)
      addHeat(g, 'boss', 1);
    report.heat = { hr: heatLevel(g, 'hr'), boss: heatLevel(g, 'boss'), brad: heatLevel(g, 'brad') };
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
    // the schemes and interceptions write their own headlines
    if(brad.counters.poisonedDay === rep.day)
      return d + 'Brad presented a file he stole. Cell C9 divides by a word.';
    if((g.npcState.adam.counters || {}).grenadeDay === rep.day)
      return d + 'Adam was deployed at Dennis. It was like watching weather systems collide.';
    if(brad.counters.selfOwnDay === rep.day)
      return d + 'FINAL_v2_BRAD_PRIVATE was neither private nor final.';
    if(brad.counters.confrontDay === rep.day)
      return d + 'a raid died of eye contact at the water fountain.';
    if((g.npcState.meredith.counters || {}).cooledDay === rep.day)
      return d + 'a hypothetical question about response IDs ended a highlighting project.';
    if((g.npcState.adam.counters || {}).concernDay === rep.day)
      return d + 'a concern reached HR. It had an appendix.';
    if(boss.counters.callDay === rep.day && boss.flags.sympathetic)
      return d + 'you became the corner office’s emotional support animal.';
    if(boss.counters.callDay === rep.day)
      return d + 'a quick call was survived at async speed.';
    const priyaC = g.npcState.priya;
    if(priyaC.counters.demoDay === rep.day){
      if(priyaC.flags.backed) return d + 'you said her name in a room where it counted.';
      if(priyaC.flags.baitWon) return d + 'Brad demoed the wrong file, beautifully.';
      if(priyaC.flags.baitLost) return d + 'a file swap traced back to your login in one afternoon.';
      if(priyaC.flags.slid) return d + 'the team was thanked. The team was one person.';
      return d + 'a demo happened. The commit log knows more than the room does.';
    }
    if(g.npcState.meredith.counters.surveyDay === rep.day)
      return d + 'HR discovered anonymity has a font.';
    if(g.npcState.dennis.counters.clearDay === rep.day)
      return d + 'Dennis defended a filename like it was family land.';
    if(g.npcState.adam && g.npcState.adam.counters.usefulDay === rep.day)
      return d + 'Adam knew a guy. The guy was Dennis. It went through.';
    if(g.npcState.kayla.counters.panicDay === rep.day && g.npcState.kayla.flags.toldHR)
      return d + 'HR solved a person instead of a workload.';
    if(g.npcState.kayla.counters.panicDay === rep.day && g.npcState.kayla.flags.satWith)
      return d + 'two chairs in the kitchen. It helped.';
    if(((g.arcs || {}).kayla_presentation || {}).webinarDay === rep.day)
      return d + '“Resilience & You” ate ninety minutes of resilience.';
    if(rep.warningDefused) return d + 'a warning met a metadata screenshot and blinked first.';
    if(rep.promoted) return d + 'promoted. The bar moved. It saw you coming.';
    if(rep.warned) return d + 'HR opened a document with your name in the filename.';
    // CHAIN: an ignored Kayla lowers the bar for the dead-eyed headline
    if(rep.deadEyed >= 2 || (rep.deadEyed >= 1 && g.npcState.kayla.flags.ignored))
      return d + 'three tasks in a row without blinking. HR calls it “flow.”';
    if(rep.forgiven) return d + 'Marcus was right about Thursday.';
    if(rep.broke) return d + 'the ATM asked if you were sure.';
    return d + 'survived.';
  }
  function dayAward(g){
    const rep = g.dayReport || {};
    const brad = g.npcState.brad, boss = g.npcState.boss;
    if(brad.counters.firedDay === rep.day || brad.counters.discoveryDay === rep.day)
      return 'Main Character of the Day';
    if(brad.counters.poisonedDay === rep.day) return 'Best Supporting Saboteur';
    if((g.npcState.adam.counters || {}).grenadeDay === rep.day) return 'Regional Director of Chaos';
    if(brad.counters.confrontDay === rep.day) return 'Human Firewall';
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
    // Dennis's blocker behavior: roughly one day in four, approvals required
    g.dennisBlockerToday = arcRand(g, 'dennis', 'blocker')() < 0.25;
    if(g.dennisBlockerToday)
      pushFeed(g, 549, 'Dennis changed the approval workflow. The change requires approval. His.');
    advanceArcs(g);
    heatMorningFeed(g);   // heat tells + the Brad self-own + the legal morning
    motiveMorningFeed(g); // ambient drip: newly-crossed motive bands, capped + ordered
    g.todayCollectors = collectorsToday(g);   // traps coming to collect (≤2; empty ⇒ no rng)
    g.plan = planDay(g);
  }

  // Fire drill (a crunch, not a fire): deliver under a timer or eat a Standing hit.
  // Winning one pays a spot bonus — but only from Associate up. Interns are paid
  // in experience, which keeps the permanent-Intern money cap intact.
  const CRUNCH_WIN = 4, CRUNCH_LOSE = 10, CRUNCH_BONUS = 250;
  function applyCrunch(g, success){
    if(g.stats){ if(success) g.stats.crunchWins++; else g.stats.crunchFails++; }
    if(success) addHeat(g, 'boss', 1);   // CHAIN: deliver under pressure once, get volunteered forever
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
    g.soul = clamp(g.soul + temperSoulGain(g, COFFEE_SOUL));
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
    // SPECIFIC FAILURES: the ending names what actually killed you. Each is a
    // first-match ladder over the run's real record — shareable, not generic.
    const NPC0 = { counters: {}, flags: {} };
    const npcs = g.npcState || {};
    if(g.failed === 'standing'){
      const adam = npcs.adam || NPC0, mer = npcs.meredith || NPC0;
      if(heatOf(g, 'hr') >= HEAT_HIGH || mer.flags.truthBilled) return {
        tag:'Day '+days+' · Terminated', tone:'danger', title:'Identified by Writing Style',
        body:'The survey was anonymous; your semicolons were not. Meredith matched the paragraphs, the paragraphs attended a meeting, and the meeting decided. '+bank+' saved. Your prose remains excellent, which is what did it.'
      };
      if(((g.stats || {}).bradSteals || 0) >= 3) return {
        tag:'Day '+days+' · Terminated', tone:'danger', title:'Reassigned Into Brad’s Narrative',
        body:'Enough of your work moved into “Team Wins” that the org concluded the team could win without you. Brad presented your absence as a process improvement. '+bank+' saved, authorship pending.'
      };
      if((adam.counters.concerns || 0) + (adam.counters.intercepts || 0) >= 3) return {
        tag:'Day '+days+' · Terminated', tone:'danger', title:'Followed Up to Death',
        body:'Adam raised concerns. Then follow-ups. Then a follow-up about the follow-ups. Somewhere in that thread, your role was “clarified” out of the org chart. '+bank+' saved. Adam was not consulted about your departure, and it shows, he says.'
      };
      return {
        tag:'Day '+days+' · Terminated', tone:'danger', title:'Managed Out',
        body:'Security walked you to your car with '+bank+' saved — not your number, but yours. You kept your dignity; the org kept the ficus. On the bright side: you never have to attend the sync again.'
      };
    }
    if(g.failed === 'soul'){
      const boss = npcs.boss || NPC0, kayla = npcs.kayla || NPC0, dennis = npcs.dennis || NPC0;
      if(((g.stats || {}).comply || 0) >= 8) return {
        tag:'Day '+days+' · Congratulations (?)', tone:'danger', title:'Became the Notes Person',
        body:'You said yes to everything and now everything is yours: the notes, the trivia, the card for Gerald, the 4:57 asks. Somewhere around yes number '+(g.stats.comply)+', the person doing the agreeing stopped being you. '+bank+' saved. The notes are immaculate.'
      };
      if((boss.counters.quickCalls || 0) >= 3) return {
        tag:'Day '+days+' · Congratulations (?)', tone:'danger', title:'Promoted to Emotional Support Employee',
        body:'The quick calls were never quick and never calls. You know about the reorg, the nemesis in Finance, and the boat. He feels much better. You feel '+bank+' worth of nothing at all. The door is always open, which is the problem.'
      };
      if(kayla.flags.ignored) return {
        tag:'Day '+days+' · Congratulations (?)', tone:'danger', title:'Productivity Held',
        body:'You watched the kitchen from your desk and kept shipping. The dashboard stayed green the whole way down — hers, then yours. '+bank+' saved. The dashboard is very proud of everyone.'
      };
      if((dennis.counters.approvalsCleared || 0) >= 5) return {
        tag:'Day '+days+' · Congratulations (?)', tone:'danger', title:'Returned With Track Changes',
        body:'You answered every question Dennis had, and Dennis had all of them. Somewhere around approval nineteen, he approved the last of you, with comments. '+bank+' saved. The filename convention outlives us all.'
      };
      return {
        tag:'Day '+days+' · Congratulations (?)', tone:'danger', title:'Promoted to Middle Management',
        body:'You schedule the syncs now. You send the 4:57 asks. You say “let’s take this offline.” The '+bank+' you saved will buy things the new you enjoys. This is the real game over.'
      };
    }
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
    if(id === 'priya_demo') return g.standing >= 55 ? 0 : 1;  // back her publicly from comfort, else DM
    return 0;
  }

  // Conversation choice for the autopilot + soak. idx() THROWS on a bad key so a
  // typo fails loudly rather than silently picking choice 0. Competent play: avoid
  // trap debt, settle > pay > refuse when collected, take mentor gifts freely.
  function policyConversationChoice(g, id, scene){
    const idx = k => { const j = scene.choices.findIndex(c => c.key === k);
      if(j < 0) throw new Error('policyConversationChoice: no "' + k + '" in beat ' + scene.beat);
      return j; };
    const has = k => scene.choices.some(c => c.key === k);
    switch(scene.beat){
      case 'collect':
        if(has('settle')) return idx('settle');                 // cheapest exit — no meter loss
        return (g.soul > 40 && g.standing > 40) ? idx('pay') : idx('refuse');
      case 'bait':
        return g.soul < 30 ? idx('accept') : idx('decline');    // avoid the debt unless desperate
      case 'offer':
        if(g.standing < 55 && g.soul >= 55) return idx('defer'); // need standing, can afford soul
        if(g.soul < 40) return idx('just');                      // protect thin soul
        return idx('hedge');                                     // comfortable: neither buy nor spend
      case 'cold':
        return g.standing < 40 ? idx('capitulate') : idx('hold');
      case 'gift':
        if(has('spend') && g.soul < 50) return idx('spend');     // cash a favor when soul is low
        return idx('accept');
      default:
        return idx('just');
    }
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
    // approvals, cheapest path first: Marcus's phrase when 2+ are stuck (free
    // and instant), else batch a Pipe trip into idle time. Receipts are never
    // burned on Dennis — they're story capital.
    if(w.tasks && w.tasks.blocked >= 2 && g.npcState.marcus && g.npcState.marcus.flags.shield)
      return { type: 'dennis_tip' };
    if(w.tasks && w.tasks.blocked > 0 && w.tasks.pending === 0) return { type: 'approval' };
    return { type: 'home' };
  }

  // ---- Share copy that carries the story ----------------------------------------
  // A deterministic story-priority ladder over the run's REAL events. storyKey
  // classifies (highest interest first, per the ladder); storyLine speaks it.
  // Returns null when the run produced no story (shell falls back to plain).
  function storyKey(g){
    const brad = g.npcState.brad, boss = g.npcState.boss, kayla = g.npcState.kayla;
    const marcus = g.npcState.marcus, mer = g.npcState.meredith, priya = g.npcState.priya;
    const bossArc = (g.arcs || {}).boss_spiral || { stage: 0 };
    if(brad.flags.walkedOut || brad.flags.fired || brad.flags.burned) return 'brad_exposed';
    if(kayla.flags.satWith || kayla.flags.tookTask) return 'kayla_helped';
    if(kayla.flags.ignored) return 'kayla_ignored';
    if(hasReceipt(g, 'hr_survey_metadata')) return 'hr_metadata';
    if(bossArc.stage === 2 && (boss.counters.quickCalls || 0) > 0) return 'boss_survived';
    if((marcus.counters.saves || 0) > 0) return 'marcus_saved';
    if(priya.flags.backed || priya.flags.baited) return 'priya_backed';
    if((g.npcState.dennis.counters.approvalsCleared || 0) >= 3) return 'dennis_broken';
    if((mer.counters.defused || 0) > 0) return 'warning_defused';
    if(g.escaped && g.soul >= 50) return 'escaped_clean';
    if(g.escaped) return 'escaped_dead_inside';
    if(g.failed === 'standing') return 'managed_out';
    if(g.failed === 'soul') return 'management';
    return null;
  }
  function storyLine(g){
    const key = storyKey(g);
    const brad = g.npcState.brad;
    switch(key){
      case 'brad_exposed':
        if(brad.flags.walkedOut || brad.flags.fired)
          return 'I watched Brad get walked out at lunch for working two jobs. His deliverables are my “growth opportunity” now.';
        return 'I put Brad’s other job on the projector mid-meeting. My analysis is mine again. With interest.';
      case 'kayla_helped':
        return g.npcState.kayla.flags.satWith
          ? 'Two chairs in the kitchen the day the deck hit version 31. It helped more than the deck did.'
          : 'I quietly took a deliverable off Kayla’s stack the day everything was “fine.” No email announced it.';
      case 'kayla_ignored':
        return 'Kayla melted down in the kitchen and I kept shipping. The dashboard called it a strong day.';
      case 'hr_metadata':
        return 'Survived an anonymous survey that knew my middle name. I kept the metadata.';
      case 'warning_defused':
        return 'HR opened a warning. I asked about survey response IDs. The warning closed itself.';
      case 'boss_survived':
        return 'I survived the corner office’s personal weather system. He is more human now. The numbers are not.';
      case 'marcus_saved':
        return 'Marcus said one sentence over coffee that saved my quarter. He has seen this exact quarter before.';
      case 'priya_backed':
        if(g.npcState.priya.flags.baitWon)
          return 'Brad demoed Priya’s stolen dashboard, so I fed him a flawed file. Slide four divided by zero, live. She fixed it with her name on screen.';
        if(g.npcState.priya.flags.baitLost)
          return 'I sabotaged the demo of Priya’s stolen work. IT traced it to me in an afternoon. Worth it. Mostly.';
        return 'Brad demoed Priya’s work, so I put her name back on it in front of everyone who mattered.';
      case 'dennis_broken':
        return 'I outlasted Dennis. Approval by approval, question by question. The Pipe flows for me now.';
      case 'escaped_clean':
      case 'escaped_dead_inside':
        if(hasReceipt(g, 'screenshot_brad_deck'))
          return 'I escaped on Day ' + g.day + ' with ' + fmt(g.money) + ', ' + g.soul
            + ' Soul, and one screenshot that could end Brad’s quarter.';
        return key === 'escaped_clean'
          ? 'I hit my number, stood up, and walked out whole. Day ' + g.day + ', ' + fmt(g.money) + ', zero regrets.'
          : 'I escaped on Day ' + g.day + ' with ' + fmt(g.money) + ' and whatever was left of me. Mostly the money.';
      case 'managed_out':
        return 'Managed out on Day ' + g.day + '. HR called it a transition, which is how you know it was a firing.';
      case 'management':
        return 'Promoted to management on Day ' + g.day + '. Please do not congratulate me.';
      default:
        return null;
    }
  }
  // ---- The story collection: what this building has shown you, across runs -----
  // The brain owns the catalog and the earned-check; the SHELL owns persistence
  // (localStorage) — the brain stays storage-free. Locked hints tease, never spoil.
  const STORY_META = {
    brad_exposed:  { name: 'The Second Laptop',          hint: 'Some decks belong to other companies.' },
    kayla_helped:  { name: 'Two Chairs in the Kitchen',  hint: 'Someone is “fine.” Check anyway.' },
    kayla_ignored: { name: 'Productivity Held',          hint: 'Keep shipping. No matter what you hear from the kitchen.' },
    hr_metadata:   { name: 'Anonymity Has a Schema',     hint: 'Read the URL before you answer anything.' },
    boss_survived: { name: 'Corner Office Weather',      hint: 'Some quick calls are neither quick nor calls.' },
    marcus_saved:  { name: 'The Load-Bearing Sentence',  hint: 'Have coffee with the man who has seen everything.' },
    priya_backed:  { name: 'Say Her Name',               hint: 'The commit log knows who built it.' },
    dennis_broken: { name: 'The Pipe Flows',             hint: 'Answer every question. All nineteen. Repeatedly.' },
    escaped_clean: { name: 'Out the Door, Whole',        hint: 'The number, with your soul still attached.' },
    escaped_dead_inside: { name: 'Mostly the Money',     hint: 'Escaping and escaping intact are different jobs.' },
    managed_out:   { name: 'Transitioned',               hint: 'Standing has a floor. The floor has security.' },
    management:    { name: 'The Calls Come From Inside', hint: 'Soul has a floor too. There is a promotion down there.' },
    adam_meddled:  { name: 'Followed Up to Death',       hint: 'He was not consulted, and you will hear about it.' }
  };
  const STORY_ORDER = ['brad_exposed', 'priya_backed', 'kayla_helped', 'kayla_ignored',
    'hr_metadata', 'boss_survived', 'marcus_saved', 'dennis_broken', 'adam_meddled',
    'escaped_clean', 'escaped_dead_inside', 'managed_out', 'management'];
  // Every major outcome this run CLEARLY earned — storyKey's ladder rung first,
  // then any other rung whose condition independently holds. Ending keys always.
  function earnedStories(g){
    if(!g.over) return [];
    const brad = g.npcState.brad, kayla = g.npcState.kayla, boss = g.npcState.boss;
    const marcus = g.npcState.marcus, priya = g.npcState.priya, adam = g.npcState.adam;
    const bossArc = (g.arcs || {}).boss_spiral || { stage: 0 };
    const keys = [];
    const add = k => { if(k && STORY_META[k] && keys.indexOf(k) < 0) keys.push(k); };
    add(storyKey(g));   // the run's lead story, whatever the ladder says
    if(brad.flags.walkedOut || brad.flags.fired || brad.flags.burned) add('brad_exposed');
    if(kayla.flags.satWith || kayla.flags.tookTask) add('kayla_helped');
    if(kayla.flags.ignored) add('kayla_ignored');
    if(hasReceipt(g, 'hr_survey_metadata') || (g.npcState.meredith.counters.defused || 0) > 0
       || (g.npcState.meredith.counters.cooled || 0) > 0) add('hr_metadata');
    if(bossArc.stage === 2 && (boss.counters.quickCalls || 0) > 0) add('boss_survived');
    if((marcus.counters.saves || 0) > 0) add('marcus_saved');
    if(priya.flags.backed || priya.flags.baited || priya.flags.preBaited) add('priya_backed');
    if((g.npcState.dennis.counters.approvalsCleared || 0) >= 3) add('dennis_broken');
    if(adam && ((adam.counters.concerns || 0) > 0 || (adam.counters.grenades || 0) > 0
       || (adam.counters.intercepts || 0) >= 2)) add('adam_meddled');
    if(g.escaped && g.soul >= 50) add('escaped_clean');
    if(g.escaped && g.soul < 50) add('escaped_dead_inside');
    if(g.failed === 'standing') add('managed_out');
    if(g.failed === 'soul') add('management');
    return keys;
  }

  function shareText(g){
    const headline = g.over ? verdict(g).title : 'Still there. Still counting.';
    const story = storyLine(g);
    const lines = ['NINE TO SURVIVE — YOUR NUMBER'];
    if(story) lines.push(story);
    lines.push('Day ' + g.day + ' · ' + headline);
    lines.push('Banked ' + fmt(g.money) + ' / ' + fmt(FU_TARGET) + ' · Standing ' + g.standing + ' · Soul ' + g.soul);
    if(schemesUsed(g) >= 2)
      lines.push('Schemes run on the building: ' + schemesUsed(g) + '. The building started it.');
    if(!story) lines.push('An unremarkable tenure, which was the plan.');
    lines.push('Ungovernable. Unapologetic.');
    return lines.join('\n');
  }

  return {
    START, ENCOUNTERS, LADDER,
    FU_TARGET, DAY_ENCOUNTERS, BURN_BASE, BURN_STEP,
    PROMOTE_AT, PROMOTE_RESET, PROMOTE_SOUL, WARN_AT, WARN_SOUL, BROKE_SOUL,
    CRUNCH_WIN, CRUNCH_LOSE, CRUNCH_BONUS, COFFEE_SOUL, DECAY_S, TASK_MISS_S, WORLD_EFFECTS,
    ARC_HEAT_SOUL, arcHeatToday, SOUL_COMFORT,
    GRIND_STREAK, GRIND_SOUL,
    clamp, fmt, burnFor, soulDrainFor,
    newGame, planDay, currentEncounter, isFinalEncounter, jobTitle,
    applyChoice, advance, closeDay, nextDay, canWalkOut, walkOut, verdict,
    applyCrunch, applyCoffee, applyWorldEffect,
    NPC_IDS, ARCS, advanceArcs, worldFlagsFor,
    WANT_TYPES, NPC_WANTS, rollWant, ensureWants, rollFalseTell, FALSE_TELL_P, FALSE_TELL_IDS,
    revealBand, revealWant, motiveTell, MOTIVE_TELLS, motiveMorningFeed,
    REVEAL_FAINT, REVEAL_SHARP,
    pushFeed, moodFeed, feedWorldEvent, addReceipt, hasReceipt, burnReceipt,
    addHeat, heatOf, heatLevel, HEAT_MAX, HEAT_MED, HEAT_HIGH, HR_HEAT_WARN,
    ARC_INCIDENTS, applyIncidentChoice, extraChoicesFor, applyExtraChoice,
    BRAD_ENCS, bradOutOfPlay, bradDeckSeen, bradAllHands, bradFiredReport, bradTasksAbsorbed,
    bossSummonsDodged, bossHumanBeat, bossCatchMod,
    dennisApprovalCleared, burnReceiptForDennis, useShieldForDennis, DENNIS_BURN_ORDER,
    adamIntercepted,
    schemeUsed, schemesUsed, bradConfronted, bradFlashed, baitPlanted, bradPoisoned,
    dennisWalked, adamConcernLanded, adamRedirected, adamGrenade,
    priyaPreCollect, priyaPrePlant, coolHR,
    marcusTip, consumeCatchShield, dayHeadline, dayAward,
    kaylaSitWith, kaylaTaskTaken, kaylaSentHome, chatBonus, WATCHED_SOUL,
    storyLine, storyKey, shareText, ARC_POOL, pickArcs,
    STORY_META, STORY_ORDER, earnedStories,
    policyAction, policyCardChoice, policyIncidentChoice,
    ensureConvo, freshConvo, CONVO_TEMPLATES, CONVO_SKINS, conversationFor, applyConversationChoice,
    canSettle, collectorsToday, policyConversationChoice, brainNpcId,
    COLLECT_BASE, COLLECT_STEP, COLLECT_MAX, COLLECT_CAP, CONVO_SOUL_FLOOR, NPC_NAME
  };
})();

// browser + headless-test exposure (no-op if neither exists)
if (typeof window !== 'undefined') window.NineToSurvive = NineToSurvive;
if (typeof module !== 'undefined' && module.exports) module.exports = NineToSurvive;
