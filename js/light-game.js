/* ==========================================================================
   Light Again — Phaser 3 (WebGL) Game Engine
   Factory: window.createLightGame(parentEl) -> { start, stop, pause, resume }
   ========================================================================== */

(function () {
  'use strict';

  /* ================================================================
     PALETTE — theme-aware, cached
     ================================================================ */

  var _colorCache = null;
  var _colorTheme = '';

  function getColors() {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    if (theme === _colorTheme) return _colorCache;
    _colorTheme = theme;
    if (theme === 'dark') _colorCache = {
      cyan:   0x00ffff,  cyanArr:   [0,255,255],
      yellow: 0xffdc3c,  yellowArr: [255,220,60],
      ghostVioletArr: [160,0,255],
      pcbTrace: 0x643cdc, pcbTraceA: 0.22,
      pcbVia:   0x8c50ff, pcbViaA:   0.30,
      bgColor:  0x04040d,
    };
    else if (theme === 'nature') _colorCache = {
      cyan:   0x50ffc8,  cyanArr: [80,255,200],
      yellow: 0xdcf050,  yellowArr: [220,240,80],
      ghostVioletArr: [60,120,200],
      pcbTrace: 0x1e7850, pcbTraceA: 0.22,
      pcbVia:   0x32b464, pcbViaA:   0.30,
      bgColor:  0x030801,
    };
    else _colorCache = {
      cyan:   0x00ffff,  cyanArr: [0,255,255],
      yellow: 0xffdc3c,  yellowArr: [255,220,60],
      ghostVioletArr: [160,0,255],
      pcbTrace: 0x00508c, pcbTraceA: 0.22,
      pcbVia:   0x00b4dc, pcbViaA:   0.30,
      bgColor:  0x08080f,
    };
    return _colorCache;
  }

  /* ================================================================
     CONSTANTS
     ================================================================ */

  var ACCEL       = 0.7;
  var FRICTION    = 0.92;
  var SIZE        = 20;
  var DASH_IMP    = 28;
  var DASH_DUR    = 120;
  var DASH_CD     = 1200;
  var ATK_IMP     = 18;
  var ATK_DUR     = 280;
  var ATK_CD      = 0;
  var ATK_SPIN    = 28;
  var DASH_ATK_IMP  = 30;
  var DASH_ATK_DUR  = 300;
  var DASH_ATK_SPIN = 50;
  var RECOVERY_DUR      = 180;
  var RECOVERY_FRIC     = 0.80;
  var ATK_WHIFF_DUR     = 220;
  var DASHATK_WHIFF_DUR  = 380;
  var DASHATK_WHIFF_FRIC = 0.70;
  var DASHATK_CHAIN_EXT  = 40;
  var DASHATK_MAX_EXT    = 180;
  var HITSTOP_DUR        = 40;
  var HITSTOP_MAX        = 80;
  var DETONATION_HITSTOP = 120;
  var IFRAMES_DUR   = 800;
  var SPAWN_INTERVAL  = 3500;
  var SPAWN_DIST      = 650;
  var MAX_ENEMIES     = 200;
  var WAVE_BASE       = 4;
  var WAVE_SCALE      = 0.06;
  var WAVE_MAX        = 20;
  var SEPARATION_RADIUS = 30;
  var SEPARATION_FORCE  = 4.0;
  var REBOUND_IMP       = 14;
  var SHOCKWAVE_RADIUS  = 110;
  var SHOCKWAVE_FORCE   = 14;
  var SHOCKWAVE_STUN    = 300;
  var LANDING_BURST_RADIUS = 180;
  var LANDING_BURST_FORCE  = 28;
  var LANDING_BURST_STUN   = 500;
  var DASH_MARK_RADIUS     = 30;
  var CAM_LERP    = 0.10;
  var WORLD_HALF  = 4000;
  var PCB_TILE    = 256;
  var RUSHER_SPEED = 3.0;
  var RUSHER_SIZE  = 14;

  /* ================================================================
     TEXTURE GENERATORS
     ================================================================ */

  function _drawArrowPath(g2, ox, oy, s) {
    g2.beginPath();
    g2.moveTo(ox + s,          oy);
    g2.lineTo(ox - s * 0.6,   oy - s * 0.55);
    g2.lineTo(ox - s * 0.25,  oy);
    g2.lineTo(ox - s * 0.6,   oy + s * 0.55);
    g2.closePath();
  }

  function _buildArrowTex(tm, key, r, g, b, s, blur, isDashAtk) {
    if (tm.exists(key)) tm.remove(key);
    var pad = blur + 4;
    var W = Math.ceil(s * 2.2 + pad * 2);
    var H = Math.ceil(s * 1.2 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    if (isDashAtk) {
      g2.save();
      g2.globalCompositeOperation = 'lighter';
      g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.7)';
      g2.shadowBlur = 52;
      _drawArrowPath(g2, ox, oy, s);
      g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.04)';
      g2.fill();
      g2.shadowBlur = 0;
      g2.restore();
    }

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.9)';
    g2.shadowBlur = blur;
    _drawArrowPath(g2, ox, oy, s);
    g2.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.35)';
    g2.fill();
    g2.shadowBlur = 0;
    g2.restore();

    _drawArrowPath(g2, ox, oy, s);
    g2.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    g2.fill();

    tm.addCanvas(key, oc);
  }

  function _buildEnemyTex(tm, key) {
    if (tm.exists(key)) tm.remove(key);
    var size = RUSHER_SIZE;
    var gs = size * 1.6, pad = 4;
    var W = Math.ceil(gs * 2 + pad * 2);
    var H = Math.ceil(gs * 0.5 + pad * 2);
    var oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    var g2 = oc.getContext('2d');
    var ox = W / 2, oy = H / 2;

    g2.save();
    g2.globalCompositeOperation = 'lighter';
    g2.beginPath();
    g2.moveTo(ox + gs, oy);
    g2.lineTo(ox - gs * 0.5, oy - gs * 0.22);
    g2.lineTo(ox - gs * 0.5, oy + gs * 0.22);
    g2.closePath();
    g2.fillStyle = 'rgba(255,0,68,0.18)';
    g2.fill();
    g2.restore();

    g2.beginPath();
    g2.moveTo(ox + size, oy);
    g2.lineTo(ox - size * 0.5, oy - size * 0.18);
    g2.lineTo(ox - size * 0.5, oy + size * 0.18);
    g2.closePath();
    g2.fillStyle = '#FF0044';
    g2.fill();

    tm.addCanvas(key, oc);
  }

  function _buildPCBTex(tm, key, colors) {
    if (tm.exists(key)) tm.remove(key);
    var S = PCB_TILE;
    var oc = document.createElement('canvas');
    oc.width = S; oc.height = S;
    var g = oc.getContext('2d');

    var tr = (colors.pcbTrace >> 16) & 0xff;
    var tg = (colors.pcbTrace >> 8) & 0xff;
    var tb = colors.pcbTrace & 0xff;
    var traceCol = 'rgba(' + tr + ',' + tg + ',' + tb + ',' + colors.pcbTraceA + ')';
    var vr = (colors.pcbVia >> 16) & 0xff;
    var vg = (colors.pcbVia >> 8) & 0xff;
    var vb = colors.pcbVia & 0xff;
    var viaCol = 'rgba(' + vr + ',' + vg + ',' + vb + ',' + colors.pcbViaA + ')';

    g.strokeStyle = traceCol; g.lineWidth = 1.0; g.lineCap = 'square';
    g.beginPath();
    g.moveTo(0,S*0.22); g.lineTo(S*0.61,S*0.22);
    g.moveTo(S*0.68,S*0.22); g.lineTo(S,S*0.22);
    g.moveTo(0,S*0.71); g.lineTo(S*0.38,S*0.71);
    g.moveTo(S*0.45,S*0.71); g.lineTo(S,S*0.71);
    g.moveTo(S*0.18,0); g.lineTo(S*0.18,S*0.55);
    g.moveTo(S*0.18,S*0.62); g.lineTo(S*0.18,S);
    g.moveTo(S*0.77,0); g.lineTo(S*0.77,S*0.34);
    g.moveTo(S*0.77,S*0.41); g.lineTo(S*0.77,S);
    g.stroke();

    g.lineWidth = 0.55; g.beginPath();
    g.moveTo(S*0.18,S*0.44); g.lineTo(S*0.52,S*0.44);
    g.moveTo(S*0.52,S*0.55); g.lineTo(S*0.77,S*0.55);
    g.moveTo(0,S*0.88); g.lineTo(S*0.40,S*0.88);
    g.moveTo(S*0.60,S*0.10); g.lineTo(S,S*0.10);
    g.moveTo(S*0.38,S*0.22); g.lineTo(S*0.38,S*0.71);
    g.moveTo(S*0.61,0); g.lineTo(S*0.61,S*0.22);
    g.moveTo(S*0.52,S*0.44); g.lineTo(S*0.52,S*0.55);
    g.moveTo(S*0.88,S*0.71); g.lineTo(S*0.88,S);
    g.moveTo(S*0.18,S*0.55); g.lineTo(S*0.18,S*0.62);
    g.moveTo(S*0.77,S*0.34); g.lineTo(S*0.61,S*0.34);
    g.moveTo(S*0.61,S*0.22); g.lineTo(S*0.61,S*0.34);
    g.moveTo(S*0.38,S*0.71); g.lineTo(S*0.38,S*0.88);
    g.stroke();

    g.lineWidth = 0.6; g.beginPath();
    g.moveTo(S*0.18,S*0.44); g.lineTo(S*0.08,S*0.34);
    g.moveTo(S*0.08,S*0.34); g.lineTo(S*0.08,S*0.22);
    g.moveTo(S*0.38,S*0.44); g.lineTo(S*0.52,S*0.44);
    g.moveTo(S*0.77,S*0.55); g.lineTo(S*0.88,S*0.44);
    g.moveTo(S*0.88,S*0.44); g.lineTo(S*0.88,S*0.22);
    g.moveTo(S*0.40,S*0.88); g.lineTo(S*0.52,S*0.76);
    g.moveTo(S*0.52,S*0.76); g.lineTo(S*0.60,S*0.76);
    g.moveTo(S*0.61,S*0.34); g.lineTo(S*0.68,S*0.27);
    g.moveTo(S*0.68,S*0.27); g.lineTo(S*0.77,S*0.27);
    g.stroke();

    var vias = [
      [0.18,0.22,2.2],[0.38,0.22,1.6],[0.61,0.22,2.0],[0.77,0.22,1.4],
      [0.88,0.22,1.6],[0.08,0.22,1.4],[0.18,0.44,1.8],[0.38,0.44,1.4],
      [0.52,0.44,1.8],[0.18,0.71,2.0],[0.38,0.71,1.6],[0.77,0.55,1.4],
      [0.88,0.71,1.6],[0.38,0.88,1.8],[0.52,0.76,1.4],[0.61,0.34,1.8],
      [0.77,0.27,1.4],[0.88,0.44,1.6],[0.08,0.34,1.2],
    ];
    g.fillStyle = viaCol;
    for (var vi = 0; vi < vias.length; vi++) {
      g.beginPath();
      g.arc(S * vias[vi][0], S * vias[vi][1], vias[vi][2], 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(5,5,16,0.85)';
    var drills = [[0.18,0.22,1.0],[0.61,0.22,0.9],[0.18,0.71,0.9],[0.52,0.44,0.8],[0.38,0.88,0.8]];
    for (var di = 0; di < drills.length; di++) {
      g.beginPath();
      g.arc(S*drills[di][0], S*drills[di][1], drills[di][2], 0, Math.PI*2);
      g.fill();
    }
    g.strokeStyle = traceCol; g.lineWidth = 0.7;
    g.strokeRect(S*0.42,S*0.57,S*0.20,S*0.10);
    var pins = [0.44,0.47,0.50,0.53,0.56];
    g.lineWidth = 0.5;
    for (var pi = 0; pi < pins.length; pi++) {
      g.beginPath();
      g.moveTo(S*pins[pi],S*0.57); g.lineTo(S*pins[pi],S*0.55);
      g.moveTo(S*pins[pi],S*0.67); g.lineTo(S*pins[pi],S*0.69);
      g.stroke();
    }
    g.lineWidth = 0.6; g.strokeStyle = viaCol;
    g.strokeRect(S*0.06,S*0.42,S*0.06,S*0.04);
    g.strokeRect(S*0.70,S*0.58,S*0.04,S*0.06);

    tm.addCanvas(key, oc);
  }

  function _buildPixelTex(tm, key) {
    if (tm.exists(key)) return;
    var oc = document.createElement('canvas');
    oc.width = 8; oc.height = 8;
    var g2 = oc.getContext('2d');
    g2.fillStyle = '#ffffff';
    g2.fillRect(0, 0, 8, 8);
    tm.addCanvas(key, oc);
  }

  /* ================================================================
     PHASER SCENE
     ================================================================ */

  var GameScene = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function GameScene() {
      Phaser.Scene.call(this, { key: 'GameScene' });
    },

    create: function () {
      var self = this;
      this._texTheme = '';
      this._genTextures();

      var cam = this.cameras.main;
      this.pcbTile = this.add.tileSprite(0, 0, cam.width, cam.height, '_pcb');
      this.pcbTile.setOrigin(0, 0);
      this.pcbTile.setScrollFactor(0);
      this.pcbTile.setDepth(-10);

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
        hp: 5, invincible: false, invincTimer: 0,
      };

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

      _buildPixelTex(this.textures, '_pxl');

      // Emitter principal pour les explosions ennemies (overkill WebGL)
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

      // Second emitter — éclats secondaires plus doux
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

      // Pool de cercles pour l'onde de choc de fin de dash
      this._waveRings = [];
      for (var wi = 0; wi < 4; wi++) {
        var wg = this.add.graphics();
        wg.setDepth(35);
        wg.setVisible(false);
        this._waveRings.push({ gfx: wg, x: 0, y: 0, r: 0, alpha: 0, active: false });
      }
      this._waveRingW = 0;

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

      cam.setBackgroundColor(getColors().bgColor);

      // Bloom PostFX — néons qui bavent sans aveugler
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
        if (ev.code === 'KeyP' && !ev.repeat) self._spawnRusher();
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
        if (ptr.leftButtonDown())  self._tryAttack();
        if (ptr.rightButtonDown()) self._tryDash();
      });

      this.game.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },

    _genTextures: function () {
      var c = getColors();
      var tm = this.textures;
      this._texTheme = document.documentElement.getAttribute('data-theme') || 'light';

      var ca = c.cyanArr;
      _buildArrowTex(tm, '_ar_cyan',  ca[0], ca[1], ca[2], SIZE, 18, false);
      var ya = c.yellowArr;
      _buildArrowTex(tm, '_ar_yel',   ya[0], ya[1], ya[2], SIZE, 18, false);
      _buildArrowTex(tm, '_ar_atk',   255, 30, 60,  SIZE, 18, false);
      _buildArrowTex(tm, '_ar_datk',  255, 20, 200, SIZE * 1.35, 28, true);
      var va = c.ghostVioletArr;
      _buildArrowTex(tm, '_ar_dash',  va[0], va[1], va[2], SIZE, 18, false);
      _buildArrowTex(tm, '_ar_whiff', 80,  80,  90, SIZE, 4, false);

      _buildEnemyTex(tm, '_enemy');
      _buildPCBTex(tm, '_pcb', c);
    },

    _checkTheme: function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'light';
      if (cur === this._texTheme) return;
      _colorTheme = '';
      this._genTextures();
      this.cameras.main.setBackgroundColor(getColors().bgColor);
      if (this.pcbTile) this.pcbTile.setTexture('_pcb');
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        e.spr.setTexture('_enemy');
        for (var j = 0; j < e.trSpr.length; j++) e.trSpr[j].setTexture('_enemy');
      }
    },

    _pTexKey: function () {
      var p = this.p;
      if (p.state === 'DASH_ATTACKING') return '_ar_datk';
      if (p.state === 'ATTACKING')      return '_ar_atk';
      if (p.state === 'DASHING')        return '_ar_dash';
      if (p.state === 'RECOVERY' && p.recoveryWhiff) return '_ar_whiff';
      return p.dashAvailable ? '_ar_cyan' : '_ar_yel';
    },

    _inputVec: function () {
      var dx = 0, dy = 0, k = this._keys;
      if (k['ArrowUp']    || k['KeyW'] || k['KeyZ']) dy -= 1;
      if (k['ArrowDown']  || k['KeyS'])              dy += 1;
      if (k['ArrowLeft']  || k['KeyA'] || k['KeyQ']) dx -= 1;
      if (k['ArrowRight'] || k['KeyD'])               dx += 1;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) { dx /= len; dy /= len; }
      return { dx: dx, dy: dy };
    },

    _tryDash: function () {
      var p = this.p;
      if (!p.dashAvailable || p.state !== 'MOVING') return;
      var inp = this._inputVec();
      var dx = inp.dx, dy = inp.dy;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        dx = Math.cos(p.angle); dy = Math.sin(p.angle);
      }
      p.vx += dx * DASH_IMP;
      p.vy += dy * DASH_IMP;
      p.state = 'DASHING';
      p.dashAvailable = false;
      p.dashTimer = DASH_DUR;
      p.dashCooldown = 0;
      p.dashDx = dx; p.dashDy = dy;
      p.dashHitCount = 0;
    },

    _tryAttack: function () {
      var p = this.p;
      if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') return;
      if (p.state === 'RECOVERY') return;
      if (p.state === 'DASHING') { this._triggerDashAtk(); return; }

      var cam = this.cameras.main;
      var wmx = this._mouseX + cam.scrollX;
      var wmy = this._mouseY + cam.scrollY;
      var adx = wmx - p.x, ady = wmy - p.y;
      var al = Math.sqrt(adx * adx + ady * ady);
      if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
      else { adx /= al; ady /= al; }

      p.vx += adx * ATK_IMP; p.vy += ady * ATK_IMP;
      p.state = 'ATTACKING'; p.atkAvailable = false;
      p.atkTimer = ATK_DUR; p.atkCooldown = 0;
      p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
    },

    _triggerDashAtk: function () {
      var p = this.p;
      var cam = this.cameras.main;
      var wmx = this._mouseX + cam.scrollX;
      var wmy = this._mouseY + cam.scrollY;
      var adx = wmx - p.x, ady = wmy - p.y;
      var al = Math.sqrt(adx * adx + ady * ady);
      if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
      else { adx /= al; ady /= al; }

      p.vx = adx * DASH_ATK_IMP; p.vy = ady * DASH_ATK_IMP;
      p.state = 'DASH_ATTACKING'; p.atkAvailable = false;
      p.atkTimer = DASH_ATK_DUR; p.atkCooldown = 0;
      p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
      p.hasHitDuringDashAttack = false; p.dashAtkExtended = 0;
      p.dashTimer = 0; p.dashCooldown = DASH_CD;
    },

    _spawnRusher: function () {
      if (this.enemies.length >= MAX_ENEMIES) return;
      var ang = Math.random() * Math.PI * 2;
      this._spawnRusherAt(
        this.p.x + Math.cos(ang) * SPAWN_DIST,
        this.p.y + Math.sin(ang) * SPAWN_DIST
      );
    },

    _spawnWave: function () {
      var count = Math.min(
        Math.round(WAVE_BASE + this.enemies.length * WAVE_SCALE),
        WAVE_MAX
      );
      var slots = MAX_ENEMIES - this.enemies.length;
      if (slots <= 0) return;
      count = Math.min(count, slots);

      // Répartit les ennemis en arc autour du joueur pour former une vague
      var baseAng = Math.random() * Math.PI * 2;
      var spread  = (count > 1) ? (Math.PI * 0.9) : 0;
      for (var i = 0; i < count; i++) {
        var t   = count > 1 ? i / (count - 1) : 0.5;
        var ang = baseAng + (t - 0.5) * spread + (Math.random() - 0.5) * 0.3;
        var dist = SPAWN_DIST + Math.random() * 120;
        this._spawnRusherAt(
          this.p.x + Math.cos(ang) * dist,
          this.p.y + Math.sin(ang) * dist
        );
      }
    },

    _spawnRusherAt: function (ex, ey) {
      var spr = this.add.image(ex, ey, '_enemy');
      spr.setBlendMode(Phaser.BlendModes.ADD);
      spr.setDepth(20);

      var trSpr = [], trData = [];
      for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
        var ts = this.add.image(ex, ey, '_enemy');
        ts.setBlendMode(Phaser.BlendModes.ADD);
        ts.setDepth(15); ts.setVisible(false);
        trSpr.push(ts);
        trData.push({ x: ex, y: ey, angle: 0 });
      }

      this.enemies.push({
        spr: spr, x: ex, y: ey, vx: 0, vy: 0,
        angle: 0, hp: 1, size: RUSHER_SIZE,
        speed: RUSHER_SPEED + Math.random() * 0.8,
        stunTimer: 0, isMarked: false, markTimer: 0,
        trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
      });
    },

    _addGhost: function (x, y, alpha, angle, isDashAtk) {
      var g = this._ghosts[this._ghostW];
      g.active = true; g.alpha = alpha;
      g.spr.setPosition(x, y);
      g.spr.setRotation(angle);
      g.spr.setAlpha(alpha * 0.6);
      g.spr.setTexture(isDashAtk ? '_ar_datk' : '_ar_dash');
      g.spr.setVisible(true);
      this._ghostW = (this._ghostW + 1) % this.MAX_GHOSTS;
    },

    _decayGhosts: function (dt) {
      for (var i = 0; i < this.MAX_GHOSTS; i++) {
        var g = this._ghosts[i];
        if (!g.active) continue;
        g.alpha -= dt * 3.5;
        if (g.alpha <= 0) { g.active = false; g.spr.setVisible(false); }
        else g.spr.setAlpha(g.alpha * 0.6);
      }
    },

    _explode: function (x, y, color, n) {
      var tint = Phaser.Display.Color.GetColor(color[0], color[1], color[2]);
      this._emitter.setPosition(x, y);
      this._emitter.setParticleTint(tint);
      this._emitter.explode(n || 25);
      this._emitter2.setPosition(x, y);
      this._emitter2.setParticleTint(tint);
      this._emitter2.explode(Math.round((n || 25) * 0.5));
    },

    _killEnemy: function (idx) {
      var e = this.enemies[idx];
      var ex = e.x, ey = e.y;

      // Explosion overkill — gerbe principale rouge/orange
      var cnt = Math.round(30 + (e.size / RUSHER_SIZE) * 20);
      cnt = Math.min(cnt, 50);
      this._explode(ex, ey, [255, 30, 60], cnt);
      // Halo rose — éclats secondaires
      this._explode(ex, ey, [255, 160, 80], Math.round(cnt * 0.5));
      // Flash blanc central
      this._explode(ex, ey, [255, 255, 220], Math.round(cnt * 0.25));

      e.spr.destroy();
      for (var t = 0; t < e.trSpr.length; t++) e.trSpr[t].destroy();
      this.enemies.splice(idx, 1);

      this._triggerHitstop(HITSTOP_DUR);
      this.cameras.main.shake(60, 0.005);

      for (var k = 0; k < this.enemies.length; k++) {
        var o = this.enemies[k];
        var sdx = o.x - ex, sdy = o.y - ey;
        var sd = Math.sqrt(sdx * sdx + sdy * sdy);
        if (sd < SHOCKWAVE_RADIUS) {
          var f = 1.0 - sd / SHOCKWAVE_RADIUS;
          var nx = sd > 0.1 ? sdx / sd : Math.random() - 0.5;
          var ny = sd > 0.1 ? sdy / sd : Math.random() - 0.5;
          o.vx += nx * SHOCKWAVE_FORCE * f;
          o.vy += ny * SHOCKWAVE_FORCE * f;
          o.stunTimer = SHOCKWAVE_STUN * f;
        }
      }
    },

    _triggerDetonation: function (markedIdx) {
      var e = this.enemies[markedIdx];
      var ex = e.x, ey = e.y;

      this._killEnemy(markedIdx);

      // Destroy all remaining enemies with explosion on each
      for (var i = this.enemies.length - 1; i >= 0; i--) {
        var o = this.enemies[i];
        this._explode(o.x, o.y, [0, 255, 255], 20);
        this._explode(o.x, o.y, [255, 255, 255], 8);
        o.spr.destroy();
        for (var t = 0; t < o.trSpr.length; t++) o.trSpr[t].destroy();
      }
      this.enemies.length = 0;

      this.cameras.main.flash(350, 200, 255, 255, false);
      this.cameras.main.shake(200, 0.018);
      this._triggerHitstop(DETONATION_HITSTOP);
      this._spawnWaveRing(ex, ey);

      this._explode(ex, ey, [0, 255, 255], 50);
      this._explode(ex, ey, [255, 255, 255], 30);
    },

    _triggerLandingBurst: function () {
      var p = this.p;

      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        var dx = e.x - p.x, dy = e.y - p.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < LANDING_BURST_RADIUS && d > 0.1) {
          var f = 1.0 - d / LANDING_BURST_RADIUS;
          e.vx += (dx / d) * LANDING_BURST_FORCE * (0.5 + f * 0.5);
          e.vy += (dy / d) * LANDING_BURST_FORCE * (0.5 + f * 0.5);
          e.stunTimer = Math.max(e.stunTimer, LANDING_BURST_STUN * f);
        }
      }

      this._spawnWaveRing(p.x, p.y);
    },

    _spawnWaveRing: function (x, y) {
      var ring = this._waveRings[this._waveRingW % this._waveRings.length];
      this._waveRingW++;
      ring.x = x; ring.y = y;
      ring.r = 10; ring.alpha = 0.9; ring.active = true;
      ring.gfx.setVisible(true);
    },

    _triggerHitstop: function (durMs) {
      // Ne s'additionne pas — prend le max, plafonné à HITSTOP_MAX
      var cap = (durMs >= DETONATION_HITSTOP) ? DETONATION_HITSTOP : HITSTOP_MAX;
      this.hitstopTimer = Math.min(Math.max(this.hitstopTimer, durMs), cap);
      this.timeScale = 0;
    },

    _checkCollisions: function () {
      var p = this.p;
      var pR = SIZE * 0.6;
      var isAtk = p.state === 'ATTACKING';
      var isDAtk = p.state === 'DASH_ATTACKING';
      var isDash = p.state === 'DASHING';
      var vuln = !isAtk && !isDAtk && !isDash;

      // Dash marks enemies instead of killing them
      if (isDash) {
        for (var mi = 0; mi < this.enemies.length; mi++) {
          var me = this.enemies[mi];
          if (me.isMarked) continue;
          var mdx = p.x - me.x, mdy = p.y - me.y;
          var md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < DASH_MARK_RADIUS + me.size * 0.5) {
            me.isMarked = true;
            me.markTimer = 3000;
            me.stunTimer = 200;
            p.dashHitCount++;
            this._explode(me.x, me.y, [0, 255, 255], 8);
          }
        }
      }

      for (var i = this.enemies.length - 1; i >= 0; i--) {
        var e = this.enemies[i];
        var dx = p.x - e.x, dy = p.y - e.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pR + e.size * 0.5) {
          if (isAtk) {
            if (e.isMarked) {
              this._triggerDetonation(i);
              // Instant recovery — player can act immediately
              p.state = 'MOVING';
              p.spinAngle = 0; p.atkTimer = 0;
              p.atkAvailable = true; p.atkCooldown = 0;
              return;
            }
            this._killEnemy(i);
            // Zero penalty on hit: instant recovery
            p.state = 'MOVING';
            p.spinAngle = 0; p.atkTimer = 0;
            p.atkAvailable = true; p.atkCooldown = 0;
            p.vx *= 0.3; p.vy *= 0.3;
            return;
          } else if (isDAtk) {
            // Dash attack on marked enemy: normal kill, NO detonation
            this._killEnemy(i);
            p.hasHitDuringDashAttack = true;
            if (p.dashAtkExtended < DASHATK_MAX_EXT) {
              var ext = Math.min(DASHATK_CHAIN_EXT, DASHATK_MAX_EXT - p.dashAtkExtended);
              p.atkTimer += ext; p.dashAtkExtended += ext;
            }
          } else if (vuln && !p.invincible) {
            p.hp -= 1; p.invincible = true; p.invincTimer = IFRAMES_DUR;
            if (dist > 0.1) { p.vx += (dx / dist) * 8; p.vy += (dy / dist) * 8; }
          }
        }
      }
    },

    update: function (_time, delta) {
      var dt = Math.min(delta / 1000, 0.05);

      this._checkTheme();

      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= delta;
        if (this.hitstopTimer <= 0) { this.hitstopTimer = 0; this.timeScale = 1.0; }
        else this.timeScale = 0;
      }

      var sDt  = dt * this.timeScale;
      var s60  = sDt * 60;
      var ms   = sDt * 1000;

      var fps = Math.round(this.game.loop.actualFps);
      this.fpsTxt.setText(fps + ' FPS');
      this.fpsTxt.setColor(fps >= 55 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444');

      if (ms < 0.001) {
        this._decayGhosts(dt);
        this._renderPlayer();
        return;
      }

      var p = this.p;

      if (p.invincible) {
        p.invincTimer -= ms;
        if (p.invincTimer <= 0) { p.invincible = false; p.invincTimer = 0; }
      }

      var frDt = Math.pow(FRICTION, s60);
      if (p.state === 'MOVING') {
        var inp = this._inputVec();
        p.vx = (p.vx + inp.dx * ACCEL * s60) * frDt;
        p.vy = (p.vy + inp.dy * ACCEL * s60) * frDt;
      } else if (p.state === 'RECOVERY') {
        var rf = p.recoveryWhiff ? DASHATK_WHIFF_FRIC : RECOVERY_FRIC;
        p.vx *= Math.pow(rf, s60); p.vy *= Math.pow(rf, s60);
      } else {
        p.vx *= frDt; p.vy *= frDt;
      }
      p.x += p.vx * s60; p.y += p.vy * s60;

      var wM = WORLD_HALF - SIZE * 1.5;
      if (p.x < -wM) { p.x = -wM; p.vx *= -0.4; }
      if (p.x >  wM) { p.x =  wM; p.vx *= -0.4; }
      if (p.y < -wM) { p.y = -wM; p.vy *= -0.4; }
      if (p.y >  wM) { p.y =  wM; p.vy *= -0.4; }

      if (p.state === 'DASHING') {
        p.dashTimer -= ms;
        if (Math.sqrt(p.vx * p.vx + p.vy * p.vy) > 2) {
          this._addGhost(p.x, p.y, 0.55, p.angle, false);
        }
        if (p.dashTimer <= 0) { p.state = 'MOVING'; p.dashCooldown = DASH_CD; }
      }
      if (p.state !== 'DASHING' && p.dashCooldown > 0) {
        p.dashCooldown = Math.max(0, p.dashCooldown - ms);
        if (p.dashCooldown <= 0) p.dashAvailable = true;
      }

      if (p.state === 'ATTACKING') {
        p.atkTimer -= ms; p.spinAngle += sDt * ATK_SPIN;
        if (p.atkTimer <= 0) {
          // Whiff — attack missed, short recovery
          p.state = 'RECOVERY'; p.recoveryTimer = ATK_WHIFF_DUR;
          p.recoveryWhiff = true; p.spinAngle = 0;
          p.vx *= 0.15; p.vy *= 0.15;
        }
      }

      if (p.state === 'DASH_ATTACKING') {
        p.atkTimer -= ms; p.spinAngle += sDt * DASH_ATK_SPIN;
        this._addGhost(p.x, p.y, 0.70, p.angle, true);
        if (p.atkTimer <= 0) {
          if (p.hasHitDuringDashAttack) { this._triggerLandingBurst(); p.state = 'MOVING'; }
          else {
            p.state = 'RECOVERY'; p.recoveryTimer = DASHATK_WHIFF_DUR;
            p.recoveryWhiff = true; p.vx *= 0.05; p.vy *= 0.05;
          }
          p.spinAngle = 0;
        }
      }

      if (p.state === 'RECOVERY') {
        p.recoveryTimer -= ms;
        if (p.recoveryTimer <= 0) { p.state = 'MOVING'; p.recoveryTimer = 0; }
      }
      if (p.state !== 'ATTACKING' && p.state !== 'DASH_ATTACKING') {
        p.atkAvailable = true;
      }

      this._decayGhosts(dt);

      if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') {
        p.angle = Math.atan2(p.atkDy, p.atkDx) + p.spinAngle;
      } else {
        var cam = this.cameras.main;
        p.angle = Phaser.Math.Angle.Between(
          p.x, p.y,
          this._mouseX + cam.scrollX, this._mouseY + cam.scrollY
        );
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
      this._checkCollisions();

      this.spawnTimer += ms;
      if (this.spawnTimer >= SPAWN_INTERVAL) {
        this.spawnTimer -= SPAWN_INTERVAL;
        this._spawnWave();
      }

      var cam = this.cameras.main;
      var cA = 1 - Math.pow(1 - CAM_LERP, s60);
      cam.scrollX += (p.x - cam.width  / 2 - cam.scrollX) * cA;
      cam.scrollY += (p.y - cam.height / 2 - cam.scrollY) * cA;

      this.pcbTile.tilePositionX = cam.scrollX;
      this.pcbTile.tilePositionY = cam.scrollY;
      this.pcbTile.setSize(cam.width, cam.height);

      this.gameTime += dt;

      // Anneaux d'onde de choc
      this._updateWaveRings(dt);

      this._renderPlayer();
      this._renderEnemies();
      this._renderHUD();
    },

    _updateWaveRings: function (dt) {
      var c = getColors();
      for (var i = 0; i < this._waveRings.length; i++) {
        var ring = this._waveRings[i];
        if (!ring.active) continue;
        ring.r     += dt * LANDING_BURST_RADIUS * 3.5;
        ring.alpha -= dt * 3.2;
        if (ring.alpha <= 0) {
          ring.active = false;
          ring.gfx.clear();
          ring.gfx.setVisible(false);
          continue;
        }
        ring.gfx.clear();
        ring.gfx.lineStyle(2.5, c.cyan, ring.alpha);
        ring.gfx.strokeCircle(ring.x, ring.y, ring.r);
        // Second anneau intérieur plus fin
        if (ring.r > 20) {
          ring.gfx.lineStyle(1, c.cyan, ring.alpha * 0.4);
          ring.gfx.strokeCircle(ring.x, ring.y, ring.r * 0.6);
        }
      }
    },

    _updateEnemies: function (dt) {
      var ms = dt * 1000, sc60 = dt * 60;
      var stDrg = Math.pow(0.92, sc60);
      var stK   = 1 - Math.pow(1 - 0.08, sc60);
      var p = this.p, en = this.enemies;

      for (var i = 0; i < en.length; i++) {
        var a = en[i];
        for (var j = i + 1; j < en.length; j++) {
          var b = en[j];
          var sdx = a.x - b.x, sdy = a.y - b.y;
          var sd = Math.sqrt(sdx * sdx + sdy * sdy);
          if (sd < SEPARATION_RADIUS && sd > 0.01) {
            var ov = (SEPARATION_RADIUS - sd) / SEPARATION_RADIUS;
            var fx = (sdx / sd) * SEPARATION_FORCE * ov * sc60;
            var fy = (sdy / sd) * SEPARATION_FORCE * ov * sc60;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
          }
        }
      }

      for (var i = 0; i < en.length; i++) {
        var e = en[i];
        var tSl = e.trail[e._tw % this.ENEMY_TRAIL_N];
        tSl.x = e.x; tSl.y = e.y; tSl.angle = e.angle;
        e._tw++; if (e._tn < this.ENEMY_TRAIL_N) e._tn++;

        // Mark expiry timer
        if (e.isMarked) {
          e.markTimer -= ms;
          if (e.markTimer <= 0) {
            e.isMarked = false; e.markTimer = 0;
          }
        }

        // Micro-particles on marked enemies (instability visual)
        if (e.isMarked && Math.random() < 0.18) {
          this._emitter2.setPosition(
            e.x + (Math.random() - 0.5) * 12,
            e.y + (Math.random() - 0.5) * 8
          );
          this._emitter2.setParticleTint(0x00ffff);
          this._emitter2.explode(1);
        }

        if (e.stunTimer > 0) {
          e.stunTimer -= ms;
          e.vx *= stDrg; e.vy *= stDrg;
          e.x += e.vx * sc60; e.y += e.vy * sc60;
        } else {
          var dx = p.x - e.x, dy = p.y - e.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 0.1) {
            e.angle = Math.atan2(dy, dx);
            var ax = (dx / d) * e.speed, ay = (dy / d) * e.speed;
            e.vx += (ax - e.vx) * stK; e.vy += (ay - e.vy) * stK;
          }
          e.x += e.vx * sc60; e.y += e.vy * sc60;
        }
      }
    },

    _renderPlayer: function () {
      var p = this.p;
      var key = this._pTexKey();

      if (p.invincible && Math.floor(this.gameTime * 12.5) % 2 === 0) {
        this.playerSpr.setVisible(false);
        for (var i = 0; i < this.TRAIL_CAP; i++) this._trail[i].spr.setVisible(false);
        return;
      }

      this.playerSpr.setTexture(key);
      this.playerSpr.setAlpha(1.0);
      this.playerSpr.setPosition(p.x, p.y);
      this.playerSpr.setRotation(p.angle);
      this.playerSpr.setVisible(true);
      this.playerSpr.setBlendMode(
        (p.state === 'RECOVERY' && p.recoveryWhiff) ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD
      );

      for (var i = 0; i < this.TRAIL_CAP; i++) this._trail[i].spr.setVisible(false);
      for (var hi = 0; hi < this._trN; hi++) {
        var idx = (this._trW - this._trN + hi) % this.TRAIL_CAP;
        if (idx < 0) idx += this.TRAIL_CAP;
        var sl = this._trail[idx];
        if (!sl.ok) continue;
        var dx = sl.x - p.x, dy = sl.y - p.y;
        if (dx * dx + dy * dy < 4) continue;
        sl.spr.setTexture(key);
        sl.spr.setPosition(sl.x, sl.y);
        sl.spr.setRotation(sl.angle);
        sl.spr.setAlpha((hi + 1) / (this._trN + 1) * 0.35);
        sl.spr.setVisible(true);
      }
    },

    _renderEnemies: function () {
      var gt = this.gameTime;
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        e.spr.setPosition(e.x, e.y);
        e.spr.setRotation(e.angle);

        if (e.isMarked) {
          // Urgence visuelle : pulse rapide entre blanc pur et cyan
          var flick = Math.sin(gt * Math.PI * 22 + i);
          var urgency = Math.max(0, 1 - e.markTimer / 3000); // 0→1 au fil du temps
          var flickFreq = 22 + urgency * 20;                 // s'accélère avant expiration
          flick = Math.sin(gt * Math.PI * flickFreq + i);
          // Alterne entre cyan vif et blanc pour un effet "grésillant"
          var tintColor = flick > 0 ? 0x00ffff : 0xffffff;
          e.spr.setTint(tintColor);
          e.spr.setAlpha(0.7 + Math.abs(flick) * 0.3);
          // Scale légèrement pulsé
          var sc = 1.0 + Math.abs(flick) * 0.15;
          e.spr.setScale(sc);
        } else {
          e.spr.clearTint();
          e.spr.setAlpha(1.0);
          e.spr.setScale(1.0);
        }

        for (var t = 0; t < this.ENEMY_TRAIL_N; t++) e.trSpr[t].setVisible(false);
        for (var ti = 0; ti < e._tn; ti++) {
          var tr = e.trail[(e._tw - e._tn + ti) % this.ENEMY_TRAIL_N];
          var ts = e.trSpr[ti % this.ENEMY_TRAIL_N];
          ts.setPosition(tr.x, tr.y);
          ts.setRotation(tr.angle);
          ts.setAlpha((ti + 1) / (e._tn + 1) * 0.30);
          if (e.isMarked) ts.setTint(0x00ffff);
          else ts.clearTint();
          ts.setVisible(true);
        }
      }
    },

    _renderHUD: function () {
      var p = this.p, cam = this.cameras.main;
      var cx = cam.width / 2, h = cam.height;
      var c = getColors();

      this.hudGfx.clear();

      if (!p.dashAvailable) {
        var bW = 80, bH = 4, bX = cx - 40, bY = h - 28;
        var f = p.state === 'DASHING' ? 0 : 1 - p.dashCooldown / DASH_CD;
        this.hudGfx.fillStyle(0xffffff, 0.10);
        this.hudGfx.fillRect(bX, bY, bW, bH);
        this.hudGfx.fillStyle(c.cyan, 0.8);
        this.hudGfx.fillRect(bX, bY, bW * f, bH);
      }

      // Marked enemy count indicator
      var markedN = 0;
      for (var mi = 0; mi < this.enemies.length; mi++) {
        if (this.enemies[mi].isMarked) markedN++;
      }
      if (markedN > 0) {
        this.hudGfx.fillStyle(0x00ffff, 0.85);
        var mTxt = markedN + ' MARKED';
        this.hudGfx.fillRect(cx - 32, h - 44, 64, 2);
      }
    },
  });

  /* ================================================================
     FACTORY
     ================================================================ */

  window.createLightGame = function (parentEl) {
    if (!parentEl) return null;
    var game = null;

    function start() {
      game = new Phaser.Game({
        type: Phaser.WEBGL,
        parent: parentEl,
        width: parentEl.clientWidth,
        height: parentEl.clientHeight,
        backgroundColor: getColors().bgColor,
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
