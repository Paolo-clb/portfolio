/* ==========================================================================
   Light Again — Data Highways (Autoroutes de Données)

   Long, thin, luminous "wind / code" corridors that streak across the arena.
   They are TERRAIN, not a pickup: stepping in — or, far better, DASHING through
   — carries the player along the flow like a conveyor belt, up to ~3× normal
   top speed. The flow direction is FIXED and random, so a highway is an
   unpredictable actor: it can rocket you out of trouble, or fling you straight
   into a wall. Pure mobility — no score, no damage, and (by request) NO
   guidance arrow: you find them at random.

     1. SPAWN  — gated + paced (≈ every 20–30 s, ~1 at a time). Placed via a
                 capsule fit so the WHOLE corridor (glow included) always sits
                 inside the map — never clipped by the world edge. Biased to
                 pass near the player so it's discoverable without a pointer.
     2. FORM   — the road "draws itself" from the upstream end (a bright
                 wavefront races along) over HIGHWAY_FADE_IN.
     3. LIVE   — flow particles stream, chevrons scroll, edges shimmer; the
                 conveyor carries anything (the player) riding the band. Strength
                 eases by how centred you are (lateral) and how far from the ends
                 (axial), so entering and leaving is buttery, never a snap.
     4. EVAPORATE — over HIGHWAY_FADE_OUT it retracts downstream and fades to
                 nothing, the carry easing off with it.

   Self-contained on this._highways (plain data) + one shared ADD graphics layer
   (depth 8 — under enemies/player, so they ride ON the road). The conveyor PUSH
   is applied from scene.js' player-movement block (player time, so it works
   during The World); the lifecycle + render tick on real dt from update().
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* ---- Flow look (local tuning; gameplay-facing numbers live in constants.js) ---- */
  var FLOW_PX_PER_S = 1080;  // how fast the streaming motes travel along the road
  var MOTE_SPACING  = 64;    // avg px between flow motes along the axis
  var CHEV_GAP      = 132;   // px between scrolling ">" chevrons
  var CHEV_PX_S     = 360;   // chevron scroll speed (slower than motes, like road arrows)
  var CHEV_SIZE     = 27;    // chevron length along the flow (px)
  var CHEV_HALF     = 16;    // chevron half-height (px)
  var SCAN_PX_S     = 760;   // a bright "scan" band sweeping the road
  var EDGE_WOB_AMP  = 6;     // edge wobble amplitude (px) — the "wind" ripple
  var EDGE_WOB_FREQ = 0.019; // edge wobble spatial frequency
  var EDGE_WOB_SPD  = 3.4;   // edge wobble scroll speed
  var BAND_N        = 36;    // samples along the corridor (band polygon + wavy edges)
  // The corridor tapers to soft points instead of stopping with a flat cut + a
  // deco circle — a long spindle: short pointed INTAKE upstream, longer pointed
  // EXHAUST downstream (asymmetry reads the flow direction), wisps spraying off.
  var NOSE_IN       = 240;   // px the upstream end tapers in over (sharper intake)
  var NOSE_OUT      = 380;   // px the downstream end tapers out over (longer, softer exhaust)

  var COL_CORE = 0xeaffff;   // hot near-white core
  var COL_WHITE = 0xffffff;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initDataHighways = function () {
    this._highways        = [];
    this._highwaySpawnT   = 0;
    this._highwayNextDelay = C.HIGHWAY_SPAWN_MIN_DELAY;  // wait before the very first one
    this._highwayGhostT   = 0;   // throttles the player speed-trail ghosts
    this._highwayBoost    = 0;   // strongest strength the player rode this frame (FX read)
    this._highwayInvuln   = false; // true while the player is protected by a highway
    this._highwayInvulnT  = 0;   // ms of remaining ride-invincibility (lingers briefly after exit)

    // One shared persistent ADD layer, sat UNDER enemies (20) and player (30) so
    // entities ride visibly on top of the road. Destroyed with the scene.
    this._highwayGfx = this.add.graphics();
    this._highwayGfx.setDepth(8);
    this._highwayGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop every live highway (the graphics object persists — just cleared). */
  M._clearDataHighways = function (silent) {
    if (this._highways) this._highways.length = 0;
    this._highwayBoost = 0;
    if (this._highwayGfx) this._highwayGfx.clear();
  };

  /* ================================================================
     SPAWN GATE — paced, never during curated / confined states
     ================================================================ */
  // Block NEW spawns (existing ones still tick + render) during: the tutorial,
  // the upgrade slow-mo / draft, the Anomaly quarantine (it confines the player,
  // so a conveyor would just fight it), and Time Stop (terrain shouldn't pop into
  // frozen time). The Anomaly is a SPECIAL case: its whole fight suppresses
  // highways (it confines the player), so the entire time `this._anomaly` exists
  // is suspended — not just the barrier. The other bosses (Giga/Mirror/Snake) are
  // FAIR GAME — a highway is great for dodging them.
  M._highwaysSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomaly || this._anomalyBarrierActive ||
              this._anomalyIntroActive || this._twActive || !this.p || this.p.state === 'DEAD');
  };

  M._maybeSpawnHighway = function (dt) {
    if (this._highways.length >= C.HIGHWAY_MAX) return;
    this._highwaySpawnT += dt * 1000;
    if (this._highwaySpawnT < this._highwayNextDelay) return;
    this._highwaySpawnT = 0;
    this._highwayNextDelay = C.HIGHWAY_SPAWN_INTERVAL_MIN +
      Math.random() * (C.HIGHWAY_SPAWN_INTERVAL_MAX - C.HIGHWAY_SPAWN_INTERVAL_MIN);
    this._spawnHighway({});
  };

  /* Place a highway as a capsule fully inside the map. The corridor centreline
     stays within [-B, B]² where B = WORLD_HALF - margin - (halfWidth+feather);
     since the band only ever reaches (halfWidth+feather) off the centreline, the
     ENTIRE capsule (glow included) is guaranteed in-bounds — never edge-clipped.
     Biased so the road passes near the player (discoverable without a pointer). */
  M._spawnHighway = function (opts) {
    opts = opts || {};
    if (!this.p || this.p.state === 'DEAD') return;
    if (this._highways.length >= C.HIGHWAY_MAX) return;
    var p = this.p;

    var W  = C.HIGHWAY_HALF_WIDTH + C.HIGHWAY_EDGE_FEATHER;
    var B  = C.WORLD_HALF - C.HIGHWAY_MARGIN - W;               // centreline keep-in box half-size

    var ang  = Math.random() * TAU;
    var dirx = Math.cos(ang), diry = Math.sin(ang);
    var len  = C.HIGHWAY_LEN_MIN + Math.random() * (C.HIGHWAY_LEN_MAX - C.HIGHWAY_LEN_MIN);
    var half = len / 2;

    // Shrink length if a near-axis-aligned corridor's half-extent can't fit the
    // box on either axis (won't trigger at default lengths, but keep it robust).
    var exX = Math.abs(dirx) * half, exY = Math.abs(diry) * half;
    if (exX > B) { half *= B / exX; }
    if (exY > B) { half *= B / exY; }
    exX = Math.abs(dirx) * half; exY = Math.abs(diry) * half;
    len = half * 2;

    // Target a near-point a short way from the player, then slide it somewhere
    // along the corridor's length so the player doesn't always land mid-road.
    var nAng  = Math.random() * TAU;
    var nDist = C.HIGHWAY_SPAWN_NEAR_MIN + Math.random() * (C.HIGHWAY_SPAWN_NEAR_MAX - C.HIGHWAY_SPAWN_NEAR_MIN);
    var nearX = p.x + Math.cos(nAng) * nDist;
    var nearY = p.y + Math.sin(nAng) * nDist;
    var alongOff = (Math.random() - 0.5) * 1.2 * half;   // ∈ [-0.6, 0.6]·half (bias to the boostable middle)
    var cx = nearX - dirx * alongOff;
    var cy = nearY - diry * alongOff;

    // Clamp the centre so the whole capsule stays inside the map.
    var limX = Math.max(0, B - exX), limY = Math.max(0, B - exY);
    cx = clamp(cx, -limX, limX);
    cy = clamp(cy, -limY, limY);

    var ax = cx - dirx * half, ay = cy - diry * half;   // upstream end
    var bx = cx + dirx * half, by = cy + diry * half;   // downstream end

    var h = {
      ax: ax, ay: ay, bx: bx, by: by, cx: cx, cy: cy,
      dirx: dirx, diry: diry, len: len,
      age: 0, lifeFactor: 0, sweep: 0, dissolve: 0,
      flowPhase: Math.random() * 1000, shimmer: Math.random() * 1000,
      seed: Math.random() * 1000,
      flowFracPerSec: FLOW_PX_PER_S / len,
      motes: [],
      _pInside: false, _dissolveFx: false, dead: false,
    };

    var nMotes = Math.max(8, Math.round(len / MOTE_SPACING));
    for (var i = 0; i < nMotes; i++) {
      h.motes.push({
        u: Math.random(),
        lat: (Math.random() * 2 - 1) * C.HIGHWAY_HALF_WIDTH * 0.82,
        len: 13 + Math.random() * 26,
        thick: 1.3 + Math.random() * 1.9,
        bright: 0.5 + Math.random() * 0.5,
        spd: 0.82 + Math.random() * 0.62,            // parallax: motes travel at slightly different speeds
      });
    }

    this._highways.push(h);

    // Materialise FX — a soft ring at the near-point + a spark at each mouth.
    var cols = LA.getColors();
    this._spawnWaveRing(ax + dirx * Math.min(half, Math.abs(alongOff) + 60),
                        ay + diry * Math.min(half, Math.abs(alongOff) + 60),
                        { maxRadius: 150, color: cols.cyan, expandTime: 0.5 });
    this._explode(ax, ay, cols.cyanArr, 8);
    this._explode(bx, by, cols.cyanArr, 8);
  };

  /* ================================================================
     UPDATE — spawn gate, tick each highway, cull expired, render
     ================================================================ */
  M._updateDataHighways = function (dt) {
    // The Anomaly traps the player in its quarantine zone — any live highway is
    // forced off the board the instant the barrier slams (rising edge). New
    // spawns are already blocked for the whole anomaly fight by _highwaysSpawnSuspended.
    var trapped = !!(this._anomalyBarrierActive || this._anomalyIntroActive);
    if (trapped && !this._highwayTrappedPrev && this._highways.length) this._dismissHighwaysForAnomaly();
    this._highwayTrappedPrev = trapped;

    if (!this._highwaysSpawnSuspended()) this._maybeSpawnHighway(dt);

    var hs = this._highways;
    for (var i = hs.length - 1; i >= 0; i--) {
      this._tickHighway(hs[i], dt);
      if (hs[i].dead) hs.splice(i, 1);
    }
    this._renderHighways(dt);
  };

  /* The anomaly just trapped the player → blow every live highway off the field
     with a quick scatter (the quarantine owns the arena now). */
  M._dismissHighwaysForAnomaly = function () {
    var cols = LA.getColors();
    for (var i = 0; i < this._highways.length; i++) {
      var h = this._highways[i];
      this._spawnWaveRing(h.cx, h.cy, { maxRadius: 170, color: cols.cyan, expandTime: 0.4 });
      this._explode(h.cx, h.cy, cols.cyanArr, 12);
      this._explode(h.bx, h.by, [200, 255, 255], 8);
    }
    this._clearDataHighways(true);
    this._highwayInvuln = false;
    this._highwayInvulnT = 0;
  };

  M._tickHighway = function (h, dt) {
    var ms = dt * 1000;
    h.age += ms;
    var L = C.HIGHWAY_LIFETIME, fi = C.HIGHWAY_FADE_IN, fo = C.HIGHWAY_FADE_OUT;

    if (h.age < fi)            h.lifeFactor = smooth(h.age / fi);
    else if (h.age > L - fo)   h.lifeFactor = smooth(Math.max(0, L - h.age) / fo);
    else                        h.lifeFactor = 1;

    h.sweep    = Math.min(1, h.age / fi);
    h.dissolve = h.age > L - fo ? Math.min(1, (h.age - (L - fo)) / fo) : 0;

    // One-shot scatter puffs when it starts evaporating.
    if (h.dissolve > 0 && !h._dissolveFx) {
      h._dissolveFx = true;
      var cols = LA.getColors();
      this._explode(h.cx, h.cy, cols.cyanArr, 10);
      this._explode(h.bx, h.by, [200, 255, 255], 8);
    }

    if (h.age >= L) { h.dead = true; return; }

    h.flowPhase += dt;
    h.shimmer   += dt;

    var vU = h.flowFracPerSec;
    for (var i = 0; i < h.motes.length; i++) {
      var mo = h.motes[i];
      mo.u += vU * mo.spd * dt;
      if (mo.u >= 1) mo.u -= 1;
      else if (mo.u < 0) mo.u += 1;
    }
  };

  /* ================================================================
     CONVEYOR PUSH — applied from the player-movement block (scene.js),
     on PLAYER time (pS60), so it carries you even during The World.
     Pure positional conveyor: never mutates p.vx, so entry/exit is smooth
     and the player keeps full control of their own velocity.
     ================================================================ */
  M._applyHighwayFlow = function (pS60, pMs) {
    // Ride-invincibility grace decays every frame; it's refreshed below while the
    // player is actually in a flow band, so it lingers HIGHWAY_INVULN_GRACE ms
    // after stepping off (a smooth protective tail, not a hard cutoff).
    this._highwayInvulnT = Math.max(0, (this._highwayInvulnT || 0) - (pMs || 0));

    var hs = this._highways;
    if (!hs || !hs.length) { this._highwayBoost = 0; this._highwayInvuln = this._highwayInvulnT > 0; return; }
    if (this._anomalyBarrierActive) { this._highwayBoost = 0; this._highwayInvuln = this._highwayInvulnT > 0; return; }  // quarantine owns the player
    var p = this.p;
    if (!p || p.state === 'DEAD') { this._highwayBoost = 0; this._highwayInvuln = false; this._highwayInvulnT = 0; return; }

    var accVx = 0, accVy = 0, best = 0;
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i];
      var s = this._highwayStrength(h, p.x, p.y);
      if (s <= 0.001) {
        if (h._pInside) h._pInside = false;
        continue;
      }
      accVx += h.dirx * C.HIGHWAY_FLOW_SPEED * s;
      accVy += h.diry * C.HIGHWAY_FLOW_SPEED * s;
      if (s > best) best = s;

      // Entry whoosh — edge-triggered the first frame you bite into the flow.
      if (!h._pInside && s > 0.28) { h._pInside = true; this._highwayEntryFx(h); }
      if (h._pInside && s < 0.12)  { h._pInside = false; }
    }

    // Overlap guard: cap the summed conveyor so two overlapping roads can't fling
    // the player at runaway speed.
    var cap = C.HIGHWAY_FLOW_SPEED * C.HIGHWAY_FLOW_CAP_MULT;
    var mag = Math.sqrt(accVx * accVx + accVy * accVy);
    if (mag > cap) { var k = cap / mag; accVx *= k; accVy *= k; }

    p.x += accVx * pS60;
    p.y += accVy * pS60;
    this._highwayBoost = best;

    // While meaningfully inside a flow band, you're UNTOUCHABLE (refresh the grace
    // timer). Guard checked in player.js _damagePlayer. Threshold > the entry
    // feather so merely grazing the very edge doesn't grant it.
    if (best > 0.12) this._highwayInvulnT = C.HIGHWAY_INVULN_GRACE;
    this._highwayInvuln = this._highwayInvulnT > 0;

    // Speed-trail: leave extra ghosts while genuinely riding fast, to sell the ×3.
    if (best > 0.45) {
      this._highwayGhostT++;
      var sp2 = p.vx * p.vx + p.vy * p.vy;
      if ((this._highwayGhostT % 2) === 0 && (sp2 > 5 || best > 0.7)) {
        this._addGhost(p.x, p.y, 0.42 * best, p.angle, p.state === 'DASH_ATTACKING');
      }
    }
  };

  /* Strength of a highway's pull at (x,y): life × axial-ease × lateral-ease,
     each smoothstepped so the boost fades in/out with no snap. 0 = outside. */
  M._highwayStrength = function (h, x, y) {
    var life = h.lifeFactor;
    if (life <= 0) return 0;

    var rx = x - h.ax, ry = y - h.ay;
    var t = rx * h.dirx + ry * h.diry;          // distance from the upstream end along the axis
    if (t <= 0 || t >= h.len) return 0;

    var ef = C.HIGHWAY_END_FEATHER;
    var axial;
    if (t < ef)               axial = smooth(t / ef);
    else if (t > h.len - ef)  axial = smooth((h.len - t) / ef);
    else                      axial = 1;
    if (axial <= 0) return 0;

    var perp = Math.abs(ry * h.dirx - rx * h.diry);   // |perpendicular distance to the centreline|
    var Wc = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER;
    var lateral;
    if (perp <= Wc)        lateral = 1;
    else if (perp >= Wc + F) return 0;
    else                   lateral = smooth(1 - (perp - Wc) / F);

    return life * axial * lateral;
  };

  M._highwayEntryFx = function (h) {
    var p = this.p, cols = LA.getColors();
    this._explode(p.x, p.y, cols.cyanArr, 6);
    for (var i = 0; i < 3; i++) {
      this._addGhost(p.x - h.dirx * i * 7, p.y - h.diry * i * 7, 0.5, p.angle, false);
    }
  };

  /* The flow is TERRAIN, so it sweeps enemies too (the "unpredictable actor"):
     a pure positional carry on WORLD time (s60), so it freezes with the board
     during The World / hitstop. Slightly weaker than the player's carry
     (HIGHWAY_ENEMY_FLOW_MULT) so a highway still reads as YOUR escape tool.
     Near the DOWNSTREAM mouth, enemies also get a real velocity LAUNCH (forward
     + a lateral fan) so they're spat out and scattered instead of piling up just
     past the end of the road. Called from update() right after _updateEnemies.
     Projectiles are NOT swept (the user kept those on rails). */
  M._applyHighwayFlowToEnemies = function (s60) {
    var hs = this._highways;
    if (!hs || !hs.length || s60 <= 0) return;
    if (this._anomalyBarrierActive) return;   // don't fight the quarantine's confinement
    var enemies = this.enemies;
    if (!enemies || !enemies.length) return;

    var fs  = C.HIGHWAY_FLOW_SPEED * C.HIGHWAY_ENEMY_FLOW_MULT;
    var cap = fs * C.HIGHWAY_FLOW_CAP_MULT;
    var wLim = C.WORLD_HALF - C.SIZE;     // belt-and-suspenders edge guard (unreachable in practice)
    var W = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER, WF = W + F;
    var ef = C.HIGHWAY_END_FEATHER, ez = C.HIGHWAY_EXHAUST_ZONE;
    var ejSpeed = C.HIGHWAY_EJECT_SPEED, ejSpread = C.HIGHWAY_EJECT_SPREAD;

    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      if (en._spawnAnimT != null && en._spawnAnimT < 1) continue;  // not done materialising → leave it
      var accx = 0, accy = 0, touched = false;
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i];
        if (h.lifeFactor <= 0) continue;
        var dirx = h.dirx, diry = h.diry;
        var rx = en.x - h.ax, ry = en.y - h.ay;
        var t = rx * dirx + ry * diry;                 // along-axis distance from the upstream end
        var perpS = ry * dirx - rx * diry;             // signed perpendicular
        var perp = perpS < 0 ? -perpS : perpS;
        if (perp > WF) continue;                       // outside the lateral band entirely

        // Conveyor carry — only within the segment, smoothstepped like the player's.
        if (t > 0 && t < h.len) {
          var axial = t < ef ? smooth(t / ef) : (t > h.len - ef ? smooth((h.len - t) / ef) : 1);
          var lateral = perp <= W ? 1 : smooth(1 - (perp - W) / F);
          var s = h.lifeFactor * axial * lateral;
          if (s > 0.001) { accx += dirx * fs * s; accy += diry * fs * s; touched = true; }
        }

        // Exhaust LAUNCH near + just past the downstream mouth (anti-stack): bring
        // the along-flow velocity up to a target (no overshoot) so they keep moving
        // out, plus a lateral fan so they scatter rather than queue single-file.
        if (t > h.len - ez && t < h.len + ez * 0.5) {
          var zoneF = smooth((t - (h.len - ez)) / ez) * h.lifeFactor;
          if (zoneF > 0.02) {
            var vAlong = en.vx * dirx + en.vy * diry;
            var targetV = ejSpeed * zoneF;
            if (vAlong < targetV) { var addF = targetV - vAlong; en.vx += dirx * addF; en.vy += diry * addF; }
            var sgn = perpS >= 0 ? 1 : -1;
            if (perpS === 0) sgn = (e & 1) ? 1 : -1;
            en.vx += (-diry) * sgn * ejSpread * zoneF * s60;
            en.vy += (dirx)  * sgn * ejSpread * zoneF * s60;
            touched = true;
          }
        }
      }
      if (!touched) continue;
      if (accx !== 0 || accy !== 0) {
        var mag = Math.sqrt(accx * accx + accy * accy);
        if (mag > cap) { var k = cap / mag; accx *= k; accy *= k; }
        en.x += accx * s60;
        en.y += accy * s60;
      }
      if (en.x < -wLim) en.x = -wLim; else if (en.x > wLim) en.x = wLim;
      if (en.y < -wLim) en.y = -wLim; else if (en.y > wLim) en.y = wLim;
    }
  };

  /* ================================================================
     RENDER — one shared ADD layer; cull per-highway + per-mote to the view.
     ================================================================ */
  M._renderHighways = function (dt) {
    var g = this._highwayGfx;
    if (!g) return;
    g.clear();
    var cols = LA.getColors();
    var hs = this._highways;
    if (hs && hs.length) {
      var view = this.cameras.main.worldView;
      for (var i = 0; i < hs.length; i++) this._renderOneHighway(g, hs[i], view, cols);
    }
    // ---- Ride-invincibility aura around the arrow (fades out with the grace) ----
    if (this._highwayInvuln && this.p && this.p.state !== 'DEAD') {
      var p = this.p, gt = this.gameTime || 0;
      var fade = Math.min(1, (this._highwayInvulnT || 0) / C.HIGHWAY_INVULN_GRACE);
      var pulse = 0.6 + 0.4 * Math.sin(gt * 9);
      var rr = C.SIZE * 1.7 + 3 * pulse;
      g.fillStyle(cols.cyan, 0.10 * fade);
      g.fillCircle(p.x, p.y, rr * 1.18);
      g.lineStyle(2.4, COL_WHITE, 0.5 * pulse * fade);
      g.strokeCircle(p.x, p.y, rr);
      g.lineStyle(1.3, cols.cyan, 0.7 * fade);
      g.strokeCircle(p.x, p.y, rr * 0.76);
    }
  };

  M._renderOneHighway = function (g, h, view, cols) {
    var life = h.lifeFactor;
    if (life <= 0.004) return;

    // Whole-capsule AABB cull (expanded a touch for glow).
    var W  = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER, WF = W + F;
    var pad = WF + 40;
    var minx = Math.min(h.ax, h.bx) - pad, maxx = Math.max(h.ax, h.bx) + pad;
    var miny = Math.min(h.ay, h.by) - pad, maxy = Math.max(h.ay, h.by) + pad;
    if (maxx < view.x || minx > view.right || maxy < view.y || miny > view.bottom) return;

    var dirx = h.dirx, diry = h.diry, px = -diry, py = dirx;   // perp = (-diry, dirx)
    var ax = h.ax, ay = h.ay, len = h.len, cyan = cols.cyan;
    var vL = view.x - 80, vR = view.right + 80, vT = view.y - 80, vB = view.bottom + 80;

    // Visible axial window: draw-in sweep from the front, evaporation retract from the back.
    var t0 = h.dissolve > 0 ? smooth(h.dissolve) * len * 0.82 : 0;
    var t1 = h.sweep < 1 ? h.sweep * len : len;
    if (t1 <= t0 + 1) return;

    function pt(t, lat) {
      return { x: ax + dirx * t + px * lat, y: ay + diry * t + py * lat };
    }
    function onScreen(q) { return q.x >= vL && q.x <= vR && q.y >= vT && q.y <= vB; }

    // Spindle profile: half-width tapers smoothly to ~0 at the visible ends (no
    // flat cut). Short nose upstream, longer nose downstream → the shape itself
    // reads which way the flow runs.
    var niN = Math.min(NOSE_IN,  (t1 - t0) * 0.45);
    var noN = Math.min(NOSE_OUT, (t1 - t0) * 0.45);
    function bandHalf(t) {
      var a = (t - t0) / niN; if (a > 1) a = 1; else if (a < 0) a = 0;
      var b = (t1 - t) / noN; if (b > 1) b = 1; else if (b < 0) b = 0;
      return smooth(a < b ? a : b);
    }

    var A = life;                                          // base alpha
    var hot = 0.7 + 0.3 * Math.sin(h.shimmer * 3 + h.seed);

    // Sample the centreline + taper once, reuse for every layer.
    var sc = [];
    for (var k = 0; k <= BAND_N; k++) {
      var tk = t0 + (t1 - t0) * (k / BAND_N);
      sc.push({ x: ax + dirx * tk, y: ay + diry * tk, h: bandHalf(tk) });
    }

    // ---- Glowing tapered band (3 nested spindle polygons: halo → glow → core) ----
    function bandPoly(halfW, color, alpha) {
      if (alpha <= 0.003) return;
      g.fillStyle(color, alpha);
      g.beginPath();
      var s0 = sc[0], h0 = halfW * s0.h;
      g.moveTo(s0.x + px * h0, s0.y + py * h0);
      for (var a = 1; a <= BAND_N; a++) { var sa = sc[a], ha = halfW * sa.h; g.lineTo(sa.x + px * ha, sa.y + py * ha); }
      for (var b = BAND_N; b >= 0; b--) { var sb = sc[b], hb = halfW * sb.h; g.lineTo(sb.x - px * hb, sb.y - py * hb); }
      g.closePath(); g.fillPath();
    }
    bandPoly(WF * 1.12, cyan, 0.05 * A);
    bandPoly(WF,        cyan, 0.085 * A);
    bandPoly(W,         cyan, 0.12 * A * (0.85 + 0.15 * hot));

    // ---- Wavy edge lines (the "wind") — follow the spindle, converge at the tips ----
    function drawEdge(side, width, color, alpha) {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      for (var k2 = 0; k2 <= BAND_N; k2++) {
        var s = sc[k2];
        var tk2 = t0 + (t1 - t0) * (k2 / BAND_N);
        var wob = Math.sin(tk2 * EDGE_WOB_FREQ + h.shimmer * EDGE_WOB_SPD * side + side) * EDGE_WOB_AMP;
        var hw = (W + wob) * s.h;
        var qx = s.x + px * side * hw, qy = s.y + py * side * hw;
        if (k2 === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
      }
      g.strokePath();
    }
    drawEdge(1,  6, cyan, 0.10 * A); drawEdge(1,  2, COL_CORE, 0.75 * A * hot);
    drawEdge(-1, 6, cyan, 0.10 * A); drawEdge(-1, 2, COL_CORE, 0.75 * A * hot);

    // ---- Scan band: a bright cross-glow sweeping along the road ----
    var st = ((h.flowPhase * SCAN_PX_S) % len + len) % len;
    if (st > t0 && st < t1) {
      var scc = pt(st, 0);
      if (onScreen(scc)) {
        var hwS = W * bandHalf(st);
        var e1 = pt(st, hwS), e2 = pt(st, -hwS);
        g.lineStyle(5, COL_WHITE, 0.20 * A);
        g.beginPath(); g.moveTo(e1.x, e1.y); g.lineTo(e2.x, e2.y); g.strokePath();
      }
    }

    // ---- Flow motes — streaming streaks (kept inside the spindle by the taper) ----
    for (var mi = 0; mi < h.motes.length; mi++) {
      var mo = h.motes[mi];
      var mt = mo.u * len;
      if (mt <= t0 || mt >= t1) continue;
      var c = pt(mt, mo.lat * bandHalf(mt));
      if (!onScreen(c)) continue;
      var tail = { x: c.x - dirx * mo.len, y: c.y - diry * mo.len };
      var mA = A * mo.bright;
      g.lineStyle(mo.thick, cyan, 0.85 * mA);
      g.beginPath(); g.moveTo(tail.x, tail.y); g.lineTo(c.x, c.y); g.strokePath();
      g.fillStyle(COL_WHITE, 0.9 * mA);
      g.fillCircle(c.x, c.y, mo.thick * 0.62);
    }

    // ---- Scrolling ">>>" chevrons down the centre (unmistakable flow direction) ----
    var off = ((h.flowPhase * CHEV_PX_S) % CHEV_GAP + CHEV_GAP) % CHEV_GAP;
    for (var ct = off; ct < t1; ct += CHEV_GAP) {
      if (ct < t0) continue;
      var cc = pt(ct, 0);
      if (!onScreen(cc)) continue;
      var endFade = smooth(Math.min(ct - t0, t1 - ct) / 120);
      var travel  = 0.55 + 0.45 * Math.sin(ct * 0.02 - h.flowPhase * 6 + h.seed);
      var cA = A * endFade * travel;
      if (cA <= 0.02) continue;
      var chf = Math.max(0.35, bandHalf(ct));
      var tip = pt(ct + CHEV_SIZE * 0.5 * chf, 0);
      var bl  = pt(ct - CHEV_SIZE * 0.5 * chf,  CHEV_HALF * chf);
      var br  = pt(ct - CHEV_SIZE * 0.5 * chf, -CHEV_HALF * chf);
      g.lineStyle(4.5, cyan, 0.45 * cA);
      g.beginPath(); g.moveTo(bl.x, bl.y); g.lineTo(tip.x, tip.y); g.lineTo(br.x, br.y); g.strokePath();
      g.lineStyle(2, COL_CORE, 0.95 * cA);
      g.beginPath(); g.moveTo(bl.x, bl.y); g.lineTo(tip.x, tip.y); g.lineTo(br.x, br.y); g.strokePath();
    }

    // ---- Upstream INTAKE: just a soft glow at the pointed mouth ----
    if (t0 < 30) {
      var tipA = pt(0, 0);
      if (onScreen(tipA)) { g.fillStyle(COL_CORE, 0.30 * A * hot); g.fillCircle(tipA.x, tipA.y, 4); }
    }

    // ---- Downstream EXHAUST: just a soft glow at the pointed mouth ----
    if (t1 >= len - 2) {
      var tipB = pt(len, 0);
      if (onScreen(tipB)) { g.fillStyle(COL_CORE, 0.40 * A * hot); g.fillCircle(tipB.x, tipB.y, 4.5); }
    }

    // ---- Draw-in leading tip (only while forming): a bright comet head, not a bar ----
    if (h.sweep < 1) {
      var fc = pt(t1, 0);
      if (onScreen(fc)) {
        g.fillStyle(cyan, 0.32 * A);   g.fillCircle(fc.x, fc.y, 20);
        g.fillStyle(COL_WHITE, 0.85 * A); g.fillCircle(fc.x, fc.y, 9);
        var fp = pt(t1 + 18, 0);
        g.fillStyle(COL_CORE, 0.5 * A); g.fillCircle(fp.x, fp.y, 4);
      }
    }
  };

})();
