/* ==========================================================================
   Light Again — Rendering: Textures, Theme, Player, Enemies, Projectiles, HUD
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  // Channel-lerp two 0xRRGGBB colours (t in 0..1) — used for tier-tinted enemy trails.
  function _lerpHex(a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((((ar + (br - ar) * t) | 0) << 16) | (((ag + (bg - ag) * t) | 0) << 8) | ((ab + (bb - ab) * t) | 0));
  }

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
    LA.buildSparkTex(tm, '_spark');   // soft radial-gradient particle for the ADD emitters
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
    if (this.pcbDeep) this.pcbDeep.setTexture('_pcb');
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
    if (!p) return '_ar_cyan';   // null-safe during death/restart transitions
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
    // Hardened against a null player: _renderPlayer is also called from the
    // hitstop fast-path (scene.update) without re-checking p, so a death/restart
    // landing on a hitstop frame would otherwise throw here and freeze the loop.
    if (!p) return;
    var key = this._pTexKey();

    // Normal hit i-frames: flicker (suppressed during the anomaly intro so
    // the player stays clearly visible while the cinematic plays).
    if (p.invincible && !p.dashInvinc && !this._twActive && !this._anomalyIntroActive
        && Math.floor(this.gameTime * 12.5) % 2 === 0) {
      this.playerSpr.setVisible(false);
      for (var i = 0; i < this.TRAIL_CAP; i++) this._trail[i].spr.setVisible(false);
      // This early-return is BEFORE the Star Power aura redraw below; clear it here
      // too, else the aura freezes/desyncs during the hit i-frame flicker.
      if (this._starAuraGfx) this._starAuraGfx.clear();
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

    // Boss power-up surge — a brief scale + glow override that overrides the
    // state tints above ("the arrow gets stronger"). _powerUpT is set by
    // _playerPowerUpFx and decays in scene.update.
    if (this._powerUpT > 0) {
      var puPulse = Math.sin((1 - Math.max(0, this._powerUpT) / 0.62) * Math.PI);  // 0 → 1 → 0
      this.playerSpr.setScale(baseScale * (1 + 0.9 * puPulse));
      this.playerSpr.setBlendMode(Phaser.BlendModes.ADD);
      this.playerSpr.setAlpha(1.0);
      this.playerSpr.setTint(this._powerUpSteve ? 0xc8a0ff : 0x88ffff);
    }

    // Reactive bloom (created in scene.create): brighter in dash / dash-attack and
    // as the combo climbs; colour follows the state when the FX supports it.
    if (this._playerGlow) {
      var gloCol, gloStr;
      if (this._twActive)                                  { gloCol = 0xffc832; gloStr = 5; }
      else if (p.state === 'DASH_ATTACKING')               { gloCol = 0xff66ff; gloStr = 7; }
      else if (p.invincible && p.dashInvinc)               { gloCol = 0x66ffff; gloStr = 6; }
      else if (p.state === 'RECOVERY' && p.recoveryWhiff)  { gloCol = 0x8899aa; gloStr = 1; }
      else {
        gloCol = p.dashAvailable ? 0x9fefff : 0xffd060;
        gloStr = 2 + Math.min(4, (cm - 1) / 12) + 0.6 * Math.sin(this.gameTime * Math.PI * 4);
      }
      this._playerGlow.outerStrength = Math.max(0, gloStr);
      this._playerGlow.color = gloCol;
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
      var trFrac = (hi + 1) / (this._trN + 1);
      sl.spr.setAlpha(trFrac * trFrac * (p.invincible && p.dashInvinc ? 0.6 : 0.4));  // eased fade → liquid trail
      var trSc = baseScale * (trFrac * 0.55 + 0.45);
      sl.spr.setScale(trSc * (1 + 0.18 * trFrac), trSc);  // stretch along facing = motion smear
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
        // Warm the basic trail from deep blue (old) → live colour (recent) so even
        // the resting cyan/yellow arrow leaves a graded comet, not flat clones.
        sl.spr.setTint(_lerpHex(0x0a2a4a, p.dashAvailable ? 0x00ffff : 0xffcc33, trFrac));
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

        // A shielded T3 can be marked → condemned with its shield STILL up (the
        // mark-detonation ignores the shield). The tier-3 block below — the only
        // place that clears/redraws e.shieldGfx — is skipped by this `continue`,
        // so its cyan ring would otherwise stay frozen on the now-crimson sprite.
        if (e.shieldGfx) e.shieldGfx.clear();

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
          e.spr.setScale(1.0 + 0.035 * Math.sin(gt * Math.PI * 2.2 + i * 0.7));  // heavy, slow idle
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
          // Clamp to [0,1]: a shooter waiting on a saturated projectile pool can hold
          // chargeTimer at/below 0, and an unclamped (1 - chargeTimer/DUR) would blow
          // the scale up (the "giant shooter" bug). Defensive belt for the timer fix.
          var chg = Math.max(0, Math.min(1, 1 - e.chargeTimer / C.T2_CHARGE_DUR));
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
          e.spr.setScale(1.0 + 0.045 * Math.sin(gt * Math.PI * 4 + i * 0.7));  // turret idle pulse
          e.spr.setAlpha(1.0);
        }
      } else {
        e.spr.clearTint();
        e.spr.setAlpha(1.0);
        e.spr.setScale(1.0 + 0.06 * Math.sin(gt * Math.PI * 7 + i * 0.7));  // fast "galloping" rusher idle
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
        else {
          // Comet tail: per-tier tint fading dark (old) → vivid (recent), so motion
          // and threat read at a glance instead of a flat grey after-image.
          var trFrac = (ti + 1) / (e._tn + 1);
          ts.setTint(e.tier === 3 ? _lerpHex(0x2a0033, 0x9b30e0, trFrac)
                   : e.tier === 2 ? _lerpHex(0x3a1a00, 0xffaa22, trFrac)
                   :                 _lerpHex(0x3a0010, 0xff3344, trFrac));
        }
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

    // ---- Glassy HUD backplates (behind the text) — keep the monospace counters
    //      legible over the busy PCB / camera flashes, matching the DOM pop-ups. ----
    this.hudGfx.fillStyle(0x06091a, 0.40);
    this.hudGfx.fillRoundedRect(4, 3, 92, 74, 8);
    this.hudGfx.lineStyle(1, c.cyan, 0.16);
    this.hudGfx.strokeRoundedRect(4, 3, 92, 74, 8);
    var scPlateH = this.comboMultiplier > 1 ? 74 : 38;
    this.hudGfx.fillStyle(0x06091a, 0.30);
    this.hudGfx.fillRoundedRect(cx - 62, 8, 124, scPlateH, 9);

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

    // ---- Bottom cooldown / timer bars ----
    // Hidden during the tutorial: they sit where the tutorial tip card lives and
    // would overlap its UI.
    var showBars = !this._tutorialActive;

    // ---- Dash cooldown bar ----
    if (showBars && !p.dashAvailable) {
      var dashCdMax = C.DASH_CD * ((this._upgradeLevels && this._upgradeLevels.dash >= 1) ? 0.70 : 1.0);
      var dashF = p.state === 'DASHING' ? 0 : Math.max(0, Math.min(1, 1 - p.dashCooldown / dashCdMax));
      var dashY = h - 34;
      this.hudGfx.fillStyle(c.cyan, 0.10);
      this.hudGfx.fillRoundedRect(barX, dashY, BAR_W, BAR_H, BAR_H / 2);
      this.hudGfx.lineStyle(1, c.cyan, 0.22);
      this.hudGfx.strokeRoundedRect(barX, dashY, BAR_W, BAR_H, BAR_H / 2);
      if (dashF > 0) {
        this.hudGfx.fillStyle(c.cyan, 0.88);
        this.hudGfx.fillRoundedRect(barX, dashY, Math.max(BAR_H, BAR_W * dashF), BAR_H, BAR_H / 2);
        this.hudGfx.fillStyle(0xffffff, 0.60);
        this.hudGfx.fillCircle(barX + BAR_W * dashF, dashY + BAR_H / 2, BAR_H * 0.5);
      }
    }

    // ---- Star Power timer bar ----
    if (showBars && this.isStarPowered) {
      // Bar is relative to the biggest charge held this session (_starPowerMax) so a
      // long Cache-Zone Overdrive fills it without overflowing, and an accumulating
      // pickup extends it; clamp for safety. Falls back to STAR_DUR if unset.
      var starMax = this._starPowerMax || C.STAR_DUR;
      var starF  = Math.max(0, Math.min(1, this._starPowerTimer / starMax));
      var starY  = h - 48;
      var starA  = this._starPowerWarning
        ? (0.45 + 0.55 * Math.abs(Math.sin(gt * Math.PI * 6)))
        : 0.92;
      this.hudGfx.fillStyle(C.STAR_TINT, 0.10);
      this.hudGfx.fillRoundedRect(barX, starY, BAR_W, BAR_H, BAR_H / 2);
      this.hudGfx.lineStyle(1, C.STAR_TINT, 0.22);
      this.hudGfx.strokeRoundedRect(barX, starY, BAR_W, BAR_H, BAR_H / 2);
      if (starF > 0.01) {
        this.hudGfx.fillStyle(C.STAR_TINT, starA);
        this.hudGfx.fillRoundedRect(barX, starY, Math.max(BAR_H, BAR_W * starF), BAR_H, BAR_H / 2);
        this.hudGfx.fillStyle(0xffffff, 0.55);
        this.hudGfx.fillCircle(barX + BAR_W * starF, starY + BAR_H / 2, BAR_H * 0.5);
      }
    }

    // ---- The World bar ----
    if (showBars && this._twUnlocked) {
      var twY = h - 20;
      if (this._twActive) {
        var twTotalMs = (this._twWaveDurationMs || 0) + C.TW_DURATION;
        var twF       = Math.max(0, 1.0 - (this._twTotalElapsed || 0) / twTotalMs);
        var twPulseA  = 0.72 + 0.28 * Math.abs(Math.sin(gt * Math.PI * 4));
        this.hudGfx.fillStyle(0xcc1111, 0.14);
        this.hudGfx.fillRoundedRect(barX, twY, BAR_W, BAR_H, BAR_H / 2);
        this.hudGfx.lineStyle(1, 0xcc1111, 0.35);
        this.hudGfx.strokeRoundedRect(barX, twY, BAR_W, BAR_H, BAR_H / 2);
        if (twF > 0.01) {
          this.hudGfx.fillStyle(0xdd1111, twPulseA);
          this.hudGfx.fillRoundedRect(barX, twY, Math.max(BAR_H, BAR_W * twF), BAR_H, BAR_H / 2);
          this.hudGfx.fillStyle(0xff6666, 0.90);
          this.hudGfx.fillCircle(barX + BAR_W * twF, twY + BAR_H / 2, BAR_H * 0.5);
        }
      } else if (this._twCooldown <= 0) {
        var twReadyA = 0.55 + 0.35 * Math.abs(Math.sin(gt * Math.PI * 1.8));
        this.hudGfx.fillStyle(0xcc1111, twReadyA * 0.22);
        this.hudGfx.fillRoundedRect(barX - 2, twY - 1, BAR_W + 4, BAR_H + 2, (BAR_H + 2) / 2);
        this.hudGfx.fillStyle(0xdd1111, twReadyA);
        this.hudGfx.fillRoundedRect(barX, twY, BAR_W, BAR_H, BAR_H / 2);
        this.hudGfx.lineStyle(1, 0xff4444, twReadyA * 0.80);
        this.hudGfx.strokeRoundedRect(barX, twY, BAR_W, BAR_H, BAR_H / 2);
      }
    }

    // Score display — recentered each frame to handle resize
    var cx2 = cam.width / 2;
    this._scoreTxt.setPosition(cx2, 16);
    if (this.score !== this._lastScore) {
      this._lastScore = this.score;
      this._scoreTxt.setText(this.score);
    }
    // Score: red tint during TW, cyan otherwise. Guarded behind a state cache —
    // setColor reparses the CSS string and re-rasterises the text canvas on every
    // call, so running it unconditionally each frame was a needless per-frame GPU
    // texture upload. The colour only flips when TW toggles.
    var scoreTwNow = !!this._twActive;
    if (scoreTwNow !== this._lastScoreTw) {
      this._lastScoreTw = scoreTwNow;
      if (scoreTwNow) {
        this._scoreTxt.setColor('#ff3333');
        this._scoreTxt.setAlpha(0.75);
      } else {
        this._scoreTxt.setColor('#00ffff');
        this._scoreTxt.setAlpha(0.95);
      }
    }

    // ---- Signal-Amplifier "X2" badge (Greed platform) ----
    // Shown just right of the score whenever the ×2 is live; a green pulse on the
    // badge + a subtle scale-throb on the score number sell the doubling.
    if (this._greedMultTxt) {
      if (this._greedActive) {
        this._greedBadgePulse = Math.min(1, (this._greedBadgePulse || 0) + (dt || 0.016) * 3.5);
        var gThrob = 0.85 + 0.15 * Math.abs(Math.sin(gt * Math.PI * 3));
        // Park the badge to the right of the (centre-anchored) score number.
        var scoreHalf = this._scoreTxt.width * 0.5;
        this._greedMultTxt.setPosition(cx2 + scoreHalf + 8, 18);
        this._greedMultTxt.setAlpha(this._greedBadgePulse * gThrob);
        this._greedMultTxt.setScale(1 + 0.12 * Math.abs(Math.sin(gt * Math.PI * 3)));
        // Subtle score-number throb while doubling (restored to 1 when it ends).
        this._scoreTxt.setScale(1 + 0.05 * Math.abs(Math.sin(gt * Math.PI * 3)));
        this._scoreGreedThrobbing = true;
      } else if (this._greedBadgePulse > 0) {
        this._greedBadgePulse = Math.max(0, this._greedBadgePulse - (dt || 0.016) * 4);
        this._greedMultTxt.setAlpha(this._greedBadgePulse);
        if (this._greedBadgePulse <= 0 && this._scoreGreedThrobbing) {
          this._scoreTxt.setScale(1);            // release the throb once faded out
          this._scoreGreedThrobbing = false;
        }
      }
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
  var _upOrder    = ['dashAtk', 'detonation', 'dash', 'baseAtk', 'shield', 'drone'];
  var _curseOrder = ['glassHeart', 'dashRage', 'cursedBlast'];
  var _upIconSize = 46;
  var _upGap      = 10;
  var _upDotR     = 2.5;
  var _upMarginR  = 16;
  var _upMarginB  = 16;

  /* ---- Shared upgrade-icon PLACEHOLDER (HUD canvas twin of LA.ICON_PLACEHOLDER_SVG) ----
     Real per-upgrade art is coming; until then every icon surface (draft, HUD,
     mode-select) draws this same generic "image" frame. Centred at (cx,cy),
     `size` px wide, stroked in `color`. Keep in sync with LA.ICON_PLACEHOLDER_SVG. */
  M._drawIconPlaceholder = function (cx, cy, size, color, alpha) {
    var g = this.hudGfx, s = size / 24;
    g.lineStyle(Math.max(1.4, 2 * s), color, alpha);
    g.strokeRoundedRect(cx - 9 * s, cy - 9 * s, 18 * s, 18 * s, 2.5 * s);  // frame  (3..21)
    g.strokeCircle(cx - 3.5 * s, cy - 3.5 * s, 1.6 * s);                   // sun    (8.5,8.5)
    g.beginPath();                                                        // mountain
    g.moveTo(cx + 9 * s, cy + 3 * s);       // 21,15
    g.lineTo(cx + 3.5 * s, cy - 2.5 * s);   // 15.5,9.5
    g.lineTo(cx - 7 * s, cy + 8 * s);       // 5,20
    g.strokePath();
  };

  /* ---- Per-upgrade art (HUD canvas twin of LA.iconSvg) ----
     Same LA.ICONS ops (0..24 grid) as the SVG renderer, so the HUD, the draft
     and the mode-select loadout share one silhouette. Centred at (cx,cy),
     `size` px wide, stroked in `color`. */
  M._drawIconOps = function (ops, cx, cy, size, color, alpha) {
    var g = this.hudGfx, s = size / 24;
    function X(v) { return cx + (v - 12) * s; }
    function Y(v) { return cy + (v - 12) * s; }
    g.lineStyle(Math.max(1.4, 2 * s), color, alpha);
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i], t = op[0];
      if (t === 'rrect') { g.strokeRoundedRect(X(op[1]), Y(op[2]), op[3] * s, op[4] * s, op[5] * s); }
      else if (t === 'circle') { g.strokeCircle(X(op[1]), Y(op[2]), op[3] * s); }
      else if (t === 'dot') { g.fillStyle(color, alpha); g.fillCircle(X(op[1]), Y(op[2]), op[3] * s); }
      else if (t === 'line') { g.beginPath(); g.moveTo(X(op[1]), Y(op[2])); g.lineTo(X(op[3]), Y(op[4])); g.strokePath(); }
      else if (t === 'poly') {
        var pts = op[1];
        g.beginPath(); g.moveTo(X(pts[0]), Y(pts[1]));
        for (var p = 2; p < pts.length; p += 2) g.lineTo(X(pts[p]), Y(pts[p + 1]));
        if (op[2]) g.closePath();
        g.strokePath();
      }
    }
  };

  M._drawUpgradeIcon = function (id, cx, cy, size, color, alpha) {
    var ops = LA.ICONS && (LA.ICONS[id] || LA.ICONS['default']);
    if (ops) this._drawIconOps(ops, cx, cy, size, color, alpha);
    else this._drawIconPlaceholder(cx, cy, size, color, alpha);
  };

  M._renderUpgradeHUD = function (cx, h, dt) {
    if (!this._upgradeLevels) return;
    var lvls = this._upgradeLevels;
    var w    = this.cameras.main.width;
    var iy   = h - _upMarginB - _upIconSize - _upDotR * 2 - 6;

    // ---- Boss-spawn counter (kills until the next boss) / DANGER while a boss
    //      is on the field. Bosses are the only upgrade source now. ----
    if (!this._upgradeDraftOpen && !this._tutorialActive) {
      var bossAlive = !!(this._anomaly || this._gigaBruiser || this._mirror || this._snake);

      if (!this._killCounterTxt) {
        this._killCounterTxt = this.add.text(0, 0, '', {
          fontFamily: 'monospace', fontSize: '25px',
          color: '#6699bb', stroke: '#000000', strokeThickness: 3.5,
        });
        this._killCounterTxt.setOrigin(1, 1);
        this._killCounterTxt.setDepth(102);
        this._killCounterTxt.setScrollFactor(0);
        // The object is born with empty text; clear the value cache so the first
        // setText/setColor below always fires (otherwise a stale cache from a
        // previous run could skip it and leave the counter blank).
        this._lastKcText = null;
        this._lastKcColor = null;
      }

      var kcText, kcColor, kcRatio, kcBarA;
      if (bossAlive) {
        // Counter is "paused" — kills during a boss fight don't count. Show DANGER.
        var dPulse = 0.5 + 0.5 * Math.abs(Math.sin(this.gameTime * Math.PI * 3));
        kcText  = '⚠ DANGER';
        kcColor = '#ff3344';
        kcRatio = 0;
        kcBarA  = 0.45 + 0.45 * dPulse;
        this._killCounterTxt.setScale(1.0);
        this._killCounterTxt.setAlpha(0.7 + dPulse * 0.3);
      } else {
        var killsLeft = Math.max(0, (this._bossKillThreshold || 0) - this.totalKills);
        if (this._lastKillsLeft !== killsLeft) {
          this._lastKillsLeft    = killsLeft;
          this._killCounterPulse = 1.0;
        }
        var kDt = dt || 0.016;
        this._killCounterPulse = Math.max(0, (this._killCounterPulse || 0) - kDt * 3.5);
        var kcInterval = this._bossKillInterval || C.BOSS_KILL_INTERVAL;
        kcRatio = killsLeft / kcInterval;  // 1.0 just after a boss → 0.0 at the next one
        kcColor = kcRatio <= 0.10 ? '#ff7733' : kcRatio <= 0.25 ? '#ffcc44' : '#6699bb';
        kcText  = '☠ ' + killsLeft;   // ☠ kills-to-boss
        kcBarA  = 0.72;
        this._killCounterTxt.setScale(1.0 + (this._killCounterPulse || 0) * 0.22);
        this._killCounterTxt.setAlpha(0.78 + (this._killCounterPulse || 0) * 0.22);
      }
      // Guard setText/setColor behind a last-value cache: both re-rasterise the
      // text canvas, and kcText ('☠ ' + killsLeft) only changes on a kill while
      // kcColor only changes at a threshold — so this was re-uploading an
      // identical texture 60×/s. setPosition/setVisible are cheap, stay every frame.
      if (kcText !== this._lastKcText) {
        this._lastKcText = kcText;
        this._killCounterTxt.setText(kcText);
      }
      if (kcColor !== this._lastKcColor) {
        this._lastKcColor = kcColor;
        this._killCounterTxt.setColor(kcColor);
      }
      this._killCounterTxt.setPosition(w - _upMarginR, iy - 34);
      this._killCounterTxt.setVisible(true);

      // Thin progress bar aligned to counter right edge
      var prog  = bossAlive ? 1 : 1 - Math.min(1, kcRatio);
      var pbW   = 100;
      var pbX   = w - _upMarginR - pbW;
      var pbY   = iy - 20;
      var pbCol = bossAlive ? 0xff3344 : (kcRatio <= 0.10 ? 0xff7733 : kcRatio <= 0.25 ? 0xffcc44 : 0x3366aa);
      this.hudGfx.fillStyle(pbCol, 0.10);
      this.hudGfx.fillRect(pbX, pbY, pbW, 3);
      this.hudGfx.fillStyle(pbCol, kcBarA);
      this.hudGfx.fillRect(pbX, pbY, pbW * prog, 3);
    } else if (this._killCounterTxt) {
      this._killCounterTxt.setVisible(false);
    }

    // Collect acquired upgrades + taken curses (preserve display order). Reuse
    // instance arrays (reset via length=0) instead of allocating two arrays each
    // frame — the contents only change at a draft / curse pickup.
    var acquired = this._hudAcquired || (this._hudAcquired = []);
    acquired.length = 0;
    for (var i = 0; i < _upOrder.length; i++) {
      if (lvls[_upOrder[i]] > 0) acquired.push(_upOrder[i]);
    }
    var curses = this._hudCurses || (this._hudCurses = []);
    curses.length = 0;
    var tcz = this._takenCurses || {};
    for (var ci = 0; ci < _curseOrder.length; ci++) {
      if (tcz[_curseOrder[ci]]) curses.push(_curseOrder[ci]);
    }
    this._hudIconCount = acquired.length + curses.length;  // used by _renderTheWorldIcon positioning
    if (this._hudIconCount === 0) return;

    // Stack icons horizontally leftward from bottom-right corner
    for (var j = 0; j < acquired.length; j++) {
      var id  = acquired[j];
      var lvl = lvls[id];

      var ix = w - _upMarginR - (acquired.length - j) * (_upIconSize + _upGap) + _upGap;

      // Border color: cyan=Lv1, gold=Lv2, violet=Lv3 (capstone)
      var borderCol = lvl >= 3 ? 0xb478ff : (lvl >= 2 ? 0xffc832 : 0x00ffff);
      var borderA   = lvl >= 3 ? 0.82 : (lvl >= 2 ? 0.75 : 0.60);

      // Icon background — rounded, glassy (coherent with the draft cards' radius)
      this.hudGfx.fillStyle(0x080a1c, 0.88);
      this.hudGfx.fillRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);

      // Faux additive outer glow (stronger for Lv2/Lv3 via borderA) + crisp border
      this.hudGfx.lineStyle(5, borderCol, borderA * 0.12);
      this.hudGfx.strokeRoundedRect(ix - 1, iy - 1, _upIconSize + 2, _upIconSize + 2, 10);
      this.hudGfx.lineStyle(3, borderCol, borderA * 0.20);
      this.hudGfx.strokeRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
      this.hudGfx.lineStyle(2, borderCol, borderA);
      this.hudGfx.strokeRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);

      // Inner icon — shared placeholder (real per-upgrade art TBD)
      var dotCx = ix + _upIconSize / 2;
      var dotCy = iy + _upIconSize / 2;
      this._drawUpgradeIcon(id, dotCx, dotCy, 28, borderCol, 0.9);

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

    // Curse icons — magenta boxes with a warning glyph, to the LEFT of the
    // upgrades. The colour matches the Curse Fountain (0xd11e74 / hot-pink core
    // 0xff66bf) so curses read as "rose magenta", clearly distinct from The
    // World's red icon to their left.
    for (var ck = 0; ck < curses.length; ck++) {
      var cix = w - _upMarginR - (acquired.length + curses.length - ck) * (_upIconSize + _upGap) + _upGap;
      this.hudGfx.fillStyle(0x16061c, 0.90);
      this.hudGfx.fillRoundedRect(cix, iy, _upIconSize, _upIconSize, 9);
      this.hudGfx.lineStyle(4, 0xd11e74, 0.16);
      this.hudGfx.strokeRoundedRect(cix, iy, _upIconSize, _upIconSize, 9);
      this.hudGfx.lineStyle(2, 0xd11e74, 0.80);
      this.hudGfx.strokeRoundedRect(cix, iy, _upIconSize, _upIconSize, 9);
      // Per-curse art (glassHeart / dashRage / cursedBlast), tinted fountain magenta.
      this._drawUpgradeIcon(curses[ck], cix + _upIconSize / 2, iy + _upIconSize / 2, 28, 0xff66bf, 0.9);
    }
  };

  /* ---- The World icon — tri-state: ready / active / cooldown (greyed) ---- */
  M._renderTheWorldIcon = function (h) {
    var w    = this.cameras.main.width;
    var lvls = this._upgradeLevels || {};

    // Position to the left of all the upgrade + curse icons (count set by _renderUpgradeHUD).
    var iconCount = this._hudIconCount || 0;
    var ix = w - _upMarginR - (iconCount + 1) * (_upIconSize + _upGap) + _upGap;
    var iy = h - _upMarginB - _upIconSize - _upDotR * 2 - 6;

    var gt    = this.gameTime || 0;
    var dotCx = ix + _upIconSize / 2;
    var dotCy = iy + _upIconSize / 2;
    var active = this._twActive;
    var onCD   = !active && this._twCooldown > 0;
    var ready  = !active && !onCD;

    if (active) {
      // --- ACTIVE: red background, vertical drain fill ---
      this.hudGfx.fillStyle(0x2a0a0a, 0.95);
      this.hudGfx.fillRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
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
      this.hudGfx.lineStyle(2, 0xff4444, 0.70 + 0.30 * Math.abs(Math.sin(gt * Math.PI * 4)));
      this.hudGfx.strokeRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
    } else if (onCD) {
      // --- COOLDOWN: clearly dimmed, fill rising from bottom (dim red so the
      //     icon stays in The World's red family even while charging) ---
      this.hudGfx.fillStyle(0x120808, 0.95);
      this.hudGfx.fillRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
      var cdFrac  = 1 - this._twCooldown / C.TW_COOLDOWN;
      var cdH     = Math.round((_upIconSize - 2) * cdFrac);
      var cdFillY = iy + 1 + (_upIconSize - 2) - cdH;
      this.hudGfx.fillStyle(0x4a1a1a, 0.88);
      this.hudGfx.fillRect(ix + 1, cdFillY, _upIconSize - 2, cdH);
      if (cdH > 2) {
        this.hudGfx.fillStyle(0x9a4a4a, 0.75);
        this.hudGfx.fillRect(ix + 1, cdFillY, _upIconSize - 2, 2);
      }
      this.hudGfx.lineStyle(2, 0x5a2a2a, 0.65);
      this.hudGfx.strokeRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
    } else {
      // --- READY: pulsing red fill + bright border + outer glow ---
      var rP = 0.25 + 0.18 * Math.abs(Math.sin(gt * Math.PI * 1.8));
      this.hudGfx.fillStyle(0x1a0606, 0.92);
      this.hudGfx.fillRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
      this.hudGfx.fillStyle(0xcc1111, rP);
      this.hudGfx.fillRect(ix + 1, iy + 1, _upIconSize - 2, _upIconSize - 2);
      var rBorderA = 0.70 + 0.30 * Math.abs(Math.sin(gt * Math.PI * 1.8));
      this.hudGfx.lineStyle(3, 0xff4444, rBorderA);
      this.hudGfx.strokeRoundedRect(ix, iy, _upIconSize, _upIconSize, 9);
    }

    // "TW" label — dim on CD, pulsing on ready
    if (this._twIconTxt) {
      this._twIconTxt.setPosition(dotCx, dotCy);
      this._twIconTxt.setAlpha(0); // hidden — replaced by the rose clock glyph below
    }
    var twGlyphCol = onCD ? 0x8a7a7a : 0xffc4c4;
    var twGlyphA   = onCD ? 0.32 : (active ? 0.96 : 0.82 + 0.16 * Math.abs(Math.sin(gt * Math.PI * 1.8)));
    this._drawUpgradeIcon('theWorld', dotCx, dotCy, 30, twGlyphCol, twGlyphA);

    // Dot below icon — grey on CD
    var dotsY = iy + _upIconSize + 5;
    this.hudGfx.fillStyle(onCD ? 0x444444 : 0xe01e1e, ready ? 0.92 : onCD ? 0.35 : 0.70);
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
        // Soft glow disc under the ring + outer glow ring (1:1.8 ratio)
        this.hudGfx.fillStyle(c.cyan, 0.07);
        this.hudGfx.fillCircle(ox, orbCy, _shOrbRing);
        this.hudGfx.lineStyle(7, c.cyan, 0.30);
        this.hudGfx.strokeCircle(ox, orbCy, _shOrbRing);

        // Solid filled core + specular highlight (gives the orb volume)
        this.hudGfx.fillStyle(c.cyan, 0.95);
        this.hudGfx.fillCircle(ox, orbCy, _shOrbR);
        this.hudGfx.fillStyle(0xffffff, 0.55);
        this.hudGfx.fillCircle(ox - _shOrbR * 0.35, orbCy - _shOrbR * 0.35, _shOrbR * 0.4);

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
