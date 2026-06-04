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
     Spawn star at (x, y). opts (all optional):
       dur    — Overdrive ms this star grants on pickup (default STAR_DUR)
       mega   — the Cache-Zone reward: a bigger orb that "bursts" into being
       guide  — draw a guidance chevron toward it (see _renderStarPointer)
       scale  — resting sprite scale (defaults: mega 2.0, normal 1.2)
       expiry — seconds before it fades away (defaults: mega 16, normal 8)
     --------------------------------------------------------------- */
  M._spawnStar = function (x, y, opts) {
    opts = opts || {};
    var mega      = !!opts.mega;
    var baseScale = opts.scale || (mega ? 2.0 : 1.2);
    var dur       = opts.dur   || C.STAR_DUR;

    var spr = this.add.image(x, y, '_star');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(45);
    spr.setScale(baseScale);
    if (spr.postFX) spr.postFX.addGlow(mega ? 0xff44ff : 0xbb44ff, mega ? 10 : 6, 0, false, 0.12, mega ? 22 : 16);

    // Mega (Cache-Zone reward): a quick "burst-spawn" pop so it reads as ejected
    // from the zone core, settling to its resting scale (the pulse waits for it).
    if (mega) {
      spr.setScale(baseScale * 0.2);
      this.tweens.add({ targets: spr, scaleX: baseScale, scaleY: baseScale, duration: 320, ease: 'Back.easeOut' });
    }

    // Levitation tween
    this.tweens.add({
      targets: spr,
      y: y - 6,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Gentle rotation (faster + flashier on the mega reward)
    this.tweens.add({
      targets: spr,
      angle: 360,
      duration: mega ? 3600 : 5000,
      repeat: -1,
    });

    // Pulse scale — oscillates around the resting scale (delayed past the mega pop)
    this.tweens.add({
      targets: spr,
      scaleX: baseScale * 1.2,
      scaleY: baseScale * 1.2,
      duration: 900,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay: mega ? 340 : 0,
    });

    this._starPickups.push({
      spr: spr, x: x, y: y, spawnTime: this.gameTime,
      dur: dur, mega: mega, guide: !!opts.guide,
      expiry: opts.expiry || (mega ? 16 : 8),
    });
  };

  /* ---------------------------------------------------------------
     Check overlap between player and stars; remove expired stars
     --------------------------------------------------------------- */
  M._checkStarPickup = function () {
    // Guidance chevron toward any guided (Cache-Zone reward) orb, refreshed each frame.
    this._renderStarPointer();

    var p = this.p;
    var now = this.gameTime;

    // Check for collected or expired stars (iterate backward to safely splice)
    for (var i = this._starPickups.length - 1; i >= 0; i--) {
      var star = this._starPickups[i];
      var age = now - star.spawnTime;
      var exp = star.expiry || 8;   // seconds (gameTime is in seconds)

      // Player pickup (the mega reward orb has a roomier grab radius)
      if (p.state !== 'DEAD') {
        var pR = C.SIZE * 0.7;
        var dx = p.x - star.spr.x, dy = p.y - star.spr.y;
        var thresh = pR + (star.mega ? 22 : 14);   // star outer radius ~12
        if (dx * dx + dy * dy < thresh * thresh) {
          this._collectStar(i);
          return;
        }
      }

      // Expiry with a fade warning over the last 2 seconds
      if (age > exp) {
        this._expireStar(i);
      } else if (age > exp - 2) {
        var fadeRatio = (age - (exp - 2)) / 2;
        star.spr.setAlpha(1 - fadeRatio * 0.7);
      }
    }
  };

  /* ---------------------------------------------------------------
     Guidance chevron toward the nearest GUIDED star (the Cache-Zone
     Overdrive reward) — same look/logic as the Anomaly/Fountain pointer,
     in Overdrive magenta. Only shown while the orb is far enough to matter.
     --------------------------------------------------------------- */
  M._renderStarPointer = function () {
    var pg = this._starPtrGfx;
    if (!pg) return;
    pg.clear();
    var p = this.p, picks = this._starPickups;
    if (!p || p.state === 'DEAD' || !picks || !picks.length) return;

    var best = null, bestD2 = Infinity;
    for (var i = 0; i < picks.length; i++) {
      var s = picks[i];
      if (!s.guide || !s.spr) continue;
      var dx = s.spr.x - p.x, dy = s.spr.y - p.y;
      var d2 = dx * dx + dy * dy;
      if (d2 > 90 * 90 && d2 < bestD2) { bestD2 = d2; best = s; }   // only point when it's a real walk away
    }
    if (!best) return;

    var ang = Math.atan2(best.spr.y - p.y, best.spr.x - p.x);
    var gt = this.gameTime, D = 84, size = 17;
    var px = p.x + Math.cos(ang) * D, py = p.y + Math.sin(ang) * D;
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(gt * Math.PI * 3.2));
    var col = C.STAR_TINT;
    var nose = { x: Math.cos(ang) * size,       y: Math.sin(ang) * size };
    var lwn  = { x: Math.cos(ang + 2.5) * size, y: Math.sin(ang + 2.5) * size };
    var rwn  = { x: Math.cos(ang - 2.5) * size, y: Math.sin(ang - 2.5) * size };
    pg.fillStyle(col, 0.18 * pulse);
    pg.fillTriangle(px + nose.x * 1.35, py + nose.y * 1.35,
                    px + lwn.x  * 1.35, py + lwn.y  * 1.35,
                    px + rwn.x  * 1.35, py + rwn.y  * 1.35);
    pg.fillStyle(col, 0.9 * pulse);
    pg.fillTriangle(px + nose.x, py + nose.y, px + lwn.x, py + lwn.y, px + rwn.x, py + rwn.y);
    pg.fillStyle(0xffffff, 0.9 * pulse);
    pg.fillTriangle(px + nose.x * 0.5, py + nose.y * 0.5,
                    px + lwn.x  * 0.45, py + lwn.y  * 0.45,
                    px + rwn.x  * 0.45, py + rwn.y  * 0.45);
  };

  /* ---------------------------------------------------------------
     Collect: destroy star, visuals, activate star power
     --------------------------------------------------------------- */
  M._collectStar = function (idx) {
    var star = this._starPickups[idx];
    var sx = star.spr.x, sy = star.spr.y;
    var mega = star.mega, dur = star.dur || C.STAR_DUR;

    // Destroy sprite and tweens
    this.tweens.killTweensOf(star.spr);
    star.spr.destroy();
    this._starPickups.splice(idx, 1);

    // Particles burst (magenta + white) — beefier for the mega reward
    this._explode(sx, sy, C.STAR_TINT_ARR, mega ? 60 : 35);
    this._explode(sx, sy, [255, 255, 255], mega ? 26 : 15);
    if (mega) this._spawnWaveRing(sx, sy, { maxRadius: 220, color: C.STAR_TINT, expandTime: 0.45 });

    // Flash screen violet
    this.cameras.main.flash(mega ? 260 : 200, 180, 20, 200);
    // Shake proportional to existing shakes (~0.008)
    this.cameras.main.shake(mega ? 180 : 120, mega ? 0.012 : 0.008);
    // Float label at player position — stacks above any shield/boss callouts.
    // (When already powered this ADDS time — see _activateStarPower — so the label
    // still reads "OVERDRIVE"; the mega reward advertises its big duration.)
    var label = mega ? ('OVERDRIVE ' + Math.round(dur / 1000) + 's !') : 'OVERDRIVE !';
    this._floatLabel(this.p.x, this.p.y - 30, label, '#ff14c8');
    // Hitstop for juicy feel
    this._triggerHitstop(mega ? 90 : 60);

    this._activateStarPower(dur);
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
  /* Activate Overdrive for durMs (default STAR_DUR). The countdown + the warning +
     the end are all driven off this._starPowerTimer in scene.update (no delayedCall),
     which keeps the HUD bar and the effect perfectly in sync and — crucially — lets
     a pickup taken WHILE ALREADY POWERED simply ADD time instead of resetting the
     bar (so a normal star never downgrades a long Cache-Zone Overdrive, and stacking
     two normal stars extends rather than truncates). */
  M._activateStarPower = function (durMs) {
    durMs = durMs || C.STAR_DUR;
    if (this.isStarPowered) {
      this._starPowerTimer = (this._starPowerTimer || 0) + durMs;   // accumulate, never reset
    } else {
      this.isStarPowered   = true;
      this._starPowerTimer = durMs;
    }
    this._starPowerWarning = false;
    // The HUD bar fills relative to the biggest charge this session has held, so a
    // fresh pickup reads full and an accumulating one extends it without overflowing.
    this._starPowerMax = Math.max(this._starPowerMax || 0, this._starPowerTimer, durMs);
  };

  M._deactivateStarPower = function () {
    this.isStarPowered = false;
    this._starPowerTimer = 0;
    this._starPowerMax = 0;
    this._starPowerWarning = false;
    if (this._starPtrGfx) this._starPtrGfx.clear();
    // Restore player visuals (handled in _renderPlayer — clearTint)
  };

  /* "Power-down" punctuation, fired the instant the countdown hits 0 (see
     scene.update). Without it the aura, the +25% scale and the HUD bar all just
     blink out silently, so a player looking elsewhere can keep believing they're
     still overdriven. This makes the END a distinct moment — the read is the
     mirror of the hot pickup burst: the boost is LEAVING you, not arriving.
     Called BEFORE _deactivateStarPower so the player position is still valid. */
  M._starPowerExpireFx = function () {
    var p = this.p;
    if (!p) return;
    var x = p.x, y = p.y;

    // Cooling puff: magenta sparks fading into a dim grey (vs. the bright magenta
    // + white of the pickup) — colour-codes "power lost".
    this._explode(x, y, C.STAR_TINT_ARR, 16);
    this._explode(x, y, [150, 150, 165], 12);

    // The aura visibly SNAPS inward and winks out — a quick implosion ring that
    // mirrors the pulsing aura it replaces, so the eye registers the change.
    var ring = this.add.graphics();
    ring.setDepth(31);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    var auraR = C.SIZE * 1.25 * 1.4;   // matches the live aura radius in _renderPlayer
    ring.lineStyle(4, C.STAR_TINT, 0.85);
    ring.strokeCircle(0, 0, auraR);
    ring.lineStyle(2, 0xff88ff, 0.95);
    ring.strokeCircle(0, 0, auraR * 0.62);
    ring.setPosition(x, y);
    this.tweens.add({
      targets: ring,
      scaleX: 0.05, scaleY: 0.05, alpha: 0,
      duration: 300, ease: 'Quad.easeIn',
      onComplete: function () { ring.destroy(); },
    });

    // A clear, cooled-down callout the player can't miss — a desaturated blue-grey
    // (not the hot magenta of "OVERDRIVE !") so it reads unmistakably as "over".
    this._floatLabel(x, y - 30, 'OVERDRIVE OVER', '#9aa6c0');
  };

})();
