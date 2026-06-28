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
  var RIFT_CYAN = 0x00e5ff;   // glitch-slice accent (echoes the dim floor's chromatic shear)
  var RIFT_RGB  = [150, 70, 255];
  var CRACK_DEPTH  = -8;       // on the floor (pcbGlow is -9), under entities (10+)
  var EYE_DEPTH    = 79;       // dimension eye-tokens (over the world, just under the portal)
  var PORTAL_DEPTH = 80;       // over the world, under the HUD (100+)

  function easeOut (u) { return 1 - (1 - u) * (1 - u); }
  function easeIn  (u) { return u * u; }
  function clamp01 (u) { return u < 0 ? 0 : u > 1 ? 1 : u; }

  /* Almond "eye" outline (shared with the T4 sniper's lens): two sine-curved lids
     meeting at the corners (±hw, 0) and bowing apart by ho at the centre. ho is the
     eyelid OPENING (0 = a shut line). Rotated by (ca,sa) and centred at (cx,cy).
     Leaves a closed path ready for fillPath()/strokePath(). */
  function eyeAlmond (g, cx, cy, ca, sa, hw, ho, N) {
    g.beginPath();
    var k, t, x, y, wx, wy;
    for (k = 0; k <= N; k++) {
      t = k / N; x = -hw + 2 * hw * t; y = -ho * Math.sin(Math.PI * t);
      wx = cx + x * ca - y * sa; wy = cy + x * sa + y * ca;
      if (k === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
    }
    for (k = N; k >= 0; k--) {
      t = k / N; x = -hw + 2 * hw * t; y = ho * Math.sin(Math.PI * t);
      wx = cx + x * ca - y * sa; wy = cy + x * sa + y * ca;
      g.lineTo(wx, wy);
    }
    g.closePath();
  }

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
    this._dimCrackHold = 0;      // seconds the rifts stay at full before fading (entry)
    this._dimBannerTxt = null;
    // Portal cinematic state
    this._dimPortalActive = false;
    this._dimPortalT = 0; this._dimPortalDone = false;
    this._dimPortalCX = 0; this._dimPortalCY = 0;
    this._dimPendingTeam = null; this._dimPendingTeamSize = 2;
    this._dimEyeGfx = null;      // WORLD-space graphics for the enemy→eye tokens
    this._dimEyeTokens = null;   // visible enemies turned into staring dimension eyes
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
    if (!active || this._tutorialActive) { if (this._dimBuilt && !this._dimIsIdle) { this._dimIsIdle = true; this._dimSetIdle(); } return; }
    this._dimIsIdle = false;

    if (!this._dimBuilt) this._dimBuild();

    var p = this._dimFractureProgress();
    this._dimShimmerT += dt;
    if (this._dimFlashT > 0) this._dimFlashT = Math.max(0, this._dimFlashT - dt * 1.5);
    // On entry the rifts that tore the OLD arena open carry over into the new
    // dimension: they HOLD at full for a beat (so you clearly read every fracture)
    // and only THEN fade out — slower than before, so they linger a little longer.
    if (this._dimFractured) {
      if (this._dimCrackHold > 0) this._dimCrackHold = Math.max(0, this._dimCrackHold - dt);
      else if (this._dimCrackFade > 0) this._dimCrackFade = Math.max(0, this._dimCrackFade - dt / 2.1);
    }

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
    if (this._dimEyeGfx)    this._dimEyeGfx.clear();
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
      // The World OWNS the frame while it's active (its own greyscale on the floor +
      // grey enemy textures): drop the dimension's whole-frame hue-shift so TW and its
      // gold/red effects read in their TRUE colours, not the violet dimension grade.
      // _dimUntint also goes identity under TW (below), so every untinted element
      // (core/prism/HUD/tree) stays native too. Restored next frame when TW ends.
      if (this._twActive) this._dimResetCM(this._dimCamCM);
      else this._dimCM(this._dimCamCM, camS, 40, 0.18, 0.10);
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
    // Identity outside the fully-fractured dimension, AND while The World is active
    // (the camera grade is dropped during TW, so there's nothing to pre-compensate).
    if (!this._dimFloorTexOn || this._twActive) return color;
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

  /* FORWARD of _dimUntint: apply the fractured-dimension camera grade (hue +40° /
     saturation +18%) to a colour. The live rifts that crack the floor open during
     the RAMP are drawn BEFORE the camera grade kicks in (camS ≈ 0), so on their own
     they read in the raw violet palette — NOT the warmer pink the SAME fractures take
     on once you're inside the dimension (where every pixel, floor cracks included, is
     graded). Pre-grading the ramp rifts here makes them preview that exact dimension
     colour, so the tear telegraphs the place it's opening into. Round-trips with
     _dimUntint (S·H · H⁻¹·S⁻¹ = I). */
  M._dimGradeColor = function (color) {
    var r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    // 1) hue rotation (+40°, Phaser's exact hue matrix)
    var rad = 40 * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    var hr = (0.213 + c * 0.787 - s * 0.213) * r + (0.715 - c * 0.715 - s * 0.715) * g + (0.072 - c * 0.072 + s * 0.928) * b;
    var hg = (0.213 - c * 0.213 + s * 0.143) * r + (0.715 + c * 0.285 + s * 0.140) * g + (0.072 - c * 0.072 - s * 0.283) * b;
    var hb = (0.213 - c * 0.213 - s * 0.787) * r + (0.715 - c * 0.715 + s * 0.715) * g + (0.072 + c * 0.928 + s * 0.072) * b;
    // 2) saturation (+0.18 → Phaser saturate: x = 1.12, y = -0.06)
    var nr = 1.12 * hr - 0.06 * hg - 0.06 * hb;
    var ng = -0.06 * hr + 1.12 * hg - 0.06 * hb;
    var nb = -0.06 * hr - 0.06 * hg + 1.12 * hb;
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
    // During the RAMP the camera grade hasn't kicked in yet, so pre-grade the rift
    // palette to the colour these same fractures take inside the dimension. Once
    // fractured, the live camera matrix grades the (world-space) rift gfx for real,
    // so we draw the raw palette and let it land identically — no pop at the snap.
    var pre = !this._dimFractured;
    var halo = pre ? this._dimGradeColor(RIFT_HALO) : RIFT_HALO;
    var body = pre ? this._dimGradeColor(RIFT_BODY) : RIFT_BODY;
    var core = RIFT_CORE;   // white is grade-invariant
    var cracks = this._dimCracks;
    for (var i = 0; i < cracks.length; i++) {
      var ck = cracks[i], bb = ck.bb;
      if (bb.mxx < view.x - m || bb.mnx > view.right + m || bb.mxy < view.y - m || bb.mny > view.bottom + m) continue;
      var rev = (p - ck.startAt) / 0.24; if (rev <= 0) continue; if (rev > 1) rev = 1;
      this._dimRift(g, ck.pts, rev, ck.width, bright, zw, ck.seed, shimmer, halo, body, core);
      for (var b = 0; b < ck.branches.length; b++)
        this._dimRift(g, ck.branches[b].pts, rev, ck.width * 0.66, bright * 0.85, zw, ck.seed + b, shimmer, halo, body, core);
    }
  };

  M._dimRift = function (g, pts, rev, wMul, bright, zw, seed, shimmer, halo, body, core) {
    if (pts.length < 2) return;
    halo = halo || RIFT_HALO; body = body || RIFT_BODY; core = core || RIFT_CORE;
    var last = 1 + rev * (pts.length - 1), nWhole = Math.floor(last), tip = null;
    if (nWhole < pts.length && last > nWhole) {
      var f = last - nWhole, a0 = pts[nWhole - 1], a1 = pts[nWhole];
      tip = { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f };
    }
    var pCol, pW, pA, pz;
    for (pz = 0; pz < 3; pz++) {
      if (pz === 0)      { pCol = halo; pW = 15 * wMul * zw; pA = bright * 0.16; }
      else if (pz === 1) { pCol = body; pW = 6.0 * wMul * zw; pA = bright * 0.5; }
      else               { pCol = core; pW = 2.0 * wMul * zw; pA = bright * 0.95; }
      g.lineStyle(pW, pCol, Math.min(1, pA));
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      var v = 1;
      for (; v < nWhole && v < pts.length; v++) g.lineTo(pts[v].x, pts[v].y);
      if (tip) g.lineTo(tip.x, tip.y);
      g.strokePath();
    }
    for (var n = 0; n < nWhole && n < pts.length; n++) {
      g.fillStyle(core, Math.min(1, bright * 0.5));
      g.fillCircle(pts[n].x, pts[n].y, (1.4 + 2.0 * wMul) * zw);
    }
    var pp = this._dimSampleAlong(pts, tip, nWhole, ((shimmer * 0.55 + seed) % 1));
    if (pp) {
      g.fillStyle(core, Math.min(1, bright * 0.9)); g.fillCircle(pp.x, pp.y, (3.2 * wMul) * zw);
      g.fillStyle(body, Math.min(1, bright * 0.55)); g.fillCircle(pp.x, pp.y, (6.5 * wMul) * zw);
    }
    for (var e = 0; e < 2 && e + 1 < nWhole; e++) {
      var ev = 1 + ((seed * 3 + e * 7) | 0) % Math.max(1, nWhole - 1);
      var emb = pts[ev]; if (!emb) continue;
      var fl = 0.5 + 0.5 * Math.sin(shimmer * 6 + seed * 4 + e * 2.1);
      g.fillStyle(body, Math.min(1, bright * 0.5 * fl));
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
     scene.update). Every enemy still ON SCREEN becomes a staring dimension EYE; a
     colossal eye then forms over the player, OPENS (the small eyes blink out as it
     does) and immediately BLINKS SHUT — and the instant its lids fully close we're
     in the altered dimension as the first team spawns.

     Timeline (seconds): FORM 0–0.5 (shut slit, small eyes staring) → OPEN 0.5–1.35
     (lids part, small eyes implode) → CLOSE 1.35–2.2 (lids shut at the SAME speed as
     they opened — no hold open → engulf flash → teleport). A symmetric blink.
     ================================================================ */
  var FORM_END = 0.5, OPEN_END = 1.35, CLOSE_END = 2.2;   // open span == close span (0.85s each)

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
    if (!this._dimEyeGfx) {                    // WORLD-space (scrollFactor 1) → the eyes sit where the enemies were
      var eg = this.add.graphics(); eg.setDepth(EYE_DEPTH);
      eg.setBlendMode(Phaser.BlendModes.ADD); this._dimEyeGfx = eg;
    }
    // The board doesn't just blink out: every enemy STILL ON SCREEN becomes a
    // dimension eye (a sibling of the T4 lens — but organic + violet, no scope) that
    // turns to stare at the player, then snaps shut + implodes as the great eye opens.
    // Off-screen enemies are swept silently. Bullets gone.
    var view = cam.worldView, m = 70, toks = [];
    var i;
    for (i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      var onScreen = e.x >= view.x - m && e.x <= view.right + m && e.y >= view.y - m && e.y <= view.bottom + m;
      if (onScreen) {
        toks.push({
          x: e.x, y: e.y,
          size: Math.max(11, (e.size || 14) * 1.15),
          ang: Math.atan2(this.p.y - e.y, this.p.x - e.x),   // looks at the player
          seed: Math.random() * TAU,
          vanishAt: FORM_END + Math.random() * 0.3,          // pops as the great eye opens
          imploded: false,
        });
        this._explode(e.x, e.y, RIFT_RGB, 5);                // a soft violet poof as it morphs
      }
      if (this._destroyEnemyNoScore) this._destroyEnemyNoScore(i, true);
    }
    if (this.enemies) this.enemies.length = 0;
    this._dimEyeTokens = toks;
    for (i = this.projectiles.length - 1; i >= 0; i--) {
      var pr = this.projectiles[i];
      if (pr.isReflected) continue;
      this._destroyProjectile(pr); this.projectiles.splice(i, 1);
    }
    var reach = Math.sqrt(cam.width * cam.width + cam.height * cam.height) * 0.55;
    this._spawnWaveRing(this.p.x, this.p.y, { maxRadius: reach, color: RIFT_BODY, expandTime: 0.4 });
    cam.shake(320, 0.010);
    this._triggerHitstop(80);
  };

  /* Driven on REAL dt from the frozen branch in scene.update. */
  M._updateDimPortal = function (dt) {
    this._dimPortalT += dt;
    var t = this._dimPortalT;
    // Each staring eye snaps shut + implodes the instant the great eye starts to open.
    var toks = this._dimEyeTokens;
    if (toks) for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      if (!tk.imploded && t >= tk.vanishAt) {
        tk.imploded = true;
        this._explode(tk.x, tk.y, RIFT_RGB, 8);
        this._explode(tk.x, tk.y, [255, 255, 255], 3);
      }
    }
    this._dimDrawPortal(t);
    if (!this._dimPortalDone && t >= CLOSE_END) this._dimPortalFinish();
  };

  M._dimDrawPortal = function (t) {
    var g = this._dimPortalGfx; if (!g) return;
    g.clear();
    var eg = this._dimEyeGfx; if (eg) eg.clear();

    // 1) the staring eye-tokens (world space, where the enemies stood)
    if (eg && this._dimEyeTokens) this._dimDrawEyeTokens(eg, t);

    // 2) the great eye (screen space, over the player)
    var cam = this.cameras.main, cx = this._dimPortalCX, cy = this._dimPortalCY;
    var W = cam.width, H = cam.height, diag = Math.sqrt(W * W + H * H);
    // LINEAR up then LINEAR down, equal spans → the lids open and close at the SAME
    // constant speed and reverse instantly at full-open (no dwell). An eased peak
    // (easeOut→easeIn) would stall at zero velocity = a brief "held open" beat, which
    // is exactly what we don't want here.
    var openFrac;
    if (t < FORM_END) openFrac = 0;
    else if (t < OPEN_END) openFrac = (t - FORM_END) / (OPEN_END - FORM_END);
    else if (t < CLOSE_END) openFrac = 1 - (t - OPEN_END) / (CLOSE_END - OPEN_END);
    else openFrac = 0;
    this._dimDrawBigEye(g, t, openFrac);

    // 3) ENGULF — as the lids slam shut a blast of rift-light floods out of the
    //    closing eye and whites the screen; at full shut we EMERGE in the dimension.
    if (t > CLOSE_END - 0.28) {
      var ev = clamp01((t - (CLOSE_END - 0.28)) / 0.28);
      var engR = diag * 0.8 * easeIn(ev);
      g.fillStyle(RIFT_HALO, Math.min(1, 0.7 * ev)); g.fillCircle(cx, cy, engR);
      g.fillStyle(RIFT_BODY, Math.min(1, 0.82 * ev)); g.fillCircle(cx, cy, engR * 0.7);
      g.fillStyle(RIFT_CORE, ev); g.fillCircle(cx, cy, engR * 0.4);
    }
  };

  /* The great eye, screen-space at the player. Wide axis horizontal; ho is the
     vertical lid opening (0 = shut). Dimension-coloured, T4-lens DNA but grander. */
  M._dimDrawBigEye = function (g, t, openFrac) {
    var cam = this.cameras.main, cx = this._dimPortalCX, cy = this._dimPortalCY;
    var W = cam.width, H = cam.height;
    var hw = Math.min(W, H) * 0.42;          // half-width (the wide, horizontal axis)
    var ho = hw * 0.6 * openFrac;            // half-opening (vertical)
    var spin = t * 2.0, k;
    var pulse = 0.5 + 0.5 * Math.sin(t * 6.0);
    var glow = 0.5 + 0.5 * openFrac;

    // 1. Vast soft halo behind the eye — the portal's bleed.
    g.fillStyle(RIFT_HALO, 0.05 + 0.05 * glow);
    g.fillCircle(cx, cy, hw * (1.05 + 0.1 * pulse));

    // 2. Orbiting energy: broken counter-rotating bands + inward particles → it reads
    //    as a live portal, not a flat drawing.
    for (var ring = 0; ring < 3; ring++) {
      var rr = hw * (0.7 + ring * 0.16), dir = ring % 2 ? -1 : 1;
      var col = ring % 2 ? RIFT_BODY : RIFT_HALO;
      g.lineStyle(2 + glow * 2, col, 0.16 + 0.12 * glow);
      var segs = 7;
      for (var s = 0; s < segs; s++) {
        var a0 = spin * dir * (1 + ring * 0.2) + s / segs * TAU;
        g.beginPath();
        g.arc(cx, cy, rr * (1 - 0.18 * (1 - openFrac)), a0, a0 + (TAU / segs) * 0.5, false);
        g.strokePath();
      }
    }
    for (k = 0; k < 22; k++) {                  // particles spiralling toward the pupil
      var pa = -spin * 1.3 + k / 22 * TAU;
      var pr = hw * (0.25 + 0.75 * ((t * 0.45 + k / 22) % 1));
      g.fillStyle(k % 3 ? RIFT_BODY : RIFT_CYAN, 0.3 + 0.3 * glow);
      g.fillCircle(cx + Math.cos(pa) * pr, cy + Math.sin(pa) * pr, 1.8 + 1.2 * glow);
    }

    // 3. Sclera — the violet eyeball, translucent so the rift-light glows through.
    eyeAlmond(g, cx, cy, 1, 0, hw, ho, 30);
    g.fillStyle(RIFT_BODY, (0.10 + 0.12 * glow) * openFrac);
    g.fillPath();

    // 4. Iris + dilating pupil-core + reticle ticks (the T4 lens, dimension-grown).
    if (openFrac > 0.12) {
      var dilate = 0.4 + 0.6 * openFrac;   // pupil dilates as it opens, contracts as it shuts
      var ri = Math.min(hw * 0.5, ho * 0.92);
      g.lineStyle(ri * 0.42, RIFT_HALO, 0.45 * openFrac);  // iris annulus (dark centre = pupil under ADD)
      g.strokeCircle(cx, cy, ri * 0.68);
      g.lineStyle(ri * 0.20, RIFT_BODY, 0.7 * openFrac);
      g.strokeCircle(cx, cy, ri * 0.62);
      g.lineStyle(2.5, RIFT_CYAN, 0.5 * openFrac);          // cyan inner glitch ring
      g.strokeCircle(cx, cy, ri * (0.44 + 0.06 * pulse));
      g.fillStyle(RIFT_CORE, (0.4 + 0.5 * pulse) * openFrac); // white-hot core, dilating as it glares
      g.fillCircle(cx, cy, ri * (0.10 + 0.34 * dilate));
      g.lineStyle(2.5, RIFT_BODY, 0.5 * openFrac);          // spinning reticle ticks
      for (k = 0; k < 6; k++) {
        var a = spin * 1.5 + (TAU / 6) * k;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * ri * 1.12, cy + Math.sin(a) * ri * 1.12);
        g.lineTo(cx + Math.cos(a) * ri * 1.4, cy + Math.sin(a) * ri * 1.4);
        g.strokePath();
      }
    }

    // 5. Eyelids — the crisp open/closing lids (the "it's an EYE" read). The edge
    //    burns brightest as it nears shut (the blink) and thickens.
    var lidA = 0.55 + 0.45 * (1 - openFrac);
    eyeAlmond(g, cx, cy, 1, 0, hw, ho, 30);
    g.lineStyle(7, RIFT_BODY, 0.45); g.strokePath();
    eyeAlmond(g, cx, cy, 1, 0, hw, ho, 30);
    g.lineStyle(3.5 + 3 * (1 - openFrac), RIFT_CORE, lidA); g.strokePath();

    // 6. Lash flicks at the corners.
    g.lineStyle(3, RIFT_BODY, 0.55);
    for (var lc = -1; lc <= 1; lc += 2) {
      g.beginPath(); g.moveTo(cx + hw * lc, cy); g.lineTo(cx + hw * 1.14 * lc, cy); g.strokePath();
    }
  };

  /* The enemy→eye tokens (world space). Each opens at portal start, stares at the
     player, then blinks shut + fades as its vanish time (≈ the great eye opening) hits. */
  M._dimDrawEyeTokens = function (g, t) {
    var toks = this._dimEyeTokens; if (!toks) return;
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      var appear = clamp01(t / 0.3);
      var closeF = clamp01((t - (tk.vanishAt - 0.16)) / 0.2);
      var open = Math.min(appear, 1 - closeF);
      if (open <= 0.01) continue;
      this._dimEyeToken(g, tk, open, t);
    }
  };

  M._dimEyeToken = function (g, tk, open, t) {
    var s = tk.size, cx = tk.x, cy = tk.y;
    var ca = Math.cos(tk.ang), sa = Math.sin(tk.ang);   // aim toward the player
    var pca = -sa, psa = ca;                            // wide axis ⟂ aim
    var hw = s * 1.5, ho = hw * 0.58 * open, aMul = open;

    g.fillStyle(RIFT_HALO, 0.10 * aMul); g.fillCircle(cx, cy, hw * 1.05);   // glow
    eyeAlmond(g, cx, cy, pca, psa, hw, ho, 14);                              // sclera
    g.fillStyle(RIFT_BODY, 0.22 * aMul); g.fillPath();

    if (open > 0.25) {                                                       // iris + darting pupil
      var dart = Math.sin(t * 4 + tk.seed) * 0.16;
      var gz = ho * 0.18, ix = cx + ca * gz + pca * ho * dart, iy = cy + sa * gz + psa * ho * dart;
      var ri = Math.min(hw * 0.5, ho * 0.85);
      g.lineStyle(ri * 0.4, RIFT_CORE, 0.6 * aMul); g.strokeCircle(ix, iy, ri * 0.66);
      g.fillStyle(RIFT_CYAN, 0.5 * aMul); g.fillCircle(ix, iy, ri * 0.22);   // glint
    }

    eyeAlmond(g, cx, cy, pca, psa, hw, ho, 14);                              // lid outline
    g.lineStyle(1.8, RIFT_BODY, (0.5 + 0.4 * open) * aMul); g.strokePath();
    for (var lc = -1; lc <= 1; lc += 2) {                                    // lash flicks
      var lx = cx + pca * hw * lc, ly = cy + psa * hw * lc;
      g.lineStyle(1.6, RIFT_BODY, 0.4 * aMul);
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + pca * s * 0.35 * lc, ly + psa * s * 0.35 * lc); g.strokePath();
    }
  };

  M._dimPortalFinish = function () {
    this._dimPortalDone   = true;
    this._dimPortalActive = false;
    if (this._dimPortalGfx) this._dimPortalGfx.clear();
    if (this._dimEyeGfx)    this._dimEyeGfx.clear();
    this._dimEyeTokens = null;
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
    // Reaching the fractured dimension — in SANDBOX or HARDCORE — unlocks Boss Rush.
    if (LA.laMarkBossRushUnlocked) LA.laMarkBossRushUnlocked();
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
    this._dimCrackFade = 1.0;     // …then the rifts fade out (after the hold below)
    this._dimCrackHold = 1.3;     // hold every fracture clearly visible first, then fade

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
    // Sits in the UPPER area (0.24): clears the Anomaly's objective banner (0.40)
    // when the Anomaly leads the first fractured-dimension wave — they used to
    // overlap. Wraps on a narrow (portrait) screen so the wide title never clips.
    var txt = this.add.text(cam.width / 2, cam.height * 0.24, 'DIMENSION FRACTURÉE', {
      fontFamily: 'monospace', fontSize: '46px', fontStyle: 'bold',
      color: '#f0d6ff', stroke: '#1a0030', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#e24dff', blur: 22, fill: true },
      align: 'center', wordWrap: { width: cam.width * 0.9, useAdvancedWrap: true },
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
    if (this._dimEyeGfx)    { this._dimEyeGfx.destroy();    this._dimEyeGfx = null; }
    if (this._dimBannerTxt) { this._dimBannerTxt.destroy(); this._dimBannerTxt = null; }
    this._dimBgCM = null; this._dimGlowCM = null; this._dimDeepCM = null; this._dimCamCM = null;
    this._dimBuilt = false; this._dimCracks = null; this._dimCrackFade = 1; this._dimCrackHold = 0;
    this._dimPortalActive = false; this._dimPortalDone = false; this._dimPendingTeam = null;
    this._dimEyeTokens = null;
  };
})();
