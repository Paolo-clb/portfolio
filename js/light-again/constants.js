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
    UPGRADE_REROLLS_START: 1,     // rerolls the run begins with (+1 earned per boss kill)
    UPGRADE_CURSE_CHANCE:  0.25,  // chance one draft slot becomes a curse (never on the 1st draft)
    UPGRADE_ANTIFLOOD_W:   0.16,  // weight ×factor for a card that was offered (not picked) last draft
    UPGRADE_W_LVL1:        1.0,   // draw weight by level — capstones are rarer
    UPGRADE_W_LVL2:        0.6,
    UPGRADE_W_LVL3:        0.34,
    // Curse magnitudes (risk/reward — every curse costs −1 shield slot)
    CURSE_SCORE_MULT:      1.8,   // glassHeart : score gain ×
    CURSE_DASH_CD_MULT:    0.5,   // dashRage   : dash cooldown ×
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
    HIGHWAY_FLOW_SPEED:          14,     // px/frame conveyor carry at full strength (≈ +2× top speed → ~3× total)
    HIGHWAY_FLOW_CAP_MULT:       1.35,   // hard cap on summed conveyor magnitude (overlap guard) × FLOW_SPEED
    HIGHWAY_ENEMY_FLOW_MULT:     0.9,    // enemies caught in the flow are swept too, at this × the player's carry
    HIGHWAY_INVULN_GRACE:        280,    // ms of invincibility granted while riding (lingers this long after exit)
    HIGHWAY_EXHAUST_ZONE:        270,    // px before+past the downstream mouth where enemies get launched out (anti-stack)
    HIGHWAY_EJECT_SPEED:         12,     // px/frame forward launch velocity enemies reach at the exhaust mouth
    HIGHWAY_EJECT_SPREAD:        3.6,    // px/frame lateral fan added at the mouth so they scatter, not single-file
    HIGHWAY_SPAWN_NEAR_MIN:      160,    // the corridor passes at least this close to the player...
    HIGHWAY_SPAWN_NEAR_MAX:      840,    // ...and at most this far, so it's discoverable without a pointer
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
