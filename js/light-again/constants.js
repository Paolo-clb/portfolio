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
