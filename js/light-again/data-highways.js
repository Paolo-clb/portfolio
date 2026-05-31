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
  var EDGE_N        = 58;    // samples used to draw the wavy edge lines
  var EDGE_WOB_AMP  = 6;     // edge wobble amplitude (px) — the "wind" ripple
  var EDGE_WOB_FREQ = 0.019; // edge wobble spatial frequency
  var EDGE_WOB_SPD  = 3.4;   // edge wobble scroll speed

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
  // frozen time). Bosses otherwise are FAIR GAME — a highway is great for dodging.
  M._highwaysSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomalyBarrierActive || this._anomalyIntroActive ||
              this._twActive || !this.p || this.p.state === 'DEAD');
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
    if (!this._highwaysSpawnSuspended()) this._maybeSpawnHighway(dt);

    var hs = this._highways;
    for (var i = hs.length - 1; i >= 0; i--) {
      this._tickHighway(hs[i], dt);
      if (hs[i].dead) hs.splice(i, 1);
    }
    this._renderHighways(dt);
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
  M._applyHighwayFlow = function (pS60) {
    var hs = this._highways;
    if (!hs || !hs.length) { this._highwayBoost = 0; return; }
    if (this._anomalyBarrierActive) { this._highwayBoost = 0; return; }  // quarantine owns the player
    var p = this.p;
    if (!p || p.state === 'DEAD') { this._highwayBoost = 0; return; }

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
     Called from update() right after _updateEnemies. Projectiles are NOT swept
     (the user kept those on rails). */
  M._applyHighwayFlowToEnemies = function (s60) {
    var hs = this._highways;
    if (!hs || !hs.length || s60 <= 0) return;
    if (this._anomalyBarrierActive) return;   // don't fight the quarantine's confinement
    var enemies = this.enemies;
    if (!enemies || !enemies.length) return;

    var fs  = C.HIGHWAY_FLOW_SPEED * C.HIGHWAY_ENEMY_FLOW_MULT;
    var cap = fs * C.HIGHWAY_FLOW_CAP_MULT;
    var wLim = C.WORLD_HALF - C.SIZE;     // belt-and-suspenders edge guard (unreachable in practice)

    for (var e = 0; e < enemies.length; e++) {
      var en = enemies[e];
      if (en._spawnAnimT != null && en._spawnAnimT < 1) continue;  // not done materialising → leave it
      var accx = 0, accy = 0;
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i];
        var s = this._highwayStrength(h, en.x, en.y);
        if (s <= 0.001) continue;
        accx += h.dirx * fs * s;
        accy += h.diry * fs * s;
      }
      if (accx === 0 && accy === 0) continue;
      var mag = Math.sqrt(accx * accx + accy * accy);
      if (mag > cap) { var k = cap / mag; accx *= k; accy *= k; }
      en.x += accx * s60;
      en.y += accy * s60;
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
    var hs = this._highways;
    if (!hs || !hs.length) return;
    var view = this.cameras.main.worldView;
    var cols = LA.getColors();
    for (var i = 0; i < hs.length; i++) this._renderOneHighway(g, hs[i], view, cols);
  };

  M._renderOneHighway = function (g, h, view, cols) {
    var life = h.lifeFactor;
    if (life <= 0.004) return;

    // Whole-capsule AABB cull (expanded a touch for glow).
    var W  = C.HIGHWAY_HALF_WIDTH, F = C.HIGHWAY_EDGE_FEATHER, WF = W + F;
    var minx = Math.min(h.ax, h.bx) - WF - 40, maxx = Math.max(h.ax, h.bx) + WF + 40;
    var miny = Math.min(h.ay, h.by) - WF - 40, maxy = Math.max(h.ay, h.by) + WF + 40;
    if (maxx < view.x || minx > view.right || maxy < view.y || miny > view.bottom) return;

    var dirx = h.dirx, diry = h.diry, px = -diry, py = dirx;   // perp = (-diry, dirx)
    var ax = h.ax, ay = h.ay, len = h.len, cyan = cols.cyan;
    var vL = view.x - 70, vR = view.right + 70, vT = view.y - 70, vB = view.bottom + 70;

    // Visible axial window: draw-in sweep from the front, evaporation retract from the back.
    var t0 = h.dissolve > 0 ? smooth(h.dissolve) * len * 0.82 : 0;
    var t1 = h.sweep < 1 ? h.sweep * len : len;
    if (t1 <= t0 + 1) return;

    function pt(t, lat) {
      return { x: ax + dirx * t + px * lat, y: ay + diry * t + py * lat };
    }
    function quad(ta, tb, lat, color, alpha) {
      if (alpha <= 0.003) return;
      var p1 = pt(ta, -lat), p2 = pt(tb, -lat), p3 = pt(tb, lat), p4 = pt(ta, lat);
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.lineTo(p3.x, p3.y); g.lineTo(p4.x, p4.y);
      g.closePath(); g.fillPath();
    }
    function onScreen(q) { return q.x >= vL && q.x <= vR && q.y >= vT && q.y <= vB; }

    var A = life;                                          // base alpha
    var hot = 0.7 + 0.3 * Math.sin(h.shimmer * 3 + h.seed);

    // ---- Glowing band (3 nested fills: halo → glow → core) ----
    quad(t0, t1, WF * 1.12, cyan, 0.045 * A);
    quad(t0, t1, WF,        cyan, 0.075 * A);
    quad(t0, t1, W,         cyan, 0.11 * A * (0.85 + 0.15 * hot));

    // ---- Wavy edge lines (the "wind") — soft wide pass then crisp bright pass ----
    function drawEdge(side, width, color, alpha) {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      var started = false;
      for (var k = 0; k <= EDGE_N; k++) {
        var t = t0 + (t1 - t0) * (k / EDGE_N);
        var wob = Math.sin(t * EDGE_WOB_FREQ + h.shimmer * EDGE_WOB_SPD * side + side) * EDGE_WOB_AMP;
        var q = pt(t, side * (W + wob));
        if (!started) { g.moveTo(q.x, q.y); started = true; } else g.lineTo(q.x, q.y);
      }
      g.strokePath();
    }
    drawEdge(1,  6, cyan, 0.10 * A); drawEdge(1,  2, COL_CORE, 0.75 * A * hot);
    drawEdge(-1, 6, cyan, 0.10 * A); drawEdge(-1, 2, COL_CORE, 0.75 * A * hot);

    // ---- Scan band: a bright cross-glow sweeping along the road ----
    var st = ((h.flowPhase * SCAN_PX_S) % len + len) % len;
    if (st > t0 && st < t1) {
      var sc = pt(st, 0);
      if (sc.x >= vL && sc.x <= vR && sc.y >= vT && sc.y <= vB) {
        var e1 = pt(st, W), e2 = pt(st, -W);
        g.lineStyle(5, COL_WHITE, 0.20 * A);
        g.beginPath(); g.moveTo(e1.x, e1.y); g.lineTo(e2.x, e2.y); g.strokePath();
      }
    }

    // ---- Flow motes — streaming streaks (the "lines of code / cyan particles") ----
    for (var mi = 0; mi < h.motes.length; mi++) {
      var mo = h.motes[mi];
      var mt = mo.u * len;
      if (mt <= t0 || mt >= t1) continue;
      var c = pt(mt, mo.lat);
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
      // Fade chevrons near both ends so they don't pop at the mouths.
      var endFade = smooth(Math.min(ct - t0, t1 - ct) / 120);
      var travel  = 0.55 + 0.45 * Math.sin(ct * 0.02 - h.flowPhase * 6 + h.seed);
      var cA = A * endFade * travel;
      if (cA <= 0.02) continue;
      var tip = pt(ct + CHEV_SIZE * 0.5, 0);
      var bl  = pt(ct - CHEV_SIZE * 0.5,  CHEV_HALF);
      var br  = pt(ct - CHEV_SIZE * 0.5, -CHEV_HALF);
      g.lineStyle(4.5, cyan, 0.45 * cA);
      g.beginPath(); g.moveTo(bl.x, bl.y); g.lineTo(tip.x, tip.y); g.lineTo(br.x, br.y); g.strokePath();
      g.lineStyle(2, COL_CORE, 0.95 * cA);
      g.beginPath(); g.moveTo(bl.x, bl.y); g.lineTo(tip.x, tip.y); g.lineTo(br.x, br.y); g.strokePath();
    }

    // ---- End mouths: a soft intake at A, an exhaust flare at B ----
    if (t0 < 30) {
      var mouthA = pt(0, 0);
      if (onScreen(mouthA)) {
        g.fillStyle(cyan, 0.18 * A); g.fillCircle(mouthA.x, mouthA.y, WF * 0.7);
        g.fillStyle(COL_CORE, 0.35 * A * hot); g.fillCircle(mouthA.x, mouthA.y, W * 0.4);
      }
    }
    if (t1 >= len - 2) {
      var mouthB = pt(len, 0);
      if (onScreen(mouthB)) {
        g.fillStyle(COL_WHITE, 0.30 * A * hot); g.fillCircle(mouthB.x, mouthB.y, W * 0.5);
        // a few exhaust streaks shooting off the downstream mouth
        for (var ei = 0; ei < 4; ei++) {
          var sp = (ei / 4 - 0.5) * W * 1.1;
          var o  = pt(len, sp), tip2 = { x: o.x + dirx * (26 + ei * 4), y: o.y + diry * (26 + ei * 4) };
          g.lineStyle(2, cyan, 0.5 * A * (0.5 + 0.5 * Math.sin(h.shimmer * 6 + ei)));
          g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(tip2.x, tip2.y); g.strokePath();
        }
      }
    }

    // ---- Draw-in wavefront (only while forming): a bright bar racing along ----
    if (h.sweep < 1) {
      var f1 = pt(t1, WF), f2 = pt(t1, -WF), fc = pt(t1, 0);
      g.lineStyle(4, COL_WHITE, 0.9 * A);
      g.beginPath(); g.moveTo(f1.x, f1.y); g.lineTo(f2.x, f2.y); g.strokePath();
      g.fillStyle(COL_WHITE, 0.6 * A); g.fillCircle(fc.x, fc.y, 11);
      g.fillStyle(cyan, 0.3 * A); g.fillCircle(fc.x, fc.y, 22);
    }
  };

})();
