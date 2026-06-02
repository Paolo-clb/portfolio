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
                  the core fires off along the impact line like a billiard ball.
     4. BILLIARD— it rockets across the arena, ricocheting off the WALLS and off
                  the chunky tier-3 bruisers (counting each bounce), CRUSHING every
                  lesser enemy it ploughs through. Bosses live outside this.enemies,
                  so it never sees them — it IGNORES bosses entirely.
     5. DETONATE— after CORE_MAX_BOUNCES ricochets (failsafe: CORE_SAFETY_LIFETIME)
                  it explodes in a big blast, and the WHOLE rampage's score lands
                  as one dedicated "NOYAU INSTABLE" big-score popup.

   Self-contained on this._core (plain data) + one shared, persistent ADD
   graphics layer created in scene.create (mirrors the digital-tree / highway
   modules). The dormant lifecycle + render tick on real dt; the launched
   movement/crush ticks on WORLD time (sDt) so it freezes with The World /
   hitstop. Score is banked through _killEnemy's `ctx.core` path into
   this._coreScoreAccum (kept clear of the shared batch so a mid-flight nuke
   can't corrupt it).
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

    var m    = C.WORLD_HALF - C.CORE_FIELD_RADIUS - 40;
    var sep2 = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var avoid = [this._fount, this._tree, this._cache];   // _cache is optional (may not exist)
    var x, y, tries = 0, ok;
    do {
      var ang  = Math.random() * TAU;
      var dist = C.CORE_SPAWN_DIST_MIN + Math.random() * (C.CORE_SPAWN_DIST_MAX - C.CORE_SPAWN_DIST_MIN);
      x = Math.max(-m, Math.min(m, this.p.x + Math.cos(ang) * dist));
      y = Math.max(-m, Math.min(m, this.p.y + Math.sin(ang) * dist));
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

    // LAUNCH: a dash-attack (and only a dash-attack) that bites into the field.
    if (p && p.state === 'DASH_ATTACKING') {
      var dx = c.x - p.x, dy = c.y - p.y;
      var reach = C.CORE_FIELD_RADIUS + C.SIZE * 0.6 + C.CORE_TRIGGER_PAD;
      if (dx * dx + dy * dy < reach * reach) { this._launchCore(c); return; }
    }

    // Destabilise away if left unused for too long (frees the slot, avoids clutter).
    if (c.age >= C.CORE_LIFETIME) this._witherCore();
  };

  /* Dash-attack connected → the field bursts and the core fires off as a billiard
     ball along the player→core impact line (billiard physics). */
  M._launchCore = function (c) {
    var p = this.p;
    var dx = c.x - p.x, dy = c.y - p.y;
    var d  = Math.sqrt(dx * dx + dy * dy);
    var nx, ny;
    if (d > 0.1) { nx = dx / d; ny = dy / d; }
    else {                                            // dead-on: fall back to the dash heading
      nx = p.atkDx || Math.cos(p.angle);
      ny = p.atkDy || Math.sin(p.angle);
      var nl = Math.sqrt(nx * nx + ny * ny) || 1; nx /= nl; ny /= nl;
    }

    c.phase    = 'LAUNCHED';
    c.vx       = nx * C.CORE_LAUNCH_SPEED;
    c.vy       = ny * C.CORE_LAUNCH_SPEED;
    c.bounces  = 0;
    c.lifeMs   = 0;
    c.trail    = [];
    c.trailT   = 0;
    this._coreScoreAccum = 0;

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

  /* LAUNCHED: spin + trail on real dt; move/bounce/crush on WORLD time. */
  M._tickCoreLaunched = function (c, dt, sDt) {
    var s60     = sDt * 60;
    var worldMs = sDt * 1000;
    c.spin  += dt * 6;          // spins fast in flight
    c.pulse += dt;

    // Blazing motion trail (fades on real dt so it stays smooth through slow-mo).
    c.trailT += dt * 1000;
    if (c.trailT > 16) {
      c.trailT = 0;
      c.trail.push({ x: c.x, y: c.y, a: 1 });
      if (c.trail.length > 18) c.trail.shift();
    }
    for (var i = 0; i < c.trail.length; i++) c.trail[i].a -= dt * 2.4;

    // Everything below is WORLD-time only — a launched core freezes with The World
    // / hitstop, and (crucially) NEVER detonates while frozen, so a core crush can
    // never run through _killEnemy's Time-Stop deferral path.
    if (s60 <= 0.0001) return;

    c.lifeMs += worldMs;
    c.x += c.vx * s60;
    c.y += c.vy * s60;

    // ---- Wall ricochets (billiard) ----
    var lim = C.WORLD_HALF - C.CORE_RADIUS;
    var bounced = false;
    if (c.x < -lim)      { c.x = -lim; c.vx =  Math.abs(c.vx); bounced = true; }
    else if (c.x >  lim) { c.x =  lim; c.vx = -Math.abs(c.vx); bounced = true; }
    if (c.y < -lim)      { c.y = -lim; c.vy =  Math.abs(c.vy); bounced = true; }
    else if (c.y >  lim) { c.y =  lim; c.vy = -Math.abs(c.vy); bounced = true; }
    if (bounced) this._coreBounce(c, false);

    // ---- Crush lesser enemies / ricochet off bruisers ----
    this._coreCrush(c);

    // ---- Flying embers ----
    if (Math.random() < 0.6) this._explode(c.x - c.vx * 0.3, c.y - c.vy * 0.3, [255, 140, 40], 3);

    // ---- End of the ride ----
    if (c.bounces >= C.CORE_MAX_BOUNCES || c.lifeMs >= C.CORE_SAFETY_LIFETIME) this._detonateCore(c);
  };

  /* Crush everything the core overlaps this frame. Tier 1/2 are ploughed through
     (killed, no deflection). Tier-3 bruisers are "solid" — the core ricochets off
     them (counting a bounce) and chips/breaks them, billiard-style. Bosses aren't
     in this.enemies, so they're never touched. */
  M._coreCrush = function (c) {
    var enemies = this.enemies, cr = C.CORE_RADIUS;
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;   // still materialising → leave it
      var dx = e.x - c.x, dy = e.y - c.y;
      var rr = cr + e.size * 0.5 + C.CORE_CRUSH_PAD;
      if (dx * dx + dy * dy >= rr * rr) continue;

      if (e.tier === 3) {
        if (e.hasShield) {
          this._breakShield(e);
        } else {
          e.hp -= C.CORE_BRUISER_DMG;
          if (e.hp <= 0) { this._killEnemy(i, { core: true }); continue; }
          this._explode(e.x, e.y, [255, 140, 40], 10);
        }
        // Billiard ricochet off the surviving bruiser, then nudge clear so the
        // core can't re-collide with it on the very next frame.
        var d  = Math.sqrt(dx * dx + dy * dy) || 1;
        var Nx = -dx / d, Ny = -dy / d;                  // surface normal (bruiser → core)
        var vdotn = c.vx * Nx + c.vy * Ny;
        if (vdotn < 0) { c.vx -= 2 * vdotn * Nx; c.vy -= 2 * vdotn * Ny; }
        var pen = rr - d;
        if (pen > 0) { c.x += Nx * (pen + 2); c.y += Ny * (pen + 2); }
        this._coreBounce(c, true);
      } else {
        this._killEnemy(i, { core: true });
      }
    }
  };

  /* A ricochet: tick the counter + a punchy impact flash. */
  M._coreBounce = function (c, offEnemy) {
    c.bounces++;
    this._spawnWaveRing(c.x, c.y, { maxRadius: offEnemy ? 150 : 175, color: HOT, expandTime: 0.30 });
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

    // ---- Blazing motion trail (oldest → newest) ----
    for (var i = 0; i < c.trail.length; i++) {
      var tr = c.trail[i];
      if (tr.a <= 0) continue;
      var rr = (i / c.trail.length) * r * 0.9;
      g.fillStyle(HOT,   tr.a * 0.20); g.fillCircle(tr.x, tr.y, rr);
      g.fillStyle(EMBER, tr.a * 0.28); g.fillCircle(tr.x, tr.y, rr * 0.6);
    }

    // ---- Raging plasma ball (no containment field — it burst on launch) ----
    var armed = c.bounces >= C.CORE_MAX_BOUNCES - 1;     // last bounce: about to detonate
    var pulse = 0.6 + 0.4 * Math.sin(gt * (armed ? 28 : 14));
    g.fillStyle(HOT, 0.18); g.fillCircle(c.x, c.y, r * 1.5 * (0.9 + 0.1 * pulse));
    this._drawCoreSphere(g, c.x, c.y, r, c.spin, pulse, 1);
    g.fillStyle(WHITE, 0.5 * pulse); g.fillCircle(c.x, c.y, r * 0.3 * pulse);

    // ---- Remaining-bounce pips around the ball (clear feedback) ----
    var n = C.CORE_MAX_BOUNCES;
    for (var b = 0; b < n; b++) {
      var pa = -Math.PI / 2 + (b / n) * TAU;
      var px = c.x + Math.cos(pa) * (r + 14), py = c.y + Math.sin(pa) * (r + 14);
      var used = b < c.bounces;
      g.fillStyle(used ? 0x442211 : HOTCORE, used ? 0.4 : 0.95);
      g.fillCircle(px, py, 3);
    }
  };

})();
