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
    this._emitter.setPosition(x, y);
    this._emitter.setParticleTint(tint);
    this._emitter.explode(n || 25);
    this._emitter2.setPosition(x, y);
    this._emitter2.setParticleTint(tint);
    this._emitter2.explode(Math.round((n || 25) * 0.5));
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

  M._spawnWaveRing = function (x, y) {
    var ring = this._waveRings[this._waveRingW % this._waveRings.length];
    this._waveRingW++;
    ring.x = x; ring.y = y;
    ring.r = 10; ring.alpha = 0.9; ring.active = true;
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

  M._updateWaveRings = function (dt) {
    var c = LA.getColors();
    for (var i = 0; i < this._waveRings.length; i++) {
      var ring = this._waveRings[i];
      if (!ring.active) continue;
      ring.r     += dt * C.LANDING_BURST_RADIUS * 3.5;
      ring.alpha -= dt * 3.2;
      if (ring.alpha <= 0) {
        ring.active = false;
        ring.gfx.clear();
        ring.gfx.setVisible(false);
        continue;
      }
      ring.gfx.clear();
      ring.gfx.lineStyle(2.5, c.cyan, ring.alpha);
      ring.gfx.strokeCircle(ring.x, ring.y, ring.r);
      if (ring.r > 20) {
        ring.gfx.lineStyle(1, c.cyan, ring.alpha * 0.4);
        ring.gfx.strokeCircle(ring.x, ring.y, ring.r * 0.6);
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
      this._comboTrailEmitter.setPosition(p.x, p.y);
      this._comboTrailEmitter.explode(trailQty);
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
      var aPulse = 0.6 + 0.35 * Math.sin(this.gameTime * Math.PI * 8);
      for (var ai2 = 0; ai2 < 3; ai2++) {
        var baseA = this._comboAuraRot + (Math.PI * 2 / 3) * ai2;
        this._comboAuraGfx.lineStyle(2.5, 0x00ffff, aPulse);
        this._comboAuraGfx.beginPath();
        this._comboAuraGfx.arc(p.x, p.y, aR, baseA, baseA + 0.55);
        this._comboAuraGfx.strokePath();
      }

      // Sparks: 2 per frame at random offsets around player
      this._comboSparkEmitter.setPosition(
        p.x + (Math.random() - 0.5) * C.SIZE * 2,
        p.y + (Math.random() - 0.5) * C.SIZE * 2
      );
      this._comboSparkEmitter.explode(2);
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
      og.lineStyle(4, c.cyan, 0.30);
      og.strokeCircle(0, 0, ORB_SIZE + 4);
      og.fillStyle(c.cyan, 0.95);
      og.fillCircle(0, 0, ORB_SIZE);
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

})();
