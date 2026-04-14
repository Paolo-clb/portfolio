/* ==========================================================================
   Light Again — Star Power Collectible (scene methods)
   Purple star spawns on detonation ≥50 kills. Grants Dash-Attack override
   on basic attack for 5 seconds.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* ---------------------------------------------------------------
     Build star texture (canvas — called once by _genTextures)
     --------------------------------------------------------------- */
  LA.buildStarTex = function (tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var sz = 32;
    var oc = document.createElement('canvas');
    oc.width = sz; oc.height = sz;
    var ctx = oc.getContext('2d');
    var cx = sz / 2, cy = sz / 2;
    var outerR = 12, innerR = 5, spikes = 5;

    // Glow halo
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR + 4);
    grad.addColorStop(0, 'rgba(180, 40, 255, 0.45)');
    grad.addColorStop(0.6, 'rgba(140, 20, 200, 0.18)');
    grad.addColorStop(1, 'rgba(100, 0, 160, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sz, sz);

    // Star shape path
    ctx.beginPath();
    for (var si = 0; si < spikes * 2; si++) {
      var r = si % 2 === 0 ? outerR : innerR;
      var a = -Math.PI / 2 + (Math.PI / spikes) * si;
      var sx = cx + Math.cos(a) * r;
      var sy = cy + Math.sin(a) * r;
      if (si === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();

    // Fill with gradient
    var fillGrad = ctx.createLinearGradient(cx - outerR, cy - outerR, cx + outerR, cy + outerR);
    fillGrad.addColorStop(0, '#dd44ff');
    fillGrad.addColorStop(0.5, '#ff14c8');
    fillGrad.addColorStop(1, '#aa22ff');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Bright inner edge
    ctx.strokeStyle = 'rgba(255, 200, 255, 0.9)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // White center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    tm.addCanvas(key, oc);
  };

  /* ---------------------------------------------------------------
     Spawn star at (x, y) with 8-second expiry
     --------------------------------------------------------------- */
  M._spawnStar = function (x, y) {
    var spr = this.add.image(x, y, '_star');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(45);
    spr.setScale(1.2);
    if (spr.postFX) spr.postFX.addGlow(0xbb44ff, 6, 0, false, 0.12, 16);

    // Levitation tween
    this.tweens.add({
      targets: spr,
      y: y - 6,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Gentle rotation
    this.tweens.add({
      targets: spr,
      angle: 360,
      duration: 5000,
      repeat: -1,
    });

    // Pulse scale
    this.tweens.add({
      targets: spr,
      scaleX: 1.45,
      scaleY: 1.45,
      duration: 900,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    this._starPickups.push({ spr: spr, x: x, y: y, spawnTime: this.gameTime });
  };

  /* ---------------------------------------------------------------
     Check overlap between player and stars; remove expired stars
     --------------------------------------------------------------- */
  M._checkStarPickup = function () {
    var p = this.p;
    var now = this.gameTime;
    var starExpiry = 8; // 8 seconds (gameTime is in seconds)

    // Check for collected or expired stars (iterate backward to safely splice)
    for (var i = this._starPickups.length - 1; i >= 0; i--) {
      var star = this._starPickups[i];
      var age = now - star.spawnTime;

      // Player pickup
      if (p.state !== 'DEAD') {
        var pR = C.SIZE * 0.7;
        var dx = p.x - star.spr.x, dy = p.y - star.spr.y;
        var thresh = pR + 14;   // star outer radius ~12
        if (dx * dx + dy * dy < thresh * thresh) {
          this._collectStar(i);
          return;
        }
      }

      // Expiry: 8s with fade warning from 6s
      if (age > starExpiry) {
        this._expireStar(i);
      } else if (age > 6) {
        // Fade effect during last 2 seconds
        var fadeRatio = (age - 6) / 2;
        star.spr.setAlpha(1 - fadeRatio * 0.7);
      }
    }
  };

  /* ---------------------------------------------------------------
     Collect: destroy star, visuals, activate star power
     --------------------------------------------------------------- */
  M._collectStar = function (idx) {
    var star = this._starPickups[idx];
    var sx = star.spr.x, sy = star.spr.y;

    // Destroy sprite and tweens
    this.tweens.killTweensOf(star.spr);
    star.spr.destroy();
    this._starPickups.splice(idx, 1);

    // Particles burst (magenta + white)
    this._explode(sx, sy, C.STAR_TINT_ARR, 35);
    this._explode(sx, sy, [255, 255, 255], 15);

    // Flash screen violet
    this.cameras.main.flash(200, 180, 20, 200);
    // Shake proportional to existing shakes (~0.008)
    this.cameras.main.shake(120, 0.008);
    // Float label matching dash-atk color (#ff14c8)
    this._floatLabel(sx, sy, 'OVERDRIVE !', '#ff14c8', 0);
    // Hitstop for juicy feel
    this._triggerHitstop(60);

    this._activateStarPower();
  };

  /* ---------------------------------------------------------------
     Expire: destroy uncollected star after 8 seconds — fade + particles
     --------------------------------------------------------------- */
  M._expireStar = function (idx) {
    var star = this._starPickups[idx];
    this._starPickups.splice(idx, 1);     // remove from pickups immediately

    var spr = star.spr;
    this.tweens.killTweensOf(spr);        // stop levitation/rotation/pulse

    // Dim particle burst
    this._explode(spr.x, spr.y, [140, 40, 200], 10);
    this._explode(spr.x, spr.y, [200, 140, 255], 5);

    // Shrink + fade tween, then destroy sprite
    this.tweens.add({
      targets: spr,
      alpha:  0,
      scaleX: 0.15,
      scaleY: 0.15,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: function () { spr.destroy(); },
    });
  };

  /* ---------------------------------------------------------------
     Activate / deactivate / warning
     --------------------------------------------------------------- */
  M._activateStarPower = function () {
    var self = this;
    this.isStarPowered = true;
    this._starPowerTimer = C.STAR_DUR;
    this._starPowerWarning = false;

    // Cancel previous delayed calls if re-collecting during active star
    if (this._starWarnCall) { this._starWarnCall.remove(false); this._starWarnCall = null; }
    if (this._starEndCall)  { this._starEndCall.remove(false);  this._starEndCall = null; }

    // Warning at STAR_WARN ms
    this._starWarnCall = this.time.delayedCall(C.STAR_WARN, function () {
      self._starPowerWarning = true;
    });

    // End at STAR_DUR ms
    this._starEndCall = this.time.delayedCall(C.STAR_DUR, function () {
      self._deactivateStarPower();
    });
  };

  M._deactivateStarPower = function () {
    this.isStarPowered = false;
    this._starPowerTimer = 0;
    this._starPowerWarning = false;
    this._starWarnCall = null;
    this._starEndCall = null;
    // Restore player visuals (handled in _renderPlayer — clearTint)
  };

})();
