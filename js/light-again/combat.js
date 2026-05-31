/* ==========================================================================
   Light Again — Combat: Kill, Detonation, Burst, Combo, Hitstop (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* Called from _destroyProjectile whenever a reflected projectile leaves the
     world. When the in-flight count for its dash-attack id reaches zero, flush
     the accumulated PARADE popup immediately instead of waiting for the safety
     timeout — so the popup appears as soon as the last hit lands (or as soon as
     a stray reflection expires without hitting anything). */
  M._paradeFlushIfDone = function (atkId) {
    if (!this._paradePending || this._paradePending[atkId] === undefined) return;
    this._paradePending[atkId]--;
    if (this._paradePending[atkId] > 0) return;
    delete this._paradePending[atkId];
    var buf = this._paradeBufs && this._paradeBufs[atkId];
    if (!buf) return;
    if (buf.timeoutEvt) { buf.timeoutEvt.remove(false); buf.timeoutEvt = null; }
    delete this._paradeBufs[atkId];
    this._floatScoreBig('PARADE', buf.pts, { count: buf.n });
  };

  M._triggerHitstop = function (durMs) {
    var cap = (durMs >= C.DETONATION_HITSTOP) ? C.DETONATION_HITSTOP : C.HITSTOP_MAX;
    this.hitstopTimer = Math.min(Math.max(this.hitstopTimer, durMs), cap);
    this.timeScale = 0;
  };

  M._beginBatch = function (label, extra) {
    this._batchScore  = 0;
    this._batchLabel  = label;
    this._batchExtra  = extra || null;   // e.g. { dashAtkId } for PARADE bucketing
    this._batchActive = true;
  };

  M._endBatch = function () {
    if (!this._batchActive) return;
    this._batchActive = false;
    if (this._batchScore > 0) {
      this._floatScoreBig(this._batchLabel, this._batchScore, this._batchExtra);
    }
    this._batchExtra = null;
    this._checkUpgradeTrigger();
  };

  /* Anti-overlap layout for WORLD-SPACE floating callouts. Reserves a vertical
     band for a label (origin is bottom = baselineY, the band grows upward by
     `height`) in a small live registry keyed by screen column, then returns a
     baseline Y that clears every band still alive in that column — so several
     callouts firing at once (e.g. a boss-kill banner + a draft-skip "+1 SHIELD")
     stack one above another instead of printing on the same spot. Bands expire
     after `lifeMs`; the timer rides on gameTime, which also freezes while the
     scene is paused (draft / menu / game over), so a label spawned mid-pause
     still stacks correctly. Different screen columns are independent, so callouts
     far apart never shove each other. The band is recorded at spawn time (before
     the float-up drift) — conservative, which is exactly what we want here. */
  M._reserveLabelBand = function (worldX, baselineY, height, lifeMs) {
    if (!this._labelBands) this._labelBands = [];
    var now = this.gameTime || 0;
    var live = [];
    for (var i = 0; i < this._labelBands.length; i++) {
      if (this._labelBands[i].until > now) live.push(this._labelBands[i]);
    }
    this._labelBands = live;

    var col = Math.round((worldX - this.cameras.main.scrollX) / 220);
    var MARGIN = 8;
    var bottom = baselineY, top = baselineY - height;
    // Push the band up until it clears every live band sharing this column.
    var moved = true, guard = 0;
    while (moved && guard++ < 40) {
      moved = false;
      for (var j = 0; j < live.length; j++) {
        var b = live[j];
        if (b.col !== col) continue;
        if (bottom > b.top - MARGIN && top < b.bottom + MARGIN) {
          var shift = bottom - (b.top - MARGIN);
          bottom -= shift; top -= shift;
          moved = true;
        }
      }
    }

    this._labelBands.push({ col: col, top: top, bottom: bottom, until: now + lifeMs / 1000 });
    return bottom;
  };

  /* World-space callout label ("+1 SHIELD", "OVERDRIVE!", fairy pickups…). Pass
     the anchor's BASELINE y (origin is bottom); _reserveLabelBand shifts it up as
     needed so simultaneous labels never overlap. */
  M._floatLabel = function (wx, anchorY, label, col) {
    var wy = this._reserveLabelBand(wx, anchorY, 32, 850);
    var txt = this.add.text(wx, wy, label, {
      fontFamily: 'monospace', fontSize: '28px', fontStyle: 'bold', color: col,
      stroke: '#000000', strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, color: col, blur: 8, fill: true },
    });
    txt.setOrigin(0.5, 1);
    txt.setDepth(70 + ((this._floatLabelSeq = (this._floatLabelSeq || 0) + 1) % 16));
    this.tweens.add({
      targets: txt, y: wy - 30, duration: 600, ease: 'Linear',
    });
    this.tweens.add({
      targets: txt, alpha: 0, duration: 400, ease: 'Cubic.easeIn', delay: 400,
      onComplete: function () { txt.destroy(); },
    });
  };

  /* Unified mini-boss KILL banner — big, bold, held on screen for a beat. Every
     mini-boss (Anomaly / Giga Bruiser / Mirror / Serpent) uses this exact timing
     so the "boss down" moment reads the same: pop-in → long hold → drift + fade
     (~2.8 s total). `x,y` is the world baseline (callers offset by boss size). */
  M._bossKillBanner = function (x, y, text, color, glowColor) {
    // Share the world-label anti-overlap registry so a draft-skip "+1 SHIELD"
    // (or any callout) landing while this banner is still on screen stacks above
    // it instead of overlapping. Banner lives ~2.8 s; reserve a taller band.
    y = this._reserveLabelBand(x, y, 46, 2850);
    var txt = this.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '38px', fontStyle: 'bold',
      color: color, stroke: '#000000', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: glowColor || color, blur: 14, fill: true },
    });
    txt.setOrigin(0.5, 1);
    txt.setDepth(75);
    txt.setAlpha(0);
    txt.setScale(0.55);
    // Pop in with a satisfying overshoot
    this.tweens.add({ targets: txt, scaleX: 1.0, scaleY: 1.0, alpha: 1.0, duration: 320, ease: 'Back.easeOut' });
    // Drift slowly upward while held visible
    this.tweens.add({ targets: txt, y: y - 44, duration: 2200, ease: 'Sine.easeOut', delay: 320 });
    // Fade out at the end
    this.tweens.add({ targets: txt, alpha: 0, duration: 600, ease: 'Cubic.easeIn', delay: 2200,
      onComplete: function () { txt.destroy(); } });
  };

  /* ==========================================================================
     BOSS DEFEAT — uniform aftermath shared by all four mini-bosses.
     A stylish boss-coloured shockwave erupts from the boss and CLEARS the board;
     the boss is worth BOSS_KILL_SCORE and every enemy swept by the wave is worth
     its tier value — all multiplied by the combo HELD at the kill (but neither
     the boss nor the clear feeds the combo, and the combo RESETS afterwards). The
     cumulative points show in the boss kill banner. Then the arrow "powers up"
     and the boss-reward draft (3 picks, or The World once maxed) opens. Natural
     spawns stay suppressed until the player finishes choosing.
     ========================================================================== */
  M._bossDeathShockwave = function (x, y, ringColor, expCol) {
    var cm = this.comboMultiplier || 1;
    var total = C.BOSS_KILL_SCORE * cm;          // boss base reward ×combo

    var cam   = this.cameras.main;
    var zoom  = cam.zoom || 1;
    var reach = Math.sqrt(cam.width * cam.width + cam.height * cam.height) * 0.5 / zoom + 480;
    var waveSpeed = reach / 0.55;
    this._spawnWaveRing(x, y, { maxRadius: reach,        color: ringColor, expandTime: 0.55 });
    this._spawnWaveRing(x, y, { maxRadius: reach * 0.55, color: 0xffffff,  expandTime: 0.42 });

    expCol = expCol || [255, 255, 255];
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e  = this.enemies[i];
      var bp = e.tier === 3 ? 100 : e.tier === 2 ? 30 : 10;
      total += bp * cm;
      this.totalKills++;
      // Stagger the burst by distance so it reads as the wave passing through.
      var dxe = e.x - x, dye = e.y - y;
      var dd  = Math.sqrt(dxe * dxe + dye * dye);
      var delay = Math.round(dd / waveSpeed * 1000);
      (function (sc, px, py, col, ms) {
        if (ms < 30) { sc._explode(px, py, col, 12); sc._explode(px, py, [255, 255, 255], 5); }
        else { sc.time.delayedCall(ms, function () { if (!sc._upgradeLevels) return; sc._explode(px, py, col, 12); sc._explode(px, py, [255, 255, 255], 5); }); }
      })(this, e.x, e.y, expCol, delay);
      e.spr.destroy();
      for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
      if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
    }
    this.enemies.length = 0;

    // Sweep enemy bullets too (spare the player's own reflected shots, like the nuke).
    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      if (pr.isReflected) continue;
      this._explode(pr.x, pr.y, expCol, 4);
      this._destroyProjectile(pr);
      this.projectiles.splice(pi, 1);
    }

    this.score += total;
    // Big banked score, but combo is NOT incremented — and it resets now.
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this._comboPulse = 0;
    return total;
  };

  M._bossDefeatSequence = function (x, y, opts) {
    opts = opts || {};
    var total = this._bossDeathShockwave(x, y, opts.ringColor || 0xffffff, opts.expCol);

    // Banner shows the cumulative points (boss + everything the wave cleared).
    var label = (opts.label || 'BOSS DOWN') + '  +' + total;
    this._bossKillBanner(x, y - 56, label, opts.color || '#ffffff', opts.glow || opts.color);

    // Hold natural spawns until the draft resolves; advance the boss kill counter
    // so kills made DURING the fight don't shorten the gap to the next boss.
    this._bossDraftPending = true;
    this._advanceBossThreshold();
    // Curse-Fountain pacing: this boss counts toward the next fountain's gate.
    if (this._noteBossDefeat) this._noteBossDefeat();

    var self = this;
    // Beat 1 (~0.56s): the arrow surges with power once the wave has swept through.
    this.time.delayedCall(560, function () {
      if (!self._upgradeLevels || !self.p || self._tutorialActive) return;
      self._playerPowerUpFx();
    });
    // Beat 2 (~1.32s): the reward draft (3 picks, or The World once everything is maxed).
    this.time.delayedCall(1320, function () {
      if (!self._upgradeLevels) return;
      // A tutorial relaunch (? button) within this window soft-resets the draft
      // state but can't cancel this timer — bail so we don't pop a draft over the
      // lesson (and drop the spawn-suppression flag the tutorial defuse also clears).
      if (self._tutorialActive) { self._bossDraftPending = false; return; }
      if (self._upgradeDraftOpen || self._upSlowMoPhase) return;
      self._rerollsAvailable = (self._rerollsAvailable || 0) + 1;  // boss reward: +1 reroll
      self._beginBossUpgradeDraft();
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
    // PARADE: one popup per dash attack. All reflected-projectile smash events
    // tagged with the same dashAtkId accumulate into the same bucket; ×N is
    // the number of reflected projectiles that connected. The bucket is flushed
    // the moment the last tagged projectile is destroyed (see _destroyProjectile
    // → _paradeFlushIfDone), with a generous safety timeout as a backstop.
    // The recursive render call below carries { count } and bypasses this branch.
    if (label === 'PARADE' && !(_extra && _extra.count)) {
      var atkId = (_extra && _extra.dashAtkId) || 0;
      if (!this._paradeBufs) this._paradeBufs = {};
      var buf = this._paradeBufs[atkId];
      if (!buf) {
        buf = { n: 0, pts: 0, atkId: atkId, timeoutEvt: null };
        this._paradeBufs[atkId] = buf;
      }
      buf.n++;
      buf.pts += pts;
      if (buf.timeoutEvt) buf.timeoutEvt.remove(false);
      var selfP = this;
      buf.timeoutEvt = this.time.delayedCall(2000, function () {
        var b = selfP._paradeBufs && selfP._paradeBufs[atkId];
        if (!b) return;
        delete selfP._paradeBufs[atkId];
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
            : label === 'DRONE' ? '#66e0ff'
            : label === 'THE WORLD' ? '#ffc832'
            : '#ffcc00';
    var displayLbl = label === 'DELAY_EXP' ? 'Delayed Explosion'
                   : label === 'DRONE' ? 'Drone'
                   : (label === 'PARADE' && count > 1) ? 'PARADE \u00d7' + count
                   : label;

    // Stack upward from anchor, capped so popups can't cross into the top HUD.
    // - fitSlots = how many popups actually fit at a readable gap (≥ SLOT_GAP_MIN)
    //   between syBase and topBound. Limited to ABSOLUTE_MAX.
    // - slotGap is then chosen to spread fitSlots evenly across the available
    //   room (never tighter than SLOT_GAP_MIN, never larger than SLOT_GAP_MAX),
    //   so the top slot lands exactly at topBound and the bottom at syBase.
    // - If more popups arrive than fitSlots, the OLDEST visible one is evicted
    //   (quick fade) and its slot reused — newer popups stay legible instead of
    //   all clamping on top of each other at the ceiling.
    var topBound = cam.height * 0.22;
    var ABSOLUTE_MAX = 7;
    var SLOT_GAP_MAX = 48;
    var SLOT_GAP_MIN = 30;          // text height ~26 px + small breathing room
    var available = Math.max(0, syBase - topBound);
    var fitSlots = Math.max(1, Math.min(ABSOLUTE_MAX, Math.floor(available / SLOT_GAP_MIN) + 1));
    var slotGap = fitSlots > 1
      ? Math.min(SLOT_GAP_MAX, Math.max(SLOT_GAP_MIN, available / (fitSlots - 1)))
      : 0;

    if (!this._bigScoreSlots) this._bigScoreSlots = [];
    var slot = 0;
    while (slot < fitSlots && this._bigScoreSlots[slot]) slot++;
    if (slot >= fitSlots) {
      // No free slot fits — evict the oldest popup and reuse its index.
      var oldestSlot = 0;
      var oldestT = Infinity;
      for (var s = 0; s < fitSlots; s++) {
        var pp = this._bigScoreSlots[s];
        if (pp && pp.__birthT < oldestT) { oldestT = pp.__birthT; oldestSlot = s; }
      }
      var evicted = this._bigScoreSlots[oldestSlot];
      if (evicted) {
        this.tweens.killTweensOf(evicted);
        this.tweens.add({
          targets: evicted, alpha: 0, duration: 120, ease: 'Cubic.easeIn',
          onComplete: function () { evicted.destroy(); },
        });
      }
      this._bigScoreSlots[oldestSlot] = null;
      slot = oldestSlot;
    }
    var sy = syBase - slot * slotGap;
    var self = this;

    var txt = this.add.text(sx, sy, '+' + pts + ' ' + displayLbl + '!', {
      fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: col,
    });
    txt.setOrigin(0.5); txt.setDepth(105);
    txt.setScrollFactor(0);
    txt.setBlendMode(Phaser.BlendModes.ADD);
    txt.setAlpha(0.82);
    txt.setScale(0.35);
    txt.__birthT = this.gameTime;  // age tracker for the eviction policy above
    this._bigScoreSlots[slot] = txt;

    // Hold duration scales with score (log10): 400ms at low score, up to 1200ms near 100 000 pts
    var holdDur = 400 + Math.min(Math.log10(Math.max(pts, 1)) * 160, 800);
    var popDur  = 180;  // pop-in

    // 1. Pop in — stay big (no yoyo)
    this.tweens.add({
      targets: txt, scaleX: 1.15, scaleY: 1.15,
      duration: popDur, ease: 'Back.easeOut',
    });
    // 2. Shrink + float + fade — starts after pop + hold. Clamp the float-up
    //    target so popups already at the ceiling don't drift further into the HUD.
    this.tweens.add({
      targets: txt, y: Math.max(sy - 40, topBound), alpha: 0, scaleX: 0.65, scaleY: 0.65,
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
    // Track cumulative kill progress for hardcore unlock
    var LA = window.LightAgain;
    if (LA && typeof LA.laAddKillProgress === 'function') LA.laAddKillProgress(killTier);
    if (!this._batchActive) this._checkUpgradeTrigger();
    var basePts = e.tier === 3 ? 100 : e.tier === 2 ? 30 : 10;
    var pts = basePts * this.comboMultiplier;
    if (ctx.reflected) pts *= 2;
    if (this._scoreMult && this._scoreMult !== 1) pts = Math.round(pts * this._scoreMult);  // glassHeart curse
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
        this._floatLabel(this.p.x, this.p.y - 30, shLabel, '#00ffff');
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

  /* ==========================================================================
     Clear Board (sandbox) — a shockwave from the player sweeps outward and
     destroys every enemy it passes. No score, no combo, no kill count.
     ========================================================================== */
  M._clearBoard = function () {
    if (this._clearWave && this._clearWave.active) return;
    if (this._tutEvent) this._tutEvent('clear');  // tutorial: Clear Board detected
    var cam = this.cameras.main;
    var zoom = cam.zoom || 1;
    // world-space half-diagonal of the viewport + margin → reaches every on-screen enemy
    var reach = Math.sqrt(cam.width * cam.width + cam.height * cam.height) * 0.5 / zoom + 480;
    this._clearWave = { active: true, t: 0, dur: 0.55, r: 0, maxR: reach };
    this._spawnWaveRing(this.p.x, this.p.y, { maxRadius: reach,       color: 0x66ddff, expandTime: 0.55 });
    this._spawnWaveRing(this.p.x, this.p.y, { maxRadius: reach * 0.6, color: 0xffffff, expandTime: 0.40 });
    cam.flash(200, 120, 220, 255);
    cam.shake(240, 0.010);
    this._triggerHitstop(60);
  };

  M._destroyEnemyNoScore = function (idx, silent) {
    var e = this.enemies[idx];
    if (!e) return;
    if (!silent) this._explode(e.x, e.y, [120, 220, 255], 14);
    e.spr.destroy();
    for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
    if (e.shieldGfx) { e.shieldGfx.destroy(); e.shieldGfx = null; }
    this.enemies.splice(idx, 1);
  };

  // Advance the clear-board shockwave; called every frame from update().
  M._updateClearWave = function (dt) {
    var cw = this._clearWave;
    if (!cw || !cw.active) return;
    cw.t += dt;
    cw.r = cw.maxR * Math.min(1, cw.t / cw.dur);
    var r2 = cw.r * cw.r, px = this.p.x, py = this.p.y, i;
    for (i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      var dx = e.x - px, dy = e.y - py;
      if (dx * dx + dy * dy <= r2) this._destroyEnemyNoScore(i, false);
    }
    if (cw.t >= cw.dur) {
      // sweep any stragglers past the visual reach (off-screen) silently → board cleared
      for (i = this.enemies.length - 1; i >= 0; i--) this._destroyEnemyNoScore(i, true);
      cw.active = false;
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

  /* Apply the detonation MARK to an enemy (cyan instability + grayed texture).
     Shared by the dash mark (collisions.js), tornado mark-propagation (Detonation
     Lv3, enemies.js) and the Lv3 kamikaze-drone blast (drone.js). The mark's
     lifetime follows the Detonation branch level (Lv1+ doubles it). Does NOT
     bump dashHitCount — that stays exclusive to the dash itself. */
  M._applyMarkToEnemy = function (e) {
    if (!e || e.isMarked) return;
    var detoLvl = (this._upgradeLevels && this._upgradeLevels.detonation) || 0;
    e.isMarked = true;
    e.markMaxTimer = detoLvl >= 1 ? 6000 : 3000;
    e.markTimer = e.markMaxTimer;
    e.stunTimer = Math.max(e.stunTimer || 0, 200);
    this._explode(e.x, e.y, [0, 255, 255], 8);
    if (!e._twGrayed && !e._markGrayed && e.texKey && e.spr) {
      var gk = e.texKey + '_gray';
      e.spr.setTexture(gk);
      for (var ti = 0; ti < e.trSpr.length; ti++) e.trSpr[ti].setTexture(gk);
      e._markGrayed = true;
    }
  };

  M._triggerDetonation = function (markedIdx) {
    var p = this.p;
    var e = this.enemies[markedIdx];
    var ex = e.x, ey = e.y;
    if (this._tutEvent) this._tutEvent('nuke');  // tutorial: mark+nuke detected
    var detoLvl  = (this._upgradeLevels && this._upgradeLevels.detonation) || 0;
    // Golden palette when fired at TW resolution
    var twDeto = !!this._twBatchWindow;
    var radMult  = detoLvl >= 2 ? 1.8 : 1.0;
    var detRadius   = C.SHOCKWAVE_RADIUS * 2.5 * radMult * (this._blastMult || 1);  // cursedBlast curse
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

    // The nuke also chips any serpent segments in range — throttled so the
    // frequent storm of nukes only nibbles the worm instead of vaporising it.
    if (this._snake && !this._snake.dead) this._damageSnakeAoe(ex, ey, detRadius, C.SNAKE_AOE_DMG);

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

  // baseAtk branch ("Explosion à retardement"): on a basic-attack kill, roll the
  // level-scaled chance and, on success, plant a delayed explosion that scales
  // with the branch level (Lv3 = bigger + shorter fuse).
  M._trySpawnDelayedExplosion = function (x, y) {
    var lvl = (this._upgradeLevels && this._upgradeLevels.baseAtk) || 0;
    if (lvl === 0) return;
    var chance = lvl >= 2 ? C.DELAY_EXP_CHANCE_L2 : C.DELAY_EXP_CHANCE_L1;
    if (Math.random() >= chance) return;
    this._spawnDelayedExplosion(x, y, lvl);
  };

  // Dash-Attack Lv3: each impact (enemy hit OR parried projectile) has a 1-in-3
  // chance to plant a delayed explosion — capped at ONE per dash-attack so a long
  // chain doesn't flood the screen. p._dashAtkExpSpawned resets in _triggerDashAtk.
  M._maybeDashAtkDelayedExp = function (x, y) {
    if (((this._upgradeLevels && this._upgradeLevels.dashAtk) || 0) < 3) return;
    var p = this.p;
    if (!p || p._dashAtkExpSpawned) return;
    if (Math.random() >= C.DASHATK_DELAY_EXP_CHANCE) return;
    p._dashAtkExpSpawned = true;
    var lvl = Math.max(1, (this._upgradeLevels && this._upgradeLevels.baseAtk) || 0);
    this._spawnDelayedExplosion(x, y, lvl);
  };

  // Plant a delayed explosion at (x,y) with an explicit power level (1/2/3).
  // Also used by Dash-Attack Lv3 (1/3 on impact) and Shield Lv3 (on shield loss),
  // which pass Math.max(1, baseAtk level) so the baseAtk branch buffs them too.
  M._spawnDelayedExplosion = function (x, y, lvl) {
    lvl = lvl || 1;
    var self    = this;
    var DELAY   = lvl >= 3 ? C.DELAY_EXP_DELAY_L3 : C.DELAY_EXP_DELAY;     // ms until explosion
    var startR  = C.SHOCKWAVE_RADIUS * (lvl >= 3 ? 1.25 : (lvl >= 2 ? 0.99 : 0.61));  // warning ring, ∝ level
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
    // Lv3 = bigger still (×2.3). The cursedBlast curse scales every blast further.
    var radMult  = lvl >= 3 ? C.DELAY_EXP_RADIUS_L3 : (lvl >= 2 ? C.DELAY_EXP_RADIUS_L2 : C.DELAY_EXP_RADIUS_L1);
    var radius   = C.SHOCKWAVE_RADIUS * radMult * (this._blastMult || 1);
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

    // Delayed explosions chip serpent segments too — same throttled AoE.
    if (this._snake && !this._snake.dead) this._damageSnakeAoe(x, y, radius, C.SNAKE_AOE_DMG);

    // Visuals — ring matches the warning circle's red color
    this._explode(x, y, [255, 34, 34], 45);
    this._explode(x, y, [255, 255, 255], 20);
    this._spawnWaveRing(x, y, { maxRadius: radius, color: 0xff2222, expandTime: 0.28 });
    this.cameras.main.flash(160, 255, 34, 34, false);
    this.cameras.main.shake(140, 0.010);
    this._triggerHitstop(Math.round(C.DETONATION_HITSTOP * 0.7));
  };

})();
