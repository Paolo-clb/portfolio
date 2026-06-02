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

  // Ground-fill opacity (visual tuning — bump these to read the circle more/less).
  var FILL_BASE   = 0.12;    // base disc tint, always (was barely visible at 0.06)
  var FILL_INSIDE = 0.16;    // EXTRA tint added (eased) while you're standing inside → clear "you're in it"
  var CORE_SCALE_DIV = 110;  // reward-sprite centre-piece scale = zoneR / this

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

    // Top layer (above enemies, under the player arrow) — the loading spinner/halo
    // + the per-enemy rage auras, so both always read clearly.
    this._cacheTopGfx = this.add.graphics();
    this._cacheTopGfx.setDepth(28);
    this._cacheTopGfx.setBlendMode(Phaser.BlendModes.ADD);

    // Centre-piece: the actual reward (Overdrive star) sprite "charges" as a PIE
    // that completes with the hack gauge. A faint full-star GHOST sits behind as
    // the prize preview; the bright FILL star is revealed by a wedge geometry mask.
    this._cacheStarGhost = this.add.image(0, 0, '_star');
    this._cacheStarGhost.setDepth(28).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this._cacheStarFill = this.add.image(0, 0, '_star');
    this._cacheStarFill.setDepth(28).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this._cacheStarMaskGfx = this.add.graphics();
    this._cacheStarMaskGfx.setVisible(false);                 // geometry-mask source — never drawn itself
    this._cacheStarFill.setMask(this._cacheStarMaskGfx.createGeometryMask());
  };

  /* Drop the live zone (graphics persist — just cleared) and lift any rage. */
  M._clearCacheZone = function (silent) {
    this._clearCacheRage();
    this._cache = null;
    if (this._cacheGfx)         this._cacheGfx.clear();
    if (this._cacheTopGfx)      this._cacheTopGfx.clear();
    if (this._cacheStarMaskGfx) this._cacheStarMaskGfx.clear();
    if (this._cacheStarGhost)   this._cacheStarGhost.setVisible(false);
    if (this._cacheStarFill)    this._cacheStarFill.setVisible(false);
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
    var inset = R + 40;                            // keep the WHOLE circle in-bounds (disc)
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

    var dMin = opts.near ? (R + 110) : C.CACHE_SPAWN_DIST_MIN;   // debug: drop it just outside the rim
    var dMax = opts.near ? (R + 110) : C.CACHE_SPAWN_DIST_MAX;
    var x, y, tries = 0, ok = false;
    do {
      var ang  = Math.random() * TAU;
      var dist = dMin + Math.random() * (dMax - dMin);
      var czc = LA.clampDisc(this.p.x + Math.cos(ang) * dist, this.p.y + Math.sin(ang) * dist, inset);
      x = czc.x; y = czc.y;
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
      insideGlow: 0,      // eased 0→1 "you're standing in it" fill brighten
      success: false,
      seed: Math.random() * 1000,
      swirl: Math.random() * TAU,
      spin: 0,            // loading-spinner rotation phase
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
    // The World: the cache is dormant — FREEZE its animation (the loading spinner,
    // swirl and glitch jitter all stop) so nothing reads as "still charging".
    var aDt = this._twActive ? 0 : dt;
    f.age   += rms;
    f.swirl += aDt;
    f.spin  += aDt * (f.phase === 'HACK' ? 3.2 : 1.1);   // loading spinner spins faster while hacking

    // Glitch chromatic-aberration offset jumps on its own little real-time timer.
    f.glitchT -= (this._twActive ? 0 : rms);
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
    // Ease the "inside" fill brighten so entering/leaving fades smoothly (no snap).
    f.insideGlow += ((inside ? 1 : 0) - f.insideGlow) * Math.min(1, dt * 8);

    if (f.phase === 'IDLE') {
      f.idleT += rms;
      if (inside && !this._twActive) this._cacheBeginHack();
      else if (f.idleT >= C.CACHE_IDLE_LIFE) this._cacheFail();
    } else if (f.phase === 'HACK') {
      // The World freezes the cache ENTIRELY: the gauge stops charging (no cheesing
      // a stopped board), the drain/abandon timers pause, and NO rage is applied —
      // the zone is dormant (it also renders grayed, with no enemy auras).
      if (!this._twActive) {
        var fillRate = ms / C.CACHE_HACK_DUR;
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
        // this.enemies, so the sweep can never reach them).
        this._cacheApplyRage(ms);
        if (f.prog >= 1) { this._cacheSucceed(); return; }
      }
    } else if (f.phase === 'DISSOLVE') {
      f.dissolveT += rms;
      if (f.dissolveT >= C.CACHE_DISSOLVE_DUR) { this._clearCacheZone(true); return; }
    }

    this._cacheTickMotes(this._twActive ? 0 : dt);   // download streaks freeze too while dormant
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
    // Announce the finished charge like a big-score event (PARADE / NUKE style) so
    // it clearly reads as "upgrade charged", banking a combo-scaled completion bonus.
    var bonus = C.CACHE_COMPLETE_SCORE * (this.comboMultiplier || 1);
    this.score += bonus;
    this._floatScoreBig('CACHE', bonus);

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

    // The World: the cache is dormant (it stops charging), so drain its palette to
    // grey like the frozen enemies. These locals shadow the module COL_* for this
    // render only (no-op when The World isn't active).
    var COL_RED = 0xff2a44, COL_RB = 0xff3a6a, COL_CB = 0x36e0ff, COL_HOT = 0xffffff;
    if (this._twActive) {
      col = this._twGray(col);
      COL_RED = this._twGray(COL_RED); COL_RB = this._twGray(COL_RB);
      COL_CB  = this._twGray(COL_CB);  COL_HOT = this._twGray(COL_HOT);
    }

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
    // Base tint is always visible; standing INSIDE adds an eased brighten + a faint
    // white wash so it's unmistakable you're in the zone.
    g.fillStyle(col, FILL_BASE * A * (0.7 + 0.3 * hot));
    g.fillCircle(x, y, Rr);
    var ig = f.insideGlow || 0;
    if (ig > 0.01) {
      g.fillStyle(col, FILL_INSIDE * A * ig);
      g.fillCircle(x, y, Rr);
      g.fillStyle(COL_HOT, 0.05 * A * ig);
      g.fillCircle(x, y, Rr * 0.9);
    }

    // ---- "Server floor": scanlines + faint data blocks, clipped to the disc ----
    // Reads the circle as a hack / disk-surface (not just a flat violet plate). Drawn
    // here so it sits ABOVE the base tint but UNDER every existing element (perimeter,
    // dashed ring, motes, gauge, glyph). Lines are clipped to the circle analytically
    // via the chord half-width sqrt(R²-dy²) — no mask object, cheap per-line.
    var hacking = (f.phase === 'HACK');
    // Lines crawl DOWN; faster (and a hint brighter) while a hack is live. gameTime
    // drives the offset so the scroll pauses with The World like the rest of the FX.
    var scanGap   = 12;
    var scanSpeed = hacking ? 46 : 16;                 // px/s downward drift
    var scanA     = (hacking ? 0.055 : 0.04) * A;      // very low — ambience, never busy
    var scanOff   = (gt * scanSpeed) % scanGap;        // wrap within one line spacing
    // Seeded white-hot "read head" lines while hacking (disk-read flicker): pick 2-3
    // line indices from f.seed + a slow time step so they jump around occasionally.
    var hotStep   = hacking ? Math.floor(gt * 6) : -1; // ~6 jumps/s
    var hotA      = 0.16 * A;
    var topY = y - Rr, botY = y + Rr;
    for (var ly = topY - scanOff; ly <= botY; ly += scanGap) {
      var dyl = ly - y;
      var inner = Rr * Rr - dyl * dyl;
      if (inner <= 1) continue;                        // line misses / barely grazes the disc
      var halfW = Math.sqrt(inner);
      // Hot read-head test: a couple of pseudo-random lines per hot step go white.
      var isHot = false;
      if (hacking) {
        var li = Math.round((ly - topY) / scanGap);
        // cheap deterministic hash → fract → only ~2-3 of the ~73 lines light up
        var h = ((li * 73.13 + f.seed + hotStep * 17.7) * 0.61803398875) % 1;
        if (h < 0) h += 1;
        isHot = h < 0.04;
      }
      if (isHot) g.fillStyle(COL_HOT, hotA);
      else       g.fillStyle(col,     scanA);
      g.fillRect(x - halfW, ly - 0.5, halfW * 2, isHot ? 1.5 : 1);
    }

    // Faint seeded "data blocks" — a sparse grid of small squares that rarely blink,
    // so the floor feels like live storage. Fixed positions (seeded), no motion.
    var nBlk = 10;
    for (var bi = 0; bi < nBlk; bi++) {
      // Deterministic per-block placement (golden-ratio scatter) inside the disc.
      var ba = (bi * 2.39996323 + f.seed * 0.013) % TAU;       // ~golden-angle around
      var bd = Rr * (0.18 + ((bi * 0.6180339887 + f.seed * 0.07) % 1) * 0.74);
      var bX = x + Math.cos(ba) * bd, bY = y + Math.sin(ba) * bd;
      // Rare per-block blink: a slow seeded phase crosses a small threshold.
      var blink = (Math.sin(gt * (0.7 + (bi % 3) * 0.35) + f.seed + bi * 1.7) * 0.5 + 0.5);
      var bA = (0.03 + 0.07 * (blink > 0.86 ? 1 : 0)) * A;     // mostly dim, occasionally pops
      g.fillStyle(col, bA);
      g.fillRect(bX - 5, bY - 5, 10, 10);
    }

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

    // ---- Reward-sprite centre-piece: the Overdrive star "charges" as a PIE that
    //      completes with the gauge (ghost preview behind + a loading spinner). ----
    this._renderCacheCore(x, y, Rr, A, f.prog, f.phase, gt, hot, f.spin);

    // ---- Enemy RAGE auras (top layer) — only while a live hack runs, and NEVER
    //      during The World (the zone is dormant then). Reworked to read as a
    //      fuming, jagged "rage corona" (flickering spikes + a hot inner glow)
    //      rather than a clean ring, which looked like a targeting reticle. ----
    if (f.phase === 'HACK' && !this._twActive) {
      var view = this.cameras.main.worldView;
      var en = this.enemies;
      var nSp = 8, nV = nSp * 2;        // spikes → 2× vertices (outer tip / inner valley)
      for (var ei = 0; ei < en.length; ei++) {
        var e = en[ei];
        if (!e._cacheRage) continue;
        if (e.x < view.x - 40 || e.x > view.right + 40 || e.y < view.y - 40 || e.y > view.bottom + 40) continue;
        var fade  = Math.min(1, (e._cacheRageT || 0) / C.CACHE_RAGE_LINGER);
        var baseR = (e.size || 14) * 0.95;                          // small — hugs the body
        var seed  = e.x * 0.07 + e.y * 0.05;                        // per-enemy phase (no lockstep pulse)
        var beat  = 0.6 + 0.4 * Math.abs(Math.sin(gt * Math.PI * 6 + seed));
        var rot   = gt * 2.2 + seed;

        // If the enemy is ALSO dash-marked, recolour the corona to the mark's CYAN
        // (coherent with the cyan mark flicker) so marked enemies stay readable and
        // clearly distinct from plain RED raged ones — red used to bury the mark.
        var marked = !!e.isMarked;
        var glowC  = marked ? 0x36e0ff : COL_RED;
        var tipC   = marked ? 0x9af6ff : 0xff7733;

        // Fuming inner glow — very faint, just a hint of heat.
        tg.fillStyle(glowC, 0.035 * beat * fade);
        tg.fillCircle(e.x, e.y, baseR * (1.2 + 0.10 * beat));

        // Jagged corona, two translucent layers; outer tips jitter fast/independently
        // → a furious, unstable silhouette that hugs the body.
        var lw, lc, lsc, la;
        for (var layer = 0; layer < 2; layer++) {
          if (layer === 0) { lw = 2;   lc = glowC; lsc = 1.0;  la = 0.09; }
          else             { lw = 1.2; lc = tipC;  lsc = 0.96; la = 0.20; }
          tg.lineStyle(lw, lc, la * beat * fade);
          tg.beginPath();
          for (var s = 0; s <= nV; s++) {
            var ang = rot + (s / nV) * TAU;
            var outer = (s % 2) === 0;
            var fl = outer ? (0.55 + 0.85 * Math.abs(Math.sin(gt * 17 + s * 1.7 + seed))) : 0;
            var rr = baseR * (outer ? (1.25 + 0.45 * fl) : 0.95) * lsc;
            var px = e.x + Math.cos(ang) * rr, py = e.y + Math.sin(ang) * rr;
            if (s === 0) tg.moveTo(px, py); else tg.lineTo(px, py);
          }
          tg.closePath(); tg.strokePath();
        }
      }
    }
  };

  /* The reward (Overdrive star) sprite AS the centre-piece: a faint full-star GHOST
     preview, with the bright star revealed by a PIE wedge geometry mask that
     completes with the hack gauge ("un camembert qui se complète"), ringed by a
     loading spinner. So you literally watch the bonus you're about to win fill in. */
  M._renderCacheCore = function (cx, cy, Rr, A, prog, phase, gt, hot, spin) {
    var ghost = this._cacheStarGhost, fill = this._cacheStarFill, mg = this._cacheStarMaskGfx;
    if (!ghost || !fill || !mg) return;
    var tg = this._cacheTopGfx;

    var scale  = (Rr / CORE_SCALE_DIV) * (1 + 0.05 * Math.sin(gt * 4));   // gentle breathing
    var halfPx = 16 * scale;                                              // _star texture is 32px → half = 16

    ghost.setVisible(true).setPosition(cx, cy).setScale(scale);
    fill.setVisible(true).setPosition(cx, cy).setScale(scale);
    // Ghost = the prize, always faintly shown. Fill = bright, masked to the gauge.
    ghost.setAlpha(A * (phase === 'HACK' ? (0.22 + 0.12 * hot) : (0.32 + 0.16 * hot)));
    fill.setAlpha(A * 0.96);
    // The World: grey the prize-preview star too (the cache is dormant); white otherwise.
    var twTint = this._twActive ? 0x8f8f96 : 0xffffff;
    ghost.setTint(twTint); fill.setTint(twTint);

    // Pie wedge mask = prog, sweeping clockwise from the top; a full disc at ~100%.
    var maskR = halfPx * 1.04;
    mg.clear();
    mg.fillStyle(0xffffff, 1);
    if (prog >= 0.999) {
      mg.fillCircle(cx, cy, maskR);
    } else if (prog > 0.0008) {
      mg.beginPath();
      mg.moveTo(cx, cy);
      mg.arc(cx, cy, maskR, -Math.PI / 2, -Math.PI / 2 + prog * TAU, false);
      mg.closePath();
      mg.fillPath();
    }
    // prog ~0 → empty mask → only the ghost preview shows.

    // Soft halo behind the icon (readability over a busy floor) + a loading spinner.
    // Both drain to grey during The World (dormant cache).
    tg.fillStyle(this._twActive ? this._twGray(C.CACHE_TINT) : C.CACHE_TINT, A * 0.10);
    tg.fillCircle(cx, cy, halfPx * 1.35);
    var sr = halfPx * 1.2, segs = 3, gapFrac = 0.66;
    tg.lineStyle(3, this._twActive ? this._twGray(COL_HOT) : COL_HOT, A * (0.45 + 0.3 * hot));
    for (var s = 0; s < segs; s++) {
      var a = spin + s * (TAU / segs);
      tg.beginPath(); tg.arc(cx, cy, sr, a, a + (TAU / segs) * gapFrac, false); tg.strokePath();
    }
  };

})();
