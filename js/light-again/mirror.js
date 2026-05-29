/* ==========================================================================
   Light Again — The Mirror (3rd mini-boss) — a rival duelist

   An independent magenta rival. It does NOT echo the player, does NOT fire,
   does NOT base-attack, and never attacks in sync with you. Its whole game is
   the DASH-ATTACK duel:

     • ROAM      — orbits the player at a preferred distance, weaving.
     • TELEGRAPH — locks a lunge direction at you, charging (aim beam).
     • DASH      — lunges fast along the locked line. Contact = 1 dmg to you
                   (respects your i-frames / dash).
     • RECOVER   — if the lunge HIT → short recovery. If it WHIFFED → a long
                   recovery (≈3× the player's whiff) during which it is
                   VULNERABLE: that is your window to punish.
     • DODGE     — when you attack it and it is NOT recovering, it dashes away
                   with i-frames (your hit whiffs). Only lands during RECOVER.

   It carries 3 shield orbs (like the player) — each successful punish breaks
   one; at zero it dies. Immune to explosions / projectiles. The World: it
   freezes when your activation shockwave reaches it, fires its OWN time-stop
   burst (shoving you back), then resumes moving. Driven by PLAYER-time so it
   keeps dueling during your World. Death drops a free upgrade.

   Self-contained on `this._mirror` — never enters `this.enemies`.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  var BODY_COL  = 0xff3aa0;   // hot-magenta rival (distinct from the cyan player)
  var ORB_COL   = 0xb060ff;   // violet shield orbs
  var VULN_COL  = 0xffe040;   // amber while recovering / vulnerable

  /* ================================================================ */
  M._initMirror = function () { this._mirror = null; };

  M._clearMirror = function (_silent) {
    var mir = this._mirror;
    this._mirror = null;
    if (!mir) return;
    if (mir.spr)     mir.spr.destroy();
    if (mir.glowSpr) mir.glowSpr.destroy();
    if (mir.gfx)     mir.gfx.destroy();
    if (mir.shieldGfx) mir.shieldGfx.destroy();
    if (mir.hintTxt) mir.hintTxt.destroy();
  };

  /* ================================================================
     SPAWN — emerges out of the player, then peels off into ROAM.
     ================================================================ */
  M._spawnMirror = function () {
    if (this._mirror || this._anomaly || this._gigaBruiser) return;
    if (!this.p || this.p.state === 'DEAD') return;
    var p = this.p;

    var glowSpr = this.add.image(p.x, p.y, '_ar_cyan');
    glowSpr.setBlendMode(Phaser.BlendModes.ADD); glowSpr.setDepth(30);
    glowSpr.setTint(BODY_COL); glowSpr.setScale(1.5); glowSpr.setAlpha(0.22);

    var spr = this.add.image(p.x, p.y, '_ar_cyan');
    spr.setBlendMode(Phaser.BlendModes.ADD); spr.setDepth(31);
    spr.setTint(BODY_COL);

    var gfx = this.add.graphics(); gfx.setDepth(33); gfx.setBlendMode(Phaser.BlendModes.ADD);
    var shieldGfx = this.add.graphics(); shieldGfx.setDepth(34); shieldGfx.setBlendMode(Phaser.BlendModes.ADD);

    var hintTxt = this.add.text(p.x, p.y, '', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#ff8ad0', stroke: '#000000', strokeThickness: 3,
    });
    hintTxt.setOrigin(0.5, 1); hintTxt.setDepth(70);

    // Spawn drifting away from the player so it visibly "peels off".
    var outAng = Math.random() * TAU;

    this._mirror = {
      x: p.x, y: p.y, vx: Math.cos(outAng) * 4, vy: Math.sin(outAng) * 4,
      angle: outAng,
      orbs: C.MIR_SHIELD_ORBS, orbsMax: C.MIR_SHIELD_ORBS,
      state: 'ROAM', stateT: 0,
      attackCD: C.MIR_ATTACK_CD * 0.8,
      dodgeCD: 0,
      lockX: 0, lockY: 0, lockAng: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      vulnerable: false,
      hitIframe: 0,
      hitT: 0, dodgeFlashT: 0, spin: 0,
      // The World handling
      twPhase: null, twTimer: 0, twWas: false,
      dead: false,
      spr: spr, glowSpr: glowSpr, gfx: gfx, shieldGfx: shieldGfx, hintTxt: hintTxt,
    };

    this._spawnWaveRing(p.x, p.y, { maxRadius: 120, color: BODY_COL, expandTime: 0.28 });
    this._explode(p.x, p.y, [255, 70, 180], 22);
    this._explode(p.x, p.y, [255, 255, 255], 12);
  };

  /* ================================================================
     UPDATE — PLAYER-time driven; not frozen by The World.
     ================================================================ */
  M._updateMirror = function (sMs, pMs, dt) {
    if (!this._mirror) return;
    var mir = this._mirror, p = this.p;
    if (p.state === 'DEAD') { this._renderMirror(dt); return; }
    if (pMs < 0.0001) { this._renderMirror(dt); return; }

    var sc60 = pMs / 16.7;
    mir.spin    += sc60 * 0.05;
    mir.hitT     = Math.max(0, mir.hitT - dt * 3.5);
    mir.dodgeFlashT = Math.max(0, mir.dodgeFlashT - dt * 4);
    mir.hitIframe = Math.max(0, mir.hitIframe - pMs);
    if (mir.dodgeCD > 0) mir.dodgeCD -= pMs;

    /* ---- The World handling (rising/falling edge) ---- */
    var tw = !!this._twActive;
    if (tw && !mir.twWas) {
      // Our activation shockwave reaches it after a short, distance-based delay.
      var ddx0 = mir.x - p.x, ddy0 = mir.y - p.y;
      var dd0  = Math.sqrt(ddx0 * ddx0 + ddy0 * ddy0);
      mir.twPhase = 'FREEZE';
      mir.twTimer = (dd0 / C.MIR_TW_WAVE_SPEED) * 1000 + 80;
    }
    if (!tw && mir.twWas) { mir.twPhase = null; }  // World ended → back to normal
    mir.twWas = tw;

    if (mir.twPhase === 'FREEZE') {
      mir.twTimer -= pMs;
      if (mir.twTimer <= 0) this._mirrorTwBurst(mir, p);  // → its own time-stop blast
      this._renderMirror(dt);
      return;  // frozen at our wave's contact
    }

    /* ---- State machine ---- */
    if (mir.state === 'ROAM')        this._mirrorRoam(mir, p, sc60, pMs);
    else if (mir.state === 'TELEGRAPH') this._mirrorTelegraph(mir, p, pMs);
    else if (mir.state === 'DASH')   this._mirrorDash(mir, p, sc60, pMs);
    else if (mir.state === 'RECOVER')this._mirrorRecover(mir, sc60, pMs);
    else if (mir.state === 'DODGE')  this._mirrorDodge(mir, sc60, pMs);

    // Integrate + world clamp
    mir.x += mir.vx * sc60;
    mir.y += mir.vy * sc60;
    var m = C.WORLD_HALF - C.MIR_SIZE * 1.5;
    if (mir.x < -m) mir.x = -m; else if (mir.x > m) mir.x = m;
    if (mir.y < -m) mir.y = -m; else if (mir.y > m) mir.y = m;

    this._renderMirror(dt);
  };

  /* ---- ROAM: orbit the player, then commit to a lunge ---- */
  M._mirrorRoam = function (mir, p, sc60, pMs) {
    var dx = p.x - mir.x, dy = p.y - mir.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dx / d, ny = dy / d;
    // Radial term: close to / open from the keep-distance. Tangential: strafe.
    var radial = (d - C.MIR_KEEP_DIST) / C.MIR_KEEP_DIST;   // <0 too close, >0 too far
    var tx = -ny * mir.strafeDir, ty = nx * mir.strafeDir;
    var desVx = (nx * radial * 2.4 + tx) * C.MIR_ROAM_SPEED;
    var desVy = (ny * radial * 2.4 + ty) * C.MIR_ROAM_SPEED;
    var k = 1 - Math.pow(1 - 0.10, sc60);
    mir.vx += (desVx - mir.vx) * k;
    mir.vy += (desVy - mir.vy) * k;
    mir.angle = Math.atan2(dy, dx);
    if (Math.random() < 0.004) mir.strafeDir = -mir.strafeDir;  // occasional weave flip

    mir.attackCD -= pMs;
    if (mir.attackCD <= 0 && d < C.MIR_KEEP_DIST * 1.8) {
      mir.state = 'TELEGRAPH'; mir.stateT = 0;
      mir.lockAng = Math.atan2(dy, dx);   // lock the lunge line NOW (dodgeable)
    }
  };

  /* ---- TELEGRAPH: brake, aim, then lunge ---- */
  M._mirrorTelegraph = function (mir, p, pMs) {
    mir.stateT += pMs;
    var fr = Math.pow(0.82, pMs / 16.7);
    mir.vx *= fr; mir.vy *= fr;
    mir.angle = mir.lockAng;
    if (mir.stateT >= C.MIR_TELEGRAPH) {
      mir.state = 'DASH'; mir.stateT = 0; mir.didHit = false;
      mir.vx = Math.cos(mir.lockAng) * C.MIR_DASH_SPEED;
      mir.vy = Math.sin(mir.lockAng) * C.MIR_DASH_SPEED;
    }
  };

  /* ---- DASH: lunge; hit the player if not dodging ---- */
  M._mirrorDash = function (mir, p, sc60, pMs) {
    mir.stateT += pMs;
    mir.angle = mir.lockAng;
    // Contact check (player damageable = not invincible, not dashing, not in TW)
    if (!mir.didHit) {
      var dx = p.x - mir.x, dy = p.y - mir.y;
      var thr = C.MIR_HIT_RADIUS + C.SIZE * 0.6;
      if (dx * dx + dy * dy < thr * thr) {
        var safe = p.invincible || p.state === 'DASHING' || this._twActive || p.state === 'DEAD';
        if (!safe) {
          var dd = Math.sqrt(dx * dx + dy * dy) || 1;
          // Push the player AWAY from the mirror (dx = p.x - mir.x).
          this._damagePlayer(dx / dd, dy / dd);
          mir.didHit = true;
          this._endMirrorDash(mir);    // connected → short recovery
          return;
        }
      }
    }
    if (mir.stateT >= C.MIR_DASH_DUR) this._endMirrorDash(mir);
  };

  M._endMirrorDash = function (mir) {
    mir.state = 'RECOVER'; mir.stateT = 0;
    if (mir.didHit) {
      mir.recoverDur = C.MIR_RECOVER_HIT;
      mir.vulnerable = false;
    } else {
      // Whiff → long recovery, VULNERABLE. ≈ 3× the player's dash-attack whiff.
      mir.recoverDur = C.DASHATK_WHIFF_DUR * C.MIR_RECOVER_MULT;
      mir.vulnerable = true;
      this._explode(mir.x, mir.y, [255, 224, 64], 10);  // "off-balance" puff
    }
  };

  /* ---- RECOVER: decelerate; vulnerable if it whiffed ---- */
  M._mirrorRecover = function (mir, sc60, pMs) {
    mir.stateT += pMs;
    var fr = Math.pow(0.86, sc60);
    mir.vx *= fr; mir.vy *= fr;
    if (mir.stateT >= mir.recoverDur) {
      mir.state = 'ROAM'; mir.stateT = 0;
      mir.vulnerable = false;
      mir.attackCD = C.MIR_ATTACK_CD * (0.85 + Math.random() * 0.4);
    }
  };

  /* ---- DODGE: quick evade dash (i-frames) ---- */
  M._mirrorDodge = function (mir, sc60, pMs) {
    mir.stateT += pMs;
    var fr = Math.pow(0.88, sc60);
    mir.vx *= fr; mir.vy *= fr;
    if (mir.stateT >= C.MIR_DODGE_DUR) {
      mir.state = 'ROAM'; mir.stateT = 0;
    }
  };

  /* ================================================================
     ITS OWN TIME-STOP — fires once our shockwave reaches it.
     ================================================================ */
  M._mirrorTwBurst = function (mir, p) {
    mir.twPhase = 'ACTIVE';
    mir.state = 'ROAM'; mir.stateT = 0; mir.vulnerable = false;
    mir.attackCD = C.MIR_ATTACK_CD * 0.5;   // gets aggressive right after

    // Shove the player back (its counter to your World).
    var dx = p.x - mir.x, dy = p.y - mir.y;
    var d  = Math.sqrt(dx * dx + dy * dy) || 1;
    p.vx += (dx / d) * C.MIR_TW_PUSH;
    p.vy += (dy / d) * C.MIR_TW_PUSH;

    // Its own time-stop blast — magenta rings, no damage (just the shove).
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: 900, color: BODY_COL, expandTime: 0.45 });
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: 560, color: 0xffffff, expandTime: 0.34 });
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: 300, color: ORB_COL,  expandTime: 0.24 });
    this._explode(mir.x, mir.y, [255, 70, 180], 34);
    this._explode(mir.x, mir.y, [180, 96, 255], 22);
    this.cameras.main.flash(220, 255, 90, 200);
    this.cameras.main.shake(180, 0.012);
  };

  /* ================================================================
     PLAYER MELEE vs MIRROR — dodge unless it's recovering (vulnerable).
     Both base-attack AND dash-attack can land (during recovery).
     ================================================================ */
  M._checkMirrorCollision = function () {
    var mir = this._mirror;
    if (!mir || mir.dead) return;
    var p = this.p;
    var isAtk = p.state === 'ATTACKING', isDAtk = p.state === 'DASH_ATTACKING';
    if (!isAtk && !isDAtk) return;

    var pR = C.SIZE * 0.6;
    var dx = p.x - mir.x, dy = p.y - mir.y;
    var d2 = dx * dx + dy * dy;
    var thr = pR + C.MIR_SIZE + (isDAtk ? 10 : 0);
    if (d2 > thr * thr) return;
    var dist = Math.sqrt(d2) || 0.001;

    // VULNERABLE (recovering from a whiff) → the hit lands, breaks an orb.
    if (mir.state === 'RECOVER' && mir.vulnerable && mir.hitIframe <= 0) {
      this._damageMirror(1);
      // small knockback to the mirror so successive hits need repositioning
      mir.vx += (-dx / dist) * 8; mir.vy += (-dy / dist) * 8;
      if (isAtk) {
        // base attack ends + slight rebound (same feel as hitting any body)
        p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
        p.atkAvailable = true; p.atkCooldown = 0;
        p.vx *= 0.3; p.vy *= 0.3;
        if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
      } else {
        p.hasHitDuringDashAttack = true;
      }
      return;
    }

    // NOT vulnerable → it DODGES (its own dash) if able; otherwise the hit whiffs.
    if (mir.dodgeCD <= 0 && (mir.state === 'ROAM' || mir.state === 'TELEGRAPH')) {
      // Sidestep away from the player.
      var awx = -dx / dist, awy = -dy / dist;
      var perp = Math.random() < 0.5 ? 1 : -1;
      var dgx = awx * 0.6 + (-awy) * perp * 0.8;
      var dgy = awy * 0.6 + ( awx) * perp * 0.8;
      var dl = Math.sqrt(dgx * dgx + dgy * dgy) || 1;
      mir.vx = (dgx / dl) * C.MIR_DODGE_SPEED;
      mir.vy = (dgy / dl) * C.MIR_DODGE_SPEED;
      mir.state = 'DODGE'; mir.stateT = 0;
      mir.dodgeCD = C.MIR_DODGE_CD;
      mir.dodgeFlashT = 1.0;
      this._explode(mir.x, mir.y, [180, 96, 255], 6);
    }
    // (If it can't dodge and isn't vulnerable, the attack simply doesn't connect.)
  };

  /* ================================================================
     DAMAGE — break a shield orb; at zero, die. Immune to AoE/projectiles.
     ================================================================ */
  M._damageMirror = function (amount) {
    var mir = this._mirror;
    if (!mir || mir.dead) return;
    mir.orbs -= (amount || 1);
    mir.hitT = 1.0;
    mir.hitIframe = C.MIR_HIT_IFRAME;
    this._explode(mir.x, mir.y, [180, 96, 255], 16);
    this._explode(mir.x, mir.y, [255, 255, 255], 8);
    this._spawnWaveRing(mir.x, mir.y, { maxRadius: C.MIR_SIZE * 2.4, color: ORB_COL, expandTime: 0.18 });
    this._triggerHitstop(C.HITSTOP_DUR);
    this.cameras.main.shake(80, 0.008);
    if (mir.orbs <= 0) this._killMirror();
  };

  /* ================================================================
     DEATH — free upgrade (like the other bosses).
     ================================================================ */
  M._killMirror = function () {
    var mir = this._mirror;
    if (!mir || mir.dead) return;
    mir.dead = true;
    var ex = mir.x, ey = mir.y;

    this._floatLabel(ex, ey - C.MIR_SIZE - 14, 'RIVAL DOWN', '#ff8ad0', 0);

    this._explode(ex, ey, [255, 70, 180], 54);
    this._explode(ex, ey, [180, 96, 255], 36);
    this._explode(ex, ey, [255, 255, 255], 28);
    this._spawnWaveRing(ex, ey, { maxRadius: 260, color: BODY_COL, expandTime: 0.30 });
    this._spawnWaveRing(ex, ey, { maxRadius: 150, color: 0xffffff, expandTime: 0.22 });
    this.cameras.main.flash(240, 255, 90, 200);
    this.cameras.main.shake(240, 0.016);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    this._clearMirror(true);
    this._anomalyCooldownT = C.ANO_COOLDOWN;

    var self = this;
    this.time.delayedCall(420, function () {
      if (!self._upgradeLevels) return;
      if (self._upgradeDraftOpen || self._upSlowMoPhase) return;
      if (self._upgradePool && self._upgradePool.length > 0) self._beginUpgradeSlowMo();
    });
  };

  /* ================================================================
     RENDER
     ================================================================ */
  M._renderMirror = function (dt) {
    var mir = this._mirror;
    if (!mir) return;
    var gt = this.gameTime;

    var vuln = mir.vulnerable && mir.state === 'RECOVER';
    var dashing = mir.state === 'DASH';
    var dodging = mir.state === 'DODGE' || mir.dodgeFlashT > 0;
    var charging = mir.state === 'TELEGRAPH';

    // ---- Body sprite ----
    var bodyCol = BODY_COL;
    var alpha = 0.95, scl = 1.0;
    if (vuln) {
      // Off-balance: amber, dizzy spin + shrink-pulse, clearly hittable
      bodyCol = (Math.sin(gt * Math.PI * 12) > 0) ? VULN_COL : 0xff8a3a;
      alpha = 0.9; scl = 0.92 + 0.06 * Math.sin(gt * 22);
    } else if (dashing) {
      bodyCol = 0xffffff; scl = 1.15; alpha = 1.0;
    } else if (charging) {
      // pulse brighter as the lunge nears
      var cp = Math.min(1, mir.stateT / C.MIR_TELEGRAPH);
      bodyCol = (Math.sin(gt * Math.PI * (6 + cp * 16)) > 0) ? 0xffffff : BODY_COL;
      scl = 1.0 + cp * 0.12;
    }
    if (mir.hitT > 0) { bodyCol = 0xffffff; alpha = 1.0; }
    if (dodging) alpha = 0.45;   // blur-out while evading

    var rotA = (mir.state === 'DASH' || mir.state === 'TELEGRAPH') ? mir.lockAng : mir.angle;
    mir.spr.setPosition(mir.x, mir.y);
    mir.spr.setRotation(rotA);
    mir.spr.setScale(scl);
    mir.spr.setAlpha(alpha);
    mir.spr.setTint(bodyCol);

    mir.glowSpr.setPosition(mir.x, mir.y);
    mir.glowSpr.setRotation(rotA);
    mir.glowSpr.setScale(scl * 1.5 + (dashing ? 0.5 : 0));
    mir.glowSpr.setAlpha(0.18 + mir.hitT * 0.3 + (vuln ? 0.12 : 0));
    mir.glowSpr.setTint(bodyCol);

    // ---- gfx: telegraph beam, dash trail, dizzy stars ----
    var g = mir.gfx;
    g.clear();
    if (charging) {
      var cp2 = Math.min(1, mir.stateT / C.MIR_TELEGRAPH);
      var len = 460;
      var ex = mir.x + Math.cos(mir.lockAng) * len;
      var ey = mir.y + Math.sin(mir.lockAng) * len;
      var a1 = 0.25 + 0.5 * cp2;
      g.lineStyle(2 + cp2 * 3, BODY_COL, a1);
      g.beginPath(); g.moveTo(mir.x, mir.y); g.lineTo(ex, ey); g.strokePath();
      g.lineStyle(1, 0xffffff, a1 * 0.7);
      g.beginPath(); g.moveTo(mir.x, mir.y); g.lineTo(ex, ey); g.strokePath();
    }
    if (vuln) {
      // dizzy ring of orbiting stars to telegraph the punish window
      var dn = 3;
      for (var s = 0; s < dn; s++) {
        var sa = gt * 6 + (TAU / dn) * s;
        var sx = mir.x + Math.cos(sa) * (C.MIR_SIZE + 8);
        var sy = mir.y - C.MIR_SIZE - 6 + Math.sin(sa) * 4;
        g.fillStyle(VULN_COL, 0.85);
        g.fillCircle(sx, sy, 2.6);
      }
    }

    // ---- Shield orbs (violet) with a rotating triangular ward ----
    var sg = mir.shieldGfx;
    sg.clear();
    if (mir.orbs > 0) {
      var R = C.MIR_SIZE * 1.7;
      var wardRot = mir.spin * 1.6;
      var pts = [];
      for (var i = 0; i < mir.orbsMax; i++) {
        var ang = wardRot + (TAU / mir.orbsMax) * i;
        pts.push({ x: mir.x + Math.cos(ang) * R, y: mir.y + Math.sin(ang) * R, on: i < mir.orbs });
      }
      // Ward outline connecting active orbs (triangle), pulsing
      var wa = 0.35 + 0.2 * Math.sin(gt * Math.PI * 3) + mir.hitT * 0.4;
      sg.lineStyle(2, ORB_COL, wa);
      sg.beginPath();
      var started = false;
      for (var j = 0; j < pts.length; j++) {
        if (!pts[j].on) continue;
        if (!started) { sg.moveTo(pts[j].x, pts[j].y); started = true; }
        else sg.lineTo(pts[j].x, pts[j].y);
      }
      if (started) { sg.closePath(); sg.strokePath(); }
      // Orbs
      for (var k = 0; k < pts.length; k++) {
        if (!pts[k].on) continue;
        sg.fillStyle(0xffffff, 0.9);
        sg.fillCircle(pts[k].x, pts[k].y, 2.4);
        sg.lineStyle(3, ORB_COL, 0.85);
        sg.strokeCircle(pts[k].x, pts[k].y, 5.5 + 0.8 * Math.sin(gt * 6 + k));
      }
    }

    // ---- Hint ----
    if (mir.hintTxt) {
      mir.hintTxt.setPosition(mir.x, mir.y - C.MIR_SIZE * 2.4);
      mir.hintTxt.setText(LA.laGoT(vuln ? 'laMirrorVuln' : 'laMirrorHint'));
      mir.hintTxt.setColor(vuln ? '#ffe040' : '#ff8ad0');
      mir.hintTxt.setAlpha(0.55 + 0.3 * Math.abs(Math.sin(gt * Math.PI * (vuln ? 5 : 1.5))));
    }
  };

})();
