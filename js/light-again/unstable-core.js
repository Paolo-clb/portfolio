/* ==========================================================================
   Light Again — The Unstable Core (Noyau Instable)

   A big pulsing geometric sphere wrapped in a cyan containment force-field,
   sitting NEUTRAL in the arena. It is TERRAIN/a weapon, not an enemy:

     1. SPAWN   — once the upgrade is unlocked the map keeps CORE_MAX (3) of them
                  present, each somewhere away from the player, NO guidance arrow.
                  Using one frees its slot, which returns a fresh core elsewhere on
                  its OWN 15 s chrono (CORE_RESPAWN_MS) — individual per slot. Two can
                  share the player's view but never spawn glued (CORE_SELF_GAP).
     2. DORMANT — the sphere breathes: counter-rotating geometric lattices spin,
                  a hot core pulses, instability arcs flicker, the containment
                  hex bubble shimmers. Neutral — enemies pass straight over it.
     3. LAUNCH  — DASH-ATTACK it (and ONLY a dash-attack) and the field bursts: it fires
                  off DEAD STRAIGHT along your aim line — away from the side the dash bit
                  into, so you can deliberately aim the opening shot. This first leg does
                  NOT home: reach the screen edge with nothing struck and it self-destructs
                  (a missed shot); strike ANY enemy and it begins its billiard ricochets.
   • CORE-ON-CORE — a LAUNCHED core that ploughs into a still-DORMANT one doesn't crush
                  it (the field holds): it ACTIVATES it, launching it away from the impact
                  (exactly as if the player had dash-attacked it), and ricochets off it,
                  re-aiming at another enemy so its rampage carries on.

     4. BILLIARD— it rockets ENEMY TO ENEMY, a smart steered ricochet that targets a
                  tier-3 bruiser BY PREFERENCE but falls back to a tier-2/1 when none is
                  left, so it can always reach its full bounce count. It chains to the
                  enemy FARTHEST from the last one (max travel) and stays WELL WITHIN the
                  player's view (it'll chase a target that drifts off-screen, then comes
                  back to one in-view), CRUSHING every lesser enemy it ploughs through.
                  It does NOT bounce off the far world walls (that just flung it off
                  screen). Bosses live outside this.enemies, so it never sees them.
     5. DETONATE— after CORE_MAX_BOUNCES ricochets it explodes. ONLY when no enemy is
                  left anywhere near does it coast a short beat (CORE_FIZZLE_DUR) and blow
                  up where it is — it never flies off into the void. The WHOLE rampage's
                  score lands as one "NOYAU INSTABLE" big-score popup.

   Self-contained on this._cores (array of plain-data cores) + this._coreRespawnT
   (per-slot respawn chronos) + one shared, persistent ADD graphics layer created in
   scene.create (mirrors the digital-tree / highway modules). The dormant lifecycle +
   render tick on real dt; the launched movement/crush ride world time (sDt) normally,
   but during The World the core DEFIES the freeze and keeps pinballing at CORE_TW_SCALE
   × its speed (combat.js exempts its ctx.core kills from the Time-Stop deferral, so they
   resolve at once and stay in its own tally). Score is banked through _killEnemy's
   `ctx.core` path (the launched core object) into THAT core's own c.scoreAccum (each
   flying core tallies independently, kept clear of the shared batch).
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Palette — volatile orange/amber plasma (hot) contained by a cool cyan field.
     Deliberately distinct from cyan (player), magenta (mirror/dash-atk), green
     (tree) and enemy-red so the core always reads as its own thing. */
  var HOT      = 0xff8a3c;   // core orange
  var HOTCORE  = 0xffd8a0;   // warm near-white
  var EMBER    = 0xff5a1e;   // deep ember
  var WHITE    = 0xffffff;
  var FIELD    = 0x66ddff;   // containment field cyan
  var FIELDHOT = 0xccf4ff;   // field bright edge
  var TW_GOLD  = 0xffc832;   // The World theme gold (matches the stasis wave / golden orbs)
  var TW_GOLD2 = 0xffe06e;   // brighter gold accent

  /* Trace a regular n-gon path (caller strokes/fills). */
  function polyPath(g, x, y, r, n, rot) {
    g.beginPath();
    for (var i = 0; i < n; i++) {
      var a = rot + (i / n) * TAU;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initCore = function () {
    this._cores        = [];   // up to CORE_MAX live cores (dormant or launched)
    this._coreRespawnT = [];   // one pending-respawn chrono (ms remaining) per freed slot

    // One shared persistent ADD layer at depth 26 (above drones/enemies, below
    // the ship) — destroyed with the scene, cleared per-frame. ALL cores draw to it.
    this._coreGfx = this.add.graphics();
    this._coreGfx.setDepth(26);
    this._coreGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop every live core + pending slot (graphics persist — just cleared). `silent`
     skips FX. */
  M._clearCore = function (silent) {
    this._cores        = [];
    this._coreRespawnT = [];
    if (this._coreGfx) this._coreGfx.clear();
  };

  /* Retire ONE launched core (it detonated / self-destructed): pull it from the live
     list and start its slot's individual 15 s respawn chrono. */
  M._retireCore = function (c) {
    var idx = this._cores.indexOf(c);
    if (idx >= 0) this._cores.splice(idx, 1);
    this._coreRespawnT.push(C.CORE_RESPAWN_MS);
  };

  /* Shared by every other map feature's spawn placement: push ALL live cores AND
     prisms (now multi-instance) into its [obj, sep2] avoid list, so map events never
     drop onto a weapon. Guarded — the arrays may not exist yet during early init. */
  M._pushWeaponAvoids = function (avoid, sep2) {
    var i;
    if (this._cores)  for (i = 0; i < this._cores.length;  i++) avoid.push([this._cores[i],  sep2]);
    if (this._prisms) for (i = 0; i < this._prisms.length; i++) avoid.push([this._prisms[i], sep2]);
  };

  /* ================================================================
     SPAWN GATE — paced, never during curated / confined states
     ================================================================ */
  // Block NEW spawns (an existing core still ticks + renders) during the tutorial,
  // the upgrade slow-mo / draft, ANY anomaly presence (its quarantine confines the
  // player, so a far core would be unreachable), and Time Stop. The other bosses
  // (Giga/Mirror/Snake) are FAIR GAME — a core is a great way to mow their adds.
  M._coreSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomaly || this._anomalyBarrierActive ||
              this._anomalyIntroActive || this._twActive || !this.p || this.p.state === 'DEAD');
  };

  // The Unstable Core is now an UPGRADE: it only exists on the map once its branch
  // has been drafted (Lv1+). Mode-independent — purely the upgrade level.
  M._coreUnlocked = function () {
    return !!(this._upgradeLevels && this._upgradeLevels.core > 0);
  };

  /* Keep the map populated with CORE_MAX cores. Each freed slot runs its OWN 15 s
     chrono (this._coreRespawnT); when one elapses a fresh core surfaces somewhere
     new. The chronos keep counting even while spawns are SUSPENDED (curated states),
     so a slot that came due during a lull pops the instant the lull ends. */
  M._tickCorePopulation = function (dt, suspended) {
    if (!this._coreUnlocked()) {                  // locked → no cores, no pending slots
      if (this._coreRespawnT.length) this._coreRespawnT.length = 0;
      return;
    }
    // Top the slot count back up to CORE_MAX (live + pending). Fresh slots are due
    // immediately (chrono 0) so the first unlock fills the map promptly.
    var deficit = C.CORE_MAX - this._cores.length - this._coreRespawnT.length;
    for (var d = 0; d < deficit; d++) this._coreRespawnT.push(0);

    var ms = dt * 1000;
    for (var i = this._coreRespawnT.length - 1; i >= 0; i--) {
      this._coreRespawnT[i] -= ms;
      if (this._coreRespawnT[i] > 0) continue;
      if (suspended || this._cores.length >= C.CORE_MAX) { this._coreRespawnT[i] = 0; continue; }
      if (this._spawnCore({})) this._coreRespawnT.splice(i, 1);   // placed → consume the slot
      else this._coreRespawnT[i] = 0;                              // no clear spot this frame → retry next
    }
  };

  /* Place a dormant core a random walk away from the player, clear of the world
     edge AND of any live Curse Fountain / Digital Tree / Cache Zone (re-roll a
     few times, then accept) so the map events never crowd each other. */
  M._spawnCore = function (opts) {
    opts = opts || {};
    if (this._cores.length >= C.CORE_MAX) return false;
    if (!this.p || this.p.state === 'DEAD') return false;

    // Per-level size (defaults to Lv1 if a debug spawn fires while still locked).
    var lvl    = (this._upgradeLevels && this._upgradeLevels.core) || 1;
    var radius = C.CORE_BODY_BY_LVL[lvl];
    var fieldR = C.CORE_FIELD_BY_LVL[lvl];

    var inset = fieldR + 40;                            // keep the WHOLE field in-bounds (disc)
    var sep2  = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var minP2 = C.PRISM_MIN_PLAYER_DIST * C.PRISM_MIN_PLAYER_DIST;   // never surface right on the player
    var avoid = [this._fount, this._tree, this._cache, this._greed];   // optional refs (may not exist)
    // Prisms use the generic big feature gap (two DIFFERENT weapons shouldn't crowd).
    for (var pi = 0; this._prisms && pi < this._prisms.length; pi++) avoid.push(this._prisms[pi]);
    var x, y, tries = 0, ok = false;

    if (opts.near) {
      // Debug spawn (KeyC): pop it RIGHT in front of the player ("sous tes yeux") — close
      // enough to watch it materialise on screen, but just OUTSIDE the dash-attack launch
      // reach (fieldR + ship half + pad) so it doesn't instantly fire if you're dashing.
      var na = Math.random() * TAU, nd = fieldR + 120 + Math.random() * 70;
      var nc = LA.clampDisc(this.p.x + Math.cos(na) * nd, this.p.y + Math.sin(na) * nd, inset);
      x = nc.x; y = nc.y;
    } else {
      // Like the Prism: surface UNIFORMLY at random ANYWHERE on the map (not anchored
      // to the player), re-rolling only to keep it off the player and clear of the
      // other live features + a Data Highway band. Siblings keep a SMALLER gap (just
      // their fields + CORE_SELF_GAP) so two cores can share the view but never glue.
      do {
        var pt = LA.randInDisc(inset);
        x = pt.x; y = pt.y;
        ok = true;
        var pdx = x - this.p.x, pdy = y - this.p.y;
        if (pdx * pdx + pdy * pdy < minP2) ok = false;
        if (ok) for (var ai = 0; ai < avoid.length; ai++) {
          var av = avoid[ai];
          if (av && (x - av.x) * (x - av.x) + (y - av.y) * (y - av.y) < sep2) { ok = false; break; }
        }
        // Never let two cores spawn glued: keep their fields apart by CORE_SELF_GAP.
        if (ok) for (var ci = 0; ci < this._cores.length; ci++) {
          var oc = this._cores[ci];
          var selfSep = oc.fieldR + fieldR + C.CORE_SELF_GAP;
          if ((x - oc.x) * (x - oc.x) + (y - oc.y) * (y - oc.y) < selfSep * selfSep) { ok = false; break; }
        }
        // Never drop the core onto a live Data Highway band (reciprocal of the
        // highway's own avoidance — the two must never overlap).
        if (ok && !this._pointClearsHighways(x, y, fieldR)) ok = false;
        tries++;
      } while (!ok && tries < 40);
      if (!ok) return false;   // no clear spot this frame → the slot retries next tick
    }

    var c = {
      x: x, y: y, vx: 0, vy: 0,
      phase: 'DORMANT',
      age: 0, lifeMs: 0, bounces: 0,
      radius: radius, fieldR: fieldR,                  // per-level body + containment-field size
      lvl: lvl,                                        // upgrade level — drives the empowered L2+ look/FX
      maxBounces:  C.CORE_BOUNCES_BY_LVL[lvl],         // per-level flight (ricochets / speed / blast)
      launchSpeed: C.CORE_SPEED_BY_LVL[lvl],
      expRadius:   C.CORE_EXP_BY_LVL[lvl],
      spin: Math.random() * TAU, fieldSpin: Math.random() * TAU, pulse: Math.random() * TAU,
      seed: Math.random() * 1000,
      trail: [], trailT: 0,
      target: null, hitList: [], fizzle: false, fizzleT: 0, firstLeg: false,
      scoreAccum: 0,                                   // per-core running tally for ITS launched rampage
    };
    this._cores.push(c);

    // Arrival flourish — a hot burst inside a cool containment ring (scaled to size).
    this._spawnWaveRing(x, y, { maxRadius: fieldR * 2.2, color: HOT,   expandTime: 0.45 });
    this._spawnWaveRing(x, y, { maxRadius: fieldR * 1.2, color: FIELD, expandTime: 0.32 });
    this._explode(x, y, [255, 150, 40],  26);
    this._explode(x, y, [120, 220, 255], 14);
    return c;
  };

  /* ================================================================
     UPDATE — spawn gate, tick the live core, render. Called from update()
     with dt = real seconds, sDt = WORLD seconds (frozen during The World).
     ================================================================ */
  M._updateCore = function (dt, sDt) {
    this._tickCorePopulation(dt, this._coreSpawnSuspended());

    // Tick every live core (snapshot the length — _launchCore never adds/removes,
    // and retire only happens at detonate/self-destruct which `return` right after).
    for (var i = this._cores.length - 1; i >= 0; i--) {
      var c = this._cores[i];
      if (!c) continue;
      if (c.phase === 'DORMANT')       this._tickCoreDormant(c, dt);
      else if (c.phase === 'LAUNCHED') this._tickCoreLaunched(c, dt, sDt);
    }
    this._renderCore(dt);
  };

  /* DORMANT: breathe and watch for a dash-attack hit. As an upgrade fixture it no
     longer withers — it sits until USED (dash-attack or core-on-core), then its slot
     respawns elsewhere on a 15 s chrono. */
  M._tickCoreDormant = function (c, dt) {
    var p = this.p, ms = dt * 1000;
    c.spin      += dt * 0.7;
    c.fieldSpin -= dt * 0.45;
    c.pulse     += dt;
    c.age       += ms;

    // ---- Propelled drift (after being hit by a launched core) ----
    if (c.vx || c.vy) {
      var s60 = dt * 60;
      c.x += c.vx * s60; c.y += c.vy * s60;
      var fr = Math.pow(C.CORE_DRIFT_FRICTION, s60);
      c.vx *= fr; c.vy *= fr;
      if (c.vx * c.vx + c.vy * c.vy < 0.0025) { c.vx = 0; c.vy = 0; }
      // Bounce the drift off the arena wall so it never tunnels out.
      if (!LA.inDisc(c.x, c.y, c.fieldR)) {
        var cl = LA.clampDisc(c.x, c.y, c.fieldR);
        c.x = cl.x; c.y = cl.y;
        var vn = c.vx * cl.nx + c.vy * cl.ny;
        if (vn > 0) { c.vx -= 2 * vn * cl.nx; c.vy -= 2 * vn * cl.ny; }
      }
    }

    // LAUNCH: a dash-attack biting into the field — OR a Prism strike sweeping the
    // ship through it (the prism turns YOU into the bolt, so it triggers the core
    // exactly like a dash-attack would).
    var strikingThrough = p && (p.state === 'DASH_ATTACKING' || this._anyPrismStriking());
    if (strikingThrough) {
      var dx = c.x - p.x, dy = c.y - p.y;
      var reach = c.fieldR + C.SIZE * 0.6 + C.CORE_TRIGGER_PAD;
      if (dx * dx + dy * dy < reach * reach) { this._launchCore(c); return; }
    }
    // No wither: a persistent upgrade fixture (only the player using it relocates it).
  };

  /* True while a Prism strike is sweeping the ship through the arena (the ship IS the
     bolt), so a dormant core in its path launches exactly like a dash-attack hit. */
  M._anyPrismStriking = function () {
    if (!this._prisms) return false;
    for (var i = 0; i < this._prisms.length; i++) {
      if (this._prisms[i].phase === 'STRIKE') return true;
    }
    return false;
  };

  /* Dash-attack connected → the field bursts. The core heads for the on-screen
     bruiser that best matches the dash heading (or, with none in view, coasts off
     in the aim direction and fizzles out shortly — a weak short-range hit). */
  M._launchCore = function (c) {
    var p = this.p;
    var dx = c.x - p.x, dy = c.y - p.y;
    var d  = Math.sqrt(dx * dx + dy * dy);
    var ax, ay;                                       // aim heading (player → core impact line)
    if (d > 0.1) { ax = dx / d; ay = dy / d; }
    else {                                            // dead-on: fall back to the dash heading
      ax = p.atkDx || Math.cos(p.angle);
      ay = p.atkDy || Math.sin(p.angle);
      var al = Math.sqrt(ax * ax + ay * ay) || 1; ax /= al; ay /= al;
    }

    c.phase    = 'LAUNCHED';
    c.bounces  = 0;
    c.lifeMs   = 0;
    c.trail    = [];
    c.trailT   = 0;
    c.hitList  = [];            // bruisers already struck this launch (never re-bounce them)
    c.fizzle   = false;
    c.fizzleT  = 0;
    c.firstLeg = true;          // the aimed opening shot — flies DEAD STRAIGHT, no homing yet
    c.target   = null;
    c.scoreAccum = 0;           // fresh per-core tally for this rampage

    // OPENING SHOT — fire it DEAD STRAIGHT along the aim line (away from the impact,
    // i.e. opposite the side the dash bit into), so the player can deliberately aim it.
    // It does NOT home this leg: reach the screen edge with nothing struck and it
    // self-destructs (a miss, see _tickCoreLaunched); the instant it strikes ANY enemy
    // it begins its usual billiard ricochets (see _coreContact).
    c.vx = ax * c.launchSpeed;
    c.vy = ay * c.launchSpeed;

    // Count the launch as a successful dash-attack hit: no whiff punish, and the
    // ship gets its usual satisfying landing burst when the dash-attack ends.
    p.hasHitDuringDashAttack = true;

    // Launch juice — L2+ erupts harder (bigger rings, more embers, a third ring).
    var hi = c.lvl >= 2;
    this._explode(c.x, c.y, [255, 150, 40],  hi ? 56 : 38);
    this._explode(c.x, c.y, [255, 240, 200], hi ? 34 : 22);
    this._spawnWaveRing(c.x, c.y, { maxRadius: hi ? 270 : 210, color: HOT,   expandTime: hi ? 0.48 : 0.42 });
    this._spawnWaveRing(c.x, c.y, { maxRadius: hi ? 155 : 120, color: WHITE, expandTime: 0.30 });
    if (hi) this._spawnWaveRing(c.x, c.y, { maxRadius: 200, color: EMBER, expandTime: 0.40 });
    this.cameras.main.flash(hi ? 200 : 160, 255, 150, 60);
    this.cameras.main.shake(hi ? 230 : 180, hi ? 0.016 : 0.012);
    this._triggerHitstop(hi ? 90 : 70);
    this._floatLabel(c.x, c.y - c.fieldR, 'NOYAU LIBÉRÉ', '#ff8a3c');
  };

  /* LAUNCHED: spin + trail on real dt; steer/move/contact on the core's own clock.
     During The World it keeps pinballing at CORE_TW_SCALE × speed (so the world's
     2 % crawl doesn't stall it) — its crushes resolve immediately and stay in its
     own score (combat.js exempts ctx.core from the Time-Stop deferral). Otherwise
     it rides world time (sDt), so a hitstop / upgrade slow-mo still slows it. */
  M._tickCoreLaunched = function (c, dt, sDt) {
    c.spin  += dt * (this._twActive ? 1.8 : 6);   // spin also eases into slow-mo under The World
    c.pulse += dt;

    // Blazing motion trail (fades on real dt so it stays smooth through slow-mo).
    c.trailT += dt * 1000;
    if (c.trailT > 16) {
      c.trailT = 0;
      c.trail.push({ x: c.x, y: c.y, a: 1 });
      if (c.trail.length > 18) c.trail.shift();
    }
    for (var i = 0; i < c.trail.length; i++) c.trail[i].a -= dt * 2.4;

    // The core's own advance this frame (seconds). It defies The World's freeze.
    var coreDt  = this._twActive ? (dt * C.CORE_TW_SCALE) : sDt;
    var step60  = coreDt * 60;
    var stepMs  = coreDt * 1000;
    if (step60 <= 0.0001) return;   // genuinely paused (hitstop / draft) → don't move or detonate
    c.lifeMs += stepMs;

    // ---- Steering: home toward the current target (T3 by preference, else T2/T1) ----
    // (Re-acquire — in-view first — if the target died or drifted out of detection
    // range; with no enemy left anywhere near, drop into the fizzle coast below.)
    // The opening straight shot (firstLeg) skips ALL steering — it just flies on.
    if (!c.firstLeg && !c.fizzle) {
      if (!this._coreTargetValid(c)) {
        var sp0 = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1;
        c.target = this._coreAcquire(c, { dirX: c.vx / sp0, dirY: c.vy / sp0, excludeList: c.hitList });
        if (!c.target) { c.fizzle = true; c.fizzleT = 0; }
      }
      if (c.target) {
        var desired = Math.atan2(c.target.y - c.y, c.target.x - c.x);
        var cur     = Math.atan2(c.vy, c.vx);
        var diff    = Phaser.Math.Angle.Wrap(desired - cur);
        var maxTurn = C.CORE_TURN * coreDt;
        if (diff >  maxTurn) diff =  maxTurn;
        else if (diff < -maxTurn) diff = -maxTurn;
        var ang = cur + diff;
        c.vx = Math.cos(ang) * c.launchSpeed;
        c.vy = Math.sin(ang) * c.launchSpeed;
      }
    }

    // ---- Move ----
    c.x += c.vx * step60;
    c.y += c.vy * step60;

    // World wall (the arena "barrière"):
    //  • Opening straight shot (firstLeg) → REFLECT off the wall and keep flying dead
    //    straight, so it always carries on until it leaves the SCREEN (self-destruct)
    //    or meets an enemy. It never explodes on the wall.
    //  • Once bouncing (billiard) → the old failsafe: it just blows up at the edge
    //    (it steers to stay on-screen, so reaching the wall there means something's off).
    if (!LA.inDisc(c.x, c.y, c.radius)) {
      var clc = LA.clampDisc(c.x, c.y, c.radius);
      c.x = clc.x; c.y = clc.y;
      if (c.firstLeg) {
        var vn = c.vx * clc.nx + c.vy * clc.ny;   // speed INTO the wall (along outward normal)
        c.vx -= 2 * vn * clc.nx;                   // mirror the velocity across the wall
        c.vy -= 2 * vn * clc.ny;
        this._spawnWaveRing(c.x, c.y, { maxRadius: 95, color: FIELD, expandTime: 0.28 });
        this._explode(c.x, c.y, [120, 220, 255], 10);
        this.cameras.main.shake(70, 0.006);
      } else {
        this._detonateCore(c); return;
      }
    }

    // ---- Contact: crush lesser enemies, ricochet off bruisers ----
    this._coreContact(c);

    // ---- Core-on-core: plough into a still-dormant core → propel it away, ricochet
    //      off it (re-aiming at another enemy so the rampage carries on). ----
    this._coreVsDormantCores(c);

    // ---- Missed opening shot: reached the screen edge with nothing struck → self-destruct ----
    // (Only the straight first leg; once bouncing it deliberately chases off-screen targets.)
    if (c.firstLeg && this._coreOffScreen(c)) { this._selfDestructCore(c); return; }

    // ---- Flying embers ----
    if (Math.random() < 0.6) this._explode(c.x - c.vx * 0.3, c.y - c.vy * 0.3, [255, 140, 40], 3);

    // ---- Fizzle coast: no on-screen bruiser to chain to → drift a beat, then blow ----
    if (c.fizzle) {
      c.fizzleT += stepMs;
      if (c.fizzleT >= C.CORE_FIZZLE_DUR) { this._detonateCore(c); return; }
    }

    // ---- End conditions ----
    if (c.bounces >= c.maxBounces || c.lifeMs >= C.CORE_SAFETY_LIFETIME) this._detonateCore(c);
  };

  /* Find the single best enemy OF ONE TIER to chain to, considering only enemies
     within the camera view (+ opts.margin px; a NEGATIVE margin insets the view
     inward → "well inside the screen"). Two selection modes:
       • opts.farFrom = {x,y} → the enemy FARTHEST from that point (maximises the
         distance the core travels — used for the bounce-to-next redirect).
       • otherwise → the one scoring near + forward-of-(opts.dirX,opts.dirY) best
         (used at launch and mid-flight re-acquisition).
     opts.excludeList hard-skips already-struck enemies. Returns null if none qualify. */
  M._corePickTargetTier = function (c, opts, tier) {
    var enemies = this.enemies;
    var view = this.cameras.main.worldView;
    var mg = opts.margin || 0;
    // A negative margin shrinks the view inward (prefer enemies WELL inside the
    // screen so the core stays on-screen). Clamp so the zone can never collapse.
    if (mg < 0) mg = Math.max(mg, -Math.min(view.width, view.height) * 0.3);
    var vL = view.x - mg, vR = view.right + mg, vT = view.y - mg, vB = view.bottom + mg;
    var ff = opts.farFrom || null, exList = opts.excludeList || null;
    var dirX = opts.dirX || 0, dirY = opts.dirY || 0;
    var best = null, bestScore = ff ? -Infinity : Infinity;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.tier !== tier) continue;
      if (e._snIntangible) continue;                                // cloaked sniper — can't be chained to
      if (exList && exList.indexOf(e) >= 0) continue;               // hard-skip already-struck enemies
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;
      if (e.x < vL || e.x > vR || e.y < vT || e.y > vB) continue;   // outside the (margin-adjusted) view
      if (ff) {
        var fdx = e.x - ff.x, fdy = e.y - ff.y, fd2 = fdx * fdx + fdy * fdy;
        if (fd2 > bestScore) { bestScore = fd2; best = e; }         // farthest from the reference
      } else {
        var dx = e.x - c.x, dy = e.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) continue;
        var align = (dx / d) * dirX + (dy / d) * dirY;              // forward = +1, behind = -1
        var score = d * (1.5 - align);                             // prefer near AND ahead
        if (score < bestScore) { bestScore = score; best = e; }
      }
    }
    return best;
  };

  /* Acquire the next target. TIER comes first (a tier-3 bruiser is the satisfying
     billiard, then tier-2, then tier-1) so the core keeps chaining — and reaches its
     full bounce count — as long as ANY enemy is around. WITHIN each tier it prefers an
     enemy WELL inside the view (inset) over one near the edge, then anywhere on-screen,
     so ricochets stay comfortably on-screen. Only once no enemy of any tier is on-screen
     does it reach OFF-screen (detection range) as a last resort, rather than fizzling —
     so it self-destructs only when there's genuinely no enemy left anywhere near. */
  M._coreAcquire = function (c, opts) {
    var self = this;
    function pick(margin, tier) {
      return self._corePickTargetTier(c, {
        dirX: opts.dirX, dirY: opts.dirY, farFrom: opts.farFrom,
        excludeList: opts.excludeList, margin: margin,
      }, tier);
    }
    // Primary — ON-SCREEN, tier-first, inset-preferred within each tier.
    for (var tier = 3; tier >= 1; tier--) {
      var best = pick(-C.CORE_VIEW_INSET, tier) || pick(0, tier);
      if (best) return best;
    }
    // Last resort — chain to a just-off-screen enemy (still tier-first) before giving up.
    for (var t2 = 3; t2 >= 1; t2--) {
      var b2 = pick(C.CORE_DETECT_MARGIN, t2);
      if (b2) return b2;
    }
    return null;
  };

  /* Is the core's current target still a live enemy within the detection range?
     It deliberately keeps chasing a target that drifted OFF-SCREEN (up to the wide
     detection margin) — losing it just triggers a fresh in-view acquisition. */
  M._coreTargetValid = function (c) {
    var t = c.target;
    if (!t || this.enemies.indexOf(t) < 0) return false;            // gone / crushed
    var view = this.cameras.main.worldView, mg = C.CORE_DETECT_MARGIN;
    if (t.x < view.x - mg || t.x > view.right + mg ||
        t.y < view.y - mg || t.y > view.bottom + mg) return false;  // wandered out of detection range
    return true;
  };

  /* Contact resolution each frame. A bounce happens on a tier-3 bruiser (always — the
     satisfying billiard) OR on the core's CURRENT chase target whatever its tier — so
     when no bruiser is left, the core still ricochets off a tier-2/1 it was homing on
     and keeps its rampage alive. Every OTHER lesser enemy in the path is just ploughed
     through (crushed). Bosses aren't in this.enemies, so they're never touched. */
  M._coreContact = function (c) {
    var enemies = this.enemies, cr = c.radius;
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;   // still materialising → leave it
      if (e._snIntangible) continue;   // cloaked sniper — the core ploughs through it
      var dx = e.x - c.x, dy = e.y - c.y;
      var rr = cr + e.size * 0.5 + C.CORE_CRUSH_PAD;
      if (dx * dx + dy * dy >= rr * rr) continue;

      // A bounce happens on a tier-3 bruiser, on the current chase target, OR on the
      // VERY FIRST enemy the straight opening shot meets (any tier) — that contact is
      // what kicks off the usual billiard ricochets.
      if (e.tier === 3 || e === c.target || c.firstLeg) {
        // Already struck this launch → plough straight past it (never double-bounce
        // the same enemy). The just-struck one is pushed to hitList below, so this
        // also blocks an instant re-bounce on the very next frame.
        if (c.hitList.indexOf(e) >= 0) continue;
        c.firstLeg = false;                       // the opening shot connected → normal billiard from here on
        if (e.tier === 3) {
          if (e.hasShield) {
            this._breakShield(e);
          } else {
            e.hp -= C.CORE_BRUISER_DMG;
            if (e.hp <= 0) this._killEnemy(i, { core: c });
            else this._explode(e.x, e.y, [255, 140, 40], 10);
          }
        } else {
          this._killEnemy(i, { core: c });   // a weak T1/T2 target → crushed outright on the ricochet
        }
        c.hitList.push(e);                       // mark struck — avoid ever re-hitting it
        this._coreBounce(c);
        this._coreRedirect(c, e.x, e.y);         // chain to the next, max-travel, in-view target
        return;   // one ricochet per frame
      } else {
        this._killEnemy(i, { core: c });   // crush lesser enemies (plough through)
      }
    }
  };

  /* A LAUNCHED core that ploughs into a still-DORMANT core (its containment field
     intact) doesn't crush it — it ACTIVATES it. The dormant core launches away from
     the impact (as if the player had dash-attacked it), while the launched core
     ricochets off it and re-aims at another enemy. One collision per frame. */
  M._coreVsDormantCores = function (c) {
    for (var i = 0; i < this._cores.length; i++) {
      var o = this._cores[i];
      if (o === c || o.phase !== 'DORMANT') continue;
      var dx = o.x - c.x, dy = o.y - c.y;
      var rr = c.radius + o.fieldR;                 // body of the bolt vs the dormant FIELD
      var d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      var d  = Math.sqrt(d2) || 1;
      var nx = dx / d, ny = dy / d;                 // launched → dormant (the push / impact axis)

      // Nudge them apart so they don't re-overlap and double-hit next frame.
      var push = (rr - d) + 2;
      o.x += nx * push; o.y += ny * push;

      // Activate the dormant core: launch it away from the impact (as if dash-attacked).
      o.phase    = 'LAUNCHED';
      o.bounces  = 0;
      o.lifeMs   = 0;
      o.trail    = [];
      o.trailT   = 0;
      o.hitList  = [];
      o.fizzle   = false;
      o.fizzleT  = 0;
      o.firstLeg = true;
      o.target   = null;
      o.scoreAccum = 0;
      o.vx = nx * o.launchSpeed;
      o.vy = ny * o.launchSpeed;

      // Collision + activation juice.
      var mx = (c.x + o.x) * 0.5, my = (c.y + o.y) * 0.5;
      this._spawnWaveRing(mx,  my,  { maxRadius: o.fieldR * 1.7, color: HOT,   expandTime: 0.30 });
      this._spawnWaveRing(o.x, o.y, { maxRadius: o.fieldR * 2.0, color: FIELD, expandTime: 0.38 });
      this._explode(mx,  my,  [255, 150, 40],  20);
      this._explode(mx,  my,  [120, 220, 255], 10);
      this._explode(o.x, o.y, [255, 240, 200], 16);
      this._floatLabel(o.x, o.y - o.fieldR, 'NOYAU LIBÉRÉ', '#ff8a3c');
      this.cameras.main.flash(100, 255, 150, 50);
      this.cameras.main.shake(130, 0.010);
      this._triggerHitstop(50);

      // The launched core BOUNCES off the dormant one and re-aims at another enemy
      // (it does NOT cost a bruiser-ricochet from its bounce budget — this is terrain,
      // not a kill). Reflect first so it visibly deflects even if no enemy is left.
      c.firstLeg = false;                           // a deflection ends the dead-straight opening leg
      var vn = c.vx * nx + c.vy * ny;
      if (vn > 0) { c.vx -= 2 * vn * nx; c.vy -= 2 * vn * ny; }
      this._coreRedirect(c, o.x, o.y);              // chain to another enemy (keeps the rampage alive)
      return;                                       // one core-on-core hit per frame
    }
  };

  /* After a ricochet, chain to the UN-HIT enemy FARTHEST from the point just struck
     (max travel), preferring one well within the field of view (then on-screen, then
     within detection range). With nothing left to chain to, drop into the fizzle
     coast — it never circles back to re-smash an old target. */
  M._coreRedirect = function (c, fromX, fromY) {
    var nxt = this._coreAcquire(c, { farFrom: { x: fromX, y: fromY }, excludeList: c.hitList });
    c.target = nxt;
    if (nxt) {
      c.fizzle = false; c.fizzleT = 0;
      var ndx = nxt.x - c.x, ndy = nxt.y - c.y, nd = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
      c.vx = (ndx / nd) * c.launchSpeed;
      c.vy = (ndy / nd) * c.launchSpeed;
    } else {
      c.fizzle = true; c.fizzleT = 0;
    }
  };

  /* A ricochet: tick the counter + a punchy impact flash. */
  M._coreBounce = function (c) {
    c.bounces++;
    this._spawnWaveRing(c.x, c.y, { maxRadius: 150, color: HOT, expandTime: 0.30 });
    this._explode(c.x, c.y, [255, 170, 60],  16);
    this._explode(c.x, c.y, [255, 255, 210], 8);
    this.cameras.main.shake(90, 0.008);
    // Flash a warning the instant it arms its final bounce.
    if (c.bounces === c.maxBounces - 1) this.cameras.main.flash(120, 255, 120, 40);
  };

  /* The big finale: blast the area, bank the whole rampage as ONE popup, retire. */
  M._detonateCore = function (c) {
    var x = c.x, y = c.y;
    var R = c.expRadius * (this._blastMult || 1), R2 = R * R;   // cursedBlast curse

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (e._snIntangible) continue;   // cloaked sniper — immune to the core's blast
      var dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy >= R2) continue;
      if (e.tier === 3 && e.hasShield) { this._breakShield(e); continue; }
      this._killEnemy(i, { core: c });
    }

    // Bank the entire run (crush + blast) into a single dedicated big-score popup.
    if (c.scoreAccum > 0) this._floatScoreBig('NOYAU', c.scoreAccum);
    c.scoreAccum = 0;

    // Detonation spectacle.
    this._spawnWaveRing(x, y, { maxRadius: R * 1.25, color: EMBER, expandTime: 0.60 });
    this._spawnWaveRing(x, y, { maxRadius: R,        color: HOT,   expandTime: 0.50 });
    this._spawnWaveRing(x, y, { maxRadius: R * 0.6,  color: WHITE, expandTime: 0.40 });
    this._explode(x, y, [255, 150, 40],  82);
    this._explode(x, y, [255, 240, 200], 46);
    this._explode(x, y, [255, 90,  20],  36);
    this.cameras.main.flash(260, 255, 150, 60);
    this.cameras.main.shake(320, 0.022);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    // Chip a serpent caught in the blast, consistent with the nuke / delayed exp.
    this._damageAllSnakesAoe(x, y, R, C.SNAKE_AOE_DMG);

    this._retireCore(c);   // free this slot → its own 15 s respawn chrono
  };

  /* Has the core's body fully cleared the camera view? (used only for the straight
     opening shot — once bouncing it deliberately chases off-screen targets). */
  M._coreOffScreen = function (c) {
    var view = this.cameras.main.worldView, r = c.radius;
    return (c.x < view.x - r || c.x > view.right + r ||
            c.y < view.y - r || c.y > view.bottom + r);
  };

  /* A missed opening shot left the screen without meeting an enemy → a quiet
     self-destruct (NO area blast — it never reached anything), then free the slot. */
  M._selfDestructCore = function (c) {
    this._explode(c.x, c.y, [255, 150, 40],  20);
    this._explode(c.x, c.y, [255, 240, 200], 10);
    this._spawnWaveRing(c.x, c.y, { maxRadius: 120, color: HOT, expandTime: 0.38 });
    this.cameras.main.shake(80, 0.006);
    this._retireCore(c);   // free this slot → its own 15 s respawn chrono
  };

  /* ================================================================
     RENDER — one shared ADD layer; view-culled.
     ================================================================ */
  M._renderCore = function (dt) {
    var g = this._coreGfx;
    if (!g) return;
    g.clear();
    if (!this._cores || !this._cores.length) return;

    var view = this.cameras.main.worldView;
    for (var i = 0; i < this._cores.length; i++) {
      var c = this._cores[i];
      // Cull when the whole core (+ its field) is off-screen.
      var pad = c.fieldR + 90;
      if (c.x < view.x - pad || c.x > view.right + pad ||
          c.y < view.y - pad || c.y > view.bottom + pad) continue;
      if (c.phase === 'LAUNCHED') this._renderCoreLaunched(g, c);
      else                        this._renderCoreDormant(g, c);
    }
  };

  /* The geometric sphere body: a wireframe globe (latitude/longitude) crossed by
     counter-rotating polygon lattices, around a hot pulsing core. Shared by the
     dormant and launched looks (alpha/scale differ). */
  M._drawCoreSphere = function (g, x, y, r, rot, pulse, A) {
    // Glow halo.
    g.fillStyle(HOT, 0.10 * A); g.fillCircle(x, y, r * 1.28);
    g.fillStyle(HOT, 0.16 * A); g.fillCircle(x, y, r);

    // Body outline.
    g.lineStyle(2, HOT, 0.5 * A); g.strokeCircle(x, y, r);

    // Latitude rings (squashed circles, animated → reads as a rotating globe).
    for (var k = -1; k <= 1; k++) {
      var ry = r * Math.abs(Math.cos(rot * 0.5 + k * 0.9));
      g.lineStyle(1.2, EMBER, 0.4 * A);
      g.strokeEllipse(x, y + k * r * 0.33, r * 0.96, Math.max(3, ry * 0.9));
    }
    // Longitude meridian.
    g.lineStyle(1.2, EMBER, 0.4 * A);
    g.strokeEllipse(x, y, Math.max(3, r * 0.5 * Math.abs(Math.sin(rot))), r * 0.96);

    // Counter-rotating geometric lattices: a hexagon over a two-triangle star.
    g.lineStyle(1.6, HOTCORE, 0.55 * A);
    polyPath(g, x, y, r * 0.82, 6, rot); g.strokePath();
    g.lineStyle(1.6, WHITE, 0.45 * A);
    polyPath(g, x, y, r * 0.82, 3, -rot * 1.4); g.strokePath();
    polyPath(g, x, y, r * 0.82, 3, -rot * 1.4 + Math.PI); g.strokePath();

    // Hot pulsing heart.
    var hr = (r * 0.28) * (0.85 + 0.15 * pulse);
    g.fillStyle(HOT, 0.5 * A);     g.fillCircle(x, y, hr * 1.8);
    g.fillStyle(HOTCORE, 0.9 * A); g.fillCircle(x, y, hr);
    g.fillStyle(WHITE, A);         g.fillCircle(x, y, hr * 0.5 + 0.5 * pulse);
  };

  M._renderCoreDormant = function (g, c) {
    var gt = this.gameTime;
    var pulse = 0.6 + 0.4 * Math.sin(gt * 3 + c.seed);

    // No wither strobe: as an upgrade fixture the core no longer destabilises away.
    var A = 1;

    var x = c.x, y = c.y, fr = c.fieldR;

    // ---- Ground confinement decal (drawn FIRST, under the bubble) ----
    // Anchors the floating core to the floor and flags its trigger zone:
    // a slow warm pulse + a rotating dashed cyan "hazard" ring + cardinal
    // danger chevrons. Pure marking — no gameplay, just reads as a hazard pad.
    var hr0 = fr * 1.1;                                   // hazard ring sits just outside the field
    // Faint hot glow that breathes with the existing pulse → "something warm is contained here".
    g.fillStyle(HOT, 0.05 * A * pulse); g.fillCircle(x, y, hr0 * 0.92);
    // Dashed cyan ring, traced as short arc segments so it reads as a marked-off zone.
    var dashN = 28;                                       // 28 dashes around the ring
    var dashF = 0.6;                                      // each dash spans 60% of its slot
    for (var d = 0; d < dashN; d++) {
      var da0 = c.fieldSpin + (d / dashN) * TAU;          // share fieldSpin so it co-rotates with the bubble
      var da1 = da0 + (dashF / dashN) * TAU;
      g.lineStyle(2, FIELD, 0.18 * A);
      g.beginPath();
      g.moveTo(x + Math.cos(da0) * hr0, y + Math.sin(da0) * hr0);
      g.lineTo(x + Math.cos(da1) * hr0, y + Math.sin(da1) * hr0);
      g.strokePath();
    }
    // Four radial "danger" chevrons at the cardinal points (also rotating with the field).
    for (var ch = 0; ch < 4; ch++) {
      var ca  = c.fieldSpin + (ch / 4) * TAU;
      var cax = Math.cos(ca), cay = Math.sin(ca);         // outward direction
      var pax = -cay, pay = cax;                          // perpendicular (chevron half-width)
      var cTip = hr0 + 9, cBase = hr0 - 3, cW = 6;        // small inward-pointing arrow
      g.lineStyle(2, FIELDHOT, 0.22 * A * pulse);
      g.beginPath();
      g.moveTo(x + cax * cBase + pax * cW, y + cay * cBase + pay * cW);
      g.lineTo(x + cax * cTip,             y + cay * cTip);
      g.lineTo(x + cax * cBase - pax * cW, y + cay * cBase - pay * cW);
      g.strokePath();
    }

    // ---- Containment force-field bubble (rotating cyan hex) ----
    g.fillStyle(FIELD, 0.05 * A); g.fillCircle(x, y, fr);
    g.lineStyle(2, FIELD, 0.35 * A * pulse); polyPath(g, x, y, fr, 6, c.fieldSpin); g.strokePath();
    g.lineStyle(1, FIELDHOT, 0.5 * A * pulse); polyPath(g, x, y, fr * 0.97, 6, c.fieldSpin); g.strokePath();
    for (var i = 0; i < 6; i++) {
      var a  = c.fieldSpin + (i / 6) * TAU;
      g.fillStyle(FIELDHOT, 0.7 * A * pulse);
      g.fillCircle(x + Math.cos(a) * fr, y + Math.sin(a) * fr, 2.4);
    }

    // ---- L2+ : a second, COUNTER-rotating containment shell (double blindage) ----
    // The two hexes crossing make a 12-point star; energy arcs lace them together.
    if (c.lvl >= 2) {
      var fr2 = fr * 0.9, fs2 = -c.fieldSpin * 1.3;
      g.lineStyle(1.6, FIELDHOT, 0.40 * A * pulse); polyPath(g, x, y, fr2, 6, fs2); g.strokePath();
      for (var j2 = 0; j2 < 6; j2++) {
        var sa2 = fs2 + (j2 / 6) * TAU;
        g.fillStyle(WHITE, 0.6 * A * pulse);
        g.fillCircle(x + Math.cos(sa2) * fr2, y + Math.sin(sa2) * fr2, 1.8);
      }
      if (Math.random() < 0.6) {                    // flickering containment arc between the shells
        var ja  = Math.floor(Math.random() * 6);
        var oa1 = c.fieldSpin + (ja / 6) * TAU, ia1 = fs2 + (ja / 6) * TAU;
        g.lineStyle(1.2, FIELDHOT, 0.5 * A);
        g.beginPath();
        g.moveTo(x + Math.cos(oa1) * fr,  y + Math.sin(oa1) * fr);
        g.lineTo(x + Math.cos(ia1) * fr2, y + Math.sin(ia1) * fr2);
        g.strokePath();
      }
    }

    // ---- The geometric sphere ----
    this._drawCoreSphere(g, x, y, c.radius, c.spin, pulse, A);

    // ---- L2+ : an inner counter-rotating geometric core + orbiting plasma motes ----
    // The "core within the core" mirrors the prism's gem-in-gem motif.
    if (c.lvl >= 2) {
      this._drawCoreSphere(g, x, y, c.radius * 0.5, -c.spin * 1.4, pulse, 0.85 * A);
      var orbR = c.radius * 1.5;
      for (var lo = 0; lo < 3; lo++) {
        var oa = c.spin * 1.3 + (lo / 3) * TAU;
        var ox = x + Math.cos(oa) * orbR, oy = y + Math.sin(oa) * orbR;
        g.fillStyle(EMBER,   0.5 * A * pulse); g.fillCircle(ox, oy, 4.2);
        g.fillStyle(HOTCORE, 0.8 * A);         g.fillCircle(ox, oy, 2.1);
        g.fillStyle(WHITE,   0.9 * A);         g.fillCircle(ox, oy, 1.0);
      }
    }

    // ---- Instability arc, flickering inside the body ----
    if (Math.random() < 0.5) {
      var r  = c.radius;
      var a1 = Math.random() * TAU, a2 = a1 + (Math.random() - 0.5) * 2;
      g.lineStyle(1.4, WHITE, 0.6 * A);
      g.beginPath();
      g.moveTo(x + Math.cos(a1) * r * 0.7, y + Math.sin(a1) * r * 0.7);
      g.lineTo(x + (Math.random() - 0.5) * r * 0.5, y + (Math.random() - 0.5) * r * 0.5);
      g.lineTo(x + Math.cos(a2) * r * 0.7, y + Math.sin(a2) * r * 0.7);
      g.strokePath();
    }
  };

  M._renderCoreLaunched = function (g, c) {
    var gt = this.gameTime, r = c.radius;
    var tw = this._twActive;        // The World: dress it as a graceful gold slow-mo phantom (never grayed)

    // ---- Blazing motion trail (oldest → newest) ----
    for (var i = 0; i < c.trail.length; i++) {
      var tr = c.trail[i];
      if (tr.a <= 0) continue;
      var rr = (i / c.trail.length) * r * 0.9;
      g.fillStyle(HOT,   tr.a * 0.20); g.fillCircle(tr.x, tr.y, rr);
      g.fillStyle(EMBER, tr.a * 0.28); g.fillCircle(tr.x, tr.y, rr * 0.6);
    }

    // ---- The World slow-mo dressing, drawn BEHIND the ball ----
    if (tw) {
      // Concentric golden time-dilation ripples, expanding slowly on game time.
      for (var wi = 0; wi < 3; wi++) {
        var wp = ((gt * 0.45) + wi / 3) % 1;             // slow 0→1 cycle
        var wr = r * 1.15 + wp * r * 2.4;
        var wa = (1 - wp) * 0.40;
        g.lineStyle(2, TW_GOLD,  wa);        g.strokeCircle(c.x, c.y, wr);
        g.lineStyle(1, TW_GOLD2, wa * 0.7);  g.strokeCircle(c.x, c.y, wr * 0.98);
      }
      // Golden phantom echoes strobed along the recent path (the "ralenti" stutter).
      for (var ei = 0; ei < c.trail.length; ei += 3) {
        var te = c.trail[ei];
        if (te.a <= 0) continue;
        var er = r * (0.55 + 0.40 * te.a);
        g.fillStyle(TW_GOLD,  te.a * 0.16);  g.fillCircle(te.x, te.y, er);
        g.lineStyle(1.5, TW_GOLD2, te.a * 0.5); g.strokeCircle(te.x, te.y, er);
      }
    }

    // ---- Raging plasma ball (no containment field — it burst on launch) ----
    var armed = c.bounces >= c.maxBounces - 1;     // last bounce: about to detonate
    var pulse = 0.6 + 0.4 * Math.sin(gt * (tw ? 5 : (armed ? 28 : 14)));   // slow, breathing pulse under TW
    // L2+ : a hotter, larger aura so the empowered bolt reads as more dangerous.
    g.fillStyle(HOT, c.lvl >= 2 ? 0.26 : 0.18); g.fillCircle(c.x, c.y, r * (c.lvl >= 2 ? 1.85 : 1.5) * (0.9 + 0.1 * pulse));
    this._drawCoreSphere(g, c.x, c.y, r, c.spin, pulse, 1);
    g.fillStyle(WHITE, 0.5 * pulse); g.fillCircle(c.x, c.y, r * 0.3 * pulse);

    // ---- L2+ : the same compound motif in flight — an inner counter-rotating core
    //      plus 3 orbiting plasma motes trailing the bolt. ----
    if (c.lvl >= 2) {
      this._drawCoreSphere(g, c.x, c.y, r * 0.5, -c.spin * 1.4, pulse, 0.8);
      var orbR = r * 1.55;
      for (var lo = 0; lo < 3; lo++) {
        var oa = c.spin * 1.6 + (lo / 3) * TAU;
        var ox = c.x + Math.cos(oa) * orbR, oy = c.y + Math.sin(oa) * orbR;
        g.fillStyle(EMBER,   (tw ? 0.30 : 0.55) * pulse); g.fillCircle(ox, oy, 4.2);
        g.fillStyle(HOTCORE, (tw ? 0.5  : 0.8)  * pulse); g.fillCircle(ox, oy, 2.2);
        g.fillStyle(WHITE,   (tw ? 0.6  : 0.9));          g.fillCircle(ox, oy, 1.0);
      }
    }

    // ---- The World: warm gold phase-shimmer ON the body (reads as TW, not gray) ----
    if (tw) {
      var sh = 0.5 + 0.5 * Math.sin(gt * 3);
      g.fillStyle(TW_GOLD, 0.12 + 0.10 * sh);       g.fillCircle(c.x, c.y, r * 0.92);
      g.lineStyle(2.5, TW_GOLD2, 0.45 + 0.25 * sh); g.strokeCircle(c.x, c.y, r * 1.12);
      // A lone gold mote orbiting slowly — a subtle clock-hand, sells the frozen time.
      var oa = gt * 1.2;
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(c.x + Math.cos(oa) * r * 1.12, c.y + Math.sin(oa) * r * 1.12, 2.6);
    }

    // ---- Remaining-bounce pips around the ball (clear feedback) ----
    var n = c.maxBounces;
    for (var b = 0; b < n; b++) {
      var pa = -Math.PI / 2 + (b / n) * TAU;
      var px = c.x + Math.cos(pa) * (r + 14), py = c.y + Math.sin(pa) * (r + 14);
      var used = b < c.bounces;
      g.fillStyle(used ? 0x442211 : (tw ? TW_GOLD2 : HOTCORE), used ? 0.4 : 0.95);
      g.fillCircle(px, py, 3);
    }
  };

})();
