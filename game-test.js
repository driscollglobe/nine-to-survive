#!/usr/bin/env osascript -l JavaScript
/* game-test.js — Nine to Survive headless tests
 *
 *   osascript -l JavaScript game-test.js
 *
 * Loads ntos-game.js under JavaScriptCore (no DOM) and asserts the encounter content is
 * well-formed and the deterministic career rules hold: seeded day plans, meters, money,
 * paydays, the Friday review/ladder, fail states, the walk-out win, and verdicts.
 * Ends with whole-career policy sims that assert the game's thesis is playable.
 */
ObjC.import('Foundation');
// run from inside the project folder: cd into it, then osascript -l JavaScript <this file>
const DIR = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
function readFile(p){ return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null)); }
const G = (0,eval)(readFile(DIR+'/ntos-game.js')+'\n;NineToSurvive;');

let pass=0, fail=0; const lines=[];
function ok(name, cond, extra){ (cond?pass++:fail++); lines.push((cond?'PASS  ':'FAIL  ')+name+(extra?'  ['+extra+']':'')); }

// ---- 1. content integrity ---------------------------------------------------
ok('twenty encounters in the pool', G.ENCOUNTERS.length === 20, 'got '+G.ENCOUNTERS.length);
let wellFormed = true, badField = '';
G.ENCOUNTERS.forEach((e,i)=>{
  if(!e.tag||!e.clock||!e.title||!e.scene){ wellFormed=false; badField='meta@'+i; }
  if(!Array.isArray(e.choices) || e.choices.length !== 3){ wellFormed=false; badField='choices@'+i; }
  (e.choices||[]).forEach((c,j)=>{
    if(typeof c.t!=='string'||!c.t){ wellFormed=false; badField='text@'+i+'.'+j; }
    if(typeof c.s!=='number'||typeof c.so!=='number'){ wellFormed=false; badField='delta@'+i+'.'+j; }
    if(typeof c.o!=='string'||!c.o){ wellFormed=false; badField='outcome@'+i+'.'+j; }
  });
});
ok('every encounter: title/scene + exactly 3 well-formed choices', wellFormed, badField);

// clocks are in ascending 9→5 order (pool order = clock order; planDay relies on it)
let ascending=true, prev=-1;
G.ENCOUNTERS.forEach(e=>{ const h=parseInt(e.clock,10), m=parseInt(e.clock.split(':')[1],10);
  const mins=(h<9?h+12:h)*60+m; if(mins<=prev) ascending=false; prev=mins; });
ok('encounter pool runs in ascending clock order', ascending);

// ---- 2. career constants ----------------------------------------------------
ok('ladder has 5 rungs, Intern first', G.LADDER.length===5 && G.LADDER[0].title==='Intern');
let payRises = true;
for(let i=1;i<G.LADDER.length;i++) if(G.LADDER[i].pay <= G.LADDER[i-1].pay) payRises = false;
ok('every promotion pays more', payRises);
ok('week-1 burn < intern pay (you can survive)', G.burnFor(1) < G.LADDER[0].pay);
ok('lifestyle creep: burn rises weekly', G.burnFor(4) === G.BURN_BASE + 3*G.BURN_STEP);
ok('the grind compounds: drain escalates', G.soulDrainFor(1)===1 && G.soulDrainFor(3)===2 && G.soulDrainFor(5)===3);
ok('fmt makes money readable', G.fmt(6000)==='$6,000' && G.fmt(300)==='$300');

// ---- 3. new game baseline ---------------------------------------------------
const g0 = G.newGame(42);
ok('new game starts Standing 50 / Soul 65 / $300', g0.standing===50 && g0.soul===65 && g0.money===300);
ok('new game: Day 1, Week 1, Intern, not over', g0.day===1 && g0.week===1 && g0.jobIdx===0 && !g0.over && !g0.failed && !g0.escaped);
ok('day plan has DAY_ENCOUNTERS entries', g0.plan.length === G.DAY_ENCOUNTERS, 'got '+g0.plan.length);
ok('day plan entries are distinct + clock-ordered', g0.plan.every((v,i,a)=> i===0 || v>a[i-1]));
const g0b = G.newGame(42);
ok('same seed = same day plan (deterministic)', JSON.stringify(g0.plan)===JSON.stringify(g0b.plan));

// the novelty cycle: ten 2-card days tour all twenty encounters before any repeat
const gt = G.newGame(31);
let tour = gt.plan.slice();
for(let d = 0; d < 9; d++){ G.nextDay(gt); tour = tour.concat(gt.plan); }
const fullPool = G.ENCOUNTERS.map((_, i) => i);
ok('first ten days show all twenty encounters exactly once',
  JSON.stringify(tour.slice().sort((a,b)=>a-b)) === JSON.stringify(fullPool), tour.join(','));
G.nextDay(gt);
ok('day 11 opens a fresh cycle', gt.plan.length === G.DAY_ENCOUNTERS && gt.seen.length === G.DAY_ENCOUNTERS);
ok('the tour is seed-deterministic', (() => {
  const a = G.newGame(31), b = G.newGame(31);
  for(let d = 0; d < 6; d++){
    if(JSON.stringify(a.plan) !== JSON.stringify(b.plan)) return false;
    G.nextDay(a); G.nextDay(b);
  }
  return true;
})());

// ---- 4. applyChoice moves meters + reports deltas ---------------------------
const g1 = G.newGame(1); g1.plan=[0,1,2,3]; g1.idxInDay=0;   // pin the plan for exact deltas
const r = G.applyChoice(g1, 0);   // enc0 choice0: s+8, so-6 → 58/59
ok('choice applies standing delta', g1.standing===58 && r.ds===8, 'st='+g1.standing);
ok('choice applies soul delta', g1.soul===59 && r.dso===-6, 'soul='+g1.soul);
ok('choice returns the outcome string', typeof r.outcome==='string' && r.outcome.length>0);
ok('applyChoice does not advance the day', g1.idxInDay===0);

// ---- 5. clamping + fail states ----------------------------------------------
const gc = G.newGame(1); gc.plan=[0,1,2,3]; gc.standing=97; gc.soul=3;
G.applyChoice(gc, 0);   // +8 / -6 → clamp 100 / 0
ok('standing clamps at 100', gc.standing===100, 'got '+gc.standing);
ok('soul clamps at 0 (and flags fail)', gc.soul===0 && gc.failed==='soul', 'got '+gc.soul);
const gs = G.newGame(1); gs.plan=[0,1,2,3]; gs.standing=5;
G.applyChoice(gs, 1);   // enc0 choice1: s-10 → 0 → managed out
ok('standing<=0 → failed "standing", over', gs.standing===0 && gs.failed==='standing' && gs.over);
ok('advance() after fail → gameover', G.advance(gs)==='gameover');

// ---- 6. a day: cards no longer end it — closeDay at 5 PM does ---------------
const gd = G.newGame(9); gd.plan=[0,1]; gd.idxInDay=0;
G.applyChoice(gd, 2);
ok('advance past a card → "ok"', G.advance(gd)==='ok' && gd.idxInDay===1);
G.applyChoice(gd, 2);
G.advance(gd);
const stBeforeClose = gd.standing;
ok('closeDay(full inbox) → dayend', G.closeDay(gd, {tasksDone: 8, tasksTotal: 8})==='dayend');
ok('payday: money = 300 + pay − burn', gd.money === 300 + G.LADDER[0].pay - G.burnFor(1), 'got '+gd.money);
ok('standing decays daily (the treadmill)', gd.standing === G.clamp(stBeforeClose - G.DECAY_S), 'st='+gd.standing);
ok('dayReport carries the day\'s work', gd.dayReport && gd.dayReport.tasksDone===8 && gd.dayReport.decay===G.DECAY_S);
ok('no review on a non-Friday', !gd.dayReport.promoted && !gd.dayReport.warned);
G.nextDay(gd);
ok('nextDay: Day 2, fresh plan', gd.day===2 && gd.week===1 && gd.idxInDay===0 && gd.plan.length===G.DAY_ENCOUNTERS);
// unfinished tasks cost standing at 5 PM
const gm = G.newGame(9); gm.standing = 50;
G.closeDay(gm, {tasksDone: 3, tasksTotal: 8});
ok('inbox debt: −'+G.TASK_MISS_S+' per unfinished task', gm.standing === 50 - G.DECAY_S - 5 * G.TASK_MISS_S, 'st='+gm.standing);

// ---- 7. Friday review: promotion, warning, overdraft ------------------------
// promotion: high standing at a day-5 review climbs the ladder and resets the bar
const gp = G.newGame(3); gp.day=5; gp.standing=80; gp.soul=63;
ok('review day closeDay → dayend', G.closeDay(gp, {tasksDone:8, tasksTotal:8})==='dayend');
ok('promoted: rung up, standing resets, soul pays', gp.jobIdx===1 && gp.standing===G.PROMOTE_RESET
  && gp.soul === 63 - G.soulDrainFor(1) - G.PROMOTE_SOUL, 'job='+gp.jobIdx+' st='+gp.standing+' soul='+gp.soul);
ok('promotion in the report', gp.dayReport.promoted && gp.dayReport.newTitle==='Associate');
// warning: low standing at review costs soul (the PIP energy)
const gw = G.newGame(3); gw.day=5; gw.standing=22; gw.soul=63;
G.closeDay(gw, {tasksDone:8, tasksTotal:8});
ok('low standing at review → warning, soul −'+G.WARN_SOUL,
  gw.dayReport.warned && gw.soul === 63 - G.soulDrainFor(1) - G.WARN_SOUL, 'soul='+gw.soul);
// overdraft: burn beyond pay floors money at 0 and takes soul
// (burn creep passes intern pay of $260 in week 7: 130 + 25×6 = $280)
const gb = G.newGame(3); gb.day=32; gb.week=7; gb.money=10; gb.soul=63;
G.closeDay(gb, {tasksDone:8, tasksTotal:8});
ok('overdraft: money floors at 0, soul −'+G.BROKE_SOUL,
  gb.money===0 && gb.dayReport.broke && gb.soul === 63 - G.soulDrainFor(7) - G.BROKE_SOUL, 'money='+gb.money+' soul='+gb.soul);

// ---- 7b. the world-effects economy --------------------------------------------
const ge2 = G.newGame(4);
const td = G.applyWorldEffect(ge2, 'taskDone');
ok('taskDone: Standing +2, Soul −1', td.ds===2 && td.dso===-1);
ok('bad-day boss catch bites harder', G.WORLD_EFFECTS.bossCatchBad.s < G.WORLD_EFFECTS.bossCatch.s);
ok('couch trades Standing for Soul', G.WORLD_EFFECTS.couch.s < 0 && G.WORLD_EFFECTS.couch.so > 0);
const ge3 = G.newGame(4); ge3.standing = 5;
G.applyWorldEffect(ge3, 'bossCatch');
ok('a world effect can end the run', ge3.failed==='standing' && ge3.over);
ok('unknown effect is a no-op', G.applyWorldEffect(ge2, 'nope')===null);
// dead-eyed productivity: tasks 4+ in an unbroken streak bill extra soul
const gde = G.newGame(8);
const dsos = [];
for(let i = 0; i < 5; i++) dsos.push(G.applyWorldEffect(gde, 'taskDone').dso);
ok('first ' + G.GRIND_STREAK + ' tasks cost normal soul', dsos[0] === -1 && dsos[2] === -1, dsos.join(','));
ok('tasks past the streak bill +' + G.GRIND_SOUL + ' extra', dsos[3] === -2 && dsos[4] === -2, dsos.join(','));
ok('the day counts its dead-eyed tasks', gde.deadEyedToday === 2 && gde.taskStreak === 5);
G.applyWorldEffect(gde, 'chatMeh');
ok('a chat resets the streak', gde.taskStreak === 0);
ok('post-recovery task is full price again', G.applyWorldEffect(gde, 'taskDone').dso === -1);
G.applyWorldEffect(gde, 'couch');
ok('the couch resets it too', gde.taskStreak === 0);
for(let i = 0; i < 4; i++) G.applyWorldEffect(gde, 'taskDone');
G.applyCoffee(gde);
ok('coffee resets it (via applyCoffee)', gde.taskStreak === 0);
const gde2 = G.newGame(8);
for(let i = 0; i < 4; i++) G.applyWorldEffect(gde2, 'taskDone');
G.closeDay(gde2, {tasksDone: 4, tasksTotal: 8});
ok('closeDay reports the toll', gde2.dayReport.deadEyed === 1);
G.nextDay(gde2);
ok('the night forgives: streak and toll reset', gde2.taskStreak === 0 && gde2.deadEyedToday === 0);

// run counters (feed the share card; live on g so they serialize)
const gst = G.newGame(6);
G.applyWorldEffect(gst, 'bradSteal');
G.applyCrunch(gst, true); G.applyCrunch(gst, false);
gst.day = 5; gst.standing = 20; G.closeDay(gst, {tasksDone: 8, tasksTotal: 8});
ok('run counters track steals/crunches/warnings',
  gst.stats.bradSteals===1 && gst.stats.crunchWins===1 && gst.stats.crunchFails===1 && gst.stats.warnings===1,
  JSON.stringify(gst.stats));

// ---- 8. the walk-out win -----------------------------------------------------
const ge = G.newGame(5);
ok('cannot walk out below the number', !G.canWalkOut(ge) && !G.walkOut(ge));
ge.money = G.FU_TARGET;
ok('can walk out at the number', G.canWalkOut(ge));
ok('walkOut ends the run as an escape', G.walkOut(ge) && ge.escaped && ge.over);

// ---- 9. verdicts --------------------------------------------------------------
function v(over){ return G.verdict(Object.assign({standing:50,soul:60,money:6200,day:23,failed:null,escaped:false,over:true}, over)); }
const vWhole  = v({escaped:true, soul:60});
const vHollow = v({escaped:true, soul:30});
const vFired  = v({failed:'standing', standing:0, money:1400});
const vMgmt   = v({failed:'soul', soul:0, money:2000});
ok('verdict: escape with soul ≥50 = the win', vWhole.tone==='ok' && /F-You Money/.test(vWhole.title));
ok('verdict: hollow escape', vHollow.tone==='soul' && /Out/.test(vHollow.title));
ok('verdict: managed out', vFired.tone==='danger' && /Managed Out/.test(vFired.title));
ok('verdict: promoted to management', vMgmt.tone==='danger' && /Middle Management/.test(vMgmt.title));
ok('verdicts carry the day count', /23/.test(vWhole.tag) && /23/.test(vFired.tag));
[vWhole,vHollow,vFired,vMgmt].forEach((x,i)=> ok('verdict '+i+' has tag/title/body', !!(x.tag&&x.title&&x.body)));

// ---- 10. whole-career policy sims (the thesis, playable) ----------------------
// A "day" now = 2 cards + how you actually played the floor: tasks shipped, the
// boss walk-by outcome, and how much soul you refilled (coffee/chats).
function careerLoop(g, pick, tasksDone, chats, bossOutcome, stopAfterDay){
  let guard = 0;
  while(!g.over && g.day <= (stopAfterDay || 60) && guard++ < 5000){
    for(let e = 0; e < g.plan.length && !g.over; e++){
      G.applyChoice(g, pick);
      if(G.advance(g) === 'gameover') break;
    }
    if(g.over) break;
    for(let i = 0; i < tasksDone && !g.over; i++) G.applyWorldEffect(g, 'taskDone');
    if(!g.over) G.applyWorldEffect(g, bossOutcome);
    if(!g.over) G.applyCoffee(g);
    for(let i = 0; i < chats && !g.over; i++) G.applyWorldEffect(g, 'chatMeh');
    if(g.over) break;
    if(G.closeDay(g, {tasksDone, tasksTotal: 8}) === 'gameover') break;
    if(G.canWalkOut(g)){ G.walkOut(g); break; }
    G.nextDay(g);
  }
  return g;
}
function runCareer(seed, pick, tasksDone, chats, bossOutcome){
  return careerLoop(G.newGame(seed), pick, tasksDone, chats, bossOutcome);
}
// The third way: do the work, take the breaks, hold your lines → escape whole.
const third = runCareer(7, 2, 6, 2, 'bossPass');
ok('third-way policy escapes with F-U money', third.escaped, 'day='+third.day+' $'+third.money+' failed='+third.failed);
// balance target (session 5): ~2.5-min days × escape around day 10-12 ≈ a 25-30 min win
ok('third-way escape lands in the tuned run length (8–20 days)', third.day>=8 && third.day<=20, 'day='+third.day);
// Session 9 TASK 3: this crude fixed-loop bot (2 meh chats + coffee, no couch,
// no card scoring) now lands the HOLLOW escape tier — it escapes, barely whole.
// The competent-policy sweep in world-test owns the 45–75 worn-but-whole band.
ok('third-way still escapes, now visibly worn (hollow tier)', third.escaped && third.soul > 0 && third.soul <= 75, 'soul='+third.soul);
// The suck-up: all the work, all the compliance, no recovery → hollowed out fast.
const suckup = runCareer(7, 0, 8, 0, 'bossPass');
ok('suck-up policy dies by soul, fast', suckup.failed==='soul' && suckup.day<=6, 'day='+suckup.day+' failed='+suckup.failed);
// The pure rebel: barely works, mouths off, gets caught away from the desk.
const rebel = runCareer(7, 1, 2, 3, 'bossCatch');
ok('pure-rebel policy never escapes', !rebel.escaped, 'day='+rebel.day+' failed='+rebel.failed);
ok('pure-rebel run is ended by the org', rebel.failed==='standing', 'failed='+rebel.failed+' day='+rebel.day);

// crunch spot bonuses are level-gated: Interns are paid in experience
const gcb = G.newGame(6);
const rc0 = G.applyCrunch(gcb, true);
ok('intern crunch win pays nothing', rc0.bonus === 0 && gcb.money === 300);
gcb.jobIdx = 1;
const rc1 = G.applyCrunch(gcb, true);
ok('associate+ crunch win pays the $' + G.CRUNCH_BONUS + ' spot bonus',
  rc1.bonus === G.CRUNCH_BONUS && gcb.money === 300 + G.CRUNCH_BONUS);
ok('failed crunch pays nothing at any level', G.applyCrunch(gcb, false).bonus === 0);

// the number is sized so climbing is mandatory: pin meters, block promotion,
// and even a maximally diligent permanent Intern's bank must peak below it
const gi = G.newGame(21);
let internPeak = gi.money;
for(let d = 0; d < 60 && !gi.over; d++){
  gi.standing = 50; gi.soul = 80;      // pinned: no promotion, no death — pure money math
  G.closeDay(gi, {tasksDone: 8, tasksTotal: 8});
  internPeak = Math.max(internPeak, gi.money);
  if(!gi.over) G.nextDay(gi);
}
ok('permanent Intern can never bank the number', internPeak < G.FU_TARGET, 'peak $'+internPeak);

// determinism: same seed + same policy = identical career
const rerun = runCareer(7, 2, 6, 2, 'bossPass');
ok('careers replay identically from a seed', rerun.day===third.day && rerun.money===third.money && rerun.soul===third.soul);

// ---- 10b. the display shuffle cannot bleed into the rules -----------------------
// Mimics the shell's presentation shuffle (local mulberry32 on runSeed/day/idxInDay)
// and plays "through" it by clicking the button whose data-idx is the wanted rule
// index. The career must be byte-identical to picking rule indices directly.
function shellShuffleOrder(seed, day, idxInDay, n){
  let s = ((seed | 0) ^ Math.imul(day, 2654435761) ^ Math.imul(idxInDay + 1, 40503)) | 0;
  const r = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = [];
  for(let i = 0; i < n; i++) order.push(i);
  for(let i = n - 1; i > 0; i--){
    const j = Math.floor(r() * (i + 1));
    const t2 = order[i]; order[i] = order[j]; order[j] = t2;
  }
  return order;
}
ok('shuffle order is a true permutation', shellShuffleOrder(1, 3, 1, 3).slice().sort().join('') === '012');
ok('shuffle is deterministic per card slot',
  JSON.stringify(shellShuffleOrder(9, 4, 0, 3)) === JSON.stringify(shellShuffleOrder(9, 4, 0, 3)));
const gA2 = G.newGame(77), gB2 = G.newGame(77);
for(let d = 0; d < 5 && !gA2.over; d++){
  for(let e = 0; e < gA2.plan.length; e++){
    G.applyChoice(gA2, 2); G.advance(gA2);                       // A: rules directly
    const order = shellShuffleOrder(77, gB2.day, gB2.idxInDay, 3); // B: through the display
    const displayPos = order.indexOf(2);                          // where "the third way" landed
    G.applyChoice(gB2, order[displayPos]); G.advance(gB2);        // data-idx contract → still 2
  }
  G.closeDay(gA2, {tasksDone: 8, tasksTotal: 8}); G.closeDay(gB2, {tasksDone: 8, tasksTotal: 8});
  if(!gA2.over){ G.nextDay(gA2); G.nextDay(gB2); }
}
ok('career is byte-identical with and without the display shuffle',
  JSON.stringify(gA2) === JSON.stringify(gB2));

// ---- 11. persistence: a JSON round-trip resumes identically --------------------
const gLive = G.newGame(11);
careerLoop(gLive, 2, 6, 2, 'bossPass', 8);        // play the first 8 days
ok('mid-run snapshot point is mid-run', !gLive.over && gLive.day === 9, 'day='+gLive.day);
const gSaved = JSON.parse(JSON.stringify(gLive)); // what localStorage stores
ok('round-trip preserves every field', JSON.stringify(gSaved) === JSON.stringify(gLive));
careerLoop(gLive, 2, 6, 2, 'bossPass');           // both continue on the same policy
careerLoop(gSaved, 2, 6, 2, 'bossPass');
ok('resumed career is identical to the uninterrupted one',
  gSaved.day === gLive.day && gSaved.money === gLive.money && gSaved.soul === gLive.soul
  && gSaved.standing === gLive.standing && gSaved.escaped === gLive.escaped
  && gSaved.failed === gLive.failed && gSaved.rngState === gLive.rngState,
  'day '+gSaved.day+'/'+gLive.day+' $'+gSaved.money+'/'+gLive.money);

// ---- 12. the arc engine + npcState --------------------------------------------
const ga = G.newGame(55);
ok('npcState: all seven coworkers tracked', G.NPC_IDS.length === 7 && G.NPC_IDS.every(id =>
  ga.npcState[id] && typeof ga.npcState[id].stress === 'number' && typeof ga.npcState[id].trust === 'number'
  && typeof ga.npcState[id].arcStage === 'number' && !!ga.npcState[id].flags && !!ga.npcState[id].counters));
ok('day 1: arcs dormant, world flags quiet', (() => {
  const f = G.worldFlagsFor(ga);
  return !f.bradLaptop && !f.bossArcHot && f.incidents.length === 0 && !f.bradGone;
})());
// arcs progress deterministically off the run seed, not the day-plan stream
const gA = G.newGame(55), gB = G.newGame(55);
for(let d = 0; d < 9; d++){ G.nextDay(gA); G.nextDay(gB); }
ok('same seed = identical arc state after 10 days',
  JSON.stringify(gA.arcs) === JSON.stringify(gB.arcs)
  && JSON.stringify(gA.npcState) === JSON.stringify(gB.npcState));
ok('same seed = identical feed after 10 days', JSON.stringify(gA.feed) === JSON.stringify(gB.feed));
// the arc engine must not touch the rng stream: plans match an arc-free replay
ok('arcs never move the day-plan stream', (() => {
  const withArcs = G.newGame(91), plans = [];
  for(let d = 0; d < 8; d++){ plans.push(withArcs.plan.join(',')); G.nextDay(withArcs); }
  // replay: pure planDay/rng usage with a hand-stepped day counter
  const bare = G.newGame(91), plans2 = [plans[0]];
  for(let d = 0; d < 7; d++){
    bare.day++; bare.week = Math.floor((bare.day - 1) / 5) + 1;
    plans2.push(G.planDay(bare).join(','));
  }
  return JSON.stringify(plans.slice(0, 8)) === JSON.stringify(plans2);
})());
// the Brad arc stages its clues on schedule
ok('Brad arc: laptop by day 4, clues escalate, discovery card staged', (() => {
  const g2 = G.newGame(12);
  g2.activeArcs.brad_second_job = true;
  let sawLaptop = false, sawCalls = false, sawIncident = false;
  for(let d = 0; d < 6; d++){
    G.nextDay(g2);
    const f = G.worldFlagsFor(g2);
    if(f.bradLaptop) sawLaptop = true;
    if(f.bradCalls) sawCalls = true;
    if(f.incidents.some(i => i.id === 'brad_discovery')) sawIncident = true;
  }
  return sawLaptop && sawCalls && sawIncident;
})());
// the Boss arc goes hot in week two with its pressure flags
ok('Boss arc: hot week 2+, extra walk + crunch boost + a summons', (() => {
  const g2 = G.newGame(12);
  g2.activeArcs.boss_spiral = true;
  for(let d = 0; d < 9; d++){
    G.nextDay(g2);
    const f = G.worldFlagsFor(g2);
    if(f.bossArcHot) return f.extraBossWalks === 1 && f.crunchBoost > 0 && f.bossSummonsAt >= 620;
  }
  return false;
})());
// npcState + arc state survive the save: snapshot mid-arc, continue both, identical
const gArc = G.newGame(13);
gArc.activeArcs.brad_second_job = true;
careerLoop(gArc, 2, 6, 2, 'bossPass', 6);
ok('mid-arc snapshot has live arc state', gArc.arcs.brad_second_job.stage >= 1, 'stage='+ (gArc.arcs.brad_second_job||{}).stage);
const gArcSaved = JSON.parse(JSON.stringify(gArc));
careerLoop(gArc, 2, 6, 2, 'bossPass', 12);
careerLoop(gArcSaved, 2, 6, 2, 'bossPass', 12);
ok('round-tripped npcState/arcs continue byte-identical',
  JSON.stringify(gArc) === JSON.stringify(gArcSaved));

// ---- 13. receipts ---------------------------------------------------------------
const gr = G.newGame(14);
ok('receipts start empty', gr.receipts.count === 0);
ok('addReceipt banks a named flag', G.addReceipt(gr, 'screenshot_brad_deck')
  && G.hasReceipt(gr, 'screenshot_brad_deck') && gr.receipts.count === 1);
ok('no duplicate receipts', !G.addReceipt(gr, 'screenshot_brad_deck') && gr.receipts.count === 1);
G.addReceipt(gr, 'hr_survey_metadata');
ok('burnReceipt spends it, lifetime count keeps score',
  G.burnReceipt(gr, 'screenshot_brad_deck') && !G.hasReceipt(gr, 'screenshot_brad_deck')
  && gr.receipts.count === 1 && gr.receipts.earned === 2);
ok('cannot burn what you never had', !G.burnReceipt(gr, 'dennis_approval_timestamp'));
ok('receipts JSON round-trip clean', JSON.stringify(JSON.parse(JSON.stringify(gr.receipts))) === JSON.stringify(gr.receipts));

// ---- 13b. the office feed (brain side) --------------------------------------------
const gf = G.newGame(33);
const moods = [{id:'boss',mood:'bad'},{id:'hr',mood:'good'},{id:'dennis',mood:'bad'},
               {id:'priya',mood:'bad'},{id:'kayla',mood:'meh'},{id:'marcus',mood:'good'},{id:'brad',mood:'meh'}];
ok('moodFeed posts the morning gossip', G.moodFeed(gf, moods) === true && gf.feed.length >= 1 && gf.feed.length <= 3);
ok('boss news always leads when his day is bad', gf.feed[0].text === 'The corner office calendar went private.');
const lenAfter = gf.feed.length;
ok('moodFeed runs once per morning (resume-safe)', G.moodFeed(gf, moods) === false && gf.feed.length === lenAfter);
ok('moodFeed is deterministic', (() => {
  const a = G.newGame(33), b = G.newGame(33);
  G.moodFeed(a, moods); G.moodFeed(b, moods);
  return JSON.stringify(a.feed) === JSON.stringify(b.feed);
})());
ok('quiet moods make no lines', (() => {
  const q = G.newGame(34);
  G.moodFeed(q, [{id:'boss',mood:'good'},{id:'dennis',mood:'meh'},{id:'kayla',mood:'bad'}]);
  return q.feed.length === 0;
})());
ok('feedWorldEvent: real events only', G.feedWorldEvent(gf, 'bradSteal', 700) === true
  && G.feedWorldEvent(gf, 'notAThing', 700) === false
  && gf.feed[gf.feed.length - 1].text.indexOf('Team Wins') >= 0);
ok('a warning writes the feed', (() => {
  const gw2 = G.newGame(35); gw2.day = 5; gw2.standing = 22;
  G.closeDay(gw2, { tasksDone: 8, tasksTotal: 8 });
  return gw2.feed.some(f => /alignment/.test(f.text) && f.m === 1020);
})());
ok('nextDay clears the day\'s feed', (() => {
  const gn = G.newGame(36);
  G.pushFeed(gn, 600, 'x'); G.closeDay(gn, { tasksDone: 8, tasksTotal: 8 }); G.nextDay(gn);
  return gn.feed.every(f => f.text !== 'x');
})());

// ---- 14. the Brad second-job arc: every branch ----------------------------------
// march a fresh career to the discovery morning (meters pinned so nothing dies)
function toDiscovery(seed){
  const g2 = G.newGame(seed);
  g2.activeArcs.brad_second_job = true;   // force the arc under test
  let guard = 0;
  while((g2.arcs.brad_second_job || { stage: 0 }).stage < 4 && guard++ < 12){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return g2;
}
const gd1 = toDiscovery(101);
ok('discovery morning: stage 4 + the card staged for today',
  gd1.arcs.brad_second_job.stage === 4
  && gd1.todayIncidents.some(i => i.id === 'brad_discovery' && i.owner === 'brad'
       && i.atMin >= 620 && i.atMin < 900), 'day='+gd1.day);
ok('clue flags preceded the card: laptop + calls, deck minute staged on day 3 of arc', (() => {
  const g2 = G.newGame(101);
  g2.activeArcs.brad_second_job = true;
  const seen = { laptop: false, calls: false, deck: false };
  while((g2.arcs.brad_second_job || { stage: 0 }).stage < 4){
    const f = G.worldFlagsFor(g2);
    if(f.bradLaptop) seen.laptop = true;
    if(f.bradCalls) seen.calls = true;
    if(f.bradDeckAt) seen.deck = true;
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return seen.laptop && seen.calls && seen.deck;
})());
// branch: SCREENSHOT — receipt banked, arc goes to exposed-waiting
const gScr = toDiscovery(101);
const soulBefore = gScr.soul;
const rScr = G.applyIncidentChoice(gScr, 'brad_discovery', 0, 700);
ok('screenshot: receipt banked, stage 5, outcome text', G.hasReceipt(gScr, 'screenshot_brad_deck')
  && gScr.arcs.brad_second_job.stage === 5 && /camera roll/.test(rScr.outcome)
  && gScr.soul === Math.min(100, soulBefore + (soulBefore >= G.SOUL_COMFORT ? 1 : 2)));
// branch: COVER — complicit: trust jumps, Soul pays, raids off for the run
const gCov = toDiscovery(101);
G.applyIncidentChoice(gCov, 'brad_discovery', 1, 700);
ok('cover: trust +3, covered, Soul −6, stage 8', gCov.npcState.brad.trust === 3
  && gCov.npcState.brad.flags.covered && gCov.arcs.brad_second_job.stage === 8);
ok('cover: his raids stop for the rest of the run', (() => {
  for(let d = 0; d < 6; d++){
    if(!G.worldFlagsFor(gCov).noBradRaids) return false;
    G.closeDay(gCov, { tasksDone: 8, tasksTotal: 8 });
    gCov.standing = 60; gCov.soul = 70; gCov.failed = null; gCov.over = false;
    G.nextDay(gCov);
  }
  return G.worldFlagsFor(gCov).noBradRaids && !G.worldFlagsFor(gCov).bradGone;
})());
// branch: LET IT RIDE — exposed-waiting, no receipt, no cover
const gRide = toDiscovery(101);
G.applyIncidentChoice(gRide, 'brad_discovery', 2, 700);
ok('ride: stage 5, no receipt, not covered', gRide.arcs.brad_second_job.stage === 5
  && !G.hasReceipt(gRide, 'screenshot_brad_deck') && !gRide.npcState.brad.flags.covered);
// resolution: seeded — across seeds, some runs fire him, some let the moment pass
function marchToResolution(seed){
  const g2 = toDiscovery(seed);
  G.applyIncidentChoice(g2, 'brad_discovery', 2, 700);   // let it ride
  const events = { firedDay: null, quiet: false };
  for(let d = 0; d < 8; d++){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
    const st = g2.arcs.brad_second_job.stage;
    if(st === 6 && events.firedDay == null) events.firedDay = g2.day;
    if(st === 8){ events.quiet = true; break; }
    if(st === 7) break;
  }
  return { g: g2, events };
}
let firedRuns = 0, quietRuns = 0, firedG = null;
for(let sd = 200; sd < 230; sd++){
  const r = marchToResolution(sd);
  if(r.events.firedDay != null){ firedRuns++; firedG = firedG || r.g; }
  else if(r.events.quiet) quietRuns++;
}
ok('resolution is seeded: some runs fire him, some let it pass', firedRuns > 0 && quietRuns > 0,
  firedRuns + ' fired / ' + quietRuns + ' quiet of 30');
ok('fired: flag set, gone from the floor, raids over', firedG.npcState.brad.flags.fired
  && G.worldFlagsFor(firedG).bradGone && G.worldFlagsFor(firedG).noBradRaids);
ok('fired: his cards leave the day plan', (() => {
  for(let d = 0; d < 12; d++){
    if(firedG.plan.some(i => G.BRAD_ENCS.indexOf(i) >= 0)) return false;
    G.closeDay(firedG, { tasksDone: 8, tasksTotal: 8 });
    firedG.standing = 60; firedG.soul = 70; firedG.failed = null; firedG.over = false;
    G.nextDay(firedG);
  }
  return true;
})());
ok('firing day itself plans no Brad cards (nothing to strand)', (() => {
  // stage 6 (walked out at lunch) must already bar his cards that morning
  for(let sd = 200; sd < 230; sd++){
    const g2 = toDiscovery(sd);
    G.applyIncidentChoice(g2, 'brad_discovery', 2, 700);
    for(let d = 0; d < 8; d++){
      G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
      g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
      G.nextDay(g2);
      const st = g2.arcs.brad_second_job.stage;
      if(st === 6 && g2.plan.some(i => G.BRAD_ENCS.indexOf(i) >= 0)) return false;
      if(st >= 7 || st === 8) break;
    }
  }
  return true;
})());
// the receipt play: Credit Reassigned grows a fourth choice, once
const gUse = toDiscovery(101);
G.applyIncidentChoice(gUse, 'brad_discovery', 0, 700);     // screenshot
ok('holding the receipt: Credit Reassigned offers the burn', G.extraChoicesFor(gUse, 2).length === 1
  && G.extraChoicesFor(gUse, 5).length === 0);
gUse.standing = 50; gUse.soul = 50;
const rBurn = G.applyExtraChoice(gUse, 2, 'burn_screenshot', 800);
ok('burning it reverses the theft with interest (+10/+8)', rBurn.ds === 10 && rBurn.dso === 8
  && !G.hasReceipt(gUse, 'screenshot_brad_deck'));
ok('the burn is single-use', G.extraChoicesFor(gUse, 2).length === 0
  && G.applyExtraChoice(gUse, 2, 'burn_screenshot', 800) === null);
const gNoR = toDiscovery(101);
G.applyIncidentChoice(gNoR, 'brad_discovery', 2, 700);     // no screenshot taken
ok('no receipt, no fourth choice', G.extraChoicesFor(gNoR, 2).length === 0);
ok('arc storyline is seed-deterministic end to end', (() => {
  const a = marchToResolution(207), b = marchToResolution(207);
  return JSON.stringify(a.g.arcs) === JSON.stringify(b.g.arcs)
    && JSON.stringify(a.events) === JSON.stringify(b.events);
})());

// ---- 15. the Boss personal-spiral arc ---------------------------------------------
function toBossHot(seed){
  const g2 = G.newGame(seed);
  g2.activeArcs.boss_spiral = true;   // force the arc under test
  let guard = 0;
  while(!(g2.arcs.boss_spiral && g2.arcs.boss_spiral.stage === 1) && guard++ < 15){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return g2;
}
const gHot = toBossHot(301);
ok('spiral goes hot in week two+, summons staged', gHot.day >= 6
  && G.worldFlagsFor(gHot).bossArcHot && G.worldFlagsFor(gHot).bossSummonsAt >= 620
  && G.worldFlagsFor(gHot).extraBossWalks === 1 && G.worldFlagsFor(gHot).crunchBoost > 0);
ok('baseline catch while hot but unanswered: −6', G.bossCatchMod(gHot) === 0
  && G.WORLD_EFFECTS.bossCatch.s === -6);
// SYMPATHIZE: Standing climbs, Soul pays, catches soften, summons become daily
const gSym = toBossHot(301);
gSym.standing = 50; gSym.soul = 50;
const rSym = G.applyIncidentChoice(gSym, 'boss_quick_call', 0, 700);
ok('sympathize: +3 Standing / −4 Soul, his person now', rSym.ds === 3 && rSym.dso === -4
  && gSym.npcState.boss.flags.sympathetic && gSym.npcState.boss.flags.softCatch);
ok('sympathize: catches soften (−6 → −4, bad −9 → −7)', (() => {
  const t = JSON.parse(JSON.stringify(gSym)); t.standing = 50;
  const r1 = G.applyWorldEffect(t, 'bossCatch');
  const t2 = JSON.parse(JSON.stringify(gSym)); t2.standing = 50;
  const r2 = G.applyWorldEffect(t2, 'bossCatchBad');
  return r1.ds === -4 && r2.ds === -7;
})());
ok('sympathize: the summons become daily while hot', (() => {
  G.closeDay(gSym, { tasksDone: 8, tasksTotal: 8 });
  gSym.standing = 60; gSym.soul = 70; gSym.failed = null; gSym.over = false;
  G.nextDay(gSym);
  const f = G.worldFlagsFor(gSym);
  return !f.bossArcHot || f.bossSummonsAt >= 620;   // still-hot days keep summoning
})());
// DEFLECT: the summons stop; his catches harden for the duration
const gDef = toBossHot(301);
gDef.standing = 50; gDef.soul = 50;
const rDef = G.applyIncidentChoice(gDef, 'boss_quick_call', 1, 700);
ok('deflect: −1/+2, marked, hardened', rDef.ds === -1 && rDef.dso === 2
  && gDef.npcState.boss.flags.deflected && gDef.npcState.boss.flags.hardCatch);
ok('deflect: catches harden (−6 → −8, bad −9 → −11)', (() => {
  const t = JSON.parse(JSON.stringify(gDef)); t.standing = 50;
  const r1 = G.applyWorldEffect(t, 'bossCatch');
  const t2 = JSON.parse(JSON.stringify(gDef)); t2.standing = 50;
  const r2 = G.applyWorldEffect(t2, 'bossCatchBad');
  return r1.ds === -8 && r2.ds === -11;
})());
ok('deflect: no more summons', (() => {
  G.closeDay(gDef, { tasksDone: 8, tasksTotal: 8 });
  gDef.standing = 60; gDef.soul = 70; gDef.failed = null; gDef.over = false;
  G.nextDay(gDef);
  return G.worldFlagsFor(gDef).bossSummonsAt === null;
})());
// DODGE: never going counts as an answer
const gDodge = toBossHot(301);
ok('dodging the call = deflecting it', G.bossSummonsDodged(gDodge, 800) === true
  && gDodge.npcState.boss.flags.deflected && gDodge.npcState.boss.flags.hardCatch);
ok('dodge is a no-op once answered', G.bossSummonsDodged(gSym, 800) === false);
// RESOLUTION: the arc cools, the modifiers expire with it
ok('the arc ends and the catch modifiers expire with it', (() => {
  const g2 = toBossHot(301);
  G.applyIncidentChoice(g2, 'boss_quick_call', 1, 700);       // hardened
  for(let d = 0; d < 8; d++){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
    if(g2.arcs.boss_spiral.stage === 2) break;
  }
  if(g2.arcs.boss_spiral.stage !== 2) return false;
  g2.standing = 50;
  return G.bossCatchMod(g2) === 0 && G.applyWorldEffect(g2, 'bossCatch').ds === -6
    && G.worldFlagsFor(g2).bossSummonsAt === null && !G.worldFlagsFor(g2).bossArcHot;
})());
// the human beat: once per run, words + a small mercy
const gHum = toBossHot(301);
const beat = G.bossHumanBeat(gHum, 750);
ok('human beat: a line, a feed entry, once only', typeof beat === 'string'
  && /streamlining/.test(beat) && G.bossHumanBeat(gHum, 760) === null
  && gHum.feed.some(f => /window does not have KPIs/.test(f.text)));
ok('bossHuman world effect: +2 Soul, no Standing', G.WORLD_EFFECTS.bossHuman.so === 2
  && G.WORLD_EFFECTS.bossHuman.s === 0);

// ---- 16. Marcus the survivor + headlines & awards ----------------------------------
const gM = G.newGame(401);
ok('no tips before the arc is live', G.marcusTip(gM, 700) === null);
function marchDays(g2, n){
  for(let d = 0; d < n; d++){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
}
marchDays(gM, 6);
ok('Marcus goes mentor by week two', gM.arcs.marcus_survivor.stage === 1);
const tip1 = G.marcusTip(gM, 700);
ok('a chat delivers a tip, once a day', tip1 !== null && G.marcusTip(gM, 710) === null);
ok('tips are seed-deterministic', (() => {
  const a = G.newGame(401), b = G.newGame(401);
  marchDays(a, 6); marchDays(b, 6);
  const ta = G.marcusTip(a, 700), tb = G.marcusTip(b, 700);
  return ta.kind === tb.kind && ta.text === tb.text;
})());
// the four kinds all exist in the rotation, and each does what it says
const kinds = {};
const gK = G.newGame(402);
marchDays(gK, 6);
for(let d = 0; d < 30; d++){
  const t = G.marcusTip(gK, 700);
  if(t) kinds[t.kind] = true;
  marchDays(gK, 1);
}
ok('the rotation covers help and miscalibration', kinds.miscal
  && Object.keys(kinds).length >= 3, Object.keys(kinds).join(','));
// delay: one missed task forgiven at 5 PM
const gDel = G.newGame(403);
gDel.taskForgivenessToday = true;
G.closeDay(gDel, { tasksDone: 5, tasksTotal: 8 });
ok('delay tip: a missed task is forgiven, named in the report',
  gDel.dayReport.missed === 2 && gDel.dayReport.forgiven === true
  && gDel.standing === 50 - G.DECAY_S - 2 * G.TASK_MISS_S);
G.nextDay(gDel);
ok('forgiveness does not carry overnight', gDel.taskForgivenessToday === false);
// shield: exactly one catch softened
const gSh = G.newGame(404);
gSh.npcState.marcus.flags.shield = true;
const rSh1 = G.applyWorldEffect(gSh, 'bossCatch');
const rSh2 = G.applyWorldEffect(gSh, 'bossCatch');
ok('shield tip: softens exactly one catch', rSh1.ds === -4 && rSh2.ds === -6
  && !gSh.npcState.marcus.flags.shield);
// miscal already applied −2 inside marcusTip (tested via meters)
const gMis = G.newGame(405);
marchDays(gMis, 6);
gMis.standing = 50;
let sawMiscal = false;
for(let d = 0; d < 40 && !sawMiscal; d++){
  const before = gMis.standing;
  const t = G.marcusTip(gMis, 700);
  if(t && t.kind === 'miscal'){ sawMiscal = gMis.standing === before - 2; break; }
  marchDays(gMis, 1); gMis.standing = 50;
}
ok('miscalibrated tip costs Standing −2 on the spot', sawMiscal);

// headlines + awards: drawn from the day's real events, first-match, fallback last
const gH = G.newGame(406);
G.closeDay(gH, { tasksDone: 8, tasksTotal: 8 });
ok('quiet day: plain headline, spreadsheet award', /survived\.$/.test(G.dayHeadline(gH))
  && G.dayAward(gH) === 'Best Supporting Spreadsheet');
const gH2 = G.newGame(406);
gH2.npcState.brad.counters.firedDay = 1;
G.closeDay(gH2, { tasksDone: 3, tasksTotal: 8 });
ok('the firing owns the headline and the award', /walked out holding a box/.test(G.dayHeadline(gH2))
  && G.dayAward(gH2) === 'Main Character of the Day');
const gH3 = G.newGame(406);
G.addReceipt(gH3, 'screenshot_brad_deck');
gH3.deadEyedToday = 2;
G.closeDay(gH3, { tasksDone: 3, tasksTotal: 8 });
ok('receipts outrank dead-eyed in the award order', /without blinking/.test(G.dayHeadline(gH3))
  && G.dayAward(gH3) === 'Least Legally Defensible');
const gH4 = G.newGame(406);
gH4.deadEyedToday = 1;
G.closeDay(gH4, { tasksDone: 8, tasksTotal: 8 });
ok('dead-eyed day: Most Dead Inside', G.dayAward(gH4) === 'Most Dead Inside');
ok('headline/award are pure functions of run state', G.dayHeadline(gH4) === G.dayHeadline(gH4)
  && G.dayAward(gH4) === G.dayAward(gH4));

// ---- 16b. the HR anonymous-survey incident -----------------------------------------
function toSurvey(seed){
  const g2 = G.newGame(seed);
  g2.activeArcs.hr_survey = true;   // force the arc under test
  let guard = 0;
  while(!g2.todayIncidents.some(i => i.id === 'hr_survey') && guard++ < 12){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return g2;
}
const gSv = toSurvey(601);
ok('survey day: staged by the arc, Meredith delivers, launch feed line',
  gSv.arcs.hr_survey.stage === 1
  && gSv.todayIncidents.some(i => i.id === 'hr_survey' && i.owner === 'hr')
  && gSv.feed.some(f => /font that knows your name/.test(f.text)));
// bland: safe, Soul pays
const gBl = toSurvey(601); gBl.soul = 50;
const rBl = G.applyIncidentChoice(gBl, 'hr_survey', 0, 700);
ok('bland nonsense: +1/−4, no flags', rBl.ds === 1 && rBl.dso === -4
  && !gBl.npcState.meredith.flags.truthTold && !G.hasReceipt(gBl, 'hr_survey_metadata'));
// truth: Soul up now, Standing exposure at the next review, once
const gT = toSurvey(601); gT.soul = 50;
G.applyIncidentChoice(gT, 'hr_survey', 1, 700);
ok('truth: Soul +8, marked for the review', gT.soul === 58 && gT.npcState.meredith.flags.truthTold);
gT.day = 10; gT.standing = 80;
G.closeDay(gT, { tasksDone: 8, tasksTotal: 8 });
ok('the truth attends the next review: −5 before evaluation, then never again',
  gT.dayReport.truthBill === true && gT.npcState.meredith.flags.truthBilled
  && gT.standing === G.PROMOTE_RESET,   // 80−6 decay −5 bill = 69 ≥ 68 → still promoted
  'st=' + gT.standing);
const gT2 = JSON.parse(JSON.stringify(gT));
gT2.day = 15; gT2.standing = 80; gT2.failed = null; gT2.over = false;
G.closeDay(gT2, { tasksDone: 8, tasksTotal: 8 });
ok('the bill is one-shot', gT2.dayReport.truthBill !== true);
// help a coworker: their trust climbs
const gHp = toSurvey(601);
G.applyIncidentChoice(gHp, 'hr_survey', 2, 700);
const helped = gHp.npcState.meredith.counters.helped;
ok('helping a coworker: seeded peer, trust +2', ['kayla','priya','marcus'].indexOf(helped) >= 0
  && gHp.npcState[helped].trust === 2);
// metadata: a receipt that defuses one warning
const gMd = toSurvey(601);
G.applyIncidentChoice(gMd, 'hr_survey', 3, 700);
ok('metadata banked as a receipt', G.hasReceipt(gMd, 'hr_survey_metadata'));
gMd.arcs.kayla_presentation = { stage: 3 };   // isolate: no overlapping panic-day price
gMd.day = 10; gMd.standing = 25; gMd.soul = 60;
G.closeDay(gMd, { tasksDone: 8, tasksTotal: 8 });
ok('the receipt defuses one warning and is spent', gMd.dayReport.warningDefused === true
  && !gMd.dayReport.warned && !G.hasReceipt(gMd, 'hr_survey_metadata')
  && gMd.stats.warnings === 0
  && gMd.soul === 60 - G.soulDrainFor(2) - G.ARC_HEAT_SOUL);   // survey still hot that day
gMd.day = 15; gMd.standing = 25; gMd.failed = null; gMd.over = false;
G.closeDay(gMd, { tasksDone: 8, tasksTotal: 8 });
ok('the next warning lands normally', gMd.dayReport.warned === true && gMd.stats.warnings === 1);
// the hunt: the day after, Meredith starts identifying authors
const gHu = toSurvey(601);
G.applyIncidentChoice(gHu, 'hr_survey', 0, 700);
G.closeDay(gHu, { tasksDone: 8, tasksTotal: 8 });
gHu.standing = 60; gHu.soul = 70; gHu.failed = null; gHu.over = false;
G.nextDay(gHu);
ok('stage 2: the hunt is in the feed', gHu.arcs.hr_survey.stage === 2
  && gHu.feed.some(f => /cross-referencing writing styles/.test(f.text)));
ok('survey day owns its headline', (() => {
  const g2 = toSurvey(601);
  G.applyIncidentChoice(g2, 'hr_survey', 0, 700);
  G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
  return /anonymity has a font/.test(G.dayHeadline(g2));
})());

// ---- 16c. Kayla's presentation-panic day ---------------------------------------------
function toPanic(seed){
  const g2 = G.newGame(seed);
  g2.activeArcs.kayla_presentation = true;   // force the arc under test
  let guard = 0;
  while(!G.worldFlagsFor(g2).kaylaPanic && guard++ < 12){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return g2;
}
const gP = toPanic(701);
ok('panic day staged: flag + kitchen feed lines', G.worldFlagsFor(gP).kaylaPanic
  && gP.feed.some(f => /version 31/.test(f.text))
  && gP.feed.some(f => /getting water/.test(f.text)));
// sit with her: Soul up, trust up, chats permanently better
const gPs = toPanic(701); gPs.soul = 50;
const sit = G.kaylaSitWith(gPs, 700);
ok('sitting with her: Soul +4, trust +2, bonded, once', sit.dso === 4
  && gPs.npcState.kayla.trust === 2 && gPs.npcState.kayla.flags.bonded
  && G.kaylaSitWith(gPs, 710) === null);
ok('bonded: her chats give +2 extra, forever', G.chatBonus(gPs, 'kayla') === 2
  && G.chatBonus(gPs, 'priya') === 0);
ok('not bonded: no bonus', G.chatBonus(toPanic(701), 'kayla') === 0);
G.closeDay(gPs, { tasksDone: 8, tasksTotal: 8 });
ok('helping means no dead-eyed price at 5 PM', !gPs.dayReport.watchedKayla);
// take a task: hers becomes yours
const gPt = toPanic(701); gPt.soul = 50;
const took = G.kaylaTaskTaken(gPt, 700);
ok('taking a task: +1 Soul, trust +1, once', took.dso === 1 && gPt.npcState.kayla.trust === 1
  && G.kaylaTaskTaken(gPt, 710) === null);
// tell HR: the worst helpful option
const gPh = toPanic(701); gPh.standing = 50;
const rep2 = G.kaylaSentHome(gPh, 700);
ok('telling HR: org approves (+1 Standing), she does not (trust −2)', rep2.ds === 1
  && gPh.npcState.kayla.trust === -2 && gPh.npcState.kayla.flags.toldHR);
ok('panic flag drops once she is sent home', !G.worldFlagsFor(gPh).kaylaPanic);
G.closeDay(gPh, { tasksDone: 8, tasksTotal: 8 });
gPh.standing = 60; gPh.soul = 70; gPh.failed = null; gPh.over = false;
G.nextDay(gPh);
ok('next morning: the mandatory webinar eats 9:00–10:30', G.worldFlagsFor(gPh).webinarUntil === 630
  && gPh.feed.some(f => /Resilience & You/.test(f.text)));
ok('webinar day owns its headline', (() => {
  G.closeDay(gPh, { tasksDone: 4, tasksTotal: 8 });
  return /ate ninety minutes of resilience/.test(G.dayHeadline(gPh));
})());
// keep working: the dead-eyed play, priced
const gPw = toPanic(701); gPw.soul = 50;
G.closeDay(gPw, { tasksDone: 8, tasksTotal: 8 });
ok('watching costs Soul −' + G.WATCHED_SOUL + ' at day end, named',
  gPw.dayReport.watchedKayla === true
  && gPw.soul === 50 - G.soulDrainFor(gPw.week) - G.WATCHED_SOUL - G.ARC_HEAT_SOUL,   // panic day is hot
  'soul=' + gPw.soul);
ok('helped runs pay no watch price ever after', (() => {
  const g2 = toPanic(701);
  G.kaylaSitWith(g2, 700);
  G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
  g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
  G.nextDay(g2);
  G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
  return !g2.dayReport.watchedKayla;
})());

// ---- 16d. the cost of a story: arc-heat tax -----------------------------------------
ok('a hot boss-spiral day bills Soul −' + G.ARC_HEAT_SOUL + ' at close', (() => {
  const g2 = G.newGame(651); g2.soul = 60;
  g2.arcs.boss_spiral = { stage: 1 };
  G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
  return g2.dayReport.arcHeat === true
    && g2.soul === 60 - G.soulDrainFor(1) - G.ARC_HEAT_SOUL;
})());
ok('quiet days pay no heat', (() => {
  const g2 = G.newGame(651); g2.soul = 60;
  G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
  return !g2.dayReport.arcHeat && g2.soul === 60 - G.soulDrainFor(1);
})());
ok('survey hunt days and Kayla\'s panic day are hot too', (() => {
  const a = G.newGame(651); a.arcs.hr_survey = { stage: 2 };
  const b = G.newGame(651); b.arcs.kayla_presentation = { stage: 1 };
  return G.arcHeatToday(a) && G.arcHeatToday(b);
})());
ok('recovery trims landed (couch +3, chats +3/+2)', G.WORLD_EFFECTS.couch.so === 3
  && G.WORLD_EFFECTS.chatGood.so === 3 && G.WORLD_EFFECTS.chatMeh.so === 2);
ok('above Soul ' + G.SOUL_COMFORT + ', gains halve (contentment attracts meetings)', (() => {
  const a = G.newGame(652); a.soul = 80;
  const r1 = G.applyWorldEffect(a, 'chatGood');       // +3 → +2 (ceil)
  const b = G.newGame(652); b.soul = 50;
  const r2 = G.applyWorldEffect(b, 'chatGood');       // untouched below the line
  return r1.dso === 2 && r2.dso === 3;
})());
ok('the temper never touches losses or the struggling', (() => {
  const a = G.newGame(652); a.soul = 90;
  const r1 = G.applyWorldEffect(a, 'taskDone');       // −1 stays −1
  const b = G.newGame(652); b.soul = 69;
  const r2 = G.applyWorldEffect(b, 'couch');          // +3 intact at 69
  return r1.dso === -1 && r2.dso === 3;
})());

// ---- 16e. Priya's arc: every branch ---------------------------------------------
function toDemo(seed){
  const g2 = G.newGame(seed);
  g2.activeArcs = { marcus_survivor: true, priya_credit: true };   // isolate the arc under test
  let guard = 0;
  while(!g2.todayIncidents.some(i => i.id === 'priya_demo') && guard++ < 12){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 60; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return g2;
}
const gPd = toDemo(901);
ok('the build is visible before the demo: grind flag + feed', (() => {
  const g2 = G.newGame(901);
  g2.activeArcs.priya_credit = true;
  let sawGrind = false, sawFeed = false;
  for(let d = 0; d < 10; d++){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 60; g2.failed = null; g2.over = false;
    G.nextDay(g2);
    if(G.worldFlagsFor(g2).priyaGrind) sawGrind = true;
    if(g2.feed.some(f => /commit history has no gaps/.test(f.text))) sawFeed = true;
  }
  return sawGrind && sawFeed;
})());
ok('demo day: staged with Brad presenting', gPd.arcs.priya_credit.stage === 2
  && gPd.todayIncidents.some(i => i.id === 'priya_demo' && i.owner === 'brad'));
ok('if Brad is out of play, the Boss presents', (() => {
  const g2 = G.newGame(902);
  g2.activeArcs.priya_credit = true;
  g2.npcState.brad.flags.fired = true;
  let guard = 0;
  while(!g2.todayIncidents.some(i => i.id === 'priya_demo') && guard++ < 12){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 60; g2.failed = null; g2.over = false;
    G.nextDay(g2);
  }
  return g2.todayIncidents.some(i => i.id === 'priya_demo' && i.owner === 'boss');
})());
// branch: BACK HER PUBLICLY
const gPr1 = toDemo(901); gPr1.standing = 50; gPr1.soul = 50;
const rPr1 = G.applyIncidentChoice(gPr1, 'priya_demo', 0, 800);
ok('back publicly: −3/+5, trust +3, flagged', rPr1.ds === -3 && rPr1.dso === 5
  && gPr1.npcState.priya.trust === 3 && gPr1.npcState.priya.flags.backed
  && G.storyKey(gPr1) === 'priya_backed');
// branch: DM
const gPr2 = toDemo(901); gPr2.soul = 50;
G.applyIncidentChoice(gPr2, 'priya_demo', 1, 800);
ok('DM support: trust +1, quiet', gPr2.npcState.priya.trust === 1 && gPr2.npcState.priya.flags.dmed);
// branch: COLLECT THE RECEIPT
const gPr3 = toDemo(901);
G.applyIncidentChoice(gPr3, 'priya_demo', 2, 800);
ok('collect: priya_commit_log banked', G.hasReceipt(gPr3, 'priya_commit_log')
  && gPr3.npcState.priya.flags.collected);
ok('the held receipt matters later: Credit Reassigned gains the commit-log play', (() => {
  const extras = G.extraChoicesFor(gPr3, 2);
  return extras.some(x => x.key === 'burn_commit_log');
})());
ok('burning the commit log reverses the theft and credits her', (() => {
  gPr3.standing = 50; gPr3.soul = 50;
  const r = G.applyExtraChoice(gPr3, 2, 'burn_commit_log', 820);
  return r.ds === 8 && r.dso === 6 && !G.hasReceipt(gPr3, 'priya_commit_log')
    && gPr3.npcState.priya.trust >= 2
    && G.extraChoicesFor(gPr3, 2).every(x => x.key !== 'burn_commit_log');
})());
// branch: LET IT SLIDE
const gPr4 = toDemo(901); gPr4.soul = 50;
const rPr4 = G.applyIncidentChoice(gPr4, 'priya_demo', 3, 800);
ok('let it slide: Soul −4, dead-eyed headline', rPr4.dso === -4 && gPr4.npcState.priya.flags.slid
  && (() => { G.closeDay(gPr4, { tasksDone: 8, tasksTotal: 8 });
       return /The team was one person/.test(G.dayHeadline(gPr4)); })());
// branch: BAIT — seeded, both outcomes occur across seeds
let baitWins = 0, baitLosses = 0, winG = null, loseG = null;
for(let sd = 901; sd < 941; sd++){
  const g2 = toDemo(sd); g2.standing = 50; g2.soul = 50;
  const r = G.applyIncidentChoice(g2, 'priya_demo', 4, 800);
  if(g2.npcState.priya.flags.baitWon){ baitWins++; winG = winG || { g: g2, r }; }
  else if(g2.npcState.priya.flags.baitLost){ baitLosses++; loseG = loseG || { g: g2, r }; }
}
ok('bait is seeded: both outcomes occur', baitWins > 0 && baitLosses > 0,
  baitWins + ' wins / ' + baitLosses + ' losses of 40');
ok('bait win: +8 Standing, Brad rattled, comedy in the outcome', winG.r.ds === 8
  && winG.g.npcState.brad.stress === 3 && /divides by zero/.test(winG.r.outcome));
ok('bait loss: −7 Standing, the apology deck is about you', loseG.r.ds === -7
  && /apology deck/.test(loseG.r.outcome));
ok('the aftermath thanks “the team”', (() => {
  const g2 = toDemo(901);
  G.applyIncidentChoice(g2, 'priya_demo', 0, 800);
  G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
  g2.standing = 60; g2.soul = 60; g2.failed = null; g2.over = false;
  G.nextDay(g2);
  return g2.arcs.priya_credit.stage === 3
    && g2.feed.some(f => /thanked .the team./.test(f.text));
})());

// ---- 17. share copy carries the story ------------------------------------------
const gS0 = G.newGame(501);
ok('a storyless run falls back to the plain format', G.storyLine(gS0) === null
  && /unremarkable tenure/.test(G.shareText(gS0)) && /NINE TO SURVIVE/.test(G.shareText(gS0)));
const gS1 = G.newGame(501);
gS1.npcState.brad.flags.walkedOut = true;
ok('watching the firing leads the share', /walked out at lunch for working two jobs/.test(G.shareText(gS1)));
const gS2 = G.newGame(501);
G.addReceipt(gS2, 'screenshot_brad_deck');
gS2.escaped = true; gS2.over = true; gS2.day = 12; gS2.money = 3340; gS2.soul = 42;
ok('escaping with the screenshot: the brief\'s line, from real state',
  /escaped on Day 12 with \$3,340, 42 Soul, and one screenshot/.test(G.shareText(gS2)));
const gS3 = G.newGame(501);
gS3.failed = 'standing'; gS3.over = true; gS3.day = 9;
ok('managed out: transition line', /Managed out on Day 9\. HR called it a transition/.test(G.shareText(gS3)));
const gS4 = G.newGame(501);
gS4.stats.crunchWins = 4; gS4.stats.bradSteals = 2; gS4.stats.warnings = 1;
ok('counters alone are not a story (the ladder replaced the list)',
  G.storyKey(gS4) === null && /unremarkable tenure/.test(G.shareText(gS4)));
const gS5 = G.newGame(501);
gS5.arcs.boss_spiral = { stage: 2 };
gS5.npcState.boss.counters.quickCalls = 3;
ok('surviving the spiral tells on itself', G.storyKey(gS5) === 'boss_survived'
  && /personal weather system/.test(G.shareText(gS5)));
// the ladder holds: a run with several stories leads with the highest rung
const gS6 = G.newGame(501);
gS6.npcState.kayla.flags.satWith = true;
G.addReceipt(gS6, 'hr_survey_metadata');
gS6.npcState.marcus.counters.saves = 2;
ok('priority ladder: Kayla helped outranks metadata and Marcus', G.storyKey(gS6) === 'kayla_helped');
gS6.npcState.brad.flags.fired = true;
ok('priority ladder: Brad exposed outranks everything', G.storyKey(gS6) === 'brad_exposed');
ok('share text never invents: fresh run has no arc claims', (() => {
  const t = G.shareText(G.newGame(502));
  return !/Brad/.test(t) && !/screenshot/.test(t) && !/survey/.test(t);
})());
ok('share is a pure function of g', G.shareText(gS4) === G.shareText(gS4));

// ---- 17b. arc selection: 2–3 storylines per run, the rest fully dormant ------------
ok('every run draws 2 or 3 story arcs (+ Marcus always)', (() => {
  for(let sd = 1; sd <= 40; sd++){
    const a = G.pickArcs(sd);
    const n = Object.keys(a).filter(k => k !== 'marcus_survivor').length;
    if(!a.marcus_survivor || n < 2 || n > 3) return false;
  }
  return true;
})());
ok('selection is seed-deterministic', JSON.stringify(G.pickArcs(77)) === JSON.stringify(G.pickArcs(77)));
ok('no arc appears in nearly all runs; every arc appears in some', (() => {
  const freq = {};
  const N = 80;
  for(let sd = 1; sd <= N; sd++){
    Object.keys(G.pickArcs(sd * 131 + 7)).forEach(k => { freq[k] = (freq[k] || 0) + 1; });
  }
  return G.ARC_POOL.every(p => freq[p.key] >= N * 0.2 && freq[p.key] <= N * 0.85)
    && freq.brad_second_job <= N * 0.7;
})());
ok('an undrawn arc is fully dormant: no stages, no clues, no feed', (() => {
  // find a seed where Brad's arc was not drawn
  let sd = 1;
  while(G.pickArcs(sd).brad_second_job && sd < 500) sd++;
  const g2 = G.newGame(sd);
  if(g2.activeArcs.brad_second_job) return false;
  for(let d = 0; d < 15; d++){
    G.closeDay(g2, { tasksDone: 8, tasksTotal: 8 });
    g2.standing = 60; g2.soul = 70; g2.failed = null; g2.over = false;
    G.nextDay(g2);
    const f = G.worldFlagsFor(g2);
    if(f.bradLaptop || f.bradCalls || f.bradDeckAt || f.bradFiredToday) return false;
    if(g2.todayIncidents.some(i => i.id === 'brad_discovery')) return false;
    if(g2.feed.some(l => /Brad deleted a message/.test(l.text))) return false;
  }
  return !g2.arcs.brad_second_job;
})());
ok('activeArcs serializes with the save', (() => {
  const g2 = G.newGame(909);
  const back = JSON.parse(JSON.stringify(g2));
  return JSON.stringify(back.activeArcs) === JSON.stringify(g2.activeArcs);
})());

// ---- 18. the competent policy (pure functions; consumed by movie + soak) ---------
function fakeWorld(over){
  return Object.assign({
    running: true, playerErrand: null, summons: null, flags: {},
    coffeeUsed: false, couchUsed: false, chatted: {},
    walkoutArmed: false,
    tasks: { pending: 4, done: 0, total: 8 },
    actors: [
      { id: 'you', path: [] },
      { id: 'kayla', mood: 'meh', path: [] },
      { id: 'marcus', mood: 'good', path: [] },
      { id: 'priya', mood: 'meh', path: [] }
    ]
  }, over || {});
}
const gp1 = G.newGame(801);
ok('cards are scored: enc 0 picks the third way', G.policyCardChoice(gp1, 0) === 2);
ok('cards are scored: the 4:57 ambush gets declined', G.policyCardChoice(gp1, 19) === 1);
ok('soul guard: a choice that would sink Soul under 35 is shunned', (() => {
  const t = G.newGame(801); t.soul = 32;
  const pick = G.policyCardChoice(t, 0);            // choice 0 would hit Soul 26
  return pick !== 0;
})());
ok('incident cases: screenshot unless drowning', (() => {
  const t = G.newGame(801);
  const hi = G.policyIncidentChoice(t, 'brad_discovery');
  t.soul = 20;
  return hi === 0 && G.policyIncidentChoice(t, 'brad_discovery') === 2;
})());
ok('incident cases: metadata first, help once held', (() => {
  const t = G.newGame(801);
  const first = G.policyIncidentChoice(t, 'hr_survey');
  G.addReceipt(t, 'hr_survey_metadata');
  return first === 3 && G.policyIncidentChoice(t, 'hr_survey') === 2;
})());
ok('incident cases: deflect the quick call unless Soul is comfortable', (() => {
  const t = G.newGame(801);
  t.soul = 70; const a = G.policyIncidentChoice(t, 'boss_quick_call');
  t.soul = 50; const b = G.policyIncidentChoice(t, 'boss_quick_call');
  return a === 0 && b === 1;
})());
ok('walk out the moment you can', (() => {
  const t = G.newGame(801); t.money = G.FU_TARGET;
  return G.policyAction(t, fakeWorld()).type === 'walkout';
})());
ok('never interrupt an errand (even to walk out you finish the walk)', (() => {
  const t = G.newGame(801); t.money = G.FU_TARGET;
  const a = G.policyAction(t, fakeWorld({ playerErrand: { type: 'exit' } })).type;
  const t2 = G.newGame(801);
  const b = G.policyAction(t2, fakeWorld({ playerErrand: { type: 'coffee' } })).type;
  return a === 'idle' && b === 'idle';
})());
ok('mid-walk: let it finish', (() => {
  const w2 = fakeWorld(); w2.actors[0].path = [{ x: 1, y: 1 }];
  return G.policyAction(G.newGame(801), w2).type === 'idle';
})());
ok('an open summons is answered with your feet', (() => {
  return G.policyAction(G.newGame(801), fakeWorld({ summons: { status: 'open' } })).type === 'bosscall';
})());
ok('Kayla panic is never ignored by default', (() => {
  const t = G.newGame(801);
  const a = G.policyAction(t, fakeWorld({ flags: { kaylaPanic: true } }));
  return a.type === 'chat' && a.id === 'kayla';
})());
ok('grind threshold → recovery ladder: coffee, then couch, then best chat', (() => {
  const t = G.newGame(801); t.taskStreak = G.GRIND_STREAK;
  const w2 = fakeWorld();
  const a = G.policyAction(t, w2).type;
  w2.coffeeUsed = true;
  const b = G.policyAction(t, w2).type;
  w2.couchUsed = true;
  const c = G.policyAction(t, w2);
  return a === 'coffee' && b === 'couch' && c.type === 'chat' && c.id === 'marcus';  // good mood wins
})());
ok('collapsing Soul forces recovery even off-streak', (() => {
  const t = G.newGame(801); t.soul = 30; t.taskStreak = 0;
  return G.policyAction(t, fakeWorld()).type === 'coffee';
})());
ok('nothing to fix: go be at your desk', (() => {
  return G.policyAction(G.newGame(801), fakeWorld()).type === 'home';
})());
ok('policy is pure: same inputs, same action', (() => {
  const t = G.newGame(801);
  return JSON.stringify(G.policyAction(t, fakeWorld())) === JSON.stringify(G.policyAction(t, fakeWorld()));
})());

// ---- report -----------------------------------------------------------------
lines.forEach(l=>console.log(l));
console.log('');
console.log(pass+' passed, '+fail+' failed'+(fail?'  ✗':'  ✅'));
