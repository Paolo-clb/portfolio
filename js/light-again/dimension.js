/* ==========================================================================
   Light Again — The FRACTURED DIMENSION

   Once every boss type has been beaten once, the next boss spawn is the first
   TEAM, gated behind a fixed 1000-kill ramp (both modes, see _advanceBossThreshold).

   • RAMP  — across those 1000 kills the GROUND tears open: glowing energy rifts
             crack across the arena floor (world-anchored, clipped to the disc),
             growing as the counter ticks down. (Transient telegraph.)
   • PORTAL— when the counter hits zero a cinematic plays (world frozen): the board
             is swept into the void, a portal yawns open over the player and engulfs
             the screen, then we EMERGE in the altered dimension.
   • AFTER — the dimension is visibly OTHER: the whole frame's colours are altered
             (camera colour-matrix) and the floor decor is pushed even harder; the
             rifts have faded; T4 snipers join the spawn bag. Persists for the run.

   Self-contained: a world-space ADD Graphics for the rifts + a screen-space
   Graphics for the portal + background postFX colour-matrices (per floor layer)
   + one CAMERA colour-matrix (recolours everything). Runs on REAL dt from
   scene.update via _updateDimension(dt); the portal is driven from a frozen
   branch in scene.update via _updateDimPortal(dt). Torn down by _clearDimension().
   Run-state flags live in _initUpgrades so they survive a tutorial relaunch.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  var RIFT_HALO = 0x7a2dff;   // violet outer bleed
  var RIFT_BODY = 0xe24dff;   // magenta channel
  var RIFT_CORE = 0xffffff;   // white-hot fracture line
  var RIFT_RGB  = [150, 70, 255];
  var CRACK_DEPTH  = -8;       // on the floor (pcbGlow is -9), under entities (10+)
  var PORTAL_DEPTH = 80;       // over the world, under the HUD (100+)

  function easeOut (u) { return 1 - (1 - u) * (1 - u); }
  function easeIn  (u) { return u * u; }

  /* ================================================================ */
  M._initDimension = function () {
    this._dimCrackGfx = null;   // WORLD-space rifts
    this._dimPortalGfx = null;  // SCREEN-space portal vortex
    this._dimBgCM = null; this._dimGlowCM = null; this._dimDeepCM = null;
    this._dimCamCM = null;      // CAMERA colour-matrix → recolours the whole frame
    this._dimCracks   = null;
    this._dimBuilt    = false;
    this._dimFloorTexOn = false;  // create() just rebuilt the floor with '_pcb'
    this._dimShimmerT = 0;
    this._dimFlashT   = 0;       // 0..1 flare boost (entry snap)
    this._dimCrackFade = 1;      // 1 while rifts show; decays to 0 after the snap
    this._dimBannerTxt = null;
    // Portal cinematic state
    this._dimPortalActive = false;
    this._dimPortalT = 0; this._dimPortalDone = false;
    this._dimPortalCX = 0; this._dimPortalCY = 0;
    this._dimPendingTeam = null; this._dimPendingTeamSize = 2;
  };

  /* Progress 0→1 across the fracture ramp (1 once we've fully entered). */
  M._dimFractureProgress = function () {
    if (this._dimFractured) return 1;
    if (!this._dimTransition) return 0;
    var done = this.totalKills - (this._fractureStartKills || 0);
    var span = C.DIM_FRACTURE_KILLS || 1000;
    return Math.max(0, Math.min(1, done / span));
  };

  /* ---- per-frame driver (REAL dt) ---- */
  M._updateDimension = function (dt) {
    if (!this._upgradeLevels) return;
    var active = this._dimTransition || this._dimFractured;
    if (!active || this._tutorialActive) { if (this._dimBuilt) this._dimSetIdle(); return; }

    if (!this._dimBuilt) this._dimBuild();

    var p = this._dimFractureProgress();
    this._dimShimmerT += dt;
    if (this._dimFlashT > 0) this._dimFlashT = Math.max(0, this._dimFlashT - dt * 1.5);
    if (this._dimFractured && this._dimCrackFade > 0) this._dimCrackFade = Math.max(0, this._dimCrackFade - dt / 1.25);

    // FLOOR decor drift — telegraphs during the ramp, full + held once fractured.
    var floorS = this._dimFractured ? 1 : (0.14 + 0.62 * p);
    floorS = Math.min(1, floorS + this._dimFlashT * 0.35);
    // WHOLE-FRAME recolour — barely there during the ramp, SNAPS on entry so the
    // dimension reads as a genuinely different place (everything altered).
    var camS = this._dimFractured ? 1 : (0.08 * p);
    camS = Math.min(1, camS + this._dimFlashT * 0.5);
    this._dimApplyPalette(floorS, camS);

    // Rifts: grow during the ramp; flare + fade after the snap, then stop drawing.
    if (this._dimCrackFade > 0.01) this._dimDrawCracks(this._dimFractured ? 1 : p, this._dimCrackFade);
    else if (this._dimCrackGfx) this._dimCrackGfx.clear();
  };

  /* ---- lazy build ---- */
  M._dimBuild = function () {
    var cam = this.cameras.main;
    var cg = this.add.graphics();            // WORLD-space (scrollFactor 1) → scrolls with the floor
    cg.setDepth(CRACK_DEPTH); cg.setBlendMode(Phaser.BlendModes.ADD);
    this._dimCrackGfx = cg;
    if (this.pcbTile && this.pcbTile.postFX) this._dimBgCM   = this.pcbTile.postFX.addColorMatrix();
    if (this.pcbGlow && this.pcbGlow.postFX) this._dimGlowCM = this.pcbGlow.postFX.addColorMatrix();
    if (this.pcbDeep && this.pcbDeep.postFX) this._dimDeepCM = this.pcbDeep.postFX.addColorMatrix();
    if (cam.postFX) this._dimCamCM = cam.postFX.addColorMatrix();   // recolours EVERYTHING
    this._dimCracks = this._dimGenCracks();
    this._dimBuilt  = true;
    // A relaunch (tutorial → run) can rebuild the scene with _dimFractured
    // already true — re-apply the altered floor lazily here.
    if (this._dimFractured) this._dimApplyFloorTex(true);
  };

  /* ---- altered-dimension floor: swap the three PCB layers (+ aurora + bg)
     to the dedicated violet tiles, and back. Idempotent. ---- */
  M._dimApplyFloorTex = function (on) {
    on = !!on;
    if (this._dimFloorTexOn === on) return;
    var tm = this.textures;
    if (on && (!tm.exists('_pcbDim') || !tm.exists('_pcbDimGlow'))) return;
    var cols = LA.getColors();
    if (this.pcbDeep && this.pcbDeep.scene) {
      this.pcbDeep.setTexture(on ? '_pcbDim' : '_pcb');
      this.pcbDeep.setTint(on ? C.DIM_DEEP_TINT : (cols.deepTint || 0x21364f));
    }
    if (this.pcbTile && this.pcbTile.scene) this.pcbTile.setTexture(on ? '_pcbDim' : '_pcb');
    if (this.pcbGlow && this.pcbGlow.scene) this.pcbGlow.setTexture(on ? '_pcbDimGlow' : '_pcbGlow');
    if (this._nebulaTile && this._nebulaTile.scene)
      this._nebulaTile.setTexture(on ? '_laNebulaDim' : '_laNebula');
    if (this.cameras && this.cameras.main)
      this.cameras.main.setBackgroundColor(on ? C.DIM_BG_COLOR : cols.bgColor);
    this._dimFloorTexOn = on;
  };

  M._dimSetIdle = function () {
    if (this._dimCrackGfx)  this._dimCrackGfx.clear();
    if (this._dimPortalGfx) this._dimPortalGfx.clear();
    this._dimApplyFloorTex(false);
    this._dimResetCM(this._dimBgCM); this._dimResetCM(this._dimGlowCM);
    this._dimResetCM(this._dimDeepCM); this._dimResetCM(this._dimCamCM);
  };
  M._dimResetCM = function (cm) { if (cm && cm.reset) cm.reset(); };

  /* ---- palette ----
     RAMP: the normal floor is progressively hue-shifted (telegraph) and the
     whole frame barely tinted.
     FRACTURED: the floor swaps to the dedicated violet tiles (_pcbDim), which
     carry the dimension's identity natively — so the floor matrices go idle
     and the whole-frame grade softens (otherwise it would double-shift the
     already-violet floor and drown the HUD). */
  M._dimApplyPalette = function (floorS, camS) {
    if (this._dimFractured && this._dimFloorTexOn) {
      this._dimResetCM(this._dimBgCM);
      this._dimResetCM(this._dimGlowCM);
      this._dimResetCM(this._dimDeepCM);
      this._dimCM(this._dimCamCM, camS, 40, 0.18, 0.10);
      return;
    }
    this._dimCM(this._dimBgCM,   floorS,         150, 0.55, 0.22);
    this._dimCM(this._dimGlowCM, Math.min(1, floorS * 1.15), 150, 0.7, 0.18);
    this._dimCM(this._dimDeepCM, floorS * 0.75,  150, 0.5, 0.2);
    // Whole frame: hue-shift EVERYTHING (floor, enemies, player, FX, HUD) so the
    // dimension reads as a genuinely other place — moderate so the HUD stays legible.
    this._dimCM(this._dimCamCM,  camS,          100,  0.38, 0.14);
  };
  M._dimCM = function (cm, s, hueDeg, sat, con) {
    if (!cm || !cm.reset) return;
    cm.reset();
    cm.hue(hueDeg * s);
    cm.saturate(sat * s, true);
    cm.contrast(con * s, true);
  };

  /* Pre-compensate a brand colour so the fractured-dimension CAMERA grade (the fixed
     hue +40° / saturation +18% applied once the floor swaps) lands it back on its
     TRUE colour. Graphics objects can't take their own postFX in this Phaser build,
     so a few signature elements (the Greed plate, the fairy Tree, the violet rim)
     pre-rotate their handful of brand colours each frame instead — cheap (a few ints,
     NOT per-pixel; the GPU still does the recolour), and the camera matrix then undoes
     the shift so they read native while the rest of the world stays graded. The maths
     is the exact inverse of _dimCM(camCM, 1, 40, 0.18, …) — verified to round-trip.
     Returns the colour untouched outside the fully-fractured dimension. */
  M._dimUntint = function (color) {
    if (!this._dimFloorTexOn) return color;
    var r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    // 1) inverse saturation — exact inverse of Phaser saturate(0.18)
    var sx = 0.898, sy = 0.051;
    var r1 = sx * r + sy * g + sy * b;
    var g1 = sy * r + sx * g + sy * b;
    var b1 = sy * r + sy * g + sx * b;
    // 2) inverse hue rotation (−40°, Phaser's exact hue matrix)
    var rad = -40 * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    var nr = (0.213 + c * 0.787 - s * 0.213) * r1 + (0.715 - c * 0.715 - s * 0.715) * g1 + (0.072 - c * 0.072 + s * 0.928) * b1;
    var ng = (0.213 - c * 0.213 + s * 0.143) * r1 + (0.715 + c * 0.285 + s * 0.140) * g1 + (0.072 - c * 0.072 - s * 0.283) * b1;
    var nb = (0.213 - c * 0.213 - s * 0.787) * r1 + (0.715 - c * 0.715 + s * 0.715) * g1 + (0.072 + c * 0.928 + s * 0.072) * b1;
    var cl = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; };
    return (cl(nr) << 16) | (cl(ng) << 8) | cl(nb);
  };

  /* ================================================================
     CRACK GEOMETRY — world coords, jittered grid across the disc, CLIPPED to the
     disc so rifts never spill onto the wall/void. Generated once; revealed by
     progress; view-culled at draw.
     ================================================================ */
  M._dimGenCracks = function () {
    var R = C.WORLD_HALF, lim = R - 40, step = 620, cracks = [];
    for (var gx = -R; gx <= R; gx += step) {
      for (var gy = -R; gy <= R; gy += step) {
        var cx = gx + (Math.random() - 0.5) * step * 0.85;
        var cy = gy + (Math.random() - 0.5) * step * 0.85;
        if (cx * cx + cy * cy > (R - 90) * (R - 90)) continue;   // start well inside the disc
        var crack = this._dimGrowCrack(cx, cy, Math.random() * TAU,
                                       4 + (Math.random() * 4 | 0), step * (0.22 + Math.random() * 0.18), lim);
        if (crack.pts.length < 2) continue;
        crack.startAt = Math.random() * 0.18;
        crack.width   = 0.8 + Math.random() * 0.6;
        crack.seed    = Math.random() * TAU;
        crack.branches = [];
        var forks = (Math.random() * 2.6) | 0;
        for (var b = 0; b < forks; b++) {
          var vi = 1 + ((Math.random() * (crack.pts.length - 1)) | 0);
          var bp = crack.pts[vi]; if (!bp) continue;
          var bAng = Math.atan2(bp.y - crack.pts[vi - 1].y, bp.x - crack.pts[vi - 1].x)
                   + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.6);
          var br = this._dimGrowCrack(bp.x, bp.y, bAng, 2 + (Math.random() * 3 | 0), step * (0.14 + Math.random() * 0.12), lim);
          if (br.pts.length >= 2) crack.branches.push(br);
        }
        this._dimBB(crack);
        cracks.push(crack);
      }
    }
    return cracks;
  };
  M._dimGrowCrack = function (x, y, ang, steps, seg, lim) {
    var pts = [{ x: x, y: y }], lim2 = lim * lim;
    for (var s = 0; s < steps; s++) {
      ang += (Math.random() - 0.5) * 0.95;
      var nx = x + Math.cos(ang) * seg, ny = y + Math.sin(ang) * seg;
      if (nx * nx + ny * ny > lim2) break;          // stop at the disc rim → never spill outside
      x = nx; y = ny; pts.push({ x: x, y: y });
    }
    return { pts: pts };
  };
  M._dimBB = function (ck) {
    var mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
    var scan = function (pts) {
      for (var i = 0; i < pts.length; i++) {
        var q = pts[i];
        if (q.x < mnx) mnx = q.x; if (q.x > mxx) mxx = q.x;
        if (q.y < mny) mny = q.y; if (q.y > mxy) mxy = q.y;
      }
    };
    scan(ck.pts);
    for (var b = 0; b < ck.branches.length; b++) scan(ck.branches[b].pts);
    ck.bb = { mnx: mnx, mny: mny, mxx: mxx, mxy: mxy };
  };

  M._dimDrawCracks = function (p, fade) {
    var g = this._dimCrackGfx; if (!g) return;
    g.clear();
    var cam = this.cameras.main, view = cam.worldView, m = 120;
    var zw = 1 / (cam.zoom || 1);
    var shimmer = this._dimShimmerT;
    var bright = (0.7 + 0.3 * Math.sin(shimmer * 2.2)) * fade + this._dimFlashT * 0.7;
    var cracks = this._dimCracks;
    for (var i = 0; i < cracks.length; i++) {
      var ck = cracks[i], bb = ck.bb;
      if (bb.mxx < view.x - m || bb.mnx > view.right + m || bb.mxy < view.y - m || bb.mny > view.bottom + m) continue;
      var rev = (p - ck.startAt) / 0.24; if (rev <= 0) continue; if (rev > 1) rev = 1;
      this._dimRift(g, ck.pts, rev, ck.width, bright, zw, ck.seed, shimmer);
      for (var b = 0; b < ck.branches.length; b++)
        this._dimRift(g, ck.branches[b].pts, rev, ck.width * 0.66, bright * 0.85, zw, ck.seed + b, shimmer);
    }
  };

  M._dimRift = function (g, pts, rev, wMul, bright, zw, seed, shimmer) {
    if (pts.length < 2) return;
    var last = 1 + rev * (pts.length - 1), nWhole = Math.floor(last), tip = null;
    if (nWhole < pts.length && last > nWhole) {
      var f = last - nWhole, a0 = pts[nWhole - 1], a1 = pts[nWhole];
      tip = { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f };
    }
    var passes = [
      { col: RIFT_HALO, w: 15 * wMul * zw, a: bright * 0.16 },
      { col: RIFT_BODY, w: 6.0 * wMul * zw, a: bright * 0.5 },
      { col: RIFT_CORE, w: 2.0 * wMul * zw, a: bright * 0.95 },
    ];
    for (var pz = 0; pz < passes.length; pz++) {
      var ps = passes[pz];
      g.lineStyle(ps.w, ps.col, Math.min(1, ps.a));
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      var v = 1;
      for (; v < nWhole && v < pts.length; v++) g.lineTo(pts[v].x, pts[v].y);
      if (tip) g.lineTo(tip.x, tip.y);
      g.strokePath();
    }
    for (var n = 0; n < nWhole && n < pts.length; n++) {
      g.fillStyle(RIFT_CORE, Math.min(1, bright * 0.5));
      g.fillCircle(pts[n].x, pts[n].y, (1.4 + 2.0 * wMul) * zw);
    }
    var pp = this._dimSampleAlong(pts, tip, nWhole, ((shimmer * 0.55 + seed) % 1));
    if (pp) {
      g.fillStyle(RIFT_CORE, Math.min(1, bright * 0.9)); g.fillCircle(pp.x, pp.y, (3.2 * wMul) * zw);
      g.fillStyle(RIFT_BODY, Math.min(1, bright * 0.55)); g.fillCircle(pp.x, pp.y, (6.5 * wMul) * zw);
    }
    for (var e = 0; e < 2 && e + 1 < nWhole; e++) {
      var ev = 1 + ((seed * 3 + e * 7) | 0) % Math.max(1, nWhole - 1);
      var emb = pts[ev]; if (!emb) continue;
      var fl = 0.5 + 0.5 * Math.sin(shimmer * 6 + seed * 4 + e * 2.1);
      g.fillStyle(RIFT_BODY, Math.min(1, bright * 0.5 * fl));
      g.fillCircle(emb.x + Math.cos(seed + e) * 6 * zw, emb.y + Math.sin(seed + e) * 6 * zw, (1.6 + 1.4 * fl) * zw);
    }
  };
  M._dimSampleAlong = function (pts, tip, nWhole, f) {
    var verts = nWhole; if (tip) verts += 1;
    if (verts < 2) return null;
    var t = f * (verts - 1), i = Math.floor(t), frac = t - i;
    var a = pts[i] || pts[pts.length - 1], bIdx = i + 1;
    var b = (bIdx < nWhole) ? pts[bIdx] : (tip || pts[Math.min(bIdx, pts.length - 1)]);
    if (!a || !b) return null;
    return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
  };

  /* ================================================================
     PORTAL CINEMATIC — fired when the counter hits zero (world frozen via
     scene.update). Sweeps the board into the void, a vortex engulfs the player,
     then we emerge in the altered dimension as the first team spawns.
     ================================================================ */
  M._beginDimPortal = function () {
    if (this._dimPortalActive) return;
    if (!this._dimBuilt) this._dimBuild();
    var cam = this.cameras.main;
    this._dimPortalActive = true; this._dimPortalT = 0; this._dimPortalDone = false;
    this._dimPortalCX = cam.width / 2;        // camera tracks the player → screen centre
    this._dimPortalCY = cam.height / 2;
    if (!this._dimPortalGfx) {
      var pg = this.add.graphics(); pg.setScrollFactor(0); pg.setDepth(PORTAL_DEPTH);
      pg.setBlendMode(Phaser.BlendModes.ADD); this._dimPortalGfx = pg;
    }
    // Sweep the board into the rift — every enemy imploded, bullets gone.
    var i;
    for (i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      this._explode(e.x, e.y, RIFT_RGB, 12);
      this._explode(e.x, e.y, [255, 255, 255], 4);
      if (this._destroyEnemyNoScore) this._destroyEnemyNoScore(i, true);
    }
    if (this.enemies) this.enemies.length = 0;
    for (i = this.projectiles.length - 1; i >= 0; i--) {
      var pr = this.projectiles[i];
      if (pr.isReflected) continue;
      this._destroyProjectile(pr); this.projectiles.splice(i, 1);
    }
    var reach = Math.sqrt(cam.width * cam.width + cam.height * cam.height) * 0.6;
    this._spawnWaveRing(this.p.x, this.p.y, { maxRadius: reach, color: RIFT_BODY, expandTime: 0.4 });
    cam.shake(360, 0.012);
    this._triggerHitstop(80);
  };

  /* Driven on REAL dt from the frozen branch in scene.update. */
  M._updateDimPortal = function (dt) {
    this._dimPortalT += dt;
    var t = this._dimPortalT;
    this._dimDrawPortal(t);
    if (!this._dimPortalDone && t >= 2.2) this._dimPortalFinish();
  };

  M._dimDrawPortal = function (t) {
    var g = this._dimPortalGfx; if (!g) return;
    g.clear();
    var cam = this.cameras.main, cx = this._dimPortalCX, cy = this._dimPortalCY;
    var W = cam.width, H = cam.height, diag = Math.sqrt(W * W + H * H);
    var maxR = Math.min(W, H) * 0.46, spin = t * 3.0, k;

    if (t < 0.45) {                                   // GATHER — energy contracts to a point
      var c = t / 0.45, rad = (1 - c) * Math.min(W, H) * 0.42 + 26;
      g.lineStyle(4, RIFT_BODY, 0.45 * (1 - c) + 0.2); g.strokeCircle(cx, cy, rad);
      for (k = 0; k < 18; k++) {
        var ga = spin + k / 18 * TAU, gr = rad * (0.6 + 0.4 * Math.sin(t * 8 + k));
        g.fillStyle(RIFT_CORE, 0.5 * c + 0.2); g.fillCircle(cx + Math.cos(ga) * gr, cy + Math.sin(ga) * gr, 2.2);
      }
      g.fillStyle(RIFT_CORE, c * 0.7); g.fillCircle(cx, cy, 10 * c);

    } else if (t < 1.6) {                             // OPEN — the vortex yawns wide
      var o = easeOut((t - 0.45) / 1.15), rad = maxR * (0.12 + 0.88 * o);
      for (var ring = 0; ring < 4; ring++) {           // counter-rotating broken bands
        var rr = rad * (0.35 + ring * 0.22), dir = (ring % 2 ? -1 : 1);
        var col = ring % 2 ? RIFT_BODY : RIFT_HALO;
        g.lineStyle(3 + o * 4, col, 0.5);
        var segs = 6;
        for (var s = 0; s < segs; s++) {
          var a0 = spin * dir * (1 + ring * 0.3) + s / segs * TAU;
          g.beginPath(); g.arc(cx, cy, rr, a0, a0 + (TAU / segs) * 0.62, false); g.strokePath();
        }
      }
      for (k = 0; k < 26; k++) {                        // particles spiralling inward
        var pa = -spin * 1.4 + k / 26 * TAU, pr = rad * (0.2 + 0.8 * ((t * 0.4 + k / 26) % 1));
        g.fillStyle(k % 2 ? RIFT_CORE : RIFT_BODY, 0.7); g.fillCircle(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr, 2.4);
      }
      g.fillStyle(RIFT_BODY, 0.35); g.fillCircle(cx, cy, rad * 0.32);
      g.fillStyle(RIFT_CORE, 0.85); g.fillCircle(cx, cy, 14 + 6 * Math.sin(spin * 4));

    } else {                                          // ENGULF — the rift swallows the screen
      var e = Math.min(1, (t - 1.6) / 0.6), engR = maxR + (diag * 0.78 - maxR) * easeIn(e);
      g.fillStyle(RIFT_HALO, Math.min(1, 0.55 + 0.45 * e)); g.fillCircle(cx, cy, engR);
      g.fillStyle(RIFT_BODY, Math.min(1, 0.6 + 0.4 * e)); g.fillCircle(cx, cy, engR * 0.72);
      g.fillStyle(RIFT_CORE, e); g.fillCircle(cx, cy, engR * (0.3 + 0.4 * e));
    }
  };

  M._dimPortalFinish = function () {
    this._dimPortalDone   = true;
    this._dimPortalActive = false;
    if (this._dimPortalGfx) this._dimPortalGfx.clear();
    // Snap into the dimension (palette flip + flash + banner + rift flare→fade)…
    this._enterDimensionCinematic();
    // …and the first team arrives in the new world.
    if (this._spawnTeamNow && this._dimPendingTeam) {
      this._spawnTeamNow(this._dimPendingTeam);
      var NUM = (M._BOSS_TYPES || []).length || 4;
      this._bossTeamSize = Math.min((this._dimPendingTeamSize || 2) + 1, NUM);
    }
    this._dimPendingTeam = null;
  };

  /* The colour/flash snap (called at portal EMERGE). Sets _dimFractured. */
  M._enterDimensionCinematic = function () {
    this._dimTransition = false;
    this._dimFractured  = true;
    if (!this._dimBuilt) this._dimBuild();
    this._dimApplyFloorTex(true); // the floor itself becomes OTHER (violet fissured tiles)

    // Re-skin any rushers already on the board to the warmer, more-orange dimension
    // variant so the fracture lands consistently (new spawns already use it). texKey
    // always updates; the live sprite is only swapped when it's showing its normal
    // skin (a TW / mark gray swap restores from texKey when it ends → picks this up).
    for (var ei = 0; ei < this.enemies.length; ei++) {
      var re = this.enemies[ei];
      if (re.tier !== 1 || re.texKey === '_enemy_dim') continue;
      re.texKey = '_enemy_dim';
      if (!re._twGrayed && !re._markGrayed) {
        if (re.spr) re.spr.setTexture('_enemy_dim');
        for (var ri = 0; ri < re.trSpr.length; ri++) re.trSpr[ri].setTexture('_enemy_dim');
      }
    }

    this._dimFlashT    = 1.0;     // rifts + palette flare
    this._dimCrackFade = 1.0;     // …then the rifts fade out over ~1.25s

    var cam = this.cameras.main;
    cam.flash(460, RIFT_RGB[0], RIFT_RGB[1], RIFT_RGB[2], false);
    cam.shake(420, 0.02);
    this._triggerHitstop(120);
    var zoom = cam.zoom || 1;
    var reach = Math.sqrt(cam.width * cam.width + cam.height * cam.height) * 0.5 / zoom + 540;
    this._spawnWaveRing(this.p.x, this.p.y, { maxRadius: reach,        color: RIFT_BODY, expandTime: 0.62 });
    this._spawnWaveRing(this.p.x, this.p.y, { maxRadius: reach * 0.55, color: RIFT_CORE, expandTime: 0.44 });
    this._explode(this.p.x, this.p.y, RIFT_RGB, 40);
    this._explode(this.p.x, this.p.y, [255, 255, 255], 24);
    if (this._bloomFX && this._bloomFX.blurStrength != null) {
      var bf = this._bloomFX, prevBS = bf.blurStrength;
      bf.blurStrength = prevBS + 1.4;
      this.time.delayedCall(460, function () { if (bf) bf.blurStrength = prevBS; });
    }
    this._dimShowBanner();
  };

  M._dimShowBanner = function () {
    var cam = this.cameras.main;
    if (this._dimBannerTxt) { this._dimBannerTxt.destroy(); this._dimBannerTxt = null; }
    var txt = this.add.text(cam.width / 2, cam.height * 0.42, 'DIMENSION FRACTURÉE', {
      fontFamily: 'monospace', fontSize: '46px', fontStyle: 'bold',
      color: '#f0d6ff', stroke: '#1a0030', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#e24dff', blur: 22, fill: true },
    });
    txt.setOrigin(0.5, 0.5); txt.setScrollFactor(0); txt.setDepth(110);
    txt.setAlpha(0); txt.setScale(0.6);
    this._dimBannerTxt = txt;
    var self = this;
    this.tweens.add({ targets: txt, scaleX: 1, scaleY: 1, alpha: 1, duration: 360, ease: 'Back.easeOut' });
    this.tweens.add({ targets: txt, alpha: 0, scaleX: 1.12, scaleY: 1.12, duration: 700, ease: 'Cubic.easeIn', delay: 1500,
      onComplete: function () { if (self._dimBannerTxt === txt) self._dimBannerTxt = null; txt.destroy(); } });
  };

  /* ---- teardown ---- */
  M._clearDimension = function () {
    this._dimApplyFloorTex(false);
    if (this._dimCrackGfx)  { this._dimCrackGfx.destroy();  this._dimCrackGfx = null; }
    if (this._dimPortalGfx) { this._dimPortalGfx.destroy(); this._dimPortalGfx = null; }
    if (this._dimBannerTxt) { this._dimBannerTxt.destroy(); this._dimBannerTxt = null; }
    this._dimBgCM = null; this._dimGlowCM = null; this._dimDeepCM = null; this._dimCamCM = null;
    this._dimBuilt = false; this._dimCracks = null; this._dimCrackFade = 1;
    this._dimPortalActive = false; this._dimPortalDone = false; this._dimPendingTeam = null;
  };
})();
