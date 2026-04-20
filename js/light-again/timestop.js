/* ==========================================================================
   Light Again — The World: Time Stop (secret upgrade)
   Middle-click freezes the world for 4s. Enemies hit during freeze are
   condemned; at resolution they all die simultaneously.
   Detonations (nuke) and reflected projectiles are also frozen and released
   at resolution. Score is tallied AFTER time resumes via a dynamic batch
   window that waits for all pending TW actions to complete.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* ================================================================
     INIT — called from scene.create()
     ================================================================ */
  M._initTimeStop = function () {
    this._twUnlocked       = false;
    this._twActive         = false;
    this._twTimer          = 0;
    this._twCooldown       = 0;
    this._twSecretTracking = false;
    this._twSecretKillsBase = 0;
    this._twSecretOffered  = false;
    this._twDesatPipeline  = null;

    // Deferred detonation queue: { enemyRef, gfx, tweenRef }
    this._twDeferredDetonations = [];
    // Frozen reflected projectiles
    this._twFrozenProjectiles = [];
    // TW resolution tether reveal alpha (fades in _updateDashVacuumFX)
    this._twTetherAlpha = 0;

    // Post-resolution dynamic batch scoring window
    this._twBatchWindow    = false;
    this._twBatchGrace     = 0;      // grace ms after last pending resolves
    this._twBatchMaxTimeout = 0;     // absolute safety cap
    this._twPendingCount   = 0;      // frozen projectiles still in flight    this._twBatchElapsed   = 0;      // ms elapsed since batch opened
    this._twLastBatchDuration = 0;   // duration of last completed batch window
    // HUD icon label text
    this._twIconTxt = this.add.text(0, 0, 'TW', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#cc1111',
    });
    this._twIconTxt.setOrigin(0.5, 0.5);
    this._twIconTxt.setDepth(101);
    this._twIconTxt.setScrollFactor(0);
    this._twIconTxt.setAlpha(0);
  };

  /* ================================================================
     CHECK SECRET TRIGGER
     ================================================================ */
  M._checkSecretUpgrade = function () {
    if (this._twUnlocked || this._twSecretOffered) return false;

    if (!this._twSecretTracking) {
      var lvls = this._upgradeLevels;
      var defs = LA.UPGRADES;
      var allMaxed = true;
      for (var k in defs) {
        if (defs.hasOwnProperty(k)) {
          if ((lvls[k] || 0) < defs[k].maxLvl) { allMaxed = false; break; }
        }
      }
      if (!allMaxed) return false;
      this._twSecretTracking = true;
      this._twSecretKillsBase = this.totalKills;
    }

    var killsSince = this.totalKills - this._twSecretKillsBase;
    if (killsSince < C.TW_SECRET_KILL_DELAY) return false;

    this._twSecretOffered = true;
    return true;
  };

  /* ================================================================
     ACTIVATE — middle click
     ================================================================ */
  M._tryTimeStop = function () {
    if (!this._twUnlocked) return;
    if (this._twActive) return;
    if (this._twCooldown > 0) return;
    if (this.p.state === 'DEAD') return;

    this._twActive = true;
    this._twTimer  = C.TW_DURATION;
    this._twDeferredDetonations = [];
    this._twFrozenProjectiles = [];
    this._twPendingCount = 0;

    // --- Visual: color inversion flash then red flash ---
    var cam = this.cameras.main;
    cam.flash(80, 255, 255, 255, false);
    var self = this;
    this.time.delayedCall(80, function () {
      if (self._twActive) cam.flash(200, 180, 0, 0, false);
    });

    // --- Desaturation overlay ---
    if (cam.postFX) {
      this._twDesatPipeline = cam.postFX.addColorMatrix();
      this._twDesatPipeline.saturate(-0.55);
      this._twDesatPipeline.brightness(0.82);
    }

    this._triggerHitstop(60);
  };

  /* ================================================================
     UPDATE — every frame. Returns world time scale.
     ================================================================ */
  M._updateTimeStop = function (dt) {
    // Dynamic post-resolution batch window
    if (this._twBatchWindow) {
      var dtMs = dt * 1000;
      this._twBatchElapsed   += dtMs;
      this._twBatchMaxTimeout -= dtMs;
      if (this._twBatchMaxTimeout <= 0) {
        // Safety cap: force close
        this._twBatchWindow = false;
        this._twPendingCount = 0;
        this._twLastBatchDuration = this._twBatchElapsed;
        this._endBatch();
      } else if (this._twPendingCount <= 0) {
        // No more pending actions — run grace timer
        this._twBatchGrace -= dtMs;
        if (this._twBatchGrace <= 0) {
          this._twBatchWindow = false;
          this._twLastBatchDuration = this._twBatchElapsed;
          this._endBatch();
        }
      }
    }

    if (!this._twActive) {
      if (this._twCooldown > 0) {
        this._twCooldown -= dt * 1000;
        if (this._twCooldown < 0) this._twCooldown = 0;
      }
      return 1.0;
    }

    this._twTimer -= dt * 1000;

    // Condemned enemies: red instability particles during freeze
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e._twCondemned) {
        if (Math.random() < 0.3) {
          this._emitter2.setPosition(
            e.x + (Math.random() - 0.5) * 16,
            e.y + (Math.random() - 0.5) * 16
          );
          this._emitter2.setParticleTint(0xff2222);
          this._emitter2.explode(1);
        }
      }
    }

    if (this._twTimer <= 0) {
      this._resolveTimeStop();
      return 1.0;
    }

    return 0.02;
  };

  /* ================================================================
     RESOLVE — time resumes, all deferred effects trigger
     ================================================================ */
  M._resolveTimeStop = function () {
    this._twActive   = false;
    this._twTimer    = 0;
    this._twCooldown = C.TW_COOLDOWN;

    // Remove desaturation
    if (this._twDesatPipeline && this.cameras.main.postFX) {
      this.cameras.main.postFX.remove(this._twDesatPipeline);
      this._twDesatPipeline = null;
    }

    // --- Resolution: golden flash + unique rumble shake ---
    this.cameras.main.flash(250, 255, 200, 50, false);
    this.cameras.main.shake(400, 0.012);
    this._triggerHitstop(100);

    // --- Begin the dynamic batch scoring window ---
    this._beginBatch('THE WORLD');
    this._twBatchWindow  = true;
    this._twBatchElapsed = 0;

    // --- Release frozen reflected projectiles ---
    this._twPendingCount = 0;
    var hadFrozenReflected = false;
    for (var fp = 0; fp < this._twFrozenProjectiles.length; fp++) {
      var fpr = this._twFrozenProjectiles[fp];
      if (fpr && fpr._twFrozen) {
        fpr._twFrozen = false;
        fpr._twPending = true;
        fpr.vx = fpr._twSavedVx || 0;
        fpr.vy = fpr._twSavedVy || 0;
        fpr.life = Math.max(fpr.life, C.PROJ_LIFE * 0.5);
        fpr._twTetherActive = true;  // show tether in resolution reveal
        hadFrozenReflected = true;
        this._twPendingCount++;
      }
    }
    this._twFrozenProjectiles = [];
    // Trigger golden tether reveal if there were any reflected projectiles
    if (hadFrozenReflected) this._twTetherAlpha = 1.0;

    // Set timing: if pending projectiles exist, wait for them; otherwise short grace
    if (this._twPendingCount > 0) {
      this._twBatchGrace     = 30;   // 30ms grace after last projectile resolves
      this._twBatchMaxTimeout = 3000;  // absolute max 2.5s safety cap
    } else {
      this._twBatchGrace     = 150;   // short delay for condemned-only kills
      this._twBatchMaxTimeout = 1000;
    }

    // --- Condemned enemies: exclude detonation-pending (they die via _triggerDetonation) ---
    var condemned = [];
    for (var i = 0; i < this.enemies.length; i++) {
      var ce = this.enemies[i];
      if (ce._twCondemned && !ce._twDetonationPending) {
        condemned.push(ce);
      }
    }

    // Clear all TW flags so _killEnemy / _triggerDetonation work normally
    for (var cf = 0; cf < this.enemies.length; cf++) {
      this.enemies[cf]._twCondemned = false;
      this.enemies[cf]._twDetonationPending = false;
    }

    // Kill condemned enemies individually — each shows its own crimson ring death VFX
    for (var k = condemned.length - 1; k >= 0; k--) {
      var ke = condemned[k];
      var ki = this.enemies.indexOf(ke);
      if (ki < 0) continue;
      this._killEnemy(ki, { batch: true, condemned: true });
    }

    // --- Destroy charging circles then trigger deferred detonations ---
    // (enemy still alive here since it was excluded from the condemned kill pass)
    for (var di = 0; di < this._twDeferredDetonations.length; di++) {
      var dd = this._twDeferredDetonations[di];
      if (dd.gfx) dd.gfx.destroy();
      if (dd.tweenRef && dd.tweenRef.isPlaying) dd.tweenRef.stop();
      var ddEnemy = dd.enemyRef;
      var ddIdx = this.enemies.indexOf(ddEnemy);
      if (ddIdx >= 0) {
        this._triggerDetonation(ddIdx);
      }
    }
    this._twDeferredDetonations = [];

    this._spawnWaveRing(this.p.x, this.p.y);
  };

  /* ================================================================
     RESOLVE PENDING — called when a TW-released projectile hits or expires
     ================================================================ */
  M._twResolvePending = function () {
    if (this._twPendingCount > 0) this._twPendingCount--;
    // Reset grace timer so we wait a bit after the last pending action
    this._twBatchGrace = 250;
  };

  /* ================================================================
     DEFER KILL — marks enemy as condemned, NO score during TW
     ================================================================ */
  M._twDeferKill = function (idx) {
    if (!this._twActive) return false;
    var e = this.enemies[idx];
    if (e._twCondemned) return true;
    e._twCondemned = true;

    // Visual feedback: red flash + particles
    this._explode(e.x, e.y, [255, 30, 30], 8);

    // Restore HP so enemy stays alive until resolution
    e.hp = 1;

    return true;
  };

  /* ================================================================
     DEFER DETONATION — with synchronized charging circle animation
     Circle color: golden (TW freeze), scaling with detonation level.
     Animation synced to finish exactly at TW resolution.
     ================================================================ */
  M._twDeferDetonation = function (enemyRef) {
    var self = this;
    var detoLvl  = (this._upgradeLevels && this._upgradeLevels.detonation) || 0;
    var radMult  = detoLvl >= 2 ? 1.8 : 1.0;
    var startR   = C.SHOCKWAVE_RADIUS * 2.5 * radMult * 0.6;
    var MAIN_COL = 0xffc832;  // golden — TW freeze theme
    var SEC_COL  = 0xd4900a;
    var duration = Math.max(this._twTimer, 100);

    enemyRef._twDetonationPending = true;

    // Charging circle graphics
    var gfx = this.add.graphics();
    gfx.setDepth(55);
    var state = { r: startR };

    var tweenRef = this.tweens.add({
      targets: state,
      r: 0,
      duration: duration,
      ease: 'Cubic.easeIn',
      onUpdate: function () {
        if (!self._upgradeLevels) { gfx.clear(); return; }
        var ex = enemyRef.x, ey = enemyRef.y;
        var curR = state.r;
        if (curR <= 0) { gfx.clear(); return; }
        var prog    = 1.0 - curR / startR;
        var late    = prog * prog;
        var flicker = prog > 0.70 ? (0.78 + Math.random() * 0.22) : 1.0;

        gfx.clear();

        // Outer ring
        gfx.lineStyle(2.5, MAIN_COL, (0.30 + late * 0.60) * flicker);
        gfx.strokeCircle(ex, ey, curR);

        // Faint interior fill
        gfx.fillStyle(MAIN_COL, (0.015 + late * 0.035) * flicker);
        gfx.fillCircle(ex, ey, curR);

        // Inner secondary ring at 55% radius
        if (curR > 8) {
          gfx.lineStyle(1.5, MAIN_COL, (0.15 + late * 0.50) * flicker);
          gfx.strokeCircle(ex, ey, curR * 0.55);
        }

        // Growing center dot (last 40%)
        if (prog > 0.60) {
          var dotProg = (prog - 0.60) / 0.40;
          var dotR    = dotProg * 7 * flicker;
          gfx.fillStyle(0xffffff, late * 0.90 * flicker);
          gfx.fillCircle(ex, ey, dotR);
          gfx.fillStyle(SEC_COL, late * 0.55 * flicker);
          gfx.fillCircle(ex, ey, dotR * 1.5);
        }
      },
    });

    this._twDeferredDetonations.push({
      enemyRef: enemyRef,
      gfx: gfx,
      tweenRef: tweenRef,
    });

    this._explode(enemyRef.x, enemyRef.y, [255, 200, 50], 12);  // golden spark on defer
  };

  /* ================================================================
     FREEZE REFLECTED PROJECTILE — stays in place, released at resolve
     ================================================================ */
  M._twFreezeProjectile = function (pr) {
    pr._twFrozen = true;
    pr._twSavedVx = pr.vx;
    pr._twSavedVy = pr.vy;
    pr.vx = 0;
    pr.vy = 0;
    pr.life = 99999;
    this._twFrozenProjectiles.push(pr);
  };

})();
