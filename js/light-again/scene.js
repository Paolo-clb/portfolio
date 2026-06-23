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
      var _flashK   = (C.FLASH_INTENSITY != null) ? C.FLASH_INTENSITY : 1;
      // "Désactiver les flashs" accessibility setting (OFF by default): when on,
      // every screen flash is swallowed entirely. The truth lives on
      // window.__laNoFlash (kept in sync by the menu / game-over checkboxes) and
      // is seeded here from localStorage so it's honoured even if the player
      // never opens the menu where the toggle lives. Re-read on every scene
      // create() so it stays correct across restarts.
      try { window.__laNoFlash = (localStorage.getItem('la_no_flash') === '1'); } catch (e) { /* ignore */ }
      cam.flash = function (duration, red, green, blue, force, callback, context) {
        if (window.__laNoFlash) return cam;
        if (self.scene && !self.scene.isActive()) return cam;
        // Globally DAMP every screen flash in one place: scale the RGB uniformly so
        // each flash gets gentler while keeping its hue AND its intensity proportion
        // relative to the others (a full-white 255 flash and a dim 120 one both ×K).
        red   = (red   == null ? 255 : red)   * _flashK;
        green = (green == null ? 255 : green) * _flashK;
        blue  = (blue  == null ? 255 : blue)  * _flashK;
        return _camFlash.call(cam, duration, red, green, blue, force, callback, context);
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

      // Deep parallax layer: the SAME circuit, larger + darker + scrolling slower,
      // so panning reveals layered depth instead of one flat repeating tile.
      this.pcbDeep = this.add.tileSprite(0, 0, cam.width, cam.height, '_pcb');
      this.pcbDeep.setOrigin(0, 0);
      this.pcbDeep.setScrollFactor(0);
      this.pcbDeep.setDepth(-11);
      this.pcbDeep.setTileScale(1.7);
      this.pcbDeep.setTint(LA.getColors().deepTint || 0x21364f);
      this.pcbDeep.setAlpha(0.55);

      // Aurora layer: huge ultra-soft colour pools drifting between the circuit
      // layers — breaks the flat darkness without competing with gameplay
      // (ADD blend at very low alpha; slow autonomous drift + breathing).
      this._nebulaTile = this.add.tileSprite(0, 0, cam.width, cam.height, '_laNebula');
      this._nebulaTile.setOrigin(0, 0);
      this._nebulaTile.setScrollFactor(0);
      this._nebulaTile.setDepth(-10.5);
      this._nebulaTile.setBlendMode(Phaser.BlendModes.ADD);
      this._nebulaTile.setAlpha(0.07);

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
        if (self.pcbDeep) self.pcbDeep.setSize(rcam.width, rcam.height);
        if (self._nebulaTile) self._nebulaTile.setSize(rcam.width, rcam.height);
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
      // Reactive bloom on the arrow itself — _renderPlayer drives its strength +
      // colour by state and combo. preFX is WebGL-only, so guard it.
      if (this.playerSpr.preFX) {
        this._playerGlow = this.playerSpr.preFX.addGlow(0x9fefff, 2, 0, false, 0.1, 10);
      }

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
      // Enemy motion-trail length. 2 (was 4) — halves the per-enemy ADD-blend
      // ghost-draw fill cost (the dominant fill-rate lever during dense waves);
      // every trail loop reads this.ENEMY_TRAIL_N so the whole pipeline adapts.
      this.ENEMY_TRAIL_N = 2;
      this.spawnTimer = 0;
      this.nextSpawnDelay = Phaser.Math.Between(C.HC_WAVE_GAP_MIN, C.HC_WAVE_GAP_MAX); // hardcore wave gap
      // Hardcore wave size now ramps with BOSSES defeated (not enemy kills),
      // smoothed here so each boss kill eases the spawn up instead of snapping
      // (see _updateSpawnRamp / _hardcoreWaveSize). Starts at the base wave size.
      this._spawnRampSize = C.HC_WAVE_BASE;
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

      this._emitter = this.add.particles(0, 0, '_spark', {
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

      this._emitter2 = this.add.particles(0, 0, '_spark', {
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
      for (var pti = 0; pti < C.MAX_PROJECTILES * (PROJ_TRAIL_PER + 2); pti++) {
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
        hbg.setBlendMode(Phaser.BlendModes.ADD);   // glowing laser look
        hbg.setVisible(false);
        this._hiveBeams.push({ gfx: hbg, x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, active: false });
      }
      this._hiveBeamW = 0;

      // World-space DISC border: darkened exterior, animated neon rim, and the
      // pool of wall-impact flares. (See effects.js.)
      this._buildWorldBorder();
      this._buildAmbientMotes();   // slow drifting "data motes" so the floor lives between events

      this.hudGfx = this.add.graphics();
      this.hudGfx.setScrollFactor(0);
      this.hudGfx.setDepth(100);

      // Top HUD stats — a HORIZONTAL row to the right of the music visualizer
      // (which sits in the top-left corner): FPS · enemy count · survival time,
      // vertically centred (originY .5) on the visualizer's middle (y ~54).
      this.fpsTxt = this.add.text(114, 54, '', {
        fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#00ff88',
        stroke: '#000814', strokeThickness: 3,
      });
      this.fpsTxt.setOrigin(0, 0.5);
      this.fpsTxt.setScrollFactor(0);
      this.fpsTxt.setDepth(101);

      this._enemyCountTxt = this.add.text(194, 54, '', {
        fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold', color: '#3a78a0',
        stroke: '#000814', strokeThickness: 3,
      });
      this._enemyCountTxt.setOrigin(0, 0.5);
      this._enemyCountTxt.setScrollFactor(0);
      this._enemyCountTxt.setDepth(101);

      this._timeTxt = this.add.text(274, 54, '', {
        fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#3a78a0',
        stroke: '#000814', strokeThickness: 3,
      });
      this._timeTxt.setOrigin(0, 0.5);
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
      // Boss board-clear multiplier: the wave swept by a boss death is scored
      // IGNORING the combo and instead ×this value, which starts at 2 and grows by
      // 1 after every boss clear (×2 first boss, ×3 next, …). Reset each run (create).
      this._bossClearMult = 2;
      this._batchScore = 0;
      this._batchLabel = '';
      this._batchActive = false;
      this._delayExpBuf = null;     // grouped "Delayed Explosion ×N" popup bucket
      this._delayExpFxTimes = null; // sliding window throttling detonation screen FX
      // These float-score / parade buckets are lazily (re)created in combat.js, but
      // scene.restart() reuses this instance: stale arrays would hold Text refs that
      // Phaser already destroyed on shutdown (truthy → treated as live slots →
      // bogus evictions + destroy() on dead objects). Reset them with the run.
      this._bigScoreSlots = null;   // float "+score LABEL!" popup slots
      this._paradeBufs    = null;   // per-dash-attack PARADE accumulation buckets
      this._paradePending = null;   // per-dash-attack in-flight reflected-shot counts

      this._scoreTxt = this.add.text(cam.width / 2, 16, '0', {
        fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#00ffff',
        stroke: '#003344', strokeThickness: 3,
      });
      this._scoreTxt.setScrollFactor(0);
      this._scoreTxt.setOrigin(0.5, 0);
      this._scoreTxt.setDepth(102);
      this._scoreTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._scoreTxt.setAlpha(0.95);
      this._scoreTxt.setShadow(0, 0, '#00ffff', 12, false, true);  // neon halo (baked once)

      this._comboTxt = this.add.text(cam.width / 2, 48, '', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#ffcc00',
        stroke: '#332200', strokeThickness: 2,
      });
      this._comboTxt.setScrollFactor(0);
      this._comboTxt.setOrigin(0.5, 0);
      this._comboTxt.setDepth(102);
      this._comboTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._comboTxt.setAlpha(0);

      // Signal-Amplifier "X2" badge — lights up (mint green) just LEFT of the
      // score while you stand on a live Greed platform; hidden otherwise. Origin
      // (1, 0.5) so it docks by its right edge, vertically centred on the score
      // (the in-zone "X2" flies here on entry — greed-zone.js _greedLaunchHudX2).
      this._greedMultTxt = this.add.text(cam.width / 2, 16, 'X2', {
        fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', color: '#66ffcc',
        stroke: '#063322', strokeThickness: 3,
      });
      this._greedMultTxt.setScrollFactor(0);
      this._greedMultTxt.setOrigin(1, 0.5);
      this._greedMultTxt.setDepth(102);
      this._greedMultTxt.setBlendMode(Phaser.BlendModes.ADD);
      this._greedMultTxt.setShadow(0, 0, '#33ff99', 12, false, true);
      this._greedMultTxt.setAlpha(0);
      this._greedBadgePulse = 0;

      // Combo FX: x10+ trail emitter
      this._comboTrailEmitter = this.add.particles(0, 0, '_spark', {
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

      // Run-start spawn flourish: the arrow materialises with style, then the
      // "welcome" upgrade draft opens (like a boss reward). _spawnIntroT drives
      // the materialise override in _renderPlayer. Two independent once-per-run
      // flags (reset every scene (re)create): _spawnIntroDone gates the ANIMATION
      // (never replayed — e.g. a tutorial launched mid-spawn already showed it),
      // _welcomeDraftPending tracks whether the welcome DRAFT is still owed (it's
      // delivered at run start, OR deferred to the end of a tutorial that pre-empted
      // it). _welcomeDraftPending is cleared in _closeDraft once the draft resolves.
      this._spawnIntroT       = 0;
      this._spawnIntroSteve   = false;
      this._spawnIntroDone    = false;
      this._welcomeDraftPending = true;
      // True during the short beat between the loader clearing and the arrow
      // materialising: the player is kept hidden + frozen so the EMPTY arena is
      // visible first (and the spawn flourish isn't masked by the fading loader).
      this._awaitingSpawnIntro  = false;
      // True for the whole run-start grace invincibility → suppresses the i-frame
      // flicker so the freshly-spawned arrow doesn't blink (cleared in _renderPlayer
      // when that invincibility lapses).
      this._spawnGrace          = false;

      // Mini kamikaze drones (6th upgrade): plain-data pool + one shared renderer
      this._drones        = [];
      this._droneRespawnT = 0;
      this._droneAngSeed  = 0;
      this._droneGfx      = this.add.graphics();
      this._droneGfx.setDepth(24);
      this._droneGfx.setBlendMode(Phaser.BlendModes.ADD);

      // Combo FX: x50+ sparks
      this._comboSparkEmitter = this.add.particles(0, 0, '_spark', {
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
      this._initDimension();
      this._initDigitalTree();
      this._initCurseFount();
      this._initDataHighways();
      this._initCacheZone();
      this._initGreedZone();
      this._initCore();
      this._initPrism();
      this._initGamepad();
      this._initTouch();      // mobile on-screen controls (no-op on non-touch devices)
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
        // Cheat: grant a full BOSS reward — the 3-pick draft (BOSS_DRAFT_PICKS) plus
        // +1 reroll — exactly as if a boss had just been defeated (spawns paused via
        // _bossDraftPending, like a real boss draft; cleared when the draft closes).
        if (ev.code === 'KeyK' && !ev.repeat) {
          ev.preventDefault();
          if (!self._upgradeDraftOpen && !self._upSlowMoPhase && !self._bossDraftPending &&
              self.p && self.p.state !== 'DEAD' && !self._tutorialActive) {
            self._rerollsAvailable = (self._rerollsAvailable || 0) + 1;   // boss reward: +1 reroll
            self._bossDraftPending = true;                                // suppress spawns during the draft
            self._beginBossUpgradeDraft();
          }
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
        // Cheat: (re)spawn the Unstable Core right next to the player (noyau instable).
        // Once unlocked a core is ALWAYS present (it auto-respawns), so this RELOCATES
        // the dormant one next to you for testing — but never clobbers a LAUNCHED core
        // mid-rampage (mirrors the Prism's KeyV). Also works while still locked.
        if (ev.code === 'KeyC' && !ev.repeat) {
          ev.preventDefault();
          // Relocate a DORMANT core right next to the player for testing (never touch a
          // launched one mid-rampage); make room first so we stay within CORE_MAX.
          if (self._spawnCore && self._cores) {
            for (var _ci = 0; _ci < self._cores.length; _ci++) {
              if (self._cores[_ci].phase === 'DORMANT') { self._cores.splice(_ci, 1); break; }
            }
            self._spawnCore({ near: true });
          }
        }
        // Cheat: force-spawn a Cache Zone near the player (zone de cache — KotH)
        if (ev.code === 'KeyB' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnCacheZone) self._spawnCacheZone({ near: true });
        }
        // Cheat: force-spawn the Signal Amplifier near the player (greed platform —
        // bypasses the "all upgrades maxed" gate, which only blocks NATURAL spawns)
        if (ev.code === 'KeyX' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnGreedZone) self._spawnGreedZone({ near: true });
        }
        // Cheat: relocate the Prism of Refraction next to the player (prisme de
        // réfraction). Only when it's dormant/absent — never clobber a live
        // charge/strike (that would strand the captured ship).
        if (ev.code === 'KeyV' && !ev.repeat) {
          ev.preventDefault();
          // Relocate a DORMANT prism next to the player for testing — never while one
          // holds the ship (that would strand the captured ship). Make room first.
          if (self._spawnPrism && self._prisms && !(self._prismControllingShip && self._prismControllingShip())) {
            for (var _pi = 0; _pi < self._prisms.length; _pi++) {
              if (self._prisms[_pi].phase === 'DORMANT' && !self._prisms[_pi].bonus) { self._prisms.splice(_pi, 1); break; }
            }
            self._spawnPrism({ near: true });
          }
        }
        // Cheat / test: spawn a T4 Sniper ("Œil-scope") at a far, on-screen
        // vantage. It enters CLOAKED (invisible + invincible), then charges +
        // fires a fast laser. (Only spawn path for now — no natural spawns yet.)
        if (ev.code === 'KeyF' && !ev.repeat) {
          ev.preventDefault();
          if (self._spawnSniperAt && self.p && self.enemies.length < C.MAX_ENEMIES) {
            var snA = Math.random() * Math.PI * 2;
            var snD = self._sniperVantageDist ? self._sniperVantageDist() : C.T4_KEEP_DIST;
            var snP = LA.clampDisc(self.p.x + Math.cos(snA) * snD, self.p.y + Math.sin(snA) * snD, C.T4_SIZE * 1.4);
            self._spawnSniperAt(snP.x, snP.y);
          }
        }
        // Cheat: unlock team mode + force the next boss event to be a full TEAM now
        // (tests duplicates, anomaly-zone confinement and the team board-clear).
        if (ev.code === 'KeyR' && !ev.repeat) {
          ev.preventDefault();
          if (self._forceBossTeam) self._forceBossTeam();
        }

      });
      this.input.keyboard.on('keyup', function (ev) {
        self._keys[ev.code] = false;
      });

      this._mouseX = cam.width / 2;
      this._mouseY = cam.height / 2;
      // When the on-screen touch controls are active (mobile), the canvas ignores
      // raw touch pointers — the joystick/buttons own all input (otherwise tapping
      // the play area would aim/attack). Mouse pointers still work (hybrid devices).
      var isTouchPtr = function (ptr) { return self._touchUI && (ptr.pointerType === 'touch' || ptr.wasTouch); };
      this.input.on('pointermove', function (ptr) {
        if (isTouchPtr(ptr)) return;
        self._mouseX = ptr.x; self._mouseY = ptr.y;
        self._inputMode = 'mouse';   // mouse moved → it reclaims aiming from the pad
      });
      this.input.on('pointerdown', function (ptr) {
        if (isTouchPtr(ptr)) return;
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
      // Clear stuck keys on scene resume (upgrade draft / manual pause).
      // this.events survives scene.restart() (see the 'pause' twin above), so keep
      // a ref and tear it down on shutdown — otherwise a fresh handler stacks every
      // restart (unbounded growth + N redundant self._keys={} per resume).
      this.events.on('resume', self._onSceneResume = function () {
        self._keys = {};
        // A button may still be held from the menu tap/press that un-paused us —
        // re-sync the pad baseline so it doesn't fire on this first live frame.
        self._padResync = true;
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
        if (self._destroyTouchUI) self._destroyTouchUI();   // tear down the mobile DOM controls (no stacking across restart)
        self._vignetteSprite = null;
        self._chromaFX = null;
        self._bloomFX = null;
        self._playerGlow = null;   // destroyed with playerSpr; drop the stale ref
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
        if (self._clearBossDeaths)  self._clearBossDeaths();
        if (self._clearDimension)   self._clearDimension();
        if (self._clearDigitalTree) self._clearDigitalTree(true);
        if (self._clearFairy)       self._clearFairy();
        if (self._clearCurseFount)  self._clearCurseFount(true);
        if (self._clearDataHighways) self._clearDataHighways(true);
        if (self._clearCore)        self._clearCore(true);
        if (self._clearPrism)       self._clearPrism(true);
        if (self._clearCacheZone)   self._clearCacheZone(true);
        if (self._clearGreedZone)   self._clearGreedZone();
        if (self._removeBossHintDom) self._removeBossHintDom();
        if (self._clearBossArrow)   self._clearBossArrow();
        self._treeGfx = null; self._treePtrGfx = null; self._fairyGfx = null;
        self._fountDarkGfx = null; self._fountGfx = null; self._fountObGfx = null; self._fountPtrGfx = null;
        self._highwayGfx = null;
        // World border: the mask graphics is created off the display list, so it
        // isn't auto-destroyed on restart — release it explicitly.
        if (self._worldDarkMaskG) { self._worldDarkMaskG.destroy(); self._worldDarkMaskG = null; }
        self._worldDark = null; self._borderGfx = null; self._wallImpacts = null;
        self._motesGfx = null; self._motes = null;
        self._coreGfx = null;   // graphics destroyed with the scene; drop the stale ref
        self._prismGfx = null;  // graphics destroyed with the scene; drop the stale ref
        self._cacheGfx = null; self._cacheTopGfx = null; self._starPtrGfx = null;
        self._cacheStarGhost = null; self._cacheStarFill = null; self._cacheStarMaskGfx = null;
        self._greedGfx = null; self._greedTopGfx = null;
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
        if (self._onSceneResume) {
          self.events.off('resume', self._onSceneResume);
          self._onSceneResume = null;
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

      // Poll the gamepad every frame (analog sticks + edge-triggered buttons).
      // Runs before _inputVec/facing below; its action calls re-use the mouse/
      // keyboard entry points, so their state guards apply unchanged.
      if (this.p && this._pollGamepad) this._pollGamepad();
      if (this.p && this._pollTouch) this._pollTouch();   // mobile on-screen controls (after the pad poll → owns _padMove on touch)

      // Kick off the interactive tutorial once the loader has cleared. The flag
      // is armed by shell.js on first launch, the ? button, or a hardcore→sandbox
      // switch. Checked once per scene lifecycle.
      if (this._loaderRemoved && !this._tutArmChecked) {
        this._tutArmChecked = true;
        if (window.__laStartTutorialOnReady) {
          window.__laStartTutorialOnReady = false;
          this._startTutorial();
        } else if (this._beginSpawnIntro) {
          // No tutorial this run → launch a real game with the spawn flourish +
          // welcome draft (the tutorial path triggers it on exit instead). Defer it
          // until the loader has fully faded so the flourish isn't hidden behind it,
          // and so a brief beat of the EMPTY arena shows before the arrow spawns in.
          this._awaitingSpawnIntro = true;
          this._bossDraftPending   = true;   // keep the arena empty during the pre-spawn beat
          var selfSI = this;
          this.time.delayedCall(C.SPAWN_INTRO_START_DELAY_MS, function () {
            selfSI._awaitingSpawnIntro = false;
            if (selfSI._tutorialActive) return;   // a tutorial pre-empted it → draft runs on tutorial exit
            selfSI._beginSpawnIntro();
          });
        }
      }

      // Upgrade slow-mo transition (runs on real dt, not scaled)
      this._updateUpgradeSlowMo(dt);

      // Boss power-up flourish decays on real time (a cosmetic surge before the draft)
      if (this._powerUpT > 0) this._powerUpT = Math.max(0, this._powerUpT - dt);
      // Run-start spawn flourish decays the same way (the arrow materialising in).
      if (this._spawnIntroT > 0) this._spawnIntroT = Math.max(0, this._spawnIntroT - dt);

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

      // Anomaly intro / dimension PORTAL cinematics: freeze BOTH the world AND the
      // player (each is driven on real time inside its own branch below).
      if (this._anomalyIntroActive || this._dimPortalActive) {
        sDt = 0; s60 = 0; ms  = 0;
        pDt = 0; pS60 = 0; pMs = 0;
      }

      // Pre-spawn beat: the arrow hasn't materialised yet — freeze just the PLAYER
      // (it's hidden) so the camera stays centred on the empty spawn point, while
      // the WORLD keeps running so the arena reads as alive (and empty). A tutorial
      // launched in this window takes over, so don't freeze then.
      if (this._awaitingSpawnIntro && !this._tutorialActive) { pDt = 0; pS60 = 0; pMs = 0; }

      this._fpsCounter = (this._fpsCounter || 0) + 1;
      if (this._fpsCounter >= 15) {
        this._fpsCounter = 0;
        var fps = Math.round(this.game.loop.actualFps);
        if (fps !== this._lastFps) {
          this._lastFps = fps;
          this.fpsTxt.setText(fps + ' FPS');
        }
        // Colours go through _setHudColor: it pre-compensates for the fractured
        // dimension's camera grade so these top-left counters KEEP their normal
        // colours there, and it caches the final string so setColor only fires on
        // an actual change (no per-frame re-rasterise).
        this._setHudColor(this.fpsTxt, fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444', '_fpsColC');
        // Live enemy count — colour bands scaled to C.MAX_ENEMIES:
        // ≤ 40 % blue, 40–75 % amber, > 75 % red.
        var ec = this.enemies.length;
        if (ec !== this._lastEnemyCount) {
          this._lastEnemyCount = ec;
          this._enemyCountTxt.setText('▲ ' + ec);
        }
        var ecMax = C.MAX_ENEMIES;
        this._setHudColor(this._enemyCountTxt, ec > ecMax * 0.75 ? '#ff4444' : ec > ecMax * 0.40 ? '#ffcc00' : '#3a78a0', '_ecColC');
        // Survival time (real elapsed play time)
        var ts = Math.floor(this.gameTime);
        if (ts !== this._lastTimeSec) {
          this._lastTimeSec = ts;
          var mm = Math.floor(ts / 60), ss = ts % 60;
          this._timeTxt.setText((mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss);
        }
        this._setHudColor(this._timeTxt, '#3a78a0', '_timeColC');
      }

      if (ms < 0.001 && pMs < 0.001 && !this._anomalyIntroActive && !this._dimPortalActive) {
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

      // Dimension PORTAL cinematic: the world is frozen while the vortex sweeps the
      // board, engulfs the player and carries the run into the altered dimension
      // (which it then enters + spawns the first team). Driven on REAL dt.
      if (this._dimPortalActive) {
        this._decayGhosts(dt);
        this._updateDimPortal(dt);
        this._updateWaveRings(dt);
        this._updateDimension(dt);
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
      // While the Prism of Refraction holds the ship (CHARGING) or hurls it as the
      // 3-arrow strike (STRIKE), prism.js owns the ship's position outright. Skip the
      // normal accel/friction/integration + Highway conveyor + wall clamp so they
      // can't fight the captured hold or the strike path (prism.js clamps to the disc).
      var prismCtl = this._prismControllingShip ? this._prismControllingShip() : false;
      if (!prismCtl) {
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
      // Inline radial clamp (identical to LA.clampDisc) — avoids a per-frame result-object allocation.
      var wcLim = C.WORLD_HALF - C.SIZE * 1.5; if (wcLim < 0) wcLim = 0;
      var wcD = Math.sqrt(p.x * p.x + p.y * p.y);
      if (wcD > wcLim && wcD !== 0) {
        var wcInv = 1 / wcD;
        var wcNx = p.x * wcInv, wcNy = p.y * wcInv;
        p.x = wcNx * wcLim; p.y = wcNy * wcLim;
        this._applyAggressiveRebound(wcNx, wcNy);   // bounce off the map rim
      }
      }  // end if (!prismCtl) — prism.js drove the ship this frame

      // Anomaly quarantine: trap the player inside the firewall (it bounces the
      // ship off the rim just like the map wall). Skipped during a Prism strike —
      // prism.js reflects the bolt off the firewall itself.
      if (!prismCtl) this._confinePlayerToBarrier();

      if (p.state === 'DASHING') {
        p.dashTimer -= pMs;
        if (p.vx * p.vx + p.vy * p.vy > 4) {
          this._addGhost(p.x, p.y, 0.55, p.angle, false);
        }
        if (p.dashTimer <= 0) {
          var dashUpLvl = (this._upgradeLevels && this._upgradeLevels.dash) || 0;
          p.state = 'MOVING'; p.dashCooldown = C.DASH_CD * (dashUpLvl >= 1 ? 0.70 : 1.0) * (this._dashCdMult || 1);
          p.invincible = true; p.invincTimer = 220 + (this._dashIframeBonus || 0); p.dashInvinc = true;   // dashRage curse adds i-frames
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
      } else if (this._padAimActive) {
        // Gamepad right stick deflected → face it, even while moving. This is the
        // twin-stick aim, intentionally unlike the keyboard/mouse "movement = facing".
        p.angle = Math.atan2(this._padAim.dy, this._padAim.dx);
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
      // Anomaly is single-slot (cap 1) and carries the boss-spawn / team gate.
      this._updateAnomaly(ms, pMs, dt);
      this._checkAnomalyCollision();
      // The other bosses can arrive in TEAMS (duplicates allowed). Iterate each
      // type's live list, pointing the cursor (this._X) at the instance being
      // processed. Snapshot the list since a boss can leave it mid-update (death).
      var _gl = (this._gigaList && this._gigaList.length) ? this._gigaList.slice() : null;
      if (_gl) for (var _gi = 0; _gi < _gl.length; _gi++) { this._gigaBruiser = _gl[_gi]; this._updateGigaBruiser(ms, pMs, dt); this._checkGigaBruiserCollision(); }
      this._gigaBruiser = (this._gigaList && this._gigaList.length) ? this._gigaList[0] : null;
      var _ml = (this._mirrorList && this._mirrorList.length) ? this._mirrorList.slice() : null;
      if (_ml) for (var _mi = 0; _mi < _ml.length; _mi++) { this._mirror = _ml[_mi]; this._updateMirror(ms, pMs, dt); this._checkMirrorCollision(); }
      this._mirror = (this._mirrorList && this._mirrorList.length) ? this._mirrorList[0] : null;
      var _sl = (this._snakeList && this._snakeList.length) ? this._snakeList.slice() : null;
      if (_sl) for (var _si = 0; _si < _sl.length; _si++) { this._snake = _sl[_si]; this._updateSnake(ms, pMs, dt); this._checkSnakeCollision(); }
      this._snake = (this._snakeList && this._snakeList.length) ? this._snakeList[0] : null;
      // Any boss sharing the arena with a live Anomaly stays inside its firewall.
      this._confineBossesToAnomaly();
      this._updateBossArrow(dt);  // persistent guidance chevron toward the active boss
      this._updateBossHint(dt);   // sandbox: first-encounter boss weakness tooltip (real dt)
      this._updateDigitalTree(dt);
      this._updateCurseFount(dt);
      // Highway visual/lifecycle: ease into slow-mo during The World (it normally
      // animates on real dt, so without this it would keep flowing at full speed
      // while everything else is frozen). Spawns are already suspended during TW.
      this._updateDataHighways(this._twActive ? dt * C.HIGHWAY_TW_VISUAL_SCALE : dt);
      this._updateCacheZone(dt, ms);   // ms = scaled world time → the hack gauge pauses during The World / hitstop
      this._updateGreedZone(dt, ms);   // ms = scaled world time → the ×2 + beacon pause during The World / hitstop
      this._updateCore(dt, sDt);
      this._updatePrism(dt, sDt);
      this._updateTutorial(dt);

      // Overdrive countdown — drives the HUD bar, the low-time blink AND the end,
      // all off the one timer (so they stay in sync and a pickup can ADD time
      // mid-Overdrive instead of resetting; see _activateStarPower). Player time,
      // so The World doesn't pause the bar.
      if (this.isStarPowered) {
        this._starPowerTimer -= pMs;
        if (!this._starPowerWarning && this._starPowerTimer <= C.STAR_WARN_REMAIN) this._starPowerWarning = true;
        if (this._starPowerTimer <= 0) { this._starPowerTimer = 0; this._starPowerExpireFx(); this._deactivateStarPower(); }
      }

      // Natural spawns pause while the anomaly's quarantine barrier is up, and
      // during the tutorial (which curates its own lesson environments) — except
      // the final sandbox step, where the real wheel-paced spawner is the lesson.
      if (this.spawnTimer > -999000 && !this._anomalyBarrierActive && !this._bossDraftPending && !this._dimPortalActive && (!this._tutorialActive || this._tutSandboxStep)) {
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

      // Clear Board shockwave + boss death-retract anims + sandbox speed slider
      // (all run on real time so they stay smooth through hitstop / The World).
      this._updateClearWave(dt);
      this._updateBossDeaths(dt);
      this._updateDimension(dt);   // fractured-dimension rifts + palette drift (real dt, visual)
      this._updateSpawnRamp(dt);   // ease the hardcore wave-size ramp toward its boss-count target
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
      if (this.pcbDeep) {   // slower scroll → parallax depth between circuit layers
        this.pcbDeep.tilePositionX = cam.scrollX * 0.55;
        this.pcbDeep.tilePositionY = cam.scrollY * 0.55;
      }

      // --- Glow pulse (bioluminescence) — also brightens with the combo so the
      //     whole circuit "electrifies" as you chain kills. ---
      var t = this.gameTime;
      var glowBoost = 1 + Math.min(0.6, (this.comboMultiplier - 1) / 40);
      // Floor at 0.06 so glow never fully disappears — max ~0.34 (×boost at high combo)
      var glowAlpha = Math.max(0.06,
        0.22 + 0.16 * Math.sin(t * 0.40) +   // main ~15.7s period
        0.06 * Math.sin(t * 1.05) +           // secondary ~6s period
        0.03 * Math.sin(t * 2.30)             // micro variation ~2.7s
      ) * 0.72 * glowBoost;
      this.pcbGlow.setAlpha(glowAlpha);
      this.pcbGlow.tilePositionX = cam.scrollX;
      this.pcbGlow.tilePositionY = cam.scrollY;

      // Aurora drift — deep parallax + slow autonomous motion, breathing alpha
      if (this._nebulaTile) {
        this._nebulaTile.tilePositionX = cam.scrollX * 0.35 + t * 2.0;
        this._nebulaTile.tilePositionY = cam.scrollY * 0.35 - t * 1.2;
        this._nebulaTile.setAlpha(0.055 + 0.025 * Math.sin(t * 0.23) + 0.012 * Math.sin(t * 0.71));
      }

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
        // During The World the combo is frozen, so freeze the pulse too: hold a
        // steady darkening (base alpha, no sine blink) so the map edges don't
        // flicker to the combo beat while time is stopped.
        var vigA = this._twActive ? vigBase : (vigBase + vigAmp * Math.sin(this.gameTime * vigFreq * Math.PI * 2));
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
      this._updateMotes(dt);
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

  /* Top-left HUD colour setter: pre-compensates the colour for the fractured
     dimension's camera grade (via _dimUntint, identity outside it) so the FPS /
     enemy / time counters keep their normal colours there, and caches the final
     string per text so setColor (a texture re-rasterise) only fires on a real
     change — including the one-off fractured-state transition. */
  LA.sceneMethods._setHudColor = function (txt, hex, cacheKey) {
    var out = hex;
    if (this._dimFloorTexOn && this._dimUntint) {
      var num = parseInt(hex.slice(1), 16);
      var comp = this._dimUntint(num);
      out = '#' + ('000000' + comp.toString(16)).slice(-6);
    }
    if (this[cacheKey] === out) return;
    this[cacheKey] = out;
    txt.setColor(out);
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
            render: {
              powerPreference: 'high-performance',
              // Antialias is OFF by default (fill-rate-bound ADD-blend game — the
              // per-frame MSAA resolve costs more than the smooth edges are worth,
              // biggest win on weak/integrated/mobile GPUs). The player can re-enable
              // it via the "Anticrénelage" toggle (menu + game-over); that only sets
              // localStorage, so it's read HERE at WebGL-context creation and takes
              // effect on the next game launch (reopen). Trade-off: slightly jaggier edges.
              antialias: (function () { try { return localStorage.getItem('la_antialias') === '1'; } catch (e) { return false; } })(),
            },
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
