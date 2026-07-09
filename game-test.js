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
const DIR = '/Users/kevindriscoll/Desktop/nine to survive';
function readFile(p){ return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null)); }
const G = (0,eval)(readFile(DIR+'/ntos-game.js')+'\n;NineToSurvive;');

let pass=0, fail=0; const lines=[];
function ok(name, cond, extra){ (cond?pass++:fail++); lines.push((cond?'PASS  ':'FAIL  ')+name+(extra?'  ['+extra+']':'')); }

// ---- 1. content integrity ---------------------------------------------------
ok('ten encounters in the pool', G.ENCOUNTERS.length === 10, 'got '+G.ENCOUNTERS.length);
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
const gb = G.newGame(3); gb.day=22; gb.week=5; gb.money=10; gb.soul=63;
G.closeDay(gb, {tasksDone:8, tasksTotal:8});
ok('overdraft: money floors at 0, soul −'+G.BROKE_SOUL,
  gb.money===0 && gb.dayReport.broke && gb.soul === 63 - G.soulDrainFor(5) - G.BROKE_SOUL, 'money='+gb.money+' soul='+gb.soul);

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
ok('third-way escape lands in a sane run length (12–45 days)', third.day>=12 && third.day<=45, 'day='+third.day);
ok('third-way escapes with soul intact', third.soul >= 50, 'soul='+third.soul);
// The suck-up: all the work, all the compliance, no recovery → hollowed out fast.
const suckup = runCareer(7, 0, 8, 0, 'bossPass');
ok('suck-up policy dies by soul, fast', suckup.failed==='soul' && suckup.day<=6, 'day='+suckup.day+' failed='+suckup.failed);
// The pure rebel: barely works, mouths off, gets caught away from the desk.
const rebel = runCareer(7, 1, 2, 3, 'bossCatch');
ok('pure-rebel policy never escapes', !rebel.escaped, 'day='+rebel.day+' failed='+rebel.failed);
ok('pure-rebel run is ended by the org', rebel.failed==='standing', 'failed='+rebel.failed+' day='+rebel.day);

// determinism: same seed + same policy = identical career
const rerun = runCareer(7, 2, 6, 2, 'bossPass');
ok('careers replay identically from a seed', rerun.day===third.day && rerun.money===third.money && rerun.soul===third.soul);

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

// ---- report -----------------------------------------------------------------
lines.forEach(l=>console.log(l));
console.log('');
console.log(pass+' passed, '+fail+' failed'+(fail?'  ✗':'  ✅'));
