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
  { id:'desk-adam',   label:null,        x:18, y:15, w:2, d:1, h:0.55, color:'#7d858f' },
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
const APPROVAL_SPOT = { x:34, y:21 };    // The Pipe: where approvals go to be questioned
const APPROVAL_WAIT_SECS = 6;            // his questions, answered in real seconds
const LURK_SPOT = { x:11, y:14 };        // where Brad "refills his water" pre-raid
const DEMO_SPOT = { x:16, y:6 };         // meeting room: where demos are performed
const DEMO_PRESENT_SPOT = { x:17, y:6 }; // where the presenter stands, confidently

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
            bad:'Brad presented her numbers this morning.' } },
  // appended LAST so his seeding can ride a side stream (see newDay)
  { id:'adam',   name:'Adam',   role:'Institutional knowledge, self-appointed', color:'#A88C5F',
    spot:{x:19, y:16},
    lines:{ good:'Has concerns about the process. Would love to share them. Will regardless.',
            meh:'Was not consulted, and it shows, he says.',
            bad:'Drafting a memo about lanes, and who should stay in whose.' } }
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
             spawnAt: [], blocked: 0, blockedAt: [] },
    flatteredDennis: false,
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
  // seed wander timers + daily moods deterministically — Adam is EXCLUDED here
  // and seeded from a side stream below, so every pre-Adam seeded expectation
  // (moods, walks, raids, crunch, task loads) is byte-identical
  w.actors.forEach(a => {
    if(a.id === 'adam') return;
    a.wanderT = 2 + rand(w) * 6;
    if(a.id !== 'you') a.mood = MOODS[Math.floor(rand(w) * 3)];
  });
  (() => {
    let s = ((seed | 0) ^ Math.imul(day, 40503) ^ 0x5EEDADA) | 0;
    const ar = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const adam = getActor(w, 'adam');
    if(adam){ adam.wanderT = 2 + ar() * 6; adam.mood = MOODS[Math.floor(ar() * 3)]; }
    w.adamRolls = Array.from({ length: 12 }, ar);   // interception + usefulness rolls
    w.adamRollIdx = 0;
    // the concern walk: ~1 day in 3, Adam heads for HR "with a concern." Both
    // rolls always spent (same side stream, appended AFTER the original 12, so
    // every pre-existing Adam expectation is byte-identical). Interceptable.
    const concernRoll = ar(), concernMin = 620 + Math.floor(ar() * 260);
    w.adamConcern = (adam && concernRoll < 0.35)
      ? { atMin: concernMin, status: 'pending' } : null;
  })();
  w.adamIntercepts = 0;
  w.adamNextOk = 0;
  w.intercept = null;
  // Kayla's panic day: she's in the kitchen, and she's staying there
  if(flags.kaylaPanic){
    const kayla = getActor(w, 'kayla');
    if(kayla){ kayla.x = KITCHEN_CORNER.x; kayla.y = KITCHEN_CORNER.y; kayla.pinned = true; kayla.mood = 'bad'; }
  }
  // Priya's build week: heads down at her desk, visibly, until the demo lands
  if(flags.priyaGrind){
    const priya = getActor(w, 'priya');
    if(priya) priya.pinned = true;
  }
  w.kaylaTaskTaken = false;
  w.kaylaReported = false;
  w.webinarAnnounced = false;
  // schemes + interceptions: all once-a-day, all serialized on the world
  w.baitPlanted = false;        // the flawed file, left on top for Brad
  w.walkedWithDennis = false;   // the mid-carry escort clear (free, once)
  w.grenadeUsed = false;        // Adam, deployed at Dennis
  // the demo happens IN THE MEETING ROOM: Priya heads over early — reach her
  // there before it starts to collect the commit log or plant the flawed file
  w.demo = null;
  (flags.incidents || []).forEach(inc => {
    if(inc.id === 'priya_demo') w.demo = { atMin: inc.atMin, prepped: false };
  });
  // task drip: seeded daily load, 3 waiting at 9:00, the rest spread to ~3:30
  w.tasks.total = TASKS_MIN + Math.floor(rand(w) * (TASKS_MAX - TASKS_MIN + 1));
  w.tasks.spawnAt = [540, 540, 540];
  const drip = Math.floor(390 / Math.max(1, w.tasks.total - 3));
  for(let i = 3; i < w.tasks.total; i++) w.tasks.spawnAt.push(560 + (i - 3) * drip);
  // Dennis's blocker day: some arrivals are marked needs-approval at staging
  // (never the 9:00 three — the morning starts workable)
  w.tasks.blockedAt = w.tasks.spawnAt.map((at, i) =>
    !!flags.dennisBlocker && i >= 3 && rand(w) < 0.30);
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
  // heat: Brad paranoia adds a raid (rolled LAST so pre-heat staging never shifts)
  const extraRaids = (flags.noBradRaids || flags.bradGone) ? 0 : (flags.extraBradRaids || 0);
  for(let i = 0; i < extraRaids; i++)
    w.bradRaids.push({ atMin: 600 + Math.floor(rand(w) * 360), status: 'pending' });
  w.bradRaids.sort((a, b) => a.atMin - b.atMin);
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
    const needsApproval = !!w.tasks.blockedAt[w.tasks.spawned];
    w.tasks.spawned++;
    if(needsApproval){
      w.tasks.blocked++;
      w.sig.push({ type:'taskblocked', blocked: w.tasks.blocked });
    } else {
      w.tasks.pending++;
      w.sig.push({ type:'task', pending: w.tasks.pending });
    }
  }
  if(w.tasks.pending > 0 && playerAtDesk(w) && !you.path.length && !inWebinar){
    w.tasks.progress += dt / TASK_WORK_SECS;
    if(w.tasks.progress >= 1){
      w.tasks.progress = 0; w.tasks.pending--; w.tasks.done++;
      w.sig.push({ type:'taskdone', done: w.tasks.done, pending: w.tasks.pending });
    }
  }

  // ---- the interception: unsolicited advice at walking distance ----
  if(w.intercept){
    w.intercept.t += dt;
    if(w.intercept.t >= 2.5){
      const usefulRoll = w.adamRollIdx < w.adamRolls.length ? w.adamRolls[w.adamRollIdx++] : 1;
      const useful = usefulRoll < 0.15 && w.tasks.blocked > 0;
      if(useful){ w.tasks.blocked--; w.tasks.pending++; }   // he and Dennis go way back
      w.sig.push({ type:'adamintercept', useful });
      w.intercept = null;
      w.adamNextOk = w.clockMin + 60;
    }
  } else {
    const adamI = getActor(w, 'adam');
    if(adamI && !adamI.off && adamI.state === 'idle' && you.path.length
       && w.adamIntercepts < 2 && w.clockMin >= w.adamNextOk
       && Math.hypot(adamI.x - you.x, adamI.y - you.y) < 1.7){
      const roll = w.adamRollIdx < w.adamRolls.length ? w.adamRolls[w.adamRollIdx++] : 1;
      if(roll < 0.35){
        w.adamIntercepts++;
        w.intercept = { t: 0 };
      } else {
        w.adamNextOk = w.clockMin + 45;   // he let you pass. This time.
      }
    }
  }

  // ---- movement + wander ----
  w.actors.forEach(a => {
    if(a.id === 'you' && w.intercept) return;   // held mid-stride by the advice
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
      // Dennis with approvals held walks the files themselves, folder visibly
      // in hand, desk ↔ The Pipe. Catch him mid-carry to answer the questions
      // en route (a free clear). Destinations overridden only — the rand spend
      // below is identical, so nobody else's staging shifts on blocker days.
      const carrying = a.id === 'dennis' && w.flags.dennisBlocker && w.tasks.blocked > 0;
      if(r < 0.30){
        if(carrying){
          rand(w); rand(w);   // spend the tx/ty rolls this branch always spends
          const atPipe = Math.hypot(a.x - APPROVAL_SPOT.x, a.y - APPROVAL_SPOT.y) < 1.5;
          sendTo(w, a, atPipe ? a.home : APPROVAL_SPOT, 'carry');
          return;
        }
        if(stairbound){ sendTo(w, a, STAIRS_SPOT, 'walking'); return; }
        const tx = a.home.x + Math.floor(rand(w) * 7) - 3;
        const ty = a.home.y + Math.floor(rand(w) * 7) - 3;
        if(isWalkable(w, tx, ty)) sendTo(w, a, { x: tx, y: ty }, 'walking');
      } else if(r < 0.42){
        if(carrying){
          const atPipe = Math.hypot(a.x - APPROVAL_SPOT.x, a.y - APPROVAL_SPOT.y) < 1.5;
          sendTo(w, a, atPipe ? a.home : APPROVAL_SPOT, 'carry');
          return;
        }
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

  // ---- boss floor-walk (telegraphed: he stands up and reads the floor first) ----
  const boss = getActor(w, 'boss');
  w.bossWalks.forEach(bw => {
    if(bw.status === 'pending' && !bw.warned && w.clockMin >= bw.atMin - 20){
      bw.warned = true;   // the tell, ~20 game-min of warning to get back to your desk
      w.sig.push({ type: 'bosswalkwarn', mood: boss.mood });
    }
    if(bw.status === 'pending' && w.clockMin >= bw.atMin && boss.state === 'idle'){
      // mark 'out' only once the walk actually starts, else it hangs forever
      if(sendTo(w, boss, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'patrol')){
        bw.status = 'out';
        w.sig.push({ type:'bosswalk', mood: boss.mood });
      }
    }
  });

  // ---- brad raid (telegraphed: he lurks near the bullpen first, watchably) ----
  const brad = getActor(w, 'brad');
  w.bradRaids.forEach(br => {
    // the lurk: ~25 game-min before a raid he drifts to the water spot with
    // line of sight on your inbox. Click him to confront; sit tight to foil;
    // or leave the flawed file on top and go get coffee (the bait).
    if(br.status === 'pending' && !br.lurked && w.clockMin >= br.atMin - 25
       && brad && !brad.off && brad.state === 'idle'){
      br.lurked = true;
      if(sendTo(w, brad, LURK_SPOT, 'lurkwalk')) w.sig.push({ type: 'bradlurk' });
    }
    if(br.status === 'pending' && w.clockMin >= br.atMin && brad && !brad.off
       && (brad.state === 'idle' || brad.state === 'lurk')){
      if(sendTo(w, brad, adjacentTo(w, { x: you.home.x, y: you.home.y }), 'raid'))
        br.status = 'out';
    }
  });

  // ---- Adam's concern walk: he is heading to HR "with a concern" ----
  // Interceptable mid-walk: redirect him (eat the 2009 anecdote) or, on a
  // blocker day, point him at Dennis instead. If he lands, HR opens a folder.
  if(w.adamConcern && w.adamConcern.status === 'pending' && w.clockMin >= w.adamConcern.atMin){
    const adamC = getActor(w, 'adam');
    if(adamC && !adamC.off && adamC.state === 'idle' && !w.intercept){
      adamC.path = [];
      if(sendTo(w, adamC, adjacentTo(w, getActor(w, 'hr') || { x: 5, y: 6 }), 'concern')){
        w.adamConcern.status = 'walking';
        w.sig.push({ type: 'adamconcernstart' });
      }
    }
  }

  // ---- demo day: Priya heads to the meeting room early (the pre-demo window) ----
  if(w.demo && !w.demo.prepped && w.clockMin >= w.demo.atMin - 40){
    w.demo.prepped = true;
    const priyaD = getActor(w, 'priya');
    if(priyaD && !priyaD.off){
      priyaD.pinned = false; priyaD.path = [];
      if(sendTo(w, priyaD, DEMO_SPOT, 'demoprep')) w.sig.push({ type: 'demoprep' });
      else priyaD.pinned = true;
    }
  }

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

  // ---- the approval wait: standing in The Pipe, answering the questions ----
  if(w.playerErrand && w.playerErrand.type === 'approvalwait'){
    w.playerErrand.t += dt;
    if(w.playerErrand.t >= APPROVAL_WAIT_SECS){
      w.playerErrand = null;
      if(w.tasks.blocked > 0){ w.tasks.blocked--; w.tasks.pending++; }
      w.sig.push({ type:'approved', blocked: w.tasks.blocked, pending: w.tasks.pending });
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
      let owner = getActor(w, ev.owner);
      // the owner left the floor mid-day (fired, sent home): somebody else
      // delivers the news — a card may never strand the day
      if(!owner || owner.off){
        const sub = ['marcus', 'priya', 'kayla', 'boss', 'hr']
          .find(id => { const a = getActor(w, id); return a && !a.off; });
        if(sub){ ev.owner = sub; owner = getActor(w, sub); }
      }
      if(owner && !owner.off
         && (owner.state === 'idle' || owner.state === 'walking' || owner.state === 'returning')){
        owner.path = [];
        // the demo is performed in the MEETING ROOM (a hotspot you can see
        // filling up); every other event still walks its owner to your desk
        const target = (ev.kind === 'incident' && ev.id === 'priya_demo')
          ? DEMO_PRESENT_SPOT : adjacentTo(w, you);
        // status advances only if the walk starts; otherwise retry next tick
        if(sendTo(w, owner, target, 'summoned')) ev.status = 'walking';
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
  else if(a.state === 'lurkwalk' && a.id === 'brad'){ a.state = 'lurk'; }   // in position, watching
  else if(a.state === 'concern' && a.id === 'adam'){
    // he made it to HR. A concern has been raised. About whom is unclear.
    if(w.adamConcern) w.adamConcern.status = 'landed';
    w.sig.push({ type: 'adamconcern' });
    sendTo(w, a, a.home, 'returning');
  }
  else if(a.state === 'grenade' && a.id === 'adam'){
    // deployed at Dennis: they go way back. Way, WAY back. Outcome varies.
    w.sig.push({ type: 'adamgrenade' });
    sendTo(w, a, a.home, 'returning');
  }
  else if(a.state === 'demoprep' && a.id === 'priya'){
    a.state = 'idle'; a.pinned = true;   // in the room, holding the coffee she isn't drinking
  }
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
  } else if(e.type === 'approval'){
    // you made it to The Pipe: now you wait out the questions, visibly
    w.playerErrand = { type: 'approvalwait', t: 0 };
  } else if(e.type === 'flatter'){
    const dennis = getActor(w, 'dennis');
    if(!dennis || dennis.off || !w.tasks.blocked){ w.playerErrand = null; }
    else if(Math.hypot(dennis.x - you.x, dennis.y - you.y) <= 2.2){
      w.playerErrand = null;
      w.tasks.blocked--; w.tasks.pending++;
      w.sig.push({ type:'flattered', blocked: w.tasks.blocked, pending: w.tasks.pending });
    } else if(e.repaths < 3){
      e.repaths++;
      sendTo(w, you, adjacentTo(w, dennis), 'errand');
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
  } else if(e.type === 'confrontbrad'){
    // the interception: you walked at him while he was casing your inbox
    const brad = getActor(w, 'brad');
    if(!brad || brad.off || (brad.state !== 'lurk' && brad.state !== 'lurkwalk' && brad.state !== 'raid')){
      w.playerErrand = null;             // the moment passed
    } else if(Math.hypot(brad.x - you.x, brad.y - you.y) <= 2.2){
      w.playerErrand = null;
      // today's telegraphed raid is off; he remembers being seen
      w.bradRaids.forEach(b => { if(b.status === 'pending' || b.status === 'out') b.status = 'done'; });
      brad.path = [];
      sendTo(w, brad, brad.home, 'returning');
      w.sig.push({ type:'bradconfronted' });
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, brad), 'errand');
    } else { w.playerErrand = null; }
  } else if(e.type === 'flashbrad'){
    // the scheme: angle the phone. He recognizes the wallpaper. Raids end.
    const brad = getActor(w, 'brad');
    if(!brad || brad.off){ w.playerErrand = null; }
    else if(Math.hypot(brad.x - you.x, brad.y - you.y) <= 2.2){
      w.playerErrand = null;
      w.bradRaids.forEach(b => { if(b.status === 'pending' || b.status === 'out') b.status = 'done'; });
      if(brad.state === 'lurk' || brad.state === 'raid'){ brad.path = []; sendTo(w, brad, brad.home, 'returning'); }
      w.sig.push({ type:'bradflashed' });
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, brad), 'errand');
    } else { w.playerErrand = null; }
  } else if(e.type === 'baitdesk'){
    // back to your own desk to leave the flawed file on top of the stack
    w.playerErrand = null;
    if(w.tasks.pending > 0 && !w.baitPlanted){
      w.baitPlanted = true;
      w.sig.push({ type:'baitplanted' });
    }
  } else if(e.type === 'walkwith'){
    // caught Dennis mid-carry: answer the questions en route, one file clears
    const dennis = getActor(w, 'dennis');
    if(!dennis || dennis.off || !w.tasks.blocked || w.walkedWithDennis){ w.playerErrand = null; }
    else if(Math.hypot(dennis.x - you.x, dennis.y - you.y) <= 2.2){
      w.playerErrand = null;
      w.walkedWithDennis = true;
      w.tasks.blocked--; w.tasks.pending++;
      w.sig.push({ type:'dennisescort', blocked: w.tasks.blocked, pending: w.tasks.pending });
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, dennis), 'errand');
    } else { w.playerErrand = null; }
  } else if(e.type === 'redirectadam'){
    // step into his path and ask about 2009. HR never learns of the concern.
    const adam = getActor(w, 'adam');
    if(!adam || adam.off || adam.state !== 'concern'){ w.playerErrand = null; }
    else if(Math.hypot(adam.x - you.x, adam.y - you.y) <= 2.2){
      w.playerErrand = null;
      if(w.adamConcern) w.adamConcern.status = 'redirected';
      adam.path = [];
      sendTo(w, adam, adam.home, 'returning');
      w.sig.push({ type:'adamredirected' });
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, adam), 'errand');
    } else { w.playerErrand = null; }
  } else if(e.type === 'grenadeadam'){
    // the chaos grenade: point Adam at Dennis. He and Dennis go way back.
    const adam = getActor(w, 'adam');
    if(!adam || adam.off || w.grenadeUsed || !w.tasks.blocked){ w.playerErrand = null; }
    else if(Math.hypot(adam.x - you.x, adam.y - you.y) <= 2.2){
      w.playerErrand = null;
      w.grenadeUsed = true;
      if(w.adamConcern && w.adamConcern.status === 'walking') w.adamConcern.status = 'redirected';
      adam.path = [];
      const dennis = getActor(w, 'dennis');
      if(dennis && sendTo(w, adam, adjacentTo(w, dennis), 'grenade')){ /* he's off */ }
      else w.sig.push({ type:'adamgrenade' });   // Dennis unreachable: resolve in place
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, adam), 'errand');
    } else { w.playerErrand = null; }
  } else if(e.type === 'precollect' || e.type === 'preplant'){
    // the pre-demo window: reach Priya in the meeting room before it starts
    const priya = getActor(w, 'priya');
    const open = w.demo && w.demo.prepped && w.clockMin < w.demo.atMin;
    if(!priya || priya.off || !open){ w.playerErrand = null; }
    else if(Math.hypot(priya.x - you.x, priya.y - you.y) <= 2.2){
      const kind = e.type;
      w.playerErrand = null;
      w.sig.push({ type: kind });
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, priya), 'errand');
    } else { w.playerErrand = null; }
  } else if(e.type === 'coolhr'){
    // the scheme: ask Meredith about response IDs, hypothetically
    const hr = getActor(w, 'hr');
    if(!hr || hr.off){ w.playerErrand = null; }
    else if(Math.hypot(hr.x - you.x, hr.y - you.y) <= 2.2){
      w.playerErrand = null;
      w.sig.push({ type:'coolhr' });
    } else if(e.repaths < 3){
      e.repaths++; sendTo(w, you, adjacentTo(w, hr), 'errand');
    } else { w.playerErrand = null; }
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
    if(w.tasks.pending > 0 && w.baitPlanted){
      // THE SCHEME: he lifts the file you left on top. The flawed one.
      // You lose the task; he gains a presentation he cannot explain.
      w.baitPlanted = false;
      w.tasks.pending--;
      w.tasks.progress = 0;
      w.sig.push({ type:'bradpoisoned', pending: w.tasks.pending });
    } else if(w.tasks.pending > 0){
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
function goForApproval(w){
  if(!w.tasks.blocked || w.playerErrand) return false;
  const you = getActor(w, 'you');
  if(!sendTo(w, you, APPROVAL_SPOT, 'errand')) return false;
  w.playerErrand = { type: 'approval', repaths: 0 };
  w.moveMarker = APPROVAL_SPOT;
  return true;
}
function flatterDennis(w){
  if(!w.tasks.blocked || w.flatteredDennis || w.playerErrand) return false;
  const dennis = getActor(w, 'dennis');
  const you = getActor(w, 'you');
  if(!dennis || dennis.off || !sendTo(w, you, adjacentTo(w, dennis), 'errand')) return false;
  w.flatteredDennis = true;
  w.playerErrand = { type: 'flatter', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function clearAllBlocked(w){
  const n = w.tasks.blocked;
  w.tasks.pending += n;
  w.tasks.blocked = 0;
  return n;
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

// ── interceptions + schemes: react to what you can SEE crossing the floor ─────
function confrontBrad(w){
  const brad = getActor(w, 'brad');
  const you = getActor(w, 'you');
  if(!brad || brad.off || w.playerErrand) return false;
  if(brad.state !== 'lurk' && brad.state !== 'lurkwalk' && brad.state !== 'raid') return false;
  if(!sendTo(w, you, adjacentTo(w, brad), 'errand')) return false;
  w.playerErrand = { type: 'confrontbrad', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function flashBrad(w){
  const brad = getActor(w, 'brad');
  const you = getActor(w, 'you');
  if(!brad || brad.off || w.playerErrand) return false;
  if(!sendTo(w, you, adjacentTo(w, brad), 'errand')) return false;
  w.playerErrand = { type: 'flashbrad', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function plantBait(w){
  const you = getActor(w, 'you');
  if(w.playerErrand || w.baitPlanted || w.tasks.pending < 1) return false;
  if(playerAtDesk(w)){
    w.baitPlanted = true;
    w.sig.push({ type:'baitplanted' });
    return true;
  }
  if(!sendTo(w, you, you.home, 'errand')) return false;
  w.playerErrand = { type: 'baitdesk', repaths: 0 };
  w.moveMarker = { x: you.home.x, y: you.home.y };
  return true;
}
function walkWithDennis(w){
  const dennis = getActor(w, 'dennis');
  const you = getActor(w, 'you');
  if(!dennis || dennis.off || w.playerErrand || w.walkedWithDennis) return false;
  if(dennis.state !== 'carry' || !w.tasks.blocked) return false;
  if(!sendTo(w, you, adjacentTo(w, dennis), 'errand')) return false;
  w.playerErrand = { type: 'walkwith', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function redirectAdam(w){
  const adam = getActor(w, 'adam');
  const you = getActor(w, 'you');
  if(!adam || adam.off || w.playerErrand || adam.state !== 'concern') return false;
  if(!sendTo(w, you, adjacentTo(w, adam), 'errand')) return false;
  w.playerErrand = { type: 'redirectadam', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function grenadeAdam(w){
  const adam = getActor(w, 'adam');
  const you = getActor(w, 'you');
  if(!adam || adam.off || w.playerErrand || w.grenadeUsed || !w.tasks.blocked) return false;
  if(!sendTo(w, you, adjacentTo(w, adam), 'errand')) return false;
  w.playerErrand = { type: 'grenadeadam', repaths: 0 };
  w.moveMarker = null;
  return true;
}
function goPreDemo(w, kind){          // kind: 'precollect' | 'preplant'
  const priya = getActor(w, 'priya');
  const you = getActor(w, 'you');
  if(!priya || priya.off || w.playerErrand) return false;
  if(!w.demo || !w.demo.prepped || w.clockMin >= w.demo.atMin) return false;
  if(!sendTo(w, you, adjacentTo(w, priya), 'errand')) return false;
  w.playerErrand = { type: kind, repaths: 0 };
  w.moveMarker = null;
  return true;
}
function goForCoolHR(w){
  const hr = getActor(w, 'hr');
  const you = getActor(w, 'you');
  if(!hr || hr.off || w.playerErrand) return false;
  if(!sendTo(w, you, adjacentTo(w, hr), 'errand')) return false;
  w.playerErrand = { type: 'coolhr', repaths: 0 };
  w.moveMarker = null;
  return true;
}
// the grenade's outcome, applied by the shell after the brain rolls it
function applyGrenade(w, bypass){
  if(bypass){
    const n = w.tasks.blocked;
    w.tasks.pending += n; w.tasks.blocked = 0;
    return n;
  }
  if(w.tasks.pending > 0){ w.tasks.pending--; w.tasks.blocked++; }
  return -1;
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
  // Brad mid-lurk (or mid-raid): the interception window is OPEN
  if(actor.id === 'brad' && (actor.state === 'lurk' || actor.state === 'lurkwalk' || actor.state === 'raid')){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '👀',
      line: actor.state === 'raid'
        ? 'He is heading for your inbox. Right now. This is not a drill, which is ironic, given the fire drills.'
        : 'He has been refilling his water bottle for six minutes. The fountain faces your inbox.',
      chat: false,
      confront: true,
      plantbait: w.tasks.pending > 0 && !w.baitPlanted,
      bradLurking: true };
  }
  // the Brad arc shifts his status line before any card ever fires
  if(actor.id === 'brad' && w.flags && w.flags.bradCalls){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '📵',
      line: '“On a call.” It is the fourth call today. None of the calls have meeting links.',
      chat: false };
  }
  // Dennis mid-carry: catch him between desks and answer the questions en route
  if(actor.id === 'dennis' && actor.state === 'carry'){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '📁',
      line: 'He is walking one of YOUR files to The Pipe, at the pace of a man who bills by the step.',
      chat: false,
      walkwith: !w.walkedWithDennis && w.tasks.blocked > 0,
      approval: w.tasks.blocked > 0,
      flatter: w.tasks.blocked > 0 && !w.flatteredDennis,
      dennisBlocked: w.tasks.blocked };
  }
  // Adam en route to HR: interceptable, redirectable, weaponizable
  if(actor.id === 'adam' && actor.state === 'concern'){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '📋',
      line: 'He is walking to HR “with a concern.” The concern has three parts and a cover page.',
      chat: false,
      redirect: true,
      grenade: !w.grenadeUsed && w.tasks.blocked > 0 };
  }
  // Priya in the meeting room, pre-demo: the window is open until it starts
  if(actor.id === 'priya' && w.demo && w.demo.prepped && w.clockMin < w.demo.atMin && !actor.off
     && Math.hypot(actor.x - DEMO_SPOT.x, actor.y - DEMO_SPOT.y) < 2){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '☕',
      line: 'In the meeting room early, holding a coffee she isn’t drinking. The demo laptop is open. Unattended.',
      chat: false,
      precollect: true,
      preplant: true };
  }
  // Kayla's panic day: the popup carries the physical options
  if(actor.id === 'kayla' && w.flags && w.flags.kaylaPanic && !actor.off){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '😶‍🌫️',
      line: '“I’m fine. It’s fine. The deck is fine.” The deck is on version 31 and she is in the kitchen.',
      chat: !w.chatted[actor.id],           // "chat" = walk over and sit with her
      sitWith: !w.chatted[actor.id],
      kaylatask: !w.kaylaTaskTaken };
  }
  // Dennis on a blocker day: the popup explains the stack and offers the paths
  if(actor.id === 'dennis' && w.flags && w.flags.dennisBlocker){
    return { name: actor.name, role: actor.role, mood: actor.mood,
      face: MOOD_FACE[actor.mood],
      line: w.tasks.blocked > 0
        ? 'He “has questions” about ' + w.tasks.blocked + ' of your files. He has numbered the questions.'
        : 'Approvals required today. Nothing of yours is stuck. Yet.',
      chat: false,
      approval: w.tasks.blocked > 0,
      flatter: w.tasks.blocked > 0 && !w.flatteredDennis,
      dennisBlocked: w.tasks.blocked };
  }
  // Priya's build week: the grind is visible from her status line
  if(actor.id === 'priya' && w.flags && w.flags.priyaGrind && !actor.off){
    return { name: actor.name, role: actor.role, mood: actor.mood, face: '🎧',
      line: 'Do not ask if it’s done. It’s almost done. It has been almost done at 2 AM three nights running.',
      chat: !!actor.chat && !w.chatted[actor.id] };
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

// ── floor materials: every zone gets a real surface, not a tint ───────────────
// a/b = the material's two tones. kinds: carpet (blocks + jitter + flecks),
// checker (lino, hard alternation), wood (planks along x with seams).
const FLOOR_STYLES = [
  { kind:'carpet',  a:'#C7CDD3', b:'#BFC6CD', fleck:'rgba(21,18,13,0.08)' },   // THE BULLPEN
  { kind:'wood',    a:'#8A6A48', b:'#7C5F40' },                                // CORNER OFFICE
  { kind:'carpet',  a:'#E2CDC7', b:'#DBC4BD', fleck:'rgba(21,18,13,0.06)' },   // HR
  { kind:'checker', a:'#F1EDE0', b:'#D9D3C0' },                                // KITCHEN
  { kind:'carpet',  a:'#DEC2A4', b:'#D6B897', fleck:'rgba(21,18,13,0.07)' },   // MEETING ROOM
  { kind:'carpet',  a:'#CBC6AD', b:'#C2BDA2', fleck:'rgba(21,18,13,0.07)' },   // THE PIPE
  { kind:'carpet',  a:'#E7C6A2', b:'#DFBB94', fleck:'rgba(21,18,13,0.07)' }    // BREAK CORNER
];
const FLOOR_BASE = { kind:'carpet', a:'#E9E0C6', b:'#E2D8BB', fleck:'rgba(21,18,13,0.05)' };

// ── WORLD TOKENS: the canvas "design tokens" ──────────────────────────────────
// Every environmental surface colour (walls, glass, shadows, the atmospheric
// overlay) is named here so the office can be re-lit from ONE place — the canvas
// twin of :root in ntos-theme.css. Per-character / per-prop accents live in the
// CAST and FURNITURE data tables above (a.color / f.color). LIGHT drives the
// signature double key-light (warm 5pm gold vs. cold monitor-cyan) applied as an
// overlay in render(); see DESIGN_SYSTEM.md.
const WT = {
  wallBackFace:'#E0D7C1', wallBackCap:'#CFC5A9',   // north wall — warm paper
  wallSideFace:'#D5CBB2', wallSideCap:'#C2B89C',   // west wall
  // the glass carries the signature collision: warm evening sky, cool glint
  window:'#EAC98C', windowGlint:'rgba(143,183,201,0.5)',
  floorSkirtA:'rgba(28,20,10,0.26)', floorSkirtB:'rgba(20,14,7,0.34)',
  contactShadow:'rgba(34,22,10,0.22)',             // warm-tinted, never hard black
  vignette:'rgba(20,14,7,0.16)',
  // the double key-light (Bible §06/Phase 3): warm 5pm honey-gold flooding one
  // side, cold monitor-cyan pushing back from the other. Painted as a soft-light
  // overlay in render(); alphas ramp with time-of-day so the floor warms toward
  // 5 o'clock. Re-light the whole office from HERE and nowhere else.
  LIGHT:{
    warm:'#F4DCA6', warmAt:[0.10,-0.04],           // gold, top-left of frame
    cold:'#8FB7C9', coldAt:[1.02,1.06],            // cyan, bottom-right
    warmBase:0.10, warmDay:0.17,                   // gold alpha = base + day·t
    coldBase:0.16, coldDay:0.07,                   // cyan alpha = base − day·t
    rimWarm:'#F4DCA6', rimCold:'#8FB7C9',           // per-object key/fill rim
    monitorGlow:'#9FD0DE'                            // cool spill each screen casts
  }
};
// real-frame time (ms), stashed by render() so draw helpers can animate without
// threading it through every signature. Display-only; tests never call render().
let _tMs = 0;
// which zone owns each tile (computed once)
const ZONE_MAP = (() => {
  const m = new Int8Array(GRID_W * GRID_H).fill(-1);
  ZONES.forEach((zn, i) => {
    for(let dy = 0; dy < zn.d; dy++)
      for(let dx = 0; dx < zn.w; dx++)
        m[(zn.y + dy) * GRID_W + (zn.x + dx)] = i;
  });
  return m;
})();

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
    ctx.fillStyle = WT.window; ctx.fill();
    ctx.strokeStyle = 'rgba(21,18,13,0.28)'; ctx.lineWidth = 1.2 * z; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix1, iy1 - H * 0.82); ctx.lineTo(ix2, iy2 - H * 0.82);
    ctx.lineTo(ix2, iy2 - H * 0.60); ctx.lineTo(ix1, iy1 - H * 0.60);
    ctx.closePath(); ctx.fillStyle = WT.windowGlint; ctx.fill();
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

function render(w, ctx, cam, vw, vh, tMs){
  ctx.clearRect(0, 0, vw, vh);
  _tMs = tMs || 0;
  const z = cam.z;

  const w2 = (TW / 2) * z, hh = (TH / 2) * z;
  for(let y = 0; y < GRID_H; y++){
    for(let x = 0; x < GRID_W; x++){
      const [px, py] = proj(cam, x, y);
      if(px < -TW * z || px > vw + TW * z || py < -TH * z || py > vh + TH * z) continue;
      const zi = ZONE_MAP[y * GRID_W + x];
      const st = zi >= 0 ? FLOOR_STYLES[zi] : FLOOR_BASE;
      const hsh = tileHash(x, y);
      // corners: N top, E right, S bottom, W left
      const nx = px, ny = py - hh, ex = px + w2, ey = py,
            sx = px, sy = py + hh, wx = px - w2, wy = py;
      ctx.beginPath();
      ctx.moveTo(nx, ny); ctx.lineTo(ex, ey); ctx.lineTo(sx, sy); ctx.lineTo(wx, wy);
      ctx.closePath();
      if(st.kind === 'checker'){
        ctx.fillStyle = (x + y) % 2 ? st.a : st.b;
        ctx.fill();
        ctx.strokeStyle = 'rgba(21,18,13,0.06)'; ctx.lineWidth = 1; ctx.stroke();
      } else if(st.kind === 'wood'){
        const base = (y % 2) ? st.a : st.b;
        ctx.fillStyle = hsh < 0.3 ? shade(base, 0.95) : base;
        ctx.fill();
        // plank seams run along x: stroke the two row edges + occasional butt joint
        ctx.strokeStyle = 'rgba(21,18,13,0.20)'; ctx.lineWidth = 1.2 * z;
        ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(sx, sy); ctx.stroke();
        if(hsh > 0.72){
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(sx, sy); ctx.stroke();
        }
      } else {
        // carpet squares: 4×4 blocks alternate, tiles jitter inside a block
        const block = ((x >> 2) + (y >> 2)) & 1;
        ctx.fillStyle = block ? (hsh < 0.35 ? st.b : st.a) : (hsh < 0.35 ? st.a : st.b);
        ctx.fill();
        ctx.strokeStyle = 'rgba(21,18,13,0.05)'; ctx.lineWidth = 1; ctx.stroke();
        if(st.fleck && hsh > 0.8 && z > 0.7){
          const ox = (tileHash(x + 101, y) - 0.5) * TW * 0.4 * z;
          const oy = (tileHash(x, y + 77) - 0.5) * TH * 0.4 * z;
          ctx.fillStyle = st.fleck;
          ctx.fillRect(px + ox, py + oy, 2 * z, 1.4 * z);
        }
      }
      // a whisper of bevel: lit top edges, shaded bottom edges
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(nx, ny); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(21,18,13,0.045)';
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(sx, sy); ctx.lineTo(wx, wy); ctx.stroke();
    }
  }

  // the floor is a slab: a dark skirt along the two front edges
  (() => {
    const [e1x, e1y] = proj(cam, GRID_W - 0.5, -0.5);
    const [e2x, e2y] = proj(cam, GRID_W - 0.5, GRID_H - 0.5);
    const [e3x, e3y] = proj(cam, -0.5, GRID_H - 0.5);
    const D = 12 * z;
    ctx.fillStyle = WT.floorSkirtA;
    ctx.beginPath();
    ctx.moveTo(e1x, e1y); ctx.lineTo(e2x, e2y); ctx.lineTo(e2x, e2y + D); ctx.lineTo(e1x, e1y + D);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = WT.floorSkirtB;
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
    ctx.closePath();   // the materials ARE the zones now; just edge them
    ctx.strokeStyle = 'rgba(21,18,13,0.14)'; ctx.lineWidth = 1.6 * z; ctx.stroke();
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
    wallSeg(ctx, ax, ay, bx, by, 48 * z, WT.wallBackFace, WT.wallBackCap, (x % 3) === 1, z);
  }
  for(let y = 0; y < GRID_H; y++){
    if(y === 16 || y === 17) continue;               // the EXIT breaks the wall
    const [ax, ay] = proj(cam, -0.5, y - 0.5);
    const [bx, by] = proj(cam, -0.5, y + 0.5);
    if(ax < -TW * z && bx < -TW * z) continue;
    wallSeg(ctx, ax, ay, bx, by, 48 * z, WT.wallSideFace, WT.wallSideCap, (y % 3) === 1, z);
  }


  // interaction-spot rings: the places where standing there DOES something.
  // Pulse phase rides the game clock so it freezes politely with the world.
  const phase = w.clockMin * 1.6;
  const you0 = getActor(w, 'you');
  drawSpotRing(ctx, cam, you0.home, 'rgba(47,107,224,0.6)', phase);
  if(!w.coffeeUsed) drawSpotRing(ctx, cam, COFFEE_SPOT, 'rgba(62,158,94,0.55)', phase + 2);
  if(!w.couchUsed)  drawSpotRing(ctx, cam, COUCH_SPOT, 'rgba(232,129,76,0.55)', phase + 4);
  if(w.walkoutArmed) drawSpotRing(ctx, cam, { x: 1, y: 17 }, 'rgba(46,158,99,0.8)', phase + 1);
  // hotspots you can see across the floor: stuck approvals at The Pipe, and
  // the meeting room while a demo is imminent or underway
  if(w.tasks.blocked > 0) drawSpotRing(ctx, cam, APPROVAL_SPOT, 'rgba(216,68,63,0.6)', phase + 3);
  if(w.demo && w.demo.prepped && w.clockMin < w.demo.atMin + 15)
    drawSpotRing(ctx, cam, DEMO_SPOT, 'rgba(124,111,214,0.6)', phase + 5);

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

  // ── the signature double key-light: warm 5pm gold vs. cold monitor-cyan ─────
  // The single thing that must appear in every frame (Bible Phase 3). Painted as
  // a soft-light overlay so it tints, not paints over. Alphas ramp with the day.
  const L = WT.LIGHT;
  if(L){
    const dayT = Math.max(0, Math.min(1, w.clockMin / 480));   // 9:00 → 5:00
    const breath = 1 + 0.06 * Math.sin((tMs || 0) / 2300);     // slow; never freezes
    const diag = Math.hypot(vw, vh);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const wg = ctx.createRadialGradient(vw * L.warmAt[0], vh * L.warmAt[1], 0,
                                        vw * L.warmAt[0], vh * L.warmAt[1], diag * 0.95);
    wg.addColorStop(0, hexA(L.warm, (L.warmBase + L.warmDay * dayT) * breath));
    wg.addColorStop(1, hexA(L.warm, 0));
    ctx.fillStyle = wg; ctx.fillRect(0, 0, vw, vh);
    const cg = ctx.createRadialGradient(vw * L.coldAt[0], vh * L.coldAt[1], 0,
                                        vw * L.coldAt[0], vh * L.coldAt[1], diag * 0.9);
    cg.addColorStop(0, hexA(L.cold, L.coldBase - L.coldDay * dayT));
    cg.addColorStop(1, hexA(L.cold, 0));
    ctx.fillStyle = cg; ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
    // a warm bloom hugging the top of frame: the sun coming through the glass,
    // stronger as the day tips toward 5 o'clock
    const sun = ctx.createLinearGradient(0, 0, 0, vh * 0.5);
    sun.addColorStop(0, hexA(L.warm, 0.13 * dayT));
    sun.addColorStop(1, hexA(L.warm, 0));
    ctx.fillStyle = sun; ctx.fillRect(0, 0, vw, vh * 0.5);
  }

  // a soft vignette on top: fluorescent lighting, but make it cinematic
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.38,
                                      vw / 2, vh / 2, Math.max(vw, vh) * 0.78);
  vg.addColorStop(0, 'rgba(21,18,13,0)');
  vg.addColorStop(1, WT.vignette);
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

// '#RRGGBB' + alpha → 'rgba(r,g,b,a)' — for the key-light gradients
function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
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
  // the screen casts a cool pool on the desk — the cold key-light, in-world
  const L = WT.LIGHT;
  if(L){
    const flick = 0.88 + 0.12 * Math.sin(_tMs / 680 + (f.x + f.y));
    const g = ctx.createRadialGradient(mx, ty - 5 * z, 0, mx, ty - 5 * z, 24 * z);
    g.addColorStop(0, hexA(L.monitorGlow, 0.26 * flick));
    g.addColorStop(1, hexA(L.monitorGlow, 0));
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(mx, ty - 3 * z, 23 * z, 12 * z, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = prev;
  }
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
  // signature desk clutter (Bible §18): each desk reads its owner before a word.
  if(z > 0.62){
    const fl = (fx, fy) => [dx + (cx - dx) * fx, dy + (cy - dy) * fx - hpx + fy * z]; // point on desktop
    if(f.id === 'desk-marcus'){                 // coasting, beautifully: three mugs
      [[0.30, 0], [0.52, 2], [0.72, -1]].forEach(([fx, oy], i) => {
        const [mx, my] = fl(fx, oy);
        ctx.fillStyle = i === 1 ? '#cdd3d8' : '#e8e2d4';
        ctx.fillRect(mx - 2 * z, my - 4.5 * z, 4 * z, 4.5 * z);
        ctx.fillStyle = 'rgba(21,18,13,0.25)';
        ctx.fillRect(mx - 2 * z, my - 4.5 * z, 4 * z, 1 * z);
      });
    } else if(f.id === 'desk-priya'){           // the monument nobody else noticed
      const [ax2, ay2] = fl(0.7, 0);
      ctx.fillStyle = '#B98A4E';
      ctx.beginPath(); ctx.moveTo(ax2, ay2 - 10 * z); ctx.lineTo(ax2 - 3.4 * z, ay2 - 2 * z);
      ctx.lineTo(ax2 + 3.4 * z, ay2 - 2 * z); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7d5c30'; ctx.fillRect(ax2 - 3.8 * z, ay2 - 2 * z, 7.6 * z, 2.4 * z);
    } else if(f.id === 'desk-dennis'){          // 19 years of paper: a leaning stack
      const [sx2, sy2] = fl(0.4, 0);
      for(let i = 0; i < 7; i++){
        ctx.fillStyle = i % 2 ? '#f3efe3' : '#e6e0d0';
        ctx.fillRect(sx2 - 5 * z + (i % 2) * 0.9 * z, sy2 - 2 * z - i * 2.1 * z, 10 * z, 2.4 * z);
      }
    } else if(f.id === 'desk-kayla'){           // one small plant, quietly kept alive
      const [kx, ky] = fl(0.72, 0);
      ctx.fillStyle = '#A5623F'; ctx.fillRect(kx - 2.4 * z, ky - 4 * z, 4.8 * z, 4 * z);
      ctx.fillStyle = '#5C8A54';
      ctx.beginPath(); ctx.arc(kx, ky - 6 * z, 3.4 * z, 0, Math.PI * 2); ctx.fill();
    }
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
    // steam curling off the pot — the one always-on sign of life
    if(z > 0.6){
      const [spx, spy] = proj(cam, f.x - 0.5, f.y - 0.5);
      const sTop = spy - hpx - 3 * z;
      for(let i = 0; i < 2; i++){
        const ph = _tMs / 1000 + i * 1.7;
        const rise = (ph % 2) / 2;                       // 0..1 loop
        const sy = sTop - rise * 20 * z;
        const sx = spx + Math.sin(ph * 2.3 + i) * 3 * z;
        const alpha = 0.26 * (1 - rise) * Math.min(1, rise * 5);
        ctx.beginPath();
        ctx.ellipse(sx, sy, (1.5 + rise * 2) * z, (2 + rise * 2) * z, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245,242,235,' + alpha.toFixed(3) + ')';
        ctx.fill();
      }
    }
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
  // needs-approval stack: red-edged papers, stuck until Dennis is dealt with
  if(f.id === 'desk-you' && w && w.tasks.blocked > 0){
    const [bx2, by2] = proj(cam, f.x - 0.15, f.y - 0.15);
    for(let i = 0; i < Math.min(6, w.tasks.blocked); i++){
      ctx.fillStyle = '#f5e3df';
      ctx.strokeStyle = '#D8443F'; ctx.lineWidth = 1.4;
      const py2 = by2 - hpx - i * 3.2 * z;
      ctx.beginPath();
      ctx.moveTo(bx2, py2 - 4 * z); ctx.lineTo(bx2 + 9 * z, py2);
      ctx.lineTo(bx2, py2 + 4 * z); ctx.lineTo(bx2 - 9 * z, py2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#b3322e';
    ctx.font = '800 ' + Math.max(9, 11 * z) + 'px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!' + w.tasks.blocked, bx2, by2 - hpx - Math.min(6, w.tasks.blocked) * 3.2 * z - 6 * z);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  CHARACTER RIG  — the construction kit (Bible §13/§15). ART DATA, keyed by id;
//  behaviour lives in CAST. Pick a value per row and the figure renderer below
//  assembles a person: build (h/w/shoulder/hip), posture, head+hair, clothing
//  silhouette, shoes, arm/hand pose, ONE dominant prop, gait + speed. Adding a
//  coworker = one RIG entry. Nobody is hand-drawn. See CHARACTER_SYSTEM.md.
// ═════════════════════════════════════════════════════════════════════════════
const FIG_SKIN = { warm:'#E8C39E', tan:'#D6A57C', light:'#F0D4AE', deep:'#B4794E', badger:'#c9c2b4' };
const FIG_INK  = '#1b1712';
// Proportions are pushed toward caricature on purpose: a ~1.7× height spread and
// ~1.7× width spread, plus independent leg / torso length and head SIZE, so every
// silhouette reads by build alone before a single detail. legLen/torso/headScale
// are proportion multipliers; restFace is the signature resting expression; idle
// is the signature idle-loop gesture.
const RIG = {
  you:   { h:0.94,w:1.52,shoulder:1.02,hip:1.50, legLen:0.58,torso:1.10,headScale:1.42, posture:'shrug',
           head:'round', hair:'phones', hairCol:'#2b2824', skin:'badger', top:'tee', topCol:'#4B4743',
           bottom:'pants', botCol:'#3b3833', shoes:'sneak', shoeCol:'#2b2824', arms:'shrug', prop:null,
           walk:'trudge', spd:1.0, idle:'settle', restFace:'fine', badger:true },
  brad:  { h:1.24,w:0.80,shoulder:1.06,hip:0.76, legLen:1.22,torso:0.92,headScale:0.90, posture:'leanfwd',
           head:'oval', hair:'swoop', hairCol:'#2a2019', skin:'tan', top:'quarterzip', topCol:'#3f6ca8',
           bottom:'slacks', botCol:'#39414d', shoes:'sneakwhite', shoeCol:'#efeae0', arms:'phone', prop:'phone',
           walk:'bounce', spd:1.15, idle:'phonecheck', restFace:'scheming', airpod:true },
  dennis:{ h:0.80,w:1.36,shoulder:1.16,hip:1.26, legLen:0.74,torso:1.20,headScale:0.90, posture:'hunch',
           head:'round', hair:'combover', hairCol:'#9a958b', skin:'warm', top:'cardigan', topCol:'#7d6a4a',
           bottom:'slacks', botCol:'#4a463c', shoes:'loafer', shoeCol:'#39301f', arms:'holdchest', prop:'binder',
           walk:'shuffle', spd:0.68, idle:'shuffle', restFace:'tired', glasses:true, jowls:true },
  boss:  { h:1.45,w:1.26,shoulder:1.46,hip:1.02, legLen:1.16,torso:1.14,headScale:1.06, posture:'rigid',
           head:'square', hair:'buzz', hairCol:'#2a2622', skin:'tan', top:'suit', topCol:'#23262c', tie:'#b23b34',
           bottom:'slacks', botCol:'#1d2025', shoes:'oxblood', shoeCol:'#5a2a24', arms:'earphone', prop:'earpiece',
           walk:'march', spd:1.0, idle:'watch', restFace:'stern' },
  hr:    { h:1.07,w:0.84,shoulder:1.06,hip:0.98, legLen:1.06,torso:0.96,headScale:0.98, posture:'upright',
           head:'oval', hair:'bob', hairCol:'#4a3a2c', skin:'light', top:'blazer', topCol:'#6a5f86',
           bottom:'skirt', botCol:'#3a3448', shoes:'dress', shoeCol:'#2b2420', arms:'clipboard', prop:'clipboard',
           walk:'precise', spd:1.06, idle:'tap', restFace:'plastic', lanyard:true },
  kayla: { h:0.80,w:0.84,shoulder:0.78,hip:0.90, legLen:0.84,torso:0.96,headScale:1.12, posture:'collapse',
           head:'round', hair:'hood', hairCol:'#31534f', skin:'warm', top:'hoodie', topCol:'#3E7E7A',
           bottom:'jeans', botCol:'#3a4048', shoes:'slipon', shoeCol:'#4a443c', arms:'pocket', prop:null,
           walk:'drift', spd:0.88, idle:'glance', restFace:'overwhelmed', phones:true, bighead:true },
  marcus:{ h:1.08,w:1.30,shoulder:1.22,hip:1.18, legLen:0.98,torso:1.08,headScale:1.02, posture:'lounge',
           head:'round', hair:'short', hairCol:'#241d17', skin:'deep', top:'henley', topCol:'#b0693f',
           bottom:'jeans', botCol:'#3f4652', shoes:'boot', shoeCol:'#39291f', arms:'mug', prop:'mug',
           walk:'amble', spd:0.80, idle:'sip', restFace:'dead' },
  priya: { h:1.05,w:0.76,shoulder:0.84,hip:0.84, legLen:1.10,torso:0.92,headScale:0.94, posture:'purposeful',
           head:'oval', hair:'ponytail', hairCol:'#201812', skin:'tan', top:'blouse', topCol:'#7C6FD6',
           bottom:'slacks', botCol:'#3a3648', shoes:'flat', shoeCol:'#2b2420', arms:'laptop', prop:'laptop',
           walk:'brisk', spd:1.22, idle:'type', restFace:'fine' },
  adam:  { h:1.02,w:1.14,shoulder:1.14,hip:1.06, legLen:0.94,torso:1.02,headScale:1.14, posture:'hoverhips',
           head:'egg', hair:'bald', hairCol:null, skin:'light', top:'polo', topCol:'#A88C5F',
           bottom:'khakis', botCol:'#8a7a58', shoes:'sneak', shoeCol:'#4a443c', arms:'hips', prop:null,
           walk:'strut', spd:0.95, idle:'gesture', restFace:'eager', shine:true, lanyard:true }
};

// posture → how weight sits. Contrapposto by default; a vertical spine is reserved
// for the Boss and for fear (Bible §15). Values are in figure units (×S later).
function figPosture(name){
  switch(name){
    // chest out, chin up, shoulders squared high-and-back — dominance
    case 'rigid':     return { lean:-0.6, headFwd:-0.3, shDrop:-1.2, shMul:1.12, hipCock:0,   bobMul:0.32 };
    // hungry forward lean over the toes
    case 'leanfwd':   return { lean:3.4,  headFwd:2.4,  shDrop:-0.7, shMul:1.0,  hipCock:-1.6,bobMul:1.2 };
    // deep 19-year hunch, head jutting forward off rounded shoulders
    case 'hunch':     return { lean:1.9,  headFwd:3.8,  shDrop:3.4,  shMul:1.0,  hipCock:0.4, bobMul:0.55 };
    // curled inward, shoulders dropped and narrowed, trying to take up less room
    case 'collapse':  return { lean:1.0,  headFwd:2.1,  shDrop:3.0,  shMul:0.76, hipCock:1.2, bobMul:0.5 };
    // the badger's permanent shrug — shoulders jacked up around the ears
    case 'shrug':     return { lean:0,    headFwd:0.3,  shDrop:-3.4, shMul:1.05, hipCock:0.5, bobMul:0.6 };
    // reclined, weight way back on the heels, hips slung forward
    case 'lounge':    return { lean:-2.6, headFwd:-0.6, shDrop:1.5,  shMul:1.1,  hipCock:2.6, bobMul:0.85 };
    // planted, elbows out, hovering forward to make his point
    case 'hoverhips': return { lean:1.4,  headFwd:1.5,  shDrop:-0.4, shMul:1.2,  hipCock:0.4, bobMul:0.8 };
    // crisp vertical, chin level, blazer shoulders held
    case 'upright':   return { lean:0,    headFwd:-0.2, shDrop:-0.4, shMul:1.05, hipCock:1.4, bobMul:0.82 };
    // upright but leaning INTO the work — momentum
    case 'purposeful':return { lean:1.3,  headFwd:0.6,  shDrop:-0.3, shMul:1.0,  hipCock:1.0, bobMul:0.95 };
    default:          return { lean:0,    headFwd:0,    shDrop:0.3,  shMul:1.0,  hipCock:1.3, bobMul:0.9 };
  }
}

// walk cycle per gait — casting through motion (Bible §15 "walk cycles are casting")
function figWalk(name){
  switch(name){
    case 'march':   return { stride:4.0, bob:0.7, lift:2.2, swing:3.0, upperStill:true  }; // Boss: long even strides, torso like a mast
    case 'bounce':  return { stride:2.8, bob:3.4, lift:3.6, swing:1.6, upperStill:false }; // Brad: springs off the toes
    case 'shuffle': return { stride:1.5, bob:0.4, lift:0.9, swing:0.3, upperStill:true  }; // Dennis: barely leaves the carpet
    case 'drift':   return { stride:2.0, bob:0.9, lift:1.5, swing:0.5, upperStill:false }; // Kayla: slow, close, low
    case 'amble':   return { stride:3.0, bob:1.5, lift:2.1, swing:1.4, upperStill:false }; // Marcus: loose roll, big sway
    case 'precise': return { stride:2.1, bob:0.7, lift:1.8, swing:0.9, upperStill:false }; // Meredith: quick, short, even
    case 'brisk':   return { stride:2.7, bob:0.8, lift:2.0, swing:1.2, upperStill:false }; // Priya: fast small steps
    case 'strut':   return { stride:3.2, bob:1.5, lift:2.3, swing:1.5, upperStill:false }; // Adam: chest-led swagger
    case 'trudge':  return { stride:2.3, bob:1.7, lift:1.7, swing:0.6, upperStill:false }; // You: heavy, resigned plod
    default:        return { stride:2.6, bob:1.2, lift:2.0, swing:1.0, upperStill:false };
  }
}

// a capsule limb between two points, dark outline under a coloured core
function figLimb(ctx, x1, y1, x2, y2, wd, col, ol, S){
  ctx.lineCap = 'round';
  ctx.strokeStyle = ol; ctx.lineWidth = wd + 1.7 * S;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = wd;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function figHand(ctx, x, y, r, col, ol, S){
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = ol; ctx.lineWidth = 1.1 * S; ctx.stroke();
}

// THE FIGURE. Draw a person from a rig at screen point (px,py=feet), scale z.
// o = { mood, moving, walkPhase, idlePhase, faceLeft, silhouette, face }
function drawFigure(ctx, px, py, z, rig, o){
  o = o || {};
  const S = z, H = rig.h || 1, W = rig.w || 1;
  const sil = !!o.silhouette;
  const P = figPosture(rig.posture);
  const mv = !!o.moving, wph = o.walkPhase || 0, iph = o.idlePhase || 0;
  const skin = sil ? FIG_INK : (FIG_SKIN[rig.skin] || FIG_SKIN.warm);
  const OL = sil ? FIG_INK : 'rgba(18,14,10,0.9)';
  const F = c => sil ? FIG_INK : c;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(o.faceLeft ? -1 : 1, 1);
  const walkP = figWalk(rig.walk);
  const bob = (mv ? -Math.abs(Math.sin(wph)) * walkP.bob : Math.sin(iph) * -0.5 * P.bobMul) * S;
  ctx.translate(0, bob);

  // ── key levels (feet at 0, up = negative) — legs, torso, head vary per rig ──
  const legLen = 12.6 * (rig.legLen || 1), torsoLen = 11.5 * (rig.torso || 1);
  const hipY = -legLen * S * H;
  const shY  = hipY - torsoLen * S * H + P.shDrop * S;
  const hipW = 5.0 * S * W * (rig.hip || 1);
  const shW  = 5.8 * S * W * (rig.shoulder || 1) * P.shMul;
  const sway = (mv && !walkP.upperStill) ? Math.sin(wph) * 0.7 * S : 0;
  const glance = (rig.idle === 'glance' && !mv) ? Math.sin(iph * 0.55) * 1.5 * S : 0;
  const topX = P.lean * S + sway + (mv ? 0 : Math.sin(iph * 0.7) * 0.3 * S);
  const headR = 4.6 * S * (rig.headScale || 1) * 1.34;   // chibi: big cute heads
  const headCX = topX + P.headFwd * S + glance;
  const headCY = shY - headR * 0.82 - 1.4 * S;
  const shLx = topX - shW / 2, shRx = topX + shW / 2;

  // ── legs (walk cycle: stride + lift per gait) ──
  const legGap = hipW * 0.40, legW = 3.1 * S * W, footY0 = -1.5 * S;
  [[-1, Math.PI], [1, 0]].forEach(([sx, ph0]) => {
    const sw = mv ? Math.sin(wph + ph0) : 0;
    const cock = (!mv) ? sx * P.hipCock * 0.5 * S : 0;
    const footX = topX * 0.15 + sx * legGap + sw * walkP.stride * S;
    const lift = mv ? Math.max(0, Math.sin(wph + ph0)) * walkP.lift * S : 0;
    figLimb(ctx, sx * legGap + cock, hipY, footX, footY0 - lift, legW, F(rig.botCol), OL, S);
    figShoe(ctx, footX, footY0 - lift, rig.shoes, F(rig.shoeCol), OL, S, sil);
  });

  // ── far arm (behind torso) — the free hand swings when walking ──
  const armW = 2.7 * S * W;
  const shoObj = figArmPlan(rig, P, { shLx, shRx, shY, hipY, hipW, topX, iph, mv, wph });
  if(mv){
    shoObj.far.hx += Math.sin(wph) * walkP.swing * S; shoObj.far.hy -= Math.abs(Math.sin(wph)) * 0.8 * S;
  } else {
    // ── signature idle gesture: nobody in this office just stands (Bible §15) ──
    const g = iph;
    switch(rig.idle){
      case 'sip':       { const s = Math.max(0, Math.sin(g * 0.5)); shoObj.near.hy -= s * 4.5 * S; shoObj.near.hx -= s * 1.3 * S; break; } // mug to mouth
      case 'phonecheck':{ const s = Math.max(0, Math.sin(g * 0.5)); shoObj.near.hy -= s * 3.2 * S; break; }                              // phone up to face
      case 'watch':     { const s = Math.max(0, Math.sin(g * 0.45) - 0.4); shoObj.far.hy -= s * 9 * S; shoObj.far.hx += s * 4 * S; break; } // check the wrist
      case 'tap':       { shoObj.near.hy += Math.sin(g * 5) * 0.7 * S; break; }                                                          // pen taps the board
      case 'gesture':   { const s = Math.max(0, Math.sin(g * 0.5) - 0.25); shoObj.near.hx += s * 5 * S; shoObj.near.hy -= s * 6 * S; break; } // makes a point
      case 'shuffle':   { shoObj.near.hy += Math.sin(g * 2) * 0.6 * S; shoObj.far.hy += Math.sin(g * 2 + 1) * 0.6 * S; break; }           // fidgets the binder
      case 'type':      { shoObj.far.hy -= Math.abs(Math.sin(g * 4)) * 1.0 * S; break; }                                                 // typing
      case 'glance':    { shoObj.near.hy += Math.sin(g * 0.9) * 0.5 * S; break; }                                                        // (head turn handled above)
      case 'settle':    { const s = Math.sin(g * 0.7) * 0.7 * S; shoObj.near.hy += s; shoObj.far.hy += s; break; }                       // the shrug settling
    }
  }
  figLimb(ctx, shoObj.far.sx, shY + 0.5 * S, shoObj.far.hx, shoObj.far.hy, armW, F(rig.topCol), OL, S);
  figHand(ctx, shoObj.far.hx, shoObj.far.hy, 2.2 * S, F(skin), OL, S);

  // ── torso ──
  if(rig.badger){
    // the mascot gets his own body: a chunky round pear (belly-forward, no
    // clothing) with a pale tummy patch — cuter, and unmistakably not a human
    const midY = (shY + hipY) / 2 + 1.2 * S;
    const rx = hipW * 0.82, ry = (hipY - shY) * 0.80;   // properly plump
    ctx.beginPath(); ctx.ellipse(topX * 0.5, midY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = F(rig.topCol); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.3 * S; ctx.stroke();
    if(!sil){
      ctx.beginPath(); ctx.ellipse(topX * 0.5, midY + ry * 0.16, rx * 0.62, ry * 0.66, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d9d2c4'; ctx.fill();                       // the big soft tummy
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(-hipW / 2, hipY);
    ctx.lineTo(shLx, shY);
    ctx.quadraticCurveTo(topX, shY - 2.4 * S, shRx, shY);
    ctx.lineTo(hipW / 2, hipY);
    ctx.quadraticCurveTo(0, hipY + 2.2 * S, -hipW / 2, hipY);
    ctx.closePath();
    ctx.fillStyle = F(rig.topCol); ctx.fill();
    ctx.strokeStyle = OL; ctx.lineWidth = 1.3 * S; ctx.stroke();
    if(!sil) figClothing(ctx, rig, { hipW, shW, shLx, shRx, shY, hipY, topX, S, OL });
  }

  // ── neck + head (shape varies: square jaw, egg, oval, round) ──
  const neckW = (rig.posture === 'hunch' ? 3.8 : 3.0) * S;   // Dennis's head sits low on a thick neck
  const neckY = shY - 1.0 * S;
  figLimb(ctx, headCX, neckY, headCX, headCY + headR * 0.5, neckW, F(skin), OL, S);
  ctx.beginPath();
  if(rig.head === 'square') rrPath(ctx, headCX - headR * 1.02, headCY - headR * 0.92, headR * 2.04, headR * 1.9, headR * 0.42); // broad jaw
  else if(rig.head === 'egg') ctx.ellipse(headCX, headCY, headR * 0.82, headR * 1.2, 0, 0, Math.PI * 2);                        // tall dome
  else if(rig.head === 'oval') ctx.ellipse(headCX, headCY, headR * 0.9, headR * 1.08, 0, 0, Math.PI * 2);
  else ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
  ctx.fillStyle = F(skin); ctx.fill();
  ctx.strokeStyle = OL; ctx.lineWidth = 1.2 * S; ctx.stroke();
  if(rig.jowls){   // soft round cheeks — a gently full face, not a droop
    ctx.beginPath(); ctx.ellipse(headCX, headCY + headR * 0.6, headR * 0.6, headR * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = F(skin); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 1.0 * S; ctx.stroke();
  }

  // ── near arm + hand (over torso) ──
  figLimb(ctx, shoObj.near.sx, shY + 0.5 * S, shoObj.near.ex, shoObj.near.ey, armW, F(rig.topCol), OL, S);
  figLimb(ctx, shoObj.near.ex, shoObj.near.ey, shoObj.near.hx, shoObj.near.hy, armW * 0.92, F(rig.topCol), OL, S);
  figHand(ctx, shoObj.near.hx, shoObj.near.hy, 2.3 * S, F(skin), OL, S);
  if(shoObj.far.showHand2) figHand(ctx, shoObj.far.hx, shoObj.far.hy, 2.2 * S, F(skin), OL, S);

  // ── face (five-mood), hair, accessories ──
  if(!sil) figFace(ctx, rig, headCX, headCY, headR, o.mood || 'fine', o);
  figHair(ctx, rig, headCX, headCY, headR, S, sil, o);

  // ── the ONE dominant prop, in the near hand ──
  figProp(ctx, rig, shoObj, headCX, headCY, headR, S, sil, o);

  ctx.restore();
}

function rrPath(ctx, x, y, w, h, r){
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  if(ctx.roundRect){ ctx.roundRect(x, y, w, h, rad); return; }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}

// arm plan → shoulder/elbow/hand points for near & far arms, per pose
function figArmPlan(rig, P, g){
  const S = 1; // g coords already in px; keep multipliers explicit
  const px = k => k; // identity, kept for readability
  const shY = g.shY, sc = 1;
  const restNear = { sx: g.shRx - 0.6, ex: g.shRx + 0.3, ey: shY + 7, hx: g.shRx - 0.5, hy: g.hipY - 1, showHand2:true };
  const restFar  = { sx: g.shLx + 0.6, hx: g.shLx - 0.2, hy: g.hipY - 1, showHand2:false };
  const u = (g.shRx - g.shLx) / 5.8; // ~ S*W unit recovered
  const idle = Math.sin(g.iph);
  switch(rig.arms){
    case 'shrug':      // both forearms out, palms up — the badger's "well?"
      return {
        near:{ sx:g.shRx-0.4, ex:g.shRx+4*u, ey:shY+4*u, hx:g.shRx+6.5*u, hy:shY+1.5*u },
        far: { sx:g.shLx+0.4, hx:g.shLx-6.5*u, hy:shY+1.5*u, showHand2:true }
      };
    case 'phone':      // near hand holds phone at chest, face-up
      return {
        near:{ sx:g.shRx-0.6, ex:g.shRx+2.2*u, ey:shY+5*u, hx:g.topX+2.4*u, hy:shY+7*u },
        far: { sx:g.shLx+0.6, hx:g.shLx-1.4*u, hy:g.hipY-2*u, showHand2:true }
      };
    case 'holdchest':  // both forearms across chest (binder)
      return {
        near:{ sx:g.shRx-0.6, ex:g.shRx+1.4*u, ey:shY+5*u, hx:g.topX-2.6*u, hy:shY+6.5*u },
        far: { sx:g.shLx+0.6, hx:g.topX+2.6*u, hy:shY+6.8*u, showHand2:true }
      };
    case 'earphone':   // near hand up to ear; far at side
      return {
        near:{ sx:g.shRx-0.6, ex:g.shRx+2.6*u, ey:shY-1*u, hx:g.topX+3.4*u, hy:shY-4.5*u },
        far: { sx:g.shLx+0.6, hx:g.shLx-1.2*u, hy:g.hipY-1*u, showHand2:true }
      };
    case 'clipboard':  // both hands at waist holding a board
      return {
        near:{ sx:g.shRx-0.6, ex:g.shRx+1.6*u, ey:shY+6*u, hx:g.topX+2.4*u, hy:g.hipY-1.5*u },
        far: { sx:g.shLx+0.6, hx:g.topX-2.4*u, hy:g.hipY-1.5*u, showHand2:true }
      };
    case 'pocket':     // hands in hoodie pocket
      return {
        near:{ sx:g.shRx-0.7, ex:g.shRx+1.2*u, ey:shY+6*u, hx:g.topX+1.6*u, hy:g.hipY+1*u },
        far: { sx:g.shLx+0.7, hx:g.topX-1.6*u, hy:g.hipY+1*u, showHand2:false }
      };
    case 'mug':        // near hand holds a big mug at chest; far relaxed
      return {
        near:{ sx:g.shRx-0.6, ex:g.shRx+2.4*u, ey:shY+5*u, hx:g.topX+2.6*u, hy:shY+6.5*u + idle*1.2 },
        far: { sx:g.shLx+0.6, hx:g.shLx-1.6*u, hy:g.hipY-1*u, showHand2:true }
      };
    case 'laptop':     // near forearm horizontal under a laptop; far hand types
      return {
        near:{ sx:g.shRx-0.6, ex:g.shRx+2.2*u, ey:shY+6*u, hx:g.topX+3.0*u, hy:shY+7.5*u },
        far: { sx:g.shLx+0.6, hx:g.topX+0.8*u, hy:shY+6.5*u - Math.abs(Math.sin(g.iph*3))*0.8, showHand2:true }
      };
    case 'hips':       // hands on hips — elbows out
      return {
        near:{ sx:g.shRx-0.5, ex:g.shRx+3.4*u, ey:shY+4.5*u, hx:g.hipW/2-0.4*u, hy:g.hipY-1*u },
        far: { sx:g.shLx+0.5, hx:-g.hipW/2+0.4*u, hy:g.hipY-1*u, showHand2:true, elbowOut:true }
      };
    default:           // rest at sides
      return { near:restNear, far:restFar };
  }
}

// class-marker shoes (Bible §15)
function figShoe(ctx, x, y, kind, col, ol, S, sil){
  if(kind === 'boot'){ ctx.fillStyle = col; ctx.beginPath(); rrPath(ctx, x - 2 * S, y - 4 * S, 4.6 * S, 4.4 * S, 1 * S); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1 * S; ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(x + 1.1 * S, y + 0.3 * S, 3.5 * S, 1.9 * S, 0, 0, Math.PI * 2);
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1 * S; ctx.stroke();
  if(sil) return;
  if(kind === 'sneakwhite'){ ctx.fillStyle = '#f2ede2'; ctx.beginPath(); ctx.ellipse(x + 2.6 * S, y + 0.6 * S, 1.9 * S, 1.1 * S, 0, 0, Math.PI * 2); ctx.fill(); }
  if(kind === 'sneak'){ ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8 * S; ctx.beginPath(); ctx.moveTo(x - 1 * S, y + 0.6 * S); ctx.lineTo(x + 2.6 * S, y + 0.6 * S); ctx.stroke(); }
  if(kind === 'oxblood'){ ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(x + 2.6 * S, y - 0.1 * S, 1.4 * S, 0.7 * S, 0, 0, Math.PI * 2); ctx.fill(); }
}

// clothing silhouette detail — collar/zip/lapel + a fold line + silhouette-breaker
function figClothing(ctx, rig, g){
  const S = g.S, cx = g.topX, cyTop = g.shY + 1 * S, cyBot = g.hipY;
  const lite = shade(rig.topCol, 1.14), dark = shade(rig.topCol, 0.74);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (x1, y1, x2, y2, c, wd) => { ctx.strokeStyle = c; ctx.lineWidth = (wd || 1) * S; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  switch(rig.top){
    case 'quarterzip':
      line(cx, cyTop, cx, cyTop + 8 * S, dark, 1.2);
      line(cx - 2.2 * S, cyTop, cx, cyTop + 2.2 * S, dark, 1.1);
      line(cx + 2.2 * S, cyTop, cx, cyTop + 2.2 * S, dark, 1.1);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(cx, cyTop + 8 * S, 0.9 * S, 0, 7); ctx.fill();
      break;
    case 'suit': {
      ctx.fillStyle = '#eee'; ctx.beginPath();
      ctx.moveTo(cx - 2.4 * S, cyTop); ctx.lineTo(cx + 2.4 * S, cyTop); ctx.lineTo(cx, cyTop + 9 * S); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rig.tie || '#b23b34'; ctx.beginPath();
      ctx.moveTo(cx - 1 * S, cyTop + 0.5 * S); ctx.lineTo(cx + 1 * S, cyTop + 0.5 * S); ctx.lineTo(cx + 1.5 * S, cyTop + 8 * S); ctx.lineTo(cx, cyTop + 10 * S); ctx.lineTo(cx - 1.5 * S, cyTop + 8 * S); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(g.shLx + 1 * S, g.shY); ctx.lineTo(cx - 1.6 * S, cyTop + 1 * S); ctx.lineTo(cx - 3 * S, cyTop + 7 * S); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(g.shRx - 1 * S, g.shY); ctx.lineTo(cx + 1.6 * S, cyTop + 1 * S); ctx.lineTo(cx + 3 * S, cyTop + 7 * S); ctx.closePath(); ctx.fill();
      break; }
    case 'cardigan':
      line(cx, cyTop, cx, cyBot - 1 * S, dark, 1.4);
      ctx.fillStyle = shade(rig.topCol, 0.9); ctx.beginPath();
      ctx.moveTo(cx - 1.4 * S, cyTop); ctx.lineTo(cx + 1.4 * S, cyTop); ctx.lineTo(cx, cyTop + 6 * S); ctx.closePath(); ctx.fill();
      for(let i = 0; i < 3; i++){ ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(cx + 1.6 * S, cyTop + (3 + i * 3) * S, 0.7 * S, 0, 7); ctx.fill(); }
      break;
    case 'blazer':
      ctx.fillStyle = lite; ctx.beginPath();
      ctx.moveTo(cx - 2 * S, cyTop); ctx.lineTo(cx + 2 * S, cyTop); ctx.lineTo(cx, cyTop + 7 * S); ctx.closePath(); ctx.fill();
      line(g.shLx + 1.5 * S, g.shY + 0.5 * S, cx - 1.6 * S, cyTop + 6 * S, dark, 1.2);
      line(g.shRx - 1.5 * S, g.shY + 0.5 * S, cx + 1.6 * S, cyTop + 6 * S, dark, 1.2);
      break;
    case 'hoodie':
      ctx.strokeStyle = dark; ctx.lineWidth = 1.1 * S;
      ctx.beginPath(); rrPath(ctx, cx - 3.4 * S, cyTop + 6 * S, 6.8 * S, 4.6 * S, 1.4 * S); ctx.stroke();
      line(cx - 1.2 * S, cyTop, cx - 1.2 * S, cyTop + 3 * S, lite, 1);
      line(cx + 1.2 * S, cyTop, cx + 1.2 * S, cyTop + 3 * S, lite, 1);
      break;
    case 'henley':
      line(cx, cyTop, cx, cyTop + 5 * S, dark, 1.2);
      for(let i = 0; i < 2; i++){ ctx.fillStyle = lite; ctx.beginPath(); ctx.arc(cx, cyTop + (1.6 + i * 2.4) * S, 0.7 * S, 0, 7); ctx.fill(); }
      break;
    case 'polo':
      line(cx - 2 * S, cyTop - 0.5 * S, cx, cyTop + 1.6 * S, dark, 1.2);
      line(cx + 2 * S, cyTop - 0.5 * S, cx, cyTop + 1.6 * S, dark, 1.2);
      line(cx, cyTop + 1.6 * S, cx, cyTop + 5 * S, dark, 1.1);
      line(g.hipW * -0.5 + 1 * S, cyBot - 1.5 * S, g.hipW * 0.5 - 1 * S, cyBot - 1.5 * S, dark, 0.9);
      break;
    case 'blouse':
      line(cx - 1.8 * S, cyTop, cx, cyTop + 2.4 * S, dark, 1);
      line(cx + 1.8 * S, cyTop, cx, cyTop + 2.4 * S, dark, 1);
      break;
    case 'tee':
      ctx.strokeStyle = dark; ctx.lineWidth = 1 * S; ctx.beginPath(); ctx.arc(cx, cyTop - 0.5 * S, 2 * S, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      break;
  }
  ctx.strokeStyle = dark; ctx.lineWidth = 0.9 * S; ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.moveTo(-g.hipW * 0.34, cyBot - 2.5 * S); ctx.quadraticCurveTo(cx, cyBot - 1 * S, g.hipW * 0.34, cyBot - 2.5 * S); ctx.stroke();
  ctx.globalAlpha = 1;
  if(rig.lanyard){
    ctx.strokeStyle = '#B0553A'; ctx.lineWidth = 1.1 * S;
    ctx.beginPath(); ctx.moveTo(cx - 2.4 * S, cyTop); ctx.lineTo(cx - 0.6 * S, cyTop + 7 * S);
    ctx.moveTo(cx + 2.4 * S, cyTop); ctx.lineTo(cx - 0.6 * S, cyTop + 7 * S); ctx.stroke();
    ctx.fillStyle = '#f2ede2'; ctx.strokeStyle = '#6E6960'; ctx.lineWidth = 0.8 * S;
    ctx.beginPath(); rrPath(ctx, cx - 2 * S, cyTop + 6.5 * S, 2.8 * S, 3.6 * S, 0.6 * S); ctx.fill(); ctx.stroke();
  }
}

// five-mood face — lid height, brow angle, mouth curve only. Deadpan family.
const FIG_MOOD = {
  fine:    { lid:0.28, brow:0.0,  browY:0.0,  mouth: 0.12 },
  tired:   { lid:0.54, brow:-0.22, browY:0.12, mouth: 0.0, bags:true },
  alarmed: { lid:0.02, brow:0.22,  browY:-0.20,mouth: 0.30, open:true },
  scheming:{ lid:0.36, brow:0.20,  browY:-0.04,mouth:-0.10, smirk:true },
  dead:    { lid:0.52, brow:0.0,   browY:0.06, mouth:-0.04 },
  // signature resting faces — gentle: grumpy at worst, never scary
  stern:   { lid:0.26, brow:0.22,  browY:0.20, mouth:-0.06 },              // Boss: mildly no-nonsense
  plastic: { lid:0.24, brow:0.0,   browY:0.02, mouth: 0.34 },              // Meredith: fixed pleasant smile
  eager:   { lid:0.08, brow:0.16,  browY:-0.14,mouth: 0.30, open:true },   // Adam: bright, ready to speak
  overwhelmed:{ lid:0.42, brow:-0.22, browY:0.02, mouth:-0.06 }            // Kayla: a little worried, soft
};
// CUTE face rig (Labubu-adjacent): big glossy round eyes, soft brows, rosy
// cheeks, a small friendly mouth. Mood shifts stay gentle — grumpy at worst,
// never scary. Built from eye/brow/mouth like before, just softened & enlarged.
function figFace(ctx, rig, cx, cy, r, mood, o){
  const S = r / 6.3;   // heads are drawn ×1.34 chibi; divide it back out so
                       // brows/mouth/glasses keep their intended stroke weight
  const m = FIG_MOOD[mood] || FIG_MOOD.fine;
  const badger = rig.badger;
  const eyeR = r * 0.35;                 // big eyes = friendly
  const eyeDX = r * 0.43;
  const eyeY = cy + r * 0.15;            // set low on the face (baby proportion)
  if(badger){
    // ── the LOGO face: wide deadpan eyes under flat lids, a real muzzle with a
    // big soft nose, gentle mouth. Drawn whole, then return — his own face rig.
    const eY = cy - r * 0.02;
    // BADGER stripes, not a raccoon band: two soft VERTICAL dark stripes running
    // down through each eye, pale blaze between them and pale cheeks outside
    ctx.fillStyle = '#413c34';
    [-1, 1].forEach(sgn => {
      ctx.beginPath(); ctx.ellipse(cx + sgn * r * 0.46, eY - r * 0.12, r * 0.27, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = 'rgba(224,120,104,0.25)';   // soft blush on the pale cheeks
    [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.ellipse(cx + sgn * r * 0.78, cy + r * 0.34, r * 0.16, r * 0.11, 0, 0, Math.PI * 2); ctx.fill(); });
    [-1, 1].forEach(sgn => {              // eyes: wide pale ovals + FLAT heavy lid
      const ex = cx + sgn * r * 0.46, eyW = r * 0.34, eyH = r * 0.3;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, eY, eyW, eyH, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f2ecdd'; ctx.fill(); ctx.clip();
      const lidF = Math.min(0.62, 0.34 + (m.lid || 0) * 0.45);   // deadpan base
      ctx.fillStyle = '#26211c';
      ctx.fillRect(ex - eyW, eY - eyH, eyW * 2, eyH * lidF * 2);  // the flat lid
      ctx.fillStyle = '#211a14';                                  // pupil under it
      ctx.beginPath(); ctx.arc(ex, eY + eyH * 0.22, r * 0.105, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';                    // one tiny glint
      ctx.beginPath(); ctx.arc(ex - r * 0.035, eY + eyH * 0.12, r * 0.032, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#211a14'; ctx.lineWidth = 1.5 * S;       // bold ink ring
      ctx.beginPath(); ctx.ellipse(ex, eY, eyW, eyH, 0, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.fillStyle = '#e6dfd0';            // the muzzle, prominent like the mark
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.58, r * 0.55, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#211a14';            // big soft nose
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.4, r * 0.22, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1.4 * S; ctx.lineCap = 'round';
    const mm = Math.max(-0.5, Math.min(0.5, m.mouth + 0.1));      // gentle mouth
    ctx.beginPath(); ctx.moveTo(cx - r * 0.26, cy + r * 0.66);
    ctx.quadraticCurveTo(cx, cy + r * 0.66 + mm * 4 * S, cx + r * 0.26, cy + r * 0.68);
    ctx.stroke();
    return;
  }
  // rosy cheeks — warmth
  ctx.fillStyle = 'rgba(224,120,104,0.30)';
  [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.ellipse(cx + sgn * r * 0.66, cy + r * 0.44, r * 0.21, r * 0.13, 0, 0, Math.PI * 2); ctx.fill(); });
  // eyes: friendly, not bulging. The badger gets calm matte eyes (no white
  // sclera ring — it reads bug-eyed against his dark mask) with ONE small glint.
  [-1, 1].forEach(sgn => {
    const ex = cx + sgn * eyeDX;
    if(!badger){
      ctx.fillStyle = '#fcf8ef';
      ctx.beginPath(); ctx.ellipse(ex, eyeY, eyeR, eyeR * 1.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(28,20,12,0.45)'; ctx.lineWidth = 0.8 * S; ctx.stroke();
    }
    const pr = (badger ? 0.62 : (m.open ? 0.9 : 0.82)) * eyeR, pyE = eyeY + eyeR * 0.12;
    ctx.fillStyle = badger ? '#4a3524' : '#5b3f28';              // warm iris
    ctx.beginPath(); ctx.arc(ex, pyE, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#211a14';                                   // pupil
    ctx.beginPath(); ctx.arc(ex, pyE + pr * 0.05, pr * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';                                   // catchlight(s)
    ctx.beginPath(); ctx.arc(ex - pr * 0.3, pyE - pr * 0.4, pr * (badger ? 0.3 : 0.42), 0, Math.PI * 2); ctx.fill();
    if(!badger){ ctx.beginPath(); ctx.arc(ex + pr * 0.36, pyE + pr * 0.3, pr * 0.2, 0, Math.PI * 2); ctx.fill(); }
    if(m.lid > 0.34){                                            // sleepy lid — gentle, partial
      ctx.fillStyle = badger ? '#3a352e' : (FIG_SKIN[rig.skin] || '#E8C39E');
      // the badger stays bright-eyed: his lids never pass a light "sleepy-cute"
      const drop = Math.min(badger ? 0.42 : 0.85, m.lid);
      ctx.beginPath(); ctx.ellipse(ex, eyeY - eyeR * (1 - drop), eyeR * 1.06, eyeR * drop * 0.95, 0, 0, Math.PI * 2); ctx.fill();
    }
    // soft, short, gently-curved brow sitting high
    ctx.strokeStyle = rig.hairCol || '#4a3a2c'; ctx.lineWidth = 1.3 * S; ctx.lineCap = 'round';
    const bt = m.brow * 0.55 * sgn * (m.smirk && sgn > 0 ? 1.5 : 1);
    const by = eyeY - eyeR - 1.1 * S + m.browY * 0.6 * S;
    ctx.beginPath(); ctx.moveTo(ex - eyeR * 0.72, by + bt * S); ctx.quadraticCurveTo(ex, by - 0.6 * S + bt * 0.3 * S, ex + eyeR * 0.72, by - bt * S); ctx.stroke();
  });
  if(rig.glasses){                                              // round specs over the big eyes
    ctx.strokeStyle = '#2a2520'; ctx.lineWidth = 1.0 * S;
    [-1, 1].forEach(sgn => { ctx.beginPath(); ctx.arc(cx + sgn * eyeDX, eyeY, eyeR * 1.16, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(cx - eyeDX + eyeR * 1.1, eyeY); ctx.lineTo(cx + eyeDX - eyeR * 1.1, eyeY); ctx.stroke();
  }
  // small friendly mouth (smiles more than it frowns)
  const my = cy + r * (badger ? 0.7 : 0.66), mw = r * 0.24;
  if(m.open){ ctx.fillStyle = '#9c5049'; ctx.beginPath(); ctx.ellipse(cx, my, mw * 0.62, 1.5 * S, 0, 0, Math.PI * 2); ctx.fill(); }
  else {
    ctx.strokeStyle = '#7a463a'; ctx.lineWidth = 1.2 * S; ctx.lineCap = 'round';
    const curve = (m.smirk ? Math.max(0.4, m.mouth + 0.5) : m.mouth + 0.18) * 3.2 * S;
    ctx.beginPath();
    if(m.smirk){ ctx.moveTo(cx - mw, my + 0.5 * S); ctx.quadraticCurveTo(cx, my + curve, cx + mw, my - 0.6 * S); }
    else { ctx.moveTo(cx - mw, my); ctx.quadraticCurveTo(cx, my + curve, cx + mw, my); }
    ctx.stroke();
  }
}

// hair / headwear — two-tone, one flyaway; class-defining shapes
function figHair(ctx, rig, cx, cy, r, S, sil, o){
  const c1 = sil ? FIG_INK : (rig.hairCol || '#2a2520'), c2 = sil ? FIG_INK : shade(rig.hairCol || '#2a2520', 1.2);
  const top = cy - r * 0.98;
  ctx.lineJoin = 'round';
  switch(rig.hair){
    case 'swoop':
      ctx.fillStyle = c1; ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy - r * 0.2); ctx.quadraticCurveTo(cx - r * 0.7, top, cx + r * 0.2, cy - r * 0.75);
      ctx.quadraticCurveTo(cx + r * 1.15, cy - r * 1.05, cx + r * 0.95, cy - r * 0.1);
      ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.62, cx - r * 0.2, cy - r * 0.5);
      ctx.quadraticCurveTo(cx - r * 0.7, cy - r * 0.4, cx - r * 0.95, cy - r * 0.2); ctx.closePath(); ctx.fill();
      break;
    case 'combover':
      ctx.strokeStyle = c1; ctx.lineWidth = 0.9 * S; ctx.lineCap = 'round';
      for(let i = 0; i < 5; i++){ const t = i / 4; ctx.beginPath(); ctx.moveTo(cx - r * 0.8, cy - r * (0.55 - t * 0.1)); ctx.quadraticCurveTo(cx, top - (1 - t) * 1 * S, cx + r * 0.85, cy - r * (0.2 + t * 0.2)); ctx.stroke(); }
      ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(cx + r * 0.4, cy - r * 0.8); ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.35, cx + r * 1.1, cy - r * 1.0); ctx.stroke();
      break;
    case 'bob':
      ctx.fillStyle = c1; ctx.beginPath();
      ctx.moveTo(cx - r * 1.05, cy + r * 0.5); ctx.quadraticCurveTo(cx - r * 1.15, top, cx, top - r * 0.15);
      ctx.quadraticCurveTo(cx + r * 1.15, top, cx + r * 1.05, cy + r * 0.5);
      ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.2, cx + r * 0.7, cy - r * 0.3);
      ctx.quadraticCurveTo(cx, cy - r * 0.6, cx - r * 0.7, cy - r * 0.3);
      ctx.quadraticCurveTo(cx - r * 0.7, cy + r * 0.2, cx - r * 1.05, cy + r * 0.5); ctx.closePath(); ctx.fill();
      break;
    case 'ponytail':
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.2, r * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(cx + r * 0.6, cy - r * 0.3); ctx.lineTo(cx - r * 0.6, cy - r * 0.3); ctx.closePath(); ctx.fill();
      // a high, obvious tail (Priya's clearest silhouette read vs. Meredith's bob)
      const sway = o && o.moving ? Math.sin((o.walkPhase || 0)) * 2.4 * S : Math.sin((o && o.idlePhase || 0)) * 0.9 * S;
      ctx.beginPath(); ctx.arc(cx - r * 0.72, cy - r * 0.85, r * 0.34, 0, Math.PI * 2); ctx.fill();   // hair tie / bump
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.85, cy - r * 0.95);
      ctx.quadraticCurveTo(cx - r * 1.9 + sway, cy - r * 0.5, cx - r * 1.55 + sway, cy + r * 0.85);
      ctx.quadraticCurveTo(cx - r * 1.15 + sway, cy + r * 1.15, cx - r * 1.05 + sway, cy + r * 0.7);
      ctx.quadraticCurveTo(cx - r * 1.2, cy - r * 0.1, cx - r * 0.55, cy - r * 0.5); ctx.closePath(); ctx.fill();
      break;
    case 'buzz':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(cx, cy, r * 0.99, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill();
      break;
    case 'short':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(cx, cy - r * 0.15, r * 0.98, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(cx + r * 0.9, cy - r * 0.1); ctx.lineTo(cx - r * 0.9, cy - r * 0.1); ctx.closePath(); ctx.fill();
      break;
    case 'bald':
      if(rig.shine && !sil){ ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.55, r * 0.34, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'hood':       // hood framing the head — crown covered, FACE stays visible
      ctx.fillStyle = sil ? FIG_INK : (rig.topCol);
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.3, cy + r * 0.85);
      ctx.quadraticCurveTo(cx - r * 1.42, cy - r * 1.4, cx, cy - r * 1.45);
      ctx.quadraticCurveTo(cx + r * 1.42, cy - r * 1.4, cx + r * 1.3, cy + r * 0.85);
      ctx.quadraticCurveTo(cx + r * 0.95, cy - r * 0.1, cx + r * 0.86, cy - r * 0.62);
      ctx.quadraticCurveTo(cx, cy - r * 0.84, cx - r * 0.86, cy - r * 0.62);
      ctx.quadraticCurveTo(cx - r * 0.95, cy - r * 0.1, cx - r * 1.3, cy + r * 0.85);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = sil ? FIG_INK : shade(rig.topCol, 0.78); ctx.lineWidth = 1 * S; ctx.stroke();
      break;
    case 'phones':
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.arc(cx - r * 0.7, cy - r * 0.75, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.7, cy - r * 0.75, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 1.0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(cx + r * 0.5, cy - r * 0.55); ctx.lineTo(cx - r * 0.5, cy - r * 0.55); ctx.closePath(); ctx.fill();
      break;
  }
  if(rig.hair === 'phones'){
    // the badger wears his ON the ears: cups over the round ears + a crown band.
    // Cuter, and it never crosses the face at any scale.
    ctx.strokeStyle = sil ? FIG_INK : '#2a2824'; ctx.lineWidth = 2.2 * S; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.12, r * 1.02, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
    [-1, 1].forEach(s => {
      ctx.beginPath(); ctx.arc(cx + s * r * 0.7, cy - r * 0.75, r * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = sil ? FIG_INK : '#34302b'; ctx.fill();
      if(!sil){ ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1 * S;
        ctx.beginPath(); ctx.arc(cx + s * r * 0.7, cy - r * 0.75, r * 0.2, 0, Math.PI * 2); ctx.stroke(); }
    });
  } else if(rig.phones){
    // Kayla: big over-ear cans + overhead band
    ctx.strokeStyle = sil ? FIG_INK : '#2a2824'; ctx.lineWidth = 1.8 * S; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 1.18, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.fillStyle = sil ? FIG_INK : '#34302b';
    [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(cx + s * r * 1.12, cy - r * 0.1, 1.7 * S, 2.4 * S, 0, 0, Math.PI * 2); ctx.fill(); });
  }
  if(rig.airpod && !sil){ ctx.fillStyle = '#f2ede2'; ctx.beginPath(); ctx.ellipse(cx + r * 0.95, cy + r * 0.1, 1.1 * S, 1.6 * S, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#9a917f'; ctx.lineWidth = 0.6 * S; ctx.stroke(); }
}

// the ONE dominant prop, drawn at the working hand
function figProp(ctx, rig, sh, headCX, headCY, headR, S, sil, o){
  const col = c => sil ? FIG_INK : c;
  const ol = sil ? FIG_INK : 'rgba(18,14,10,0.9)';
  const nh = sh.near, fh = sh.far;
  switch(rig.prop){
    case 'phone': {
      ctx.save(); ctx.translate(nh.hx, nh.hy); ctx.rotate(-0.35);
      ctx.fillStyle = col('#23262b'); ctx.beginPath(); rrPath(ctx, -1.8 * S, -3.4 * S, 3.6 * S, 6.8 * S, 0.8 * S); ctx.fill();
      if(!sil){ ctx.fillStyle = '#bcdfe8'; ctx.beginPath(); rrPath(ctx, -1.3 * S, -2.9 * S, 2.6 * S, 5.8 * S, 0.5 * S); ctx.fill(); }
      ctx.strokeStyle = ol; ctx.lineWidth = 0.9 * S; ctx.beginPath(); rrPath(ctx, -1.8 * S, -3.4 * S, 3.6 * S, 6.8 * S, 0.8 * S); ctx.stroke();
      ctx.restore(); break; }
    case 'binder': {
      const bx = (nh.hx + fh.hx) / 2, by = (nh.hy + fh.hy) / 2;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(0.08);
      ctx.fillStyle = col('#7a3b34'); ctx.beginPath(); rrPath(ctx, -6.5 * S, -5 * S, 13 * S, 10 * S, 1 * S); ctx.fill();
      ctx.strokeStyle = ol; ctx.lineWidth = 1.1 * S; ctx.stroke();
      if(!sil){ ctx.fillStyle = '#e9e2d2'; ctx.fillRect(-5.2 * S, -4 * S, 2 * S, 8 * S); ctx.strokeStyle = '#c9b98a'; ctx.lineWidth = 0.7 * S; for(let i = 0; i < 3; i++){ ctx.beginPath(); ctx.moveTo(-2 * S, (-2.5 + i * 2.5) * S); ctx.lineTo(5 * S, (-2.5 + i * 2.5) * S); ctx.stroke(); } }
      ctx.restore(); break; }
    case 'earpiece': {
      if(!sil){ ctx.fillStyle = '#1c1712'; ctx.beginPath(); rrPath(ctx, headCX + headR * 0.7, headCY - 1.5 * S, 2.2 * S, 3.2 * S, 0.6 * S); ctx.fill(); ctx.fillStyle = '#41E3D6'; ctx.beginPath(); ctx.arc(headCX + headR * 0.7 + 1.1 * S, headCY, 0.6 * S, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = FIG_INK; ctx.beginPath(); rrPath(ctx, headCX + headR * 0.7, headCY - 1.5 * S, 2.2 * S, 3.2 * S, 0.6 * S); ctx.fill(); }
      break; }
    case 'clipboard': {
      const bx = (nh.hx + fh.hx) / 2, by = (nh.hy + fh.hy) / 2;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.12);
      ctx.fillStyle = col('#c9a25a'); ctx.beginPath(); rrPath(ctx, -4.5 * S, -6 * S, 9 * S, 12 * S, 0.8 * S); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1 * S; ctx.stroke();
      if(!sil){ ctx.fillStyle = '#f6f1e6'; ctx.fillRect(-3.4 * S, -4.6 * S, 6.8 * S, 9 * S); ctx.fillStyle = '#8a8f96'; ctx.fillRect(-1.6 * S, -6.4 * S, 3.2 * S, 1.4 * S); ctx.strokeStyle = '#b9b2a0'; ctx.lineWidth = 0.6 * S; for(let i = 0; i < 4; i++){ ctx.beginPath(); ctx.moveTo(-2.6 * S, (-2.5 + i * 2) * S); ctx.lineTo(2.6 * S, (-2.5 + i * 2) * S); ctx.stroke(); } }
      ctx.restore(); break; }
    case 'mug': {   // the GIANT mug — a dominant chunk of the silhouette
      ctx.save(); ctx.translate(nh.hx + 1.8 * S, nh.hy + 0.5 * S);
      ctx.fillStyle = col('#2f6d63'); ctx.beginPath(); rrPath(ctx, -4.6 * S, -6.2 * S, 9.2 * S, 11.4 * S, 1.8 * S); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 1.2 * S; ctx.stroke();
      ctx.beginPath(); ctx.arc(5.8 * S, -0.4 * S, 3.2 * S, -1.15, 1.15); ctx.lineWidth = 2.0 * S; ctx.stroke();   // big handle
      if(!sil){ ctx.fillStyle = '#e9e2d2'; ctx.beginPath(); ctx.ellipse(0, -6.0 * S, 4.1 * S, 1.3 * S, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); rrPath(ctx, -3.2 * S, -4.6 * S, 2.2 * S, 8 * S, 1 * S); ctx.fill(); }
      ctx.restore(); break; }
    case 'laptop': {
      ctx.save(); ctx.translate(nh.hx - 1 * S, nh.hy - 1 * S); ctx.rotate(-0.15);
      ctx.fillStyle = col('#3a3f47'); ctx.beginPath(); rrPath(ctx, -6 * S, -1.6 * S, 12 * S, 3.2 * S, 0.6 * S); ctx.fill(); ctx.strokeStyle = ol; ctx.lineWidth = 0.9 * S; ctx.stroke();
      if(!sil){ ctx.fillStyle = '#20242a'; ctx.beginPath(); rrPath(ctx, -5.4 * S, -6.4 * S, 11 * S, 5.2 * S, 0.5 * S); ctx.fill(); ctx.fillStyle = 'rgba(143,183,201,0.5)'; ctx.fillRect(-4.8 * S, -5.9 * S, 9.6 * S, 4.2 * S); }
      ctx.restore(); break; }
  }
}

// A framed cute BUST portrait of a character — the "on a screen" close-up shown
// when you talk to someone (status popup) or when their card fires. Reuses the
// figure renderer, scaled + positioned so the big head + shoulders fill the tile.
function drawPortrait(ctx, id, x, y, sz, tMs, mood){
  const rig = RIG[id] || RIG.you;
  ctx.save();
  ctx.beginPath(); rrPath(ctx, x, y, sz, sz, sz * 0.16); ctx.clip();
  // the "screen": warm paper with a soft honey glow behind the head
  const bg = ctx.createLinearGradient(x, y, x, y + sz);
  bg.addColorStop(0, '#f7f0e0'); bg.addColorStop(1, '#e3d7bf');
  ctx.fillStyle = bg; ctx.fillRect(x, y, sz, sz);
  const gl = ctx.createRadialGradient(x + sz * 0.5, y + sz * 0.4, 0, x + sz * 0.5, y + sz * 0.4, sz * 0.62);
  gl.addColorStop(0, 'rgba(244,220,166,0.55)'); gl.addColorStop(1, 'rgba(244,220,166,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, y, sz, sz);
  // frame the bust: head radius ~0.30·sz, head centre ~0.42·sz down, whatever the build
  const P = figPosture(rig.posture), H = rig.h || 1;
  const hR = 4.6 * (rig.headScale || 1) * 1.34;
  const headAbove = 12.6 * (rig.legLen || 1) * H + 11.5 * (rig.torso || 1) * H + hR * 0.82 + 1.4;
  const z = 0.30 * sz / hR;
  const feetY = y + 0.42 * sz + headAbove * z;
  const cxp = x + sz * 0.5 - (P.lean + P.headFwd) * z;
  const iph = (tMs || 0) / 900 + (id.charCodeAt(0) % 9);
  drawFigure(ctx, cxp, feetY, z, rig, { mood: mood || rig.restFace || 'fine', idlePhase: iph, face: true });
  // a faint diagonal sheen so it reads as a lit screen
  ctx.globalCompositeOperation = 'overlay';
  const sh = ctx.createLinearGradient(x, y, x + sz, y + sz);
  sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(x, y, sz, sz);
  ctx.restore();
  // frame ring
  ctx.strokeStyle = 'rgba(30,22,14,0.42)'; ctx.lineWidth = Math.max(1.2, sz * 0.02);
  ctx.beginPath(); rrPath(ctx, x, y, sz, sz, sz * 0.16); ctx.stroke();
}

function drawActor(ctx, cam, a, w){
  const z = cam.z;
  const [px, py] = proj(cam, a.x, a.y);
  const rig = RIG[a.id] || RIG.you;
  // contact shadow, sized to the figure's build
  ctx.beginPath(); ctx.ellipse(px, py, 10 * z * (rig.w || 1), 5 * z, 0, 0, Math.PI * 2);
  ctx.fillStyle = WT.contactShadow; ctx.fill();
  // the Boss's bad-day / patrol ring stays a floor tell
  if(a.id === 'boss' && (a.mood === 'bad' || a.state === 'patrol')){
    ctx.beginPath(); ctx.ellipse(px, py, 15 * z, 7.5 * z, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(176,85,58,0.85)'; ctx.lineWidth = 2.5 * z; ctx.stroke();
  }
  // ── the actor, assembled from the RIG (Bible §13/§15) ──
  const moodMap = { good:'fine', meh:'tired', bad:'alarmed' };
  let fmood = moodMap[a.mood] || 'fine';
  if(fmood === 'fine' && rig.restFace) fmood = rig.restFace;   // signature resting expression
  if(a.id === 'brad' && (a.state === 'lurk' || a.state === 'lurkwalk' || a.state === 'raid')) fmood = 'scheming';
  else if(a.state === 'patrol') fmood = 'alarmed';
  else if(a.id === 'kayla' && a.mood === 'bad') fmood = 'dead';
  const moving = !!(a.path && a.path.length);
  if(moving){ const n = a.path[0]; const sdx = (n.x - a.x) - (n.y - a.y); if(Math.abs(sdx) > 0.001) a._fl = sdx < 0; }
  const cadence = { bounce:12, march:6.5, shuffle:4.2, drift:5.2, amble:6.6, brisk:13, precise:11, strut:7.5, trudge:6 }[rig.walk] || 8;
  drawFigure(ctx, px, py, z, rig, {
    mood: fmood, moving,
    walkPhase: (_tMs / 1000) * cadence * (rig.spd || 1),
    idlePhase: (_tMs / 1000) * 1.1 + (a.x + a.y),   // desynced per position
    faceLeft: !!a._fl
  });
  // the interception, visible: Adam is talking AT you
  if(a.id === 'adam' && w && w.intercept){
    ctx.font = (13 * z) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('💬', px + 14 * z, py - 40 * z);
    ctx.fillStyle = 'rgba(21,18,13,0.55)';
    ctx.font = '700 ' + Math.max(8, 9 * z) + 'px "Space Mono", monospace';
    ctx.fillText('“quick thought—”', px, py - 50 * z);
  }
  // threat telegraphs: the floor-walk and the raid are readable at a glance
  if(a.state === 'patrol' || a.state === 'raid'){
    ctx.fillStyle = '#D8443F';
    ctx.font = '800 ' + (14 * z) + 'px system-ui';
    ctx.fillText('❗', px - 12 * z, py - 34 * z);
  }
  // the PRE-tells: trouble you can see coming (and physically answer)
  if(a.id === 'brad' && (a.state === 'lurk' || a.state === 'lurkwalk')){
    ctx.font = (13 * z) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('👀', px - 12 * z, py - 34 * z);
  }
  if(a.id === 'boss' && a.state === 'idle' && w
     && w.bossWalks.some(b => b.status === 'pending' && b.warned)){
    ctx.font = (13 * z) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('📋', px - 12 * z, py - 34 * z);   // he's read the floor; he's next
  }
  if(a.id === 'adam' && (a.state === 'concern' || a.state === 'grenade')){
    ctx.font = (13 * z) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('📋', px + 12 * z, py - 34 * z);
  }
  // Dennis carrying an approval: the red folder reads from across the floor
  if(a.id === 'dennis' && a.state === 'carry'){
    ctx.fillStyle = '#D8443F';
    ctx.strokeStyle = 'rgba(21,18,13,0.4)';
    ctx.lineWidth = 1 * z;
    ctx.fillRect(px + 7 * z, py - 18 * z, 9 * z, 6.5 * z);
    ctx.strokeRect(px + 7 * z, py - 18 * z, 9 * z, 6.5 * z);
  }
  // the approval wait: an amber bar while the questions are answered
  if(a.id === 'you' && w && w.playerErrand && w.playerErrand.type === 'approvalwait'){
    const bw2 = 30 * z;
    ctx.fillStyle = 'rgba(21,18,13,0.25)';
    ctx.fillRect(px - bw2 / 2, py - 40 * z, bw2, 5 * z);
    ctx.fillStyle = '#E8814C';
    ctx.fillRect(px - bw2 / 2, py - 40 * z, bw2 * Math.min(1, w.playerErrand.t / APPROVAL_WAIT_SECS), 5 * z);
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
  // floor name: first name — but skip articles so "The Boss" reads BOSS, not THE
  const nm = a.id === 'you' ? 'YOU'
    : a.name.split(' ').filter(wd => wd.toLowerCase() !== 'the')[0].toUpperCase();
  ctx.fillText(nm, px, py + 12 * z);
}

return {
  GRID_W, GRID_H, TW, TH, CAST, FURNITURE, ZONES, OWNER_BY_ENC, STAIRS_SPOT,
  TASKS_MIN, TASKS_MAX, TASK_WORK_SECS, CRUNCH_CHANCE, CLOCK_SPEED,
  setEncounters, newDay, step, resolveEncounter, resolveCrunch, eventsRemaining,
  movePlayer, goForCoffee, goForCouch, requestChat, playerGoHome, playerAtDesk,
  armWalkout, goForExit, goForBossCall, resolveQuickCall, takeKaylaTask, reportKayla,
  goForApproval, flatterDennis, clearAllBlocked, APPROVAL_WAIT_SECS,
  confrontBrad, flashBrad, plantBait, walkWithDennis, redirectAdam, grenadeAdam,
  goPreDemo, goForCoolHR, applyGrenade,
  sendTo, bfsPath, isWalkable, adjacentTo, getActor,
  pickActorAt, furnitureAt, isCoffeeAt, isCouchAt, isExitAt, statusOf, clockToMin, minToClock,
  render, proj, screenToTile,
  RIG, drawFigure, drawPortrait   // exposed for the cast test sheet + in-game portraits
};
})();

// browser + headless-test exposure
if (typeof window !== 'undefined') window.NtosWorld = NtosWorld;
if (typeof module !== 'undefined' && module.exports) module.exports = NtosWorld;
