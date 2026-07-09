/* ntos-world.js — Nine to Survive: the OFFICE (real-time isometric world)
 *
 * This is the game now, RCT-style: you drive your bear directly (click-to-move),
 * work is physical (tasks pile in your inbox; you grind them AT your desk), and
 * threats cross the floor in real time — the Boss walks by (be at your desk),
 * Brad raids your inbox (be sitting there), fire drills hit. Soul recovery is
 * spatial too: coffee, the couch, walking over to chat with a coworker. The
 * encounter cards still exist but are rare spice: their owner NPC walks to your
 * desk at the card's clock time.
 *
 * Career RULES stay in ntos-game.js; this module never touches meters. It emits
 * signals from step(w, dt) — {type:'taskdone'|'bosspass'|'bosscatch'|'bradsteal'|
 * 'bradfoiled'|'chat'|'couch'|'coffee'|'task'|'bosswalk'|'encounter'|'crunch'|
 * 'dayover'} — and the shell applies them via NineToSurvive.applyWorldEffect.
 *
 * Headless-safe like marque-world.js: pure logic over a plain world object,
 * step() decoupled from rAF, deterministic via mulberry32 on w.rngState.
 * render()/screenToTile() are the only canvas code.
 */
const NtosWorld = (() => {
'use strict';

// ── grid + projection ─────────────────────────────────────────────────────────
const GRID_W = 40, GRID_H = 26;   // a floor bigger than the screen — panning matters
const TW = 64, TH = 32;           // iso tile size at zoom 1
const WALK_SPEED = 3.2;           // tiles/sec (summoned NPCs + your errands hustle ×1.9)
const CLOCK_SPEED = 2.2;          // game-minutes per real second → a day ≈ 3.6 real min
const TASK_WORK_SECS = 11;        // real seconds at your desk to ship one task
const TASKS_PER_DAY = 8;
const CRUNCH_CHANCE = 0.45;       // odds a day contains a fire drill
const BOSS_WALKS_PER_DAY = 2;

// ── furniture: rects of blocked tiles (w×d), drawn as iso boxes ───────────────
const FURNITURE = [
  { id:'desk-you',    label:'YOUR DESK', x:8,  y:15, w:2, d:1, h:0.55, color:'#8a6f4d' },
  { id:'desk-brad',   label:null,        x:13, y:15, w:2, d:1, h:0.55, color:'#7d858f' },
  { id:'desk-kayla',  label:null,        x:8,  y:19, w:2, d:1, h:0.55, color:'#7d858f' },
  { id:'desk-marcus', label:null,        x:13, y:19, w:2, d:1, h:0.55, color:'#7d858f' },
  { id:'desk-priya',  label:null,        x:18, y:19, w:2, d:1, h:0.55, color:'#7d858f' },
  { id:'desk-boss',   label:null,        x:33, y:4,  w:3, d:1, h:0.7,  color:'#4a4238' },
  { id:'desk-hr',     label:null,        x:4,  y:4,  w:2, d:1, h:0.55, color:'#8f7d88' },
  { id:'desk-dennis', label:null,        x:34, y:20, w:2, d:1, h:0.55, color:'#6f7a6f' },
  { id:'coffee',      label:'COFFEE',    x:22, y:8,  w:1, d:1, h:0.8,  color:'#3d3a34' },
  { id:'fridge',      label:null,        x:24, y:8,  w:1, d:1, h:1.0,  color:'#9aa1a8' },
  { id:'table-meet',  label:null,        x:15, y:4,  w:4, d:2, h:0.5,  color:'#a08a5f' },
  { id:'table-kitch', label:null,        x:22, y:11, w:2, d:2, h:0.5,  color:'#a08a5f' },
  { id:'printer',     label:'PRINTER',   x:27, y:15, w:1, d:1, h:0.7,  color:'#5d6168' },
  { id:'plant-1',     label:null,        x:11, y:11, w:1, d:1, h:0.9,  color:'#4e7a4e' },
  { id:'plant-2',     label:null,        x:30, y:10, w:1, d:1, h:0.9,  color:'#4e7a4e' },
  { id:'plant-3',     label:null,        x:2,  y:12, w:1, d:1, h:0.9,  color:'#4e7a4e' },
  { id:'couch',       label:'COUCH',     x:2,  y:22, w:3, d:1, h:0.5,  color:'#b56a4f' }
];
const COFFEE_SPOT = { x:22, y:9 };
const COUCH_SPOT  = { x:3,  y:21 };

// ── zones: colored floor rugs with labels ─────────────────────────────────────
const ZONES = [
  { label:'THE BULLPEN',   x:6,  y:13, w:16, d:9,  color:'rgba(47,107,224,0.10)' },
  { label:'CORNER OFFICE', x:31, y:2,  w:7,  d:6,  color:'rgba(21,18,13,0.14)'   },
  { label:'HR',            x:2,  y:2,  w:6,  d:5,  color:'rgba(216,68,63,0.10)'  },
  { label:'KITCHEN',       x:21, y:7,  w:6,  d:7,  color:'rgba(62,158,94,0.12)'  },
  { label:'MEETING ROOM',  x:13, y:2,  w:8,  d:6,  color:'rgba(232,129,76,0.12)' },
  { label:'THE PIPE',      x:32, y:18, w:6,  d:5,  color:'rgba(92,86,71,0.14)'   },
  { label:'BREAK CORNER',  x:1,  y:20, w:6,  d:4,  color:'rgba(232,129,76,0.08)' }
];

// ── the cast ──────────────────────────────────────────────────────────────────
const CAST = [
  { id:'you',    name:'You',    role:'Trying to get out', color:'#8a5a2b', bear:true,
    spot:{x:9, y:16} },
  { id:'brad',   name:'Brad',   role:'Credit reallocation', color:'#2F6BE0',
    spot:{x:14, y:16},
    lines:{ good:'Just circled back on something that was yours.',
            meh:'Polishing a deck. The data looks familiar.',
            bad:'His “win” got questioned. Volatile.' } },
  { id:'dennis', name:'Dennis', role:'Senior approval-holder, 19 years', color:'#5C7A5C',
    spot:{x:35, y:21},
    lines:{ good:'Only has FOUR questions today. A gift.',
            meh:'Reviewing. Do not ask about the timeline.',
            bad:'Someone went around him once in 2019. He remembers.' } },
  { id:'boss',   name:'The Boss', role:'Ambush scheduler', color:'#15120D',
    spot:{x:34, y:5},
    lines:{ good:'Had a good call. Approachable for ~an hour.',
            meh:'Neutral. Could go either way. Tread evenly.',
            bad:'BAD DAY. Do not be away from your desk when he walks.' } },
  { id:'hr',     name:'Meredith (HR)', role:'People & Culture™', color:'#B0568C',
    spot:{x:5, y:5},
    lines:{ good:'Planning mandatory fun. You are on a list.',
            meh:'Updating the handbook. Section: you.',
            bad:'Scheduling “quick chats.” Decline nothing.' } },
  { id:'kayla',  name:'Kayla',  role:'Also trying to get out', color:'#3E9E9E', chat:true,
    spot:{x:9, y:20},
    lines:{ good:'Got an interview elsewhere. Glowing quietly.',
            meh:'Headphones on. The universal do-not-disturb.',
            bad:'Her project got “deprioritized.” Again.' } },
  { id:'marcus', name:'Marcus', role:'Has seen everything', color:'#C1652F', chat:true,
    spot:{x:14, y:20},
    lines:{ good:'Coasting beautifully. A master class.',
            meh:'Third coffee. Counting down to 5.',
            bad:'Got voluntold for the weekend thing.' } },
  { id:'priya',  name:'Priya',  role:'Actually does the work', color:'#7C6FD6', chat:true,
    spot:{x:19, y:20},
    lines:{ good:'Shipped early. Nobody noticed. She noticed.',
            meh:'In four meetings that could be emails.',
            bad:'Brad presented her numbers this morning.' } }
];

// Which NPC owns each encounter in the pool (by ENCOUNTERS index).
const OWNER_BY_ENC = { 0:'boss', 1:'brad', 2:'boss', 3:'hr', 4:'brad',
                       5:'hr', 6:'dennis', 7:'boss', 8:'hr', 9:'boss' };

const MOODS = ['good','meh','bad'];
const MOOD_FACE = { good:'😊', meh:'😐', bad:'😤' };

// ── deterministic rng ─────────────────────────────────────────────────────────
function rand(w){
  w.rngState = (w.rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(w.rngState ^ (w.rngState >>> 15), 1 | w.rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clockToMin(c){
  const h = parseInt(c, 10), m = parseInt(c.split(':')[1], 10);
  return (h < 9 ? h + 12 : h) * 60 + m;   // 9..11 am, 12, then 1..5 pm
}
function minToClock(min){
  let h = Math.floor(min / 60), m = min % 60;
  const am = h < 12;
  if(h > 12) h -= 12;
  return h + ':' + (m < 10 ? '0' : '') + m + (am ? ' AM' : ' PM');
}

// ── walkability + BFS pathing ─────────────────────────────────────────────────
function buildWalkGrid(){
  const walk = new Array(GRID_W * GRID_H).fill(true);
  FURNITURE.forEach(f => {
    for(let dx = 0; dx < f.w; dx++) for(let dy = 0; dy < f.d; dy++)
      walk[(f.y + dy) * GRID_W + (f.x + dx)] = false;
  });
  return walk;
}
const isWalkable = (w, x, y) =>
  x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && w.walk[y * GRID_W + x];

function bfsPath(w, from, to){
  const sx = Math.round(from.x), sy = Math.round(from.y);
  const tx = Math.round(to.x),  ty = Math.round(to.y);
  if(!isWalkable(w, tx, ty)) return null;
  if(sx === tx && sy === ty) return [];
  const prev = new Int32Array(GRID_W * GRID_H).fill(-1);
  const q = [sy * GRID_W + sx];
  prev[q[0]] = q[0];
  const goal = ty * GRID_W + tx;
  for(let qi = 0; qi < q.length; qi++){
    const cur = q[qi];
    if(cur === goal) break;
    const cx = cur % GRID_W, cy = (cur / GRID_W) | 0;
    const nb = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
    for(const [nx, ny] of nb){
      if(!isWalkable(w, nx, ny)) continue;
      const ni = ny * GRID_W + nx;
      if(prev[ni] !== -1) continue;
      prev[ni] = cur; q.push(ni);
    }
  }
  if(prev[goal] === -1) return null;
  const path = [];
  for(let cur = goal; cur !== prev[cur]; cur = prev[cur])
    path.push({ x: cur % GRID_W, y: (cur / GRID_W) | 0 });
  return path.reverse();
}

function adjacentTo(w, actor){
  const ax = Math.round(actor.x), ay = Math.round(actor.y);
  const opts = [[ax-1,ay],[ax+1,ay],[ax,ay-1],[ax,ay+1]];
  for(const [x, y] of opts) if(isWalkable(w, x, y)) return { x, y };
  return { x: ax, y: ay };
}

// ── world construction ────────────────────────────────────────────────────────
// plan = the day's encounter indices from NineToSurvive (already clock-ordered).
function newDay(seed, day, plan){
  const w = {
    day,
    rngState: ((seed | 0) ^ Math.imul(day, 2654435761)) | 0,
    walk: buildWalkGrid(),
    actors: CAST.map(c => ({
      id: c.id, name: c.name, role: c.role, color: c.color, bear: !!c.bear,
      chat: !!c.chat,
      x: c.spot.x, y: c.spot.y, home: { x: c.spot.x, y: c.spot.y },
      path: [], state: 'idle', wanderT: 0,   // re-seeded below via rand(w)
      mood: 'meh', lines: c.lines || null
    })),
    clockMin: 540,           // 9:00 AM
    running: true,
    sig: [],                 // signal queue → shell drains via step()'s return
    // cards (rare spice): owner walks over at the card's clock time
    events: plan.map(encIdx => ({
      encIdx, owner: OWNER_BY_ENC[encIdx],
      atMin: clockToMin(_encounters[encIdx].clock),
      status: 'pending'      // pending → walking → active → done
    })),
    nextEvent: 0,
    activeEvent: null,
    // the actual work: tasks land in your inbox through the day
    tasks: { pending: 0, done: 0, spawned: 0, total: TASKS_PER_DAY, progress: 0,
             spawnAt: [] },
    // threats
    bossWalks: [],           // [{atMin, status:'pending'|'out'|'done'}]
    bradRaids: [],
    crunch: null,            // {atMin, status}
    // recovery economy (once a day each)
    coffeeUsed: false, couchUsed: false, chatted: {},
    playerErrand: null,      // {type:'coffee'|'couch'|'chat', id?, repaths}
    moveMarker: null,
    dayOver: false
  };
  // seed wander timers + daily moods deterministically
  w.actors.forEach(a => {
    a.wanderT = 2 + rand(w) * 6;
    if(a.id !== 'you') a.mood = MOODS[Math.floor(rand(w) * 3)];
  });
  // task drip: 3 waiting at 9:00, then one every ~55 game-min
  w.tasks.spawnAt = [540, 540, 540];
  for(let i = 3; i < TASKS_PER_DAY; i++) w.tasks.spawnAt.push(595 + (i - 3) * 55);
  // boss floor-walks: two, spaced through the day
  for(let i = 0; i < BOSS_WALKS_PER_DAY; i++)
    w.bossWalks.push({ atMin: 620 + i * 170 + Math.floor(rand(w) * 60), status: 'pending' });
  // brad raids: one or two
  const raids = 1 + (rand(w) < 0.5 ? 1 : 0);
  for(let i = 0; i < raids; i++)
    w.bradRaids.push({ atMin: 600 + Math.floor(rand(w) * 360), status: 'pending' });
  w.bradRaids.sort((a, b) => a.atMin - b.atMin);
  // maybe a fire drill
  if(rand(w) < CRUNCH_CHANCE)
    w.crunch = { atMin: 690 + Math.floor(rand(w) * 120), status: 'pending' };
  return w;
}

// world needs encounter clocks; injected once by the shell (or tests).
let _encounters = null;
function setEncounters(list){ _encounters = list; }

// ── behavior ──────────────────────────────────────────────────────────────────
function sendTo(w, actor, tile, state){
  const p = bfsPath(w, actor, tile);
  if(p === null) return false;
  actor.path = p; actor.state = state || 'walking';
  return true;
}

function moveAlongPath(a, dt){
  const speed = (a.state === 'summoned' || a.state === 'errand' || a.state === 'raid'
                 || a.state === 'patrol') ? WALK_SPEED * 1.9 : WALK_SPEED;
  let budget = speed * dt;
  while(budget > 0 && a.path.length){
    const t = a.path[0];
    const dx = t.x - a.x, dy = t.y - a.y;
    const dist = Math.hypot(dx, dy);
    if(dist <= budget){ a.x = t.x; a.y = t.y; a.path.shift(); budget -= dist; }
    else { a.x += dx / dist * budget; a.y += dy / dist * budget; budget = 0; }
  }
  return a.path.length === 0;
}

function getActor(w, id){ return w.actors.find(a => a.id === id); }
function playerAtDesk(w){
  const you = getActor(w, 'you');
  return Math.hypot(you.x - you.home.x, you.y - you.home.y) < 0.8;
}

// One tick. Drains one signal per call (queue keeps the rest for the next frame).
function step(w, dt){
  if(!w.running) return w.sig.shift() || null;
  const you = getActor(w, 'you');

  w.clockMin = Math.min(1020, w.clockMin + CLOCK_SPEED * dt);

  // ---- task drip + working at your desk ----
  while(w.tasks.spawned < w.tasks.total && w.clockMin >= w.tasks.spawnAt[w.tasks.spawned]){
    w.tasks.spawned++; w.tasks.pending++;
    w.sig.push({ type:'task', pending: w.tasks.pending });
  }
  if(w.tasks.pending > 0 && playerAtDesk(w) && !you.path.length){
    w.tasks.progress += dt / TASK_WORK_SECS;
    if(w.tasks.progress >= 1){
      w.tasks.progress = 0; w.tasks.pending--; w.tasks.done++;
      w.sig.push({ type:'taskdone', done: w.tasks.done, pending: w.tasks.pending });
    }
  }

  // ---- movement + wander ----
  w.actors.forEach(a => {
    if(a.path.length){
      const arrived = moveAlongPath(a, dt);
      if(!arrived) return;
      if(a.id === 'you') w.moveMarker = null;
      if(a.state === 'summoned'){ a.state = 'atPlayer'; }
      else if(a.state === 'errand' && a.id === 'you'){ a.state = 'idle'; arriveErrand(w, you); }
      else if(a.state === 'patrol' && a.id === 'boss'){ bossArrives(w, a, you); }
      else if(a.state === 'raid' && a.id === 'brad'){ bradArrives(w, a, you); }
      else { a.state = 'idle'; }
      return;
    }
    if(a.state !== 'idle' || a.id === 'you') return;
    a.wanderT -= dt;
    if(a.wanderT <= 0){
      a.wanderT = 3 + rand(w) * 8;
      const r = rand(w);
      if(r < 0.30){
        const tx = a.home.x + Math.floor(rand(w) * 7) - 3;
        const ty = a.home.y + Math.floor(rand(w) * 7) - 3;
        if(isWalkable(w, tx, ty)) sendTo(w, a, { x: tx, y: ty }, 'walking');
      } else if(r < 0.42){
        sendTo(w, a, COFFEE_SPOT, 'walking');
      } else if(Math.abs(a.x - a.home.x) + Math.abs(a.y - a.home.y) > 0.6){
        sendTo(w, a, a.home, 'returning');
      }
    }
  });

  // ---- fire drill ----
  if(w.crunch && w.crunch.status === 'pending' && w.clockMin >= w.crunch.atMin){
    w.crunch.status = 'active';
    w.running = false;
    w.sig.push({ type:'crunch' });
    return w.sig.shift();
  }

  // ---- boss floor-walk ----
  const boss = getActor(w, 'boss');
  w.bossWalks.forEach(bw => {
    if(bw.status === 'pending' && w.clockMin >= bw.atMin && boss.state === 'idle'){
      bw.status = 'out';
      sendTo(w, boss, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'patrol');
      w.sig.push({ type:'bosswalk', mood: boss.mood });
    }
  });

  // ---- brad raid ----
  const brad = getActor(w, 'brad');
  w.bradRaids.forEach(br => {
    if(br.status === 'pending' && w.clockMin >= br.atMin && brad.state === 'idle'){
      br.status = 'out';
      sendTo(w, brad, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'raid');
    }
  });

  // ---- the day's cards (owner walks over at the card's minute) ----
  if(w.nextEvent < w.events.length){
    const ev = w.events[w.nextEvent];
    if(ev.status === 'pending' && w.clockMin >= ev.atMin){
      const owner = getActor(w, ev.owner);
      if(owner.state === 'idle' || owner.state === 'walking' || owner.state === 'returning'){
        ev.status = 'walking';
        owner.path = [];
        sendTo(w, owner, adjacentTo(w, you), 'summoned');
      }
    }
    if(ev.status === 'walking'){
      const owner = getActor(w, ev.owner);
      if(owner.state === 'atPlayer'){
        ev.status = 'active';
        w.activeEvent = ev;
        w.running = false;
        w.sig.push({ type:'encounter', event: ev });
      }
    }
  }

  // ---- 5 PM ----
  if(!w.dayOver && w.clockMin >= 1020 && w.nextEvent >= w.events.length && !w.activeEvent){
    w.dayOver = true;
    w.sig.push({ type:'dayover', tasksDone: w.tasks.done, tasksTotal: w.tasks.total });
  }

  return w.sig.shift() || null;
}

// errand arrivals (you reached the thing you clicked)
function arriveErrand(w, you){
  const e = w.playerErrand;
  if(!e) return;
  if(e.type === 'coffee'){
    w.playerErrand = null;
    w.sig.push({ type:'coffee' });
  } else if(e.type === 'couch'){
    w.playerErrand = null;
    w.sig.push({ type:'couch' });
  } else if(e.type === 'chat'){
    const target = getActor(w, e.id);
    if(Math.hypot(target.x - you.x, target.y - you.y) <= 2.2){
      w.playerErrand = null; w.chatted[e.id] = true;
      w.sig.push({ type:'chat', who: e.id, name: target.name, mood: target.mood });
    } else if(e.repaths < 3){
      e.repaths++;
      sendTo(w, you, adjacentTo(w, target), 'errand');
    } else {
      w.playerErrand = null;   // they got away; no harm
    }
  }
}

function bossArrives(w, boss, you){
  const walk = w.bossWalks.find(b => b.status === 'out');
  if(walk) walk.status = 'done';
  const atDesk = playerAtDesk(w);
  w.sig.push(atDesk
    ? { type:'bosspass' }
    : { type:'bosscatch', bad: boss.mood === 'bad' });
  sendTo(w, boss, boss.home, 'returning');
}

function bradArrives(w, brad, you){
  const raid = w.bradRaids.find(b => b.status === 'out');
  if(raid) raid.status = 'done';
  if(!playerAtDesk(w) && w.tasks.pending > 0){
    // he lifts the file you were furthest through
    w.tasks.pending--;
    w.tasks.progress = 0;
    w.sig.push({ type:'bradsteal', pending: w.tasks.pending });
  } else {
    w.sig.push({ type:'bradfoiled' });
  }
  sendTo(w, brad, brad.home, 'returning');
}

// Card resolved: the owner goes home, the day resumes.
function resolveEncounter(w){
  if(!w.activeEvent) return;
  const owner = getActor(w, w.activeEvent.owner);
  sendTo(w, owner, owner.home, 'returning');
  w.activeEvent.status = 'done';
  w.activeEvent = null;
  w.nextEvent++;
  w.running = true;
}

function resolveCrunch(w){
  if(w.crunch) w.crunch.status = 'done';
  w.running = true;
}

function eventsRemaining(w){
  return w.events.filter(e => e.status !== 'done').length;
}

// ── player verbs (all click-driven from the shell) ────────────────────────────
function movePlayer(w, tile){
  const you = getActor(w, 'you');
  if(!isWalkable(w, Math.round(tile.x), Math.round(tile.y))) return false;
  w.playerErrand = null;
  if(!sendTo(w, you, { x: Math.round(tile.x), y: Math.round(tile.y) }, 'walking')) return false;
  w.moveMarker = { x: Math.round(tile.x), y: Math.round(tile.y) };
  return true;
}
function goForCoffee(w){
  if(w.coffeeUsed) return false;
  const you = getActor(w, 'you');
  if(!sendTo(w, you, COFFEE_SPOT, 'errand')) return false;
  w.coffeeUsed = true; w.playerErrand = { type:'coffee', repaths: 0 };
  w.moveMarker = COFFEE_SPOT;
  return true;
}
function goForCouch(w){
  if(w.couchUsed) return false;
  const you = getActor(w, 'you');
  if(!sendTo(w, you, COUCH_SPOT, 'errand')) return false;
  w.couchUsed = true; w.playerErrand = { type:'couch', repaths: 0 };
  w.moveMarker = COUCH_SPOT;
  return true;
}
function requestChat(w, id){
  const target = getActor(w, id);
  if(!target || !target.chat || w.chatted[id]) return false;
  const you = getActor(w, 'you');
  if(!sendTo(w, you, adjacentTo(w, target), 'errand')) return false;
  w.playerErrand = { type:'chat', id, repaths: 0 };
  w.moveMarker = null;
  return true;
}
function playerGoHome(w){
  const you = getActor(w, 'you');
  w.playerErrand = null;
  sendTo(w, you, you.home, 'walking');
  w.moveMarker = { x: you.home.x, y: you.home.y };
}

// ── picking + status ──────────────────────────────────────────────────────────
function pickActorAt(w, gx, gy){
  let best = null, bestD = 0.75;
  w.actors.forEach(a => {
    const d = Math.hypot(a.x - gx, a.y - gy);
    if(d < bestD){ best = a; bestD = d; }
  });
  return best;
}
function furnitureAt(gx, gy){
  const x = Math.round(gx), y = Math.round(gy);
  return FURNITURE.find(f => x >= f.x - 1 && x <= f.x + f.w && y >= f.y - 1 && y <= f.y + f.d) || null;
}
function isCoffeeAt(gx, gy){
  const f = furnitureAt(gx, gy);
  return !!f && (f.id === 'coffee' || f.id === 'fridge');
}
function isCouchAt(gx, gy){
  const f = furnitureAt(gx, gy);
  return !!f && f.id === 'couch';
}
function statusOf(w, actor){
  if(actor.id === 'you') return { name:'You', role: actor.role, mood: null,
    line:'Tasks ship at your desk. Soul refills everywhere else. Choose.', face:'🐻', chat:false };
  return {
    name: actor.name, role: actor.role, mood: actor.mood,
    face: MOOD_FACE[actor.mood],
    line: actor.lines ? actor.lines[actor.mood] : '',
    chat: !!actor.chat && !w.chatted[actor.id]
  };
}

// ── rendering (the only DOM-adjacent code; tests never call it) ───────────────
function proj(cam, gx, gy){
  return [ (gx - gy) * (TW / 2) * cam.z + cam.x,
           (gx + gy) * (TH / 2) * cam.z + cam.y ];
}
function screenToTile(cam, sx, sy){
  const ix = (sx - cam.x) / ((TW / 2) * cam.z);
  const iy = (sy - cam.y) / ((TH / 2) * cam.z);
  return { x: (ix + iy) / 2, y: (iy - ix) / 2 };
}

function render(w, ctx, cam, vw, vh){
  ctx.clearRect(0, 0, vw, vh);
  const z = cam.z;

  for(let y = 0; y < GRID_H; y++){
    for(let x = 0; x < GRID_W; x++){
      const [px, py] = proj(cam, x, y);
      if(px < -TW * z || px > vw + TW * z || py < -TH * z || py > vh + TH * z) continue;
      ctx.beginPath();
      ctx.moveTo(px, py - (TH / 2) * z);
      ctx.lineTo(px + (TW / 2) * z, py);
      ctx.lineTo(px, py + (TH / 2) * z);
      ctx.lineTo(px - (TW / 2) * z, py);
      ctx.closePath();
      ctx.fillStyle = (x + y) % 2 ? '#EDE5CF' : '#E7DEC6';
      ctx.fill();
      ctx.strokeStyle = 'rgba(21,18,13,0.05)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  ZONES.forEach(zn => {
    ctx.beginPath();
    const c = [[zn.x, zn.y],[zn.x + zn.w, zn.y],[zn.x + zn.w, zn.y + zn.d],[zn.x, zn.y + zn.d]];
    c.forEach(([gx, gy], i) => {
      const [px, py] = proj(cam, gx - 0.5, gy - 0.5);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath(); ctx.fillStyle = zn.color; ctx.fill();
    const [lx, ly] = proj(cam, zn.x + zn.w / 2 - 0.5, zn.y + zn.d / 2 - 0.5);
    ctx.fillStyle = 'rgba(21,18,13,0.34)';
    ctx.font = '700 ' + Math.max(9, 11 * z) + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(zn.label, lx, ly);
  });

  // click-to-move marker
  if(w.moveMarker){
    const [mx, my] = proj(cam, w.moveMarker.x, w.moveMarker.y);
    ctx.beginPath();
    ctx.moveTo(mx, my - (TH / 2) * z * 0.7);
    ctx.lineTo(mx + (TW / 2) * z * 0.7, my);
    ctx.lineTo(mx, my + (TH / 2) * z * 0.7);
    ctx.lineTo(mx - (TW / 2) * z * 0.7, my);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(47,107,224,0.9)'; ctx.lineWidth = 2 * z; ctx.stroke();
  }

  const drawables = [];
  FURNITURE.forEach(f => drawables.push({ d: f.x + f.w / 2 + f.y + f.d / 2, f }));
  w.actors.forEach(a => drawables.push({ d: a.x + a.y + 0.01, a }));
  drawables.sort((p, q) => p.d - q.d);
  drawables.forEach(item => {
    if(item.f) drawBox(ctx, cam, item.f, w);
    else drawActor(ctx, cam, item.a, w);
  });
}

function shade(hex, f){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawBox(ctx, cam, f, w){
  const z = cam.z, hpx = f.h * 34 * z;
  const p = (gx, gy) => proj(cam, gx - 0.5, gy - 0.5);
  const [ax, ay] = p(f.x, f.y), [bx, by] = p(f.x + f.w, f.y);
  const [cx, cy] = p(f.x + f.w, f.y + f.d), [dx, dy] = p(f.x, f.y + f.d);
  ctx.beginPath(); ctx.moveTo(ax, ay - hpx); ctx.lineTo(bx, by - hpx);
  ctx.lineTo(cx, cy - hpx); ctx.lineTo(dx, dy - hpx); ctx.closePath();
  ctx.fillStyle = f.color; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx, by - hpx); ctx.lineTo(cx, cy - hpx);
  ctx.lineTo(cx, cy); ctx.lineTo(bx, by); ctx.closePath();
  ctx.fillStyle = shade(f.color, 0.72); ctx.fill();
  ctx.beginPath(); ctx.moveTo(dx, dy - hpx); ctx.lineTo(cx, cy - hpx);
  ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath();
  ctx.fillStyle = shade(f.color, 0.55); ctx.fill();
  if(f.label){
    const [lx, ly] = proj(cam, f.x + f.w / 2 - 0.5, f.y + f.d / 2 - 0.5);
    ctx.fillStyle = 'rgba(21,18,13,0.8)';
    ctx.font = '700 ' + Math.max(8, 9 * z) + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.label, lx, ly - hpx - 6 * z);
  }
  // your inbox: pending tasks stack up as paper on YOUR desk
  if(f.id === 'desk-you' && w && w.tasks.pending > 0){
    const [ix, iy] = proj(cam, f.x + f.w - 1, f.y - 0.15);
    for(let i = 0; i < Math.min(8, w.tasks.pending); i++){
      ctx.fillStyle = '#faf6ea';
      ctx.strokeStyle = 'rgba(21,18,13,0.35)'; ctx.lineWidth = 1;
      const py = iy - hpx - i * 3.2 * z;
      ctx.beginPath();
      ctx.moveTo(ix, py - 4 * z); ctx.lineTo(ix + 9 * z, py);
      ctx.lineTo(ix, py + 4 * z); ctx.lineTo(ix - 9 * z, py);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#D8443F';
    ctx.font = '800 ' + Math.max(9, 11 * z) + 'px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('×' + w.tasks.pending, ix, iy - hpx - Math.min(8, w.tasks.pending) * 3.2 * z - 6 * z);
  }
}

function drawActor(ctx, cam, a, w){
  const z = cam.z;
  const [px, py] = proj(cam, a.x, a.y);
  ctx.beginPath(); ctx.ellipse(px, py, 10 * z, 5 * z, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(21,18,13,0.18)'; ctx.fill();
  if(a.id === 'boss' && (a.mood === 'bad' || a.state === 'patrol')){
    ctx.beginPath(); ctx.ellipse(px, py, 14 * z, 7 * z, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216,68,63,0.85)'; ctx.lineWidth = 2.5 * z; ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(px, py - 11 * z, 8 * z, 11 * z, 0, 0, Math.PI * 2);
  ctx.fillStyle = a.color; ctx.fill();
  ctx.beginPath(); ctx.arc(px, py - 26 * z, 6.5 * z, 0, Math.PI * 2);
  ctx.fillStyle = a.bear ? '#8a5a2b' : '#E8C39E'; ctx.fill();
  if(a.bear){
    ctx.beginPath(); ctx.arc(px - 5 * z, py - 31 * z, 2.6 * z, 0, Math.PI * 2);
    ctx.arc(px + 5 * z, py - 31 * z, 2.6 * z, 0, Math.PI * 2);
    ctx.fillStyle = '#6e4620'; ctx.fill();
  }
  if(a.lines){
    ctx.font = (11 * z) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(MOOD_FACE[a.mood], px + 11 * z, py - 32 * z);
  }
  // threat telegraphs: the floor-walk and the raid are readable at a glance
  if(a.state === 'patrol' || a.state === 'raid'){
    ctx.fillStyle = '#D8443F';
    ctx.font = '800 ' + (14 * z) + 'px system-ui';
    ctx.fillText('❗', px - 12 * z, py - 34 * z);
  }
  // your work-in-progress bar
  if(a.id === 'you' && w && w.tasks.progress > 0 && playerAtDesk(w)){
    const bw = 30 * z;
    ctx.fillStyle = 'rgba(21,18,13,0.25)';
    ctx.fillRect(px - bw / 2, py - 40 * z, bw, 5 * z);
    ctx.fillStyle = '#2E9E63';
    ctx.fillRect(px - bw / 2, py - 40 * z, bw * Math.min(1, w.tasks.progress), 5 * z);
  }
  ctx.fillStyle = 'rgba(21,18,13,0.65)';
  ctx.font = '700 ' + Math.max(8, 8.5 * z) + 'px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(a.id === 'you' ? 'YOU' : a.name.split(' ')[0].toUpperCase(), px, py + 12 * z);
}

return {
  GRID_W, GRID_H, TW, TH, CAST, FURNITURE, ZONES, OWNER_BY_ENC,
  TASKS_PER_DAY, TASK_WORK_SECS, CRUNCH_CHANCE, CLOCK_SPEED,
  setEncounters, newDay, step, resolveEncounter, resolveCrunch, eventsRemaining,
  movePlayer, goForCoffee, goForCouch, requestChat, playerGoHome, playerAtDesk,
  sendTo, bfsPath, isWalkable, adjacentTo, getActor,
  pickActorAt, furnitureAt, isCoffeeAt, isCouchAt, statusOf, clockToMin, minToClock,
  render, proj, screenToTile
};
})();

// browser + headless-test exposure
if (typeof window !== 'undefined') window.NtosWorld = NtosWorld;
if (typeof module !== 'undefined' && module.exports) module.exports = NtosWorld;
