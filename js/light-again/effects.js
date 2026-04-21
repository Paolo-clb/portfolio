/* ==========================================================================
   Light Again — Visual Effects (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._explode = function (x, y, color, n) {
    var tint = Phaser.Display.Color.GetColor(color[0], color[1], color[2]);
    // Pass x,y directly to explode() — never call setPosition on the shared emitters.
    // Moving a shared emitter shifts ALL its alive particles (they are relative to the
    // emitter's world transform). By keeping emitters fixed at origin and passing
    // world coords to explode(), each burst is fully independent.
    this._emitter.setParticleTint(tint);
    this._emitter.explode(n || 25, x, y);
    this._emitter2.setParticleTint(tint);
    this._emitter2.explode(Math.round((n || 25) * 0.5), x, y);
  };

  M._addGhost = function (x, y, alpha, angle, isDashAtk) {
    var g = this._ghosts[this._ghostW];
    g.active = true; g.alpha = alpha;
    g.spr.setPosition(x, y);
    g.spr.setRotation(angle);
    g.spr.setAlpha(alpha * 0.6);
    g.spr.setTexture(isDashAtk ? '_ar_datk' : '_ar_dash');
    g.spr.setVisible(true);
    this._ghostW = (this._ghostW + 1) % this.MAX_GHOSTS;
  };

  M._decayGhosts = function (dt) {
    for (var i = 0; i < this.MAX_GHOSTS; i++) {
      var g = this._ghosts[i];
      if (!g.active) continue;
      g.alpha -= dt * 3.5;
      if (g.alpha <= 0) { g.active = false; g.spr.setVisible(false); }
      else g.spr.setAlpha(g.alpha * 0.6);
    }
  };

  M._spawnWaveRing = function (x, y, opts) {
    var ring = this._waveRings[this._waveRingW % this._waveRings.length];
    this._waveRingW++;
    opts = opts || {};
    ring.x = x; ring.y = y;
    ring.r = 0; ring.alpha = 1.0; ring.active = true;
    ring.elapsed    = 0;
    ring.maxRadius  = opts.maxRadius  || 121;
    ring.color      = opts.color      || 0x00ffff;
    ring.expandTime = opts.expandTime || 0.28;
    ring.gfx.setVisible(true);
  };

  M._hiveSpawnBeam = function (x1, y1, x2, y2) {
    var b = this._hiveBeams[this._hiveBeamW % this._hiveBeams.length];
    this._hiveBeamW++;
    b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2;
    b.alpha = 1.0; b.active = true;
    b.gfx.setVisible(true);
  };

  M._updateHiveBeams = function (dt) {
    for (var i = 0; i < this._hiveBeams.length; i++) {
      var b = this._hiveBeams[i];
      if (!b.active) continue;
      b.alpha -= dt * 2.2;
      if (b.alpha <= 0) {
        b.active = false;
        b.gfx.clear();
        b.gfx.setVisible(false);
        continue;
      }
      b.gfx.clear();
      // Thick glow core
      b.gfx.lineStyle(6, 0xbb00ff, b.alpha * 0.55);
      b.gfx.beginPath();
      b.gfx.moveTo(b.x1, b.y1);
      b.gfx.lineTo(b.x2, b.y2);
      b.gfx.strokePath();
      // Bright inner line
      b.gfx.lineStyle(2.5, 0xdd66ff, b.alpha * 0.95);
      b.gfx.beginPath();
      b.gfx.moveTo(b.x1, b.y1);
      b.gfx.lineTo(b.x2, b.y2);
      b.gfx.strokePath();
      // White hot center
      b.gfx.lineStyle(1, 0xffffff, b.alpha * 0.7);
      b.gfx.beginPath();
      b.gfx.moveTo(b.x1, b.y1);
      b.gfx.lineTo(b.x2, b.y2);
      b.gfx.strokePath();
    }
  };

  /* Stylish death for condemned (TW mark) enemies — crimson expanding ring burst.
     overrideRadius: pre-computed cluster radius from TW resolve (already accounts for group size). */
  M._spawnCondemnedDeath = function (x, y, size, overrideRadius) {
    var slot = this._twDeathRings[this._twDeathRingW % this._twDeathRings.length];
    this._twDeathRingW++;
    slot.x = x; slot.y = y;
    slot.active = true;
    slot.elapsed   = 0;
    var r = overrideRadius || Math.max(size * 2.8, 48);
    slot.maxRadius  = Math.max(r, 48);
    // Faster expand for small rings, slightly slower for large cluster rings
    slot.expandTime = 0.18 + Math.min(slot.maxRadius / 600, 0.10);
    slot.gfx.setVisible(true);
    // Particle count scales with ring size so big clusters look proportionally impactful
    var sparks = Math.round(12 + Math.min(slot.maxRadius / 10, 24));
    this._explode(x, y, [220, 20,  50], sparks);
    this._explode(x, y, [255, 80,  80], Math.round(sparks * 0.45));
  };

  M._updateCondemnedDeathRings = function (dt) {
    for (var i = 0; i < this._twDeathRings.length; i++) {
      var ring = this._twDeathRings[i];
      if (!ring.active) continue;
      ring.elapsed += dt;

      var expT  = ring.expandTime || 0.22;
      var fadeT = 0.30;
      var t     = ring.elapsed;

      if (t >= expT + fadeT) {
        ring.active = false;
        ring.gfx.clear();
        ring.gfx.setVisible(false);
        continue;
      }

      var r, a;
      if (t < expT) {
        r = ring.maxRadius * (1.0 - t / expT);  // shrinks from maxRadius → 0
        a = 1.0;
      } else {
        r = 0;
        a = 1.0 - (t - expT) / fadeT;
      }
      if (r < 0) r = 0;
      if (a <= 0) continue;

      ring.gfx.clear();
      // Wide outer glow
      ring.gfx.lineStyle(7, 0xcc0022, a * 0.30);
      ring.gfx.strokeCircle(ring.x, ring.y, r * 1.10);
      // Main crimson ring
      ring.gfx.lineStyle(2.5, 0xff1133, a);
      ring.gfx.strokeCircle(ring.x, ring.y, r);
      // White-hot core flash (only while shrinking)
      if (t < expT) {
        ring.gfx.lineStyle(1.2, 0xffffff, a * 0.65);
        ring.gfx.strokeCircle(ring.x, ring.y, r);
      }
      // Outer echo ring
      if (r > 15) {
        var echoA = a * 0.45 * (t < expT ? t / expT : 0.4);
        ring.gfx.lineStyle(1.5, 0xff2244, echoA);
        ring.gfx.strokeCircle(ring.x, ring.y, r * 1.45);
      }
    }
  };

  M._updateWaveRings = function (dt) {
    for (var i = 0; i < this._waveRings.length; i++) {
      var ring = this._waveRings[i];
      if (!ring.active) continue;
      ring.elapsed += dt;

      var expT  = ring.expandTime || 0.28;
      var fadeT = 0.22;
      var t     = ring.elapsed;

      if (t >= expT + fadeT) {
        ring.active = false;
        ring.gfx.clear();
        ring.gfx.setVisible(false);
        continue;
      }

      var a;
      if (t < expT) {
        ring.r = ring.maxRadius * (t / expT);
        a = 1.0;
      } else {
        ring.r = ring.maxRadius;
        a = 1.0 - (t - expT) / fadeT;
      }
      if (a <= 0 || ring.r <= 0) continue;

      // Line thickness scales with ring size (1.5px small → ~5px nuke L1 → ~8px nuke L2)
      var normR = ring.maxRadius / 275;
      var lw    = 1.5 + normR * 3.5;
      var col   = ring.color || 0x00ffff;

      ring.gfx.clear();
      // Wide outer glow
      ring.gfx.lineStyle(lw * 2.8, col, a * 0.18);
      ring.gfx.strokeCircle(ring.x, ring.y, ring.r * 1.08);
      // Main ring
      ring.gfx.lineStyle(lw, col, a);
      ring.gfx.strokeCircle(ring.x, ring.y, ring.r);
      // White hot core
      ring.gfx.lineStyle(lw * 0.5, 0xffffff, a * 0.65);
      ring.gfx.strokeCircle(ring.x, ring.y, ring.r);
      // Inner echo — only while expanding, only for larger rings
      if (ring.maxRadius > 70 && t < expT) {
        var echoA = a * 0.38 * (1.0 - t / expT);
        ring.gfx.lineStyle(lw * 0.7, col, echoA);
        ring.gfx.strokeCircle(ring.x, ring.y, ring.r * 0.68);
      }
    }
  };

  M._updateComboFX = function (dt) {
    var p = this.p;
    var cm = this.comboMultiplier;

    // Tier 1: x10+ cyan particle trail
    if (cm >= 10) {
      this._comboTrailActive = true;
      var trailQty = cm >= 50 ? 3 : cm >= 25 ? 2 : 1;
      this._comboTrailEmitter.explode(trailQty, p.x, p.y);
    } else if (this._comboTrailActive) {
      this._comboTrailActive = false;
    }

    // Tier 2: x25+ Warp/Barrel distortion PostFX
    if (cm >= 25) {
      var chromaStr = Math.min(8, (cm - 25) * 0.15 + 1);
      if (!this._chromaFX && this.cameras.main.postFX) {
        this._chromaFX = this.cameras.main.postFX.addBarrel(1.0);
      }
      if (this._chromaFX) {
        this._chromaFX.amount = 1.0 + chromaStr * 0.004;
      }
    } else if (this._chromaFX) {
      this.cameras.main.postFX.remove(this._chromaFX);
      this._chromaFX = null;
    }

    // Tier 3: x50+ small rotating arcs + sparks
    if (cm >= 50) {
      this._comboAuraActive = true;
      this._comboSparkActive = true;
      this._comboAuraGfx.setVisible(true);
    } else if (this._comboAuraActive) {
      this._comboAuraGfx.setVisible(false);
      this._comboAuraGfx.clear();
      this._comboAuraActive = false;
      this._comboSparkActive = false;
    }

    if (this._comboAuraActive) {
      this._comboAuraRot += dt * 18;
      this._comboAuraGfx.clear();
      var aR = C.SIZE * 1.5;
      // Dimmed during TW — arcs golden to match player/orbs
      var twDim = this._twActive ? 0.22 : 1.0;
      var arcCol = this._twActive ? 0xffc832 : 0x00ffff;
      var aPulse = (0.6 + 0.35 * Math.sin(this.gameTime * Math.PI * 8)) * twDim;
      for (var ai2 = 0; ai2 < 3; ai2++) {
        var baseA = this._comboAuraRot + (Math.PI * 2 / 3) * ai2;
        this._comboAuraGfx.lineStyle(2.5, arcCol, aPulse);
        this._comboAuraGfx.beginPath();
        this._comboAuraGfx.arc(p.x, p.y, aR, baseA, baseA + 0.55);
        this._comboAuraGfx.strokePath();
      }

      // Sparks: suppressed during TW, otherwise 2 per frame
      if (!this._twActive) {
        var spx = p.x + (Math.random() - 0.5) * C.SIZE * 2;
        var spy = p.y + (Math.random() - 0.5) * C.SIZE * 2;
        this._comboSparkEmitter.explode(2, spx, spy);
      }
    }
  };

  M._renderShieldOrbs = function () {
    var p  = this.p;
    var ORB_RADIUS = 38;
    var ORB_SIZE   = 5;
    var c  = LA.getColors();
    var ga = this._shieldLinkGfx;
    ga.clear();

    for (var oi = 0; oi < this._shieldOrbs.length; oi++) {
      var og = this._shieldOrbs[oi];
      if (oi >= this.playerShields) {
        og.setVisible(false);
        continue;
      }
      og.setVisible(true);
      var baseAng = (Math.PI * 2 / this.MAX_SHIELDS) * oi + this._shieldAngle;
      var ox = p.x + Math.cos(baseAng) * ORB_RADIUS;
      var oy = p.y + Math.sin(baseAng) * ORB_RADIUS;

      // ---- Energy link wire ----
      // Slow individual pulse per orb so wires breathe independently
      var pulse = 0.52 + 0.48 * Math.sin(this.gameTime * Math.PI * 2.2 + oi * 2.09);

      // Outer soft glow
      ga.lineStyle(3, c.cyan, 0.06 * pulse);
      ga.beginPath(); ga.moveTo(ox, oy); ga.lineTo(p.x, p.y); ga.strokePath();

      // Bright inner wire
      ga.lineStyle(1, 0xcce8ff, 0.24 * pulse);
      ga.beginPath(); ga.moveTo(ox, oy); ga.lineTo(p.x, p.y); ga.strokePath();

      // Flowing energy packets: 3 dots sliding orb → player
      var flowT = (this.gameTime * 0.62 + oi * 0.34) % 1.0;
      for (var fi = 0; fi < 3; fi++) {
        var ft = (flowT + fi / 3) % 1.0;
        var fx = ox + (p.x - ox) * ft;
        var fy = oy + (p.y - oy) * ft;
        // Fade at both endpoints so dots appear to emerge from orb and dissolve at player
        var da = Math.min(ft * 6, (1 - ft) * 6, 1.0);
        ga.fillStyle(0xddf4ff, da * 0.52 * pulse);
        ga.fillCircle(fx, fy, 1.3);
      }

      // ---- Orb ----
      og.clear();
      if (this._twActive) {
        // Golden phantom look during TW — matches player arrow
        var twPulse = 0.42 + 0.20 * Math.sin(this.gameTime * Math.PI * 3 + oi * 1.4);
        og.lineStyle(4, 0xffc832, twPulse * 0.5);
        og.strokeCircle(0, 0, ORB_SIZE + 4);
        og.fillStyle(0xffc832, twPulse);
        og.fillCircle(0, 0, ORB_SIZE);
        og.setBlendMode(Phaser.BlendModes.ADD);
        og.setAlpha(twPulse + 0.10);
      } else {
        og.lineStyle(4, c.cyan, 0.30);
        og.strokeCircle(0, 0, ORB_SIZE + 4);
        og.fillStyle(c.cyan, 0.95);
        og.fillCircle(0, 0, ORB_SIZE);
        og.setBlendMode(Phaser.BlendModes.NORMAL);
        og.setAlpha(1.0);
      }
      og.setPosition(ox, oy);
    }
  };

  /* ---------------------------------------------------------------
     Shield sacrifice: brief hexagonal burst at player position
     --------------------------------------------------------------- */
  M._shieldSacrificeFlash = function () {
    var self = this;
    var p    = this.p;
    var gfx  = this._shieldHitGfx;
    var R    = C.SIZE * 2.15;
    var c    = LA.getColors();

    this.tweens.killTweensOf(gfx);
    gfx.setPosition(p.x, p.y);
    gfx.setScale(0.58);
    gfx.setAlpha(1.0);
    gfx.setVisible(true);
    gfx.clear();

    // Layer 1: wide soft corona
    gfx.lineStyle(10, c.cyan, 0.18);
    self._drawHexPath(gfx, 0, 0, R + 10); gfx.strokePath();

    // Layer 2: main glowing edge
    gfx.lineStyle(2.5, c.cyan, 1.0);
    self._drawHexPath(gfx, 0, 0, R); gfx.strokePath();

    // Layer 3: white-hot inner rim
    gfx.lineStyle(1.2, 0xffffff, 0.88);
    self._drawHexPath(gfx, 0, 0, R - 3); gfx.strokePath();

    // Layer 4: faint fill
    gfx.fillStyle(c.cyan, 0.05);
    self._drawHexPath(gfx, 0, 0, R); gfx.fillPath();

    // Animate: snap-in then expand + dissolve
    this.tweens.add({
      targets:  gfx,
      scaleX:   2.3,
      scaleY:   2.3,
      alpha:    0,
      duration: 320,
      ease:     'Quad.easeOut',
      onComplete: function () {
        gfx.setVisible(false);
        gfx.clear();
      },
    });
  };

  /* Flat-top regular hexagon path helper (draws path only, caller strokes/fills) */
  M._drawHexPath = function (gfx, cx, cy, R) {
    gfx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 6 + (Math.PI / 3) * i;
      var x = cx + Math.cos(a) * R;
      var y = cy + Math.sin(a) * R;
      if (i === 0) gfx.moveTo(x, y); else gfx.lineTo(x, y);
    }
    gfx.closePath();
  };

  /* ---------------------------------------------------------------
     Dash-Attack Lv2: vacuum field visual (called each frame)
     --------------------------------------------------------------- */
  M._updateDashVacuumFX = function (dt) {
    var p   = this.p;
    var gfx = this._dashVacuumGfx;
    var dashLvl = (this._upgradeLevels && this._upgradeLevels.dashAtk) || 0;

    gfx.clear();

    /* ------------------------------------------------------------------
       TW RESOLUTION TETHER: show all frozen-reflected projectiles at once
       when time resumes, fading out with a golden beam (≈1.5s).
       Runs regardless of current dash state.
    ------------------------------------------------------------------ */
    if (this._twTetherAlpha > 0 && dashLvl >= 2) {
      this._twTetherAlpha = Math.max(0, this._twTetherAlpha - dt * 0.65);
      var ta  = this._twTetherAlpha;
      var gt2 = this.gameTime;
      for (var ti = 0; ti < this.projectiles.length; ti++) {
        var tpr = this.projectiles[ti];
        if (!tpr._twTetherActive) continue;
        var tdx = tpr.x - p.x, tdy = tpr.y - p.y;
        var tdSq = tdx * tdx + tdy * tdy;
        if (tdSq < 400) continue;
        var tpd = Math.sqrt(tdSq);
        var tnx = tdx / tpd, tny = tdy / tpd;

        // Outer golden glow beam
        gfx.lineStyle(6, 0xffc832, 0.18 * ta);
        gfx.beginPath(); gfx.moveTo(p.x, p.y); gfx.lineTo(tpr.x, tpr.y); gfx.strokePath();
        // Main gold beam
        gfx.lineStyle(2, 0xffe06e, 0.72 * ta);
        gfx.beginPath(); gfx.moveTo(p.x, p.y); gfx.lineTo(tpr.x, tpr.y); gfx.strokePath();
        // Bright white core
        gfx.lineStyle(0.8, 0xffffff, 0.36 * ta);
        gfx.beginPath(); gfx.moveTo(p.x, p.y); gfx.lineTo(tpr.x, tpr.y); gfx.strokePath();
        // Animated gold dots
        for (var tdi = 0; tdi < 5; tdi++) {
          var tt  = ((gt2 * 2.2 + tdi / 5) % 1.0);
          var dtX = p.x + tnx * tpd * tt;
          var dtY = p.y + tny * tpd * tt;
          gfx.fillStyle(0xffe06e, ta * (0.58 + 0.28 * (1.0 - tt)));
          gfx.fillCircle(dtX, dtY, 2.5 - tt * 0.8);
        }
        // Impact marker (gold ring + crosshair)
        gfx.fillStyle(0xffc832, 0.52 * ta);
        gfx.fillCircle(tpr.x, tpr.y, 8);
        gfx.fillStyle(0xffffff, 0.32 * ta);
        gfx.fillCircle(tpr.x, tpr.y, 3.5);
        gfx.lineStyle(1, 0xffffff, 0.32 * ta);
        gfx.beginPath();
        gfx.moveTo(tpr.x - 8, tpr.y); gfx.lineTo(tpr.x + 8, tpr.y);
        gfx.moveTo(tpr.x, tpr.y - 8); gfx.lineTo(tpr.x, tpr.y + 8);
        gfx.strokePath();
      }
    }

    /* ------------------------------------------------------------------
       Clear per-attack tether flag when not in a dash-attack so the
       next dash-attack starts fresh.
    ------------------------------------------------------------------ */
    if (p.state !== 'DASH_ATTACKING') {
      for (var ci = 0; ci < this.projectiles.length; ci++) {
        if (this.projectiles[ci]._reflectedThisAtk) this.projectiles[ci]._reflectedThisAtk = false;
      }
    }

    if (p.state !== 'DASH_ATTACKING' || dashLvl < 2) return;

    var c  = LA.getColors();
    var R  = C.DASHATK_VACUUM_RADIUS;
    var gt = this.gameTime;

    var DASH_COL = 0xff14c8;  // dash-attack magenta

    // Faint magenta fill under inner arcs
    var innerR = R * 0.40;
    gfx.fillStyle(DASH_COL, 0.045);
    gfx.fillCircle(p.x, p.y, innerR);

    // Inner counter-rotating arcs (3, counter-clockwise)
    var rot2 = -gt * 3.8;
    for (var bi = 0; bi < 3; bi++) {
      var b0 = rot2 + (Math.PI * 2 / 3) * bi;
      gfx.lineStyle(2.5, DASH_COL, 0.55);
      gfx.beginPath();
      gfx.arc(p.x, p.y, innerR, b0, b0 + 0.40);
      gfx.strokePath();
    }

    // Core glow ring close to player (singularity pulse)
    gfx.lineStyle(2.5, DASH_COL, 0.50 + 0.25 * Math.sin(gt * Math.PI * 7));
    gfx.strokeCircle(p.x, p.y, C.SIZE * 1.8);

    /* ------------------------------------------------------------------
       Deflection tether: beam from player to projectiles reflected during
       THIS dash-attack only. No distance cap during TW (just reflected
       and frozen in place). Frozen projectiles are included here since
       they were just reflected — _reflectedThisAtk is set at reflect time.
    ------------------------------------------------------------------ */
    var beamR   = 480;
    var beamRSq = beamR * beamR;
    for (var pi = 0; pi < this.projectiles.length; pi++) {
      var pr = this.projectiles[pi];
      if (!pr._reflectedThisAtk) continue;
      var pdx = pr.x - p.x, pdy = pr.y - p.y;
      var pdSq = pdx * pdx + pdy * pdy;
      if (pdSq < 400) continue;
      // No distance cap during TW (freshly frozen after reflect)
      if (!this._twActive && pdSq > beamRSq) continue;
      var pd = Math.sqrt(pdSq);
      var distFade = this._twActive ? 1.0 : (1.0 - pd / beamR);
      if (distFade <= 0) continue;
      var nx = pdx / pd, ny = pdy / pd;

      // Thick outer glow beam (purple)
      gfx.lineStyle(5, 0xaa44ff, 0.14 * distFade);
      gfx.beginPath();
      gfx.moveTo(p.x, p.y);
      gfx.lineTo(pr.x, pr.y);
      gfx.strokePath();

      // Main beam
      gfx.lineStyle(1.8, 0xcc88ff, 0.60 * distFade);
      gfx.beginPath();
      gfx.moveTo(p.x, p.y);
      gfx.lineTo(pr.x, pr.y);
      gfx.strokePath();

      // Bright white core
      gfx.lineStyle(0.8, 0xffffff, 0.32 * distFade);
      gfx.beginPath();
      gfx.moveTo(p.x, p.y);
      gfx.lineTo(pr.x, pr.y);
      gfx.strokePath();

      // Animated energy dots flowing player → reflected projectile
      var numDots = 5;
      for (var di = 0; di < numDots; di++) {
        var t = ((gt * 2.2 + di / numDots) % 1.0);
        var dotX = p.x + nx * pd * t;
        var dotY = p.y + ny * pd * t;
        var dotA = distFade * (0.55 + 0.30 * (1.0 - t));
        gfx.fillStyle(0xcc88ff, dotA);
        gfx.fillCircle(dotX, dotY, 2.5 - t * 0.8);
      }

      // Impact marker at reflected projectile: glow ring + crosshair
      gfx.fillStyle(0xaa44ff, 0.40 * distFade);
      gfx.fillCircle(pr.x, pr.y, 7);
      gfx.fillStyle(0xffffff, 0.28 * distFade);
      gfx.fillCircle(pr.x, pr.y, 3);
      var cl = 7;
      gfx.lineStyle(1, 0xffffff, 0.28 * distFade);
      gfx.beginPath();
      gfx.moveTo(pr.x - cl, pr.y); gfx.lineTo(pr.x + cl, pr.y);
      gfx.moveTo(pr.x, pr.y - cl); gfx.lineTo(pr.x, pr.y + cl);
      gfx.strokePath();
    }
  };

  /* ---------------------------------------------------------------
     Dash Lv2: tornado — spawn + per-frame update
     --------------------------------------------------------------- */
  M._spawnDashTornado = function (x, y) {
    var gfx = this.add.graphics();
    gfx.setDepth(22);
    gfx.setBlendMode(Phaser.BlendModes.ADD);
    this._dashTornados.push({
      x: x, y: y,
      life: C.DASH_TORNADO_DUR, maxLife: C.DASH_TORNADO_DUR,
      gfx: gfx, rot: 0, active: true,
    });
  };

  M._updateDashTornados = function (dt) {
    if (!this._dashTornados || !this._dashTornados.length) return;
    var ms       = dt * 1000;
    var DEEP_BLUE  = 0x3344cc;
    var MID_VIOLET = 0x6633ff;
    var CORE_VIO   = 0x9966ff;
    var R = C.DASH_TORNADO_RADIUS;

    for (var ti = this._dashTornados.length - 1; ti >= 0; ti--) {
      var tor = this._dashTornados[ti];
      tor.life -= ms;
      if (tor.life <= 0) {
        tor.gfx.destroy();
        this._dashTornados.splice(ti, 1);
        continue;
      }
      tor.rot += dt * 4.5;
      var elapsed = tor.maxLife - tor.life;
      var appear  = elapsed < 300  ? elapsed / 300  : 1.0;  // 300ms fade-in
      var fade    = tor.life  < 600 ? tor.life  / 600 : 1.0; // 600ms fade-out
      var alpha   = appear * fade;

      var gfx = tor.gfx;
      gfx.clear();

      // Faint fill
      gfx.fillStyle(DEEP_BLUE, 0.06 * alpha);
      gfx.fillCircle(tor.x, tor.y, R);

      // Outer boundary ring
      gfx.lineStyle(1.5, DEEP_BLUE, 0.22 * alpha);
      gfx.strokeCircle(tor.x, tor.y, R);

      // 3 outer clockwise arcs at R
      for (var ai = 0; ai < 3; ai++) {
        var a0 = tor.rot + (Math.PI * 2 / 3) * ai;
        gfx.lineStyle(2.0, DEEP_BLUE, 0.45 * alpha);
        gfx.beginPath();
        gfx.arc(tor.x, tor.y, R, a0, a0 + 0.65);
        gfx.strokePath();
      }

      // 3 mid counter-clockwise arcs at R*0.65
      var rot2 = -tor.rot * 1.5;
      for (var bi = 0; bi < 3; bi++) {
        var b0 = rot2 + (Math.PI * 2 / 3) * bi;
        gfx.lineStyle(2.0, MID_VIOLET, 0.55 * alpha);
        gfx.beginPath();
        gfx.arc(tor.x, tor.y, R * 0.65, b0, b0 + 0.55);
        gfx.strokePath();
      }

      // 3 inner fast clockwise arcs at R*0.35
      var rot3 = tor.rot * 2.5;
      for (var ci = 0; ci < 3; ci++) {
        var c0 = rot3 + (Math.PI * 2 / 3) * ci;
        gfx.lineStyle(2.5, CORE_VIO, 0.65 * alpha);
        gfx.beginPath();
        gfx.arc(tor.x, tor.y, R * 0.35, c0, c0 + 0.50);
        gfx.strokePath();
      }

      // Core glow (pulsing)
      var corePulse = 0.55 + 0.30 * Math.sin(this.gameTime * Math.PI * 6);
      gfx.fillStyle(CORE_VIO, corePulse * alpha * 0.55);
      gfx.fillCircle(tor.x, tor.y, R * 0.12);
      gfx.lineStyle(2, 0xffffff, corePulse * alpha * 0.25);
      gfx.strokeCircle(tor.x, tor.y, R * 0.12);
    }
  };

})();
