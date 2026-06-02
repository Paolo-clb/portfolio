/* ==========================================================================
   Light Again — The Cache Zone (Zone de Cache) : a risk/reward King-of-the-Hill

   A big "glitched" violet circle is etched on the ground, a download glyph
   pulsing at its heart. It is bait: step inside and a 15 s data-heist begins
   (a gauge fills). The TWIST — while the hack runs, every regular enemy that
   enters the circle goes into a RAGE: rushers move faster, shooters fire
   faster, generators spawn more (each wearing an angry aura). Hold the hill
   to 100 % and the cache DETONATES, ejecting a huge 20 s OVERDRIVE bonus in
   its centre (with a little guidance chevron toward it).

     1. SPAWN    — paced + gated, one at a time, a deliberate walk from the
                   player. NO guidance arrow (a big glowing circle is its own
                   beacon). MUTUALLY EXCLUSIVE with the Curse Fountain: a zone
                   never overlaps a live fountain, and the fountain never spawns
                   inside a live zone (see _spawnCacheZone / _spawnCurseFount).
     2. IDLE     — the glitch circle breathes; if never entered it quietly
                   dissolves after CACHE_IDLE_LIFE.
     3. HACK     — entered → the gauge fills while you stand inside (decays while
                   you're out). Enemies inside rage. Abandon it (gauge back to 0
                   and you stay away) and it powers back down to IDLE.
     4. SUCCESS  — gauge full → detonation + the Overdrive reward orb + dissolve.

   Bosses are NEVER boosted (they live OUTSIDE this.enemies, so the rage sweep
   can't reach them) and a zone may coexist with the Giga Bruiser / Mirror /
   Serpent. The Anomaly is the one exception: its quarantine confines the player,
   so a live zone is blown away the instant the barrier slams (mirrors the Data
   Highways), and no new zone spawns for the whole anomaly fight.

   Self-contained on this._cache (plain data) + two shared ADD graphics layers
   (depth 7 ground ring/fill/gauge, depth 28 download icon + enemy rage auras).
   The gauge fills on SCALED world time (so The World / hitstop pause it — no
   cheesing a frozen board); animations tick on real dt so they stay smooth.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  var COL_RED  = 0xff2a44;   // rage / "you left the zone" telegraph
  var COL_RB   = 0xff3a6a;   // glitch chromatic-aberration red channel
  var COL_CB   = 0x36e0ff;   // glitch chromatic-aberration cyan channel
  var COL_HOT  = 0xffffff;

  function smooth(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initCacheZone = function () {
    this._cache            = null;
    this._cacheSpawnT      = 0;
    this._cacheNextDelay   = C.CACHE_SPAWN_MIN_DELAY;   // wait before the very first one
    this._cacheTrappedPrev = false;                     // anomaly-barrier edge detection

    // Ground layer (under enemies/player) — the etched circle, fill, glitch, gauge.
    this._cacheGfx = this.add.graphics();
    this._cacheGfx.setDepth(7);
    this._cacheGfx.setBlendMode(Phaser.BlendModes.ADD);

    // Top layer (above enemies, under the player arrow) — the floating download
    // glyph + the per-enemy rage auras, so both always read clearly.
    this._cacheTopGfx = this.add.graphics();
    this._cacheTopGfx.setDepth(28);
    this._cacheTopGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop the live zone (graphics persist — just cleared) and lift any rage. */
  M._clearCacheZone = function (silent) {
    this._clearCacheRage();
    this._cache = null;
    if (this._cacheGfx)    this._cacheGfx.clear();
    if (this._cacheTopGfx) this._cacheTopGfx.clear();
  };

  /* Lift the rage from every enemy (called whenever a hack ends or the zone goes). */
  M._clearCacheRage = function () {
    var en = this.enemies;
    if (!en) return;
    for (var i = 0; i < en.length; i++) { en[i]._cacheRage = false; en[i]._cacheRageT = 0; }
  };

  /* ================================================================
     SPAWN GATE — paced; never during curated / confined states
     ================================================================ */
  // Block NEW spawns (a live one still ticks) during: the tutorial, the upgrade
  // slow-mo / draft, the Anomaly quarantine (it confines the player), and The
  // World (don't pop terrain into frozen time). The other bosses are FAIR GAME —
  // a cache zone may coexist with them (it just never boosts them).
  M._cacheSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomaly || this._anomalyBarrierActive ||
              this._anomalyIntroActive || this._twActive || !this.p || this.p.state === 'DEAD');
  };

  M._maybeSpawnCacheZone = function (dt) {
    if (this._cache) return;
    this._cacheSpawnT += dt * 1000;
    if (this._cacheSpawnT < this._cacheNextDelay) return;
    this._cacheSpawnT = 0;
    this._cacheNextDelay = C.CACHE_SPAWN_INTERVAL_MIN +
      Math.random() * (C.CACHE_SPAWN_INTERVAL_MAX - C.CACHE_SPAWN_INTERVAL_MIN);
    this._spawnCacheZone({});
  };

  /* Place the zone a deliberate walk from the player, fully inside the map, and
     CLEAR of a live Curse Fountain (hard requirement — their circles must never
     overlap) and a live Digital Tree (polish). Re-roll a few times; if no clear
     spot is found this cycle, skip (the paced timer tries again later). */
  M._spawnCacheZone = function (opts) {
    opts = opts || {};
    if (this._cache) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var R = C.CACHE_ZONE_R;
    var m = C.WORLD_HALF - R - 40;                 // keep the WHOLE circle in-bounds
    // Per-feature minimum centre distance². The Curse Fountain is the HARD
    // requirement (their circles must NEVER overlap → radius-sum, floored at the
    // generic crowding gap); the Digital Tree / Unstable Core just keep the map
    // events from crowding. _core may be absent (a parallel feature) → guarded.
    var fountSep = Math.max(C.MAP_FEATURE_MIN_SEP, R + C.CURSE_FOUNT_ZONE_R);
    var genSep2  = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var avoid = [
      [this._fount, fountSep * fountSep],
      [this._tree,  genSep2],
      [this._core,  genSep2],
    ];

    var dMin = opts.near ? 360 : C.CACHE_SPAWN_DIST_MIN;
    var dMax = opts.near ? 360 : C.CACHE_SPAWN_DIST_MAX;
    var x, y, tries = 0, ok = false;
    do {
      var ang  = Math.random() * TAU;
      var dist = dMin + Math.random() * (dMax - dMin);
      x = Math.max(-m, Math.min(m, this.p.x + Math.cos(ang) * dist));
      y = Math.max(-m, Math.min(m, this.p.y + Math.sin(ang) * dist));
      ok = true;
      for (var ai = 0; ai < avoid.length; ai++) {
        var av = avoid[ai][0];
        if (av && (x - av.x) * (x - av.x) + (y - av.y) * (y - av.y) < avoid[ai][1]) { ok = false; break; }
      }
      tries++;
    } while (!ok && tries < 24);
    if (!ok) return;                                // blocked (a feature is out) → try again later

    this._cache = {
      x: x, y: y,
      phase: 'IDLE',
      zoneR: R,
      prog: 0,            // 0→1 hack gauge
      age: 0,             // ms alive (real time)
      idleT: 0,           // ms spent un-entered (idle-life timeout)
      abandonT: 0,        // ms at 0 % while away (HACK → IDLE power-down)
      inside: false,      // player inside this frame (render telegraph)
      success: false,
      seed: Math.random() * 1000,
      swirl: Math.random() * TAU,
      dlBob: 0,           // download-glyph animation phase
      glitchT: 0, glitchOx: 0, glitchOy: 0,   // chromatic-aberration jitter
      dissolveT: 0,
      motes: [], moteT: 0,
    };

    // Rise FX — a glitched circle snaps into existence.
    this._spawnWaveRing(x, y, { maxRadius: R * 0.95, color: C.CACHE_TINT, expandTime: 0.5 });
    this._spawnWaveRing(x, y, { maxRadius: 120, color: COL_CB, expandTime: 0.32 });
    this._explode(x, y, C.CACHE_TINT_ARR, 22);
    this._explode(x, y, [120, 220, 255], 10);
  };

  /* ================================================================
     UPDATE — anomaly edge-detection, spawn gate, then tick the live one.
     dt = real seconds (animations/lifecycle); ms = SCALED world ms (gauge fill,
     so The World / hitstop pause progress). Both supplied by scene.update.
     ================================================================ */
  M._updateCacheZone = function (dt, ms) {
    // The Anomaly traps the player in its quarantine — blow a live zone off the
    // board the instant the barrier slams (rising edge). New spawns are already
    // suspended for the whole anomaly fight by _cacheSpawnSuspended.
    var trapped = !!(this._anomalyBarrierActive || this._anomalyIntroActive);
    if (trapped && !this._cacheTrappedPrev && this._cache) this._dismissCacheForAnomaly();
    this._cacheTrappedPrev = trapped;

    if (!this._cache) {
      if (!this._cacheSpawnSuspended()) this._maybeSpawnCacheZone(dt);
      return;
    }
    this._tickCacheZone(dt, ms);
  };

  /* The anomaly just confined the player → scatter the live zone away. */
  M._dismissCacheForAnomaly = function () {
    var f = this._cache;
    if (!f) return;
    this._spawnWaveRing(f.x, f.y, { maxRadius: f.zoneR * 0.9, color: C.CACHE_TINT, expandTime: 0.4 });
    this._explode(f.x, f.y, C.CACHE_TINT_ARR, 16);
    this._clearCacheZone(true);
  };

  /* ================================================================
     TICK — state machine + rage sweep + motes, then render
     ================================================================ */
  M._tickCacheZone = function (dt, ms) {
    var f = this._cache, p = this.p, rms = dt * 1000;
    f.age   += rms;
    f.swirl += dt;
    f.dlBob  = (f.dlBob + dt * (f.phase === 'HACK' ? 1.7 : 0.7)) % 1;

    // Glitch chromatic-aberration offset jumps on its own little real-time timer.
    f.glitchT -= rms;
    if (f.glitchT <= 0) {
      f.glitchT = 70 + Math.random() * 150;
      var gmag = f.phase === 'HACK' ? 7 : 3;
      f.glitchOx = (Math.random() * 2 - 1) * gmag;
      f.glitchOy = (Math.random() * 2 - 1) * gmag * 0.5;
    }

    var inside = false;
    if (p && p.state !== 'DEAD') {
      var pdx = p.x - f.x, pdy = p.y - f.y;
      inside = (pdx * pdx + pdy * pdy) <= f.zoneR * f.zoneR;
    }
    f.inside = inside;

    if (f.phase === 'IDLE') {
      f.idleT += rms;
      if (inside && !this._twActive) this._cacheBeginHack();
      else if (f.idleT >= C.CACHE_IDLE_LIFE) this._cacheFail();
    } else if (f.phase === 'HACK') {
      var fillRate = ms / C.CACHE_HACK_DUR;          // scaled time → pauses in TW/hitstop
      if (inside) {
        f.prog = Math.min(1, f.prog + fillRate);
        f.abandonT = 0;
      } else {
        f.prog = Math.max(0, f.prog - fillRate * C.CACHE_DECAY_MULT);
        if (f.prog <= 0) {
          f.abandonT += rms;
          if (f.abandonT >= C.CACHE_ABANDON_GRACE) { this._cacheRevertToIdle(); return; }
        }
      }
      // Enrage every regular enemy standing inside (bosses live outside
      // this.enemies, so the sweep can never reach them). Frozen during The World.
      if (!this._twActive) this._cacheApplyRage(ms);
      if (f.prog >= 1) { this._cacheSucceed(); return; }
    } else if (f.phase === 'DISSOLVE') {
      f.dissolveT += rms;
      if (f.dissolveT >= C.CACHE_DISSOLVE_DUR) { this._clearCacheZone(true); return; }
    }

    this._cacheTickMotes(dt);
    this._renderCacheZone(dt);
  };

  /* IDLE → HACK : the cache wakes up hostile. */
  M._cacheBeginHack = function () {
    var f = this._cache;
    if (!f || f.phase !== 'IDLE') return;
    f.phase = 'HACK';
    f.abandonT = 0;
    this._spawnWaveRing(f.x, f.y, { maxRadius: f.zoneR, color: C.CACHE_TINT, expandTime: 0.4 });
    this._explode(f.x, f.y, C.CACHE_TINT_ARR, 18);
    this.cameras.main.shake(120, 0.004);
    this._floatLabel(f.x, f.y - f.zoneR * 0.42, LA.laGoT('laCacheHack'), '#c060ff');
  };

  /* HACK abandoned (gauge drained to 0 and the player stayed away) → power down. */
  M._cacheRevertToIdle = function () {
    var f = this._cache;
    if (!f) return;
    this._clearCacheRage();
    f.phase = 'IDLE';
    f.prog = 0; f.idleT = 0; f.abandonT = 0;
    this._explode(f.x, f.y, C.CACHE_TINT_ARR, 8);
  };

  /* HACK complete → detonate the cache and eject the Overdrive reward. */
  M._cacheSucceed = function () {
    var f = this._cache;
    if (!f) return;
    this._clearCacheRage();
    var x = f.x, y = f.y;

    this._spawnWaveRing(x, y, { maxRadius: f.zoneR * 1.25, color: C.STAR_TINT, expandTime: 0.5 });
    this._spawnWaveRing(x, y, { maxRadius: f.zoneR * 0.7,  color: COL_HOT,     expandTime: 0.34 });
    this._explode(x, y, C.STAR_TINT_ARR, 60);
    this._explode(x, y, [255, 255, 255], 30);
    this.cameras.main.flash(240, 180, 40, 255);
    this.cameras.main.shake(220, 0.012);
    this._triggerHitstop(110);
    this._floatLabel(x, y - 30, LA.laGoT('laCacheSecured'), '#ff66ff');

    // The payoff: a mega Overdrive orb bursts into the zone centre, with a little
    // guidance chevron toward it (the player is usually already standing on it).
    this._spawnStar(x, y, { mega: true, guide: true, dur: C.CACHE_OVERDRIVE_DUR });

    f.phase = 'DISSOLVE'; f.dissolveT = 0; f.success = true;
  };

  /* IDLE timed out un-entered → a quiet fade (no reward). */
  M._cacheFail = function () {
    var f = this._cache;
    if (!f) return;
    this._clearCacheRage();
    this._explode(f.x, f.y, C.CACHE_TINT_ARR, 10);
    f.phase = 'DISSOLVE'; f.dissolveT = 0; f.success = false;
  };

  /* Enrage / un-rage enemies relative to the circle. An enemy inside gets a fresh
     linger stamp; one that left counts its linger down so the boost (and its aura)
     fades smoothly rather than snapping off at the rim. */
  M._cacheApplyRage = function (ms) {
    var f = this._cache, en = this.enemies;
    if (!en || !en.length) return;
    var r2 = f.zoneR * f.zoneR;
    for (var i = 0; i < en.length; i++) {
      var e = en[i];
      var dx = e.x - f.x, dy = e.y - f.y;
      if (dx * dx + dy * dy <= r2) {
        e._cacheRageT = C.CACHE_RAGE_LINGER;
        e._cacheRage  = true;
      } else if (e._cacheRageT > 0) {
        e._cacheRageT -= ms;
        if (e._cacheRageT <= 0) { e._cacheRageT = 0; e._cacheRage = false; }
      } else {
        e._cacheRage = false;
      }
    }
  };

  /* Inward "download" streaks that flow from the rim into the core while a hack
     is actively running with the player inside. */
  M._cacheTickMotes = function (dt) {
    var f = this._cache;
    if (f.phase === 'HACK' && f.inside && f.motes.length < 48) {
      f.moteT += dt * 1000;
      while (f.moteT > 34) {
        f.moteT -= 34;
        var a = Math.random() * TAU, r = f.zoneR * (0.85 + Math.random() * 0.15);
        f.motes.push({ a: a, r: r, x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, life: 1 });
      }
    }
    for (var i = f.motes.length - 1; i >= 0; i--) {
      var mo = f.motes[i];
      mo.r -= f.zoneR * 1.5 * dt;
      mo.life -= dt * 1.6;
      if (mo.life <= 0 || mo.r <= 4) { f.motes.splice(i, 1); continue; }
      mo.x = f.x + Math.cos(mo.a) * mo.r;
      mo.y = f.y + Math.sin(mo.a) * mo.r;
    }
  };

  /* ================================================================
     RENDER — ground ring/fill/glitch/gauge (depth 7) + the download glyph
     and enemy rage auras (depth 28).
     ================================================================ */
  M._renderCacheZone = function (dt) {
    var g = this._cacheGfx, tg = this._cacheTopGfx;
    if (!g || !tg) return;
    g.clear(); tg.clear();
    var f = this._cache;
    if (!f) return;

    var gt   = this.gameTime;
    var x = f.x, y = f.y, R = f.zoneR;
    var col  = C.CACHE_TINT;
    var hot  = 0.6 + 0.4 * Math.sin(gt * 3 + f.seed);

    // Alpha / radius envelope (success blooms outward + fades; timeout shrinks + fades).
    var A = 1, Rmul = 1;
    if (f.phase === 'DISSOLVE') {
      var dp = smooth(Math.min(1, f.dissolveT / C.CACHE_DISSOLVE_DUR));
      A = 1 - dp;
      Rmul = f.success ? (1 + 0.45 * dp) : (1 - 0.28 * dp);
    }
    if (A <= 0.004) return;
    var Rr = R * Rmul;

    // ---- Filled disc (the region reads as a place to stand) ----
    g.fillStyle(col, 0.06 * A * (0.7 + 0.3 * hot));
    g.fillCircle(x, y, Rr);
    if (f.phase === 'HACK') { g.fillStyle(col, 0.05 * A); g.fillCircle(x, y, Rr * 0.6); }

    // ---- Glitched perimeter (chromatic aberration: red + cyan offset ghosts) ----
    var ox = f.glitchOx, oy = f.glitchOy;
    g.lineStyle(2.5, COL_RB, 0.5 * A); g.strokeCircle(x + ox, y + oy, Rr);
    g.lineStyle(2.5, COL_CB, 0.5 * A); g.strokeCircle(x - ox, y - oy, Rr);
    g.lineStyle(3,   col,    0.9 * A * (0.8 + 0.2 * hot)); g.strokeCircle(x, y, Rr);

    // Occasional horizontal "tear" bars (the data-glitch flicker).
    for (var tb = 0; tb < 2; tb++) {
      if (Math.random() < 0.28) {
        var by = y + (Math.random() * 2 - 1) * Rr * 0.78;
        var bw = Rr * (0.4 + Math.random() * 0.7);
        var bx = x + (Math.random() * 2 - 1) * Rr * 0.28;
        g.fillStyle(Math.random() < 0.5 ? COL_CB : COL_RB, 0.20 * A);
        g.fillRect(bx - bw / 2, by - 1.5, bw, 3);
      }
    }

    // ---- Rotating dashed "data" ring (inner) ----
    var dashN = 32, ir = Rr * 0.7;
    g.lineStyle(2, col, 0.4 * A);
    for (var d = 1; d < dashN; d += 2) {
      var da = f.swirl * 0.8 + (d / dashN) * TAU;
      g.beginPath(); g.arc(x, y, ir, da, da + (TAU / dashN) * 0.6, false); g.strokePath();
    }

    // ---- Inward download motes ----
    for (var mi = 0; mi < f.motes.length; mi++) {
      var mo = f.motes[mi];
      var mdx = x - mo.x, mdy = y - mo.y, md = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
      var mA = mo.life * A;
      g.lineStyle(2, col, 0.6 * mA);
      g.beginPath(); g.moveTo(mo.x, mo.y); g.lineTo(mo.x + (mdx / md) * 14, mo.y + (mdy / md) * 14); g.strokePath();
      g.fillStyle(COL_HOT, 0.8 * mA); g.fillCircle(mo.x, mo.y, 1.6);
    }

    // ---- Progress gauge: a bright arc charging clockwise from the top ----
    if (f.prog > 0.001) {
      var a0 = -Math.PI / 2, a1 = a0 + f.prog * TAU;
      var gaugeCol = (f.phase === 'HACK' && !f.inside) ? COL_RED : col;   // red while draining
      g.lineStyle(8, gaugeCol, 0.30 * A); g.beginPath(); g.arc(x, y, Rr, a0, a1, false); g.strokePath();
      g.lineStyle(3.5, COL_HOT, 0.92 * A); g.beginPath(); g.arc(x, y, Rr, a0, a1, false); g.strokePath();
      var hx = x + Math.cos(a1) * Rr, hy = y + Math.sin(a1) * Rr;
      g.fillStyle(COL_HOT, 0.95 * A); g.fillCircle(hx, hy, 5);
    }

    // ---- "Return!" telegraph: a red pulse when the hack is live but you stepped out ----
    if (f.phase === 'HACK' && !f.inside) {
      var rp = 0.4 + 0.6 * Math.abs(Math.sin(gt * Math.PI * 4));
      g.lineStyle(4, COL_RED, 0.5 * rp * A);
      g.strokeCircle(x, y, Rr * (1.02 + 0.02 * Math.sin(gt * 6)));
    }

    // ---- Download glyph (top layer, hovering above the enemies) ----
    var iconCol = f.phase === 'HACK' ? COL_HOT : col;
    var iconA   = A * (f.phase === 'HACK' ? (0.7 + 0.3 * Math.sin(gt * 8)) : (0.5 + 0.3 * hot));
    this._drawDownloadGlyph(tg, x, y, 26, iconCol, iconA, f.dlBob, f.phase === 'HACK');

    // ---- Enemy rage auras (top layer) — only while a hack is running ----
    if (f.phase === 'HACK') {
      var view = this.cameras.main.worldView;
      var en = this.enemies, pulse = 0.55 + 0.45 * Math.abs(Math.sin(gt * Math.PI * 5));
      for (var ei = 0; ei < en.length; ei++) {
        var e = en[ei];
        if (!e._cacheRage) continue;
        if (e.x < view.x - 40 || e.x > view.right + 40 || e.y < view.y - 40 || e.y > view.bottom + 40) continue;
        var fade = Math.min(1, (e._cacheRageT || 0) / C.CACHE_RAGE_LINGER);
        var rr = (e.size || 14) * 1.55 + 3 * Math.sin(gt * 12 + e.x * 0.05);
        tg.lineStyle(2, COL_RED, 0.55 * pulse * fade);
        tg.strokeCircle(e.x, e.y, rr);
        // four short angry spikes
        for (var sp = 0; sp < 4; sp++) {
          var sa = gt * 3 + sp * (Math.PI / 2);
          var ix = e.x + Math.cos(sa) * rr, iy = e.y + Math.sin(sa) * rr;
          tg.lineStyle(2, 0xff7733, 0.6 * pulse * fade);
          tg.beginPath();
          tg.moveTo(ix, iy);
          tg.lineTo(e.x + Math.cos(sa) * (rr + 5), e.y + Math.sin(sa) * (rr + 5));
          tg.strokePath();
        }
      }
    }
  };

  /* The classic "download" glyph: a down-arrow into an open tray. While hacking,
     the arrow slides down on its bob phase (data pouring into the cache). */
  M._drawDownloadGlyph = function (g, cx, cy, s, col, alpha, bob, hacking) {
    if (alpha <= 0.01) return;

    // Open tray at the bottom.
    var ty = cy + s * 0.95;
    g.lineStyle(3, col, 0.85 * alpha);
    g.beginPath();
    g.moveTo(cx - s * 0.9, cy + s * 0.32);
    g.lineTo(cx - s * 0.9, ty);
    g.lineTo(cx + s * 0.9, ty);
    g.lineTo(cx + s * 0.9, cy + s * 0.32);
    g.strokePath();

    // Arrow (stem + chevron head) — bobs downward while hacking.
    var slide = hacking ? bob * s * 0.5 : 0;
    var topY  = cy - s * 0.62 + slide;
    var headY = topY + s * 0.95;
    g.lineStyle(4, col, alpha);
    g.beginPath(); g.moveTo(cx, topY); g.lineTo(cx, headY); g.strokePath();
    g.beginPath();
    g.moveTo(cx - s * 0.5, headY - s * 0.5);
    g.lineTo(cx, headY);
    g.lineTo(cx + s * 0.5, headY - s * 0.5);
    g.strokePath();

    g.fillStyle(COL_HOT, alpha);
    g.fillCircle(cx, topY, 2.4);
  };

})();
