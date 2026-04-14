/* ==========================================================================
   Light Again — Combat: Kill, Detonation, Burst, Combo, Hitstop (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._triggerHitstop = function (durMs) {
    var cap = (durMs >= C.DETONATION_HITSTOP) ? C.DETONATION_HITSTOP : C.HITSTOP_MAX;
    this.hitstopTimer = Math.min(Math.max(this.hitstopTimer, durMs), cap);
    this.timeScale = 0;
  };

  M._beginBatch = function (label) {
    this._batchScore = 0;
    this._batchLabel = label;
    this._batchActive = true;
  };

  M._endBatch = function () {
    if (!this._batchActive) return;
    this._batchActive = false;
    if (this._batchScore > 0) {
      this._floatScoreBig(this._batchLabel, this._batchScore);
    }
  };

  M._floatLabel = function (wx, wy, label, col, stackIdx) {
    var stagger = (stackIdx || 0) * 45;
    var txt = this.add.text(wx, wy, label, {
      fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: col,
      stroke: '#000000', strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, color: col, blur: 8, fill: true },
    });
    txt.setOrigin(0.5, 1); txt.setDepth(70 + (stackIdx || 0));
    this.tweens.add({
      targets: txt, y: wy - 30, duration: 600, ease: 'Linear', delay: stagger,
    });
    this.tweens.add({
      targets: txt, alpha: 0, duration: 400, ease: 'Cubic.easeIn', delay: 400 + stagger,
      onComplete: function () { txt.destroy(); },
    });
  };

  M._floatScore = function (wx, wy, pts, tier) {
    var col, sz, shCol;
    if (tier === 3) {
      col = '#b44dff'; sz = '30px'; shCol = 'rgba(40,0,72,0.75)';
    } else if (tier === 2) {
      col = '#ffaa22'; sz = '26px'; shCol = 'rgba(48,24,0,0.72)';
    } else {
      col = '#ff0044'; sz = '22px'; shCol = 'rgba(40,0,12,0.75)';
    }
    var txt = this.add.text(wx, wy - 10, '+' + pts, {
      fontFamily: 'monospace', fontSize: sz, fontStyle: 'normal', color: col,
      stroke: '#ffffff', strokeThickness: 1,
      shadow: { offsetX: 0, offsetY: 2, color: shCol, blur: 5, stroke: true, fill: true },
    });
    txt.setOrigin(0.5, 1); txt.setDepth(60);
    txt.setBlendMode(Phaser.BlendModes.ADD);
    txt.setAlpha(1.0);
    txt.setScale(1.38);
    this.tweens.add({
      targets: txt,
      y: wy - 80,
      scaleX: 0.92, scaleY: 0.92,
      alpha: 0,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: function () { txt.destroy(); },
    });
  };

  M._floatScoreBig = function (label, pts) {
    var cam = this.cameras.main;
    var sx = cam.width / 2, sy = cam.height * 0.3;
    var col = label === 'PARADE' ? '#aa44ff' : label === 'NUKE' ? '#00ffff' : '#ffcc00';
    var txt = this.add.text(sx, sy, '+' + pts + ' ' + label + '!', {
      fontFamily: 'monospace', fontSize: '32px', fontStyle: 'bold', color: col,
    });
    txt.setOrigin(0.5); txt.setDepth(105);
    txt.setScrollFactor(0);
    txt.setBlendMode(Phaser.BlendModes.ADD);
    txt.setScale(0.5);
    this.tweens.add({
      targets: txt, scaleX: 1.1, scaleY: 1.1,
      duration: 150, ease: 'Back.easeOut',
      yoyo: true, hold: 100,
    });
    this.tweens.add({
      targets: txt, y: sy - 50, alpha: 0,
      duration: 1200, ease: 'Cubic.easeOut', delay: 300,
      onComplete: function () { txt.destroy(); },
    });
  };

  M._breakCombo = function () {
    if (this.comboMultiplier <= 1) return;
    var self = this;
    this._comboTxt.setColor('#ff2222');
    this._lastComboCol = '#ff2222';
    this._comboTxt.setAlpha(1.0);
    this.tweens.add({
      targets: this._comboTxt, alpha: 0, duration: 350, ease: 'Cubic.easeIn',
      onComplete: function () { self._comboTxt.setAlpha(0); },
    });
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this._comboPulse = 0;
  };

  // ctx: { batch: bool, reflected: bool }
  M._killEnemy = function (idx, ctx) {
    var e = this.enemies[idx];
    var ex = e.x, ey = e.y;
    var killTier = e.tier;
    ctx = ctx || {};

    this.totalKills++;
    var basePts = e.tier === 3 ? 100 : e.tier === 2 ? 30 : 10;
    var pts = basePts * this.comboMultiplier;
    if (ctx.reflected) pts *= 2;
    this.score += pts;
    this.comboTimer = 2000;
    var prevCm = this.comboMultiplier;
    this.comboMultiplier++;
    var newCm = this.comboMultiplier;
    if (newCm > this.bestCombo) this.bestCombo = newCm;
    this._comboPulse = 1.0;

    // Shield acquisition aux paliers 10 et 50
    var shieldMilestones = [10, 50];
    for (var sm = 0; sm < shieldMilestones.length; sm++) {
      var ms = shieldMilestones[sm];
      if (prevCm < ms && newCm >= ms && this.playerShields < this.MAX_SHIELDS) {
        this.playerShields++;
        var shLabel = 'Combo X' + ms + ' : +1 SHIELD';
        var stk = this._shieldFloatStack++;
        this._floatLabel(this.p.x, this.p.y - 30 - stk * 28, shLabel, '#00ffff', stk);
        this.cameras.main.flash(180, 0, 220, 255);
      }
    }

    if (ctx.batch) {
      this._batchScore += pts;
    } else {
      this._floatScore(ex, ey, pts, killTier);
    }

    var cnt = Math.round(30 + (e.size / C.RUSHER_SIZE) * 20);
    cnt = Math.min(cnt, 50);
    this._explode(ex, ey, [255, 30, 60], cnt);
    this._explode(ex, ey, [255, 160, 80], Math.round(cnt * 0.5));
    this._explode(ex, ey, [255, 255, 220], Math.round(cnt * 0.25));

    e.spr.destroy();
    for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
    if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
    this.enemies.splice(idx, 1);

    this._triggerHitstop(C.HITSTOP_DUR);
    this.cameras.main.shake(60, 0.005);

    for (var k = 0; k < this.enemies.length; k++) {
      var o = this.enemies[k];
      if (o.tier === 3) continue;
      var sdx = o.x - ex, sdy = o.y - ey;
      var sdSq = sdx * sdx + sdy * sdy;
      if (sdSq < C.SHOCKWAVE_RADIUS_SQ) {
        var sd = Math.sqrt(sdSq);
        var f = 1.0 - sd / C.SHOCKWAVE_RADIUS;
        var nx = sd > 0.1 ? sdx / sd : Math.random() - 0.5;
        var ny = sd > 0.1 ? sdy / sd : Math.random() - 0.5;
        o.vx += nx * C.SHOCKWAVE_FORCE * f;
        o.vy += ny * C.SHOCKWAVE_FORCE * f;
        o.stunTimer = C.SHOCKWAVE_STUN * f;
      }
    }
  };

  M._breakShield = function (e) {
    if (!e.hasShield) return;
    e.hasShield = false;
    this._explode(e.x, e.y, [0, 255, 255], 20);
    this._explode(e.x, e.y, [255, 255, 255], 10);
    this.cameras.main.shake(60, 0.006);
    this._triggerHitstop(C.HITSTOP_DUR);
  };

  M._triggerDetonation = function (markedIdx) {
    var p = this.p;
    var e = this.enemies[markedIdx];
    var ex = e.x, ey = e.y;
    var detRadius = C.SHOCKWAVE_RADIUS * 2.5;
    var detRadiusSq = detRadius * detRadius;

    this._beginBatch('NUKE');
    var detoKills = 0;
    this._killEnemy(markedIdx, { batch: true });
    detoKills++;

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var o = this.enemies[i];
      var odx = o.x - ex, ody = o.y - ey;
      if (odx * odx + ody * ody < detRadiusSq) {
        this._explode(o.x, o.y, [0, 255, 255], 10);
        if (o.tier === 3 && o.hasShield) {
          this._breakShield(o);
        } else if (o.tier === 3) {
          o.hp -= 2;
          if (o.hp <= 0) { this._killEnemy(i, { batch: true }); detoKills++; }
        } else {
          this._killEnemy(i, { batch: true }); detoKills++;
        }
      }
    }
    this._endBatch();

    // Star spawn: detonation killed ≥ STAR_DETO_THRESH enemies
    if (detoKills >= C.STAR_DETO_THRESH) {
      var self = this;
      this.time.delayedCall(200, function () {
        self._spawnStar(ex, ey);
      });
    }

    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      var pdx = pr.x - ex, pdy = pr.y - ey;
      if (pdx * pdx + pdy * pdy < detRadiusSq) {
        this._explode(pr.x, pr.y, [0, 255, 255], 5);
        this._destroyProjectile(pr);
        this.projectiles.splice(pi, 1);
      }
    }

    this.cameras.main.flash(200, 0, 255, 255, false);
    this.cameras.main.shake(200, 0.018);
    this._triggerHitstop(C.DETONATION_HITSTOP);
    this._spawnWaveRing(ex, ey);

    this._explode(ex, ey, [0, 255, 255], 50);
    this._explode(ex, ey, [255, 255, 255], 30);
  };

  M._triggerLandingBurst = function () {
    var p = this.p;

    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.tier !== 1) continue;
      var dx = e.x - p.x, dy = e.y - p.y;
      var dSq = dx * dx + dy * dy;
      if (dSq < C.LANDING_BURST_RADIUS_SQ && dSq > 0.01) {
        var d = Math.sqrt(dSq);
        var f = 1.0 - d / C.LANDING_BURST_RADIUS;
        e.vx += (dx / d) * C.LANDING_BURST_FORCE * 0.25 * (0.5 + f * 0.5);
        e.vy += (dy / d) * C.LANDING_BURST_FORCE * 0.25 * (0.5 + f * 0.5);
        e.stunTimer = Math.max(e.stunTimer, C.LANDING_BURST_STUN * f * 0.5);
      }
    }

    var ring = this._waveRings[this._waveRingW % this._waveRings.length];
    this._waveRingW++;
    ring.x = p.x; ring.y = p.y;
    ring.r = 10; ring.alpha = 0.45; ring.active = true;
    ring.gfx.setVisible(true);

    p.invincible = true; p.invincTimer = 250; p.dashInvinc = true;
  };

})();
