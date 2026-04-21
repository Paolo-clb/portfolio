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

    // Stasis wave intro animation
    this._twWaveActive   = false;
    this._twWaveRadius   = 0;
    this._twWaveDelay    = 0;    // ms before wave starts (flash settles)
    this._twWaveMaxR     = 0;    // radius at which wave is considered off-screen
    this._twCMQueue      = [];   // enemies waiting for their CM to be created
    this._twCMSpawnQueue = [];   // enemies pending initial CM allocation (1/frame)
    this._twBgCM         = null;
    this._twGlowCM       = null;
    this._twWaveGfx      = this.add.graphics();
    this._twWaveGfx.setDepth(62);
    // Resolve convergence ring (red, shrinks toward player)
    this._twResolveGfx        = this.add.graphics();
    this._twResolveGfx.setDepth(62);
    this._twResolveWaveActive = false;
    this._twResolveWaveRadius = 0;

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

    // Activate CMs + cache distances. CMs were created at spawn (active=false).
    // Flipping active=true is a pure JS boolean — zero GPU cost.
    for (var pi = 0; pi < this.enemies.length; pi++) {
      var pe = this.enemies[pi];
      if (!pe._twCondemned && pe.spr) {
        pe._twDist = Phaser.Math.Distance.Between(
          this.p.x, this.p.y, pe.x, pe.y
        );
        if (pe._twCM) {
          pe._twCM.reset();
          pe._twCM.active = true;
        }
      }
    }
    // Background CMs: only 2 objects, negligible cost, create immediately
    if (this.pcbTile && this.pcbTile.postFX && !this._twBgCM) {
      this._twBgCM = this.pcbTile.postFX.addColorMatrix();
    }
    if (this.pcbGlow && this.pcbGlow.postFX && !this._twGlowCM) {
      this._twGlowCM = this.pcbGlow.postFX.addColorMatrix();
    }

    // --- Activate stasis wave intro ---
    var cam = this.cameras.main;
    cam.flash(180, 210, 15, 0, false);
    this._twWaveDelay  = 100;
    this._twWaveRadius = 0;
    this._twWaveActive = true;
    var diag = Math.sqrt(cam.width * cam.width + cam.height * cam.height);
    this._twWaveMaxR   = diag * 1.6;

    // Reset resolve ring from any previous TW
    this._twResolveWaveActive = false;
    this._twResolveWaveRadius = 0;
    this._twResolveGfx.clear();

    this._triggerHitstop(60);
  };

  /* ================================================================
     UPDATE — every frame. Returns world time scale.
     dt = raw delta seconds (unscaled — player-speed time).
     ================================================================ */
  M._updateTimeStop = function (dt) {
    var dtMs = dt * 1000;

    // Drain spawn queue: 1 addColorMatrix per frame, completely imperceptible.
    if (this._twCMSpawnQueue && this._twCMSpawnQueue.length > 0) {
      var sq = this._twCMSpawnQueue.shift();
      // Guard: sprite may have been destroyed before we got to it
      if (sq && sq.spr && sq.spr.active && sq.spr.postFX && !sq._twCM) {
        sq._twCM = sq.spr.postFX.addColorMatrix();
        sq._twCM.active = false;
      }
    }

    // Dynamic post-resolution batch window
    if (this._twBatchWindow) {
      this._twBatchElapsed   += dtMs;
      this._twBatchMaxTimeout -= dtMs;
      if (this._twBatchMaxTimeout <= 0) {
        this._twBatchWindow = false;
        this._twPendingCount = 0;
        this._twLastBatchDuration = this._twBatchElapsed;
        this._endBatch();
      } else if (this._twPendingCount <= 0) {
        this._twBatchGrace -= dtMs;
        if (this._twBatchGrace <= 0) {
          this._twBatchWindow = false;
          this._twLastBatchDuration = this._twBatchElapsed;
          this._endBatch();
        }
      }
    }

    // Continue resolve convergence ring after TW ends (post-resolution animation)
    if (!this._twActive && this._twResolveWaveActive) {
      // Ring finishes exactly at resolution — clean up if somehow still alive
      this._twResolveWaveActive = false;
      this._twResolveGfx.clear();
    }

    // ----------------------------------------------------------------
    //  STASIS WAVE INTRO
    //  No per-enemy distance check. All enemies gray together at waveProg.
    //  World timescale ramps 1.0 → 0.02 as wave expands (temporal braking).
    // ----------------------------------------------------------------
    if (this._twWaveActive) {
      if (this._twWaveDelay > 0) {
        this._twWaveDelay -= dtMs;
        return 1.0;  // flash plays with zero GPU work
      }

      var WAVE_SPEED = 1200;  // px/s
      // Gray trail: how many px behind the wave front an enemy transitions 0→1
      var GRAY_TRAIL = 120;
      this._twWaveRadius += WAVE_SPEED * dt;
      var waveR = this._twWaveRadius;

      // Per-enemy: create CM + set gray only once the wave has reached that enemy.
      // This spreads addColorMatrix() calls naturally across frames as wave sweeps.
      for (var wi = 0; wi < this.enemies.length; wi++) {
        var we = this.enemies[wi];
        if (we._twCondemned) continue;
        var eDist = we._twDist !== undefined ? we._twDist
                  : Phaser.Math.Distance.Between(this.p.x, this.p.y, we.x, we.y);
        if (waveR < eDist - GRAY_TRAIL) continue;
        if (!we._twCM && we.spr && we.spr.postFX) {
          // Enemy spawned after TW activation — create CM now
          we._twCM = we.spr.postFX.addColorMatrix();
          we._twCM.active = true;
        }
        if (we._twCM) {
          var eg = Math.min(1, Math.max(0, (waveR - eDist + GRAY_TRAIL) / GRAY_TRAIL));
          we._twCM.grayscale(eg);
        }
      }

      // BG tracks global waveProg
      var waveProg = Math.min(1, waveR / this._twWaveMaxR);
      if (this._twBgCM)   this._twBgCM.grayscale(waveProg);
      if (this._twGlowCM) this._twGlowCM.grayscale(waveProg);

      this._drawStasisWaveRing(this.p.x, this.p.y, waveR, waveProg);

      if (waveProg >= 1) {
        this._twWaveActive = false;
        this._twWaveGfx.clear();
        // Finalize any laggards
        for (var fi = 0; fi < this.enemies.length; fi++) {
          var fe = this.enemies[fi];
          if (fe._twCondemned) continue;
          if (fe._twCM) fe._twCM.grayscale(1.0);
        }
        if (this._twBgCM)   this._twBgCM.grayscale(1.0);
        if (this._twGlowCM) this._twGlowCM.grayscale(1.0);
      }

      // Timescale ramps faster: full freeze reached at 50% of maxR
      // (by the time wave exits visible screen, world is nearly frozen)
      var tsProgress = Math.min(1, waveR / (this._twWaveMaxR * 0.5));
      return 1.0 - 0.98 * tsProgress;
    } else if (this._twActive) {
      this._twWaveGfx.clear();
    }

    if (!this._twActive) {
      if (this._twCooldown > 0) {
        this._twCooldown -= dtMs;
        if (this._twCooldown < 0) this._twCooldown = 0;
      }
      return 1.0;
    }

    this._twTimer -= dtMs;

    // Condemned enemies: red instability particles during freeze
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e._twCondemned) {
        if (Math.random() < 0.3) {
          var cx = e.x + (Math.random() - 0.5) * 16;
          var cy = e.y + (Math.random() - 0.5) * 16;
          this._emitter2.setParticleTint(0xff2222);
          this._emitter2.explode(1, cx, cy);
        }
      }
    }

    if (this._twTimer <= 0) {
      this._resolveTimeStop();
      return 1.0;
    }

    // Start the convergence ring 1200ms before resolution.
    // Speed is calibrated so it reaches r=0 exactly when the golden flash fires.
    if (!this._twResolveWaveActive && this._twTimer <= 1200) {
      this._twResolveWaveActive = true;
      this._twResolveWaveRadius = this._twWaveMaxR || 1600;
      // px/s needed to cover full radius in exactly _twTimer ms
      this._twResolveSpeed = this._twResolveWaveRadius / (this._twTimer / 1000);
    }
    if (this._twResolveWaveActive) {
      this._twResolveWaveRadius -= this._twResolveSpeed * dt;
      if (this._twResolveWaveRadius < 0) this._twResolveWaveRadius = 0;
      this._drawResolveWaveRing(this.p.x, this.p.y, this._twResolveWaveRadius);
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

    // --- Stop any still-running wave ---
    this._twWaveActive = false;
    if (this._twWaveGfx) this._twWaveGfx.clear();

    // --- Reset per-enemy grayscale (keep CM alive, disable for next use) ---
    this._twCMQueue = [];
    for (var ci = 0; ci < this.enemies.length; ci++) {
      var ce = this.enemies[ci];
      if (ce._twCM) {
        ce._twCM.reset();
        ce._twCM.active = false;
      }
    }

    // --- Remove background ColorMatrices ---
    if (this._twBgCM) {
      if (this.pcbTile && this.pcbTile.postFX) this.pcbTile.postFX.remove(this._twBgCM);
      this._twBgCM = null;
    }
    if (this._twGlowCM) {
      if (this.pcbGlow && this.pcbGlow.postFX) this.pcbGlow.postFX.remove(this._twGlowCM);
      this._twGlowCM = null;
    }

    // Remove legacy camera desaturation (no-op if not set)
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
      } else {
        // Enemy was already killed by a previous detonation's AoE —
        // still show the wave ring + minimal flash at its stored position.
        var fbDetoLvl = (this._upgradeLevels && this._upgradeLevels.detonation) || 0;
        var fbRadMult = fbDetoLvl >= 2 ? 1.8 : 1.0;
        var fbRadius  = C.SHOCKWAVE_RADIUS * 2.5 * fbRadMult;
        var fbColor   = fbDetoLvl >= 2 ? 0xb450ff : 0xffc832;
        var fbExpT    = fbDetoLvl >= 2 ? 0.35 : 0.30;
        this._spawnWaveRing(dd.x, dd.y, { maxRadius: fbRadius, color: fbColor, expandTime: fbExpT });
        this._explode(dd.x, dd.y, [255, 200, 50], fbDetoLvl >= 2 ? 60 : 35);
        this._explode(dd.x, dd.y, [255, 255, 200], fbDetoLvl >= 2 ? 30 : 15);
      }
    }
    this._twDeferredDetonations = [];

    this._twResolveWaveActive = false;
    this._twResolveWaveRadius = 0;
    this._twResolveGfx.clear();
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
     RESOLVE WAVE RING — red, contracting from edges toward player.
     The inverse of the stasis wave: closes in on the arrow.
     px, py  — player world position
     wr      — current ring radius (shrinking from maxR toward 0)
     ================================================================ */
  M._drawResolveWaveRing = function (px, py, wr) {
    var gfx = this._twResolveGfx;
    gfx.clear();
    if (wr <= 0) { gfx.clear(); return; }

    // Fade in at start (large radius), full opacity in middle, fade as it nears 0
    var maxR = this._twWaveMaxR || 1600;
    var prog = 1.0 - wr / maxR;           // 0 = just started, 1 = arrived
    var alpha = prog < 0.15 ? prog / 0.15  // fade in over first 15%
              : prog > 0.85 ? Math.max(0, 1.0 - (prog - 0.85) / 0.15) // fade out last 15%
              : 1.0;
    if (alpha <= 0) { gfx.clear(); return; }

    // ---- Wide dark shadow halo ----
    gfx.lineStyle(70, 0x000000, 0.12 * alpha);
    gfx.strokeCircle(px, py, wr + 28);

    // ---- Deep blood-red body ----
    gfx.lineStyle(32, 0x7a0000, 0.22 * alpha);
    gfx.strokeCircle(px, py, wr + 8);

    // ---- Mid crimson ring ----
    gfx.lineStyle(14, 0xcc1111, 0.42 * alpha);
    gfx.strokeCircle(px, py, wr + 2);

    // ---- Leading edge (inner) — sharp bright red ----
    gfx.lineStyle(5, 0xff2222, 0.60 * alpha);
    gfx.strokeCircle(px, py, wr);

    // ---- White energy core ----
    gfx.lineStyle(2.5, 0xffffff, 0.40 * alpha);
    gfx.strokeCircle(px, py, wr - 3);

    // ---- Four red diamond nodes at N/E/S/W ----
    var nodeSize = Math.max(8, 20 * (1.0 - prog * 0.5));
    var NODE_N = 4;
    for (var n = 0; n < NODE_N; n++) {
      var na  = (Math.PI / 2) * n;
      var ncx = px + Math.cos(na) * wr;
      var ncy = py + Math.sin(na) * wr;
      gfx.fillStyle(0xffffff, 0.45 * alpha);
      gfx.beginPath();
      gfx.moveTo(ncx,                       ncy - nodeSize);
      gfx.lineTo(ncx + nodeSize * 0.55, ncy);
      gfx.lineTo(ncx,                       ncy + nodeSize);
      gfx.lineTo(ncx - nodeSize * 0.55, ncy);
      gfx.closePath();
      gfx.fillPath();
      gfx.fillStyle(0xff2222, 0.50 * alpha);
      gfx.beginPath();
      gfx.moveTo(ncx,                       ncy - nodeSize * 0.50);
      gfx.lineTo(ncx + nodeSize * 0.30, ncy);
      gfx.lineTo(ncx,                       ncy + nodeSize * 0.50);
      gfx.lineTo(ncx - nodeSize * 0.30, ncy);
      gfx.closePath();
      gfx.fillPath();
    }

    // ---- Arc segments between nodes ----
    for (var ai = 0; ai < NODE_N; ai++) {
      var aStart = (Math.PI / 2) * ai + 0.35;
      var aEnd   = (Math.PI / 2) * (ai + 1) - 0.35;
      gfx.lineStyle(4, 0xff6666, 0.28 * alpha);
      gfx.beginPath();
      gfx.arc(px, py, wr - 8, aStart, aEnd);
      gfx.strokePath();
    }
  };

  /* ================================================================
     STASIS WAVE RING — drawn each frame during the intro animation.
     A dramatic gold + dark expanding ring radiating from the player.
     px, py  — player world position
     wr      — current wave radius (world px)
     prog    — 0→1 progress across screen (used for fade)
     ================================================================ */
  M._drawStasisWaveRing = function (px, py, wr, prog) {
    var gfx = this._twWaveGfx;
    gfx.clear();
    if (wr <= 0) return;

    // Fade out in the last 25% of travel
    var alpha = prog < 0.75 ? 1.0 : Math.max(0, 1.0 - (prog - 0.75) / 0.25);
    if (alpha <= 0) return;

    // ---- 1. Wide outer dark shockwave shadow — sells the "mass" of the wave ----
    gfx.lineStyle(90, 0x000000, 0.20 * alpha);
    gfx.strokeCircle(px, py, wr - 32);

    // ---- 2. Deep amber halo body — wide, low alpha warm glow ----
    gfx.lineStyle(38, 0xb86800, 0.38 * alpha);
    gfx.strokeCircle(px, py, wr - 10);

    // ---- 3. Bright gold mid ring ----
    gfx.lineStyle(16, 0xffa500, 0.70 * alpha);
    gfx.strokeCircle(px, py, wr - 2);

    // ---- 4. Leading edge — sharp bright gold line ----
    gfx.lineStyle(5, 0xffc832, 0.98 * alpha);
    gfx.strokeCircle(px, py, wr);

    // ---- 5. White energy core at the very tip ----
    gfx.lineStyle(2.5, 0xffffff, 0.75 * alpha);
    gfx.strokeCircle(px, py, wr + 3);

    // ---- 6. Four large diamond energy nodes at N / E / S / W ----
    var nodeSize = Math.max(10, 22 - prog * 10);
    var NODE_N = 4;
    for (var n = 0; n < NODE_N; n++) {
      var na  = (Math.PI / 2) * n;
      var ncx = px + Math.cos(na) * wr;
      var ncy = py + Math.sin(na) * wr;
      // White outer diamond
      gfx.fillStyle(0xffffff, 0.90 * alpha);
      gfx.beginPath();
      gfx.moveTo(ncx,                 ncy - nodeSize);
      gfx.lineTo(ncx + nodeSize * 0.55, ncy);
      gfx.lineTo(ncx,                 ncy + nodeSize);
      gfx.lineTo(ncx - nodeSize * 0.55, ncy);
      gfx.closePath();
      gfx.fillPath();
      // Gold inner diamond
      gfx.fillStyle(0xffc832, 0.85 * alpha);
      gfx.beginPath();
      gfx.moveTo(ncx,                      ncy - nodeSize * 0.50);
      gfx.lineTo(ncx + nodeSize * 0.30, ncy);
      gfx.lineTo(ncx,                      ncy + nodeSize * 0.50);
      gfx.lineTo(ncx - nodeSize * 0.30, ncy);
      gfx.closePath();
      gfx.fillPath();
    }

    // ---- 7. Four long arc segments between the nodes (segmented gear feel) ----
    for (var ai = 0; ai < NODE_N; ai++) {
      var aStart = (Math.PI / 2) * ai + 0.35;   // gap around each node
      var aEnd   = (Math.PI / 2) * (ai + 1) - 0.35;
      gfx.lineStyle(4, 0xffe06e, 0.55 * alpha);
      gfx.beginPath();
      gfx.arc(px, py, wr + 8, aStart, aEnd);
      gfx.strokePath();
    }
  };

  /* ================================================================
     DEFER KILL — marks enemy as condemned, NO score during TW
     ================================================================ */
  M._twDeferKill = function (idx) {
    if (!this._twActive) return false;
    var e = this.enemies[idx];
    if (e._twCondemned) return true;
    e._twCondemned = true;

    // Disable CM so condemned crimson tint is vivid
    if (e._twCM) { e._twCM.reset(); e._twCM.active = false; }

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
      x: enemyRef.x,   // snapshot position at mark time (enemies are frozen)
      y: enemyRef.y,
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
