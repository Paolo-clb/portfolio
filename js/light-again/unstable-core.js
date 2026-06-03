/* ==========================================================================
   Light Again — The Unstable Core (Noyau Instable)

   A big pulsing geometric sphere wrapped in a cyan containment force-field,
   sitting NEUTRAL in the arena. It is TERRAIN/a weapon, not an enemy:

     1. SPAWN   — rare, gated, ONE at a time, somewhere away from the player.
                  NO guidance arrow (found at random, by request).
     2. DORMANT — the sphere breathes: counter-rotating geometric lattices spin,
                  a hot core pulses, instability arcs flicker, the containment
                  hex bubble shimmers. Neutral — enemies pass straight over it.
     3. LAUNCH  — DASH-ATTACK it (and ONLY a dash-attack) and the field bursts:
                  it fires off toward the bruiser best matching your aim.
     4. BILLIARD— it rockets BRUISER TO BRUISER, ricocheting off the chunky tier-3
                  bruisers (a smart, steered ricochet — only ever targeting bruisers
                  VISIBLE ON SCREEN), CRUSHING every lesser enemy it ploughs through.
                  It does NOT bounce off the far world walls (that just flung it off
                  screen). Bosses live outside this.enemies, so it never sees them.
     5. DETONATE— after CORE_MAX_BOUNCES ricochets it explodes. With no on-screen
                  bruiser left to chain to, it simply coasts a short beat (CORE_FIZZLE_DUR)
                  and blows up where it is — it never flies off into the void. The
                  WHOLE rampage's score lands as one "NOYAU INSTABLE" big-score popup.

   Self-contained on this._core (plain data) + one shared, persistent ADD
   graphics layer created in scene.create (mirrors the digital-tree / highway
   modules). The dormant lifecycle + render tick on real dt; the launched
   movement/crush ride world time (sDt) normally, but during The World the core
   DEFIES the freeze and keeps pinballing at CORE_TW_SCALE × its speed (combat.js
   exempts its ctx.core kills from the Time-Stop deferral, so they resolve at once
   and stay in its own tally). Score is banked through _killEnemy's `ctx.core`
   path into this._coreScoreAccum (kept clear of the shared batch so a mid-flight
   nuke can't corrupt it).
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
    this._core           = null;
    this._coreSpawnT     = 0;
    this._coreNextDelay  = C.CORE_SPAWN_MIN_DELAY;   // wait before the very first one
    this._coreScoreAccum = 0;                         // running tally for the launched rampage

    // One shared persistent ADD layer at depth 26 (above drones/enemies, below
    // the ship) — destroyed with the scene, cleared per-frame.
    this._coreGfx = this.add.graphics();
    this._coreGfx.setDepth(26);
    this._coreGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop the live core (graphics persist — just cleared). `silent` skips FX. */
  M._clearCore = function (silent) {
    this._core = null;
    if (this._coreGfx) this._coreGfx.clear();
  };

  M._rollCoreNextDelay = function () {
    this._coreSpawnT    = 0;
    this._coreNextDelay = C.CORE_SPAWN_INTERVAL_MIN +
      Math.random() * (C.CORE_SPAWN_INTERVAL_MAX - C.CORE_SPAWN_INTERVAL_MIN);
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

  M._maybeSpawnCore = function (dt) {
    if (this._core) return;
    this._coreSpawnT += dt * 1000;
    if (this._coreSpawnT < this._coreNextDelay) return;
    this._rollCoreNextDelay();
    this._spawnCore({});
  };

  /* Place a dormant core a random walk away from the player, clear of the world
     edge AND of any live Curse Fountain / Digital Tree / Cache Zone (re-roll a
     few times, then accept) so the map events never crowd each other. */
  M._spawnCore = function (opts) {
    opts = opts || {};
    if (this._core) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var inset = C.CORE_FIELD_RADIUS + 40;   // keep the WHOLE field in-bounds (disc)
    var sep2 = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var avoid = [this._fount, this._tree, this._cache, this._prism, this._greed];   // optional refs (may not exist)
    var x, y, tries = 0, ok;
    do {
      var ang  = Math.random() * TAU;
      var dist = C.CORE_SPAWN_DIST_MIN + Math.random() * (C.CORE_SPAWN_DIST_MAX - C.CORE_SPAWN_DIST_MIN);
      var ccc = LA.clampDisc(this.p.x + Math.cos(ang) * dist, this.p.y + Math.sin(ang) * dist, inset);
      x = ccc.x; y = ccc.y;
      ok = true;
      for (var ai = 0; ai < avoid.length; ai++) {
        var av = avoid[ai];
        if (av && (x - av.x) * (x - av.x) + (y - av.y) * (y - av.y) < sep2) { ok = false; break; }
      }
      tries++;
    } while (!ok && tries < 24);

    this._core = {
      x: x, y: y, vx: 0, vy: 0,
      phase: 'DORMANT',
      age: 0, lifeMs: 0, bounces: 0,
      spin: Math.random() * TAU, fieldSpin: Math.random() * TAU, pulse: Math.random() * TAU,
      seed: Math.random() * 1000,
      trail: [], trailT: 0,
      target: null, hitList: [], fizzle: false, fizzleT: 0,
    };
    this._coreScoreAccum = 0;

    // Arrival flourish — a hot burst inside a cool containment ring.
    this._spawnWaveRing(x, y, { maxRadius: 175, color: HOT,   expandTime: 0.45 });
    this._spawnWaveRing(x, y, { maxRadius: 95,  color: FIELD, expandTime: 0.32 });
    this._explode(x, y, [255, 150, 40],  26);
    this._explode(x, y, [120, 220, 255], 14);
  };

  /* ================================================================
     UPDATE — spawn gate, tick the live core, render. Called from update()
     with dt = real seconds, sDt = WORLD seconds (frozen during The World).
     ================================================================ */
  M._updateCore = function (dt, sDt) {
    if (!this._coreSpawnSuspended()) this._maybeSpawnCore(dt);

    var c = this._core;
    if (c) {
      if (c.phase === 'DORMANT')       this._tickCoreDormant(c, dt);
      else if (c.phase === 'LAUNCHED') this._tickCoreLaunched(c, dt, sDt);
    }
    this._renderCore(dt);
  };

  /* DORMANT: breathe, age toward the wither, and watch for a dash-attack hit. */
  M._tickCoreDormant = function (c, dt) {
    var p = this.p, ms = dt * 1000;
    c.spin      += dt * 0.7;
    c.fieldSpin -= dt * 0.45;
    c.pulse     += dt;
    c.age       += ms;

    // LAUNCH: a dash-attack biting into the field — OR a Prism strike sweeping the
    // ship through it (the prism turns YOU into the bolt, so it triggers the core
    // exactly like a dash-attack would).
    var strikingThrough = p && (p.state === 'DASH_ATTACKING' ||
      (this._prism && this._prism.phase === 'STRIKE'));
    if (strikingThrough) {
      var dx = c.x - p.x, dy = c.y - p.y;
      var reach = C.CORE_FIELD_RADIUS + C.SIZE * 0.6 + C.CORE_TRIGGER_PAD;
      if (dx * dx + dy * dy < reach * reach) { this._launchCore(c); return; }
    }

    // Destabilise away if left unused for too long (frees the slot, avoids clutter).
    if (c.age >= C.CORE_LIFETIME) this._witherCore();
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
    this._coreScoreAccum = 0;

    // Pick the first bruiser to chain to (aim-aligned, within detection range so a
    // far hexagon a touch off-screen still counts); head straight at it. With none,
    // coast in the aim direction and fizzle (see _tickCoreLaunched).
    var tgt = this._corePickTarget(c, { dirX: ax, dirY: ay, margin: C.CORE_DETECT_MARGIN });
    c.target = tgt;
    var hx = ax, hy = ay;
    if (tgt) {
      var tdx = tgt.x - c.x, tdy = tgt.y - c.y, tdd = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
      hx = tdx / tdd; hy = tdy / tdd;
    } else {
      c.fizzle = true;
    }
    c.vx = hx * C.CORE_LAUNCH_SPEED;
    c.vy = hy * C.CORE_LAUNCH_SPEED;

    // Count the launch as a successful dash-attack hit: no whiff punish, and the
    // ship gets its usual satisfying landing burst when the dash-attack ends.
    p.hasHitDuringDashAttack = true;

    // Launch juice.
    this._explode(c.x, c.y, [255, 150, 40],  38);
    this._explode(c.x, c.y, [255, 240, 200], 22);
    this._spawnWaveRing(c.x, c.y, { maxRadius: 210, color: HOT,   expandTime: 0.42 });
    this._spawnWaveRing(c.x, c.y, { maxRadius: 120, color: WHITE, expandTime: 0.30 });
    this.cameras.main.flash(160, 255, 150, 60);
    this.cameras.main.shake(180, 0.012);
    this._triggerHitstop(70);
    this._floatLabel(c.x, c.y - C.CORE_FIELD_RADIUS, 'NOYAU LIBÉRÉ', '#ff8a3c');
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

    // ---- Steering: home toward the current bruiser target ----
    // (Re-acquire if the target died or left the detection range; with none left
    // to chain to, drop into the fizzle coast below.)
    if (!c.fizzle) {
      if (!this._coreTargetValid(c)) {
        var sp0 = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1;
        c.target = this._corePickTarget(c, { dirX: c.vx / sp0, dirY: c.vy / sp0, excludeList: c.hitList, margin: C.CORE_DETECT_MARGIN });
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
        c.vx = Math.cos(ang) * C.CORE_LAUNCH_SPEED;
        c.vy = Math.sin(ang) * C.CORE_LAUNCH_SPEED;
      }
    }

    // ---- Move ----
    c.x += c.vx * step60;
    c.y += c.vy * step60;

    // Defensive world clamp: it never bounces off the far walls (that flung it off
    // screen) — if it ever reaches the very edge, it just blows up there.
    if (!LA.inDisc(c.x, c.y, C.CORE_RADIUS)) {
      var clc = LA.clampDisc(c.x, c.y, C.CORE_RADIUS);
      c.x = clc.x; c.y = clc.y;
      this._detonateCore(c); return;
    }

    // ---- Contact: crush lesser enemies, ricochet off bruisers ----
    this._coreContact(c);

    // ---- Flying embers ----
    if (Math.random() < 0.6) this._explode(c.x - c.vx * 0.3, c.y - c.vy * 0.3, [255, 140, 40], 3);

    // ---- Fizzle coast: no on-screen bruiser to chain to → drift a beat, then blow ----
    if (c.fizzle) {
      c.fizzleT += stepMs;
      if (c.fizzleT >= C.CORE_FIZZLE_DUR) { this._detonateCore(c); return; }
    }

    // ---- End conditions ----
    if (c.bounces >= C.CORE_MAX_BOUNCES || c.lifeMs >= C.CORE_SAFETY_LIFETIME) this._detonateCore(c);
  };

  /* Pick a tier-3 bruiser to chain to, considering only bruisers within the camera
     view (+ opts.margin px). Two selection modes:
       • opts.farFrom = {x,y} → the bruiser FARTHEST from that point (maximises the
         distance the core travels — used for the bounce-to-next redirect).
       • otherwise → the one scoring near + forward-of-(opts.dirX,opts.dirY) best
         (used at launch and mid-flight re-acquisition).
     opts.excludeList hard-skips already-struck bruisers. Returns null if none qualify. */
  M._corePickTarget = function (c, opts) {
    var enemies = this.enemies;
    var mg = opts.margin || 0;
    var view = this.cameras.main.worldView;
    var vL = view.x - mg, vR = view.right + mg, vT = view.y - mg, vB = view.bottom + mg;
    var ff = opts.farFrom || null, exList = opts.excludeList || null;
    var dirX = opts.dirX || 0, dirY = opts.dirY || 0;
    var best = null, bestScore = ff ? -Infinity : Infinity;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.tier !== 3) continue;
      if (exList && exList.indexOf(e) >= 0) continue;               // hard-skip already-struck bruisers
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;
      if (e.x < vL || e.x > vR || e.y < vT || e.y > vB) continue;   // outside the (margin-expanded) view
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

  /* Is the core's current target still a live bruiser within the detection range? */
  M._coreTargetValid = function (c) {
    var t = c.target;
    if (!t || this.enemies.indexOf(t) < 0) return false;            // gone / crushed
    var view = this.cameras.main.worldView, mg = C.CORE_DETECT_MARGIN;
    if (t.x < view.x - mg || t.x > view.right + mg ||
        t.y < view.y - mg || t.y > view.bottom + mg) return false;  // out of detection range
    return true;
  };

  /* Contact resolution each frame. Tier 1/2 are ploughed through (crushed, no
     deflection). A tier-3 bruiser is a billiard ball: the core chips/breaks it,
     counts a bounce, and redirects toward the NEXT on-screen bruiser (or fizzles
     out if there's none). Bosses aren't in this.enemies, so they're never touched. */
  M._coreContact = function (c) {
    var enemies = this.enemies, cr = C.CORE_RADIUS;
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;   // still materialising → leave it
      if (e._snIntangible) continue;   // cloaked sniper — the core ploughs through it
      var dx = e.x - c.x, dy = e.y - c.y;
      var rr = cr + e.size * 0.5 + C.CORE_CRUSH_PAD;
      if (dx * dx + dy * dy >= rr * rr) continue;

      if (e.tier === 3) {
        // Already smashed this launch → plough straight past it (never double-bounce
        // the same hexagon). The just-struck one is pushed to hitList below, so this
        // also blocks an instant re-bounce on the very next frame.
        if (c.hitList.indexOf(e) >= 0) continue;
        if (e.hasShield) {
          this._breakShield(e);
        } else {
          e.hp -= C.CORE_BRUISER_DMG;
          if (e.hp <= 0) this._killEnemy(i, { core: true });
          else this._explode(e.x, e.y, [255, 140, 40], 10);
        }
        c.hitList.push(e);                        // mark struck — avoid ever re-hitting it
        this._coreBounce(c);

        // Redirect toward the UN-HIT bruiser FARTHEST from the one just struck (max
        // travel), strictly within the field of view. If none is strictly on-screen,
        // fall back to the farthest un-hit within the wider detection range. With no
        // un-hit bruiser left, fizzle — it won't circle back to re-smash an old one.
        var nxt = this._corePickTarget(c, { farFrom: { x: e.x, y: e.y }, excludeList: c.hitList, margin: 0 });
        if (!nxt) nxt = this._corePickTarget(c, { farFrom: { x: e.x, y: e.y }, excludeList: c.hitList, margin: C.CORE_DETECT_MARGIN });
        c.target = nxt;
        if (nxt) {
          c.fizzle = false; c.fizzleT = 0;
          var ndx = nxt.x - c.x, ndy = nxt.y - c.y, nd = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
          c.vx = (ndx / nd) * C.CORE_LAUNCH_SPEED;
          c.vy = (ndy / nd) * C.CORE_LAUNCH_SPEED;
        } else {
          c.fizzle = true; c.fizzleT = 0;
        }
        return;   // one ricochet per frame
      } else {
        this._killEnemy(i, { core: true });   // crush lesser enemies (plough through)
      }
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
    if (c.bounces === C.CORE_MAX_BOUNCES - 1) this.cameras.main.flash(120, 255, 120, 40);
  };

  /* The big finale: blast the area, bank the whole rampage as ONE popup, retire. */
  M._detonateCore = function (c) {
    var x = c.x, y = c.y;
    var R = C.CORE_EXP_RADIUS, R2 = R * R;

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (e._snIntangible) continue;   // cloaked sniper — immune to the core's blast
      var dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy >= R2) continue;
      if (e.tier === 3 && e.hasShield) { this._breakShield(e); continue; }
      this._killEnemy(i, { core: true });
    }

    // Bank the entire run (crush + blast) into a single dedicated big-score popup.
    if (this._coreScoreAccum > 0) this._floatScoreBig('NOYAU', this._coreScoreAccum);
    this._coreScoreAccum = 0;

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
    if (this._snake && !this._snake.dead) this._damageSnakeAoe(x, y, R, C.SNAKE_AOE_DMG);

    this._clearCore(true);
    this._rollCoreNextDelay();
  };

  /* Unused for too long → it destabilises and pops with a small flourish. */
  M._witherCore = function () {
    var c = this._core;
    if (!c) return;
    this._explode(c.x, c.y, [255, 150, 40],  22);
    this._explode(c.x, c.y, [120, 220, 255], 12);
    this._spawnWaveRing(c.x, c.y, { maxRadius: 135, color: HOT, expandTime: 0.40 });
    this._clearCore(true);
    this._rollCoreNextDelay();
  };

  /* ================================================================
     RENDER — one shared ADD layer; view-culled.
     ================================================================ */
  M._renderCore = function (dt) {
    var g = this._coreGfx;
    if (!g) return;
    g.clear();
    var c = this._core;
    if (!c) return;

    // Cull when the whole core (+ its field) is off-screen.
    var view = this.cameras.main.worldView;
    var pad  = C.CORE_FIELD_RADIUS + 90;
    if (c.x < view.x - pad || c.x > view.right + pad ||
        c.y < view.y - pad || c.y > view.bottom + pad) return;

    if (c.phase === 'LAUNCHED') this._renderCoreLaunched(g, c);
    else                        this._renderCoreDormant(g, c);
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

    // Wither strobe in the final stretch (unstable, about to blow).
    var A = 1;
    if (c.age > C.CORE_LIFETIME - C.CORE_WITHER_WARN) {
      var w = Math.max(0, 1 - (c.age - (C.CORE_LIFETIME - C.CORE_WITHER_WARN)) / C.CORE_WITHER_WARN);
      var flick = (Math.sin(gt * 40) > -0.3) ? 1 : 0.35;
      A = (0.3 + 0.7 * w) * flick;
    }

    var x = c.x, y = c.y, fr = C.CORE_FIELD_RADIUS;

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

    // ---- The geometric sphere ----
    this._drawCoreSphere(g, x, y, C.CORE_RADIUS, c.spin, pulse, A);

    // ---- Instability arc, flickering inside the body ----
    if (Math.random() < 0.5) {
      var r  = C.CORE_RADIUS;
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
    var gt = this.gameTime, r = C.CORE_RADIUS;
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
    var armed = c.bounces >= C.CORE_MAX_BOUNCES - 1;     // last bounce: about to detonate
    var pulse = 0.6 + 0.4 * Math.sin(gt * (tw ? 5 : (armed ? 28 : 14)));   // slow, breathing pulse under TW
    g.fillStyle(HOT, 0.18); g.fillCircle(c.x, c.y, r * 1.5 * (0.9 + 0.1 * pulse));
    this._drawCoreSphere(g, c.x, c.y, r, c.spin, pulse, 1);
    g.fillStyle(WHITE, 0.5 * pulse); g.fillCircle(c.x, c.y, r * 0.3 * pulse);

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
    var n = C.CORE_MAX_BOUNCES;
    for (var b = 0; b < n; b++) {
      var pa = -Math.PI / 2 + (b / n) * TAU;
      var px = c.x + Math.cos(pa) * (r + 14), py = c.y + Math.sin(pa) * (r + 14);
      var used = b < c.bounces;
      g.fillStyle(used ? 0x442211 : (tw ? TW_GOLD2 : HOTCORE), used ? 0.4 : 0.95);
      g.fillCircle(px, py, 3);
    }
  };

})();
