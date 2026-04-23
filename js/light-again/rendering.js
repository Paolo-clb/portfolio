/* ==========================================================================
   Light Again — Rendering: Textures, Theme, Player, Enemies, Projectiles, HUD
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._genTextures = function () {
    var c = LA.getColors();
    var tm = this.textures;
    this._texTheme = document.documentElement.getAttribute('data-theme') || 'light';

    var ca = c.cyanArr;
    LA.buildArrowTex(tm, '_ar_cyan',  ca[0], ca[1], ca[2], C.SIZE, 18, false);
    var ya = c.yellowArr;
    LA.buildArrowTex(tm, '_ar_yel',   ya[0], ya[1], ya[2], C.SIZE, 18, false);
    LA.buildArrowTex(tm, '_ar_atk',   255, 30, 60,  C.SIZE, 18, false);
    LA.buildArrowTex(tm, '_ar_datk',  255, 20, 200, C.SIZE * 1.35, 28, true);
    var da = c.dashArrowArr;
    LA.buildArrowTex(tm, '_ar_dash',  da[0], da[1], da[2], C.SIZE, 18, false);
    LA.buildArrowTex(tm, '_ar_whiff', 80,  80,  90, C.SIZE, 4, false);

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
      var texK = e.tier === 3 ? '_bruiser' : e.tier === 2 ? '_shooter' : '_enemy';
      e.spr.setTexture(texK);
      for (var j = 0; j < e.trSpr.length; j++) e.trSpr[j].setTexture(texK);
    }
  };

  M._pTexKey = function () {
    var p = this.p;
    if (p.state === 'DASH_ATTACKING') return '_ar_datk';
    if (p.state === 'ATTACKING')      return '_ar_atk';
    if (p.state === 'DASHING')        return '_ar_dash';
    if (p.state === 'RECOVERY' && p.recoveryWhiff) return '_ar_whiff';
    return p.dashAvailable ? '_ar_cyan' : '_ar_yel';
  };

  M._renderPlayer = function () {
    var p = this.p;
    var key = this._pTexKey();

    // Normal hit i-frames: flicker
    if (p.invincible && !p.dashInvinc && !this._twActive && Math.floor(this.gameTime * 12.5) % 2 === 0) {
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
      // Golden phantom look during time stop — more visible than before
      var twGhost = 0.60 + 0.20 * Math.sin(this.gameTime * Math.PI * 3);
      this.playerSpr.setTint(0xffc832);
      this.playerSpr.setAlpha(twGhost);
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
    } else if (p.invincible && p.dashInvinc) {
      this.playerSpr.setTint(0x00ffff);
      this.playerSpr.setAlpha(0.85);
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
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
      if (p.invincible && p.dashInvinc) sl.spr.setTint(0x00ffff);
      else sl.spr.clearTint();
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

  M._renderProjectiles = function () {
    var gt = this.gameTime;

    // Decay all active trail slots
    for (var si = 0; si < this._projTrailPool.length; si++) {
      var sl = this._projTrailPool[si];
      if (!sl.active) continue;
      sl.alpha -= 0.07;
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

  M._renderHUD = function () {
    var p = this.p, cam = this.cameras.main;
    var cx = cam.width / 2, h = cam.height;
    var c = LA.getColors();

    this.hudGfx.clear();

    // Dash cooldown bar — divisor matches the actual cooldown set at dash end
    if (!p.dashAvailable) {
      var bW = 100, bH = 4, bX = cx - 50, bY = h - 28;
      var dashCdMax = C.DASH_CD * ((this._upgradeLevels && this._upgradeLevels.dash >= 1) ? 0.70 : 1.0);
      var f = p.state === 'DASHING' ? 0 : Math.max(0, Math.min(1, 1 - p.dashCooldown / dashCdMax));
      this.hudGfx.fillStyle(0xffffff, 0.10);
      this.hudGfx.fillRect(bX, bY, bW, bH);
      this.hudGfx.fillStyle(c.cyan, 0.8);
      this.hudGfx.fillRect(bX, bY, bW * f, bH);
    }

    // Star Power timer bar (above dash bar)
    if (this.isStarPowered) {
      var spW = 100, spH = 5, spX = cx - 50, spY = h - 40;
      var spF = this._starPowerTimer / C.STAR_DUR;
      this.hudGfx.fillStyle(0xffffff, 0.10);
      this.hudGfx.fillRect(spX, spY, spW, spH);
      var spAlpha = this._starPowerWarning
        ? (0.5 + 0.5 * Math.abs(Math.sin(this.gameTime * Math.PI * 6)))
        : 0.9;
      this.hudGfx.fillStyle(C.STAR_TINT, spAlpha);
      this.hudGfx.fillRect(spX, spY, spW * spF, spH);
    }

    // The World — cooldown / duration bar (below dash bar)
    if (this._twUnlocked) {
      var twW = 100, twH = 4, twX = cx - 50, twY = h - 18;
      this.hudGfx.fillStyle(0xffffff, 0.10);
      this.hudGfx.fillRect(twX, twY, twW, twH);
      if (this._twActive) {
        // Duration bar: drains red
        // Bar drains from activation (includes wave phase) for immediate visual feedback
        var twTotalMs = (this._twWaveDurationMs || 0) + C.TW_DURATION;
        var twF = Math.max(0, 1.0 - (this._twTotalElapsed || 0) / twTotalMs);
        var twAlpha = 0.7 + 0.3 * Math.abs(Math.sin(this.gameTime * Math.PI * 4));
        this.hudGfx.fillStyle(0xcc1111, twAlpha);
        this.hudGfx.fillRect(twX, twY, twW * twF, twH);
      } else if (this._twCooldown > 0) {
        // Cooldown bar: fills up slowly
        var twCF = 1 - this._twCooldown / C.TW_COOLDOWN;
        this.hudGfx.fillStyle(0x888888, 0.5);
        this.hudGfx.fillRect(twX, twY, twW * twCF, twH);
      } else {
        // Ready: full red bar pulsing
        var twReadyA = 0.6 + 0.3 * Math.abs(Math.sin(this.gameTime * Math.PI * 1.5));
        this.hudGfx.fillStyle(0xcc1111, twReadyA);
        this.hudGfx.fillRect(twX, twY, twW, twH);
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
    this._renderUpgradeHUD(cx, h);

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

  M._renderUpgradeHUD = function (cx, h) {
    if (!this._upgradeLevels) return;
    var lvls = this._upgradeLevels;
    var w    = this.cameras.main.width;

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
      var iy = h - _upMarginB - _upIconSize - _upDotR * 2 - 6;

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

  /* ---- The World icon — golden, after normal upgrade icons ---- */
  M._renderTheWorldIcon = function (h) {
    var w    = this.cameras.main.width;
    var lvls = this._upgradeLevels || {};

    // Count how many normal upgrades are acquired (for positioning)
    var normalCount = 0;
    for (var i = 0; i < _upOrder.length; i++) {
      if (lvls[_upOrder[i]] > 0) normalCount++;
    }

    // Place TW icon after normal icons
    var ix = w - _upMarginR - (normalCount + 1) * (_upIconSize + _upGap) + _upGap;
    var iy = h - _upMarginB - _upIconSize - _upDotR * 2 - 6;

    var gt = this.gameTime || 0;
    var redPulse = 0.65 + 0.25 * Math.sin(gt * Math.PI * 1.2);
    var ready = this._twCooldown <= 0 && !this._twActive;
    var borderCol = 0xcc1111;
    var borderA = ready ? redPulse : 0.40;

    // Icon background
    this.hudGfx.fillStyle(0x120e04, 0.90);
    this.hudGfx.fillRect(ix, iy, _upIconSize, _upIconSize);

    // Border (2px) — pulses when ready
    this.hudGfx.lineStyle(2, borderCol, borderA);
    this.hudGfx.strokeRect(ix, iy, _upIconSize, _upIconSize);

    // Inner circle: golden hourglass hint
    var dotCx = ix + _upIconSize / 2;
    var dotCy = iy + _upIconSize / 2;
    this.hudGfx.fillStyle(borderCol, ready ? 0.30 : 0.12);
    this.hudGfx.fillCircle(dotCx, dotCy, 10);

    // Single golden dot below
    var dotsY = iy + _upIconSize + 5;
    this.hudGfx.fillStyle(borderCol, 0.92);
    this.hudGfx.fillCircle(dotCx, dotsY, _upDotR);

    // "TW" text label inside icon
    if (this._twIconTxt) {
      this._twIconTxt.setPosition(dotCx, dotCy);
      this._twIconTxt.setAlpha(ready ? redPulse : 0.55);
    }
  };

  /* ---- Shield HUD — bottom-left with orbs ---- */
  var _shMarginL = 16;
  var _shMarginB = 16;
  var _shOrbR    = 7;    // core radius — same 1.8x ratio as real orbs (5→9)
  var _shOrbGap  = 34;   // gap between orb centres

  M._renderShieldHUD = function (h) {
    if (this.playerShields === undefined) return;

    var c    = LA.getColors();
    var t    = LA.laGoT;
    var maxS = this.MAX_SHIELDS;
    var curS = this.playerShields;

    // "Shield:" label
    var lx = _shMarginL;
    var ly = h - _shMarginB - 20;

    // We use hudGfx text-style label via Phaser text — but since this is canvas drawing
    // we'll draw it once as a positioned text object. Lazy-init.
    if (!this._shieldLabelTxt) {
      this._shieldLabelTxt = this.add.text(0, 0, t('laUpShield') + ':', {
        fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold',
        color: '#aaccdd', stroke: '#000000', strokeThickness: 2,
      });
      this._shieldLabelTxt.setOrigin(0, 0.5);
      this._shieldLabelTxt.setDepth(102);
      this._shieldLabelTxt.setScrollFactor(0);
    }
    this._shieldLabelTxt.setPosition(lx, ly);

    // Orbs start after the label text
    var orbStartX = lx + 82;
    var orbCy     = ly;
    var gt        = this.gameTime || 0;

    for (var si = 0; si < maxS; si++) {
      var active = si < curS;
      var ox = orbStartX + si * _shOrbGap;

      if (active) {
        // Thin outer glow ring — matches real orb style (lineStyle 4, alpha 0.30)
        this.hudGfx.lineStyle(4, c.cyan, 0.30);
        this.hudGfx.strokeCircle(ox, orbCy, _shOrbR + 5);

        // Solid filled core — matches real orb style (fillStyle cyan, 0.95)
        this.hudGfx.fillStyle(c.cyan, 0.95);
        this.hudGfx.fillCircle(ox, orbCy, _shOrbR);

        // Lightning arcs between adjacent active orbs
        if (si > 0 && (si - 1) < curS) {
          var prevOx = orbStartX + (si - 1) * _shOrbGap;
          var arcA   = 0.25 + 0.25 * Math.sin(gt * Math.PI * 5 + si * 1.7);

          // Jagged lightning: 3-segment arc
          var mx1 = prevOx + _shOrbGap * 0.33;
          var my1 = orbCy + (Math.sin(gt * 19 + si) * 4);
          var mx2 = prevOx + _shOrbGap * 0.66;
          var my2 = orbCy + (Math.sin(gt * 23 + si * 1.3) * 4);

          // Glow line
          this.hudGfx.lineStyle(2.5, c.cyan, arcA * 0.4);
          this.hudGfx.beginPath();
          this.hudGfx.moveTo(prevOx + _shOrbR, orbCy);
          this.hudGfx.lineTo(mx1, my1);
          this.hudGfx.lineTo(mx2, my2);
          this.hudGfx.lineTo(ox - _shOrbR, orbCy);
          this.hudGfx.strokePath();

          // Bright core line
          this.hudGfx.lineStyle(1, 0xffffff, arcA * 0.7);
          this.hudGfx.beginPath();
          this.hudGfx.moveTo(prevOx + _shOrbR, orbCy);
          this.hudGfx.lineTo(mx1, my1);
          this.hudGfx.lineTo(mx2, my2);
          this.hudGfx.lineTo(ox - _shOrbR, orbCy);
          this.hudGfx.strokePath();
        }
      } else {
        // Empty slot — faint outer ring + dim core, same proportions as active
        this.hudGfx.lineStyle(4, 0xffffff, 0.10);
        this.hudGfx.strokeCircle(ox, orbCy, _shOrbR + 5);
        this.hudGfx.fillStyle(0xffffff, 0.06);
        this.hudGfx.fillCircle(ox, orbCy, _shOrbR);
      }
    }
  };

})();
