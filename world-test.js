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
const DIR = '/Users/kevindriscoll/Desktop/nine to survive';
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
ok('task drip: 3 at 9:00, then spread', w1.tasks.spawnAt.length === W.TASKS_PER_DAY
  && w1.tasks.spawnAt[0] === 540 && w1.tasks.spawnAt[3] > 540);
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
const bossAfter = W.getActor(wc, 'boss');
stepUntil(wc, 30, ['never']);
ok('boss goes home after the walk', Math.hypot(bossAfter.x - bossAfter.home.x, bossAfter.y - bossAfter.home.y) < 1,
  'at ' + bossAfter.x.toFixed(1) + ',' + bossAfter.y.toFixed(1));

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
const foil = stepUntil(wf, 60, ['bradsteal', 'bradfoiled']);
ok('brad foiled when you are sitting there', foil && foil.type === 'bradfoiled', foil && foil.type);

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

// ---- 10. 5 PM hands the day to the rules ----------------------------------------------
const wd = W.newDay(31, 1, []);
wd.bossWalks = []; wd.bradRaids = []; wd.crunch = null;
wd.clockMin = 1015;
const over = stepUntil(wd, 30, ['dayover']);
ok('dayover fires at 5 PM with the day\'s stats', over && over.type === 'dayover'
  && typeof over.tasksDone === 'number' && over.tasksTotal === W.TASKS_PER_DAY);
ok('dayover fires only once', stepUntil(wd, 5, ['dayover']) === null);

// ---- 11. picking + status --------------------------------------------------------------
const boss1 = W.getActor(w1, 'boss');
ok('pickActorAt finds the boss at his spot', W.pickActorAt(w1, boss1.x, boss1.y) === boss1);
ok('pickActorAt misses empty floor', W.pickActorAt(w1, 26, 24) === null);
const st = W.statusOf(w1, boss1);
ok('status has name/role/mood/line', st.name === 'The Boss' && !!st.role && !!st.mood && !!st.line);
ok('peers offer chat in status; boss does not', W.statusOf(w1, W.getActor(w1, 'kayla')).chat === true
  && W.statusOf(w1, boss1).chat === false);

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
    const w = W.newDay(seed, g.day, g.plan);
    const stuck = {};
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
          G.applyWorldEffect(g, s.mood === 'good' ? 'chatGood' : s.mood === 'bad' ? 'chatBad' : 'chatMeh');
          W.playerGoHome(w); break;
        case 'dayover': {
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
