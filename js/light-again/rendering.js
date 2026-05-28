/* ==========================================================================
   Light Again — Rendering: Textures, Theme, Player, Enemies, Projectiles, HUD
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._genTextures = function () {
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    this._texTheme = theme;

    // The Phaser.Game (and its TextureManager) persists across scene.restart();
    // only the scene is rebuilt. Textures are identical between restarts unless
    // the theme changed, so skip the costly canvas redraw + GPU re-upload.
    // _lastGenTheme lives on the scene instance, which is reused on restart.
    if (this.textures.exists('_pcb') && this._lastGenTheme === theme) return;
    this._lastGenTheme = theme;

    var c = LA.getColors();
    var tm = this.textures;

    var ca = c.cyanArr;
    LA.buildArrowTex(tm, '_ar_cyan',  ca[0], ca[1], ca[2], C.SIZE, 18, false);
    var ya = c.yellowArr;
    LA.buildArrowTex(tm, '_ar_yel',   ya[0], ya[1], ya[2], C.SIZE, 18, false);
    LA.buildArrowTex(tm, '_ar_atk',   255, 30, 60,  C.SIZE, 18, false);
    LA.buildArrowTex(tm, '_ar_datk',  255, 20, 200, C.SIZE * 1.35, 28, true);
    var da = c.dashArrowArr;
    LA.buildArrowTex(tm, '_ar_dash',  da[0], da[1], da[2], C.SIZE, 18, false);
    LA.buildArrowTex(tm, '_ar_whiff', 80,  80,  90, C.SIZE, 4, false);

    // Steve skin — bake the player textures from the loaded pickaxe PNGs once.
    // The assets already ship with a transparent background (no keying needed).
    // Head points up-LEFT, so pre-rotate +135° to aim it +x (the arrow-tip axis);
    // pre-scale to arrow size so it drops into the arrow's rotate/scale logic.
    // Diamond = dash ready · Golden = dash on cooldown (mirrors cyan → yellow).
    var _bakePick = function (rawKey, outKey) {
      if (tm.exists(outKey) || !tm.exists(rawKey)) return;
      var img = tm.get(rawKey).getSourceImage();
      if (!img || !img.width) return;
      var rot = Math.PI * 0.25; // +45°: align the head to +x (the arrow-tip axis)
      var scale = (C.SIZE * 3.0) / Math.max(img.width, img.height);
      var sw = img.width * scale, sh = img.height * scale;
      var bw = Math.abs(sw * Math.cos(rot)) + Math.abs(sh * Math.sin(rot));
      var bh = Math.abs(sw * Math.sin(rot)) + Math.abs(sh * Math.cos(rot));
      var oc = document.createElement('canvas');
      oc.width = Math.ceil(bw); oc.height = Math.ceil(bh);
      var g = oc.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.translate(oc.width / 2, oc.height / 2);
      g.rotate(rot);
      g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
      tm.addCanvas(outKey, oc);
    };
    _bakePick('_la_pick_diamond_raw', '_la_pickaxe');
    _bakePick('_la_pick_gold_raw',    '_la_pickaxe_gold');
    _bakePick('_la_pick_stone_raw',   '_la_pickaxe_stone');

    // Enchanted-netherite dash-attack animation: bake each spritesheet frame into
    // its own rotated/scaled texture (_la_neth_0.._N) — same +45° / size as the
    // other pickaxes so the animated skin drops into the same rotate/scale logic.
    if (!tm.exists('_la_neth_0') && tm.exists('_la_pick_neth_raw')) {
      var nimg = tm.get('_la_pick_neth_raw').getSourceImage();
      if (nimg && nimg.width) {
        var FW = 160, nCols = Math.max(1, Math.floor(nimg.width / FW));
        var nRot = Math.PI * 0.25;
        var nScale = (C.SIZE * 3.0) / FW;
        var nsw = FW * nScale, nsh = FW * nScale;
        var nbw = Math.ceil(Math.abs(nsw * Math.cos(nRot)) + Math.abs(nsh * Math.sin(nRot)));
        var nbh = Math.ceil(Math.abs(nsw * Math.sin(nRot)) + Math.abs(nsh * Math.cos(nRot)));
        for (var nf = 0; nf < C.NETH_FRAMES; nf++) {
          var fcol = nf % nCols, frow = Math.floor(nf / nCols);
          var foc = document.createElement('canvas');
          foc.width = nbw; foc.height = nbh;
          var fg = foc.getContext('2d');
          fg.imageSmoothingEnabled = true; fg.imageSmoothingQuality = 'high';
          fg.translate(nbw / 2, nbh / 2);
          fg.rotate(nRot);
          fg.drawImage(nimg, fcol * FW, frow * FW, FW, FW, -nsw / 2, -nsh / 2, nsw, nsh);
          tm.addCanvas('_la_neth_' + nf, foc);
        }
      }
    }

    LA.buildEnemyTex(tm, '_enemy');
    LA.buildShooterTex(tm, '_shooter');
    LA.buildBruiserTex(tm, '_bruiser');
    // Pre-bake grayscale variants for The World texture-swap — zero runtime GPU cost
    LA.buildGrayscaleVariant(tm, '_enemy',   '_enemy_gray');
    LA.buildGrayscaleVariant(tm, '_shooter', '_shooter_gray');
    LA.buildGrayscaleVariant(tm, '_bruiser', '_bruiser_gray');
    LA.buildProjTex(tm, '_proj');
    LA.buildPCBTex(tm, '_pcb', c);
    LA.buildStarTex(tm, '_star');
    LA.buildAnomalyTex(tm, '_anomaly');
    LA.buildAnomalyProjTex(tm, '_anoproj');
  };

  M._checkTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    if (cur === this._texTheme) return;
    LA.resetColorCache();
    this._genTextures();
    this.cameras.main.setBackgroundColor(LA.getColors().bgColor);
    if (this.pcbTile) this.pcbTile.setTexture('_pcb');
    if (this.pcbGlow)  this.pcbGlow.setTexture('_pcbGlow');
    this._drawVignette();
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      // Use texKey (always set at spawn) — fallback to tier lookup for safety
      var texK = e.texKey || (e.tier === 3 ? '_bruiser' : e.tier === 2 ? '_shooter' : '_enemy');
      e.spr.setTexture(texK);
      for (var j = 0; j < e.trSpr.length; j++) e.trSpr[j].setTexture(texK);
      // Texture was just restored to the normal key — clear gray-state flags
      e._twGrayed   = false;
      e._markGrayed = false;
    }
  };

  M._pTexKey = function () {
    var p = this.p;
    // Steve skin: baked pickaxe (head pre-aligned to +x, rotates like the arrow).
    // Golden pickaxe while the dash is on cooldown, diamond when it's ready —
    // mirrors the arrow's cyan→yellow. Falls back to the arrow if the PNGs failed.
    if (window.__laSteveSkin && this.textures.exists('_la_pickaxe')) {
      // Dash-attack → animated enchanted netherite (mirrors the magenta arrow);
      // whiff/punish (missed attack or missed dash-attack) → stone (mirrors the
      // grey '_ar_whiff' arrow); dash on cooldown → gold; otherwise diamond.
      if (p.state === 'DASH_ATTACKING' && this.textures.exists('_la_neth_0')) {
        return '_la_neth_' + (Math.floor(this.gameTime * C.NETH_FPS) % C.NETH_FRAMES);
      }
      if (p.state === 'RECOVERY' && p.recoveryWhiff && this.textures.exists('_la_pickaxe_stone')) {
        return '_la_pickaxe_stone';
      }
      return (!p.dashAvailable && this.textures.exists('_la_pickaxe_gold')) ? '_la_pickaxe_gold' : '_la_pickaxe';
    }
    if (p.state === 'DASH_ATTACKING') return '_ar_datk';
    if (p.state === 'ATTACKING')      return '_ar_atk';
    if (p.state === 'DASHING')        return '_ar_dash';
    if (p.state === 'RECOVERY' && p.recoveryWhiff) return '_ar_whiff';
    return p.dashAvailable ? '_ar_cyan' : '_ar_yel';
  };

  M._renderPlayer = function () {
    var p = this.p;
    var key = this._pTexKey();

    // Normal hit i-frames: flicker (suppressed during the anomaly intro so
    // the player stays clearly visible while the cinematic plays).
    if (p.invincible && !p.dashInvinc && !this._twActive && !this._anomalyIntroActive
        && Math.floor(this.gameTime * 12.5) % 2 === 0) {
      this.playerSpr.setVisible(false);
      for (var i = 0; i < this.TRAIL_CAP; i++) this._trail[i].spr.setVisible(false);
      return;
    }

    this.playerSpr.setTexture(key);
    this.playerSpr.setPosition(p.x, p.y);
    this.playerSpr.setRotation(p.angle);
    this.playerSpr.setVisible(true);

    // Arrow scale escalates with combo
    var cm = this.comboMultiplier;
    var baseScale;
    if (cm >= 50) {
      baseScale = 1.30 + 0.08 * Math.sin(this.gameTime * Math.PI * 14);
    } else if (cm >= 25) {
      baseScale = 1.14 + 0.055 * Math.sin(this.gameTime * Math.PI * 9);
    } else if (cm >= 10) {
      baseScale = 1.06 + 0.035 * Math.sin(this.gameTime * Math.PI * 5);
    } else if (cm >= 5) {
      baseScale = 1.025 + 0.02 * Math.sin(this.gameTime * Math.PI * 4);
    } else {
      baseScale = 1.0;
    }
    if (p.state === 'DASH_ATTACKING') baseScale *= 1.08;
    if (this.isStarPowered) baseScale *= 1.25;
    this.playerSpr.setScale(baseScale);

    // Dash i-frames: keep dash look
    if (this._twActive) {
      // Golden phantom look during time stop — applies to both the arrow and
      // the pickaxe skin so the two stay uniform when the world is frozen.
      var twGhost = 0.60 + 0.20 * Math.sin(this.gameTime * Math.PI * 3);
      this.playerSpr.setTint(0xffc832);
      this.playerSpr.setAlpha(twGhost);
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
    } else if (p.invincible && p.dashInvinc) {
      // Dash i-frames — same cyan phantom look on both arrow and pickaxe.
      this.playerSpr.setTint(0x00ffff);
      this.playerSpr.setAlpha(0.85);
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
    } else if (p.state === 'DASH_ATTACKING') {
      // Dash-attack — same magenta phantom look on both arrow and pickaxe.
      this.playerSpr.setTint(0xff44ff);
      this.playerSpr.setAlpha(0.92);
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
    } else if (window.__laSteveSkin) {
      // Pickaxe is a solid object, not a neon glyph — render opaque, untinted,
      // so it keeps its Minecraft colours (state is conveyed by the baked glow).
      this.playerSpr.clearTint();
      this.playerSpr.setAlpha(1.0);
      this.playerSpr.setBlendMode(Phaser.BlendModes.NORMAL);
    } else {
      this.playerSpr.clearTint();
      this.playerSpr.setAlpha(1.0);
      this.playerSpr.setBlendMode(
        (p.state === 'RECOVERY' && p.recoveryWhiff) ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD
      );
    }

    // Star Power aura — world-space pulsing ring in dash-attack magenta
    if (this._starAuraGfx) {
      this._starAuraGfx.clear();
      if (this.isStarPowered) {
        this._starAuraGfx.setVisible(true);
        var auraPulseFreq = this._starPowerWarning ? 9 : 3.5;
        var auraPulseBase = this._starPowerWarning ? 0.2 : 0.40;
        var auraPulse = auraPulseBase + 0.55 * Math.abs(Math.sin(this.gameTime * Math.PI * auraPulseFreq));
        var auraR = C.SIZE * baseScale * 1.4;
        // Outer soft glow
        this._starAuraGfx.lineStyle(18, C.STAR_TINT, auraPulse * 0.22);
        this._starAuraGfx.strokeCircle(p.x, p.y, auraR * 1.38);
        // Main ring
        this._starAuraGfx.lineStyle(4, C.STAR_TINT, auraPulse * 0.82);
        this._starAuraGfx.strokeCircle(p.x, p.y, auraR);
        // Inner hot ring
        this._starAuraGfx.lineStyle(2, 0xff88ff, auraPulse * 0.95);
        this._starAuraGfx.strokeCircle(p.x, p.y, auraR * 0.62);
      } else {
        this._starAuraGfx.setVisible(false);
      }
    }

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
      var trAlpha = (hi + 1) / (this._trN + 1) * (p.invincible && p.dashInvinc ? 0.55 : 0.35);
      sl.spr.setAlpha(trAlpha);
      sl.spr.setScale(baseScale * ((hi + 1) / (this._trN + 1) * 0.5 + 0.5));
      if (this._twActive) {
        // Golden phantom after-images during time stop — uniform across skins.
        sl.spr.setBlendMode(Phaser.BlendModes.ADD);
        sl.spr.setTint(0xffc832);
      } else if (p.invincible && p.dashInvinc) {
        sl.spr.setBlendMode(Phaser.BlendModes.ADD);
        sl.spr.setTint(0x00ffff);
      } else if (p.state === 'DASH_ATTACKING') {
        // Gradient: oldest ghost = dark cyan-blue → newest = crimson (matches texture direction)
        var tFrac = (hi + 1) / (this._trN + 1);
        var trR = Math.round(0   + 255 * tFrac);
        var trG = Math.round(80  - 60  * tFrac);
        var trB = Math.round(220 - 160 * tFrac);
        sl.spr.setBlendMode(Phaser.BlendModes.ADD);
        sl.spr.setTint((trR << 16) | (trG << 8) | trB);
      } else if (window.__laSteveSkin) {
        // Solid pickaxe after-images (motion blur), no neon tint
        sl.spr.clearTint();
        sl.spr.setBlendMode(Phaser.BlendModes.NORMAL);
      } else {
        sl.spr.setBlendMode(Phaser.BlendModes.ADD);
        sl.spr.clearTint();
      }
      sl.spr.setVisible(true);
    }
  };

  M._renderEnemies = function () {
    var gt = this.gameTime;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      e.spr.setPosition(e.x, e.y);
      e.spr.setRotation(e.angle);

      // Time Stop: condemned enemies — red/crimson glow (distinct from cyan detonation mark)
      // Detonation-pending enemies also show this + a separate charging circle overlay
      if (e._twCondemned) {
        var twPulse = 0.5 + 0.5 * Math.sin(gt * Math.PI * 8 + i);
        var twTint = twPulse > 0.5 ? 0xff2222 : 0xcc0000;
        e.spr.setTint(twTint);
        e.spr.setAlpha(0.5 + twPulse * 0.45);
        e.spr.setScale(1.0 + twPulse * 0.12);

        for (var t = 0; t < this.ENEMY_TRAIL_N; t++) e.trSpr[t].setVisible(false);
        continue;
      }

      if (e.tier === 3) {
        if (e.isMarked) {
          var urgency = Math.max(0, 1 - e.markTimer / (e.markMaxTimer || 3000));
          var flickFreq = 22 + urgency * 20;
          var flick = Math.sin(gt * Math.PI * flickFreq + i);
          var tintColor = flick > 0 ? 0x00ffff : 0xffffff;
          e.spr.setTint(tintColor);
          e.spr.setAlpha(0.7 + Math.abs(flick) * 0.3);
          e.spr.setScale(1.0 + Math.abs(flick) * 0.15);
        } else {
          var t3tint = e.hp >= 2 ? 0x5c0099 : 0x8b0000;
          e.spr.setTint(t3tint);
          e.spr.setAlpha(1.0);
          e.spr.setScale(1.0);
        }

        // Shield ring
        if (e.shieldGfx) {
          e.shieldGfx.clear();
          if (e.hasShield) {
            e.shieldRot += 0.015;
            var sPulse, sAlpha, sR;
            if (e.isMarked) {
              var mFlick2 = Math.sin(gt * Math.PI * 28 + i);
              sPulse = 0.6 + 0.15 * Math.abs(mFlick2);
              sAlpha = 0.40 + 0.55 * Math.abs(mFlick2);
              sR = C.T3_SHIELD_RADIUS * sPulse;
              var shCol = mFlick2 > 0 ? 0x00ffff : 0x4488ff;
              e.shieldGfx.lineStyle(2, shCol, sAlpha);
            } else {
              sPulse = 0.85 + 0.15 * Math.sin(gt * Math.PI * 3);
              sAlpha = 0.55 + 0.2 * Math.sin(gt * Math.PI * 4);
              sR = C.T3_SHIELD_RADIUS * sPulse;
              e.shieldGfx.lineStyle(3, 0x00ffff, sAlpha);
            }
            e.shieldGfx.strokeCircle(e.x, e.y, sR);
            e.shieldGfx.lineStyle(1.5, 0xffffff, sAlpha * 0.4);
            e.shieldGfx.strokeCircle(e.x, e.y, sR * 0.8);
            for (var ai = 0; ai < 4; ai++) {
              var arcA = e.shieldRot + (Math.PI / 2) * ai;
              e.shieldGfx.lineStyle(2, 0x00ffff, sAlpha * 0.7);
              e.shieldGfx.beginPath();
              e.shieldGfx.arc(e.x, e.y, sR + 3, arcA, arcA + 0.4);
              e.shieldGfx.strokePath();
            }
          }
        }
      } else if (e.isMarked) {
        var urgency = Math.max(0, 1 - e.markTimer / (e.markMaxTimer || 3000));
        var flickFreq = 22 + urgency * 20;
        var flick = Math.sin(gt * Math.PI * flickFreq + i);
        var tintColor = flick > 0 ? 0x00ffff : 0xffffff;
        e.spr.setTint(tintColor);
        e.spr.setAlpha(0.7 + Math.abs(flick) * 0.3);
        e.spr.setScale(1.0 + Math.abs(flick) * 0.15);
      } else if (e.tier === 2) {
        if (e.fireFlashTimer > 0) {
          var flash = e.fireFlashTimer / 180;
          e.spr.setTint(0xffff66);
          e.spr.setScale(1.0 + (1 - flash) * 0.45);
          e.spr.setAlpha(0.95 + flash * 0.05);
        } else if (e.isCharging) {
          var chg = 1 - e.chargeTimer / C.T2_CHARGE_DUR;
          var slow = Math.pow(chg, 1.85);
          var csc = 1.0 + chg * 0.32;
          var g0 = 195, g1 = 72;
          var b0 = 45, b1 = 8;
          var cg = Math.round(g0 + (g1 - g0) * slow);
          var cb = Math.round(b0 + (b1 - b0) * slow);
          e.spr.setTint(Phaser.Display.Color.GetColor(255, cg, cb));
          e.spr.setScale(csc);
          e.spr.setAlpha(0.62 + chg * 0.38);
        } else {
          e.spr.setTint(0xffaa22);
          e.spr.setScale(1.0);
          e.spr.setAlpha(1.0);
        }
      } else {
        e.spr.clearTint();
        e.spr.setAlpha(1.0);
        e.spr.setScale(1.0);
      }

      // Spawn animation: scale up + fade in (natural waves only)
      if (e._spawnAnimT < 1.0) {
        var sap = e._spawnAnimT;
        var animSc = sap < 0.68 ? (sap / 0.68) * 1.22 : 1.22 - ((sap - 0.68) / 0.32) * 0.22;
        var animAl = Math.min(1.0, sap * 3.0);
        e.spr.setScale(animSc);
        e.spr.setAlpha(animAl);
        if (sap < 0.25) e.spr.setTint(0xffffff);
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
  };

  /* ---------------------------------------------------------------
     Vignette: baked radial gradient (canvas texture) — dark edges, transparent center
     --------------------------------------------------------------- */
  M._drawVignette = function () {
    var w = this.scale.width, h = this.scale.height;
    // Overshoot by 4px to eliminate any sub-pixel gap at edges
    var cw = Math.ceil(w) + 4, ch = Math.ceil(h) + 4;
    var cx = cw / 2, cy = ch / 2;
    var r = Math.sqrt(cx * cx + cy * cy);

    // Edge colour = PCB trace colour darkened very heavily
    var colors = LA.getColors();
    var tr = (colors.pcbTrace >> 16) & 0xff;
    var tg = (colors.pcbTrace >> 8) & 0xff;
    var tb = colors.pcbTrace & 0xff;
    // Per-theme calibration: darken factor and edge alpha tuned so the vignette
    // edge is always DARKER than the background (avoids a glowing band effect)
    var theme = document.documentElement.getAttribute('data-theme') || 'light';
    var darkenFactor, edgeAlpha;
    if (theme === 'dark') {
      darkenFactor = 0.12; edgeAlpha = 0.88; // deep purple, slightly less harsh
    } else if (theme === 'nature') {
      darkenFactor = 0.07; edgeAlpha = 0.86; // minimal green tint, close to bg
    } else {
      darkenFactor = 0.06; edgeAlpha = 0.95; // near-black with faint warm tint
    }
    var dr = Math.round(tr * darkenFactor);
    var dg = Math.round(tg * darkenFactor);
    var db = Math.round(tb * darkenFactor);
    var edge = 'rgba(' + dr + ',' + dg + ',' + db + ',' + edgeAlpha + ')';

    // Bake gradient into a canvas texture (done once / on theme change)
    var tm = this.textures;
    var key = '_vignette';
    if (tm.exists(key)) tm.remove(key);
    var vc = document.createElement('canvas');
    vc.width = cw; vc.height = ch;
    var vctx = vc.getContext('2d');
    var grad = vctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0,    'rgba(0,0,0,0)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0)');
    grad.addColorStop(1,    edge);
    vctx.fillStyle = grad;
    vctx.fillRect(0, 0, cw, ch);
    tm.addCanvas(key, vc);

    if (this._vignetteSprite && this._vignetteSprite.scene) {
      this._vignetteSprite.setTexture(key);
      this._vignetteSprite.setPosition(-2, -2);
      this._vignetteSprite.setDisplaySize(cw, ch);
    } else {
      this._vignetteSprite = this.add.image(-2, -2, key);
      this._vignetteSprite.setOrigin(0, 0);
      this._vignetteSprite.setScrollFactor(0);
      this._vignetteSprite.setDepth(-8);
      this._vignetteSprite.setDisplaySize(cw, ch);
    }
  };

  M._renderProjectiles = function (dt) {
    var gt = this.gameTime;
    // dt is raw real-time seconds; used for frame-rate independent trail decay

    // Decay all active trail slots
    for (var si = 0; si < this._projTrailPool.length; si++) {
      var sl = this._projTrailPool[si];
      if (!sl.active) continue;
      sl.alpha -= (dt || 0.0167) * 4.2;  // 4.2/s ≈ 0.07/frame at 60fps
      if (sl.alpha <= 0) {
        sl.active = false;
        sl.spr.setVisible(false);
      } else {
        sl.spr.setPosition(sl.x, sl.y);
        sl.spr.setRotation(sl.rot);
        sl.spr.setTint(sl.tint);
        sl.spr.setAlpha(sl.alpha);
        sl.spr.setScale(0.6 + sl.alpha * 0.5);
      }
    }

    for (var i = 0; i < this.projectiles.length; i++) {
      var pr = this.projectiles[i];
      if (pr._twFrozen) {
        // Frozen during TW: pulsing purple, slightly larger
        var fpA = 0.5 + 0.4 * Math.sin(gt * Math.PI * 6 + i);
        pr.spr.setAlpha(fpA);
        pr.spr.setScale(1.8);
        pr.spr.setTint(0xcc66ff);
      } else if (pr.glitch) {
        // Anomaly projectile (own skin). Two clean colour codes so reflected
        // shots are unmistakable from live ones:
        //   - LIVE     → really white glitch (mostly white with tiny RGB ticks)
        //   - REFLECTED→ cyan glitch (cyan with white speckles)
        if (pr.isReflected) {
          var gCR = (Math.floor(gt * 50 + i) % 4);
          pr.spr.setTint(gCR === 0 ? 0xffffff : 0x00ffff);
          pr.spr.setAlpha(0.92 + 0.08 * Math.sin(gt * Math.PI * 30 + i));
          pr.spr.setScale(1.10 + 0.22 * Math.sin(gt * Math.PI * 22 + i));
        } else {
          // Mostly white; only ~1 frame in 8 is a faint RGB tick.
          var gCW = (Math.floor(gt * 45 + i) % 8);
          pr.spr.setTint(gCW === 5 ? 0xddeeff : gCW === 6 ? 0xffddee : 0xffffff);
          pr.spr.setAlpha(0.94 + 0.06 * Math.sin(gt * Math.PI * 26 + i));
          pr.spr.setScale(0.85 + 0.18 * Math.sin(gt * Math.PI * 18 + i));
        }
      } else if (pr.isReflected) {
        var pa = 0.75 + 0.25 * Math.sin(gt * Math.PI * 28 + i);
        pr.spr.setAlpha(pa);
        pr.spr.setScale(pr.smashed ? 1.7 : 1.3);
        pr.spr.setTint(0xaa44ff);
      } else {
        var ys = 1.0 + 0.12 * Math.sin(gt * Math.PI * 16 + i * 1.3);
        pr.spr.setAlpha(1.0);
        pr.spr.setScale(ys);
        pr.spr.setTint(0xffaa22);
      }
    }
  };

  M._renderHUD = function (dt) {
    var p = this.p, cam = this.cameras.main;
    var cx = cam.width / 2, h = cam.height;
    var c = LA.getColors();
    var gt = this.gameTime;

    this.hudGfx.clear();

    // ---- Directional motion-blur vignette during dash ----
    this._dashBlurAlpha = this._dashBlurAlpha || 0;
    var isDashing = p.state === 'DASHING';
    var blurDt = dt || 0.016;
    this._dashBlurAlpha = isDashing
      ? Math.min(1, this._dashBlurAlpha + blurDt * 8)
      : Math.max(0, this._dashBlurAlpha - blurDt * 6);
    if (this._dashBlurAlpha > 0.01) {
      var blurDx = Math.cos(p.angle);
      var blurDy = Math.sin(p.angle);
      var maxA = 0.36 * this._dashBlurAlpha;
      var aTL = Math.max(0, Math.min(1,  blurDx + blurDy)) * maxA;
      var aTR = Math.max(0, Math.min(1, -blurDx + blurDy)) * maxA;
      var aBL = Math.max(0, Math.min(1,  blurDx - blurDy)) * maxA;
      var aBR = Math.max(0, Math.min(1, -blurDx - blurDy)) * maxA;
      this.hudGfx.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, aTL, aTR, aBL, aBR);
      this.hudGfx.fillRect(0, 0, cam.width, cam.height);
    }

    // ---- Shared bar constants ----
    var BAR_W = 160, BAR_H = 7;
    var barX  = cx - BAR_W / 2;

    // ---- Dash cooldown bar ----
    if (!p.dashAvailable) {
      var dashCdMax = C.DASH_CD * ((this._upgradeLevels && this._upgradeLevels.dash >= 1) ? 0.70 : 1.0);
      var dashF = p.state === 'DASHING' ? 0 : Math.max(0, Math.min(1, 1 - p.dashCooldown / dashCdMax));
      var dashY = h - 34;
      this.hudGfx.fillStyle(c.cyan, 0.10);
      this.hudGfx.fillRect(barX, dashY, BAR_W, BAR_H);
      this.hudGfx.lineStyle(1, c.cyan, 0.22);
      this.hudGfx.strokeRect(barX, dashY, BAR_W, BAR_H);
      if (dashF > 0) {
        this.hudGfx.fillStyle(c.cyan, 0.88);
        this.hudGfx.fillRect(barX, dashY, BAR_W * dashF, BAR_H);
        this.hudGfx.fillStyle(0xffffff, 0.60);
        this.hudGfx.fillRect(barX + BAR_W * dashF - 2, dashY, 2, BAR_H);
      }
    }

    // ---- Star Power timer bar ----
    if (this.isStarPowered) {
      var starF  = this._starPowerTimer / C.STAR_DUR;
      var starY  = h - 48;
      var starA  = this._starPowerWarning
        ? (0.45 + 0.55 * Math.abs(Math.sin(gt * Math.PI * 6)))
        : 0.92;
      this.hudGfx.fillStyle(C.STAR_TINT, 0.10);
      this.hudGfx.fillRect(barX, starY, BAR_W, BAR_H);
      this.hudGfx.lineStyle(1, C.STAR_TINT, 0.22);
      this.hudGfx.strokeRect(barX, starY, BAR_W, BAR_H);
      this.hudGfx.fillStyle(C.STAR_TINT, starA);
      this.hudGfx.fillRect(barX, starY, BAR_W * starF, BAR_H);
      if (starF > 0.01) {
        this.hudGfx.fillStyle(0xffffff, 0.55);
        this.hudGfx.fillRect(barX + BAR_W * starF - 2, starY, 2, BAR_H);
      }
    }

    // ---- The World bar ----
    if (this._twUnlocked) {
      var twY = h - 20;
      if (this._twActive) {
        var twTotalMs = (this._twWaveDurationMs || 0) + C.TW_DURATION;
        var twF       = Math.max(0, 1.0 - (this._twTotalElapsed || 0) / twTotalMs);
        var twPulseA  = 0.72 + 0.28 * Math.abs(Math.sin(gt * Math.PI * 4));
        this.hudGfx.fillStyle(0xcc1111, 0.14);
        this.hudGfx.fillRect(barX, twY, BAR_W, BAR_H);
        this.hudGfx.lineStyle(1, 0xcc1111, 0.35);
        this.hudGfx.strokeRect(barX, twY, BAR_W, BAR_H);
        this.hudGfx.fillStyle(0xdd1111, twPulseA);
        this.hudGfx.fillRect(barX, twY, BAR_W * twF, BAR_H);
        if (twF > 0.01) {
          this.hudGfx.fillStyle(0xff6666, 0.90);
          this.hudGfx.fillRect(barX + BAR_W * twF - 2, twY, 2, BAR_H);
        }
      } else if (this._twCooldown <= 0) {
        var twReadyA = 0.55 + 0.35 * Math.abs(Math.sin(gt * Math.PI * 1.8));
        this.hudGfx.fillStyle(0xcc1111, twReadyA * 0.22);
        this.hudGfx.fillRect(barX - 2, twY - 1, BAR_W + 4, BAR_H + 2);
        this.hudGfx.fillStyle(0xdd1111, twReadyA);
        this.hudGfx.fillRect(barX, twY, BAR_W, BAR_H);
        this.hudGfx.lineStyle(1, 0xff4444, twReadyA * 0.80);
        this.hudGfx.strokeRect(barX, twY, BAR_W, BAR_H);
      }
    }

    // Score display — recentered each frame to handle resize
    var cx2 = cam.width / 2;
    this._scoreTxt.setPosition(cx2, 16);
    if (this.score !== this._lastScore) {
      this._lastScore = this.score;
      this._scoreTxt.setText(this.score);
    }
    // Score: red tint during TW, cyan otherwise
    if (this._twActive) {
      this._scoreTxt.setColor('#ff3333');
      this._scoreTxt.setAlpha(0.75);
    } else {
      this._scoreTxt.setColor('#00ffff');
      this._scoreTxt.setAlpha(0.95);
    }

    // Combo multiplier
    if (this.comboMultiplier > 1) {
      this._comboTxt.setPosition(cx2, 48);
      if (this.comboMultiplier !== this._lastCombo) {
        this._lastCombo = this.comboMultiplier;
        this._comboTxt.setText('x' + this.comboMultiplier);
      }
      if (this._comboPulse > 0) {
        var ps = 1.0 + this._comboPulse * 0.45;
        this._comboTxt.setScale(ps);
        this._comboPulse = Math.max(0, this._comboPulse - 0.055);
      } else {
        this._comboTxt.setScale(1.0);
      }
      var comboRatio = this.comboTimer / 2000;
      // During TW: always solid (no end-blink), red colour override
      var comboAlpha;
      if (this._twActive) {
        comboAlpha = 0.75;
      } else {
        comboAlpha = comboRatio > 0.3 ? 0.95 : 0.35 + 0.6 * Math.abs(Math.sin(this.gameTime * Math.PI * 10));
      }
      this._comboTxt.setAlpha(comboAlpha);
      var comboCol;
      if (this._twActive) {
        comboCol = '#ff3333';
      } else {
        comboCol = this.comboMultiplier >= 50 ? '#00ffff' : this.comboMultiplier >= 25 ? '#ff6600' : this.comboMultiplier >= 10 ? '#ffcc00' : '#ffffff';
      }
      if (comboCol !== this._lastComboCol) {
        this._lastComboCol = comboCol;
        this._comboTxt.setColor(comboCol);
      }
      var timerW = 100;
      var timerCol = this._twActive ? 0xcc1111
        : this.comboMultiplier >= 50 ? 0x00ffff
        : this.comboMultiplier >= 25 ? 0xff6600 : 0xffcc00;
      this.hudGfx.fillStyle(0xffffff, 0.08);
      this.hudGfx.fillRect(cx2 - timerW / 2, 76, timerW, 3);
      this.hudGfx.fillStyle(timerCol, this._twActive ? 0.55 : 0.75);
      this.hudGfx.fillRect(cx2 - timerW / 2, 76, timerW * comboRatio, 3);
    } else {
      this._comboTxt.setAlpha(0);
    }

    // ---- Upgrade icons (bottom HUD) ----
    this._renderUpgradeHUD(cx, h, dt);

    // ---- The World icon (bottom HUD, after upgrade icons) ----
    if (this._twUnlocked) {
      this._renderTheWorldIcon(h);
    } else if (this._twIconTxt) {
      this._twIconTxt.setAlpha(0); // hide when not yet unlocked
    }

    // ---- Shield status (bottom-left HUD) ----
    this._renderShieldHUD(h);
  };

  /* ---- Upgrade HUD icons — bottom-right, horizontal ---- */
  var _upOrder    = ['dashAtk', 'detonation', 'dash', 'baseAtk', 'shield'];
  var _upIconSize = 46;
  var _upGap      = 10;
  var _upDotR     = 2.5;
  var _upMarginR  = 16;
  var _upMarginB  = 16;

  M._renderUpgradeHUD = function (cx, h, dt) {
    if (!this._upgradeLevels) return;
    var lvls = this._upgradeLevels;
    var w    = this.cameras.main.width;
    var iy   = h - _upMarginB - _upIconSize - _upDotR * 2 - 6;

    // ---- Kill counter to next upgrade (above icons, right-aligned) ----
    if (this._upgradePool && this._upgradePool.length > 0 && !this._upgradeDraftOpen) {
      var killsLeft = Math.max(0, this._upgradeKillThreshold - this.totalKills);
      if (this._lastKillsLeft !== killsLeft) {
        this._lastKillsLeft    = killsLeft;
        this._killCounterPulse = 1.0;
      }
      var kDt = dt || 0.016;
      this._killCounterPulse = Math.max(0, (this._killCounterPulse || 0) - kDt * 3.5);

      if (!this._killCounterTxt) {
        this._killCounterTxt = this.add.text(0, 0, '', {
          fontFamily: 'monospace', fontSize: '25px',
          color: '#6699bb', stroke: '#000000', strokeThickness: 3.5,
        });
        this._killCounterTxt.setOrigin(1, 1);
        this._killCounterTxt.setDepth(102);
        this._killCounterTxt.setScrollFactor(0);
      }
      // Colour ramp is now proportional to the *current* interval (hardcore
      // grows it each draft), not to a fixed 200-kill assumption.
      var kcInterval = this._upgradeKillInterval || C.UPGRADE_KILL_INTERVAL;
      var kcRatio = killsLeft / kcInterval;  // 1.0 just after a draft → 0.0 at the next one
      var kcColor = kcRatio <= 0.10 ? '#ff7733' : kcRatio <= 0.25 ? '#ffcc44' : '#6699bb';
      this._killCounterTxt.setText('>> ' + killsLeft + ' kills');
      this._killCounterTxt.setColor(kcColor);
      var kcPulse = 1.0 + (this._killCounterPulse || 0) * 0.22;
      this._killCounterTxt.setScale(kcPulse);
      this._killCounterTxt.setPosition(w - _upMarginR, iy - 34);
      this._killCounterTxt.setAlpha(0.78 + (this._killCounterPulse || 0) * 0.22);
      this._killCounterTxt.setVisible(true);

      // Thin progress bar aligned to counter right edge
      var prog = 1 - Math.min(1, kcRatio);
      var pbW  = 100;
      var pbX  = w - _upMarginR - pbW;
      var pbY  = iy - 20;
      var pbCol = kcRatio <= 0.10 ? 0xff7733 : kcRatio <= 0.25 ? 0xffcc44 : 0x3366aa;
      this.hudGfx.fillStyle(pbCol, 0.10);
      this.hudGfx.fillRect(pbX, pbY, pbW, 3);
      this.hudGfx.fillStyle(pbCol, 0.72);
      this.hudGfx.fillRect(pbX, pbY, pbW * prog, 3);
    } else if (this._killCounterTxt) {
      this._killCounterTxt.setVisible(false);
    }

    // Collect acquired upgrades (preserve display order)
    var acquired = [];
    for (var i = 0; i < _upOrder.length; i++) {
      if (lvls[_upOrder[i]] > 0) acquired.push(_upOrder[i]);
    }
    if (acquired.length === 0) return;

    // Stack icons horizontally leftward from bottom-right corner
    for (var j = 0; j < acquired.length; j++) {
      var id  = acquired[j];
      var lvl = lvls[id];

      var ix = w - _upMarginR - (acquired.length - j) * (_upIconSize + _upGap) + _upGap;

      // Border color: cyan=Lv1, gold=Lv2
      var borderCol = lvl >= 2 ? 0xffc832 : 0x00ffff;
      var borderA   = lvl >= 2 ? 0.75 : 0.60;

      // Icon background
      this.hudGfx.fillStyle(0x080a1c, 0.88);
      this.hudGfx.fillRect(ix, iy, _upIconSize, _upIconSize);

      // Border (2px)
      this.hudGfx.lineStyle(2, borderCol, borderA);
      this.hudGfx.strokeRect(ix, iy, _upIconSize, _upIconSize);

      // Inner circle hint
      this.hudGfx.fillStyle(borderCol, 0.22);
      var dotCx = ix + _upIconSize / 2;
      var dotCy = iy + _upIconSize / 2;
      this.hudGfx.fillCircle(dotCx, dotCy, 9);

      // Progression dots below icon
      var dotsY  = iy + _upIconSize + 5;
      var maxLvl = LA.UPGRADES[id].maxLvl;
      var dotsW  = maxLvl * (_upDotR * 2 + 3) - 3;
      var dotsX  = dotCx - dotsW / 2;
      for (var d = 0; d < maxLvl; d++) {
        var dx = dotsX + d * (_upDotR * 2 + 3) + _upDotR;
        this.hudGfx.fillStyle(d < lvl ? borderCol : 0xffffff, d < lvl ? 0.92 : 0.18);
        this.hudGfx.fillCircle(dx, dotsY, _upDotR);
      }
    }
  };

  /* ---- The World icon — tri-state: ready / active / cooldown (greyed) ---- */
  M._renderTheWorldIcon = function (h) {
    var w    = this.cameras.main.width;
    var lvls = this._upgradeLevels || {};

    var normalCount = 0;
    for (var i = 0; i < _upOrder.length; i++) {
      if (lvls[_upOrder[i]] > 0) normalCount++;
    }

    var ix = w - _upMarginR - (normalCount + 1) * (_upIconSize + _upGap) + _upGap;
    var iy = h - _upMarginB - _upIconSize - _upDotR * 2 - 6;

    var gt    = this.gameTime || 0;
    var dotCx = ix + _upIconSize / 2;
    var dotCy = iy + _upIconSize / 2;
    var active = this._twActive;
    var onCD   = !active && this._twCooldown > 0;
    var ready  = !active && !onCD;

    if (active) {
      // --- ACTIVE: red background, vertical drain fill ---
      this.hudGfx.fillStyle(0x1a0505, 0.95);
      this.hudGfx.fillRect(ix, iy, _upIconSize, _upIconSize);
      var twTotalMs = (this._twWaveDurationMs || 0) + C.TW_DURATION;
      var twFrac    = Math.max(0, 1.0 - (this._twTotalElapsed || 0) / twTotalMs);
      var fillH     = Math.round((_upIconSize - 2) * twFrac);
      var pA        = 0.50 + 0.22 * Math.abs(Math.sin(gt * Math.PI * 4));
      this.hudGfx.fillStyle(0xcc1111, pA);
      this.hudGfx.fillRect(ix + 1, iy + 1, _upIconSize - 2, fillH);
      if (fillH > 2) {
        this.hudGfx.fillStyle(0xff6666, 0.90);
        this.hudGfx.fillRect(ix + 1, iy + fillH - 1, _upIconSize - 2, 2);
      }
      this.hudGfx.lineStyle(2, 0xee1111, 0.70 + 0.30 * Math.abs(Math.sin(gt * Math.PI * 4)));
      this.hudGfx.strokeRect(ix, iy, _upIconSize, _upIconSize);
    } else if (onCD) {
      // --- COOLDOWN: clearly greyed out, fill rising from bottom ---
      this.hudGfx.fillStyle(0x0e0e0e, 0.95);
      this.hudGfx.fillRect(ix, iy, _upIconSize, _upIconSize);
      var cdFrac  = 1 - this._twCooldown / C.TW_COOLDOWN;
      var cdH     = Math.round((_upIconSize - 2) * cdFrac);
      var cdFillY = iy + 1 + (_upIconSize - 2) - cdH;
      this.hudGfx.fillStyle(0x2a2a35, 0.88);
      this.hudGfx.fillRect(ix + 1, cdFillY, _upIconSize - 2, cdH);
      if (cdH > 2) {
        this.hudGfx.fillStyle(0x606080, 0.75);
        this.hudGfx.fillRect(ix + 1, cdFillY, _upIconSize - 2, 2);
      }
      this.hudGfx.lineStyle(2, 0x3a3a4a, 0.65);
      this.hudGfx.strokeRect(ix, iy, _upIconSize, _upIconSize);
    } else {
      // --- READY: pulsing crimson fill + bright border + outer glow ---
      var rP = 0.25 + 0.18 * Math.abs(Math.sin(gt * Math.PI * 1.8));
      this.hudGfx.fillStyle(0x0a0807, 0.92);
      this.hudGfx.fillRect(ix, iy, _upIconSize, _upIconSize);
      this.hudGfx.fillStyle(0xcc1111, rP);
      this.hudGfx.fillRect(ix + 1, iy + 1, _upIconSize - 2, _upIconSize - 2);
      var rBorderA = 0.70 + 0.30 * Math.abs(Math.sin(gt * Math.PI * 1.8));
      this.hudGfx.lineStyle(3, 0xee1111, rBorderA);
      this.hudGfx.strokeRect(ix, iy, _upIconSize, _upIconSize);
    }

    // "TW" label — dim on CD, pulsing on ready
    if (this._twIconTxt) {
      this._twIconTxt.setPosition(dotCx, dotCy);
      this._twIconTxt.setAlpha(
        active ? 0.92
        : onCD  ? 0.22
        : 0.62 + 0.28 * Math.abs(Math.sin(gt * Math.PI * 1.8))
      );
    }

    // Dot below icon — grey on CD
    var dotsY = iy + _upIconSize + 5;
    this.hudGfx.fillStyle(onCD ? 0x444444 : 0xcc1111, ready ? 0.92 : onCD ? 0.35 : 0.70);
    this.hudGfx.fillCircle(dotCx, dotsY, _upDotR);
  };

  /* ---- Shield HUD — bottom-left with orbs ---- */
  var _shMarginL = 16;
  var _shMarginB = 16;
  // Real orbs: core=5, ring=5+4=9, ratio 1:1.8 — HUD orbs scaled up maintaining same ratio
  var _shOrbR    = 10;           // core radius
  var _shOrbRing = 18;           // glow ring radius — thicker stroke for visibility
  var _shOrbGap  = 58;           // gap between orb centres (≥ 2×18=36 + breathing room)

  M._renderShieldHUD = function (h) {
    if (this.playerShields === undefined) return;

    var c    = LA.getColors();
    var t    = LA.laGoT;
    var maxS = this.MAX_SHIELDS;
    var curS = this.playerShields;

    var lx = _shMarginL;
    var ly = h - _shMarginB - 28;   // moved up to give bigger orbs room

    if (!this._shieldLabelTxt) {
      this._shieldLabelTxt = this.add.text(0, 0, t('laUpShield') + ':', {
        fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold',
        color: '#aaccdd', stroke: '#000000', strokeThickness: 2,
      });
      this._shieldLabelTxt.setOrigin(0, 0.5);
      this._shieldLabelTxt.setDepth(102);
      this._shieldLabelTxt.setScrollFactor(0);
    } else if (this._shieldLabelTxt.style.fontSize !== '20px') {
      this._shieldLabelTxt.setFontSize('20px');
    }
    this._shieldLabelTxt.setPosition(lx, ly);

    var orbStartX = lx + 108;   // offset for 20px "Shield:" label width
    var orbCy     = ly;
    var gt        = this.gameTime || 0;

    for (var si = 0; si < maxS; si++) {
      var active = si < curS;
      var ox = orbStartX + si * _shOrbGap;

      if (active) {
        // Outer glow ring — correct 1:1.8 ratio
        this.hudGfx.lineStyle(7, c.cyan, 0.30);
        this.hudGfx.strokeCircle(ox, orbCy, _shOrbRing);

        // Solid filled core
        this.hudGfx.fillStyle(c.cyan, 0.95);
        this.hudGfx.fillCircle(ox, orbCy, _shOrbR);

        // Connector to previous active orb
        if (si > 0 && (si - 1) < curS) {
          var prevOx = orbStartX + (si - 1) * _shOrbGap;
          var arcA   = 0.45 + 0.30 * Math.abs(Math.sin(gt * Math.PI * 5 + si * 1.7));

          // Static base wire (always-on for readability)
          this.hudGfx.lineStyle(2, c.cyan, 0.35);
          this.hudGfx.lineBetween(prevOx + _shOrbR, orbCy, ox - _shOrbR, orbCy);

          // Animated jagged lightning overlay
          var mx1 = prevOx + _shOrbGap * 0.33;
          var my1 = orbCy + Math.sin(gt * 19 + si) * 5;
          var mx2 = prevOx + _shOrbGap * 0.66;
          var my2 = orbCy + Math.sin(gt * 23 + si * 1.3) * 5;

          // Glow pass
          this.hudGfx.lineStyle(3.5, c.cyan, arcA * 0.50);
          this.hudGfx.beginPath();
          this.hudGfx.moveTo(prevOx + _shOrbR, orbCy);
          this.hudGfx.lineTo(mx1, my1);
          this.hudGfx.lineTo(mx2, my2);
          this.hudGfx.lineTo(ox - _shOrbR, orbCy);
          this.hudGfx.strokePath();

          // Bright white core spark
          this.hudGfx.lineStyle(1.5, 0xddf4ff, arcA * 0.85);
          this.hudGfx.beginPath();
          this.hudGfx.moveTo(prevOx + _shOrbR, orbCy);
          this.hudGfx.lineTo(mx1, my1);
          this.hudGfx.lineTo(mx2, my2);
          this.hudGfx.lineTo(ox - _shOrbR, orbCy);
          this.hudGfx.strokePath();
        }
      } else {
        // Empty slot — same 1:1.8 proportion, very dim
        this.hudGfx.lineStyle(7, 0xffffff, 0.10);
        this.hudGfx.strokeCircle(ox, orbCy, _shOrbRing);
        this.hudGfx.fillStyle(0xffffff, 0.06);
        this.hudGfx.fillCircle(ox, orbCy, _shOrbR);
      }
    }
  };

})();
