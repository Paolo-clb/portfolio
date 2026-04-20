/* ==========================================================================
   Light Again — GameScene Class Assembly + Factory
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;

  /* ---- Build scene definition by merging all method mixins ---- */
  var sceneDef = {
    Extends: Phaser.Scene,

    initialize: function GameScene() {
      Phaser.Scene.call(this, { key: 'GameScene' });
    },

    create: function () {
      var self = this;
      this._texTheme = '';
      this._genTextures();
      var restartPending = typeof window !== 'undefined' && window.__laRestartPending;
      if (restartPending) window.__laRestartPending = false;
      this._warmupTargetFrames = restartPending ? C.LOADER_RESTART_WARMUP_FRAMES : C.LOADER_WARMUP_FRAMES;
      this._loaderOverlayId = restartPending ? '_la-restart-loading' : '_la-loading';
      this._loaderRemoved = false;
      this._warmupFrames  = 0;

      // LootLocker guest session (fire-and-forget, non-blocking)
      if (!LA.llGetToken()) LA.llInit(null);

      var cam = this.cameras.main;
      this.pcbTile = this.add.tileSprite(0, 0, cam.width, cam.height, '_pcb');
      this.pcbTile.setOrigin(0, 0);
      this.pcbTile.setScrollFactor(0);
      this.pcbTile.setDepth(-10);

      // --- Glow overlay (bioluminescence) ---
      this.pcbGlow = this.add.tileSprite(0, 0, cam.width, cam.height, '_pcbGlow');
      this.pcbGlow.setOrigin(0, 0);
      this.pcbGlow.setScrollFactor(0);
      this.pcbGlow.setDepth(-9);
      this.pcbGlow.setBlendMode(Phaser.BlendModes.ADD);
      this.pcbGlow.setAlpha(0);

      // --- Vignette (canvas radial gradient texture) ---
      this._vignetteSprite = null; // reset stale reference from previous scene lifecycle
      this._drawVignette();

      // Redraw vignette when Scale manager finalises dimensions (fixes first-launch offset)
      this.scale.on('resize', function () { self._drawVignette(); });

      this.p = {
        x: 0, y: 0, vx: 0, vy: 0,
        angle: 0, spinAngle: 0,
        state: 'MOVING',
        dashAvailable: true, dashCooldown: 0, dashTimer: 0,
        dashDx: 0, dashDy: 0, dashHitCount: 0,
        atkAvailable: true, atkCooldown: 0, atkTimer: 0,
        atkDx: 0, atkDy: 0,
        recoveryTimer: 0, recoveryWhiff: false,
        hasHitDuringDashAttack: false, dashAtkExtended: 0,
        hp: 1, invincible: false, invincTimer: 0, dashInvinc: false, dashCoyote: false,
      };

      // Shield orbs — start with 1 slot max (upgrades raise this to 2 or 3)
      this.playerShields = 1;
      this.MAX_SHIELDS   = 1;
      this._shieldFloatStack = 0;
      this._shieldAngle  = 0;
      this._shieldOrbs   = [];
      var SHIELD_ORBS_N  = 3;  // pool always 3; only MAX_SHIELDS used at runtime
      for (var oi = 0; oi < SHIELD_ORBS_N; oi++) {
        var og = this.add.graphics();
        og.setDepth(35);
        og.setBlendMode(Phaser.BlendModes.ADD);
        og.setVisible(false);
        this._shieldOrbs.push(og);
      }

      // Energy link wires (orb → player): drawn each frame, depth 28 (under player)
      this._shieldLinkGfx = this.add.graphics();
      this._shieldLinkGfx.setDepth(28);
      this._shieldLinkGfx.setBlendMode(Phaser.BlendModes.ADD);

      // Hex sacrifice flash (appears on shield absorb): depth 36 (above orbs)
      this._shieldHitGfx = this.add.graphics();
      this._shieldHitGfx.setDepth(36);
      this._shieldHitGfx.setBlendMode(Phaser.BlendModes.ADD);
      this._shieldHitGfx.setVisible(false);

      this.playerSpr = this.add.image(0, 0, '_ar_cyan');
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
      this.playerSpr.setDepth(30);

      this.TRAIL_CAP = 6;
      this.TRAIL_DIST_SQ = 9;
      this._trail = [];
      for (var ti = 0; ti < this.TRAIL_CAP; ti++) {
        var tSpr = this.add.image(0, 0, '_ar_cyan');
        tSpr.setBlendMode(Phaser.BlendModes.ADD);
        tSpr.setDepth(25);
        tSpr.setVisible(false);
        this._trail.push({ spr: tSpr, x: 0, y: 0, angle: 0, ok: false });
      }
      this._trW = 0; this._trN = 0; this._trLX = 0; this._trLY = 0;

      this.MAX_GHOSTS = 48;
      this._ghosts = [];
      for (var gi = 0; gi < this.MAX_GHOSTS; gi++) {
        var gSpr = this.add.image(0, 0, '_ar_cyan');
        gSpr.setDepth(10);
        gSpr.setVisible(false);
        this._ghosts.push({ spr: gSpr, active: false, alpha: 0 });
      }
      this._ghostW = 0;

      this.enemies = [];
      this.ENEMY_TRAIL_N = 4;
      this.spawnTimer = 0;
      this.nextSpawnDelay = 3500;

      LA.buildPixelTex(this.textures, '_pxl');

      this._emitter = this.add.particles(0, 0, '_pxl', {
        speed: { min: 60, max: 520 },
        lifespan: { min: 250, max: 800 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1.0, end: 0 },
        gravityY: 0,
        drag: 320,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._emitter.setDepth(40);

      this._emitter2 = this.add.particles(0, 0, '_pxl', {
        speed: { min: 20, max: 180 },
        lifespan: { min: 400, max: 1000 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.7, end: 0 },
        drag: 180,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._emitter2.setDepth(39);


      var PROJ_TRAIL_PER = 12;
      this._PROJ_TRAIL_PER = PROJ_TRAIL_PER;
      this._projTrailPool = [];
      for (var pti = 0; pti < C.MAX_PROJECTILES * PROJ_TRAIL_PER; pti++) {
        var pts = this.add.image(0, 0, '_proj');
        pts.setBlendMode(Phaser.BlendModes.ADD);
        pts.setDepth(21);
        pts.setVisible(false);
        this._projTrailPool.push({ spr: pts, x: 0, y: 0, alpha: 0, active: false });
      }
      this._projTrailPoolW = 0;

      this.projectiles = [];

      this._waveRings = [];
      for (var wi = 0; wi < 4; wi++) {
        var wg = this.add.graphics();
        wg.setDepth(35);
        wg.setVisible(false);
        this._waveRings.push({ gfx: wg, x: 0, y: 0, r: 0, alpha: 0, active: false });
      }
      this._waveRingW = 0;

      // Pool for condemned-death ring bursts (up to 16 simultaneous)
      this._twDeathRings = [];
      for (var tdi = 0; tdi < 16; tdi++) {
        var tdg = this.add.graphics();
        tdg.setDepth(34);
        tdg.setVisible(false);
        this._twDeathRings.push({ gfx: tdg, x: 0, y: 0, r: 0, alpha: 0, active: false });
      }
      this._twDeathRingW = 0;

      this._hiveBeams = [];
      for (var hbi = 0; hbi < 12; hbi++) {
        var hbg = this.add.graphics();
        hbg.setDepth(24);
        hbg.setVisible(false);
        this._hiveBeams.push({ gfx: hbg, x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, active: false });
      }
      this._hiveBeamW = 0;

      // World-space border
      var WH = C.WORLD_HALF;
      var bGfx = this.add.graphics();
      bGfx.setDepth(-5);
      bGfx.lineStyle(28, 0x00ffff, 0.06);
      bGfx.strokeRect(-WH, -WH, WH * 2, WH * 2);
      bGfx.lineStyle(16, 0x00ffff, 0.12);
      bGfx.strokeRect(-WH, -WH, WH * 2, WH * 2);
      bGfx.lineStyle(3, 0x00ffff, 0.70);
      bGfx.strokeRect(-WH, -WH, WH * 2, WH * 2);
      var cS = 18;
      var corners = [[-WH, -WH], [WH - cS, -WH], [-WH, WH - cS], [WH - cS, WH - cS]];
      bGfx.lineStyle(2, 0x00ffff, 0.90);
      for (var ci = 0; ci < corners.length; ci++) {
        bGfx.strokeRect(corners[ci][0], corners[ci][1], cS, cS);
      }

      this.hudGfx = this.add.graphics();
      this.hudGfx.setScrollFactor(0);
      this.hudGfx.setDepth(100);

      this.fpsTxt = this.add.text(10, 10, '', {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#00ff88',
      });
      this.fpsTxt.setScrollFactor(0);
      this.fpsTxt.setDepth(101);

      this.hitstopTimer = 0;
      this.timeScale = 1.0;
      this.gameTime = 0;

      this.score = 0;
      this.totalKills = 0;
      this.bestCombo = 1;
      this.comboMultiplier = 1;
      this.comboTimer = 0;
      this._comboPulse = 0;
      this._batchScore = 0;
      this._batchLabel = '';
      this._batchActive = false;

      this._scoreTxt = this.add.text(cam.width / 2, 16, '0', {
        fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#00ffff',
        stroke: '#003344', strokeThickness: 3,
      });
      this._scoreTxt.setScrollFactor(0);
      this._scoreTxt.setOrigin(0.5, 0);
      this._scoreTxt.setDepth(102);
      this._scoreTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._scoreTxt.setAlpha(0.95);

      this._comboTxt = this.add.text(cam.width / 2, 48, '', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffcc00',
        stroke: '#332200', strokeThickness: 2,
      });
      this._comboTxt.setScrollFactor(0);
      this._comboTxt.setOrigin(0.5, 0);
      this._comboTxt.setDepth(102);
      this._comboTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._comboTxt.setAlpha(0);

      // Combo FX: x10+ trail emitter
      this._comboTrailEmitter = this.add.particles(0, 0, '_pxl', {
        speed: { min: 20, max: 80 },
        lifespan: { min: 200, max: 500 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.9, end: 0 },
        drag: 60,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._comboTrailEmitter.setDepth(28);
      this._comboTrailEmitter.setParticleTint(0x00ffff);
      this._comboTrailActive = false;

      // Combo FX: x50+ aura
      this._comboAuraGfx = this.add.graphics();
      this._comboAuraGfx.setDepth(29);
      this._comboAuraGfx.setVisible(false);
      this._comboAuraRot = 0;
      this._comboAuraActive = false;

      // Dash-attack Lv2 vacuum field visual
      this._dashVacuumGfx = this.add.graphics();
      this._dashVacuumGfx.setDepth(28);
      this._dashVacuumGfx.setBlendMode(Phaser.BlendModes.ADD);
      this._dashTornados = [];  // dash Lv2 tornado pool
      this._dashTornadoCounter = 0;  // every 3rd dash triggers tornado

      // Combo FX: x50+ sparks
      this._comboSparkEmitter = this.add.particles(0, 0, '_pxl', {
        speed: { min: 100, max: 320 },
        lifespan: { min: 100, max: 300 },
        scale: { start: 0.65, end: 0 },
        alpha: { start: 1.0, end: 0 },
        drag: 180,
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      this._comboSparkEmitter.setDepth(31);
      this._comboSparkEmitter.setParticleTint(0x00ffff);
      this._comboSparkActive = false;

      this._chromaFX = null;

      // Star Power collectible state
      this._starPickups = [];
      this.isStarPowered = false;
      this._starPowerTimer = 0;
      this._starPowerWarning = false;
      this._starWarnCall = null;
      this._starEndCall = null;

      this._starAuraGfx = this.add.graphics();
      this._starAuraGfx.setDepth(27);
      this._starAuraGfx.setBlendMode(Phaser.BlendModes.ADD);
      this._starAuraGfx.setVisible(false);

      // Upgrade system (roguelite draft)
      this._initUpgrades();
      this._initTimeStop();

      cam.setBackgroundColor(LA.getColors().bgColor);

      if (cam.postFX) {
        this._bloomFX = cam.postFX.addBloom(0xffffff, 1, 1, 0.6, 1.4, 4);
      }

      this._keys = {};
      this.input.keyboard.on('keydown', function (ev) {
        self._keys[ev.code] = true;
        if ((ev.code === 'Space' || ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') && !ev.repeat) {
          ev.preventDefault();
          self._tryDash();
        }
        if (ev.code === 'KeyI' && !ev.repeat) {
          ev.preventDefault();
          self._debugSpawnTestTier(1, 20);
        }
        if (ev.code === 'KeyO' && !ev.repeat) {
          ev.preventDefault();
          self._debugSpawnTestTier(2, 10);
        }
        if (ev.code === 'KeyP' && !ev.repeat) {
          ev.preventDefault();
          self._debugSpawnTestTier(3, 5);
        }
        if (ev.code === 'KeyL' && !ev.repeat) {
          ev.preventDefault();
          var ox = self.p.x + (Math.random() - 0.5) * 200;
          var oy = self.p.y + (Math.random() - 0.5) * 200;
          self._spawnStar(ox, oy);
        }
        if (ev.code === 'KeyK' && !ev.repeat) {
          ev.preventDefault();
          self._beginUpgradeSlowMo();
        }

      });
      this.input.keyboard.on('keyup', function (ev) {
        self._keys[ev.code] = false;
      });

      this._mouseX = cam.width / 2;
      this._mouseY = cam.height / 2;
      this.input.on('pointermove', function (ptr) {
        self._mouseX = ptr.x; self._mouseY = ptr.y;
      });
      this.input.on('pointerdown', function (ptr) {
        if (ptr.leftButtonDown())   self._tryAttack();
        if (ptr.rightButtonDown())  self._tryDash();
        if (ptr.middleButtonDown()) self._tryTimeStop();
      });

      this.game.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      window.__lightGameAtkReady = function () {
        var p = self.p;
        if (!p) return false;
        if (p.state === 'DEAD') return false;
        if (p.invincible && !p.dashInvinc) return false;
        if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') return false;
        if (p.state === 'RECOVERY') return false;
        return true;
      };
      // Clear stuck keys on scene resume (upgrade draft / manual pause)
      this.events.on('resume', function () {
        self._keys = {};
      });

      // Clear stuck keys when window regains focus
      window.addEventListener('focus', this._onWindowFocus = function () {
        self._keys = {};
      });

      // Debug keys (work even while scene is paused via window listener)
      window.addEventListener('keydown', this._onDebugKey = function (ev) {
        // M: max out all 5 normal upgrades to level 2 (NOT The World)
        if (ev.code === 'KeyM' && !ev.repeat) {
          var defs = LA.UPGRADES;
          for (var k in defs) {
            if (defs.hasOwnProperty(k)) {
              self._upgradeLevels[k] = defs[k].maxLvl;
            }
          }
          self._upgradePool = [];
          // Shield upgrade side-effect: raise MAX_SHIELDS
          var shLvl = self._upgradeLevels.shield || 0;
          if (shLvl > 0) self.MAX_SHIELDS = 1 + shLvl;
        }
        // N: unlock The World only + reset cooldown
        if (ev.code === 'KeyN' && !ev.repeat) {
          self._twUnlocked = true;
          self._twCooldown = 0;
          self._twSecretOffered = true;
        }
      });

      this.events.once('shutdown', function () {
        window.__lightGameAtkReady = null;
        self._vignetteSprite = null;
        self._chromaFX = null;
        self._bloomFX = null;
        self._shieldLabelTxt = null;
        self._twDesatPipeline = null;
        if (self._twIconTxt) { self._twIconTxt.destroy(); self._twIconTxt = null; }
        if (self._onWindowFocus) {
          window.removeEventListener('focus', self._onWindowFocus);
          self._onWindowFocus = null;
        }
        if (self._onDebugKey) {
          window.removeEventListener('keydown', self._onDebugKey);
          self._onDebugKey = null;
        }
      });
    },

    update: function (_time, delta) {
      var dt = Math.min(delta / 1000, 0.05);
      this._shieldFloatStack = 0;

      // Loader warmup
      if (!this._loaderRemoved) {
        this._warmupFrames = (this._warmupFrames || 0) + 1;
        var wTarget = this._warmupTargetFrames != null ? this._warmupTargetFrames : C.LOADER_WARMUP_FRAMES;
        if (this._warmupFrames >= wTarget) {
          this._loaderRemoved = true;
          var lid = this._loaderOverlayId || '_la-loading';
          var loEl = document.getElementById(lid);
          if (loEl) {
            var isRestart = lid === '_la-restart-loading';
            var fadeSec = isRestart ? '0.38s' : '0.55s';
            var removeMs = isRestart ? 450 : 600;
            loEl.style.transition = 'opacity ' + fadeSec + ' ease';
            loEl.style.opacity = '0';
            setTimeout(function () { if (loEl.parentNode) loEl.parentNode.removeChild(loEl); }, removeMs);
          }
        }
      }

      this._checkTheme();

      // Upgrade slow-mo transition (runs on real dt, not scaled)
      this._updateUpgradeSlowMo(dt);

      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= delta;
        if (this.hitstopTimer <= 0) { this.hitstopTimer = 0; this.timeScale = 1.0; }
        else this.timeScale = 0;
      }

      // Apply upgrade slow-mo on top of hitstop timeScale
      var upgradeTS = this._getUpgradeTimeScale();

      // The World: separate player vs world time scales
      var twScale = this._updateTimeStop(dt);
      var sDt  = dt * this.timeScale * upgradeTS * twScale;
      var s60  = sDt * 60;
      var ms   = sDt * 1000;

      // Player timing: full speed during time stop
      var pScale = this._twActive ? 1.0 : (this.timeScale * upgradeTS);
      var pDt  = dt * pScale;
      var pS60 = pDt * 60;
      var pMs  = pDt * 1000;

      this._fpsCounter = (this._fpsCounter || 0) + 1;
      if (this._fpsCounter >= 15) {
        this._fpsCounter = 0;
        var fps = Math.round(this.game.loop.actualFps);
        if (fps !== this._lastFps) {
          this._lastFps = fps;
          this.fpsTxt.setText(fps + ' FPS');
          this.fpsTxt.setColor(fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444');
        }
      }

      if (ms < 0.001 && pMs < 0.001) {
        this._decayGhosts(dt);
        this._renderPlayer();
        return;
      }

      var p = this.p;

      if (p.state === 'DEAD') {
        return;
      }

      if (p.invincible) {
        p.invincTimer -= pMs;
        if (p.invincTimer <= 0) { p.invincible = false; p.invincTimer = 0; p.dashInvinc = false; p.dashCoyote = false; }
      }

      var frDt = Math.pow(C.FRICTION, pS60);
      if (p.state === 'MOVING') {
        var inp = this._inputVec();
        p.vx = (p.vx + inp.dx * C.ACCEL * pS60) * frDt;
        p.vy = (p.vy + inp.dy * C.ACCEL * pS60) * frDt;
      } else if (p.state === 'RECOVERY') {
        var rf = p.recoveryWhiff ? C.DASHATK_WHIFF_FRIC : C.RECOVERY_FRIC;
        p.vx *= Math.pow(rf, pS60); p.vy *= Math.pow(rf, pS60);
      } else {
        p.vx *= frDt; p.vy *= frDt;
      }
      p.x += p.vx * pS60; p.y += p.vy * pS60;

      var wM = C.WORLD_HALF - C.SIZE * 1.5;
      if (p.x < -wM) { p.x = -wM; p.vx *= -0.4; }
      if (p.x >  wM) { p.x =  wM; p.vx *= -0.4; }
      if (p.y < -wM) { p.y = -wM; p.vy *= -0.4; }
      if (p.y >  wM) { p.y =  wM; p.vy *= -0.4; }

      if (p.state === 'DASHING') {
        p.dashTimer -= pMs;
        if (p.vx * p.vx + p.vy * p.vy > 4) {
          this._addGhost(p.x, p.y, 0.55, p.angle, false);
        }
        if (p.dashTimer <= 0) {
          var dashUpLvl = (this._upgradeLevels && this._upgradeLevels.dash) || 0;
          p.state = 'MOVING'; p.dashCooldown = C.DASH_CD * (dashUpLvl >= 1 ? 0.70 : 1.0);
          p.invincible = true; p.invincTimer = 220; p.dashInvinc = true;
          p.dashCoyote = true; // coyote window: attack within post-dash iframes → Dash-Attack
          if (dashUpLvl >= 2) {
            this._dashTornadoCounter = (this._dashTornadoCounter || 0) + 1;
            if (this._dashTornadoCounter % 3 === 0) { this._spawnDashTornado(p.x, p.y); }
          }
        }
      }
      if (p.state !== 'DASHING' && p.dashCooldown > 0) {
        p.dashCooldown = Math.max(0, p.dashCooldown - pMs);
        if (p.dashCooldown <= 0) p.dashAvailable = true;
      }

      if (p.state === 'ATTACKING') {
        p.atkTimer -= pMs; p.spinAngle += pDt * C.ATK_SPIN;
        if (p.atkTimer <= 0) {
          p.state = 'RECOVERY'; p.recoveryTimer = C.ATK_WHIFF_DUR;
          p.recoveryWhiff = true; p.spinAngle = 0;
          p.vx *= 0.15; p.vy *= 0.15;
        }
      }

      if (p.state === 'DASH_ATTACKING') {
        p.atkTimer -= pMs; p.spinAngle += pDt * C.DASH_ATK_SPIN;
        this._addGhost(p.x, p.y, 0.70, p.angle, true);
        if (p.atkTimer <= 0) {
          if (p.hasHitDuringDashAttack) {
            this._triggerLandingBurst();
            p.state = 'MOVING';
            // Star Power: instant cooldown reset — spammable like normal attack
            if (this.isStarPowered) {
              p.atkAvailable = true; p.atkCooldown = 0;
              p.dashCooldown = 0; p.dashAvailable = true;
            }
          } else {
            p.state = 'RECOVERY'; p.recoveryTimer = C.DASHATK_WHIFF_DUR;
            p.recoveryWhiff = true; p.vx *= 0.05; p.vy *= 0.05;
          }
          p.spinAngle = 0;
        }
      }

      if (p.state === 'RECOVERY') {
        p.recoveryTimer -= pMs;
        if (p.recoveryTimer <= 0) { p.state = 'MOVING'; p.recoveryTimer = 0; }
      }
      if (p.state !== 'ATTACKING' && p.state !== 'DASH_ATTACKING') {
        p.atkAvailable = true;
      }

      this._decayGhosts(dt);

      if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') {
        // During attack: snap toward attack target (mouse at time of attack)
        p.angle = Math.atan2(p.atkDy, p.atkDx) + p.spinAngle;
      } else if (p.state === 'DASHING') {
        // During dash: point in dash direction
        p.angle = Math.atan2(p.dashDy, p.dashDx);
      } else {
        // Normal movement: follow input direction; point at mouse when idle
        var inp = this._inputVec();
        if (Math.abs(inp.dx) > 0.01 || Math.abs(inp.dy) > 0.01) {
          p.angle = Math.atan2(inp.dy, inp.dx);
        } else {
          // No directional input — smoothly face the mouse cursor
          var cam = this.cameras.main;
          var mwx = cam.scrollX + this._mouseX;
          var mwy = cam.scrollY + this._mouseY;
          var mdx = mwx - p.x, mdy = mwy - p.y;
          if (mdx * mdx + mdy * mdy > 4) {
            var targetAngle = Math.atan2(mdy, mdx);
            var diff = Phaser.Math.Angle.Wrap(targetAngle - p.angle);
            p.angle += diff * Math.min(1, 12 * dt);
          }
        }
      }

      var tdx = p.x - this._trLX, tdy = p.y - this._trLY;
      if (tdx * tdx + tdy * tdy > this.TRAIL_DIST_SQ) {
        var sl = this._trail[this._trW % this.TRAIL_CAP];
        sl.x = p.x; sl.y = p.y; sl.angle = p.angle; sl.ok = true;
        this._trW++;
        if (this._trN < this.TRAIL_CAP) this._trN++;
        this._trLX = p.x; this._trLY = p.y;
      }

      this._updateEnemies(sDt);
      this._updateProjectiles(sDt, pDt);
      this._checkCollisions();
      this._checkStarPickup();

      // Star power timer countdown — uses real time so TW doesn't pause the bar
      if (this.isStarPowered) {
        this._starPowerTimer -= pMs;
        if (this._starPowerTimer < 0) this._starPowerTimer = 0;
      }

      if (this.spawnTimer > -999000) {
        this.spawnTimer += ms;
        if (this.spawnTimer >= this.nextSpawnDelay) {
          this.spawnTimer = 0;
          this.nextSpawnDelay = Phaser.Math.Between(3000, 5000);
          this._spawnWave();
        }
      }

      this._shieldAngle += sDt * 1.8;
      this._renderShieldOrbs();

      var cam = this.cameras.main;
      var camS60 = this._twActive ? pS60 : s60;
      var cA = 1 - Math.pow(1 - C.CAM_LERP, camS60);
      cam.scrollX += (p.x - cam.width  / 2 - cam.scrollX) * cA;
      cam.scrollY += (p.y - cam.height / 2 - cam.scrollY) * cA;

      this.pcbTile.tilePositionX = cam.scrollX;
      this.pcbTile.tilePositionY = cam.scrollY;
      this.pcbTile.setSize(cam.width, cam.height);

      // --- Glow pulse (bioluminescence) ---
      var t = this.gameTime;
      // Floor at 0.06 so glow never fully disappears — max ~0.34
      var glowAlpha = Math.max(0.06,
        0.22 + 0.16 * Math.sin(t * 0.40) +   // main ~15.7s period
        0.06 * Math.sin(t * 1.05) +           // secondary ~6s period
        0.03 * Math.sin(t * 2.30)             // micro variation ~2.7s
      ) * 0.72;
      this.pcbGlow.setAlpha(glowAlpha);
      this.pcbGlow.tilePositionX = cam.scrollX;
      this.pcbGlow.tilePositionY = cam.scrollY;
      this.pcbGlow.setSize(cam.width, cam.height);

      // --- Vignette combo intensity — pulsing urgency ---
      if (this._vignetteSprite) {
        // comboRatio: 0 at x1, 1 at x50+
        var vigComboRatio = Math.min(Math.max(this.comboMultiplier - 1, 0), 49) / 49;
        // pulseRatio: 0 until x5, then ramps to 1 at x50
        var vigPulseRatio = Math.min(Math.max(this.comboMultiplier - 5, 0), 45) / 45;
        // Base alpha rises with combo (0.65 → 0.90)
        var vigBase = 0.65 + vigComboRatio * 0.25;
        // Pulse amplitude: 0 at low combo, up to ±0.42 at x50
        var vigAmp  = vigPulseRatio * 0.42;
        // Pulse frequency: 1 Hz at x5, 5.5 Hz (rapid heartbeat) at x50
        var vigFreq = 1.0 + vigPulseRatio * 4.5;
        var vigA = vigBase + vigAmp * Math.sin(this.gameTime * vigFreq * Math.PI * 2);
        this._vignetteSprite.setAlpha(Math.min(1.0, Math.max(0.30, vigA)));
      }

      this.gameTime += dt;

      if (this.comboTimer > 0) {
        this.comboTimer -= ms;
        if (this.comboTimer <= 0) {
          this.comboTimer = 0;
          this.comboMultiplier = 1;
          this._comboPulse = 0;
        }
      }

      this._updateWaveRings(dt);
      this._updateCondemnedDeathRings(dt);
      this._updateHiveBeams(dt);

      this._updateComboFX(sDt);
      this._updateDashVacuumFX(pDt);
      this._updateDashTornados(sDt);
      this._renderPlayer();
      this._renderEnemies();
      this._renderProjectiles();
      this._renderHUD();
    },
  };

  /* Merge all scene method mixins into the class definition */
  var methods = LA.sceneMethods;
  for (var k in methods) {
    if (methods.hasOwnProperty(k)) {
      sceneDef[k] = methods[k];
    }
  }

  var GameScene = new Phaser.Class(sceneDef);

  /* ================================================================
     FACTORY
     ================================================================ */

  window.createLightGame = function (parentEl) {
    if (!parentEl) return null;
    var game = null;

    function start() {
      var bgCol = LA.getColors().bgColor;
      var bgCss = '#' + ('000000' + bgCol.toString(16)).slice(-6);
      if (!document.getElementById('_la-loading')) {
        var lo = document.createElement('div');
        lo.id = '_la-loading';
        lo.style.cssText = [
          'position:absolute', 'inset:0', 'z-index:1',
          'display:flex', 'align-items:center', 'justify-content:center',
          'background:' + bgCss,
          'pointer-events:none',
        ].join(';');
        lo.innerHTML =
          '<style>@keyframes _la-spin{to{transform:rotate(360deg)}}@keyframes _la-pulse{0%,100%{opacity:.5}50%{opacity:1}}</style>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:1rem">' +
            '<div style="width:36px;height:36px;border:2.5px solid rgba(0,255,255,0.15);border-top-color:rgba(0,255,255,0.85);border-radius:50%;animation:_la-spin .7s linear infinite"></div>' +
            '<span style="font-family:monospace;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(0,255,255,0.45);animation:_la-pulse 1.4s ease-in-out infinite">Light Again</span>' +
          '</div>';
        parentEl.style.position = 'relative';
        parentEl.appendChild(lo);
      }

      game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent: parentEl,
        width: parentEl.clientWidth,
        height: parentEl.clientHeight,
        backgroundColor: LA.getColors().bgColor,
        transparent: false,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        input: {
          mouse: { preventDefaultDown: true, preventDefaultUp: true },
          keyboard: { target: window },
        },
        scene: [GameScene],
        disableContextMenu: true,
      });
    }

    function stop() {
      if (game) { game.destroy(true); game = null; }
    }

    function pause() {
      if (game && game.scene) game.scene.pause('GameScene');
    }

    function resume() {
      if (game && game.scene) game.scene.resume('GameScene');
    }

    return { start: start, stop: stop, pause: pause, resume: resume };
  };

})();
