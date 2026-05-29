/* ==========================================================================
   Light Again — Constants & Palette
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain = window.LightAgain || {};
  LA.sceneMethods = {};

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
    SANDBOX_RATE_MIN:      0.5,
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
    WORLD_HALF:  4000,
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

    STAR_DUR:          5000,
    STAR_WARN:         4000,
    STAR_DETO_THRESH:  50,
    STAR_TINT:         0xff14c8,
    STAR_TINT_ARR:     [255, 20, 200],

    /* ---- Upgrade system (roguelite draft) ---- */
    UPGRADE_KILL_INTERVAL: 200,
    UPGRADE_DRAFT_SIZE:    2,

    /* ---- The World (secret upgrade) ---- */
    TW_DURATION:           4000,
    TW_COOLDOWN:           30000,
    TW_SECRET_KILL_DELAY:  500,

    /* ---- The Anomaly (rare "glitch" mini-boss / quarantine event) ----
       An unstable RGB-split entity that wanders the arena, then slams a
       circular "firewall" around the player, vacuums nearby enemies inside,
       halts natural spawns, and fires telegraphed lasers. Invulnerable
       (static shield) until every trapped enemy is dead; then it panics and
       can be killed, dropping a free upgrade. Shared by both game modes. */
    ANO_SIZE:            34,     // body half-extent (px)
    ANO_TRIGGER_RANGE:   360,    // player distance that slams the barrier
    ANO_BARRIER_RADIUS:  520,    // base quarantine zone radius (px), at ANO_MIN_TRAPPED
    ANO_BARRIER_PER_ENEMY: 6,    // +radius per trapped enemy beyond the minimum (small)
    ANO_BARRIER_MAX:     1000,    // hard cap on the quarantine radius (px) — kept tight
    ANO_VACUUM_RADIUS:   1100,   // enemies within this get sucked inside on slam
    ANO_MIN_TRAPPED:     9,      // floor of trapped sub-fifres (boss spawns extras)
    ANO_LASER_CD:        2400,   // ms between laser volleys (while shielded)
    ANO_LASER_WARN:      520,    // telegraph duration — harmless thin line (ms)
    ANO_LASER_FIRE:      420,    // deadly beam duration (ms)
    ANO_LASER_WIDTH:     17,     // deadly beam half-width for the hit test (px)
    ANO_CROSS_FIRE:      2200,   // deadly duration of the rotating-cross attack (ms)
    ANO_CROSS_ROT:       0.00055,// cross rotation speed (rad/ms) — slow & readable
    ANO_PROJ_CD:         3600,   // ms between homing-projectile swarms
    ANO_PROJ_SWARM_MIN:  5,      // swarm size (min)
    ANO_PROJ_SWARM_MAX:  8,      // swarm size (max)
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
  };

  /* ---- Upgrade branch definitions ---- */
  LA.UPGRADES = {
    dashAtk: {
      id: 'dashAtk',
      maxLvl: 2,
      i18nName:  'laUpDashAtkName',
      i18nDesc1: 'laUpDashAtkDesc1',
      i18nDesc2: 'laUpDashAtkDesc2',
    },
    detonation: {
      id: 'detonation',
      maxLvl: 2,
      i18nName:  'laUpDetonationName',
      i18nDesc1: 'laUpDetonationDesc1',
      i18nDesc2: 'laUpDetonationDesc2',
    },
    dash: {
      id: 'dash',
      maxLvl: 2,
      i18nName:  'laUpDashName',
      i18nDesc1: 'laUpDashDesc1',
      i18nDesc2: 'laUpDashDesc2',
    },
    baseAtk: {
      id: 'baseAtk',
      maxLvl: 2,
      i18nName:  'laUpBaseAtkName',
      i18nDesc1: 'laUpBaseAtkDesc1',
      i18nDesc2: 'laUpBaseAtkDesc2',
    },
    shield: {
      id: 'shield',
      maxLvl: 2,
      i18nName:  'laUpShieldName',
      i18nDesc1: 'laUpShieldDesc1',
      i18nDesc2: 'laUpShieldDesc2',
    },
  };

  /* ---- Secret upgrade (The World) ---- */
  LA.SECRET_UPGRADE = {
    id: 'theWorld', maxLvl: 1,
    i18nName: 'laUpTheWorldName', i18nDesc1: 'laUpTheWorldDesc1',
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
