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
    this._checkUpgradeTrigger();
  };

  M._floatLabel = function (wx, wy, label, col, stackIdx) {
    var stagger = (stackIdx || 0) * 45;
    var txt = this.add.text(wx, wy, label, {
      fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: col,
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

  M._floatScoreBig = function (label, pts, _extra) {
    // PARADE: buffer 80ms to merge rapid consecutive hits into one message
    if (label === 'PARADE' && !_extra) {
      if (!this._paradeBuf) this._paradeBuf = { n: 0, pts: 0 };
      this._paradeBuf.n++;
      this._paradeBuf.pts += pts;
      if (this._paradeFlushEvt) this._paradeFlushEvt.remove(false);
      var selfP = this;
      this._paradeFlushEvt = this.time.delayedCall(250, function () {
        var b = selfP._paradeBuf;
        selfP._paradeBuf = null;
        selfP._paradeFlushEvt = null;
        selfP._floatScoreBig('PARADE', b.pts, { count: b.n });
      });
      return;
    }

    var cam = this.cameras.main;
    var sx = cam.width / 2;

    // Anchor above the player — offset large enough to avoid blocking immediately above them
    var psy = (this.p.y - cam.scrollY) * cam.zoom;
    var syBase = psy - 200;
    syBase = Math.max(syBase, cam.height * 0.22);   // never above 22% — stays below score/combo HUD
    syBase = Math.min(syBase, cam.height * 0.70);   // never below 70% of screen

    var count = (_extra && _extra.count > 1) ? _extra.count : 0;
    var col = label === 'PARADE' ? '#aa44ff'
            : label === 'NUKE' ? '#00ffff'
            : label === 'DELAY_EXP' ? '#ff4422'
            : label === 'THE WORLD' ? '#ffc832'
            : '#ffcc00';
    var displayLbl = label === 'DELAY_EXP' ? 'Delayed Explosion'
                   : (label === 'PARADE' && count > 1) ? 'PARADE \u00d7' + count
                   : label;

    // Stack upward from anchor — each slot is 48px above the previous
    if (!this._bigScoreSlots) this._bigScoreSlots = [];
    var slot = 0;
    while (this._bigScoreSlots[slot] && slot < 7) slot++;
    var sy = syBase - slot * 48;
    var self = this;

    var txt = this.add.text(sx, sy, '+' + pts + ' ' + displayLbl + '!', {
      fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: col,
    });
    txt.setOrigin(0.5); txt.setDepth(105);
    txt.setScrollFactor(0);
    txt.setBlendMode(Phaser.BlendModes.ADD);
    txt.setAlpha(0.82);
    txt.setScale(0.35);
    this._bigScoreSlots[slot] = txt;

    // Hold duration scales with score (log10): 400ms at low score, up to 1200ms near 100 000 pts
    var holdDur = 400 + Math.min(Math.log10(Math.max(pts, 1)) * 160, 800);
    var popDur  = 180;  // pop-in

    // 1. Pop in — stay big (no yoyo)
    this.tweens.add({
      targets: txt, scaleX: 1.15, scaleY: 1.15,
      duration: popDur, ease: 'Back.easeOut',
    });
    // 2. Shrink + float + fade — starts after pop + hold
    this.tweens.add({
      targets: txt, y: sy - 40, alpha: 0, scaleX: 0.65, scaleY: 0.65,
      duration: 650, ease: 'Cubic.easeIn', delay: popDur + holdDur,
      onComplete: function () {
        self._bigScoreSlots[slot] = null;
        txt.destroy();
      },
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
    ctx = ctx || {};

    // Time Stop: defer kill — enemy is condemned but stays in place
    // NO score, combo, or floating text during TW — tallied at resolution
    if (this._twActive && !ctx._twResolving) {
      this._twDeferKill(idx);
      return;
    }

    // During the post-TW batch window, kills count as batch (no individual float)
    if (this._twBatchWindow) {
      ctx.batch = true;
    }

    var ex = e.x, ey = e.y;
    var killTier = e.tier;

    this.totalKills++;
    if (!this._batchActive) this._checkUpgradeTrigger();
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

    // Shield acquisition via combo milestones
    var shieldMilestones = [10];
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

    if (ctx.condemned) {
      // Condemned-mark death: VFX handled by TW resolve clustering pass — skip individual ring here
    } else {
      var cnt = Math.round(30 + (e.size / C.RUSHER_SIZE) * 20);
      cnt = Math.min(cnt, 50);
      this._explode(ex, ey, [255, 30, 60], cnt);
      this._explode(ex, ey, [255, 160, 80], Math.round(cnt * 0.5));
      this._explode(ex, ey, [255, 255, 220], Math.round(cnt * 0.25));
    }

    e.spr.destroy();
    for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
    if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
    this.enemies.splice(idx, 1);

    if (!ctx.condemned) {
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
    var detoLvl  = (this._upgradeLevels && this._upgradeLevels.detonation) || 0;
    // Golden palette when fired at TW resolution
    var twDeto = !!this._twBatchWindow;
    var radMult  = detoLvl >= 2 ? 1.8 : 1.0;
    var detRadius   = C.SHOCKWAVE_RADIUS * 2.5 * radMult;
    var detRadiusSq = detRadius * detRadius;
    // Ring params moved here so waveSpeed is available for hit-delay timing
    // TW (gold) always takes priority over detoLvl color
    var ringColor = twDeto ? 0xffc832 : (detoLvl >= 2 ? 0xb450ff : 0x00ffff);
    var ringExpT  = (detoLvl >= 2) ? 0.20 : 0.24;   // lv2 faster: ring covers 495px in 0.20s
    var waveSpeed = detRadius / ringExpT;              // px/s

    // During TW batch window, don't create a nested batch — just use the parent
    var ownBatch = !this._twBatchWindow;
    if (ownBatch) this._beginBatch('NUKE');
    var detoKills = 0;
    this._killEnemy(markedIdx, { batch: true });
    detoKills++;

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var o = this.enemies[i];
      var odx = o.x - ex, ody = o.y - ey;
      var odSq = odx * odx + ody * ody;
      if (odSq < detRadiusSq) {
        // Delay hit particles so ring visually reaches each enemy before they burst
        var expDelay = Math.round(Math.sqrt(odSq) / waveSpeed * 1000);
        var expCol   = twDeto ? [255, 200, 50] : [0, 255, 255];
        (function (sc, ox, oy, col, ms) {
          if (ms < 30) { sc._explode(ox, oy, col, 10); }
          else { sc.time.delayedCall(ms, function () { sc._explode(ox, oy, col, 10); }); }
        })(this, o.x, o.y, expCol, expDelay);
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
    if (ownBatch) this._endBatch();

    // Star spawn: detonation killed ≥ STAR_DETO_THRESH enemies
    if (detoKills >= C.STAR_DETO_THRESH) {
      var self = this;
      this.time.delayedCall(200, function () {
        self._spawnStar(ex, ey);
      });
    }

    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      if (pr.isReflected) continue;  // already on our side — nuke spares reflected projectiles
      var pdx = pr.x - ex, pdy = pr.y - ey;
      if (pdx * pdx + pdy * pdy < detRadiusSq) {
        this._explode(pr.x, pr.y, twDeto ? [255, 200, 50] : [0, 255, 255], 5);
        this._destroyProjectile(pr);
        this.projectiles.splice(pi, 1);
      }
    }

    if (twDeto) { this.cameras.main.flash(200, 255, 200, 50, false); }
    else          { this.cameras.main.flash(200, 0, 255, 255, false); }
    this.cameras.main.shake(detoLvl >= 2 ? 280 : 200, detoLvl >= 2 ? 0.030 : 0.018);
    this._triggerHitstop(detoLvl >= 2 ? C.DETONATION_HITSTOP * 1.4 : C.DETONATION_HITSTOP);
    this._spawnWaveRing(ex, ey, { maxRadius: detRadius, color: ringColor, expandTime: ringExpT });
    if (detoLvl >= 2) {
      // Extra echo rings emphasise the bigger nuke — staggered 80 ms apart
      var self2 = this;
      this.time.delayedCall(80,  function () { if (self2._spawnWaveRing) self2._spawnWaveRing(ex, ey, { maxRadius: detRadius, color: ringColor, expandTime: ringExpT }); });
      this.time.delayedCall(160, function () { if (self2._spawnWaveRing) self2._spawnWaveRing(ex, ey, { maxRadius: detRadius, color: ringColor, expandTime: ringExpT }); });
    }

    if (twDeto) {
      this._explode(ex, ey, [255, 200, 50],  detoLvl >= 2 ? 90  : 50);
      this._explode(ex, ey, [255, 255, 200], detoLvl >= 2 ? 55  : 30);
      if (detoLvl >= 2) { this._explode(ex, ey, [255, 160, 0], 40); }  // deep gold accent
    } else {
      this._explode(ex, ey, [0, 255, 255],    detoLvl >= 2 ? 90  : 50);
      this._explode(ex, ey, [255, 255, 255],  detoLvl >= 2 ? 55  : 30);
      if (detoLvl >= 2) { this._explode(ex, ey, [180, 80, 255], 40); }  // violet — bigger nuke
    }
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

    this._spawnWaveRing(p.x, p.y, { maxRadius: 55, color: 0x00ffff, expandTime: 0.14 });

    p.invincible = true; p.invincTimer = 250; p.dashInvinc = true;
  };

  /* ================================================================
     DELAYED EXPLOSION — baseAtk upgrade Lv1/Lv2
     ================================================================ */

  M._trySpawnDelayedExplosion = function (x, y) {
    var lvl = (this._upgradeLevels && this._upgradeLevels.baseAtk) || 0;
    if (lvl === 0) return;
    var chance = lvl >= 2 ? 0.10 : 0.05;
    if (Math.random() >= chance) return;

    var self    = this;
    var DELAY   = 2000;     // ms until explosion
    var startR  = C.SHOCKWAVE_RADIUS * (lvl >= 2 ? 0.99 : 0.61);  // smaller warning ring, proportional to level
    var gfx     = this.add.graphics();
    gfx.setDepth(55);

    // Tween a plain object so onUpdate redraws the warning circle each frame
    var state = { r: startR };
    this.tweens.add({
      targets:  state,
      r:        0,
      duration: DELAY,
      ease:     'Cubic.easeIn',
      onUpdate: function () {
        if (!self._upgradeLevels) { gfx.clear(); return; }
        var curR = state.r;
        if (curR <= 0) { gfx.clear(); return; }
        var prog    = 1.0 - curR / startR;           // 0→1 as ring closes
        var late    = prog * prog;                    // quadratic; accelerates at end
        var flicker = prog > 0.70 ? (0.78 + Math.random() * 0.22) : 1.0;
        var RED     = 0xff2222;
        var ORANGE  = 0xff6633;

        gfx.clear();

        // Outer ring
        gfx.lineStyle(2.5, RED, (0.30 + late * 0.60) * flicker);
        gfx.strokeCircle(x, y, curR);

        // Very faint interior fill
        gfx.fillStyle(RED, (0.015 + late * 0.035) * flicker);
        gfx.fillCircle(x, y, curR);

        // Inner secondary ring at 55% radius
        if (curR > 8) {
          gfx.lineStyle(1.5, RED, (0.15 + late * 0.50) * flicker);
          gfx.strokeCircle(x, y, curR * 0.55);
        }

        // Growing center dot (appears in last 40% of delay)
        if (prog > 0.60) {
          var dotProg = (prog - 0.60) / 0.40;
          var dotR    = dotProg * 7 * flicker;
          gfx.fillStyle(0xffffff, late * 0.90 * flicker);
          gfx.fillCircle(x, y, dotR);
          gfx.fillStyle(ORANGE, late * 0.55 * flicker);
          gfx.fillCircle(x, y, dotR * 1.5);
        }
      },
      onComplete: function () {
        gfx.destroy();
        if (!self._upgradeLevels) return; // scene was restarted
        self._triggerDelayedExplosion(x, y, lvl);
      },
    });
  };

  M._triggerDelayedExplosion = function (x, y, lvl) {
    // Lv1 = same AoE as reflected-projectile smash (×1.1)
    // Lv2 = halfway between reflected (×1.1) and nuke (×2.5) = ×1.8
    var radius   = C.SHOCKWAVE_RADIUS * (lvl >= 2 ? 1.8 : 1.1);
    var radiusSq = radius * radius;

    var dOwnBatch = !this._twBatchWindow;
    if (dOwnBatch) this._beginBatch('DELAY_EXP');

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e   = this.enemies[i];
      var dx  = e.x - x, dy = e.y - y;
      var dSq = dx * dx + dy * dy;
      if (dSq >= radiusSq) continue;

      var d  = Math.sqrt(dSq);
      var f  = 1.0 - d / radius;

      if (e.tier === 3 && e.hasShield) {
        this._breakShield(e);
      } else {
        e.hp -= 1;
        if (e.hp <= 0) {
          this._killEnemy(i, { batch: true });
        } else {
          this._explode(e.x, e.y, [0, 255, 255], 6);
        }
      }
    }

    if (dOwnBatch) this._endBatch();

    // Visuals — ring matches the warning circle's red color
    this._explode(x, y, [255, 34, 34], 45);
    this._explode(x, y, [255, 255, 255], 20);
    this._spawnWaveRing(x, y, { maxRadius: radius, color: 0xff2222, expandTime: 0.28 });
    this.cameras.main.flash(160, 255, 34, 34, false);
    this.cameras.main.shake(140, 0.010);
    this._triggerHitstop(Math.round(C.DETONATION_HITSTOP * 0.7));
  };

})();
