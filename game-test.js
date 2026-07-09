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
ok('third-way escapes with soul intact', third.soul >= 50, 'soul='+third.soul);
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
  for(let d = 0; d < 9; d++){
    G.nextDay(g2);
    const f = G.worldFlagsFor(g2);
    if(f.bossArcHot) return f.extraBossWalks === 1 && f.crunchBoost > 0 && f.bossSummonsAt >= 620;
  }
  return false;
})());
// npcState + arc state survive the save: snapshot mid-arc, continue both, identical
const gArc = G.newGame(13);
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

// ---- report -----------------------------------------------------------------
lines.forEach(l=>console.log(l));
console.log('');
console.log(pass+' passed, '+fail+' failed'+(fail?'  ✗':'  ✅'));
