/* ==========================================================================
   Light Again — The Signal Amplifier (Amplificateur de Signal) : the GREED trial

   A large square "tech platform" is etched on the ground in the Digital-Tree /
   Cyber-Fairy MINT palette — a kindred, luminous green plate that reads as a
   distinct cousin of the violet glitch Cache circle. It is pure avarice bait:

     • STAND ON IT → your per-kill score is ×2 (a pulsing green "X2" lights up
       next to the score at the top of the screen).
     • THE CATCH → the plate is a BEACON. The longer you hold position, the more
       aggressively it floods enemies into a tight band AROUND its edges (never
       inside). Held-time ramps the spawn rate from a trickle to a torrent.

   It's the test of greed (King-of-the-Hill): how long can you milk the doubled
   score before the swarm becomes impossible to repel and you must flee the plate?

     1. SPAWN    — gated behind a FULLY-MAXED loadout (every Lv3 upgrade, The
                   World aside — i.e. an empty upgrade pool), then paced + placed
                   a deliberate walk from the player, fully in-bounds, clear of the
                   other map features. NO guidance arrow (a big glowing plate is
                   its own beacon). MAY coexist with the Cache Zone (kept apart).
     2. IDLE     — the plate breathes; if never stepped on it dissolves after
                   GREED_IDLE_LIFE.
     3. ACTIVE   — entered at least once. While you stand inside: ×2 score + the
                   beacon escalates (heldT climbs). Step off and heldT bleeds back
                   down; stay away past GREED_ABANDON_GRACE and it powers down to
                   IDLE. A hard GREED_MAX_LIFE cap means even a held plate
                   eventually leaves.
     4. DISSOLVE — a quiet mint fade-out (this event has no "reward orb"; the
                   payoff was the score you banked while standing on it).

   Bosses are NEVER beacon targets in any special way — the beacon just uses the
   normal spawner (_spawnTierAt), so it only ever adds regular enemies. The
   Anomaly is the one hard interrupt: its quarantine confines the player, so a
   live plate is blown away the instant the barrier slams (mirrors the Cache Zone
   / Data Highways), and the spawn gate already blocks new ones during the fight.

   Self-contained on this._greed (plain data) + two shared ADD graphics layers
   (depth 7 ground plate/grid/border; depth 28 amplifier glyph + broadcast rings).
   The beacon + ×2 run on SCALED world time so The World / hitstop pause them (no
   cheesing a frozen board); animations tick on real dt so they stay smooth.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  // Ground-fill opacity (visual tuning).
  var FILL_BASE   = 0.10;    // base plate tint, always
  var FILL_INSIDE = 0.14;    // EXTRA tint added (eased) while you're standing on it

  function smooth(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initGreedZone = function () {
    this._greed            = null;
    this._greedActive      = false;   // read by combat.js — true while you stand on a live plate (not during TW)
    this._greedSpawnT      = 0;
    this._greedNextDelay   = C.GREED_SPAWN_MIN_DELAY;
    this._greedTrappedPrev = false;   // anomaly-barrier edge detection

    // Ground layer (under enemies/player) — the etched plate, grid, border.
    this._greedGfx = this.add.graphics();
    this._greedGfx.setDepth(7);
    this._greedGfx.setBlendMode(Phaser.BlendModes.ADD);

    // Top layer (above enemies, under the player arrow) — the central amplifier
    // glyph + the outward "broadcast" signal rings.
    this._greedTopGfx = this.add.graphics();
    this._greedTopGfx.setDepth(28);
    this._greedTopGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop the live plate (graphics persist — just cleared) and lift the ×2. */
  M._clearGreedZone = function () {
    this._greed = null;
    this._greedActive = false;
    if (this._greedGfx)    this._greedGfx.clear();
    if (this._greedTopGfx) this._greedTopGfx.clear();
  };

  /* ================================================================
     SPAWN GATE — gated behind a fully-maxed loadout; never during
     curated / confined states.
     ================================================================ */
  // The defining gate: the platform only appears once EVERY normal upgrade is at
  // Lv3 (The World aside). The draft pool empties exactly when that happens, so an
  // empty pool == "fully maxed". Beyond that, block NEW spawns during the same
  // curated / confined states as the Cache Zone (a live one still ticks). The
  // bosses are FAIR GAME — a plate may coexist with them.
  M._greedGateMet = function () {
    return !!(this._upgradePool && this._upgradePool.length === 0);
  };

  M._greedSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomaly || this._anomalyBarrierActive ||
              this._anomalyIntroActive || this._twActive || !this.p || this.p.state === 'DEAD');
  };

  M._maybeSpawnGreedZone = function (dt) {
    if (this._greed) return;
    if (!this._greedGateMet()) { this._greedSpawnT = 0; return; }   // not maxed yet → hold the timer at 0
    this._greedSpawnT += dt * 1000;
    if (this._greedSpawnT < this._greedNextDelay) return;
    this._greedSpawnT = 0;
    this._greedNextDelay = C.GREED_SPAWN_INTERVAL_MIN +
      Math.random() * (C.GREED_SPAWN_INTERVAL_MAX - C.GREED_SPAWN_INTERVAL_MIN);
    this._spawnGreedZone({});
  };

  /* Place the plate a deliberate walk from the player, fully in-bounds, and clear
     of the other map features (the Cache Zone included — they may coexist but must
     never overlap). Re-roll a few times; if no clear spot is found this cycle, skip
     (the paced timer tries again later). opts.near = debug drop just outside. */
  M._spawnGreedZone = function (opts) {
    opts = opts || {};
    if (this._greed) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var H = C.GREED_HALF;
    var inset = H + 60;                            // keep the WHOLE plate in-bounds (disc backstop)
    // Per-feature minimum centre separation². The Cache Zone is the notable one
    // (two big KotH zones must never overlap → radius-sum). The rest just keep the
    // map events from crowding. Some features may be absent (parallel) → guarded.
    var cacheSep = Math.max(C.MAP_FEATURE_MIN_SEP, H + (this._cache ? this._cache.zoneR : C.CACHE_ZONE_R) + 60);
    var fountSep = Math.max(C.MAP_FEATURE_MIN_SEP, H + C.CURSE_FOUNT_ZONE_R);
    var genSep2  = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var avoid = [
      [this._cache, cacheSep * cacheSep],
      [this._fount, fountSep * fountSep],
      [this._tree,  genSep2],
      [this._core,  genSep2],
    ];

    var dMin = opts.near ? (H + 130) : C.GREED_SPAWN_DIST_MIN;
    var dMax = opts.near ? (H + 130) : C.GREED_SPAWN_DIST_MAX;
    var x, y, tries = 0, ok = false;
    do {
      var ang  = Math.random() * TAU;
      var dist = dMin + Math.random() * (dMax - dMin);
      var gzc = LA.clampDisc(this.p.x + Math.cos(ang) * dist, this.p.y + Math.sin(ang) * dist, inset);
      x = gzc.x; y = gzc.y;
      ok = true;
      for (var ai = 0; ai < avoid.length; ai++) {
        var av = avoid[ai][0];
        if (av && (x - av.x) * (x - av.x) + (y - av.y) * (y - av.y) < avoid[ai][1]) { ok = false; break; }
      }
      tries++;
    } while (!ok && tries < 24);
    if (!ok) return;                                // blocked this cycle → try again later

    this._greed = {
      x: x, y: y,
      phase: 'IDLE',
      half: H,
      age: 0,             // ms alive (real time)
      idleT: 0,           // ms spent un-entered (idle-life timeout)
      abandonT: 0,        // ms away after first entering (ACTIVE → IDLE power-down)
      entered: false,     // has been stepped on at least once
      inside: false,      // player inside this frame
      insideGlow: 0,      // eased 0→1 "you're standing on it" brighten
      heldT: 0,           // cumulative SECONDS held (beacon ramp); bleeds down while off
      beaconT: 0,         // ms accumulator for beacon spawns
      seed: Math.random() * 1000,
      swirl: Math.random() * TAU,
      pulse: 0,
      sig: [],            // outward broadcast square-rings
      sigT: 0,
      dissolveT: 0,
    };

    // Rise FX — a green tech plate snaps up out of the floor.
    this._spawnWaveRing(x, y, { maxRadius: H * 1.0,  color: C.GREED_TINT,  expandTime: 0.5 });
    this._spawnWaveRing(x, y, { maxRadius: 140,      color: C.GREED_FRUIT, expandTime: 0.32 });
    this._explode(x, y, C.GREED_TINT_ARR, 24);
    this._explode(x, y, [230, 255, 244], 10);
  };

  /* ================================================================
     UPDATE — anomaly edge-detection, spawn gate, then tick the live one.
     dt = real seconds (animations/lifecycle); ms = SCALED world ms (beacon timing
     + ×2 gating, so The World / hitstop pause progress). Both from scene.update.
     ================================================================ */
  M._updateGreedZone = function (dt, ms) {
    // The Anomaly traps the player in its quarantine — blow a live plate off the
    // board the instant the barrier slams (rising edge). New spawns are already
    // suspended for the whole anomaly fight by _greedSpawnSuspended.
    var trapped = !!(this._anomalyBarrierActive || this._anomalyIntroActive);
    if (trapped && !this._greedTrappedPrev && this._greed) this._dismissGreedForAnomaly();
    this._greedTrappedPrev = trapped;

    if (!this._greed) {
      this._greedActive = false;
      if (!this._greedSpawnSuspended()) this._maybeSpawnGreedZone(dt);
      return;
    }
    this._tickGreedZone(dt, ms);
  };

  /* The anomaly just confined the player → scatter the live plate away. */
  M._dismissGreedForAnomaly = function () {
    var f = this._greed;
    if (!f) return;
    this._spawnWaveRing(f.x, f.y, { maxRadius: f.half, color: C.GREED_TINT, expandTime: 0.4 });
    this._explode(f.x, f.y, C.GREED_TINT_ARR, 16);
    this._clearGreedZone();
  };

  /* ================================================================
     TICK — state machine + beacon + broadcast rings, then render
     ================================================================ */
  M._tickGreedZone = function (dt, ms) {
    var f = this._greed, p = this.p, rms = dt * 1000;
    // The World: the plate is dormant — FREEZE animation so nothing reads as "live".
    var aDt = this._twActive ? 0 : dt;
    f.age   += rms;
    f.swirl += aDt;
    f.pulse += aDt;

    // Inside test (square / Chebyshev — it's a plate, not a circle).
    var inside = false;
    if (p && p.state !== 'DEAD') {
      inside = Math.abs(p.x - f.x) <= f.half && Math.abs(p.y - f.y) <= f.half;
    }
    f.inside = inside;
    f.insideGlow += ((inside ? 1 : 0) - f.insideGlow) * Math.min(1, dt * 8);

    // The ×2 is live only while you actually stand on an ACTIVE/IDLE plate and The
    // World isn't freezing the board. (IDLE counts too — stepping on it for the
    // first time should immediately double your score AND wake the beacon.)
    var doublingNow = inside && !this._twActive && f.phase !== 'DISSOLVE';
    this._greedActive = doublingNow;

    if (f.phase === 'IDLE') {
      f.idleT += rms;
      if (inside && !this._twActive) this._greedActivate();
      else if (f.idleT >= C.GREED_IDLE_LIFE) this._greedDissolve();
    } else if (f.phase === 'ACTIVE') {
      // The World freezes the plate entirely: no ×2 (already gated above), no
      // beacon, and the abandon timer pauses (you can't be "abandoning" frozen time).
      if (!this._twActive) {
        if (inside) {
          f.abandonT = 0;
          // heldT climbs on SCALED world time → the beacon ramp respects hitstop.
          f.heldT += ms / 1000;
          this._greedBeaconTick(ms);
        } else {
          // Off the plate: heldT bleeds down (re-entering doesn't snap to max), and
          // the abandon grace counts toward powering down.
          f.heldT = Math.max(0, f.heldT - dt * C.GREED_HELD_DECAY);
          f.abandonT += rms;
          if (f.abandonT >= C.GREED_ABANDON_GRACE) { this._greedRevertToIdle(); return; }
        }
        // Hard cap: even a perfectly-held plate eventually leaves.
        if (f.age >= C.GREED_MAX_LIFE) { this._greedDissolve(); return; }
      }
    } else if (f.phase === 'DISSOLVE') {
      f.dissolveT += rms;
      if (f.dissolveT >= C.GREED_DISSOLVE_DUR) { this._clearGreedZone(); return; }
    }

    this._greedTickSignals(this._twActive ? 0 : dt);
    this._renderGreedZone(dt);
  };

  /* IDLE → ACTIVE : you stepped on the plate for the first time. */
  M._greedActivate = function () {
    var f = this._greed;
    if (!f || f.phase !== 'IDLE') return;
    f.phase = 'ACTIVE';
    f.entered = true;
    f.abandonT = 0;
    this._spawnWaveRing(f.x, f.y, { maxRadius: f.half, color: C.GREED_FRUIT, expandTime: 0.4 });
    this._explode(f.x, f.y, C.GREED_TINT_ARR, 16);
    this.cameras.main.flash(160, 40, 200, 120);
    this._floatLabel(f.x, f.y - f.half * 0.42, LA.laGoT('laGreedEnter'), '#66ffcc');
  };

  /* ACTIVE abandoned (player stayed off the plate past the grace) → power down. */
  M._greedRevertToIdle = function () {
    var f = this._greed;
    if (!f) return;
    f.phase = 'IDLE';
    f.idleT = 0; f.abandonT = 0; f.heldT = 0; f.beaconT = 0;
    this._explode(f.x, f.y, C.GREED_TINT_ARR, 8);
    this._floatLabel(f.x, f.y - f.half * 0.42, LA.laGoT('laGreedLeave'), '#3a8f6f');
  };

  /* IDLE timed out un-entered, hit its hard cap, or got dismissed → quiet fade. */
  M._greedDissolve = function () {
    var f = this._greed;
    if (!f) return;
    this._greedActive = false;
    this._explode(f.x, f.y, C.GREED_TINT_ARR, 12);
    f.phase = 'DISSOLVE'; f.dissolveT = 0;
  };

  /* ================================================================
     BEACON — flood enemies into a band AROUND the plate (never inside).
     Rate ramps with cumulative held-time: a trickle at first, a torrent late.
     ================================================================ */
  M._greedBeaconTick = function (ms) {
    var f = this._greed;
    if (this.enemies && this.enemies.length >= C.MAX_ENEMIES) return;
    var ramp = Math.min(1, f.heldT * 1000 / C.GREED_BEACON_RAMP);
    var interval = lerp(C.GREED_BEACON_INTERVAL_MAX, C.GREED_BEACON_INTERVAL_MIN, ramp);
    f.beaconT += ms;
    var guard = 0;
    while (f.beaconT >= interval && guard++ < 24) {
      f.beaconT -= interval;
      // Burst size grows with the ramp (1 → GREED_BEACON_BURST_MAX).
      var burst = 1 + Math.floor(ramp * (C.GREED_BEACON_BURST_MAX - 1) + Math.random() * 0.5);
      for (var b = 0; b < burst; b++) {
        if (this.enemies.length >= C.MAX_ENEMIES) break;
        this._greedBeaconSpawnOne();
      }
    }
  };

  /* One enemy in the band just OUTSIDE the square edge (Chebyshev projection so it
     hugs the plate's rim on whichever side the random angle points), drawn from the
     normal rarity bag and spawned with the standard tier VFX. */
  M._greedBeaconSpawnOne = function () {
    var f = this._greed;
    var ang = Math.random() * TAU;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var m  = Math.max(Math.abs(ca), Math.abs(sa)) || 1;         // project onto the unit square edge
    var reach = f.half + C.GREED_BEACON_BAND + Math.random() * C.GREED_BEACON_BAND;
    var sx = f.x + (ca / m) * reach;
    var sy = f.y + (sa / m) * reach;
    var c = LA.clampDisc(sx, sy, 60);                           // keep it inside the arena wall
    var tier = this._drawFromBag();
    // Spawn-ring VFX in the GREED mint (not the tier colour) so beacon-spawned
    // enemies visibly "belong" to the platform that summoned them.
    this._spawnTierAt(tier, c.x, c.y, { ringColor: C.GREED_TINT });
  };

  /* Outward "broadcast" square-rings that pulse off the plate edge while a live
     plate is held — the visual telegraph of the beacon (denser as heldT climbs). */
  M._greedTickSignals = function (dt) {
    var f = this._greed;
    var live = (f.phase === 'ACTIVE' && f.inside);
    var ramp = Math.min(1, f.heldT * 1000 / C.GREED_BEACON_RAMP);
    if (live) {
      // Emission cadence ramps hard with intensity (a lazy pulse → a rapid strobe).
      var emitGap = lerp(1.0, 0.20, ramp);                      // seconds between broadcast rings
      f.sigT += dt;
      while (f.sigT >= emitGap && f.sig.length < 8) {
        f.sigT -= emitGap;
        f.sig.push({ r: f.half * 0.86, life: 1 });
      }
    }
    // Ring travel SPEED is the danger read-out: slow crawl at 1 bar, fast burst at
    // 3 bars (wide range so it's unmistakable, like the wifi arcs).
    var grow = lerp(110, 620, ramp);                            // px/s outward
    for (var i = f.sig.length - 1; i >= 0; i--) {
      var s = f.sig[i];
      s.r   += grow * dt;
      s.life -= dt * 0.9;
      if (s.life <= 0) f.sig.splice(i, 1);
    }
  };

  /* ================================================================
     RENDER — ground plate/grid/border (depth 7) + amplifier glyph and
     broadcast rings (depth 28).
     ================================================================ */
  M._renderGreedZone = function (dt) {
    var g = this._greedGfx, tg = this._greedTopGfx;
    if (!g || !tg) return;
    g.clear(); tg.clear();
    var f = this._greed;
    if (!f) return;

    var gt = this.gameTime;
    var x = f.x, y = f.y, H = f.half;
    var hot = 0.6 + 0.4 * Math.sin(gt * 3 + f.seed);

    // The World: drain the mint palette to grey like the frozen board.
    var col   = this._twActive ? this._twGray(C.GREED_TINT)  : C.GREED_TINT;
    var fruit = this._twActive ? this._twGray(C.GREED_FRUIT) : C.GREED_FRUIT;
    var hotc  = this._twActive ? this._twGray(C.GREED_HOT)   : C.GREED_HOT;

    // Alpha / size envelope (dissolve blooms outward + fades).
    var A = 1, Hmul = 1;
    if (f.phase === 'DISSOLVE') {
      var dp = smooth(Math.min(1, f.dissolveT / C.GREED_DISSOLVE_DUR));
      A = 1 - dp;
      Hmul = 1 + 0.22 * dp;
    }
    if (A <= 0.004) return;
    var Hh = H * Hmul;
    var cr = C.GREED_CORNER;

    var ig = f.insideGlow || 0;
    var ramp = Math.min(1, f.heldT * 1000 / C.GREED_BEACON_RAMP);

    // ---- Filled plate ----
    g.fillStyle(col, FILL_BASE * A * (0.7 + 0.3 * hot));
    g.fillRoundedRect(x - Hh, y - Hh, Hh * 2, Hh * 2, cr);
    if (ig > 0.01) {
      g.fillStyle(col, FILL_INSIDE * A * ig);
      g.fillRoundedRect(x - Hh, y - Hh, Hh * 2, Hh * 2, cr);
      g.fillStyle(hotc, 0.05 * A * ig);
      g.fillRoundedRect(x - Hh * 0.92, y - Hh * 0.92, Hh * 1.84, Hh * 1.84, cr);
    }

    // ---- Circuit-board grid (clipped to the square — just draw within bounds) ----
    // Reads the plate as a live tech surface (kin to the Digital Tree's data look).
    var cells = 8;
    var step  = (Hh * 2) / cells;
    g.lineStyle(1, col, 0.06 * A);
    for (var gi = 1; gi < cells; gi++) {
      var gx = x - Hh + gi * step;
      var gy = y - Hh + gi * step;
      g.beginPath(); g.moveTo(gx, y - Hh); g.lineTo(gx, y + Hh); g.strokePath();
      g.beginPath(); g.moveTo(x - Hh, gy); g.lineTo(x + Hh, gy); g.strokePath();
    }
    // Seeded "node" dots at a sparse set of intersections, a few blinking — live
    // circuit traffic. Fixed (seeded) positions, no motion.
    var nodes = 14;
    for (var ni = 0; ni < nodes; ni++) {
      var nix = 1 + Math.floor(((ni * 0.6180339887 + f.seed * 0.013) % 1) * (cells - 1));
      var niy = 1 + Math.floor(((ni * 0.41421356 + f.seed * 0.027) % 1) * (cells - 1));
      var ndx = x - Hh + nix * step, ndy = y - Hh + niy * step;
      var blink = Math.sin(gt * (0.8 + (ni % 3) * 0.4) + f.seed + ni * 1.7) * 0.5 + 0.5;
      var nA = (0.10 + 0.30 * (blink > 0.82 ? 1 : 0)) * A;
      g.fillStyle(blink > 0.82 ? hotc : fruit, nA);
      g.fillCircle(ndx, ndy, blink > 0.82 ? 3 : 2);
    }

    // ---- A bright "readout" line sweeping down the plate while ACTIVE (signal). --
    if (f.phase === 'ACTIVE' && !this._twActive) {
      var sweepY = y - Hh + ((gt * lerp(70, 200, ramp)) % (Hh * 2));
      g.fillStyle(hotc, (0.10 + 0.10 * ramp) * A);
      g.fillRect(x - Hh, sweepY - 1, Hh * 2, 2);
    }

    // ---- Border: soft outer + bright inner stroke, breathing ----
    g.lineStyle(7, col,  0.16 * A * (0.7 + 0.3 * hot));
    g.strokeRoundedRect(x - Hh, y - Hh, Hh * 2, Hh * 2, cr);
    g.lineStyle(2.5, fruit, (0.55 + 0.25 * hot) * A);
    g.strokeRoundedRect(x - Hh, y - Hh, Hh * 2, Hh * 2, cr);

    // ---- Corner "King-of-the-Hill" brackets (L-shapes at each corner) ----
    var bl = Hh * 0.22;                                    // bracket arm length
    var bA = (0.7 + 0.3 * hot) * A;
    g.lineStyle(4, hotc, bA);
    var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (var ci = 0; ci < 4; ci++) {
      var sx2 = x + corners[ci][0] * Hh, sy2 = y + corners[ci][1] * Hh;
      g.beginPath();
      g.moveTo(sx2 - corners[ci][0] * bl, sy2);
      g.lineTo(sx2, sy2);
      g.lineTo(sx2, sy2 - corners[ci][1] * bl);
      g.strokePath();
    }

    // ---- Outward broadcast square-rings (top layer) — the beacon telegraph ----
    for (var si = 0; si < f.sig.length; si++) {
      var s = f.sig[si];
      var sA = s.life * 0.5 * A;
      var sr = s.r;
      tg.lineStyle(2, fruit, sA);
      tg.strokeRoundedRect(x - sr, y - sr, sr * 2, sr * 2, cr + (sr - Hh) * 0.5);
    }

    // ---- Central amplifier glyph: a "broadcast" wifi-style fan of arcs + node ----
    // Bars only show while you actually stand on a live plate (= the ×2 is on).
    var barsLive = !!this._greedActive;
    this._renderGreedGlyph(x, y, Hh, A, gt, hot, ramp, col, fruit, hotc, barsLive);
  };

  /* The amplifier motif at the plate centre: a node (small diamond) under a stack
     of "wifi" broadcast arcs. The arcs double as the DANGER GAUGE — the number of
     lit bars maps to the beacon intensity (1 bar when you first step on, climbing
     to 3 as held-time ramps), so a glance tells you how hot the spawn rate is. The
     bars are drawn ONLY while you stand on a live plate (`live`); off the plate the
     glyph is just the node + halo (no signal). */
  M._renderGreedGlyph = function (cx, cy, Hh, A, gt, hot, ramp, col, fruit, hotc, live) {
    var tg = this._greedTopGfx;
    var br = Hh * 0.16;                                    // base glyph radius
    var breathe = 1 + 0.05 * Math.sin(gt * 4);
    var baseY = cy + br * 0.22;                            // fan / node anchor

    // Soft halo for readability over the grid.
    tg.fillStyle(col, A * 0.10);
    tg.fillCircle(cx, cy, br * 1.5);

    // Broadcast "wifi" bars = the danger gauge. barsF in [1,3]; full bars are solid
    // and the next one FADES IN with the fractional ramp so the climb reads smoothly.
    if (live) {
      var barsF    = 1 + ramp * 2;                        // 1.0 → 3.0
      var fullBars = Math.min(3, Math.floor(barsF));
      var partial  = Math.min(1, barsF - Math.floor(barsF));
      var wave     = (gt * (1.4 + ramp * 1.8)) % 1;       // travelling shimmer across the bars
      for (var a = 0; a < 3; a++) {
        var present = (a < fullBars) ? 1 : (a === fullBars ? partial : 0);
        if (present <= 0.02) continue;
        var ar  = br * (0.62 + a * 0.52) * breathe;
        var lit = 1 - Math.min(1, Math.abs((a / 2) - wave) * 2.2);   // brightest where the shimmer is
        var aA  = (0.34 + 0.50 * lit) * present * A;       // min 0.34 → every present bar clearly visible
        tg.lineStyle(3.4, lit > 0.5 ? hotc : fruit, aA);
        tg.beginPath(); tg.arc(cx, baseY, ar, -Math.PI * 0.82, -Math.PI * 0.18, false); tg.strokePath();
      }
    }

    // The amplified node (a small bright diamond) at the base of the fan.
    var nr = br * (0.18 + 0.06 * Math.sin(gt * 6)) * (1 + (live ? 0.2 * ramp : 0));
    tg.fillStyle(hotc, (0.7 + 0.3 * hot) * A);
    tg.beginPath();
    tg.moveTo(cx, baseY - nr);
    tg.lineTo(cx + nr, baseY);
    tg.lineTo(cx, baseY + nr);
    tg.lineTo(cx - nr, baseY);
    tg.closePath();
    tg.fillPath();
  };

})();
