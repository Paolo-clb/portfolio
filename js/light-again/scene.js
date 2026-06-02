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

    preload: function () {
      // Steve pickaxe skin assets (cosmetic). Diamond = dash ready, Golden = dash on
      // cooldown (mirrors the arrow's cyan→yellow). Loaded under _raw keys; baked
      // into '_la_pickaxe' / '_la_pickaxe_gold' in _genTextures. A 404 silently
      // falls back to the arrow.
      if (!this.textures.exists('_la_pick_diamond_raw') && !this.textures.exists('_la_pickaxe')) {
        this.load.image('_la_pick_diamond_raw', 'assets/light-again/Diamond_Pickaxe.png');
      }
      if (!this.textures.exists('_la_pick_gold_raw') && !this.textures.exists('_la_pickaxe_gold')) {
        this.load.image('_la_pick_gold_raw', 'assets/light-again/Golden_Pickaxe.png');
      }
      // Stone pickaxe = whiff/punish state (mirrors the grey '_ar_whiff' arrow:
      // missed basic attack or missed dash-attack — i.e. RECOVERY + recoveryWhiff).
      if (!this.textures.exists('_la_pick_stone_raw') && !this.textures.exists('_la_pickaxe_stone')) {
        this.load.image('_la_pick_stone_raw', 'assets/light-again/Stone_Pickaxe.png');
      }
      // Enchanted-netherite dash-attack animation (spritesheet, 60×160² frames)
      if (!this.textures.exists('_la_pick_neth_raw') && !this.textures.exists('_la_neth_0')) {
        this.load.image('_la_pick_neth_raw', 'assets/light-again/Enchanted_Netherite_Pickaxe.png');
      }
    },

    create: function () {
      var self = this;
      window.__laSceneRef = this;
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

      // --- Screen-flash guard ------------------------------------------------
      // cam.flash() paints the whole viewport the flash colour at full opacity
      // on frame 0, then fades it out via the camera effect's PER-FRAME update.
      // That update only runs while the scene is stepping — when the scene is
      // paused (upgrade draft, game-over screen, home menu) the effect freezes
      // at frame 0 and the screen stays a solid block of colour (e.g. the cyan
      // "+1 shield" flash fired from a draft Skip button). Swallow any flash
      // requested while the scene isn't actively running so those screens never
      // go solid. Wrapping the instance method here keeps every existing
      // cameras.main.flash(...) call site guarded without touching them.
      var _camFlash = cam.flash;
      cam.flash = function () {
        if (self.scene && !self.scene.isActive()) return cam;
        return _camFlash.apply(cam, arguments);
      };

      // A paused scene keeps RENDERING (only its update stops), so a flash that
      // was still fading the instant pause hit freezes mid-fade — its leftover
      // colour stays painted as a solid wash UNDER the transparent pause / home
      // menu, which looks bad. Kill any in-flight flash the moment we pause so
      // those screens stay clean. (The wrap above blocks NEW flashes while
      // paused; this clears one that was already running.) Torn down on
      // shutdown so the listener can't stack across scene.restart().
      this.events.on('pause', self._onScenePause = function () {
        if (cam.flashEffect && cam.flashEffect.isRunning) cam.flashEffect.reset();
      });

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

      // Redraw vignette when Scale manager finalises dimensions (fixes first-launch offset).
      // ScaleManager is game-global (not scene-scoped) so this must be removed on shutdown,
      // otherwise restarts stack duplicate handlers.
      this.scale.on('resize', this._onScaleResize = function () {
        self._drawVignette();
        // Background tiles cover the viewport — resize them here instead of every frame
        var rcam = self.cameras.main;
        if (self.pcbTile) self.pcbTile.setSize(rcam.width, rcam.height);
        if (self.pcbGlow) self.pcbGlow.setSize(rcam.width, rcam.height);
      });

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
      this._labelBands   = [];   // shared anti-overlap registry for world-space float callouts
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
      this.nextSpawnDelay = Phaser.Math.Between(C.HC_WAVE_GAP_MIN, C.HC_WAVE_GAP_MAX); // hardcore wave gap
      this._enemyBag = null;               // rarity bag (rebuilt on first draw)
      this._sandboxRate = C.SANDBOX_RATE_DEFAULT; // mouse-wheel spawn speed (sandbox)
      this._spdUiTimer = 0;                // countdown for the speed slider visibility
      this._clearWave = null;              // active Clear Board shockwave

      // Sandbox speed slider (world-space, floats above the ship; hidden by default)
      this._spdBarGfx = this.add.graphics();
      this._spdBarGfx.setDepth(103);
      this._spdBarGfx.setVisible(false);
      this._spdTxt = this.add.text(0, 0, '', {
        fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#9fe0ff',
      });
      this._spdTxt.setOrigin(0.5, 1);
      this._spdTxt.setDepth(104);
      this._spdTxt.setVisible(false);

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
      for (var wi = 0; wi < 32; wi++) {
        var wg = this.add.graphics();
        wg.setDepth(35);
        wg.setBlendMode(Phaser.BlendModes.ADD);
        wg.setVisible(false);
        this._waveRings.push({
          gfx: wg, x: 0, y: 0, r: 0, alpha: 0, active: false,
          elapsed: 0, maxRadius: 121, color: 0x00ffff, expandTime: 0.28,
        });
      }
      this._waveRingW = 0;

      // Pool for condemned-death ring bursts (up to 16 simultaneous)
      this._twDeathRings = [];
      for (var tdi = 0; tdi < 48; tdi++) {
        var tdg = this.add.graphics();
        tdg.setDepth(34);
        tdg.setBlendMode(Phaser.BlendModes.ADD);
        tdg.setVisible(false);
        this._twDeathRings.push({ gfx: tdg, x: 0, y: 0, r: 0, alpha: 0, active: false,
          elapsed: 0, maxRadius: 50, expandTime: 0.22 });
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

      // World-space DISC border: darkened exterior, animated neon rim, and the
      // pool of wall-impact flares. (See effects.js.)
      this._buildWorldBorder();

      this.hudGfx = this.add.graphics();
      this.hudGfx.setScrollFactor(0);
      this.hudGfx.setDepth(100);

      // Top-left HUD stack: FPS, then live enemy count + survival time below it.
      this.fpsTxt = this.add.text(8, 6, '', {
        fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#00ff88',
      });
      this.fpsTxt.setScrollFactor(0);
      this.fpsTxt.setDepth(101);

      this._enemyCountTxt = this.add.text(8, 27, '', {
        fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#3a78a0',
      });
      this._enemyCountTxt.setScrollFactor(0);
      this._enemyCountTxt.setDepth(101);

      this._timeTxt = this.add.text(8, 53, '', {
        fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#3a78a0',
      });
      this._timeTxt.setScrollFactor(0);
      this._timeTxt.setDepth(101);

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
      this._delayExpBuf = null;     // grouped "Delayed Explosion ×N" popup bucket
      this._delayExpFxTimes = null; // sliding window throttling detonation screen FX

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

      // Boss reward power-up flourish (decays in update; read by _renderPlayer)
      this._powerUpT     = 0;
      this._powerUpSteve = false;

      // Mini kamikaze drones (6th upgrade): plain-data pool + one shared renderer
      this._drones        = [];
      this._droneRespawnT = 0;
      this._droneAngSeed  = 0;
      this._droneGfx      = this.add.graphics();
      this._droneGfx.setDepth(24);
      this._droneGfx.setBlendMode(Phaser.BlendModes.ADD);

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
      this._starPowerMax = 0;   // HUD-bar reference = biggest charge held this session (variable durations + accumulation)

      this._starAuraGfx = this.add.graphics();
      this._starAuraGfx.setDepth(27);
      this._starAuraGfx.setBlendMode(Phaser.BlendModes.ADD);
      this._starAuraGfx.setVisible(false);

      // Guidance chevron toward the Cache-Zone Overdrive reward orb (drawn by star-power.js).
      this._starPtrGfx = this.add.graphics();
      this._starPtrGfx.setDepth(66);
      this._starPtrGfx.setBlendMode(Phaser.BlendModes.ADD);

      // Upgrade system (roguelite draft)
      this._initUpgrades();
      this._initTimeStop();
      this._initAnomaly();
      this._initGigaBruiser();
      this._initMirror();
      this._initSnake();
      this._initDigitalTree();
      this._initCurseFount();
      this._initDataHighways();
      this._initCacheZone();
      this._initCore();
      this._initTutorial();
      this._resetBossHint();

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
        // Clear Board (sandbox only): Delete / Backspace → screen-sweeping shockwave.
        // Disabled during the tutorial (would wipe curated lesson enemies / cheese
        // the Bruiser step's presence-based completion) EXCEPT the final sandbox
        // step, which teaches this very tool (_tutSandboxStep).
        if ((ev.code === 'Delete' || ev.code === 'Backspace') && !ev.repeat) {
          ev.preventDefault();
          if (window.__laGameMode === 'sandbox' && (!self._tutorialActive || self._tutSandboxStep) && self.p && self.p.state !== 'DEAD') self._clearBoard();
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
        // Cheat: force-spawn The Anomaly mini-boss (works in both modes)
        if (ev.code === 'KeyG' && !ev.repeat) {
          ev.preventDefault();
          self._spawnAnomaly();
        }
        // Cheat: force-spawn The Giga Bruiser mini-boss (the 50/50 alt to G)
        if (ev.code === 'KeyT' && !ev.repeat) {
          ev.preventDefault();
          self._spawnGigaBruiser();
        }
        // Cheat: force-spawn The Mirror mini-boss
        if (ev.code === 'KeyH' && !ev.repeat) {
          ev.preventDefault();
          self._spawnMirror();
        }
        // Cheat: force-spawn The Serpent mini-boss (the splitting snake)
        if (ev.code === 'KeyJ' && !ev.repeat) {
          ev.preventDefault();
          self._spawnSnake();
        }
        // Cheat: force-spawn The Digital Tree (random extra-life event) — guided, easy to test
        if (ev.code === 'KeyP' && !ev.repeat) {
          ev.preventDefault();
          self._spawnDigitalTree({ guided: true });
        }
        // Cheat: skip straight to a following Cyber-Fairy (test the revive)
        if (ev.code === 'KeyO' && !ev.repeat) {
          ev.preventDefault();
          if (!self._fairy) self._spawnFairy(self.p.x + 60, self.p.y - 60);
        }
        // Cheat: force-spawn The Curse Fountain (close + guided, easy to test)
        if (ev.code === 'KeyU' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnCurseFount) self._spawnCurseFount({ guided: true, near: true });
        }
        // Cheat: force-spawn a Data Highway near the player (autoroute de données)
        if (ev.code === 'KeyY' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnHighway) self._spawnHighway({});
        }
        // Cheat: force-spawn the Unstable Core near the player (noyau instable)
        if (ev.code === 'KeyC' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnCore) self._spawnCore({});
        }
        // Cheat: force-spawn a Cache Zone near the player (zone de cache — KotH)
        if (ev.code === 'KeyB' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnCacheZone) self._spawnCacheZone({ near: true });
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

      // Canvas persists across scene.restart() — keep a ref so we can detach on shutdown
      this.game.canvas.addEventListener('contextmenu', this._onCanvasCtxMenu = function (e) { e.preventDefault(); });

      // Mouse wheel paces the sandbox spawn rate (up = faster, down = calmer).
      this.game.canvas.addEventListener('wheel', this._onCanvasWheel = function (e) {
        if (window.__laGameMode !== 'sandbox') return;
        e.preventDefault();
        self._adjustSandboxRate(e.deltaY < 0 ? 1 : -1);
      }, { passive: false });

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
          // Shield upgrade side-effect: raise MAX_SHIELDS (Lv3 adds no slot → cap 3)
          var shLvl = self._upgradeLevels.shield || 0;
          if (shLvl > 0) self.MAX_SHIELDS = 1 + Math.min(shLvl, 2);
          // Spawn the kamikaze drones immediately for the maxed drone branch
          if (self._ensureDrones) self._ensureDrones();
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
        self._twBgCM   = null;
        self._twGlowCM = null;
        self._twWaveGfx = null;
        self._droneGfx = null;  // graphics destroyed with the scene; drop the stale ref
        if (self._drones) self._drones.length = 0;
        if (self._twIconTxt) { self._twIconTxt.destroy(); self._twIconTxt = null; }
        if (self._killCounterTxt) { self._killCounterTxt.destroy(); self._killCounterTxt = null; }
        if (self._clearAnomaly)     self._clearAnomaly(true);
        if (self._clearGigaBruiser) self._clearGigaBruiser(true);
        if (self._clearMirror)      self._clearMirror(true);
        if (self._clearSnake)       self._clearSnake(true);
        if (self._clearDigitalTree) self._clearDigitalTree(true);
        if (self._clearFairy)       self._clearFairy();
        if (self._clearCurseFount)  self._clearCurseFount(true);
        if (self._clearDataHighways) self._clearDataHighways(true);
        if (self._clearCore)        self._clearCore(true);
        if (self._clearCacheZone)   self._clearCacheZone(true);
        if (self._removeBossHintDom) self._removeBossHintDom();
        self._treeGfx = null; self._treePtrGfx = null; self._fairyGfx = null;
        self._fountDarkGfx = null; self._fountGfx = null; self._fountObGfx = null; self._fountPtrGfx = null;
        self._highwayGfx = null;
        // World border: the mask graphics is created off the display list, so it
        // isn't auto-destroyed on restart — release it explicitly.
        if (self._worldDarkMaskG) { self._worldDarkMaskG.destroy(); self._worldDarkMaskG = null; }
        self._worldDark = null; self._borderGfx = null; self._wallImpacts = null;
        self._coreGfx = null;   // graphics destroyed with the scene; drop the stale ref
        self._cacheGfx = null; self._cacheTopGfx = null; self._starPtrGfx = null;
        self._cacheStarGhost = null; self._cacheStarFill = null; self._cacheStarMaskGfx = null;
        // Tear down any tutorial overlay so it can't outlive the scene (e.g. a
        // mode switch from the home menu mid-tutorial would otherwise orphan it).
        self._tutorialActive = false;
        window.__laTutorialActive = false;
        var tutOv = document.getElementById('_la-tut-overlay');
        if (tutOv && tutOv.parentNode) tutOv.parentNode.removeChild(tutOv);
        // Symmetric teardown for the upgrade / secret / curse-fountain draft
        // overlay (they share this id). The tutorial overlay was torn down above
        // but this one never was: a restart or mode-switch fired while a draft
        // was open left it orphaned ON TOP of the fresh run — pointer-events:auto
        // + z-index:55 swallow every click (a broken kill-switch), and its card
        // listeners pin the entire dead scene in memory (a major leak). Also drop
        // the boss-draft spawn-suppression flags so an interrupted draft can never
        // leave natural spawns frozen on the next run.
        var upOv = document.getElementById('_la-upgrade-overlay');
        if (upOv && upOv.parentNode) upOv.parentNode.removeChild(upOv);
        self._bossDraftPending = false;
        self._upgradeDraftOpen = false;
        window.__laSceneRef = null;
        if (self._onWindowFocus) {
          window.removeEventListener('focus', self._onWindowFocus);
          self._onWindowFocus = null;
        }
        if (self._onDebugKey) {
          window.removeEventListener('keydown', self._onDebugKey);
          self._onDebugKey = null;
        }
        if (self._onScaleResize) {
          self.scale.off('resize', self._onScaleResize);
          self._onScaleResize = null;
        }
        if (self._onScenePause) {
          self.events.off('pause', self._onScenePause);
          self._onScenePause = null;
        }
        if (self._onCanvasCtxMenu && self.game && self.game.canvas) {
          self.game.canvas.removeEventListener('contextmenu', self._onCanvasCtxMenu);
          self._onCanvasCtxMenu = null;
        }
        if (self._onCanvasWheel && self.game && self.game.canvas) {
          self.game.canvas.removeEventListener('wheel', self._onCanvasWheel);
          self._onCanvasWheel = null;
        }
      });
    },

    update: function (_time, delta) {
      // Defensive guard around the whole per-frame chain. update() drives dozens
      // of subsystems back-to-back (enemies, projectiles, collisions, bosses,
      // curses, highways, fairy, HUD). A single unguarded null-deref in ANY of
      // them would propagate out of Phaser's game loop and freeze the entire game
      // permanently (the "le jeu crash parfois" symptom). Catching here turns a
      // hard freeze into a single skipped frame — the game recovers next tick.
      try {
        this._updateStep(_time, delta);
      } catch (e) {
        this._updateErrCount = (this._updateErrCount || 0) + 1;
        // Log the first occurrence with its full stack (that pinpoints the bug);
        // stay silent afterwards so a recurring error can't flood the console
        // (which would itself stall the page).
        if (this._updateErrCount === 1 && window.console) {
          console.error('[LightAgain] update() error caught — frame skipped to avoid a hard freeze:', e);
        }
      }
    },

    _updateStep: function (_time, delta) {
      var dt = Math.min(delta / 1000, 0.05);
      this._frameDt = dt;   // real (unscaled) frame seconds — read by TW slow-mo systems (tornado pull)

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

      // Kick off the interactive tutorial once the loader has cleared. The flag
      // is armed by shell.js on first launch, the ? button, or a hardcore→sandbox
      // switch. Checked once per scene lifecycle.
      if (this._loaderRemoved && !this._tutArmChecked) {
        this._tutArmChecked = true;
        if (window.__laStartTutorialOnReady) {
          window.__laStartTutorialOnReady = false;
          this._startTutorial();
        }
      }

      // Upgrade slow-mo transition (runs on real dt, not scaled)
      this._updateUpgradeSlowMo(dt);

      // Boss power-up flourish decays on real time (a cosmetic surge before the draft)
      if (this._powerUpT > 0) this._powerUpT = Math.max(0, this._powerUpT - dt);

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

      // Anomaly intro cinematic: freeze BOTH the world AND the player (the
      // boss itself is driven by real-time inside _updateAnomaly).
      if (this._anomalyIntroActive) {
        sDt = 0; s60 = 0; ms  = 0;
        pDt = 0; pS60 = 0; pMs = 0;
      }

      this._fpsCounter = (this._fpsCounter || 0) + 1;
      if (this._fpsCounter >= 15) {
        this._fpsCounter = 0;
        var fps = Math.round(this.game.loop.actualFps);
        if (fps !== this._lastFps) {
          this._lastFps = fps;
          this.fpsTxt.setText(fps + ' FPS');
          this.fpsTxt.setColor(fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444');
        }
        // Live enemy count — colour bands scaled to C.MAX_ENEMIES (1000):
        // ≤ 40 % blue, 40–75 % amber, > 75 % red.
        var ec = this.enemies.length;
        if (ec !== this._lastEnemyCount) {
          this._lastEnemyCount = ec;
          this._enemyCountTxt.setText('▲ ' + ec);
          var ecMax = C.MAX_ENEMIES;
          this._enemyCountTxt.setColor(
            ec > ecMax * 0.75 ? '#ff4444'
            : ec > ecMax * 0.40 ? '#ffcc00'
            : '#3a78a0'
          );
        }
        // Survival time (real elapsed play time)
        var ts = Math.floor(this.gameTime);
        if (ts !== this._lastTimeSec) {
          this._lastTimeSec = ts;
          var mm = Math.floor(ts / 60), ss = ts % 60;
          this._timeTxt.setText((mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss);
        }
      }

      if (ms < 0.001 && pMs < 0.001 && !this._anomalyIntroActive) {
        this._decayGhosts(dt);
        // While the fairy is reviving, the ship is "dead" (hidden) — don't let
        // the hitstop frame flicker it back on; the revive owns its rendering.
        if (!this._fairyReviving) this._renderPlayer();
        return;
      }
      // During the intro the whole world is frozen but we still want the
      // anomaly to tick its cinematic — call it directly, advance per-frame
      // visual effects on REAL dt (so spawn pop-ins, wave rings and beams
      // continue to animate even though gameplay is paused).
      if (this._anomalyIntroActive) {
        this._decayGhosts(dt);
        this._updateAnomaly(0, 0, dt);
        // Let enemies finish their natural spawn animation in real time
        for (var _ai = 0; _ai < this.enemies.length; _ai++) {
          var _ae = this.enemies[_ai];
          if (_ae._spawnAnimT < 1.0) _ae._spawnAnimT = Math.min(1.0, _ae._spawnAnimT + dt * 2.5);
        }
        this._updateWaveRings(dt);
        this._updateCondemnedDeathRings(dt);
        this._updateHiveBeams(dt);
        this._renderPlayer();
        this._renderEnemies();
        this._renderProjectiles(dt);
        this._renderHUD(dt);
        return;
      }

      var p = this.p;

      if (p.state === 'DEAD') {
        // Cyber-Fairy resurrection cinematic plays while the ship is "dead":
        // the fairy drifts to the death spot and rebuilds the arrow on real dt,
        // with the frozen world held around it until the board-clear sweep.
        if (this._fairyReviving) {
          this._decayGhosts(dt);
          this._updateFairyRevive(dt);
          this._updateWaveRings(dt);
          this._updateCondemnedDeathRings(dt);
          this._updateHiveBeams(dt);
          this._renderEnemies();
          this._renderProjectiles(dt);
          this._renderHUD(dt);
        }
        return;
      }

      if (p.invincible) {
        p.invincTimer -= pMs;
        if (p.invincTimer <= 0) { p.invincible = false; p.invincTimer = 0; p.dashInvinc = false; p.dashCoyote = false; }
      }

      // Key state is constant within a frame — compute once and reuse for both
      // velocity integration and angle facing below.
      var inp = this._inputVec();
      var frDt = Math.pow(C.FRICTION, pS60);
      if (p.state === 'MOVING') {
        p.vx = (p.vx + inp.dx * C.ACCEL * pS60) * frDt;
        p.vy = (p.vy + inp.dy * C.ACCEL * pS60) * frDt;
      } else if (p.state === 'RECOVERY') {
        var rf = p.recoveryWhiff ? C.DASHATK_WHIFF_FRIC : C.RECOVERY_FRIC;
        p.vx *= Math.pow(rf, pS60); p.vy *= Math.pow(rf, pS60);
      } else {
        p.vx *= frDt; p.vy *= frDt;
      }
      p.x += p.vx * pS60; p.y += p.vy * pS60;

      // Data Highways conveyor — carries the player along an active flow corridor
      // (pure positional push; runs BEFORE the world clamp so an adverse flow can
      // genuinely shove you into a wall). On player time, so it works during TW.
      this._applyHighwayFlow(pS60, pMs);

      if (p._wallFxCd > 0) p._wallFxCd -= pMs;
      var wClamp = LA.clampDisc(p.x, p.y, C.SIZE * 1.5);
      if (wClamp.hit) {
        p.x = wClamp.x; p.y = wClamp.y;
        var wnx = wClamp.nx, wny = wClamp.ny;            // outward wall normal
        var wvd = p.vx * wnx + p.vy * wny;               // speed INTO the wall (>0)
        if (wvd > 0) {
          // Dash / attack into the rim launches you back FASTER (restitution > 1)
          // and adds a flat inward kick; a gentle drift just springs off.
          var aggressive = (p.state === 'DASHING' || p.state === 'DASH_ATTACKING' || p.state === 'ATTACKING');
          var rest = aggressive ? C.WALL_REBOUND_ATTACK : C.WALL_REBOUND_BASE;
          p.vx -= wnx * wvd * (1 + rest);
          p.vy -= wny * wvd * (1 + rest);
          if (aggressive) { p.vx -= wnx * C.WALL_REBOUND_KICK; p.vy -= wny * C.WALL_REBOUND_KICK; }
          // Cap the rebound so it can never run away (inward speed = -(v·n)).
          // Add back along the OUTWARD normal to shave the excess inward speed.
          var back = -(p.vx * wnx + p.vy * wny);
          if (back > C.WALL_REBOUND_MAX) {
            var ex = back - C.WALL_REBOUND_MAX;
            p.vx += wnx * ex; p.vy += wny * ex;
          }
          // Impact feedback — throttled so a wall-slide doesn't machine-gun VFX.
          if (!(p._wallFxCd > 0)) {
            this._spawnWallImpact(p.x, p.y, wnx, wny, aggressive ? 1.0 : 0.45);
            if (aggressive) {
              this.cameras.main.shake(80, 0.006);
              this._triggerHitstop(40);
            }
            p._wallFxCd = C.WALL_FX_CD;
          }
        }
      }

      // Anomaly quarantine: trap the player inside the firewall
      this._confinePlayerToBarrier();

      if (p.state === 'DASHING') {
        p.dashTimer -= pMs;
        if (p.vx * p.vx + p.vy * p.vy > 4) {
          this._addGhost(p.x, p.y, 0.55, p.angle, false);
        }
        if (p.dashTimer <= 0) {
          var dashUpLvl = (this._upgradeLevels && this._upgradeLevels.dash) || 0;
          p.state = 'MOVING'; p.dashCooldown = C.DASH_CD * (dashUpLvl >= 1 ? 0.70 : 1.0) * (this._dashCdMult || 1);
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

      // During the tutorial, enemies hold still until the player acts — gives
      // breathing room to read each step's tip without getting swarmed/killed.
      if (!this._tutEnemiesFrozen) this._updateEnemies(sDt);
      // Data Highways sweep enemies caught in the flow too. During The World the
      // world crawls at ~2%; keep the sweep as a clear SLOW-MO instead (≈0.4× a
      // normal-time frame), so caught enemies still visibly drift along the road.
      this._applyHighwayFlowToEnemies(this._twActive ? dt * 60 * C.HIGHWAY_TW_FLOW_SCALE : s60);
      this._updateProjectiles(sDt, pDt);
      this._checkCollisions();
      this._checkStarPickup();
      this._updateAnomaly(ms, pMs, dt);
      this._checkAnomalyCollision();
      this._updateGigaBruiser(ms, pMs, dt);
      this._checkGigaBruiserCollision();
      this._updateMirror(ms, pMs, dt);
      this._checkMirrorCollision();
      this._updateSnake(ms, pMs, dt);
      this._checkSnakeCollision();
      this._updateBossHint(dt);   // sandbox: first-encounter boss weakness tooltip (real dt)
      this._updateDigitalTree(dt);
      this._updateCurseFount(dt);
      // Highway visual/lifecycle: ease into slow-mo during The World (it normally
      // animates on real dt, so without this it would keep flowing at full speed
      // while everything else is frozen). Spawns are already suspended during TW.
      this._updateDataHighways(this._twActive ? dt * C.HIGHWAY_TW_VISUAL_SCALE : dt);
      this._updateCacheZone(dt, ms);   // ms = scaled world time → the hack gauge pauses during The World / hitstop
      this._updateCore(dt, sDt);
      this._updateTutorial(dt);

      // Overdrive countdown — drives the HUD bar, the low-time blink AND the end,
      // all off the one timer (so they stay in sync and a pickup can ADD time
      // mid-Overdrive instead of resetting; see _activateStarPower). Player time,
      // so The World doesn't pause the bar.
      if (this.isStarPowered) {
        this._starPowerTimer -= pMs;
        if (!this._starPowerWarning && this._starPowerTimer <= C.STAR_WARN_REMAIN) this._starPowerWarning = true;
        if (this._starPowerTimer <= 0) { this._starPowerTimer = 0; this._deactivateStarPower(); }
      }

      // Natural spawns pause while the anomaly's quarantine barrier is up, and
      // during the tutorial (which curates its own lesson environments) — except
      // the final sandbox step, where the real wheel-paced spawner is the lesson.
      if (this.spawnTimer > -999000 && !this._anomalyBarrierActive && !this._bossDraftPending && (!this._tutorialActive || this._tutSandboxStep)) {
        this.spawnTimer += ms;
        var _sandbox = (window.__laGameMode === 'sandbox');
        // Sandbox: steady one-by-one stream, paced live by the mouse wheel.
        // Hardcore: bursty waves with a random gap (size grows with kills).
        var _spawnDelay = _sandbox ? (C.SANDBOX_BASE_INTERVAL / this._sandboxRate) : this.nextSpawnDelay;
        if (this.spawnTimer >= _spawnDelay) {
          this.spawnTimer = 0;
          if (_sandbox) {
            this._spawnSandboxOne();
          } else {
            this._spawnHardcoreWave();
            this.nextSpawnDelay = Phaser.Math.Between(C.HC_WAVE_GAP_MIN, C.HC_WAVE_GAP_MAX);
          }
        }
      }

      // Clear Board shockwave + sandbox speed slider (both run on real time)
      this._updateClearWave(dt);
      this._updateSpeedUi(dt);

      this._shieldAngle += sDt * 1.8;
      this._renderShieldOrbs();

      var cam = this.cameras.main;
      var camS60 = this._twActive ? pS60 : s60;
      var cA = 1 - Math.pow(1 - C.CAM_LERP, camS60);
      cam.scrollX += (p.x - cam.width  / 2 - cam.scrollX) * cA;
      cam.scrollY += (p.y - cam.height / 2 - cam.scrollY) * cA;

      this.pcbTile.tilePositionX = cam.scrollX;
      this.pcbTile.tilePositionY = cam.scrollY;

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

      if (this.comboTimer > 0 && !this._twActive) {
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
      this._updateWorldBorder(dt);
      this._updateWallImpacts(dt);

      this._updateComboFX(sDt);
      this._updateDashVacuumFX(pDt);
      // Tornado spin/lifecycle: a clear slow-mo during The World instead of the 2%
      // world crawl (its enemy pull gets a matching slow-mo drift in _updateEnemies).
      this._updateDashTornados(this._twActive ? dt * C.DASH_TORNADO_TW_SCALE : sDt);
      // The World ONLY: drones keep flying on player time — they detach from the
      // orbit, dive at the frozen enemies and defer their blast to resolution.
      // Every other time-stop (hitstop, upgrade slow-mo, anomaly intro) freezes
      // them with the world via sDt, as before.
      this._updateDrones(this._twActive ? pDt : sDt);
      this._renderPlayer();
      this._renderEnemies();
      this._renderProjectiles(dt);  // pass raw dt for frame-rate independent decay
      this._renderHUD(dt);
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
        // z-index 80 sits above the mode-select menu (z=60) so the loader is
        // visible the instant it's appended, even while the menu fades out.
        lo.style.cssText = [
          'position:absolute', 'inset:0', 'z-index:80',
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
      // Force a layout commit so the browser CAN paint the loader on the
      // next frame, then defer the heavy Phaser.Game construction by 2 rAF —
      // otherwise the synchronous WebGL/canvas init blocks the main thread
      // before the loader is ever painted and the user sees "nothing happens".
      void parentEl.offsetHeight;

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
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
        });
      });
    }

    function stop() {
      if (game) { game.destroy(true); game = null; }
    }

    function restart() {
      // NB: game.scene is the SceneManager, which has NO restart() method —
      // restart() lives on the per-scene ScenePlugin (scene.scene). Calling the
      // wrong one threw, leaving the restart loader spinning forever. Grab the
      // live scene instance and restart through its plugin.
      if (!game || !game.scene) return;
      var sc = game.scene.getScene('GameScene');
      if (sc && sc.scene && typeof sc.scene.restart === 'function') sc.scene.restart();
    }

    function pause() {
      if (game && game.scene) game.scene.pause('GameScene');
    }

    function resume() {
      if (game && game.scene) game.scene.resume('GameScene');
    }

    return { start: start, stop: stop, pause: pause, resume: resume, restart: restart };
  };

})();
