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
const CLOCK_SPEED = 3.2;          // game-minutes per real second → a day = 2.5 real min
const TASK_WORK_SECS = 11;        // real seconds at your desk to ship one task
const TASKS_MIN = 6, TASKS_MAX = 10;   // seeded daily load — some days the org just produces more org
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
  { id:'couch',       label:'COUCH',     x:2,  y:22, w:3, d:1, h:0.5,  color:'#b56a4f' },
  { id:'stairs',      label:'STAIRS',    x:38, y:12, w:1, d:2, h:0.9,  color:'#6b675e' },
  { id:'exit',        label:'EXIT',      x:0,  y:16, w:1, d:2, h:1.1,  color:'#2E9E63' }
];
const COFFEE_SPOT = { x:22, y:9 };
const COUCH_SPOT  = { x:3,  y:21 };
const EXIT_SPOT   = { x:1,  y:17 };
const STAIRS_SPOT = { x:37, y:13 };   // where the private calls happen
const KITCHEN_CORNER = { x:24, y:12 };   // where Kayla "gets water" on the bad day

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
  { id:'you',    name:'You',    role:'Trying to get out', color:'#4B4743', bear:true,
    spot:{x:9, y:16} },   // the shrugging badger (brand mascot) — grays, not browns
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

// Which NPC owns each encounter in the pool (by ENCOUNTERS index, clock order):
//  0 sync  1 reply-all  2 credit  3 calibration  4 ambush  5 reorg  6 trivia
//  7 consultant  8 farewell-card  9 offline  10 family  11 notes  12 expense
// 13 dennis-questions  14 noise  15 visibility  16 linkedin  17 self-assess
// 18 exit-survey  19 closer
const OWNER_BY_ENC = { 0:'boss', 1:'marcus', 2:'brad', 3:'hr', 4:'boss',
                       5:'boss', 6:'hr', 7:'hr', 8:'kayla', 9:'brad',
                       10:'boss', 11:'hr', 12:'dennis', 13:'dennis', 14:'priya',
                       15:'boss', 16:'brad', 17:'hr', 18:'hr', 19:'boss' };

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
// flags = NineToSurvive.worldFlagsFor(g): arc stage flags the world stages
// physically (clues, detours, the firing, incident cards). Plain data, one-way.
function newDay(seed, day, plan, flags){
  flags = flags || {};
  const w = {
    day,
    flags,
    rngState: ((seed | 0) ^ Math.imul(day, 2654435761)) | 0,
    walk: buildWalkGrid(),
    actors: CAST.filter(c => !(flags.bradGone && c.id === 'brad')).map(c => ({
      id: c.id, name: c.name, role: c.role, color: c.color, bear: !!c.bear,
      chat: !!c.chat,
      x: c.spot.x, y: c.spot.y, home: { x: c.spot.x, y: c.spot.y },
      path: [], state: 'idle', wanderT: 0,   // re-seeded below via rand(w)
      mood: 'meh', lines: c.lines || null
    })),
    clockMin: 540,           // 9:00 AM
    running: true,
    sig: [],                 // signal queue → shell drains via step()'s return
    // cards (rare spice) + any arc incidents: the owner walks over at the
    // event's clock minute. One sorted queue; incidents gate 5 PM like cards.
    events: plan.map(encIdx => ({
      kind: 'card', encIdx, owner: OWNER_BY_ENC[encIdx],
      atMin: clockToMin(_encounters[encIdx].clock),
      status: 'pending'      // pending → walking → active → done
    })).concat((flags.incidents || []).map(inc => ({
      kind: 'incident', id: inc.id, owner: inc.owner, atMin: inc.atMin,
      status: 'pending'
    }))).sort((a, b) => a.atMin - b.atMin),
    nextEvent: 0,
    activeEvent: null,
    // the actual work: tasks land in your inbox through the day (load seeded below)
    tasks: { pending: 0, done: 0, spawned: 0, total: 0, progress: 0,
             spawnAt: [] },
    // threats
    bossWalks: [],           // [{atMin, status:'pending'|'out'|'done'}]
    bradRaids: [],
    crunch: null,            // {atMin, status}
    // Brad-arc staging: the deck detour and the firing you can watch
    bradDeck: flags.bradDeckAt ? { atMin: flags.bradDeckAt, status: 'pending' } : null,
    firing: flags.bradFiredToday ? { phase: 'wait' } : null,
    // Boss-arc staging: the quick-call summons (walk over, or let it expire)
    summons: flags.bossSummonsAt
      ? { atMin: flags.bossSummonsAt, expireAt: flags.bossSummonsAt + 90, status: 'pending' }
      : null,
    bossHumanDone: false,
    // recovery economy (once a day each)
    coffeeUsed: false, couchUsed: false, chatted: {},
    playerErrand: null,      // {type:'coffee'|'couch'|'chat'|'exit', id?, repaths}
    moveMarker: null,
    walkoutArmed: false,     // the shell arms this when the number is banked
    dayOver: false
  };
  // seed wander timers + daily moods deterministically
  w.actors.forEach(a => {
    a.wanderT = 2 + rand(w) * 6;
    if(a.id !== 'you') a.mood = MOODS[Math.floor(rand(w) * 3)];
  });
  // Kayla's panic day: she's in the kitchen, and she's staying there
  if(flags.kaylaPanic){
    const kayla = getActor(w, 'kayla');
    if(kayla){ kayla.x = KITCHEN_CORNER.x; kayla.y = KITCHEN_CORNER.y; kayla.pinned = true; kayla.mood = 'bad'; }
  }
  w.kaylaTaskTaken = false;
  w.kaylaReported = false;
  w.webinarAnnounced = false;
  // task drip: seeded daily load, 3 waiting at 9:00, the rest spread to ~3:30
  w.tasks.total = TASKS_MIN + Math.floor(rand(w) * (TASKS_MAX - TASKS_MIN + 1));
  w.tasks.spawnAt = [540, 540, 540];
  const drip = Math.floor(390 / Math.max(1, w.tasks.total - 3));
  for(let i = 3; i < w.tasks.total; i++) w.tasks.spawnAt.push(560 + (i - 3) * drip);
  // boss floor-walks: two, spaced through the day (+1 while his arc runs hot)
  const walks = BOSS_WALKS_PER_DAY + (flags.extraBossWalks || 0);
  for(let i = 0; i < walks; i++)
    w.bossWalks.push({ atMin: Math.min(990, 620 + i * (walks > 2 ? 130 : 170) + Math.floor(rand(w) * 60)),
                       status: 'pending' });
  // brad raids: one or two — unless he's covered-for, gone, or busy being fired
  // (the roll still spends rng so staging stays comparable across arc states)
  const raidRoll = rand(w);
  const raids = (flags.noBradRaids || flags.bradGone) ? 0 : 1 + (raidRoll < 0.5 ? 1 : 0);
  for(let i = 0; i < raids; i++)
    w.bradRaids.push({ atMin: 600 + Math.floor(rand(w) * 360), status: 'pending' });
  w.bradRaids.sort((a, b) => a.atMin - b.atMin);
  // maybe a fire drill (likelier while the corner office is spiraling)
  if(rand(w) < CRUNCH_CHANCE + (flags.crunchBoost || 0))
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

  // ---- the mandatory webinar: a calendar event that eats task time ----
  if(w.flags.webinarUntil && !w.webinarAnnounced && w.clockMin >= 540){
    w.webinarAnnounced = true;
    w.sig.push({ type:'webinar', until: w.flags.webinarUntil });
  }
  const inWebinar = w.flags.webinarUntil && w.clockMin < w.flags.webinarUntil;

  // ---- task drip + working at your desk ----
  while(w.tasks.spawned < w.tasks.total && w.clockMin >= w.tasks.spawnAt[w.tasks.spawned]){
    w.tasks.spawned++; w.tasks.pending++;
    w.sig.push({ type:'task', pending: w.tasks.pending });
  }
  if(w.tasks.pending > 0 && playerAtDesk(w) && !you.path.length && !inWebinar){
    w.tasks.progress += dt / TASK_WORK_SECS;
    if(w.tasks.progress >= 1){
      w.tasks.progress = 0; w.tasks.pending--; w.tasks.done++;
      w.sig.push({ type:'taskdone', done: w.tasks.done, pending: w.tasks.pending });
    }
  }

  // ---- movement + wander ----
  w.actors.forEach(a => {
    if(a.path.length){
      if(moveAlongPath(a, dt)) handleArrival(w, a, you);
      return;
    }
    // zero-path arrival: sendTo can produce an empty path when the actor is
    // already on the target tile — treat that as arrived, or the day deadlocks
    // (e.g. a card owner already adjacent never reaches 'atPlayer').
    if(a.state !== 'idle' && a.state !== 'atPlayer'){ handleArrival(w, a, you); return; }
    if(a.state !== 'idle' || a.id === 'you' || a.off || a.pinned) return;
    a.wanderT -= dt;
    if(a.wanderT <= 0){
      a.wanderT = 3 + rand(w) * 8;
      const r = rand(w);
      // Brad on two payrolls spends his idle time in the stairwell, phone out
      const stairbound = a.id === 'brad' && w.flags.bradCalls;
      if(r < 0.30){
        if(stairbound){ sendTo(w, a, STAIRS_SPOT, 'walking'); return; }
        const tx = a.home.x + Math.floor(rand(w) * 7) - 3;
        const ty = a.home.y + Math.floor(rand(w) * 7) - 3;
        if(isWalkable(w, tx, ty)) sendTo(w, a, { x: tx, y: ty }, 'walking');
      } else if(r < 0.42){
        sendTo(w, a, stairbound ? STAIRS_SPOT : COFFEE_SPOT, 'walking');
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
      // mark 'out' only once the walk actually starts, else it hangs forever
      if(sendTo(w, boss, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'patrol')){
        bw.status = 'out';
        w.sig.push({ type:'bosswalk', mood: boss.mood });
      }
    }
  });

  // ---- brad raid ----
  const brad = getActor(w, 'brad');
  w.bradRaids.forEach(br => {
    if(br.status === 'pending' && w.clockMin >= br.atMin && brad && !brad.off && brad.state === 'idle'){
      if(sendTo(w, brad, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'raid'))
        br.status = 'out';
    }
  });

  // ---- the deck detour: Brad walks his other job right past your desk ----
  if(w.bradDeck && w.bradDeck.status === 'pending' && w.clockMin >= w.bradDeck.atMin
     && brad && !brad.off
     && (brad.state === 'idle' || brad.state === 'walking' || brad.state === 'returning')){
    brad.path = [];
    if(sendTo(w, brad, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'deck'))
      w.bradDeck.status = 'out';
  }

  // ---- the firing: a world event you can watch, start to door ----
  if(w.firing && w.firing.phase !== 'done'){
    const hr = getActor(w, 'hr');
    if(w.firing.phase === 'wait' && w.clockMin >= 690){          // 11:30 all-hands
      w.firing.phase = 'allhands';
      w.sig.push({ type: 'bradallhands' });
    } else if(w.firing.phase === 'allhands' && w.clockMin >= 720 && brad && hr){  // noon
      brad.path = [];
      sendTo(w, brad, brad.home, 'returning');                   // he's asked to "grab a room"
      hr.path = [];
      if(sendTo(w, hr, adjacentTo(w, brad.home), 'escort')) w.firing.phase = 'collect';
    }
  }

  // ---- the quick-call summons: answer with your feet, or let it expire ----
  if(w.summons){
    if(w.summons.status === 'pending' && w.clockMin >= w.summons.atMin){
      w.summons.status = 'open';
      w.sig.push({ type: 'summons' });
    } else if(w.summons.status === 'open' && w.clockMin >= w.summons.expireAt){
      w.summons.status = 'missed';
      w.sig.push({ type: 'summonsmissed' });
    }
  }

  // ---- the human beat: crossing his path off-schedule while the arc is hot ----
  if(w.flags.bossArcHot && !w.bossHumanDone
     && !(w.summons && w.summons.status === 'open')
     && !(w.playerErrand && w.playerErrand.type === 'quickcall')){
    const bossH = getActor(w, 'boss');
    if(bossH && bossH.state === 'idle' && !playerAtDesk(w)
       && Math.hypot(bossH.x - you.x, bossH.y - you.y) < 2.0
       && Math.hypot(bossH.x - bossH.home.x, bossH.y - bossH.home.y) < 2.5){
      w.bossHumanDone = true;
      w.sig.push({ type: 'bosshuman' });
    }
  }

  // ---- the day's cards + arc incidents (owner walks over at the minute) ----
  if(w.nextEvent < w.events.length){
    const ev = w.events[w.nextEvent];
    if(ev.status === 'pending' && w.clockMin >= ev.atMin){
      const owner = getActor(w, ev.owner);
      if(owner && !owner.off
         && (owner.state === 'idle' || owner.state === 'walking' || owner.state === 'returning')){
        owner.path = [];
        // status advances only if the walk starts; otherwise retry next tick
        if(sendTo(w, owner, adjacentTo(w, you), 'summoned')) ev.status = 'walking';
      }
    }
    if(ev.status === 'walking'){
      const owner = getActor(w, ev.owner);
      if(owner.state === 'atPlayer'){
        ev.status = 'active';
        w.activeEvent = ev;
        w.running = false;
        w.sig.push(ev.kind === 'incident'
          ? { type:'arcincident', id: ev.id, event: ev }
          : { type:'encounter', event: ev });
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

// An actor finished (or never needed) a walk: route by what the walk was FOR.
function handleArrival(w, a, you){
  if(a.id === 'you') w.moveMarker = null;
  if(a.state === 'summoned'){ a.state = 'atPlayer'; }
  else if(a.state === 'errand' && a.id === 'you'){ a.state = 'idle'; arriveErrand(w, you); }
  else if(a.state === 'patrol' && a.id === 'boss'){ bossArrives(w, a, you); }
  else if(a.state === 'raid' && a.id === 'brad'){ bradArrives(w, a, you); }
  else if(a.state === 'deck' && a.id === 'brad'){
    // the slip: your desk, his laptop, their logo — then he's off to the stairwell
    if(w.bradDeck) w.bradDeck.status = 'done';
    w.sig.push({ type: 'braddeck' });
    if(!sendTo(w, a, STAIRS_SPOT, 'walking')) sendTo(w, a, a.home, 'returning');
  }
  else if(a.state === 'escort' && a.id === 'hr'){
    const brad = getActor(w, 'brad');
    if(!brad || brad.off){ a.state = 'idle'; }
    else if(!brad.path.length && Math.hypot(brad.x - a.x, brad.y - a.y) <= 2.5){
      // she has him. Both walk to the door; everyone pretends not to watch.
      if(w.firing) w.firing.phase = 'walkout';
      sendTo(w, brad, EXIT_SPOT, 'escorted');
      sendTo(w, a, { x: 2, y: 17 }, 'escorting');
    } else {
      sendTo(w, a, adjacentTo(w, brad), 'escort');   // he moved; she follows
    }
  }
  else if(a.state === 'escorting' && a.id === 'hr'){ sendTo(w, a, a.home, 'returning'); }
  else if(a.state === 'hrvisit' && a.id === 'hr'){
    // Meredith reaches the kitchen with her Concerned Face; Kayla is sent home
    const kayla = getActor(w, 'kayla');
    if(kayla && !kayla.off){
      kayla.pinned = false; kayla.path = [];
      sendTo(w, kayla, EXIT_SPOT, 'senthome');
    }
    sendTo(w, a, a.home, 'returning');
  }
  else if(a.state === 'senthome' && a.id === 'kayla'){
    a.off = true; a.state = 'idle';
    w.sig.push({ type:'kaylasenthome' });
  }
  else if(a.state === 'escorted' && a.id === 'brad'){
    // through the door. Off the floor, off payroll(s), out of the raid schedule —
    // and two of his deliverables land in your inbox before the door shuts.
    a.off = true; a.state = 'idle';
    if(w.firing) w.firing.phase = 'done';
    w.sig.push({ type: 'bradfired' });
    w.tasks.pending += 2; w.tasks.total += 2; w.tasks.spawned += 2;
    w.sig.push({ type: 'bradtasks', pending: w.tasks.pending });
  }
  else { a.state = 'idle'; }
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
  } else if(e.type === 'exit'){
    w.playerErrand = null;
    w.sig.push({ type:'walkout' });   // you reached the door with your number banked
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
  } else if(e.type === 'kaylatask'){
    const kayla = getActor(w, 'kayla');
    if(!kayla || kayla.off || w.kaylaTaskTaken){ w.playerErrand = null; }
    else if(Math.hypot(kayla.x - you.x, kayla.y - you.y) <= 2.2){
      w.playerErrand = null;
      w.kaylaTaskTaken = true;
      w.tasks.pending++; w.tasks.total++; w.tasks.spawned++;   // her subplot, your stack
      w.sig.push({ type:'kaylatask', pending: w.tasks.pending });
    } else if(e.repaths < 3){
      e.repaths++;
      sendTo(w, you, adjacentTo(w, kayla), 'errand');
    } else {
      w.playerErrand = null;
    }
  } else if(e.type === 'quickcall'){
    const boss = getActor(w, 'boss');
    if(!w.summons || w.summons.status !== 'open'){
      w.playerErrand = null;             // it expired while you walked; nothing here
    } else if(Math.hypot(boss.x - you.x, boss.y - you.y) <= 2.5){
      w.playerErrand = null;
      w.summons.status = 'taken';
      w.running = false;                 // the door closes; the card opens
      w.sig.push({ type:'quickcall' });
    } else if(e.repaths < 3){
      e.repaths++;
      sendTo(w, you, adjacentTo(w, boss), 'errand');
    } else {
      w.playerErrand = null;
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
  if(!playerAtDesk(w)){
    if(w.tasks.pending > 0){
      // he lifts the file you were furthest through
      w.tasks.pending--;
      w.tasks.progress = 0;
      w.sig.push({ type:'bradsteal', pending: w.tasks.pending });
    } else {
      w.sig.push({ type:'bradempty' });   // empty chair, empty inbox: nothing to take
    }
  } else {
    w.sig.push({ type:'bradfoiled' });    // you were sitting right there
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
function armWalkout(w){ w.walkoutArmed = true; }
function goForExit(w){
  if(!w.walkoutArmed) return false;
  const you = getActor(w, 'you');
  if(!sendTo(w, you, EXIT_SPOT, 'errand')) return false;
  w.playerErrand = { type:'exit', repaths: 0 };
  w.moveMarker = EXIT_SPOT;
  return true;
}
function takeKaylaTask(w){
  if(!w.flags.kaylaPanic || w.kaylaTaskTaken) return false;
  const kayla = getActor(w, 'kayla');
  const you = getActor(w, 'you');
  if(!kayla || kayla.off || !sendTo(w, you, adjacentTo(w, kayla), 'errand')) return false;
  w.playerErrand = { type: 'kaylatask', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function reportKayla(w){
  if(!w.flags.kaylaPanic || w.kaylaReported) return false;
  const hr = getActor(w, 'hr');
  const kayla = getActor(w, 'kayla');
  if(!hr || !kayla || kayla.off) return false;
  hr.path = [];
  if(!sendTo(w, hr, adjacentTo(w, kayla), 'hrvisit')) return false;
  w.kaylaReported = true;
  return true;
}
function goForBossCall(w){
  if(!w.summons || w.summons.status !== 'open') return false;
  const boss = getActor(w, 'boss');
  const you = getActor(w, 'you');
  if(!boss || !sendTo(w, you, adjacentTo(w, boss), 'errand')) return false;
  w.playerErrand = { type: 'quickcall', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function resolveQuickCall(w){
  if(w.summons) w.summons.status = 'done';
  w.running = true;
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
    if(a.off) return;   // walked out; not clickable, not here
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
function isExitAt(gx, gy){
  const f = furnitureAt(gx, gy);
  return !!f && f.id === 'exit';
}
function statusOf(w, actor){
  if(actor.id === 'you') return { name:'You', role: actor.role, mood: null,
    line:'Tasks ship at your desk. Soul refills everywhere else. Choose.', face:'🦡', chat:false };
  // the Brad arc shifts his status line before any card ever fires
  if(actor.id === 'brad' && w.flags && w.flags.bradCalls){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '📵',
      line: '“On a call.” It is the fourth call today. None of the calls have meeting links.',
      chat: false };
  }
  // Kayla's panic day: the popup carries the physical options
  if(actor.id === 'kayla' && w.flags && w.flags.kaylaPanic && !actor.off){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '😶‍🌫️',
      line: '“I’m fine. It’s fine. The deck is fine.” The deck is on version 31 and she is in the kitchen.',
      chat: !w.chatted[actor.id],           // "chat" = walk over and sit with her
      sitWith: !w.chatted[actor.id],
      kaylatask: !w.kaylaTaskTaken };
  }
  if(actor.id === 'hr' && w.flags && w.flags.kaylaPanic && !w.kaylaReported){
    return { name: actor.name, role: actor.role, mood: actor.mood,
      face: MOOD_FACE[actor.mood],
      line: actor.lines ? actor.lines[actor.mood] : '',
      chat: false, reportkayla: true };
  }
  return {
    name: actor.name, role: actor.role, mood: actor.mood,
    face: MOOD_FACE[actor.mood],
    line: actor.lines ? actor.lines[actor.mood] : '',
    chat: !!actor.chat && !w.chatted[actor.id],
    quickcall: actor.id === 'boss' && !!(w.summons && w.summons.status === 'open')
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

// deterministic per-tile hash — texture without a single random call
function tileHash(x, y){
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// carpet-tile palette: 4×4 blocks alternate tone, tiles jitter within a block
const CARPET = ['#EBE3CE', '#EEE6D3', '#E4DBC3', '#E8DFC9'];

// one wall segment (face, cap, baseboard, optional window with a sky glint)
function wallSeg(ctx, ax, ay, bx, by, H, face, cap, hasWindow, z){
  ctx.beginPath();
  ctx.moveTo(ax, ay - H); ctx.lineTo(bx, by - H); ctx.lineTo(bx, by); ctx.lineTo(ax, ay);
  ctx.closePath(); ctx.fillStyle = face; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ax, ay - H); ctx.lineTo(bx, by - H);
  ctx.lineTo(bx, by - H + 3.5 * z); ctx.lineTo(ax, ay - H + 3.5 * z);
  ctx.closePath(); ctx.fillStyle = cap; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  ctx.lineTo(bx, by - 4 * z); ctx.lineTo(ax, ay - 4 * z);
  ctx.closePath(); ctx.fillStyle = 'rgba(21,18,13,0.14)'; ctx.fill();
  if(hasWindow){
    const ix1 = ax + (bx - ax) * 0.16, iy1 = ay + (by - ay) * 0.16;
    const ix2 = ax + (bx - ax) * 0.84, iy2 = ay + (by - ay) * 0.84;
    ctx.beginPath();
    ctx.moveTo(ix1, iy1 - H * 0.82); ctx.lineTo(ix2, iy2 - H * 0.82);
    ctx.lineTo(ix2, iy2 - H * 0.28); ctx.lineTo(ix1, iy1 - H * 0.28);
    ctx.closePath();
    ctx.fillStyle = '#8FE4DA'; ctx.fill();
    ctx.strokeStyle = 'rgba(21,18,13,0.28)'; ctx.lineWidth = 1.2 * z; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix1, iy1 - H * 0.82); ctx.lineTo(ix2, iy2 - H * 0.82);
    ctx.lineTo(ix2, iy2 - H * 0.60); ctx.lineTo(ix1, iy1 - H * 0.60);
    ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  }
}

// an empty office chair (also what everyone is sitting on)
function drawChair(ctx, cam, gx, gy){
  const z = cam.z;
  const [px, py] = proj(cam, gx, gy);
  ctx.beginPath(); ctx.ellipse(px, py + 1.5 * z, 6 * z, 2.8 * z, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(21,18,13,0.22)'; ctx.fill();          // caster shadow
  ctx.fillStyle = '#3f3c36';
  ctx.fillRect(px - 1.3 * z, py - 10 * z, 2.6 * z, 11 * z);   // post
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(px - 7.5 * z, py - 26 * z, 15 * z, 12 * z, 4 * z);
  else ctx.rect(px - 7.5 * z, py - 26 * z, 15 * z, 12 * z);
  ctx.fillStyle = '#524e46'; ctx.fill();                       // backrest
  ctx.beginPath(); ctx.ellipse(px, py - 9 * z, 8.5 * z, 4.6 * z, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#5c5850'; ctx.fill();                       // seat
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
      const block = ((x >> 2) + (y >> 2)) & 1;
      const hsh = tileHash(x, y);
      ctx.fillStyle = CARPET[block * 2 + (hsh < 0.35 ? 0 : 1)];
      ctx.fill();
      ctx.strokeStyle = 'rgba(21,18,13,0.04)'; ctx.lineWidth = 1; ctx.stroke();
      // carpet flecks
      if(hsh > 0.84 && z > 0.7){
        const ox = (tileHash(x + 101, y) - 0.5) * TW * 0.4 * z;
        const oy = (tileHash(x, y + 77) - 0.5) * TH * 0.4 * z;
        ctx.fillStyle = 'rgba(21,18,13,0.06)';
        ctx.fillRect(px + ox, py + oy, 2 * z, 1.4 * z);
      }
    }
  }

  // the floor is a slab: a dark skirt along the two front edges
  (() => {
    const [e1x, e1y] = proj(cam, GRID_W - 0.5, -0.5);
    const [e2x, e2y] = proj(cam, GRID_W - 0.5, GRID_H - 0.5);
    const [e3x, e3y] = proj(cam, -0.5, GRID_H - 0.5);
    const D = 12 * z;
    ctx.fillStyle = 'rgba(21,18,13,0.22)';
    ctx.beginPath();
    ctx.moveTo(e1x, e1y); ctx.lineTo(e2x, e2y); ctx.lineTo(e2x, e2y + D); ctx.lineTo(e1x, e1y + D);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(21,18,13,0.30)';
    ctx.beginPath();
    ctx.moveTo(e2x, e2y); ctx.lineTo(e3x, e3y); ctx.lineTo(e3x, e3y + D); ctx.lineTo(e2x, e2y + D);
    ctx.closePath(); ctx.fill();
  })();

  ZONES.forEach(zn => {
    ctx.beginPath();
    const c = [[zn.x, zn.y],[zn.x + zn.w, zn.y],[zn.x + zn.w, zn.y + zn.d],[zn.x, zn.y + zn.d]];
    c.forEach(([gx, gy], i) => {
      const [px, py] = proj(cam, gx - 0.5, gy - 0.5);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath(); ctx.fillStyle = zn.color; ctx.fill();
    ctx.strokeStyle = 'rgba(21,18,13,0.10)'; ctx.lineWidth = 1.4 * z; ctx.stroke();
    // the name plate is a floor decal: under the furniture, under the people
    const [lx, ly] = proj(cam, zn.x + zn.w / 2 - 0.5, zn.y + zn.d / 2 - 0.5);
    ctx.font = '700 ' + Math.max(8, 9.5 * z) + 'px Poppins, sans-serif';
    ctx.textAlign = 'center';
    const tw2 = ctx.measureText(zn.label).width;
    ctx.fillStyle = 'rgba(244,237,218,0.5)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(lx - tw2 / 2 - 7 * z, ly - 8 * z, tw2 + 14 * z, 14 * z, 7 * z);
    else ctx.rect(lx - tw2 / 2 - 7 * z, ly - 8 * z, tw2 + 14 * z, 14 * z);
    ctx.fill();
    ctx.strokeStyle = 'rgba(21,18,13,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(21,18,13,0.45)';
    ctx.fillText(zn.label, lx, ly + 3.5 * z);
  });

  // back walls with windows (the west wall breaks for the EXIT door)
  for(let x = 0; x < GRID_W; x++){
    const [ax, ay] = proj(cam, x - 0.5, -0.5);
    const [bx, by] = proj(cam, x + 0.5, -0.5);
    if(bx < -TW * z || ax > vw + TW * z) continue;
    wallSeg(ctx, ax, ay, bx, by, 48 * z, '#DAD2BD', '#C7BFA8', (x % 3) === 1, z);
  }
  for(let y = 0; y < GRID_H; y++){
    if(y === 16 || y === 17) continue;               // the EXIT breaks the wall
    const [ax, ay] = proj(cam, -0.5, y - 0.5);
    const [bx, by] = proj(cam, -0.5, y + 0.5);
    if(ax < -TW * z && bx < -TW * z) continue;
    wallSeg(ctx, ax, ay, bx, by, 48 * z, '#CEC6AF', '#BBB39C', (y % 3) === 1, z);
  }


  // interaction-spot rings: the places where standing there DOES something.
  // Pulse phase rides the game clock so it freezes politely with the world.
  const phase = w.clockMin * 1.6;
  const you0 = getActor(w, 'you');
  drawSpotRing(ctx, cam, you0.home, 'rgba(47,107,224,0.6)', phase);
  if(!w.coffeeUsed) drawSpotRing(ctx, cam, COFFEE_SPOT, 'rgba(62,158,94,0.55)', phase + 2);
  if(!w.couchUsed)  drawSpotRing(ctx, cam, COUCH_SPOT, 'rgba(232,129,76,0.55)', phase + 4);
  if(w.walkoutArmed) drawSpotRing(ctx, cam, { x: 1, y: 17 }, 'rgba(46,158,99,0.8)', phase + 1);

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
  w.actors.forEach(a => { if(!a.off) drawables.push({ d: a.x + a.y + 0.01, a }); });
  drawables.sort((p, q) => p.d - q.d);
  drawables.forEach(item => {
    if(item.f) drawBox(ctx, cam, item.f, w);
    else drawActor(ctx, cam, item.a, w);
  });

  // a soft vignette: fluorescent lighting, but make it cinematic
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.38,
                                      vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
  vg.addColorStop(0, 'rgba(21,18,13,0)');
  vg.addColorStop(1, 'rgba(21,18,13,0.10)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);

  // off-screen threat arrows: a patrol/raid you can't see is still coming
  w.actors.forEach(a => {
    const threat = (a.id === 'boss' && a.state === 'patrol') || (a.id === 'brad' && a.state === 'raid');
    if(!threat) return;
    const [px, py] = proj(cam, a.x, a.y);
    if(px >= -10 && px <= vw + 10 && py >= -40 && py <= vh + 10) return;   // on screen
    const ex = Math.max(26, Math.min(vw - 26, px));
    const ey = Math.max(26, Math.min(vh - 26, py));
    const ang = Math.atan2(py - ey, px - ex);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-7, -9); ctx.lineTo(-3, 0); ctx.lineTo(-7, 9);
    ctx.closePath();
    ctx.fillStyle = '#D8443F'; ctx.fill();
    ctx.strokeStyle = 'rgba(21,18,13,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#D8443F';
    ctx.font = '800 10px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(a.id === 'boss' ? 'BOSS' : 'BRAD', ex, ey + 22);
  });
}

// A pulsing diamond outline on a floor tile: "standing here does something."
function drawSpotRing(ctx, cam, tile, color, phase){
  const [px, py] = proj(cam, tile.x, tile.y);
  const z = cam.z, p = 0.72 + 0.12 * Math.sin(phase);
  ctx.beginPath();
  ctx.moveTo(px, py - (TH / 2) * z * p);
  ctx.lineTo(px + (TW / 2) * z * p, py);
  ctx.lineTo(px, py + (TH / 2) * z * p);
  ctx.lineTo(px - (TW / 2) * z * p, py);
  ctx.closePath();
  ctx.strokeStyle = color; ctx.lineWidth = 2.6 * z; ctx.stroke();
}

function shade(hex, f){
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  const g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  const b = Math.min(255, (n & 255) * f) | 0;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// potted plants deserve better than a green cube
function drawPlant(ctx, cam, f, z){
  const [px, py] = proj(cam, f.x, f.y);
  ctx.beginPath(); ctx.ellipse(px, py + 2 * z, 9 * z, 4 * z, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(21,18,13,0.18)'; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px - 8 * z, py - 8 * z); ctx.lineTo(px + 8 * z, py - 8 * z);
  ctx.lineTo(px + 5.5 * z, py + 2 * z); ctx.lineTo(px - 5.5 * z, py + 2 * z);
  ctx.closePath(); ctx.fillStyle = '#A5623F'; ctx.fill();
  ctx.fillStyle = '#8A4F33'; ctx.fillRect(px - 8 * z, py - 10.5 * z, 16 * z, 3 * z);
  [[-6, -17, 6.5, '#4E7A4E'], [6, -18, 6.5, '#477147'], [0, -26, 8.5, '#5C8A54'], [-1, -14, 5, '#446B44']]
    .forEach(([ox, oy, r, c2]) => {
      ctx.beginPath(); ctx.arc(px + ox * z, py + oy * z, r * z, 0, Math.PI * 2);
      ctx.fillStyle = c2; ctx.fill();
    });
  ctx.beginPath(); ctx.arc(px - 2 * z, py - 28 * z, 3 * z, 0, Math.PI * 2);
  ctx.fillStyle = '#6E9C63'; ctx.fill();
}

// the back of a monitor: every desk gets one
function drawMonitor(ctx, cam, f, hpx, z){
  const [mx, my] = proj(cam, f.x + f.w / 2 - 0.5, f.y + f.d / 2 - 0.5);
  const ty = my - hpx;
  ctx.fillStyle = '#33302b';
  ctx.beginPath(); ctx.ellipse(mx, ty - 1 * z, 5 * z, 2.2 * z, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(mx - 1.4 * z, ty - 9 * z, 2.8 * z, 8 * z);
  ctx.beginPath();
  ctx.moveTo(mx - 12 * z, ty - 9 * z);
  ctx.lineTo(mx + 12 * z, ty - 13 * z);
  ctx.lineTo(mx + 12 * z, ty - 26 * z);
  ctx.lineTo(mx - 12 * z, ty - 22 * z);
  ctx.closePath();
  ctx.fillStyle = '#23262b'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1 * z; ctx.stroke();
}

function drawBox(ctx, cam, f, w){
  const z = cam.z, hpx = f.h * 34 * z;
  if(f.id.indexOf('plant') === 0){ drawPlant(ctx, cam, f, z); return; }
  // Brad's desk after the walk-out: a rectangle of cleaner carpet
  const col = (f.id === 'desk-brad' && w && w.flags && w.flags.bradGone) ? '#c9c1af' : f.color;
  const p = (gx, gy) => proj(cam, gx - 0.5, gy - 0.5);
  const [ax, ay] = p(f.x, f.y), [bx, by] = p(f.x + f.w, f.y);
  const [cx, cy] = p(f.x + f.w, f.y + f.d), [dx, dy] = p(f.x, f.y + f.d);
  // meeting-room chairs on the far side sit behind the table
  if(f.id === 'table-meet'){ drawChair(ctx, cam, 16, 3); drawChair(ctx, cam, 17, 3); }
  ctx.beginPath(); ctx.moveTo(ax, ay - hpx); ctx.lineTo(bx, by - hpx);
  ctx.lineTo(cx, cy - hpx); ctx.lineTo(dx, dy - hpx); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.moveTo(bx, by - hpx); ctx.lineTo(cx, cy - hpx);
  ctx.lineTo(cx, cy); ctx.lineTo(bx, by); ctx.closePath();
  ctx.fillStyle = shade(col, 0.72); ctx.fill();
  ctx.beginPath(); ctx.moveTo(dx, dy - hpx); ctx.lineTo(cx, cy - hpx);
  ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath();
  ctx.fillStyle = shade(col, 0.55); ctx.fill();
  // the second laptop: a small extra machine on Brad's desk, lid up, screen lit
  // in a blue-white that is not this company's blue-white
  if(f.id === 'desk-brad' && w && w.flags && w.flags.bradLaptop && !w.flags.bradGone){
    const [lx, ly] = proj(cam, f.x + 0.35 - 0.5, f.y + 0.2 - 0.5);
    const ty = ly - hpx;
    ctx.fillStyle = '#22262b';                                     // base slab
    ctx.beginPath();
    ctx.moveTo(lx, ty - 2 * z); ctx.lineTo(lx + 9 * z, ty + 2.5 * z);
    ctx.lineTo(lx, ty + 7 * z); ctx.lineTo(lx - 9 * z, ty + 2.5 * z);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dfe9f5';                                     // the lit lid
    ctx.beginPath();
    ctx.moveTo(lx - 9 * z, ty + 2.5 * z); ctx.lineTo(lx - 9 * z, ty - 8 * z);
    ctx.lineTo(lx, ty - 12 * z); ctx.lineTo(lx, ty - 2 * z);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#22262b'; ctx.lineWidth = 1 * z; ctx.stroke();
  }
  // ---- per-piece dressing: the difference between "boxes" and "an office" ----
  if(f.id.indexOf('desk-') === 0){
    drawChair(ctx, cam, f.x + Math.floor(f.w / 2), f.y + f.d);
    if(!(w && w.flags && w.flags.bradGone && f.id === 'desk-brad'))
      drawMonitor(ctx, cam, f, hpx, z);
  }
  if(f.id === 'table-meet'){ drawChair(ctx, cam, 16, 6); drawChair(ctx, cam, 17, 6); }
  if(f.id === 'table-kitch'){ drawChair(ctx, cam, 22, 13); drawChair(ctx, cam, 23, 13); }
  if(f.id === 'couch'){
    // backrest slab + cushion seams
    ctx.beginPath();
    ctx.moveTo(ax, ay - hpx - 13 * z); ctx.lineTo(bx, by - hpx - 13 * z);
    ctx.lineTo(bx, by - hpx + 5 * z); ctx.lineTo(ax, ay - hpx + 5 * z);
    ctx.closePath(); ctx.fillStyle = shade(col, 1.12); ctx.fill();
    const vx = dx - ax, vy = dy - ay;
    ctx.strokeStyle = shade(col, 0.78); ctx.lineWidth = 1.4 * z;
    for(let i = 1; i < 3; i++){
      const t = i / 3;
      const sx = ax + (bx - ax) * t, sy = ay + (by - ay) * t;
      ctx.beginPath(); ctx.moveTo(sx, sy - hpx); ctx.lineTo(sx + vx, sy + vy - hpx); ctx.stroke();
    }
  }
  if(f.id === 'coffee'){
    const cxm = (dx + cx) / 2, cym = (dy + cy) / 2 - hpx * 0.55;
    ctx.beginPath(); ctx.arc(cxm, cym, 2.2 * z, 0, Math.PI * 2);
    ctx.fillStyle = '#D8443F'; ctx.fill();
    ctx.beginPath(); ctx.arc(cxm, cym, 3.8 * z, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1 * z; ctx.stroke();
  }
  if(f.id === 'fridge'){
    ctx.strokeStyle = 'rgba(21,18,13,0.4)'; ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.moveTo(dx + (cx - dx) * 0.22, dy + (cy - dy) * 0.22 - hpx * 0.85);
    ctx.lineTo(dx + (cx - dx) * 0.22, dy + (cy - dy) * 0.22 - hpx * 0.5);
    ctx.stroke();
  }
  if(f.id === 'printer'){
    const [tx2, ty2] = proj(cam, f.x, f.y);
    ctx.fillStyle = '#f0ece0';
    ctx.fillRect(tx2 - 7 * z, ty2 - hpx - 2 * z, 14 * z, 3 * z);
    ctx.beginPath(); ctx.arc((bx + cx) / 2, (by + cy) / 2 - hpx * 0.6, 1.8 * z, 0, Math.PI * 2);
    ctx.fillStyle = '#7CF5B4'; ctx.fill();
  }
  if(f.id === 'stairs'){
    ctx.strokeStyle = 'rgba(21,18,13,0.35)'; ctx.lineWidth = 1.6 * z;
    for(let i = 1; i < 4; i++){
      const t = i / 4;
      const sx1 = ax + (dx - ax) * t, sy1 = ay + (dy - ay) * t;
      const sx2 = bx + (cx - bx) * t, sy2 = by + (cy - by) * t;
      ctx.beginPath(); ctx.moveTo(sx1, sy1 - hpx); ctx.lineTo(sx2, sy2 - hpx); ctx.stroke();
    }
  }
  // the armed EXIT glows: your number is banked, the door is live
  if(f.id === 'exit' && w && w.walkoutArmed){
    ctx.beginPath(); ctx.moveTo(ax, ay - hpx); ctx.lineTo(bx, by - hpx);
    ctx.lineTo(cx, cy - hpx); ctx.lineTo(dx, dy - hpx); ctx.closePath();
    ctx.strokeStyle = '#7CF5B4'; ctx.lineWidth = 3 * z; ctx.stroke();
  }
  if(f.id === 'exit'){
    // a proper glowing EXIT sign instead of floating text
    const [lx, ly] = proj(cam, f.x + f.w / 2 - 0.5, f.y + f.d / 2 - 0.5);
    const sy = ly - hpx - 15 * z;
    ctx.font = '800 ' + Math.max(8, 9 * z) + 'px Poppins, sans-serif';
    ctx.textAlign = 'center';
    const tw2 = ctx.measureText('EXIT').width;
    ctx.fillStyle = (w && w.walkoutArmed) ? '#2E9E63' : '#26543C';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(lx - tw2 / 2 - 5 * z, sy - 7 * z, tw2 + 10 * z, 13 * z, 3 * z);
    else ctx.rect(lx - tw2 / 2 - 5 * z, sy - 7 * z, tw2 + 10 * z, 13 * z);
    ctx.fill();
    ctx.fillStyle = '#EAFBF1';
    ctx.fillText('EXIT', lx, sy + 3 * z);
  } else if(f.label){
    const [lx, ly] = proj(cam, f.x + f.w / 2 - 0.5, f.y + f.d / 2 - 0.5);
    ctx.fillStyle = 'rgba(21,18,13,0.8)';
    ctx.font = '700 ' + Math.max(8, 9 * z) + 'px Poppins, sans-serif';
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
    ctx.font = '800 ' + Math.max(9, 11 * z) + 'px Poppins, sans-serif';
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
  ctx.strokeStyle = 'rgba(21,18,13,0.35)'; ctx.lineWidth = 1.3 * z; ctx.stroke();
  ctx.beginPath(); ctx.arc(px, py - 26 * z, 6.5 * z, 0, Math.PI * 2);
  ctx.fillStyle = a.bear ? '#7d7871' : '#E8C39E'; ctx.fill();   // badger gray
  ctx.strokeStyle = 'rgba(21,18,13,0.3)'; ctx.lineWidth = 1.1 * z; ctx.stroke();
  if(a.bear){
    ctx.beginPath(); ctx.arc(px - 5 * z, py - 31 * z, 2.6 * z, 0, Math.PI * 2);
    ctx.arc(px + 5 * z, py - 31 * z, 2.6 * z, 0, Math.PI * 2);
    ctx.fillStyle = '#35322e'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(px, py - 23.5 * z, 3.4 * z, 2.4 * z, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d9d2c4'; ctx.fill();                       // the pale snout
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
  // your status chip: what standing HERE is doing, right now
  if(a.id === 'you' && w && !a.path.length){
    let chip = null, cc = '#2F6BE0';
    if(playerAtDesk(w)){
      chip = w.tasks.pending > 0 ? 'WORKING…' : 'AT DESK · INBOX ZERO';
      cc = w.tasks.pending > 0 ? '#2E9E63' : '#5C5647';
    }
    else if(Math.hypot(a.x - COFFEE_SPOT.x, a.y - COFFEE_SPOT.y) < 0.8){ chip = 'COFFEE'; cc = '#2E9E63'; }
    else if(Math.hypot(a.x - COUCH_SPOT.x, a.y - COUCH_SPOT.y) < 0.8){ chip = 'FIVE MINUTES'; cc = '#E8814C'; }
    else { chip = 'NOT WORKING'; cc = '#8A8371'; }
    if(chip){
      ctx.font = '700 ' + Math.max(8, 9 * z) + 'px Poppins, sans-serif';
      const tw = ctx.measureText(chip).width;
      const cy2 = py - 48 * z, pad = 6 * z;
      ctx.fillStyle = 'rgba(244,237,218,0.92)';
      ctx.strokeStyle = cc; ctx.lineWidth = 1.2 * z;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(px - tw / 2 - pad, cy2 - 8 * z, tw + pad * 2, 14 * z, 7 * z);
      else ctx.rect(px - tw / 2 - pad, cy2 - 8 * z, tw + pad * 2, 14 * z);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = cc;
      ctx.textAlign = 'center';
      ctx.fillText(chip, px, cy2 + 3 * z);
    }
  }
  ctx.fillStyle = 'rgba(21,18,13,0.65)';
  ctx.font = '700 ' + Math.max(8, 8.5 * z) + 'px Poppins, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(a.id === 'you' ? 'YOU' : a.name.split(' ')[0].toUpperCase(), px, py + 12 * z);
}

return {
  GRID_W, GRID_H, TW, TH, CAST, FURNITURE, ZONES, OWNER_BY_ENC, STAIRS_SPOT,
  TASKS_MIN, TASKS_MAX, TASK_WORK_SECS, CRUNCH_CHANCE, CLOCK_SPEED,
  setEncounters, newDay, step, resolveEncounter, resolveCrunch, eventsRemaining,
  movePlayer, goForCoffee, goForCouch, requestChat, playerGoHome, playerAtDesk,
  armWalkout, goForExit, goForBossCall, resolveQuickCall, takeKaylaTask, reportKayla,
  sendTo, bfsPath, isWalkable, adjacentTo, getActor,
  pickActorAt, furnitureAt, isCoffeeAt, isCouchAt, isExitAt, statusOf, clockToMin, minToClock,
  render, proj, screenToTile
};
})();

// browser + headless-test exposure
if (typeof window !== 'undefined') window.NtosWorld = NtosWorld;
if (typeof module !== 'undefined' && module.exports) module.exports = NtosWorld;
