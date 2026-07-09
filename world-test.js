#!/usr/bin/env osascript -l JavaScript
/* world-test.js — Nine to Survive OFFICE (real-time world) headless tests
 *
 *   osascript -l JavaScript world-test.js
 *
 * Loads ntos-game.js + ntos-world.js under JavaScriptCore (no DOM/canvas) and
 * asserts the real-time office: walkability/pathing, seeded staging, the task
 * economy (inbox drip, working at your desk, shipping), the threats (boss
 * floor-walks catch empty chairs; Brad raids unattended inboxes), the recovery
 * verbs (coffee/couch/chats), click-to-move, cards staged by their owner NPC,
 * and the 5 PM dayover handoff.
 */
ObjC.import('Foundation');
// run from inside the project folder: cd into it, then osascript -l JavaScript <this file>
const DIR = ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
function readFile(p){ return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(p,$.NSUTF8StringEncoding,null)); }
const G = (0,eval)(readFile(DIR+'/ntos-game.js')+'\n;NineToSurvive;');
const W = (0,eval)(readFile(DIR+'/ntos-world.js')+'\n;NtosWorld;');
W.setEncounters(G.ENCOUNTERS);

let pass=0, fail=0; const lines=[];
function ok(name, cond, extra){ (cond?pass++:fail++); lines.push((cond?'PASS  ':'FAIL  ')+name+(extra?'  ['+extra+']':'')); }

// drive step() with fixed dt until a signal of a wanted type fires (others drop)
function stepUntil(w, maxSec, types){
  let t = 0;
  while(t < maxSec){
    const s = W.step(w, 0.1);
    if(s && (!types || types.includes(s.type))) return s;
    t += 0.1;
  }
  return null;
}

// ---- 1. clock helpers ---------------------------------------------------------
ok('clockToMin: 9:03 → 543', W.clockToMin('9:03') === 543);
ok('clockToMin: 12:30 → 750', W.clockToMin('12:30') === 750);
ok('clockToMin: 4:57 → 1017', W.clockToMin('4:57') === 1017);
ok('minToClock round-trips', W.minToClock(543) === '9:03 AM' && W.minToClock(1017) === '4:57 PM');

// ---- 2. the floor -------------------------------------------------------------
const w1 = W.newDay(7, 1, [0, 9]);
ok('every cast spot is walkable', W.CAST.every(c => W.isWalkable(w1, c.spot.x, c.spot.y)));
const desk = W.FURNITURE[0];
ok('furniture tiles are blocked', !W.isWalkable(w1, desk.x, desk.y));
ok('all 8 actors on the floor', w1.actors.length === 8 && !!W.getActor(w1, 'you'));
const you1 = W.getActor(w1, 'you');
ok('every NPC can path to your desk', W.CAST.filter(c => c.id !== 'you').every(c =>
  W.bfsPath(w1, c.spot, W.adjacentTo(w1, you1)) !== null));
ok('you start at your desk', W.playerAtDesk(w1));

// ---- 3. seeded staging ----------------------------------------------------------
ok('one card event per planned encounter', w1.events.length === 2
  && w1.events.every((e, i) => e.encIdx === [0,9][i] && e.owner === W.OWNER_BY_ENC[e.encIdx]));
ok('boss walks scheduled', w1.bossWalks.length === 2 && w1.bossWalks.every(b => b.atMin >= 600));
ok('at least one brad raid scheduled', w1.bradRaids.length >= 1);
ok('task drip: seeded load 6–10, 3 at 9:00, then spread',
  w1.tasks.total >= W.TASKS_MIN && w1.tasks.total <= W.TASKS_MAX
  && w1.tasks.spawnAt.length === w1.tasks.total
  && w1.tasks.spawnAt[0] === 540 && w1.tasks.spawnAt[3] > 540, 'total=' + w1.tasks.total);
// the load actually varies across days (seeded, not constant)
ok('task load varies day to day', (() => {
  const loads = [];
  for(let d = 1; d <= 8; d++) loads.push(W.newDay(7, d, [9]).tasks.total);
  return loads.some(l => l !== loads[0]);
})());
ok('NPCs rolled daily moods', w1.actors.filter(a => a.id !== 'you')
  .every(a => ['good','meh','bad'].includes(a.mood)));
const w1b = W.newDay(7, 1, [0, 9]);
ok('same seed+day = same moods/walks/raids/crunch',
  JSON.stringify(w1.actors.map(a => a.mood)) === JSON.stringify(w1b.actors.map(a => a.mood))
  && JSON.stringify(w1.bossWalks) === JSON.stringify(w1b.bossWalks)
  && JSON.stringify(w1.bradRaids) === JSON.stringify(w1b.bradRaids)
  && JSON.stringify(w1.crunch) === JSON.stringify(w1b.crunch));

// ---- 4. tasks: the inbox drips, work ships at your desk -------------------------
const wt = W.newDay(11, 1, [9]);   // one late card → a free morning
const spawn = stepUntil(wt, 5, ['task']);
ok('tasks land in the inbox at 9:00', !!spawn && wt.tasks.pending >= 1, 'pending=' + wt.tasks.pending);
const shipped = stepUntil(wt, 40, ['taskdone']);
ok('standing at your desk ships a task (~' + W.TASK_WORK_SECS + 's)', !!shipped && wt.tasks.done === 1,
  'done=' + wt.tasks.done);
// walk away → progress stops
const wt2 = W.newDay(11, 1, [9]);
stepUntil(wt2, 5, ['task']);
W.movePlayer(wt2, { x: 25, y: 22 });
stepUntil(wt2, 12, ['nothing']);   // drain 12s, no taskdone wanted
ok('no work ships away from the desk', wt2.tasks.done === 0 && !W.playerAtDesk(wt2), 'done=' + wt2.tasks.done);

// ---- 5. the boss walks the floor -------------------------------------------------
// at your desk = noted
const wb = W.newDay(13, 1, [9]);
wb.bossWalks = [{ atMin: 545, status: 'pending' }];
wb.bradRaids = []; wb.crunch = null;
const bpass = stepUntil(wb, 60, ['bosspass', 'bosscatch']);
ok('boss pass: you were at your desk', bpass && bpass.type === 'bosspass', bpass && bpass.type);
// empty chair = caught (bad flag mirrors his mood)
const wc = W.newDay(13, 1, [9]);
wc.bossWalks = [{ atMin: 545, status: 'pending' }];
wc.bradRaids = []; wc.crunch = null;
W.movePlayer(wc, { x: 25, y: 22 });
const bcatch = stepUntil(wc, 60, ['bosspass', 'bosscatch']);
ok('boss catch: empty chair', bcatch && bcatch.type === 'bosscatch', bcatch && bcatch.type);
ok('catch carries his mood', bcatch && bcatch.bad === (W.getActor(wc, 'boss').mood === 'bad'));
// he heads home after the walk (he may wander again later — catch the homecoming)
let bossCameHome = false;
for(let t = 0; t < 60 && !bossCameHome; t += 0.1){
  W.step(wc, 0.1);
  const b = W.getActor(wc, 'boss');
  if(Math.hypot(b.x - b.home.x, b.y - b.home.y) < 1) bossCameHome = true;
}
ok('boss goes home after the walk', bossCameHome);

// ---- 6. brad raids the inbox ------------------------------------------------------
const wr = W.newDay(17, 1, [9]);
wr.bradRaids = [{ atMin: 545, status: 'pending' }];
wr.bossWalks = []; wr.crunch = null;
stepUntil(wr, 5, ['task']);
W.movePlayer(wr, { x: 25, y: 22 });          // leave the inbox unattended
const steal = stepUntil(wr, 60, ['bradsteal', 'bradfoiled']);
ok('brad steals from an empty desk', steal && steal.type === 'bradsteal', steal && steal.type);
ok('the stolen task is gone', wr.tasks.pending === steal.pending);
const wf = W.newDay(17, 1, [9]);
wf.bradRaids = [{ atMin: 545, status: 'pending' }];
wf.bossWalks = []; wf.crunch = null;
const foil = stepUntil(wf, 60, ['bradsteal', 'bradfoiled', 'bradempty']);
ok('brad foiled when you are sitting there', foil && foil.type === 'bradfoiled', foil && foil.type);
// away AND nothing to take: its own signal, not a fake "you were sitting right there"
const wn = W.newDay(17, 1, [9]);
wn.bradRaids = [{ atMin: 545, status: 'pending' }];
wn.bossWalks = []; wn.crunch = null;
wn.tasks.spawnAt = wn.tasks.spawnAt.map(() => 1019);   // inbox stays empty all morning
W.movePlayer(wn, { x: 25, y: 22 });
const empty = stepUntil(wn, 60, ['bradsteal', 'bradfoiled', 'bradempty']);
ok('brad finds an empty desk + empty inbox → bradempty', empty && empty.type === 'bradempty',
  empty && empty.type);

// ---- 7. recovery verbs -------------------------------------------------------------
const wk = W.newDay(19, 1, [9]);
wk.bossWalks = []; wk.bradRaids = []; wk.crunch = null;
ok('coffee errand accepted once', W.goForCoffee(wk) && !W.goForCoffee(wk));
const sip = stepUntil(wk, 60, ['coffee']);
ok('coffee signal on arrival', sip && sip.type === 'coffee');
ok('couch errand accepted once', W.goForCouch(wk) && !W.goForCouch(wk));
const sat = stepUntil(wk, 60, ['couch']);
ok('couch signal on arrival', sat && sat.type === 'couch');
ok('chat request accepted for a peer', W.requestChat(wk, 'kayla'));
const chat = stepUntil(wk, 90, ['chat']);
ok('chat signal carries who + mood', chat && chat.who === 'kayla' && ['good','meh','bad'].includes(chat.mood));
ok('each peer chats once a day', !W.requestChat(wk, 'kayla') && W.requestChat(wk, 'marcus'));
ok('no chatting up the boss', !W.requestChat(wk, 'boss'));

// ---- 8. click-to-move ---------------------------------------------------------------
const wm = W.newDay(23, 1, [9]);
ok('movePlayer to open floor', W.movePlayer(wm, { x: 25, y: 22 }) === true);
ok('movePlayer refuses furniture', W.movePlayer(wm, { x: 8, y: 15 }) === false);
stepUntil(wm, 30, ['never']);
const youM = W.getActor(wm, 'you');
ok('you arrive where you clicked', Math.hypot(youM.x - 25, youM.y - 22) < 0.1);

// ---- 9. cards still fire via their owner ---------------------------------------------
const we = W.newDay(29, 1, [0, 9]);   // 9:03 boss card
we.bossWalks = []; we.bradRaids = []; we.crunch = null;
const enc = stepUntil(we, 90, ['encounter']);
ok('the 9:03 card fires when the boss arrives', enc && enc.event.encIdx === 0 && !we.running);
W.resolveEncounter(we);
ok('resolve resumes the day', we.running && we.nextEvent === 1);

// ---- 9b. zero-path arrivals (regression: the already-adjacent deadlock) ----------------
// sendTo produces an empty path when the actor already stands on the target tile;
// before the fix, such an actor never "arrived" and the day froze.
const wz = W.newDay(37, 1, [0]);        // 9:03 boss card
wz.bossWalks = []; wz.bradRaids = []; wz.crunch = null;
const bossZ = W.getActor(wz, 'boss');
bossZ.x = 8; bossZ.y = 16;              // already ON the desk-side tile the card summons to
const encZ = stepUntil(wz, 30, ['encounter']);
ok('already-adjacent owner still fires the card', !!encZ && encZ.event.encIdx === 0 && !wz.running,
  encZ ? 'fired' : 'DEADLOCK');
W.resolveEncounter(wz);
ok('resolve after zero-path arrival still works', wz.running && wz.nextEvent === 1);
const wz2 = W.newDay(37, 1, [9]);
wz2.bossWalks = [{ atMin: 545, status: 'pending' }];
wz2.bradRaids = []; wz2.crunch = null;
const bossZ2 = W.getActor(wz2, 'boss');
bossZ2.x = 8; bossZ2.y = 16;            // already on the patrol target tile
const passZ = stepUntil(wz2, 30, ['bosspass', 'bosscatch']);
ok('already-adjacent boss patrol still resolves', !!passZ, passZ ? passZ.type : 'DEADLOCK');

// ---- 9c. the walkout is a door ----------------------------------------------------------
const wx = W.newDay(41, 1, [9]);
wx.bossWalks = []; wx.bradRaids = []; wx.crunch = null;
ok('exit door tiles are blocked furniture', !W.isWalkable(wx, 0, 16) && W.isExitAt(0, 17));
ok('door refuses the unarmed', W.goForExit(wx) === false);
W.armWalkout(wx);
ok('armed door accepts the walk', wx.walkoutArmed && W.goForExit(wx) === true);
const wo = stepUntil(wx, 60, ['walkout']);
ok('reaching the door emits the walkout signal', wo && wo.type === 'walkout');

// ---- 10. 5 PM hands the day to the rules ----------------------------------------------
const wd = W.newDay(31, 1, []);
wd.bossWalks = []; wd.bradRaids = []; wd.crunch = null;
wd.clockMin = 1015;
const over = stepUntil(wd, 30, ['dayover']);
ok('dayover fires at 5 PM with the day\'s stats', over && over.type === 'dayover'
  && typeof over.tasksDone === 'number' && over.tasksTotal === wd.tasks.total);
ok('dayover fires only once', stepUntil(wd, 5, ['dayover']) === null);

// ---- 11. picking + status --------------------------------------------------------------
const boss1 = W.getActor(w1, 'boss');
ok('pickActorAt finds the boss at his spot', W.pickActorAt(w1, boss1.x, boss1.y) === boss1);
ok('pickActorAt misses empty floor', W.pickActorAt(w1, 26, 24) === null);
const st = W.statusOf(w1, boss1);
ok('status has name/role/mood/line', st.name === 'The Boss' && !!st.role && !!st.mood && !!st.line);
ok('peers offer chat in status; boss does not', W.statusOf(w1, W.getActor(w1, 'kayla')).chat === true
  && W.statusOf(w1, boss1).chat === false);

// ---- 11b. the Brad arc, staged physically ----------------------------------------------
// clue flags: the second laptop is a flag the renderer reads; the status line shifts
const wArc = W.newDay(43, 3, [0, 9], { bradLaptop: true, bradCalls: true });
ok('flags ride the world object', wArc.flags.bradLaptop && wArc.flags.bradCalls);
const bradA = W.getActor(wArc, 'brad');
const stArc = W.statusOf(wArc, bradA);
ok('status popup shifts while he moonlights', /On a call/.test(stArc.line) && stArc.chat === false);
// stairwell trips: his idle wandering now detours to the stairs
ok('he makes stairwell trips at odd intervals', (() => {
  const w2 = W.newDay(47, 3, [9], { bradCalls: true });
  w2.bossWalks = []; w2.bradRaids = []; w2.crunch = null;
  for(let t = 0; t < 200; t += 0.1){
    W.step(w2, 0.1);
    const b = W.getActor(w2, 'brad');
    if(Math.hypot(b.x - W.STAIRS_SPOT.x, b.y - W.STAIRS_SPOT.y) < 0.8) return true;
  }
  return false;
})());
// the deck detour: his route passes your desk and the world announces the slip
const wDeck = W.newDay(51, 4, [9], { bradDeckAt: 560 });
wDeck.bossWalks = []; wDeck.bradRaids = []; wDeck.crunch = null;
const deckSig = stepUntil(wDeck, 90, ['braddeck']);
ok('deck detour fires the braddeck signal near your desk', !!deckSig && (() => {
  const b = W.getActor(wDeck, 'brad');
  const you = W.getActor(wDeck, 'you');
  return Math.hypot(b.x - you.home.x, b.y - you.home.y) < 2.5;
})());
// raid schedule actually changes with the arc
ok('noBradRaids flag: zero raids staged', W.newDay(43, 5, [9], { noBradRaids: true }).bradRaids.length === 0);
ok('same seed+day without the flag: raids exist', W.newDay(43, 5, [9]).bradRaids.length >= 1);
const wGone = W.newDay(43, 6, [0], { bradGone: true });
ok('bradGone: off the floor entirely, no raids', wGone.actors.length === 7
  && !W.getActor(wGone, 'brad') && wGone.bradRaids.length === 0);
ok('the floor still paths without him', W.CAST.filter(c => c.id !== 'you' && c.id !== 'brad')
  .every(c => W.bfsPath(wGone, c.spot, W.adjacentTo(wGone, W.getActor(wGone, 'you'))) !== null));

// ---- 11c. arc incidents fire like cards --------------------------------------------------
const wInc = W.newDay(53, 5, [0], { incidents: [{ id: 'brad_discovery', owner: 'brad', atMin: 560 }] });
wInc.bossWalks = []; wInc.bradRaids = []; wInc.crunch = null;
ok('incident joins the event queue in clock order', wInc.events.length === 2
  && wInc.events[0].kind === 'card' && wInc.events[1].kind === 'incident');
const cardSig = stepUntil(wInc, 90, ['encounter']);
ok('the 9:03 card still fires first', !!cardSig && cardSig.event.encIdx === 0);
W.resolveEncounter(wInc);
const incSig = stepUntil(wInc, 120, ['arcincident']);
ok('the incident fires when Brad arrives, world paused', !!incSig && incSig.id === 'brad_discovery' && !wInc.running);
W.resolveEncounter(wInc);
ok('resolving the incident resumes the day', wInc.running && wInc.nextEvent === 2);
ok('incidents gate 5 PM like cards', (() => {
  const w2 = W.newDay(53, 5, [], { incidents: [{ id: 'brad_discovery', owner: 'brad', atMin: 1015 }] });
  w2.bossWalks = []; w2.bradRaids = []; w2.crunch = null;
  w2.clockMin = 1010;
  const s = stepUntil(w2, 60, ['arcincident', 'dayover']);
  return s && s.type === 'arcincident';   // the card comes before the day may end
})());

// ---- 11d. the firing: a world event you can watch ----------------------------------------
const wFire = W.newDay(57, 8, [], { bradFiredToday: true, noBradRaids: true });
wFire.bossWalks = []; wFire.crunch = null;
const totalBefore = wFire.tasks.total;   // only the firing may change the day's total
const sAll = stepUntil(wFire, 200, ['bradallhands']);
ok('11:30: he joins the all-hands from the wrong company', !!sAll && wFire.clockMin >= 690);
const sFired = stepUntil(wFire, 400, ['bradfired']);
ok('noon-ish: Meredith collects him, walks him to the door', !!sFired, sFired ? 'fired' : 'NO SIGNAL');
const sTasks = stepUntil(wFire, 5, ['bradtasks']);
ok('his desk empties onto yours: +2 tasks, “growth opportunity”', !!sTasks
  && wFire.tasks.total === totalBefore + 2);
ok('he is off the floor, not clickable', W.getActor(wFire, 'brad').off === true
  && W.pickActorAt(wFire, W.getActor(wFire, 'brad').x, W.getActor(wFire, 'brad').y) !== W.getActor(wFire, 'brad'));
const sOver = stepUntil(wFire, 400, ['dayover']);
ok('the firing never strands the day: 5 PM still arrives', !!sOver && sOver.type === 'dayover');

// ---- 11e. the Boss spiral, staged --------------------------------------------------------
ok('arc-hot day stages an extra floor walk', W.newDay(61, 9, [9], { extraBossWalks: 1 }).bossWalks.length === 3);
ok('crunch boost raises the odds (boost 1 = certainty)', !!W.newDay(61, 9, [9], { crunchBoost: 1 }).crunch);
const wSum = W.newDay(61, 9, [], { bossSummonsAt: 560 });
wSum.bossWalks = []; wSum.bradRaids = []; wSum.crunch = null;
const sumSig = stepUntil(wSum, 30, ['summons']);
ok('the summons announces itself at its minute', !!sumSig && wSum.summons.status === 'open');
ok('status popup offers the quick call while open', W.statusOf(wSum, W.getActor(wSum, 'boss')).quickcall === true);
ok('goForBossCall walks you over', W.goForBossCall(wSum) === true);
const qcSig = stepUntil(wSum, 90, ['quickcall']);
ok('arrival at the corner office opens the call, world paused', !!qcSig && !wSum.running
  && wSum.summons.status === 'taken');
W.resolveQuickCall(wSum);
ok('resolving the call resumes the day', wSum.running && wSum.summons.status === 'done');
const wMiss = W.newDay(61, 10, [], { bossSummonsAt: 560 });
wMiss.bossWalks = []; wMiss.bradRaids = []; wMiss.crunch = null;
stepUntil(wMiss, 30, ['summons']);
const missSig = stepUntil(wMiss, 60, ['summonsmissed']);
ok('an unanswered summons expires after 90 game-min', !!missSig && wMiss.summons.status === 'missed'
  && wMiss.clockMin >= 650);
// the human beat: cross his path off-schedule while the arc is hot
const wHum = W.newDay(61, 9, [], { bossArcHot: true });
wHum.bossWalks = []; wHum.bradRaids = []; wHum.crunch = null;
W.movePlayer(wHum, { x: 33, y: 6 });   // wander over toward the corner office
const humSig = stepUntil(wHum, 60, ['bosshuman']);
ok('crossing his path off-schedule fires the human beat, once', !!humSig
  && wHum.bossHumanDone && stepUntil(wHum, 20, ['bosshuman']) === null);

// ---- 11f. Kayla's panic day, staged spatially --------------------------------------------
const wK = W.newDay(71, 7, [], { kaylaPanic: true });
wK.bossWalks = []; wK.bradRaids = []; wK.crunch = null;
const kayK = W.getActor(wK, 'kayla');
ok('she is in the kitchen and staying there', Math.hypot(kayK.x - 24, kayK.y - 12) < 0.1 && kayK.pinned === true);
const stK = W.statusOf(wK, kayK);
ok('her status carries the physical options', /version 31/.test(stK.line)
  && stK.sitWith === true && stK.kaylatask === true);
ok('Meredith\'s popup offers the worst helpful option', W.statusOf(wK, W.getActor(wK, 'hr')).reportkayla === true);
// sitting with her rides the chat errand
ok('sit-with rides the chat errand', W.requestChat(wK, 'kayla') === true);
const sitSig = stepUntil(wK, 90, ['chat']);
ok('arrival emits the chat signal (shell routes it to sit-with)', !!sitSig && sitSig.who === 'kayla');
// taking a task moves one onto your stack
const wK2 = W.newDay(71, 7, [], { kaylaPanic: true });
wK2.bossWalks = []; wK2.bradRaids = []; wK2.crunch = null;
const totK = wK2.tasks.total;
ok('takeKaylaTask walks you over', W.takeKaylaTask(wK2) === true);
const ktSig = stepUntil(wK2, 90, ['kaylatask']);
ok('her subplot lands on your stack: +1 task', !!ktSig && wK2.tasks.total === totK + 1
  && W.takeKaylaTask(wK2) === false);
// telling HR: Meredith collects her; she is sent home, visibly
const wK3 = W.newDay(71, 7, [], { kaylaPanic: true });
wK3.bossWalks = []; wK3.bradRaids = []; wK3.crunch = null;
ok('reportKayla dispatches Meredith', W.reportKayla(wK3) === true && W.reportKayla(wK3) === false);
const shSig = stepUntil(wK3, 200, ['kaylasenthome']);
ok('Kayla is walked to the door and off the floor', !!shSig && W.getActor(wK3, 'kayla').off === true);
const overK = stepUntil(wK3, 400, ['dayover']);
ok('sending her home never strands the day', !!overK);
// the webinar eats task time, mechanically
const wW = W.newDay(73, 8, [], { webinarUntil: 630 });
wW.bossWalks = []; wW.bradRaids = []; wW.crunch = null;
const webSig = stepUntil(wW, 5, ['webinar']);
ok('the webinar announces itself at 9:00', !!webSig && webSig.until === 630);
stepUntil(wW, 27, ['taskdone']);   // ~28 real sec ≈ 90 game-min at the desk
ok('no tasks ship during Resilience & You', wW.tasks.done === 0 && wW.clockMin < 632, 'clock=' + wW.clockMin.toFixed(0));
const afterSig = stepUntil(wW, 60, ['taskdone']);
ok('work resumes when the webinar ends', !!afterSig && wW.clockMin >= 630);

// ---- 12. SOAK: full careers through the real pipeline ---------------------------------
// A bot plays whole days exactly the way the shell does: newDay each morning,
// step(w, 0.1) in a loop, signals fed into the rules, closeDay at 5 PM, nextDay.
// Asserts per day: 5 PM reached within a hard step cap, no actor stuck >60 sim-sec
// in a non-idle state with an empty path, no exceptions. Two policies:
//   desk-only — player never leaves the desk (the brief's bot)
//   recovery  — coffee/couch/chats when soul dips (exercises errands + threats)
function soakRun(seed, opts){
  opts = opts || {};
  const maxDays = opts.maxDays || 200;
  const recover = !!opts.recover;
  const issues = [];
  const g = G.newGame(seed);
  while(!g.over && g.day <= maxDays){
    const flags = G.worldFlagsFor(g);
    const w = W.newDay(seed, g.day, g.plan, flags);
    G.moodFeed(g, w.actors.map(a => ({ id: a.id, mood: a.mood })));   // as the shell does
    const stuck = {};
    // arc-day bookkeeping: staged story beats must all land before 5 PM
    const incidentsStaged = flags.incidents.length;
    let incidentsFired = 0, firedSeen = false;
    let steps = 0, dayDone = false, triedCoffee = false, triedCouch = false, triedChat = false;
    while(!dayDone && !g.over){
      if(++steps > 20000){
        issues.push('day ' + g.day + ': step cap exceeded (clock=' + w.clockMin.toFixed(1)
          + ' events=' + w.events.map(e => e.status).join(',') + ')');
        return { g, issues };
      }
      let s = null;
      try { s = W.step(w, 0.1); }
      catch(err){ issues.push('day ' + g.day + ': exception ' + err); return { g, issues }; }
      // stuck-actor watchdog (mirrors the shell watchdog's definition)
      w.actors.forEach(a => {
        const isStuck = a.path.length === 0 && a.state !== 'idle' && a.state !== 'atPlayer';
        stuck[a.id] = isStuck ? (stuck[a.id] || 0) + 0.1 : 0;
        if(stuck[a.id] > 60){
          issues.push('day ' + g.day + ': actor ' + a.id + ' stuck in "' + a.state + '" 60s');
          stuck[a.id] = -1e9;   // report once per day
        }
      });
      // player policy
      if(w.running){
        if(recover){
          if(!triedCoffee && w.clockMin >= 630){ triedCoffee = true; W.goForCoffee(w); }
          if(!triedCouch && w.clockMin >= 780 && g.soul < 60){ triedCouch = true; W.goForCouch(w); }
          if(!triedChat && w.clockMin >= 870 && g.soul < 60){
            triedChat = true; W.requestChat(w, ['kayla','marcus','priya'][g.day % 3]);
          }
        }
        if(!w.playerErrand && !W.playerAtDesk(w)){
          const you = W.getActor(w, 'you');
          if(!you.path.length) W.playerGoHome(w);
        }
      }
      if(!s) continue;
      switch(s.type){
        case 'encounter':
          G.applyChoice(g, 2);
          if(G.advance(g) === 'gameover'){ dayDone = true; break; }
          W.resolveEncounter(w); break;
        case 'arcincident':
          // rotate the branch by day so the soak exercises every choice
          incidentsFired++;
          G.applyIncidentChoice(g, s.id,
            (g.day + seed) % G.ARC_INCIDENTS[s.id].choices.length, Math.floor(w.clockMin));
          if(g.over){ dayDone = true; break; }
          W.resolveEncounter(w); break;
        case 'braddeck':    G.bradDeckSeen(g, Math.floor(w.clockMin)); break;
        case 'bradallhands':G.bradAllHands(g, Math.floor(w.clockMin)); break;
        case 'bradfired':   firedSeen = true; G.bradFiredReport(g, Math.floor(w.clockMin)); break;
        case 'bradtasks':   G.bradTasksAbsorbed(g, Math.floor(w.clockMin)); break;
        case 'summons':
          if((seed + g.day) % 2 === 0) W.goForBossCall(w);   // odd parity: dodge it
          break;
        case 'quickcall':
          G.applyIncidentChoice(g, 'boss_quick_call', g.day % 2, Math.floor(w.clockMin));
          if(g.over){ dayDone = true; break; }
          W.resolveQuickCall(w); W.playerGoHome(w); break;
        case 'summonsmissed': G.bossSummonsDodged(g, Math.floor(w.clockMin)); break;
        case 'bosshuman':
          if(G.bossHumanBeat(g, Math.floor(w.clockMin))) G.applyWorldEffect(g, 'bossHuman');
          break;
        case 'crunch':
          G.applyCrunch(g, true);
          if(g.over){ dayDone = true; break; }
          W.resolveCrunch(w); break;
        case 'taskdone':   G.applyWorldEffect(g, 'taskDone'); break;
        case 'bosspass':   G.applyWorldEffect(g, 'bossPass'); break;
        case 'bosscatch':  G.applyWorldEffect(g, s.bad ? 'bossCatchBad' : 'bossCatch'); break;
        case 'bradsteal':  G.applyWorldEffect(g, 'bradSteal'); break;
        case 'bradfoiled': G.applyWorldEffect(g, 'bradFoiled'); break;
        case 'coffee':     G.applyCoffee(g); W.playerGoHome(w); break;
        case 'couch':      G.applyWorldEffect(g, 'couch'); W.playerGoHome(w); break;
        case 'chat':
          if(s.who === 'kayla' && w.flags.kaylaPanic && G.kaylaSitWith(g, Math.floor(w.clockMin))){
            W.playerGoHome(w); break;                                      // as the shell does
          }
          G.applyWorldEffect(g, s.mood === 'good' ? 'chatGood' : s.mood === 'bad' ? 'chatBad' : 'chatMeh');
          G.chatBonus(g, s.who);
          if(s.who === 'marcus') G.marcusTip(g, Math.floor(w.clockMin));   // as the shell does
          W.playerGoHome(w); break;
        case 'kaylatask':     G.kaylaTaskTaken(g, Math.floor(w.clockMin)); W.playerGoHome(w); break;
        case 'kaylasenthome': G.kaylaSentHome(g, Math.floor(w.clockMin)); break;
        case 'webinar': break;
        case 'dayover': {
          // arcs must never deadlock or strand a day's staged story beats
          if(incidentsFired < incidentsStaged)
            issues.push('day ' + g.day + ': ' + (incidentsStaged - incidentsFired) + ' staged incident(s) never fired');
          if(flags.bradFiredToday && !firedSeen)
            issues.push('day ' + g.day + ': Brad firing staged but the walk-out never happened');
          const r = G.closeDay(g, { tasksDone: s.tasksDone, tasksTotal: s.tasksTotal });
          dayDone = true;
          if(r !== 'gameover'){
            if(G.canWalkOut(g)) G.walkOut(g);
            else G.nextDay(g);
          }
          break;
        }
      }
      if(g.over) dayDone = true;
    }
  }
  return { g, issues };
}

// the feed is deterministic through the real pipeline: two identical careers,
// identical office gossip (the run above ends on some day with a full feed)
const feedA = soakRun(4321, { recover: true });
const feedB = soakRun(4321, { recover: true });
ok('same seed = same feed, end to end', feedA.g.day === feedB.g.day
  && JSON.stringify(feedA.g.feed) === JSON.stringify(feedB.g.feed)
  && feedA.g.feed.length > 0, feedA.g.feed.length + ' lines on day ' + feedA.g.day);

const SOAK_SEEDS = 50;
function soakSweep(recover){
  const out = { issues: [], outcomes: { escaped:0, soul:0, standing:0, timeout:0 }, escapeDays: [] };
  for(let sd = 1; sd <= SOAK_SEEDS; sd++){
    const r = soakRun(sd * 1000 + 7, { recover });
    out.issues = out.issues.concat(r.issues);
    if(r.g.escaped){ out.outcomes.escaped++; out.escapeDays.push(r.g.day); }
    else if(r.g.failed) out.outcomes[r.g.failed]++;
    else out.outcomes.timeout++;
  }
  out.escapeDays.sort((a, b) => a - b);
  return out;
}
const soakA = soakSweep(false);
ok('soak/desk-only ×' + SOAK_SEEDS + ': no hangs, no stuck actors, no exceptions',
  soakA.issues.length === 0, soakA.issues.slice(0, 3).join(' | '));
ok('soak/desk-only: every career terminal', soakA.outcomes.timeout === 0, JSON.stringify(soakA.outcomes));
// dead-eyed productivity: pure desk-camping must not escape (the grind collects)
ok('soak/desk-only: camping the desk with zero recovery never escapes',
  soakA.outcomes.escaped === 0, JSON.stringify(soakA.outcomes));
const soakB = soakSweep(true);
ok('soak/recovery ×' + SOAK_SEEDS + ': no hangs, no stuck actors, no exceptions',
  soakB.issues.length === 0, soakB.issues.slice(0, 3).join(' | '));
ok('soak/recovery: every career terminal', soakB.outcomes.timeout === 0, JSON.stringify(soakB.outcomes));
lines.push('INFO  desk-only outcomes: ' + JSON.stringify(soakA.outcomes));
lines.push('INFO  recovery outcomes: ' + JSON.stringify(soakB.outcomes));
lines.push('INFO  recovery escape days: ' + JSON.stringify(soakB.escapeDays));

// ---- report -----------------------------------------------------------------
lines.forEach(l=>console.log(l));
console.log('');
console.log(pass+' passed, '+fail+' failed'+(fail?'  ✗':'  ✅'));
