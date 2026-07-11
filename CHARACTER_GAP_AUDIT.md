# CHARACTER GAP AUDIT

Honest audit of the character rendering against the Design Bible (§13 Character
System, §15 Character Language v3, §12 The Office, §07 Motion) — written **before**
the rebuild, and used to drive it.

## The systemic failure (all nine at once)
The old `drawActor` drew **one shape language for everyone**: a shadow, a single
body **ellipse** tinted `a.color`, a head **dome**, and an emoji mood face. Height,
width, shoulders, hips, posture, hands, clothing, hair and gait were **identical**
across the cast — only the fill colour and an Adam "shine" / bear ears changed.
That is exactly Bible §15's **Weakness 03**: *"Characters are portraits, not actors
— everyone faces front, symmetrical, weightless. No hips, no hands doing anything…
the silhouettes pass the black test but fail the life test."* In our case they
failed the black test too: nine identical ovals are one silhouette, not nine.

**Fix (systemic):** replace the per-actor drawing with a **construction-kit rig**
(§13) + a procedural figure renderer that varies build, posture (contrapposto by
default; vertical only for the Boss/fear per §15), working hands holding a
**dominant** prop, clothing silhouettes with fold lines, two-tone hair, class-marker
shoes, a **five-mood face matrix** (lid/brow/mouth only), and a **per-person walk
cycle + signature idles** (§07: "walk cycles are casting"; "idle = doing").

Below, per character: **bible target → old result → gaps → required changes.**

---

### YOU (the badger)
- **Bible:** the shrugging badger; headphones round the neck, resigned half-lids,
  palms-up in a permanent "well?"; the only animal in the building; graphite body.
- **Old:** grey ellipse, round head, two black "ears", pale snout, no mood emoji.
  Read as a generic bear blob; no shrug, no headphones, no half-lid face.
- **Gaps:** no shrug posture; no palms-up hands; no headphones; no distinct badger
  head stripe/mask; same body ellipse as humans.
- **Fix:** `posture:'shrug'` (raised shoulders, both arms out, open palms); badger
  head with dark eye-mask stripes + pale muzzle; headphones as a neckband; resigned
  half-lid eyes; graphite two-tone body. Must be unmistakably non-human.

### BRAD — the credit thief
- **Bible:** taller, leaner; quarter-zip; gelled swoop; one AirPod; forward lean;
  phone face-up; bouncy toe walk; invades space.
- **Old:** blue ellipse, same height as all, plain round head. No lean, no zip, no
  hair, no phone, no bounce.
- **Gaps:** height/lean/quarter-zip collar/swoop hair/AirPod/phone prop/bounce gait.
- **Fix:** `h:1.16 w:.86`, `posture:'leanfwd'`, `top:'quarterzip'` (half-zip collar +
  pull), `hair:'swoop'`, one-AirPod dot, `prop:'phone'` held face-up, `walk:'bounce'`
  (toe-spring, +vertical bob), `speed:1.12`.

### DENNIS — the bureaucrat (19 yrs)
- **Bible:** shorter, wider, hunched; cardigan; glasses; comb-over; binder held to
  chest; slow shuffle.
- **Old:** green ellipse, upright, no glasses, no binder except a red carry-tell.
- **Gaps:** short+wide build/hunch/cardigan/glasses/comb-over/permanent binder/shuffle.
- **Fix:** `h:.9 w:1.22`, `posture:'hunch'` (rounded upper back, head forward+down),
  `top:'cardigan'` (V-front + buttons), `glasses:true`, `hair:'combover'` (grey, one
  HVAC flyaway), `prop:'binder'` clutched to chest (dominant), `walk:'shuffle'`
  (binder-first, tiny strides), `speed:.72`.

### THE BOSS — runs the floor
- **Bible:** tallest, broadest; rigid vertical spine; dark suit + red tie; phone
  welded to one ear; direct march from the sternum.
- **Old:** near-black ellipse; only differed by a red floor-ring on bad days.
- **Gaps:** tallest/broadest build/rigid posture/suit lapels+red tie/hand-at-ear
  earpiece/marching gait.
- **Fix:** `h:1.26 w:1.14`, `posture:'rigid'` (only vertical spine in the cast),
  `top:'suit'` (lapels + `tie:'#b23b34'`), squared shoulders, `arms:'earphone'`
  (hand up to ear + earpiece block), `walk:'march'` (long even strides, no bob).

### MEREDITH (HR) — the HR shark
- **Bible:** sharp upright silhouette; blazer; bob; lanyard; ever-present clipboard;
  short precise steps.
- **Old:** pink ellipse; no blazer shoulders, no bob, no clipboard, no lanyard.
- **Fix:** `posture:'upright'`, `top:'blazer'` (structured shoulders + notch),
  `hair:'bob'` (chin-length two-tone), `lanyard:true`, `prop:'clipboard'` held at
  waist mid-note, `walk:'precise'` (short quick steps), `speed:1.05`.

### KAYLA — also trying to get out
- **Bible:** smaller frame; collapsed shoulders; hood up / huge headphones; worn
  slip-ons; drifts near walls; tired idle. Treated with care, never the punchline.
- **Old:** teal ellipse, same size, upright, no hood/headphones.
- **Fix:** `h:.86 w:.9`, `posture:'collapse'` (dropped, narrowed shoulders, head
  down), `top:'hoodie'` (hood shape behind head), oversized headphones, `bighead`
  softening, `shoes:'slipon'`, `arms:'pocket'` (hands in pockets), `walk:'drift'`
  (slow, low amplitude), tired idle. Dignified silhouette, small on purpose.

### MARCUS — the survivor / mentor
- **Bible:** broad relaxed stance; loose posture; henley; giant mug; slow amble;
  leans and slouches.
- **Old:** orange ellipse, upright, no mug.
- **Fix:** `w:1.16`, `posture:'lounge'` (weight back, hip out, relaxed), `top:'henley'`
  (placket + rolled sleeves), `prop:'mug'` — a **giant** Yeti held one-handed
  (dominant), `walk:'amble'` (slow, easy roll), `speed:.82`.

### PRIYA — actually does the work
- **Bible:** slim upright silhouette; ponytail; laptop / sticky notes; fast walk;
  typing-focused idle; visibly more purposeful.
- **Old:** purple ellipse, no ponytail, no laptop.
- **Fix:** `h:1.02 w:.82`, `posture:'upright'`, `hair:'ponytail'` (high tail that
  swings on walk), `prop:'laptop'` carried on one forearm, `arms:'laptop'`, typing
  idle, `walk:'brisk'` `speed:1.18` (the 8%-faster rule from §15).

### ADAM — the meddler
- **Bible:** bald with a shine; tucked polo; hands on hips; lanyard / process
  notebook; hovering posture; interrupting idle.
- **Old:** tan ellipse with a white shine ellipse + slightly bigger head. Closest of
  the lot, but still just an oval.
- **Fix:** `posture:'hoverhips'` (hands on hips → elbows out widen the silhouette,
  slight forward hover), `hair:'bald'` + specular `shine`, `top:'polo'` (collar +
  tucked waist), `lanyard:true`, `arms:'hips'`, `walk:'strut'`. Keep the ❝quick
  thought—❞ intercept tell.

---

## Acceptance criteria this rebuild must pass (Bible §13/§15)
1. At normal gameplay zoom, Brad / Dennis / Boss / Meredith / Kayla / Marcus / Priya
   are recognizable **without labels**.
2. In **pure black**, each major silhouette stays distinct (build + stance + one prop).
3. In motion, the **gait** still identifies the character.
4. **No two** majors share body + posture + prop.
5. The player is unmistakably the **badger**.

Verified on the cast test sheet (`character-test.html`, six lineups) before this
is called done — see `VISUAL_PRODUCTION_REPORT.md` for the shots.
