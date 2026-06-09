/* ==========================================================================
   Light Again — Constants & Palette
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain = window.LightAgain || {};
  LA.sceneMethods = {};

  /* ---- Circular world helpers ------------------------------------------------
     The arena is a DISC centred on the origin. C.WORLD_HALF is its radius (px
     from centre to wall). Every boundary check is radial; these shared helpers
     keep that logic identical everywhere (player, enemies, bosses, projectiles,
     map-event placement). margin = keep-in inset (entity half-size, etc.). */
  LA.worldRadius = function () { return LA.C.WORLD_HALF; };

  // Clamp a point into the disc of radius (WORLD_HALF - margin). Returns the
  // clamped {x, y}, whether it had to move (hit), and the OUTWARD unit normal
  // (nx, ny) at the wall — used to reflect velocity on a bounce.
  LA.clampDisc = function (x, y, margin) {
    var lim = LA.C.WORLD_HALF - (margin || 0);
    if (lim < 0) lim = 0;
    var d = Math.sqrt(x * x + y * y);
    if (d <= lim || d === 0) return { x: x, y: y, hit: false, nx: 0, ny: 0, d: d, lim: lim };
    var inv = 1 / d;
    return { x: x * lim * inv, y: y * lim * inv, hit: true, nx: x * inv, ny: y * inv, d: d, lim: lim };
  };

  // True when (x, y) lies within the disc of radius (WORLD_HALF - margin).
  LA.inDisc = function (x, y, margin) {
    var lim = LA.C.WORLD_HALF - (margin || 0);
    return x * x + y * y <= lim * lim;
  };

  // Uniform-random point inside the disc of radius (WORLD_HALF - margin).
  LA.randInDisc = function (margin) {
    var lim = LA.C.WORLD_HALF - (margin || 0);
    if (lim < 0) lim = 0;
    var a = Math.random() * Math.PI * 2;
    var r = Math.sqrt(Math.random()) * lim;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  };

  // Squared distance from point (px,py) to the segment (ax,ay)-(bx,by). Shared so
  // a Data Highway CAPSULE (centreline segment + half-width band) and a point-radius
  // map feature can be kept from ever overlapping (see _spawnHighway / the features).
  LA.segDistSq = function (px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = ax + dx * t, cy = ay + dy * t;
    var ex = px - cx, ey = py - cy;
    return ex * ex + ey * ey;
  };

  /* ---- Game constants ---- */
  var C = LA.C = {
    ACCEL:       0.7,
    FRICTION:    0.92,
    SIZE:        20,
    DASH_IMP:    28,
    DASH_DUR:    120,
    DASH_CD:     1200,
    ATK_IMP:     18,
    ATK_DUR:     280,
    ATK_CD:      0,
    ATK_SPIN:    28,
    DASH_ATK_IMP:  30,
    DASH_ATK_DUR:  300,
    DASH_ATK_SPIN: 50,
    RECOVERY_DUR:      180,
    RECOVERY_FRIC:     0.80,
    ATK_WHIFF_DUR:     220,
    DASHATK_WHIFF_DUR:  380,
    DASHATK_WHIFF_FRIC: 0.70,
    DASHATK_CHAIN_EXT:  40,
    DASHATK_MAX_EXT:    180,
    DASHATK_VACUUM_RADIUS: 240,   // Lv2 upgrade: projectile pull radius
    DASHATK_VACUUM_PULL:   520,   // Lv2 upgrade: pull force (px/s)
    DASH_TORNADO_RADIUS: 180,   // dash Lv2: tornado attraction radius
    DASH_TORNADO_PULL:   130,   // dash Lv2: enemy pull force (px/s)
    DASH_TORNADO_DUR:   3000,   // dash Lv2: tornado lifetime (ms)
    HITSTOP_DUR:        40,
    HITSTOP_MAX:        80,
    DETONATION_HITSTOP: 120,
    IFRAMES_DUR:   800,
    SPAWN_DIST:      650,
    MAX_ENEMIES:     1000,

    /* ---- Steve skin: enchanted-netherite dash-attack animation ---- */
    NETH_FRAMES: 60,   // frames in the spritesheet (5 cols × 12 rows)
    NETH_FPS:    20,   // 60 frames / 3 s loop

    /* ---- Enemy rarity "bag" (shuffled lot, refilled when empty) ---- */
    // One bag = this many of each tier; drawing empties it, then it refills.
    // Guarantees the ratio over every cycle and forbids 3 generators in a row.
    BAG_T1: 7,   // simple (red triangle)
    BAG_T2: 2,   // shooter (orange diamond)
    BAG_T3: 1,   // generator (purple hexagon)

    /* ---- Sandbox: continuous one-by-one stream, mouse-wheel paced ---- */
    SANDBOX_BASE_INTERVAL: 800,   // ms between spawns at rate x1
    SANDBOX_RATE_MIN:      0,
    SANDBOX_RATE_MAX:      16,
    SANDBOX_RATE_STEP:     0.5,
    SANDBOX_RATE_DEFAULT:  1,
    SANDBOX_SPEED_UI_DUR:  2.0,   // s the speed slider stays visible after a scroll

    /* ---- Hardcore: bursty waves that grow with the player's total kills ---- */
    HC_WAVE_BASE:    6,      // enemies in the very first wave (was 4 — punchier start)
    HC_WAVE_PER:     38,     // +1 wave enemy per this many total kills (was 55 — scales faster)
    HC_WAVE_MAX:     60,     // wave-size cap (was 40 — late-game crowds get bigger)
    HC_WAVE_GAP_MIN: 2500,   // ms between waves (was 3500 — waves come more often)
    HC_WAVE_GAP_MAX: 4000,
    LOADER_WARMUP_FRAMES:        45,
    LOADER_RESTART_WARMUP_FRAMES: 14,
    SEPARATION_RADIUS: 30,
    SEPARATION_FORCE:  4.0,
    REBOUND_IMP:       14,
    SHOCKWAVE_RADIUS:  110,
    SHOCKWAVE_FORCE:   14,
    SHOCKWAVE_STUN:    300,
    LANDING_BURST_RADIUS: 180,
    LANDING_BURST_FORCE:  28,
    LANDING_BURST_STUN:   500,
    DASH_MARK_RADIUS:     30,
    CAM_LERP:    0.10,
    WORLD_HALF:  2850,   // arena is a DISC: radius (px) from centre to wall (see LA.clampDisc)
    /* ---- Wall rebound — the disc rim bounces you back (springy) ----
       Restitution = fraction of impact speed returned. >1 means you LEAVE faster
       than you arrived (the aggressive case for dash / attack into the wall). */
    WALL_REBOUND_BASE:   0.78,   // normal contact (drift into the wall)
    WALL_REBOUND_ATTACK: 1.45,   // dashing / attacking / dash-attacking into the wall
    WALL_REBOUND_KICK:   13,     // extra inward impulse on an aggressive wall hit
    WALL_REBOUND_MAX:    60,     // cap on rebound speed so it can never run away
    WALL_FX_CD:          150,    // ms between wall-impact VFX bursts (anti-spam)
    PCB_TILE:    256,
    RUSHER_SPEED: 3.0,
    RUSHER_SIZE:  14,
    T2_SIZE:      16,
    T2_SPEED:     1.8,
    T2_KEEP_DIST: 280,
    T2_FIRE_CD:   4500,
    T2_CHARGE_DUR: 500,
    T2_RECOIL:    6,
    PROJ_SPEED:   380,
    PROJ_RADIUS:  7,
    PROJ_LIFE:    4000,
    PROJ_REFLECT_MULT: 1.8,
    DEFLECT_HITSTOP:   40,
    DEFLECT_HEAVY_HS:  80,
    MAX_PROJECTILES:   60,
    T3_SIZE:           24,
    T3_SPEED:          1.2,
    T3_SPAWN_CD:       3500,
    T3_SHIELD_RADIUS:  42,

    /* ---- The Sniper (T4 — "Œil-scope") -----------------------------------
       A cyclopean steel lens that snipes from the FAR edge of the screen.
       It cycles: CLOAK (near-invisible + invincible, drifting to a fresh
       vantage) → CHARGE (it materialises, an iris/réticule locks onto the
       player with a stylish charge animation — the ONLY window it can be
       killed) → FIRE (a single very fast, non-reflectable laser bolt aimed at
       the player's position at the instant of the shot, NO trajectory
       telegraph) → VANISH (snaps shut, re-cloaks). 2 HP, no shield. Worth
       more than a generator. The World does NOT reveal a cloaked sniper, but a
       sniper frozen mid-CHARGE/FIRE can be calmly killed (a dash-attack or a
       detonation one-shots it, else 2 basic "torpedo" hits); its laser greys
       out + halts like an enemy (NOT bright/parryable like a T2 bullet). Lives
       in this.enemies as tier 4. */
    T4_SIZE:             20,     // lens half-radius (px)
    T4_HP:               2,      // like a bruiser; no shield
    T4_KEEP_DIST:        640,    // desired vantage distance from the player (px) — "encore plus loin que les T2"
    T4_VANTAGE_VIS_FRAC: 0.82,   // vantage distance is capped to this × the on-screen safe radius (stays in view)
    T4_VANTAGE_MIN:      340,    // hard floor on the vantage distance (px) — never charge point-blank
    T4_CLOAK_DUR:        2600,   // ms invisible + invincible between shots (repositioning)
    T4_CHARGE_DUR:       1150,   // ms of the visible, VULNERABLE charge before the shot
    T4_VANISH_DUR:       220,    // ms of the snap-shut fade back to cloak after firing
    T4_APPEAR_DUR:       240,    // ms fade-in pop when a charge begins
    T4_DRIFT_SPD:        1.7,    // px/frame orbit speed while cloaked (legacy; glide below is used now)
    T4_GLIDE_RATE:       2.8,    // 1/s smooth-glide rate toward the next firing vantage while cloaked (NO teleport → a dash-marked eye is followable; gentle enough to track by eye)
    T4_ORBIT_RATE:       0.55,   // rad/s slow angular drift of the cloak orbit (variety)
    T4_SCORE:            250,    // base points (× combo) — MORE than a T3 generator (100)
    T4_LASER_SPEED:      980,    // px/s — a very fast bolt (≈2.6× PROJ_SPEED), hard to dodge
    T4_LASER_LIFE:       2600,   // ms before the bolt expires
    T4_LASER_RADIUS:     6,      // thin hit radius vs the player (px)
    T4_TINT:             0xdff0ff,        // icy white-steel body tint
    T4_TINT_ARR:         [223, 240, 255], // ...as an [r,g,b] for particle bursts
    T4_HOT:              0xbfeaff,        // charged-lens hot accent (cold electric blue)
    T4_LASER_CORE:       0xffffff,        // laser white-hot core
    T4_LASER_GLOW:       0x8fe6ff,        // laser cyan glow halo

    STAR_DUR:          5000,    // default Overdrive duration (a normal star pickup)
    STAR_WARN_REMAIN:  1000,    // ms of Overdrive left at which the HUD bar starts blinking
    STAR_DETO_THRESH:  50,
    STAR_TINT:         0xff14c8,
    STAR_TINT_ARR:     [255, 20, 200],

    /* ---- Upgrade system (roguelite draft) ---- */
    UPGRADE_KILL_INTERVAL: 200,   // legacy (kept for back-compat; no longer drives upgrades)
    UPGRADE_DRAFT_SIZE:    2,      // cards shown per pick (a boss kill grants BOSS_DRAFT_PICKS picks)
    BOSS_DRAFT_PICKS:      3,      // picks awarded per boss kill (pick 1-of-2, three times)
    /* ---- Boss spawning is now KILL-COUNT based (the old timer is gone) ----
       The HUD counter shows kills-until-next-boss; bosses are the ONLY upgrade
       source. Hardcore: the gap grows by +100 each boss (100 → 200 → 300 …).
       Sandbox: a flat gap. The counter "pauses" while a boss is alive (DANGER). */
    BOSS_KILL_INTERVAL:          200,    // sandbox: flat kills between bosses
    BOSS_KILL_INTERVAL_HC_START: 100,    // hardcore: kills to the FIRST boss
    BOSS_KILL_INTERVAL_HC_STEP:  100,    // hardcore: gap grows by this each boss
    BOSS_KILL_SCORE:             10000,  // base points a boss awards on death (×combo)
    BOSS_DEATH_RING_S:           2.0,    // seconds of the stylish ring-retract death animation before a boss explodes
    BOSS_HINT_DELAY_S:           40,     // sandbox: seconds fighting a FIRST-time boss before its weakness tooltip pops
    BOSS_HINT_LIFE_S:            22,     // seconds the weakness tooltip stays on screen before auto-fading
    UPGRADE_REROLLS_START: 1,     // rerolls the run begins with (+1 earned per boss kill)
    SPAWN_INTRO_DUR:       1.0,   // seconds the run-start arrow "materialise" flourish plays
    SPAWN_INTRO_DRAFT_MS:  1000,  // ms after the spawn flourish before the welcome draft (3 picks) opens
    SPAWN_INTRO_START_DELAY_MS: 1000,  // ms after the loader clears before the arrow materialises (loader fully fades + a beat where the EMPTY arena shows)
    UPGRADE_CURSE_CHANCE:  0.25,  // chance one draft slot becomes a curse (never on the 1st draft)
    UPGRADE_ANTIFLOOD_W:   0.16,  // weight ×factor for a card that was offered (not picked) last draft
    UPGRADE_W_LVL1:        1.0,   // draw weight by level — capstones are rarer
    UPGRADE_W_LVL2:        0.6,
    UPGRADE_W_LVL3:        0.34,
    // Curse magnitudes (risk/reward — every curse costs −1 shield slot)
    CURSE_SCORE_MULT:      1.8,   // glassHeart : score gain ×
    CURSE_DASH_CD_MULT:    0.5,   // dashRage   : dash cooldown ×
    // dashRage also lengthens the dash itself: more impulse (flee farther + sweep
    // more enemies into the dash-mark) and a slightly longer window (more mark
    // passes), plus a few extra post-dash i-frames. Kept modest on purpose — the
    // worst case (dashRage + Dash Lv1 → 420 ms cd) still leaves a ~130 ms vulnerable
    // gap every cycle, so it's "safer", NOT permanently invincible.
    CURSE_DASH_IMP_MULT:    1.25,  // dashRage : dash impulse × (reach / mark sweep)
    CURSE_DASH_DUR_MULT:    1.15,  // dashRage : dash duration × (more mark passes)
    CURSE_DASH_IFRAME_BONUS:  70,  // dashRage : extra ms of post-dash i-frames (base 220)
    CURSE_BLAST_MULT:      1.4,   // cursedBlast: all player-allied explosion radii ×

    /* ---- Delayed explosion (Explosion à retardement = baseAtk branch) ----
       Also spawned by Dash-Attack Lv3 (on impact, 1/3) and Shield Lv3 (on
       shield loss). Its power scales with the baseAtk branch level (min Lv1). */
    DELAY_EXP_CHANCE_L1:  0.10,   // baseAtk Lv1 trigger chance (doubled from the old 0.05)
    DELAY_EXP_CHANCE_L2:  0.20,   // baseAtk Lv2+ trigger chance
    DELAY_EXP_DELAY:      2000,   // ms fuse (Lv1/Lv2)
    DELAY_EXP_DELAY_L3:   1100,   // ms fuse at Lv3 (faster, more aggressive)
    DELAY_EXP_RADIUS_L1:  1.1,    // blast radius × SHOCKWAVE_RADIUS
    DELAY_EXP_RADIUS_L2:  1.8,
    DELAY_EXP_RADIUS_L3:  2.3,    // bigger
    DASHATK_DELAY_EXP_CHANCE: 0.3334,  // dashAtk Lv3: 1-in-3 per impact (capped 1/dash-attack)
    // When lots of upgrades + a big crowd make detonations chain rapidly, the
    // per-blast big-score popups and full-screen red flash become nauseating.
    // Group nearby detonations into one "Delayed Explosion ×N" popup, and dial
    // the screen-wide feedback (flash/shake/hitstop) down — then off.
    DELAY_EXP_GROUP_QUIET:   700,  // ms of quiet before the grouped popup flushes
    DELAY_EXP_GROUP_MAXLIFE: 1.5,  // s a bucket may accumulate before a forced flush
    DELAY_EXP_FX_WINDOW:     1.1,  // s sliding window counting recent detonations
    DELAY_EXP_FX_CALM:       2,    // ≤ this many in window → full flash+shake+hitstop
    DELAY_EXP_FX_BUSY:       4,    // ≤ this many → gentle shake only; above → no screen FX

    /* ---- Dash Lv3: tornadoes slowly GROW over their lifetime ---- */
    DASH_TORNADO_GROW_START: 0.5,  // radius starts at this × DASH_TORNADO_RADIUS
    DASH_TORNADO_GROW_END:   1.6,  // ...and ends at this × by the end of its life

    /* ---- Mini kamikaze drones (6th upgrade) — allied guided bombs ----
       Drones orbit the player, periodically dart at the nearest enemy and
       detonate in a small blast. Lv1 = 1 drone, Lv2 = 2 (faster cadence),
       Lv3 = 3 + their blast MARKS survivors (feeds the Detonation combo). */
    DRONE_ORBIT_R:        54,     // px the drones hover around the player
    DRONE_ORBIT_SPEED:    2.4,    // rad/s orbit angular speed
    DRONE_SIZE:           8,      // drone half-size (px)
    DRONE_ACQUIRE_RANGE:  460,    // max distance to acquire a dive target (px)
    DRONE_DIVE_SPEED:     330,    // px/s base dive speed
    DRONE_DIVE_ACCEL:     2.4,    // dive speed grows ×(1+age·this) across the dive
    DRONE_DIVE_TURN:      7.5,    // homing turn rate while diving (rad/s)
    DRONE_DIVE_TIMEOUT:   2200,   // ms before a diving drone self-detonates if it never connects
    DRONE_HIT_R:          16,     // contact slack added to enemy size → detonation
    DRONE_BLAST_R:        92,     // base detonation blast radius (px) — Lv1
    DRONE_BLAST_R_MULT_L2: 2.0,   // Lv2+: blast radius is DOUBLED
    DRONE_BLAST_DMG:      1,      // damage per enemy in the blast (all levels)
    // Lv3: when the drone blast finishes, a delayed explosion is planted at the spot.
    DRONE_DIVE_CD_L1:     2700,   // ms a drone orbits before it may dive again (Lv1)
    DRONE_DIVE_CD_L2:     1900,   // faster cadence at Lv2+
    DRONE_RESPAWN_L1:     3200,   // ms to rebuild a detonated drone (Lv1)
    DRONE_RESPAWN_L2:     2300,   // faster rebuild at Lv2+

    /* ---- The World (secret upgrade) ---- */
    TW_DURATION:           4000,
    TW_COOLDOWN:           30000,

    /* ---- The Anomaly (rare "glitch" mini-boss / quarantine event) ----
       An unstable RGB-split entity that wanders the arena, then slams a
       circular "firewall" around the player, vacuums the WHOLE board inside,
       halts natural spawns, and fires telegraphed lasers. Invulnerable
       (static shield) until every trapped enemy is dead; then it panics and
       can be killed, dropping a free upgrade. Shared by both game modes. */
    ANO_SIZE:            34,     // body half-extent (px)
    ANO_TRIGGER_RANGE:   360,    // player distance that slams the barrier
    ANO_BARRIER_RADIUS:  520,    // base quarantine zone radius (px), at ANO_MIN_TRAPPED
    ANO_BARRIER_PER_ENEMY: 6,    // +radius per trapped enemy beyond the minimum (small)
    ANO_BARRIER_MAX:     1000,    // hard cap on the quarantine radius (px) — kept tight
    ANO_VACUUM_RADIUS:   1100,   // ONLY sizes the barrier-radius floor (counts enemies within this); the slam sweeps the WHOLE board, not just this radius
    ANO_MIN_TRAPPED:     9,      // floor of trapped sub-fifres (boss spawns extras)
    ANO_LASER_CD:        2400,   // ms between laser volleys (while shielded)
    ANO_LASER_WARN:      520,    // telegraph duration — harmless thin line (ms)
    ANO_LASER_FIRE:      420,    // deadly beam duration (ms)
    ANO_LASER_WIDTH:     17,     // deadly beam half-width for the hit test (px)
    ANO_CROSS_FIRE:      2200,   // deadly duration of the rotating-cross attack (ms)
    ANO_CROSS_ROT:       0.00055,// cross rotation speed (rad/ms) — slow & readable
    ANO_PROJ_CD:         4800,   // ms between homing-projectile swarms (rarer salvos — was 3600)
    ANO_PROJ_SWARM_MIN:  3,      // swarm size (min) — 2 fewer per salvo (was 5)
    ANO_PROJ_SWARM_MAX:  5,      // swarm size (max) — 3 fewer per salvo (was 8)
    ANO_PROJ_SPEED:      200,    // homing projectile speed — small and slow
    ANO_PROJ_LIFE:       8500,   // homing projectile lifetime (ms) — pursues longer
    ANO_PROJ_TURN:       3.8,    // homing turn rate (rad/s) toward target
    ANO_PROJ_TURN_REFL:  5.5,    // even tighter once reflected (always hits its mark)
    ANO_PROJ_ACCEL:      1.4,    // extra speed factor at end-of-life (live: ×(1+age·this))
    ANO_PROJ_ACCEL_REFL: 2.8,    // even more once reflected — they pick up the pace
    ANO_PROJ_RADIUS:     4,      // tiny hitbox (vs PROJ_RADIUS 7)
    ANO_PROJ_SEP:        22,     // swarm spacing — repel each other so they don't stack
    /* ---- Intro cinematic timings (real-time ms) ---- */
    ANO_INTRO_STOP:      650,    // time-stop flash duration (ms)
    ANO_INTRO_RAISE:     1300,   // barrier expansion duration (ms)
    ANO_INTRO_RING_GAP:  200,    // ms between successive concentric rings of spawns
    ANO_VAC_RING_BASE:   180,    // innermost ring radius (px)
    ANO_VAC_RING_STEP:   80,     // gap between concentric rings (px)
    ANO_VAC_RING_SPACING: 65,    // min spacing between enemies on the same ring (px)
    ANO_INTRO_SLIDE:     650,    // banner-slide-to-hint duration (ms)
    ANO_CHARGE_DUR:      2200,   // ms of "energy charge" growth in WANDER once visible
    ANO_HP:              4,      // melee hits to kill once vulnerable
    ANO_PANIC_BLINK:     14,     // blink frequency while panicked/vulnerable
    ANO_SPAWN_MIN_DELAY: 40000,  // ms of play before a natural anomaly can appear
    ANO_SPAWN_CHANCE:    0.085,  // per-eligible-second spawn roll
    ANO_COOLDOWN:        30000,  // ms after one dies before another can spawn

    /* ---- The Giga Bruiser (alternative mini-boss, 1 chance / 2 vs Anomaly) ---
       A massive hexagon with a regenerating shield. Dash-attack breaks the
       shield (knocking the player back); base attack can be spammed once the
       shield is down, dash-attack bounces off (more damage but spaced out). It
       keeps spawning swarms of 4 bruisers at the regular bruiser cadence. Body
       tints red and accumulates fracture lines as it takes hits. Death drops a
       free upgrade like the anomaly. */
    GBR_SIZE:            72,      // hexagon outer radius (px)
    GBR_HP:              28,      // total HP (≈ 10 dash-atk hits at 3 dmg, 28 base)
    GBR_DASH_DMG:        3,       // damage from a dash-attack on the unshielded body
    GBR_ATK_DMG:         1,       // damage from a base attack on the unshielded body
    GBR_SHIELD_RESPAWN:  3500,    // ms before the shield comes back after a break
    GBR_SPAWN_CD:        3500,    // ms between bruiser-swarm spawns (same as T3)
    GBR_SWARM_SIZE:      4,       // bruisers per swarm
    GBR_TRIGGER_RANGE:   380,     // player distance below which the boss stops approaching
    GBR_APPROACH_SPD:    1.6,     // px/frame approach speed while wandering toward the player
    GBR_REBOUND_IMP:     22,      // knockback impulse on the player when dash-atk breaks shield
    GBR_BOUNCE_IMP:      16,      // bounce impulse when dash-atk hits the unshielded body
    /* Shockwave attack — fires when the boss eats GBR_SHOCKWAVE_THRESHOLD HP
       worth of damage since the last one. A short charge (white pulse) then a
       huge ring that pushes player + every enemy outward. */
    GBR_SHOCKWAVE_THRESHOLD:  4,     // HP lost since last shockwave that triggers a new one
    GBR_SHOCKWAVE_CHARGE_DUR: 380,   // ms of windup (charging anim) before the blast fires
    GBR_SHOCKWAVE_BLAST_DUR:  520,   // ms the ring takes to expand to GBR_SHOCKWAVE_MAX_RADIUS
    GBR_SHOCKWAVE_COOLDOWN:   4500,  // ms after a blast before another can be queued
    GBR_SHOCKWAVE_MAX_RADIUS: 880,   // outer radius of the push field (px)
    GBR_SHOCKWAVE_FORCE:      72,    // player impulse — heavy launch, real "yeet" feel
    GBR_SHOCKWAVE_ENEMY_FORCE:40,    // enemy impulse at point-blank
    GBR_SPAWN_TELEGRAPH_DUR:  320,   // ms of telegraph (target markers + beams) before a swarm pops
    GBR_ARRIVE_DUR:           2000,  // ms of the cinematic materialisation when it appears in view
    /* Blink — when the shield is BROKEN the boss has GBR_TELE_CHANCE odds of
       teleporting away: a heavy implosion (OUT) then a faster re-materialise
       (IN) — a quicker echo of the spawn cinematic — at a far, in-view spot. */
    GBR_TELE_CHANCE:          0.5,   // probability of blinking away when its shield breaks
    GBR_TELE_OUT_DUR:         300,   // ms of the implosion / dissipation at the old spot
    GBR_TELE_IN_DUR:          850,   // ms of the (faster than spawn) re-materialise at the new spot
    GBR_TELE_MIN_DIST_FRAC:   0.42,  // destination must sit ≥ this × min(view w,h) from the player

    /* ---- The Mirror (3rd mini-boss) — a rival duelist -------------------
       An independent magenta rival that orbits the player and tries to
       DASH-ATTACK them. It never fires, never base-attacks, never attacks in
       sync with you. When you attack it, it DODGES with its own dash — unless
       it just whiffed a lunge, in which case it has a long recovery (≈3× yours)
       and THAT is your window to hit it. Immune to explosions/projectiles —
       only your melee, during its recovery, breaks its 3 shield orbs. The
       World: it freezes when your shockwave reaches it, fires its OWN time-stop
       burst (shoving you), then keeps moving. Death drops a free upgrade. */
    MIR_SIZE:          28,    // body half-extent (bigger sprite/shield — was 22)
    MIR_SPAWN_DUR:     1300,  // ms of the cinematic "peel off the player" entrance
    MIR_SHIELD_ORBS:   3,     // orbs = hits to kill (like the player's shields)
    MIR_HIT_IFRAME:    240,   // ms between orb breaks (so one swing ≠ multi-break)
    MIR_ROAM_SPEED:    3.6,   // px/frame orbit/approach speed
    MIR_KEEP_DIST:     280,   // preferred orbit distance from the player
    MIR_ATTACK_CD:     2000,  // ms between dash-attack attempts
    MIR_TELEGRAPH:     480,   // ms aim/charge before the lunge
    MIR_DASH_SPEED:    30,    // px/frame during the dash-attack lunge (faster — was 13)
    MIR_DASH_DUR:      250,   // ms lunge duration (shorter so the fast lunge keeps a sane range)
    MIR_RECOVER_HIT:   420,   // ms recovery when the lunge connected
    MIR_RECOVER_MULT:  3,     // miss recovery = this × the player's dash-atk whiff (punish window)
    MIR_DODGE_SPEED:   26,    // px/frame dodge dash (snappy, animated real dodge — was 16)
    MIR_DODGE_DUR:     190,   // ms dodge duration
    MIR_DODGE_CD:      560,   // ms between dodges (it's hittable while this window ticks)
    MIR_HIT_RADIUS:    30,    // lunge hitbox vs the player
    MIR_TW_WAVE_SPEED: 1500,  // px/s — speed of OUR World shockwave reaching it (freeze delay)
    MIR_TW_PUSH:       28,    // impulse it shoves the player with during its own time-stop burst
    // Projectile nova — radial volley of shards that fly out, slow, then
    // DETONATE in small stylish blasts. Dash-attack PARRY a shard in flight →
    // it rockets along your dash heading and explodes on contact for PARADE
    // score (never homes back to the boss).
    MIR_NOVA_CD:       2600,  // base ms between volleys (randomised; ROAM only, never vulnerable)
    MIR_NOVA_COUNT:    14,    // projectiles per ring
    MIR_NOVA_SPEED:    5.5,   // px/frame initial outward speed
    MIR_NOVA_DRAG:     0.986, // per-60fps-frame velocity retention (shards slow + "hang" before popping)
    MIR_NOVA_LIFE:     1700,  // ms fuse — detonates on-screen when it runs out
    MIR_NOVA_RADIUS:   7,     // projectile hit radius vs the player (direct clip → detonate)
    MIR_NOVA_MAX:      90,    // soft cap on concurrent live projectiles
    MIR_NOVA_REFLECT_SPEED: 13,   // px/frame once parried — snappy, no drag
    MIR_NOVA_REFLECT_LIFE:  900,  // ms fuse after a parry (then it detonates)
    MIR_SHARD_EXP_RADIUS:   46,   // small detonation blast radius
    MIR_SHARD_EXP_DMG:      2,    // damage a parried shard's blast deals to enemies

    /* ---- The Serpent (4th mini-boss) — a splitting snake ----------------
       A slithering worm led by an INVULNERABLE armoured head, trailing a
       chain of body segments that each have their own HP (you can see a
       segment getting chipped — it reddens and cracks). Break a body segment
       that ISN'T the tail and the worm SPLITS in two: the part behind the cut
       grows its own new invulnerable head and slithers off on its own. Splits
       cascade, so one long serpent becomes a writhing nest of small ones.
       The SHORTER a worm is, the FRAGILER its segments (fewer hits to break)
       and the FASTER it moves — small worms are quick, snappy darts. The head
       is the only part that hurts the player (touch = damage, especially mid
       lunge); the body is safe to dive into and carve up. Segments take damage
       from EVERY source — melee, dash-attack, reflected projectiles, the nuke,
       delayed explosions — but explosions are throttled (small fixed damage +
       per-segment AoE i-frames + a per-blast cap) so the constant storm of
       explosions only chips the worm instead of deleting it. A worm dies when
       it's reduced to a lone head; the boss dies when every worm is gone, and
       (like the others) drops a free upgrade. Self-contained on this._snake,
       never in this.enemies. */
    SNAKE_SEG_SIZE:      22,    // body-segment radius (px) — chunkier base serpent
    SNAKE_HEAD_SIZE:     31,    // head radius (px) — chunkier than the body
    SNAKE_SEG_COUNT:     32,    // very long by default → many more sub-serpents on splits, harder
    SNAKE_SPACING:       34,    // distance kept between consecutive node centres (px)
    SNAKE_SEG_HP_MAX:    4,     // hits a segment can hold (longest worm)
    SNAKE_HP_PER_LEN:    3.0,   // segMaxHp = clamp(round(len/this), 1, SEG_HP_MAX)
    SNAKE_SPEED_BASE:    2.5,   // px/frame for a full-length worm (frantic)
    SNAKE_SPEED_SHORT:   2.1,   // tiny worms are very fast, darting threats
    SNAKE_SPEED_LEN_REF: 14,    // length at which a worm moves at SNAKE_SPEED_BASE
    SNAKE_TURN:          3.7,   // head steering turn rate (rad/s) — snappier/erratic
    SNAKE_SLITHER_AMP:   0.62,  // lateral wiggle amplitude (rad) — the "slither"
    SNAKE_SLITHER_FREQ:  6.0,   // wiggle frequency (scaled up for short worms) — frenetic
    SNAKE_KEEP_DIST:     110,   // head presses this close while cruising (no lunge now)
    SNAKE_SEP_RADIUS:    155,   // worm heads repel each other within this so they don't stack
    SNAKE_SEP_FORCE:     1.7,   // how hard separation bends a head off its neighbours
    SNAKE_WANDER_MAX:    0.95,  // each worm aims at its own drifting offset around you (rad)
    SNAKE_WANDER_RATE:   3.6,   // how fast that personal aim-offset random-walks
    SNAKE_SPIT_CD:       3000,  // per-worm base ms between spits (scaled longer when short)
    SNAKE_SPIT_COUNT:    6,     // bolts a FULL-length worm fires (shorter worms fire fewer)
    SNAKE_SPIT_PER_LEN:  3.6,   // bolts = clamp(round(len/this), 1, SPIT_COUNT)
    SNAKE_SPIT_SPREAD:   0.72,  // fan half-spread of a spit (rad)
    SNAKE_SPIT_SPEED:    300,   // venom projectile speed (px/s) — slow enough to parry
    SNAKE_SPIT_NODES:    5,     // body nodes drawn on each writhing mini-serpent bolt
    SNAKE_SPIT_WINDUP:   240,   // ms the tail-tip charges venom (telegraph) before the bolts launch
    SNAKE_SPIT_DUR:      460,   // ms of the full spit animation (charge windup + release recoil)
    // PARRY = SPLIT: dash-attacking a venom bolt doesn't bounce it straight back
    // (like a shooter shard) — it BURSTS into a forward fan of tamed CYAN
    // hatchling serpents that scatter into the boss + the swarm (echoes the
    // serpent's own splitting theme; its unique reflect signature).
    SNAKE_PARRY_SPLIT:   3,     // hatchlings a parried bolt bursts into
    SNAKE_PARRY_SPREAD:  0.6,   // half-width of the hatchling fan around the dash heading (rad)
    SNAKE_SPLIT_FX_LIFE:   0.36,  // seconds the cinematic split-slash FX animates
    SNAKE_HEAD_HIT_R:    29,    // head contact radius vs the player (px)
    SNAKE_MELEE_DMG:     1,     // a basic attack chips a segment by this
    SNAKE_DASH_DMG:      2,     // a dash-attack carves a segment by this
    SNAKE_PROJ_DMG:      1,     // a reflected projectile (non-smash) chips by this
    SNAKE_AOE_DMG:       1,     // explosions only ever chip a segment by this (throttled)
    SNAKE_AOE_IFRAME:    340,   // ms a segment is immune to further explosion damage
    SNAKE_AOE_MAX_SEG:   3,     // max segments a single explosion may damage
    SNAKE_ARRIVE_DUR:    1500,  // ms of the cinematic "rise from a rift" entrance — snappier per-segment pop
    // ── TAIL WHIP (COUP DE QUEUE): a defensive, no-damage knockback the longer
    //    worms lash out when the player attacks them — repels the player AND
    //    nearby enemies, buying the serpent breathing room. ──
    SNAKE_WHIP_CD:           2600,  // base ms between tail-whips (per worm, jittered)
    SNAKE_WHIP_MIN_LEN:      6,     // only worms at least this long can tail-whip
    SNAKE_WHIP_TRIGGER_DIST: 165,   // player must be ATTACKING within this of the body to provoke one
    SNAKE_WHIP_WINDUP:       150,   // ms the tail coils back (telegraph) before the lash connects
    SNAKE_WHIP_DUR:          560,   // ms of the full whip animation (windup + strike + recover)
    SNAKE_WHIP_RADIUS:       150,   // knockback reach around the body at the strike instant (px)
    SNAKE_WHIP_ARC:          2.5,   // angular span of the sweeping crescent blade (rad)
    SNAKE_WHIP_PLAYER_FORCE: 17,    // outward impulse flung at the player (NO damage)
    SNAKE_WHIP_ENEMY_FORCE:  14,    // outward impulse flung at caught enemies

    /* ---- The Digital Tree + Cyber-Fairy (random reward event) -----------
       A glowing circuit-board tree sprouts somewhere on the arena now and
       then; a green guidance chevron (same look as the Anomaly's pointer)
       leads the player to it. Touch it → a smooth, cinematic harvest that
       births a Cyber-Fairy. The fairy physically follows the ship, and is a
       one-shot EXTRA LIFE: if the player would die, it dives onto the arrow,
       triggers a screen-wide NUKE (kills every enemy) and resurrects them.
       Self-contained on this._tree + this._fairy. Only one of each at a time. */
    TREE_SPAWN_MIN_DELAY: 28000,  // ms of play before the first tree may appear
    TREE_SPAWN_CHANCE:    0.10,   // per-eligible-second spawn roll
    TREE_COOLDOWN:        30000,  // ms after a tree is consumed/lost before another
    TREE_SPAWN_DIST_MIN:  620,    // min spawn distance from the player (px)
    TREE_SPAWN_DIST_MAX:  980,    // max spawn distance from the player (px)
    TREE_SIZE:            96,      // trunk length (px) — overall tree scale
    TREE_LIFETIME:        30000,   // ms the tree waits to be harvested before it withers
    TREE_WITHER_WARN:     6000,    // ms of "withering" fade before it vanishes uncollected
    TREE_PICKUP_R:        78,      // contact radius (player centre → tree base) that harvests
    TREE_HARVEST_DUR:     900,     // ms of the cinematic harvest → fairy birth
    TREE_PTR_DIST:        90,      // px the guidance chevron stands from the player

    FAIRY_ORBIT_R:        120,    // px the fairy hovers around the ship (stays well clear)
    FAIRY_ORBIT_SPEED:    0.85,   // rad/s slow drift of the hover anchor
    // Follow is a critically-damped smooth-damp toward the hover anchor: it
    // trails when you sprint off and glides back in with smooth acceleration AND
    // deceleration — a fluid catch-up, never a dart and never an abrupt stop.
    FAIRY_FOLLOW_TIME:    0.42,   // s smooth-damp time (bigger ⇒ trails more, still buttery)
    FAIRY_MIN_DIST:       92,     // px soft floor: the hover target never sits on the ship
    FAIRY_BOB_AMP:        12,     // px vertical bob amplitude
    FAIRY_SAVE_IFRAMES:   2600,   // ms of invincibility granted by the resurrection
    /* Resurrection REPEL sweep: instead of nuking the board, the revive hurls
       every enemy + projectile far away. Bosses (not in `enemies`) are spared
       and nothing is killed. */
    FAIRY_PUSH_FORCE:     64,     // enemy launch velocity (px/frame) — no falloff, sends them off-screen
    FAIRY_PUSH_STUN:      800,    // ms enemies drift outward (stunned) before they resume chasing
    FAIRY_PROJ_PUSH_SPEED: 560,   // px/s outward speed forced onto every projectile (vs PROJ_SPEED 380)
    /* Resurrection cinematic (real-time ms): the ship "dies" with the usual
       burst, a beat passes, then the fairy drifts slowly to the death spot and
       rebuilds the arrow; the board clears as the arrow returns. */
    FAIRY_REV_REACT:      480,    // ms the fairy hovers/recoils after the death burst
    FAIRY_REV_TRAVEL:     1450,   // ms of the slow cinematic glide to the death spot
    FAIRY_REV_REBUILD:    1150,   // ms of the arrow-rebuild animation before the board clears

    /* ---- The Curse Fountain (random "malédiction" event) ----------------
       A dark geometric obelisk wreathed in evil mist, standing in a fountain
       basin. The ring of black mist around it SWALLOWS any enemy/projectile
       that enters — a smooth dissolve, and NO score/combo. Step deep enough
       in and the world slows for an accept/refuse CURSE offer: this is now the
       ONLY source of curses (they no longer drop from the upgrade draft).
       When a boss appears the fountain vanishes (an on-screen one dissolves on
       camera, an off-screen one just goes), then re-spawns far from the player
       — UNGUIDED this time — when that boss dies. A natural spawn is guided by
       a magenta chevron (same look as the Anomaly/Tree pointer). Self-contained
       on this._fount (mirrors digital-tree.js). One at a time. */
    CURSE_FOUNT_SPAWN_CHANCE:    0.085,  // per-eligible-second spawn roll (once the boss-kill gate is met)
    CURSE_FOUNT_BOSS_REQ_START:  1,      // bosses to defeat before the FIRST fountain may appear
    CURSE_FOUNT_BOSS_REQ_STEP:   1,      // +bosses required after each consumed fountain (1 → 2 → 3 …)
    CURSE_FOUNT_SPAWN_DIST_MIN:  640,    // min spawn distance from the player (px)
    CURSE_FOUNT_SPAWN_DIST_MAX:  1020,   // max spawn distance from the player (px)
    CURSE_FOUNT_ZONE_R:          260,    // mist-zone radius (≈ a no-upgrade dash-mark detonation)
    CURSE_FOUNT_TRIGGER_R:       100,    // step within this of the obelisk → the curse offer
    CURSE_FOUNT_SIZE:            64,     // obelisk scale (px)
    CURSE_FOUNT_LINGER_DUR:      1800,   // ms the mist pocket lingers + keeps absorbing after a choice
    CURSE_FOUNT_LINGER_EXPAND:   1.35,   // peak × the mist ring swells to before it fades to nothing
    CURSE_FOUNT_FADE_DUR:        620,    // ms of the boss-arrival dissolve (when on-screen)
    CURSE_FOUNT_PTR_DIST:        90,     // px the guidance chevron stands from the player
    // Min centre-to-centre distance the Digital Tree and the Curse Fountain keep
    // from each other so the two map events never crowd (whichever spawns 2nd re-rolls).
    MAP_FEATURE_MIN_SEP:         620,

    /* ---- Data Highways (Autoroutes de Données) — mobility terrain event -----
       Long, thin, luminous "wind/code" corridors that streak across the arena.
       Stepping in — or, better, DASHING through — carries the player along the
       flow like a conveyor belt at up to ~3× normal top speed. The flow is
       FIXED (random direction): sometimes it helps you flee, sometimes it hurls
       you into a wall — the environment becomes an unpredictable actor. Pure
       mobility: NO score, NO damage, NO guidance arrow (found at random). A
       capsule placement keeps every highway FULLY inside the map (never clipped
       by the world edge). Self-contained on this._highways (a small pool). */
    HIGHWAY_SPAWN_MIN_DELAY:     11000,  // ms of play before the first highway may appear
    HIGHWAY_SPAWN_INTERVAL_MIN:  20000,  // ms between highways (min) — ≈ the 20–30 s the brief asked
    HIGHWAY_SPAWN_INTERVAL_MAX:  30000,  // ms between highways (max)
    HIGHWAY_LIFETIME:            15000,  // ms a highway lives before it evaporates
    HIGHWAY_FADE_IN:             1000,   // ms of the "draw-in" sweep entrance (strength ramps 0→1)
    HIGHWAY_FADE_OUT:            1300,   // ms of the evaporation (strength ramps 1→0, retracts away)
    HIGHWAY_MAX:                 2,      // concurrent-highway pool cap (≈1 at a time with the gaps above)
    HIGHWAY_LEN_MIN:             1800,   // min corridor length (px) — "très longs"
    HIGHWAY_LEN_MAX:             3100,   // max corridor length (px)
    HIGHWAY_HALF_WIDTH:          58,     // core half-width — the full-boost band (px) — "fins"
    HIGHWAY_EDGE_FEATHER:        46,     // px past the core where the boost eases smoothly to 0
    HIGHWAY_END_FEATHER:         150,    // px at each end where the boost eases in/out (smooth launch-off)
    HIGHWAY_MARGIN:              130,    // px the whole capsule keeps clear of the world edge (glow room)
    HIGHWAY_MARGIN_ZONE:         70,     // px the capsule keeps clear of the Anomaly firewall when spawned CONFINED inside the quarantine
    HIGHWAY_ZONE_LEN_FRAC:       0.45,   // confined corridor half-length cap, as a fraction of the quarantine radius (leaves room to place it off-centre near the player)
    HIGHWAY_FLOW_SPEED:          14,     // px/frame conveyor carry at full strength (≈ +2× top speed → ~3× total)
    HIGHWAY_FLOW_CAP_MULT:       1.35,   // hard cap on summed conveyor magnitude (overlap guard) × FLOW_SPEED
    HIGHWAY_ENEMY_FLOW_MULT:     0.9,    // enemies caught in the flow are swept too, at this × the player's carry
    HIGHWAY_INVULN_GRACE:        280,    // ms of invincibility granted while riding (lingers this long after exit)
    HIGHWAY_EXHAUST_ZONE:        270,    // px before+past the downstream mouth where enemies get launched out (anti-stack)
    HIGHWAY_EJECT_SPEED:         12,     // px/frame forward launch velocity enemies reach at the exhaust mouth
    HIGHWAY_EJECT_SPREAD:        3.6,    // px/frame lateral fan added at the mouth so they scatter, not single-file
    HIGHWAY_SPAWN_NEAR_MIN:      160,    // the corridor passes at least this close to the player...
    HIGHWAY_SPAWN_NEAR_MAX:      840,    // ...and at most this far, so it's discoverable without a pointer
    // Keep a new highway from forming ON a live map feature (Cache, Greed, Curse
    // Fountain, Unstable Core, Prism) or right on the player — and, reciprocally,
    // keep those features from spawning on a live highway. The capsule (centreline +
    // HALF_WIDTH+FEATHER band) is kept FEATURE_PAD px clear of each feature's
    // interactive edge; the player gets a slightly bigger personal bubble so the road
    // never draws itself across the ship. Placement re-rolls up to PLACE_TRIES times
    // for a fully-clear corridor; if none is found it keeps the least-overlapping
    // roll, so a road always still appears, near + in view (see _spawnHighway).
    HIGHWAY_PLACE_TRIES:         28,     // placement re-rolls for a corridor clear of every feature + the player
    HIGHWAY_FEATURE_PAD:         70,     // px gap kept between the highway band and a feature's interactive edge
    HIGHWAY_PLAYER_PAD:          80,     // px personal bubble (beyond SIZE) the band keeps off the ship ("un peu loin")

    /* ---- Cache Zone (Zone de Cache) — risk/reward King-of-the-Hill event ------
       A big glitchy violet circle with a download glyph at its heart. Step in and
       a 15 s data-heist gauge starts filling — but every regular enemy inside goes
       into a RAGE (rushers faster, shooters fire faster, generators spawn more).
       Hold the hill to 100 % and the zone detonates a huge 20 s OVERDRIVE bonus in
       its centre. Self-contained on this._cache (one at a time). It does NOT boost
       bosses (they live outside this.enemies) and is mutually exclusive with the
       Curse Fountain (never overlapping — see _spawnCacheZone / _spawnCurseFount). */
    CACHE_ZONE_R:                440,    // zone radius (px) — a big arena ("un grand cercle")
    CACHE_HACK_DUR:              15000,  // ms inside the zone to fill the gauge to 100 %
    CACHE_DECAY_MULT:            0.5,    // while OUTSIDE during a hack the gauge decays at this × the fill rate
    CACHE_ABANDON_GRACE:         4000,   // ms at 0 % + player away before a started hack powers back down to idle
    CACHE_IDLE_LIFE:             30000,  // ms an un-entered zone sits before it quietly dissolves
    CACHE_OVERDRIVE_DUR:         20000,  // ms of Overdrive the reward orb grants (the big payoff)
    CACHE_RAGE_T1_SPEED:         1.7,    // rushers (T1) move this × faster while enraged in the zone
    CACHE_RAGE_T2_FIRE:          1.9,    // shooters (T2) tick their fire cooldown this × faster while enraged
    CACHE_RAGE_T3_SPAWN:         2.0,    // generators (T3) tick their spawn cooldown this × faster while enraged
    CACHE_RAGE_T4_FIRE:          1.9,    // snipers (T4) tick their cloak + charge timers this × faster while enraged (re-arm & windup quicker)
    CACHE_RAGE_LINGER:           250,    // ms the rage (+ its visual) lingers after an enemy leaves the zone
    CACHE_DISSOLVE_DUR:          1000,   // ms of the success/timeout dissolve-out
    CACHE_FADE_DUR:              600,    // ms of the boss-arrival (Anomaly) dissolve
    CACHE_BOSS_REQ:              2,      // bosses that must fall (both modes) before the FIRST cache zone may appear
    CACHE_SPAWN_MIN_DELAY:       10000,  // ms after the boss gate is met before the first cache zone may appear
    CACHE_SPAWN_INTERVAL_MIN:    45000,  // ms between zones (min) — a rarer, bigger event than a highway
    CACHE_SPAWN_INTERVAL_MAX:    75000,  // ms between zones (max)
    CACHE_SPAWN_DIST_MIN:        560,    // min spawn distance from the player (px) — > zone radius so you start OUTSIDE the rim
    CACHE_SPAWN_DIST_MAX:        1040,   // max spawn distance from the player (px)
    CACHE_TINT:                  0x9b30ff,      // glitch-violet (dash-attack family)
    CACHE_TINT_ARR:              [155, 48, 255], // ...as an [r,g,b] for particle bursts
    CACHE_COMPLETE_SCORE:        2000,          // bonus points a finished hack banks (× combo), shown as a big-score "POWER UP READY" popup

    /* ---- The Signal Amplifier (Amplificateur de Signal) — the GREED trial ------
       A large square "tech platform" etched on the ground, in the Digital-Tree /
       Cyber-Fairy MINT palette (so it reads as a distinct, kindred map event next
       to the violet glitch Cache circle). Stand on it and your score gain is ×2 —
       but the plate is a BEACON: the longer you hold it, the more it floods enemies
       in a tight band AROUND its edges (never inside). Pure King-of-the-Hill greed:
       how long can you milk the ×2 before the swarm forces you off? Gated behind a
       fully-maxed loadout (every Lv3 upgrade, The World aside) so it only shows up
       once a run is "complete" and the only thing left to chase is high score.
       During The World it greys out and goes fully dormant (no ×2, no beacon).
       Self-contained on this._greed + two shared ADD graphics layers (ground + top).
       MAY coexist with the Cache Zone (kept spatially apart, never overlapping). */
    GREED_HALF:                  460,    // square half-side (px) — slightly bigger than the Cache circle (R 440)
    GREED_CORNER:                30,     // rounded-corner radius of the platform plate
    GREED_SCORE_MULT:            2,      // per-kill score ×this while standing on the platform
    GREED_IDLE_LIFE:             30000,  // ms an un-entered platform sits before it quietly dissolves
    GREED_ABANDON_GRACE:         6000,   // ms away (after first entering) before it powers back down to IDLE
    GREED_MAX_LIFE:              180000, // ms hard cap on total age — even held, it eventually leaves
    GREED_DISSOLVE_DUR:          1000,   // ms of the dissolve-out
    GREED_SPAWN_MIN_DELAY:       10000,  // ms after the gate is met before the first platform may appear
    GREED_SPAWN_INTERVAL_MIN:    55000,  // ms between platforms (min) — a rare, climactic event
    GREED_SPAWN_INTERVAL_MAX:    95000,  // ms between platforms (max)
    GREED_SPAWN_DIST_MIN:        640,    // min spawn distance from the player (px) — start OUTSIDE the plate
    GREED_SPAWN_DIST_MAX:        1100,   // max spawn distance from the player (px)
    GREED_BEACON_INTERVAL_MAX:   850,    // ms between beacon spawns at heldT=0 (a trickle)
    GREED_BEACON_INTERVAL_MIN:   140,    // ms between beacon spawns at full ramp (a torrent)
    GREED_BEACON_RAMP:           45000,  // ms of cumulative hold to reach max beacon intensity
    GREED_BEACON_BAND:           80,     // px band just OUTSIDE the plate where beacon enemies appear
    GREED_BEACON_BURST_MAX:      3,      // up to N enemies per beacon tick at full ramp
    GREED_HELD_DECAY:            2.2,    // heldT bleeds off at this × real-time while you're off the plate
    GREED_TINT:                  0x33ff99,      // tree-mint green (Digital-Tree / Cyber-Fairy family)
    GREED_TINT_ARR:              [51, 255, 153], // ...as an [r,g,b] for particle bursts
    GREED_FRUIT:                 0x66ffd0,      // brighter mint accent (matches the tree's fruit)
    GREED_HOT:                   0xeafff4,      // near-white mint highlight (matches the fairy core)
    GREED_TETHER_DUR:            0.7,    // s a mint "beacon tether" laser links a freshly-spawned enemy to the central node, then fades (kept brief so the lines never clutter the screen)

    /* ---- The Unstable Core (Noyau Instable) — environmental billiard weapon ---
       A big pulsing geometric sphere wrapped in a cyan containment force-field,
       sitting NEUTRAL in the arena. DASH-ATTACK it and the field bursts: the core
       rockets off like a billiard ball, ricocheting off the arena walls AND off
       the chunky tier-3 bruisers, CRUSHING every lesser enemy it ploughs through.
       After CORE_MAX_BOUNCES ricochets it detonates in a big blast. Every kill it
       racks up is banked into its OWN big-score popup ("NOYAU INSTABLE"). NO
       guidance arrow (found at random) and it utterly IGNORES bosses — they live
       outside this.enemies, so the crush/bounce loops never touch them.
       Self-contained on this._core (plain data) + one shared ADD graphics layer. */
    CORE_SPAWN_MIN_DELAY:    0,      // now an UPGRADE: once unlocked the map keeps CORE_MAX of them present...
    CORE_SPAWN_INTERVAL_MIN: 0,      // ...and using one frees its slot for CORE_RESPAWN_MS, then it returns elsewhere
    CORE_SPAWN_INTERVAL_MAX: 0,
    CORE_MAX:                3,      // up to THREE cores on the map at once (once the upgrade is unlocked)
    CORE_RESPAWN_MS:         15000,  // ms an individual slot waits, on its OWN chrono, before a fresh core returns
    CORE_SELF_GAP:           150,    // px gap KEPT between two cores' containment fields at spawn — never glued, but two can share the view
    CORE_KNOCK_SPEED:        13,     // px/frame a LAUNCHED core propels a still-dormant core it ploughs into (opposite the impact)
    CORE_DRIFT_FRICTION:     0.94,   // per-frame velocity decay of a propelled dormant core as it coasts to rest
    CORE_LIFETIME:           24000,  // (unused now — the core is a persistent fixture and no longer withers)
    CORE_WITHER_WARN:        5000,   // ms of unstable "about to blow" strobe before an unused core vanishes
    CORE_SPAWN_DIST_MIN:     480,    // min spawn distance from the player (px)
    CORE_SPAWN_DIST_MAX:     900,    // max spawn distance from the player (px)
    CORE_RADIUS:             44,     // the geometric sphere's body radius (px)
    CORE_FIELD_RADIUS:       78,     // the containment force-field bubble radius (px)
    CORE_TRIGGER_PAD:        14,     // extra slack on (field + player half) for the dash-attack launch test
    CORE_LAUNCH_SPEED:       19,     // px/frame billiard speed once launched (≈1140 px/s)
    CORE_TW_SCALE:           0.3,    // during The World the core still drifts at this × its speed — a clear SLOW-MO (not the near-frozen 2% world crawl, not full speed)
    CORE_TURN:               7.0,    // rad/s steering toward the next bruiser (a smart, ballistic ricochet)
    CORE_MAX_BOUNCES:        6,      // bruiser ricochets before it detonates ("rebondisse 6 fois max")
    CORE_SAFETY_LIFETIME:    9000,   // ms hard cap on a launched core (failsafe → detonate)
    CORE_FIZZLE_DUR:         320,    // ms it coasts on ("avance un peu") with NO bruiser left to chain → then explodes
    CORE_VIEW_INSET:         120,    // px the camera view is shrunk INWARD when acquiring the next bounce target — the core
                                     //   prefers enemies WELL within the field of vision so it (and its ricochets) stay on-screen
    CORE_DETECT_MARGIN:      520,    // px of slack around the camera view — LAST-RESORT acquire range + how far it keeps chasing a
                                     //   target that drifted off-screen, before it self-destructs only when no enemy is left near
    CORE_CRUSH_PAD:          8,      // extra slack on the crush hit-test (core radius + enemy half + this)
    CORE_BRUISER_DMG:        3,      // damage a ricochet deals to an unshielded tier-3 bruiser body
    CORE_EXP_RADIUS:         300,    // final detonation blast radius (px) — base; per-level via CORE_EXP_BY_LVL
    /* Per-upgrade-level scaling (index by level 1-3; [0] = safe fallback = Lv1).
       Lv1 is deliberately WEAKER than the old fixed core (fewer bounces, slower,
       a touch smaller), Lv2 STRONGER (+2 bounces, faster); Lv3 keeps Lv2's flight
       but DOUBLES the body + the final blast. Old fixed values were 44 / 78 / 6 /
       19 / 300 — bracketed by Lv1 (below) and Lv2 (above). */
    CORE_BODY_BY_LVL:    [38, 38, 38, 76],     // sphere body radius (px) — Lv3 = ×2 base
    CORE_FIELD_BY_LVL:   [67, 67, 67, 135],    // containment-field radius (px) — kept ∝ body (old 78/44 ratio)
    CORE_BOUNCES_BY_LVL: [5, 5, 9, 9],         // ricochets before detonation — Lv1 < old 6, Lv2 = +2 > old
    CORE_SPEED_BY_LVL:   [17, 17, 25, 25],     // px/frame billiard speed — Lv1 < old 19, Lv2 > old
    CORE_EXP_BY_LVL:     [300, 300, 300, 600], // final blast radius (px) — Lv3 = ×2 base

    /* ---- The Prism of Refraction (Prisme de Réfraction) — offensive "billiard" -
       A crystalline prism sitting NEUTRAL in the arena: present from the START,
       placed FULLY at random anywhere on the map, with NO guidance arrow. DASH-
       ATTACK through it and the ship is CAUGHT inside — a magic cannon charges and a
       long spectral aiming line tracks the mouse ("on a chargé un prisme canon"). A
       LEFT-CLICK hurls the ship back out as THREE chromatic ghost-arrows in a fan
       (éventail): a super dash-attack that flies faster + farther, ONE-SHOTS every
       enemy it sweeps and hits a boss for 3 dash-attacks, before the clones MERGE
       back and the whole rampage lands as one "PRISME" big-score popup. It works
       during The World (the giga-dash runs in slow-mo and every swept enemy dies at
       once, exactly like the Unstable Core). After use the prism vanishes and
       reappears elsewhere at random. Self-contained on this._prism + one shared ADD
       graphics layer. Bosses live outside this.enemies; the strike damages them via
       their own damage entry points (3× a dash-attack). */
    PRISM_FIRST_DELAY:       0,      // now an UPGRADE: once unlocked the map keeps PRISM_MAX of them present...
    PRISM_RESPAWN_MIN:       0,      // ...and using one frees its slot for PRISM_RESPAWN_MS, then it returns elsewhere
    PRISM_RESPAWN_MAX:       0,      // (Lv3 still drops a BONUS prism AT the giga-dash landing point for the chain)
    PRISM_MAX:               3,      // up to THREE prisms on the map at once (once the upgrade is unlocked)
    PRISM_RESPAWN_MS:        15000,  // ms an individual slot waits, on its OWN chrono, before a fresh prism returns
    PRISM_SELF_GAP:          150,    // px gap KEPT between two prisms' trigger zones at spawn — never glued, but two can share the view
    PRISM_RADIUS:            42,      // crystal body radius (px)
    PRISM_TRIGGER_R:         72,      // contact capture radius around the crystal (px)
    PRISM_TRIGGER_PAD:       16,      // extra slack on (trigger + player half) for the capture test
    PRISM_SPAWN_MARGIN:      80,      // px the crystal keeps clear of the world edge (whole body + ground decal in-bounds)
    PRISM_MIN_PLAYER_DIST:   260,     // never spawn right on top of the player (px) — otherwise truly uniform-random
    PRISM_CHARGE_RAMP:       340,     // ms the cannon takes to read as "fully charged" (visual ramp only)
    PRISM_CHARGE_MAXHOLD:    5000,    // ms safety auto-launch (no indefinite invulnerable hold inside the prism)
    PRISM_STRIKE_SPEED:      28,      // px/frame strike speed (≈1680 px/s — clearly "plus vite" than a dash)
    PRISM_STRIKE_DIST:       1080,    // px the strike travels ("plus loin"), capped so the endpoint stays in the disc
    PRISM_STRIKE_DIST_MIN:   360,     // px floor so a wall-facing strike still goes somewhere
    PRISM_FAN_LATERAL:       96,      // px peak half-spread of the éventail — base; per-level via PRISM_FAN_BY_LVL
    PRISM_KILL_R:            74,      // px one-shot radius around EACH of the 3 arrows — base; per-level via PRISM_KILL_BY_LVL
    /* Per-upgrade-level scaling (index by level 1-3; [0] = safe fallback = Lv1).
       Lv1 is deliberately SHORTER/SMALLER than the old fixed strike, Lv2 LONGER/
       BIGGER; Lv3 keeps Lv2 and adds the chain-respawn at the landing point. Old
       fixed values were 1080 / 96 / 74 — bracketed by Lv1 (below) and Lv2 (above). */
    PRISM_DIST_BY_LVL:    [920, 920, 1280, 1280],  // strike travel (px) — Lv1 < old 1080, Lv2 > old
    PRISM_FAN_BY_LVL:     [84, 84, 116, 116],      // fan half-spread (px) — Lv1 < old 96, Lv2 > old
    PRISM_KILL_BY_LVL:    [64, 64, 89, 89],        // per-arrow one-shot radius (px) — Lv1 < old 74, Lv2 > old
    PRISM_BOSS_REACH:        120,     // px slack (added to boss size) for the "an arrow passed through a boss" test
    PRISM_TW_SCALE:          0.32,    // during The World the strike advances at this × speed (clear slow-mo, like the core)

    /* ---- The World slow-mo for energy/terrain systems --------------------------
       During The World the WHOLE world crawls at ~2% (it never fully freezes).
       A few "energy" systems instead keep a graceful SLOW-MO (clearly slowed, but
       far more alive than the 2% crawl, and always below normal speed). */
    DASH_TORNADO_TW_SCALE:   0.4,    // tornado spin/lifecycle advance × during The World (slow-mo, not the 2% crawl)
    DASH_TORNADO_TW_PULL:    230,    // px/s inward DRIFT a tornado pulls caught enemies during TW (positional — velocity can't integrate while frozen)
    HIGHWAY_TW_VISUAL_SCALE: 0.4,    // highway flow/chevron animation advance × during The World
    HIGHWAY_TW_FLOW_SCALE:   0.4,    // highway enemy-sweep strength × NORMAL during TW (≫ the 2% crawl, still < full)
  };

  /* ---- Upgrade branch definitions (all 3 levels) ---- */
  LA.UPGRADES = {
    dashAtk: {
      id: 'dashAtk',
      maxLvl: 3,
      i18nName:  'laUpDashAtkName',
      i18nDesc1: 'laUpDashAtkDesc1',
      i18nDesc2: 'laUpDashAtkDesc2',
      i18nDesc3: 'laUpDashAtkDesc3',
    },
    detonation: {
      id: 'detonation',
      maxLvl: 3,
      i18nName:  'laUpDetonationName',
      i18nDesc1: 'laUpDetonationDesc1',
      i18nDesc2: 'laUpDetonationDesc2',
      i18nDesc3: 'laUpDetonationDesc3',
    },
    dash: {
      id: 'dash',
      maxLvl: 3,
      i18nName:  'laUpDashName',
      i18nDesc1: 'laUpDashDesc1',
      i18nDesc2: 'laUpDashDesc2',
      i18nDesc3: 'laUpDashDesc3',
    },
    baseAtk: {
      id: 'baseAtk',
      maxLvl: 3,
      i18nName:  'laUpBaseAtkName',
      i18nDesc1: 'laUpBaseAtkDesc1',
      i18nDesc2: 'laUpBaseAtkDesc2',
      i18nDesc3: 'laUpBaseAtkDesc3',
    },
    shield: {
      id: 'shield',
      maxLvl: 3,
      i18nName:  'laUpShieldName',
      i18nDesc1: 'laUpShieldDesc1',
      i18nDesc2: 'laUpShieldDesc2',
      i18nDesc3: 'laUpShieldDesc3',
    },
    drone: {
      id: 'drone',
      maxLvl: 3,
      i18nName:  'laUpDroneName',
      i18nDesc1: 'laUpDroneDesc1',
      i18nDesc2: 'laUpDroneDesc2',
      i18nDesc3: 'laUpDroneDesc3',
    },
    core: {
      id: 'core',
      maxLvl: 3,
      i18nName:  'laUpCoreName',
      i18nDesc1: 'laUpCoreDesc1',
      i18nDesc2: 'laUpCoreDesc2',
      i18nDesc3: 'laUpCoreDesc3',
    },
    prism: {
      id: 'prism',
      maxLvl: 3,
      i18nName:  'laUpPrismName',
      i18nDesc1: 'laUpPrismDesc1',
      i18nDesc2: 'laUpPrismDesc2',
      i18nDesc3: 'laUpPrismDesc3',
    },
  };

  /* ---- Curse cards (risk / reward draft spice) — each costs −1 shield slot ---- */
  LA.CURSES = {
    glassHeart:  { id: 'glassHeart',  i18nName: 'laCurseGlassName', i18nDesc: 'laCurseGlassDesc' },
    dashRage:    { id: 'dashRage',    i18nName: 'laCurseDashName',  i18nDesc: 'laCurseDashDesc' },
    cursedBlast: { id: 'cursedBlast', i18nName: 'laCurseBlastName', i18nDesc: 'laCurseBlastDesc' },
  };

  /* ---- Secret upgrade (The World) ---- */
  LA.SECRET_UPGRADE = {
    id: 'theWorld', maxLvl: 1,
    i18nName: 'laUpTheWorldName', i18nDesc1: 'laUpTheWorldDesc1',
  };

  /* ---- Shared upgrade-icon PLACEHOLDER (TEMPORARY) ----
     Real per-upgrade art is coming. Until then, EVERY upgrade icon surface
     renders this ONE placeholder so there's a single thing to swap:
       • Draft cards    → upgrade-ui.js   (LA.iconPlaceholderSvg)
       • Mode-select    → shell.js        (LA.iconPlaceholderSvg)
       • In-game HUD    → rendering.js    (M._drawIconPlaceholder — canvas twin
                                           of this same image-frame silhouette)
     `inner` is the SVG body (a generic "image" frame); iconPlaceholderSvg wraps
     it for the DOM. Curses (⚠) and The World (🕒) keep their own semantic glyphs. */
  LA.ICON_PLACEHOLDER_SVG = '<rect x="3" y="3" width="18" height="18" rx="2.5"/>' +
    '<circle cx="8.5" cy="8.5" r="1.6"/><polyline points="21 15 15.5 9.5 5 20"/>';
  LA.iconPlaceholderSvg = function (cls) {
    return '<svg class="la-icon-ph ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + LA.ICON_PLACEHOLDER_SVG + '</svg>';
  };

  /* ---- Per-upgrade icon art (one source of truth) -------------------------
     Stylish line-art glyphs, authored on a 0..24 grid in the game's neon DA,
     that READ as the upgrade they stand for. The SAME definitions feed all
     three icon surfaces, so an icon is drawn once and stays in sync:
       • Draft cards (le tirage)  → LA.iconSvg(id, cls)        — upgrade-ui.js
       • Mode-select loadout      → LA.iconSvg(id, cls)        — shell.js
       • In-game HUD chips        → M._drawUpgradeIcon (canvas) — rendering.js
     Each icon is a list of primitive ops; both the SVG and the canvas renderer
     understand exactly these five, so they produce identical shapes:
       ['rrect', x, y, w, h, r]        rounded rect          (stroked outline)
       ['circle', cx, cy, r]          circle                (stroked outline)
       ['dot', cx, cy, r]             filled disc           (accent / spark)
       ['line', x1, y1, x2, y2]       segment               (stroked)
       ['poly', [x1,y1, x2,y2, …], closed]  polyline/polygon (stroked)
     Colour comes from `currentColor` (DOM) / the passed colour (canvas), so the
     per-level frame colour (cyan I · gold II · violet III) tints the glyph too. */
  LA.ICONS = {
    // TORPILLE — a dart/torpedo streaking up-right with speed trails (dash-attack).
    dashAtk: [
      ['poly', [3.5,11, 21,3.5, 13,20, 11,13], true],
      ['line', 2.5,16, 6,14],
      ['line', 4.5,20, 8,18],
    ],
    // DÉTONATION — a marked target reticle bursting at its centre.
    detonation: [
      ['circle', 12,12, 6],
      ['line', 12,2.5, 12,5], ['line', 12,19, 12,21.5],
      ['line', 2.5,12, 5,12], ['line', 19,12, 21.5,12],
      ['dot', 12,12, 1.7],
      ['line', 9.6,9.6, 10.9,10.9], ['line', 14.4,9.6, 13.1,10.9],
      ['line', 9.6,14.4, 10.9,13.1], ['line', 14.4,14.4, 13.1,13.1],
    ],
    // DASH — three growing chevrons (»») reading as a forward burst of speed.
    dash: [
      ['poly', [3,8.5, 6.5,12, 3,15.5], false],
      ['poly', [8,6.5, 13,12, 8,17.5], false],
      ['poly', [13.5,5, 19,12, 13.5,19], false],
    ],
    // EXPLOSION — a round bomb with a sparking fuse (delayed blast).
    baseAtk: [
      ['circle', 10.5,15, 5.5],
      ['poly', [14,11, 15.5,8, 18,7], false],
      ['line', 18.5,5, 18.5,8], ['line', 17,6.5, 20,6.5],
      ['line', 17.3,5.3, 19.7,7.7], ['line', 17.3,7.7, 19.7,5.3],
    ],
    // ORBE DE BOUCLIER — a glowing energy orb: outer halo ring + solid core, a
    // true match for the in-game shield sprite / HUD orbs (ring:core ≈ 1:1.8,
    // mirroring _shOrbRing 18 / _shOrbR 10 in rendering.js).
    shield: [
      ['circle', 12,12, 9],
      ['dot', 12,12, 5],
    ],
    // DRONES — a quadcopter: hub, four arms, four rotors (orbiting kamikazes).
    drone: [
      ['rrect', 9.8,9.8, 4.4,4.4, 1.3],
      ['line', 10.4,10.4, 6.6,6.6], ['line', 13.6,10.4, 17.4,6.6],
      ['line', 10.4,13.6, 6.6,17.4], ['line', 13.6,13.6, 17.4,17.4],
      ['circle', 5,5, 2.6], ['circle', 19,5, 2.6],
      ['circle', 5,19, 2.6], ['circle', 19,19, 2.6],
    ],
    // NOYAU INSTABLE — the in-game core's nested lattice, simplified: a round
    // containment sphere → a hexagon → a six-pointed star (the two counter-rotating
    // triangles) → a hot heart at the centre. The circle + hexagram together read as
    // the core and NOT the T3 Bruiser (a solid nested-hex with no star/orbit ring).
    core: [
      ['circle', 12,12, 9.2],                                                         // outer containment sphere
      ['poly', [12,4.7, 18.32,8.35, 18.32,15.65, 12,19.3, 5.68,15.65, 5.68,8.35], true],  // containment hexagon
      ['poly', [12,6.4, 13.62,9.2, 16.85,9.2, 15.23,12, 16.85,14.8, 13.62,14.8,
                12,17.6, 10.38,14.8, 7.15,14.8, 8.77,12, 7.15,9.2, 10.38,9.2], true],     // 6-pointed star lattice
      ['dot', 12,12, 2.3],                                                            // hot pulsing heart
    ],
    // PRISME DE RÉFRACTION — a crystal triangle splitting an incoming ray into a
    // dispersion fan (the "giga-dash" cannon you launch from).
    prism: [
      ['poly', [12,3.5, 19,16.5, 5,16.5], true],
      ['line', 2.5,10, 9,12],
      ['line', 15,12, 21.5,8.5],
      ['line', 15,13, 21.5,13],
      ['line', 15,14, 21.5,17.5],
    ],
    // SCORE MAUDIT — a "stonks" rising zig-zag arrow (curse trades a shield slot
    // for a big score multiplier, so the icon screams "number go up").
    glassHeart: [
      ['poly', [3,18, 8,12.5, 11,15, 15,8, 20,4.5], false],
      ['line', 20,4.5, 14.8,4.5],
      ['line', 20,4.5, 20,9.7],
    ],
    // RAGE DU DASH — a lightning bolt (furious speed).
    dashRage: [
      ['poly', [13,3, 5,13.5, 11.5,13.5, 10.5,21, 19,10.5, 12.5,10.5], true],
    ],
    // SOUFFLE MAUDIT — a skull (cursed).
    cursedBlast: [
      ['circle', 12,10, 5],
      ['dot', 10,10.2, 1.2], ['dot', 14,10.2, 1.2],
      ['poly', [9,14.5, 9,16.6, 15,16.6, 15,14.5], false],
      ['line', 11,15, 11,16.6], ['line', 13,15, 13,16.6],
    ],
    // THE WORLD — a clock (time stop).
    theWorld: [
      ['circle', 12,12, 8],
      ['line', 12,12, 12,7.2], ['line', 12,12, 15.6,13.6],
      ['dot', 12,12, 1],
    ],
    // Generic curse fallback (warning) + generic placeholder (image frame).
    curse: [
      ['poly', [12,4, 21,19, 3,19], true],
      ['line', 12,9.5, 12,14], ['dot', 12,16.6, 0.85],
    ],
    default: [
      ['rrect', 3,3, 18,18, 2.5],
      ['dot', 8.5,8.5, 1.6],
      ['poly', [21,15, 15.5,9.5, 5,20], false],
    ],
  };

  /* Build the inner SVG markup for an icon's ops (shared by every DOM surface). */
  LA._iconOpsToSvg = function (ops) {
    var out = '';
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i], k = op[0];
      if (k === 'rrect') {
        out += '<rect x="' + op[1] + '" y="' + op[2] + '" width="' + op[3] +
               '" height="' + op[4] + '" rx="' + op[5] + '"/>';
      } else if (k === 'circle') {
        out += '<circle cx="' + op[1] + '" cy="' + op[2] + '" r="' + op[3] + '"/>';
      } else if (k === 'dot') {
        out += '<circle cx="' + op[1] + '" cy="' + op[2] + '" r="' + op[3] +
               '" fill="currentColor" stroke="none"/>';
      } else if (k === 'line') {
        out += '<line x1="' + op[1] + '" y1="' + op[2] + '" x2="' + op[3] + '" y2="' + op[4] + '"/>';
      } else if (k === 'poly') {
        var pts = op[1], s = '';
        for (var j = 0; j < pts.length; j += 2) s += (j ? ' ' : '') + pts[j] + ',' + pts[j + 1];
        out += op[2] ? '<polygon points="' + s + '"/>' : '<polyline points="' + s + '"/>';
      }
    }
    return out;
  };

  /* One upgrade/curse/secret icon as an inline SVG. `key` is an upgrade id, a
     curse id, 'theWorld', 'curse' (generic) or anything → 'default'. */
  LA.iconSvg = function (key, cls) {
    var ops = LA.ICONS[key] || LA.ICONS.default;
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + LA._iconOpsToSvg(ops) + '</svg>';
  };

  /* Pre-computed squared radii (avoid sqrt in hot loops) */
  C.SEPARATION_RADIUS_SQ    = C.SEPARATION_RADIUS * C.SEPARATION_RADIUS;
  C.SHOCKWAVE_RADIUS_SQ     = C.SHOCKWAVE_RADIUS * C.SHOCKWAVE_RADIUS;
  C.LANDING_BURST_RADIUS_SQ = C.LANDING_BURST_RADIUS * C.LANDING_BURST_RADIUS;
  C.ANO_TRIGGER_RANGE_SQ    = C.ANO_TRIGGER_RANGE * C.ANO_TRIGGER_RANGE;
  C.ANO_VACUUM_RADIUS_SQ    = C.ANO_VACUUM_RADIUS * C.ANO_VACUUM_RADIUS;

  /* ---- Palette — theme-aware, cached ---- */
  var _colorCache = null;
  var _colorTheme = '';

  LA.getColors = function () {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === _colorTheme) return _colorCache;
    _colorTheme = theme;
    if (theme === 'dark') _colorCache = {
      cyan:   0x00ffff,  cyanArr:   [0,255,255],
      yellow: 0xffdc3c,  yellowArr: [255,220,60],
      dashArrowArr: [60, 120, 200],
      pcbTrace: 0x643cdc, pcbTraceA: 0.22,
      pcbVia:   0x8c50ff, pcbViaA:   0.30,
      bgColor:  0x04040d,
    };
    else if (theme === 'nature') _colorCache = {
      cyan:   0x50ffc8,  cyanArr: [80,255,200],
      yellow: 0xdcf050,  yellowArr: [220,240,80],
      dashArrowArr: [60, 120, 200],
      pcbTrace: 0x1e7850, pcbTraceA: 0.22,
      pcbVia:   0x32b464, pcbViaA:   0.30,
      bgColor:  0x030801,
    };
    else _colorCache = {
      cyan:   0x00ffff,  cyanArr: [0,255,255],
      yellow: 0xffdc3c,  yellowArr: [255,220,60],
      dashArrowArr: [60, 120, 200],
      pcbTrace: 0xf2a285, pcbTraceA: 0.20,
      pcbVia:   0xf2a285, pcbViaA:   0.28,
      bgColor:  0x08080f,
    };
    return _colorCache;
  };

  LA.resetColorCache = function () { _colorTheme = ''; };

})();
