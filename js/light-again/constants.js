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
    MAX_ENEMIES:     300,
    SPAWN_T1_RAMP_KILLS: 950,
    SPAWN_T1_MIN_BASE:   4,
    SPAWN_T1_MIN_SPAN:   12,
    SPAWN_T1_MAX_BASE:   5,
    SPAWN_T1_MAX_SPAN:   12,
    SPAWN_T2_RAMP_KILLS: 450,
    SPAWN_T2_CHANCE_1:   0.56,
    SPAWN_T2_CHANCE_2:   0.28,
    SPAWN_T3_START_KILLS: 75,
    SPAWN_T3_RAMP_KILLS:  520,
    SPAWN_T3_CHANCE_1:    0.36,
    SPAWN_LATE_START_KILLS: 500,
    SPAWN_LATE_END_KILLS:   1000,
    SPAWN_LATE_MULT_T1:     1.7,
    SPAWN_LATE_MULT_T2:     2.0,
    SPAWN_LATE_MULT_T3:     1.9,
    SPAWN_DOUBLE_KILLS_START: 1000,
    SPAWN_DOUBLE_KILLS_FULL:  2000,
    SPAWN_DOUBLE_PROB_MAX:    0.5,
    LOADER_WARMUP_FRAMES:        45,
    LOADER_RESTART_WARMUP_FRAMES: 24,
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
