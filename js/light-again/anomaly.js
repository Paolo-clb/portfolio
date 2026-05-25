/* ==========================================================================
   Light Again — The Anomaly (rare "glitch" mini-boss / quarantine event)

   A data-moshed RGB-split entity that breaks the rules of the game:
     1. WANDER  — glitch-teleports around the arena, harmless, drifting toward
                  the player until it gets close.
     2. BARRIER — slams a circular "firewall" around the player, vacuums every
                  nearby enemy inside, halts natural spawns, and fires
                  telegraphed lasers while protected by an impenetrable shield.
                  The shield only drops once every trapped enemy is dead; then
                  it panics (blinking red, defenceless) and can be killed.
     3. DEATH   — shatters the barrier, resumes spawning, and drops a free
                  upgrade independently of the kill counter.

   Self-contained: the boss lives in `this._anomaly` (NOT in `this.enemies`),
   so the normal AI / separation / collision passes never touch it. Driven by
   scaled world-time so hitstop, slow-mo and The World all freeze it like any
   other enemy.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Movement feel (smooth steering — no teleport; the "bug" is purely visual) */
  var MOVE_SPEED        = 2.7;   // px/frame target speed while approaching
  var MOVE_SPEED_INSIDE = 2.2;   // px/frame target speed inside the barrier
  var MOVE_EASE         = 0.085; // velocity lerp toward desired heading (per 60fps)
  var RETARGET_MIN      = 650;   // ms between waypoint re-picks
  var RETARGET_MAX      = 1500;

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initAnomaly = function () {
    this._anomaly             = null;
    this._anomalyBarrierActive = false;   // read by spawn-suppression + confinement
    this._anomalyCooldownT    = 0;        // ms until a natural anomaly may appear
    this._anomalySpawnRollT   = 0;        // accumulates ms for the per-second roll
  };

  M._clearAnomaly = function (silent) {
    var a = this._anomaly;
    this._anomaly = null;
    this._anomalyBarrierActive = false;
    if (!a) return;
    if (a.rSpr)    a.rSpr.destroy();
    if (a.gSpr)    a.gSpr.destroy();
    if (a.bSpr)    a.bSpr.destroy();
    if (a.coreSpr) a.coreSpr.destroy();
    if (a.barrierGfx) a.barrierGfx.destroy();
    if (a.shieldGfx)  a.shieldGfx.destroy();
    if (a.laserGfx)   a.laserGfx.destroy();
    if (a.hintTxt)    a.hintTxt.destroy();
  };

  /* ================================================================
     NATURAL SPAWN — rare, gated, works in BOTH modes (driven from update)
     ================================================================ */
  M._maybeSpawnAnomaly = function (ms) {
    if (this._anomaly) return;
    if (!this.p || this.p.state === 'DEAD') return;
    if (this._anomalyCooldownT > 0) { this._anomalyCooldownT -= ms; return; }
    if (this.gameTime < C.ANO_SPAWN_MIN_DELAY / 1000) return;

    // One Bernoulli roll per accumulated second of play.
    this._anomalySpawnRollT += ms;
    if (this._anomalySpawnRollT < 1000) return;
    this._anomalySpawnRollT = 0;
    if (Math.random() < C.ANO_SPAWN_CHANCE) this._spawnAnomaly();
  };

  /* ================================================================
     SPAWN — create the entity off in the distance (debug + natural)
     ================================================================ */
  M._spawnAnomaly = function () {
    if (this._anomaly) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var ang  = Math.random() * TAU;
    var dist = 820;
    var m    = C.WORLD_HALF - C.ANO_SIZE * 2;
    var x = Math.max(-m, Math.min(m, this.p.x + Math.cos(ang) * dist));
    var y = Math.max(-m, Math.min(m, this.p.y + Math.sin(ang) * dist));

    var self = this;
    var mk = function (depth) {
      var s = self.add.image(x, y, '_anomaly');
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.setDepth(depth);
      return s;
    };

    var a = {
      x: x, y: y, vx: 0, vy: 0,
      phase: 'WANDER',
      shielded: false, vulnerable: false,
      hp: C.ANO_HP,
      tx: x, ty: y, retargetT: 0,        // smooth-steering waypoint
      spin: Math.random() * TAU,         // ever-rotating body
      wob: Math.random() * TAU,          // idle wobble phase
      bx: x, by: y, R: C.ANO_BARRIER_RADIUS, barrierT: 0,
      lasers: [], laserCD: C.ANO_LASER_CD * 0.8,
      panicT: 0,
      _hitFlash: 0, _shieldHitT: 0,
      // per-channel chroma copies + white core
      rSpr: mk(31), gSpr: mk(31), bSpr: mk(31), coreSpr: mk(32),
      barrierGfx: null, shieldGfx: null, laserGfx: null,
      hintTxt: null,
    };
    a.rSpr.setTint(0xff0000);
    a.gSpr.setTint(0x00ff00);
    a.bSpr.setTint(0x0000ff);
    a.coreSpr.setTint(0xffffff);

    a.barrierGfx = this.add.graphics(); a.barrierGfx.setDepth(6);
    a.barrierGfx.setBlendMode(Phaser.BlendModes.ADD);
    a.shieldGfx  = this.add.graphics(); a.shieldGfx.setDepth(34);
    a.shieldGfx.setBlendMode(Phaser.BlendModes.ADD);
    a.laserGfx   = this.add.graphics(); a.laserGfx.setDepth(33);
    a.laserGfx.setBlendMode(Phaser.BlendModes.ADD);

    a.hintTxt = this.add.text(x, y, '', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ff3366', stroke: '#000000', strokeThickness: 3,
    });
    a.hintTxt.setOrigin(0.5, 1);
    a.hintTxt.setDepth(70);

    this._anomaly = a;

    // Arrival glitch
    this._spawnWaveRing(x, y, { maxRadius: 130, color: 0xff33cc, expandTime: 0.30 });
    this._explode(x, y, [255, 255, 255], 22);
    this._explode(x, y, [255, 40, 180], 16);
  };

  /* ================================================================
     UPDATE — main per-frame logic (scaled world-time sMs)
     ================================================================ */
  M._updateAnomaly = function (sMs, pMs, dt) {
    // Natural-spawn gate runs whether or not one is currently alive.
    if (!this._anomaly) { this._maybeSpawnAnomaly(sMs); return; }

    var a = this._anomaly, p = this.p;
    // On death the anomaly stays put (like the other enemies) — freeze, don't clear.
    if (p.state === 'DEAD') { this._renderAnomaly(dt, pMs); return; }

    // Frozen during The World / hitstop / slow-mo (sMs ≈ 0): render only.
    if (this._twActive || sMs < 0.001) { this._renderAnomaly(dt, pMs); return; }

    a._hitFlash    = Math.max(0, a._hitFlash    - dt * 4);
    a._shieldHitT  = Math.max(0, a._shieldHitT  - dt * 3);

    // Body always animates (spin + idle wobble), even when nearly still.
    var sc60 = sMs / 16.7;
    a.spin += sc60 * 0.06;
    a.wob  += sc60 * 0.09;

    if (a.phase === 'WANDER') {
      this._anomalyMove(a, p, sMs, false, 1.0);
      var ddx = p.x - a.x, ddy = p.y - a.y;
      if (ddx * ddx + ddy * ddy < C.ANO_TRIGGER_RANGE_SQ) this._anomalySlamBarrier();
    } else {
      // BARRIER phase
      a.barrierT = Math.min(1, a.barrierT + dt * 3.2);   // firewall expand-in

      if (a.shielded) {
        // Slow down while a beam is telegraphing/firing so it reads as "from him".
        var firing = a.lasers.length > 0;
        this._anomalyMove(a, p, sMs, true, firing ? 0.35 : 1.0);
        if (this.enemies.length === 0) {
          this._anomalyBreakShield();
        } else {
          a.laserCD -= sMs;
          if (a.laserCD <= 0) { this._anomalyFireLaser(); a.laserCD = C.ANO_LASER_CD; }
        }
      } else {
        // Panicked / vulnerable — keeps stumbling around (never frozen), no lasers
        a.panicT += sMs;
        this._anomalyMove(a, p, sMs, true, 0.55);
      }
      this._confineAnomalyToBarrier(a);
    }

    this._updateAnomalyLasers(sMs);
    this._renderAnomaly(dt, pMs);
  };

  /* ---- Smooth steering toward a roaming waypoint -------------------------
     No teleport: velocity eases toward the heading so the path is fluid and
     readable. The "buggy" feel is conveyed by the visual (RGB split, shard
     jitter, micro stutters), not by warping the position. ------------------ */
  M._anomalyMove = function (a, p, sMs, inside, speedMul) {
    var sc60 = sMs / 16.7;

    // Re-pick a waypoint periodically (or once the current one is reached).
    a.retargetT -= sMs;
    var tdx = a.tx - a.x, tdy = a.ty - a.y;
    var td  = Math.sqrt(tdx * tdx + tdy * tdy);
    if (a.retargetT <= 0 || td < 36) {
      a.retargetT = RETARGET_MIN + Math.random() * (RETARGET_MAX - RETARGET_MIN);
      if (inside) {
        // Roam the quarantine, but keep clear of the player at the centre.
        var ia = Math.random() * TAU;
        var ir = a.R * (0.42 + Math.random() * 0.5);
        a.tx = a.bx + Math.cos(ia) * ir;
        a.ty = a.by + Math.sin(ia) * ir;
      } else {
        // Approach the player with a little lateral offset so it weaves in.
        a.tx = p.x + (Math.random() - 0.5) * 240;
        a.ty = p.y + (Math.random() - 0.5) * 240;
      }
      tdx = a.tx - a.x; tdy = a.ty - a.y;
      td  = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    }
    td = td || 1;

    var spd   = (inside ? MOVE_SPEED_INSIDE : MOVE_SPEED) * (speedMul || 1);
    var desVx = (tdx / td) * spd, desVy = (tdy / td) * spd;
    var k = 1 - Math.pow(1 - MOVE_EASE, sc60);
    a.vx += (desVx - a.vx) * k;
    a.vy += (desVy - a.vy) * k;

    // Micro "stutter": a rare brief brake — glitchy hitch without warping.
    if (Math.random() < 0.03) { a.vx *= 0.45; a.vy *= 0.45; }

    a.x += a.vx * sc60;
    a.y += a.vy * sc60;

    if (!inside) {
      var m = C.WORLD_HALF - C.ANO_SIZE * 2;
      a.x = Math.max(-m, Math.min(m, a.x));
      a.y = Math.max(-m, Math.min(m, a.y));
    }
  };

  M._confineAnomalyToBarrier = function (a) {
    var dx = a.x - a.bx, dy = a.y - a.by;
    var lim = a.R - C.ANO_SIZE * 1.6;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > lim) {
      a.x = a.bx + (dx / d) * lim;
      a.y = a.by + (dy / d) * lim;
    }
  };

  /* ================================================================
     SLAM — drop the quarantine barrier around the player
     ================================================================ */
  M._anomalySlamBarrier = function () {
    var a = this._anomaly, p = this.p;
    a.phase = 'BARRIER';
    a.shielded = true; a.vulnerable = false;
    a.barrierT = 0;
    a.bx = p.x; a.by = p.y;
    a.laserCD = C.ANO_LASER_CD * 1.15;   // a touch longer so the slam isn't an instant beam
    a.retargetT = 0;                      // re-aim its roam inside the new zone
    this._anomalyBarrierActive = true;

    // Barrier size scales with the crowd: count the enemies that will be trapped
    // (those within the vacuum), floored at the minimum, then grow the radius.
    var trapCount = 0;
    for (var ci = 0; ci < this.enemies.length; ci++) {
      var ce = this.enemies[ci];
      var cdx = ce.x - a.bx, cdy = ce.y - a.by;
      if (cdx * cdx + cdy * cdy <= C.ANO_VACUUM_RADIUS_SQ) trapCount++;
    }
    var effCount = Math.max(trapCount, C.ANO_MIN_TRAPPED);
    a.R = Math.min(
      C.ANO_BARRIER_RADIUS + (effCount - C.ANO_MIN_TRAPPED) * C.ANO_BARRIER_PER_ENEMY,
      C.ANO_BARRIER_MAX
    );

    // Safe outer ring for trapped enemies — keep them OFF the player (centre).
    var SAFE_MIN = 0.55, SAFE_SPAN = 0.37;   // → between 0.55·R and 0.92·R from centre
    var placeRing = function () {
      var ia = Math.random() * TAU;
      var ir = a.R * (SAFE_MIN + Math.random() * SAFE_SPAN);
      return { x: a.bx + Math.cos(ia) * ir, y: a.by + Math.sin(ia) * ir };
    };

    // VACUUM: pull every nearby enemy into the outer ring, well clear of the
    // player, and stun them so they don't land a free hit on arrival.
    var trapped = 0;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      var ex = e.x - a.bx, ey = e.y - a.by;
      if (ex * ex + ey * ey > C.ANO_VACUUM_RADIUS_SQ) continue;
      var sx = e.x, sy = e.y;
      var dst = placeRing();
      e.x = dst.x; e.y = dst.y;
      e.vx = 0; e.vy = 0;
      e.stunTimer = Math.max(e.stunTimer, 900);   // grace window after the slam
      e.isCharging = false; e.chargeTimer = 0;     // cancel any mid-charge shot
      e._spawnAnimT = 0.4;
      this._hiveSpawnBeam(sx, sy, e.x, e.y);   // glitch tether (reuse beam pool)
      this._explode(e.x, e.y, [255, 40, 180], 8);
      trapped++;
    }

    // Guarantee a real fight — extras also land in the safe outer ring, stunned.
    for (var k = trapped; k < C.ANO_MIN_TRAPPED; k++) {
      if (this.enemies.length >= C.MAX_ENEMIES) break;
      var dst2 = placeRing();
      this._naturalSpawn = false;
      if (Math.random() < 0.28) this._spawnShooterAt(dst2.x, dst2.y);
      else this._spawnRusherAt(dst2.x, dst2.y);
      var spawned = this.enemies[this.enemies.length - 1];
      if (spawned) spawned.stunTimer = Math.max(spawned.stunTimer, 800);
      this._explode(dst2.x, dst2.y, [255, 40, 180], 8);
    }

    // Slam feedback
    this._spawnWaveRing(a.bx, a.by, { maxRadius: a.R,        color: 0xff1144, expandTime: 0.35 });
    this._spawnWaveRing(a.bx, a.by, { maxRadius: a.R * 0.6,  color: 0xffffff, expandTime: 0.26 });
    this.cameras.main.flash(220, 255, 40, 90);
    this.cameras.main.shake(260, 0.014);
    this._triggerHitstop(90);
    this._explode(a.x, a.y, [255, 255, 255], 24);
  };

  /* ================================================================
     LASERS — telegraphed beams (thin warning → deadly beam)
     ================================================================ */
  M._anomalyFireLaser = function () {
    var a = this._anomaly, p = this.p;
    var baseAng = Math.atan2(p.y - a.y, p.x - a.x);
    var len = a.R * 2.2;
    var angles = [baseAng];
    if (Math.random() < 0.28) { angles.push(baseAng + 0.42); angles.push(baseAng - 0.42); }
    for (var i = 0; i < angles.length; i++) {
      // Origin is read live from the anomaly each frame (see _updateAnomalyLasers /
      // _renderAnomaly) so the beam always emanates from its body, not a stale point.
      a.lasers.push({
        ang: angles[i], len: len,
        t: 0, warn: C.ANO_LASER_WARN, fire: C.ANO_LASER_FIRE, hasHit: false,
      });
    }
    this._explode(a.x, a.y, [255, 60, 200], 8);
  };

  M._updateAnomalyLasers = function (sMs) {
    var a = this._anomaly, p = this.p;
    for (var i = a.lasers.length - 1; i >= 0; i--) {
      var L = a.lasers[i];
      L.t += sMs;
      if (L.t >= L.warn + L.fire) { a.lasers.splice(i, 1); continue; }

      var firing = L.t >= L.warn;
      if (!firing) continue;

      // Deadly phase — point-to-ray distance test (respects existing immunities)
      var laserImmune = p.state === 'DASHING' || p.state === 'DASH_ATTACKING'
                     || p.invincible || this._twActive || p.state === 'DEAD';
      if (laserImmune || L.hasHit) continue;

      var ox = a.x, oy = a.y;                       // live origin (on the body)
      var dx = Math.cos(L.ang), dy = Math.sin(L.ang);
      var rx = p.x - ox, ry = p.y - oy;
      var proj = rx * dx + ry * dy;                 // distance along the beam
      if (proj < 0 || proj > L.len) continue;
      var cx = ox + dx * proj, cy = oy + dy * proj;
      var pdx = p.x - cx, pdy = p.y - cy;
      var hitR = C.ANO_LASER_WIDTH + C.SIZE * 0.5;
      if (pdx * pdx + pdy * pdy < hitR * hitR) {
        L.hasHit = true;
        var nx = (p.x - ox), ny = (p.y - oy);
        var nl = Math.sqrt(nx * nx + ny * ny) || 1;
        this._damagePlayer(nx / nl, ny / nl);
      }
    }
  };

  /* ================================================================
     SHIELD BREAK — last sub-fifre died; the anomaly panics
     ================================================================ */
  M._anomalyBreakShield = function () {
    var a = this._anomaly;
    if (!a.shielded) return;
    a.shielded = false; a.vulnerable = true; a.panicT = 0;
    a.lasers.length = 0;

    // Glass-shatter burst
    this._explode(a.x, a.y, [255, 255, 255], 40);
    this._explode(a.x, a.y, [120, 220, 255], 24);
    this._spawnWaveRing(a.x, a.y, { maxRadius: C.ANO_SIZE * 6, color: 0xffffff, expandTime: 0.22 });
    this.cameras.main.flash(180, 255, 255, 255);
    this.cameras.main.shake(160, 0.012);
    this._triggerHitstop(C.HITSTOP_MAX);
  };

  /* ================================================================
     PLAYER MELEE vs ANOMALY (the boss is not in this.enemies)
     ================================================================ */
  M._checkAnomalyCollision = function () {
    var a = this._anomaly;
    if (!a || a.phase !== 'BARRIER') return;
    var p = this.p;
    var isAtk = p.state === 'ATTACKING', isDAtk = p.state === 'DASH_ATTACKING';
    if (!isAtk && !isDAtk) return;

    var dx = p.x - a.x, dy = p.y - a.y;
    var d2 = dx * dx + dy * dy;
    var thr = C.SIZE * 0.6 + C.ANO_SIZE + (a.shielded ? 16 : 6);
    if (d2 > thr * thr) return;
    var dist = Math.sqrt(d2) || 0.001;

    if (a.shielded) {
      // Impenetrable — tirs absorbés, rebond
      a._shieldHitT = 1.0;
      this._explode(a.x, a.y, [120, 220, 255], 6);
      this._triggerHitstop(C.HITSTOP_DUR);
      if (isAtk) {
        p.vx = (dx / dist) * C.REBOUND_IMP; p.vy = (dy / dist) * C.REBOUND_IMP;
        p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
        p.atkAvailable = true; p.atkCooldown = 0;
      }
      if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
      return;
    }

    // Vulnerable — deal damage
    a.hp -= isDAtk ? 2 : 1;
    a._hitFlash = 1.0;
    a.vx += (-dx / dist) * 10; a.vy += (-dy / dist) * 10;
    this._explode(a.x, a.y, [255, 60, 60], 16);
    this._explode(a.x, a.y, [255, 255, 255], 8);
    this._triggerHitstop(C.HITSTOP_DUR);
    this.cameras.main.shake(70, 0.008);

    if (isAtk) {
      p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
      p.atkAvailable = true; p.atkCooldown = 0;
      p.vx *= 0.3; p.vy *= 0.3;
      if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
    } else {
      p.hasHitDuringDashAttack = true;
    }

    if (a.hp <= 0) this._killAnomaly();
  };

  /* ================================================================
     DEATH — shatter barrier, resume spawns, drop a free upgrade
     ================================================================ */
  M._killAnomaly = function () {
    var a = this._anomaly;
    if (!a || a.dead) return;
    a.dead = true;
    var ex = a.x, ey = a.y, R = a.R, bx = a.bx, by = a.by;

    // No score and no combo for the anomaly — the reward is the free upgrade.
    // Just a neutral flavour label (no "+points").
    this._floatLabel(ex, ey - 24, 'ANOMALY PURGED', '#ff66cc', 0);

    // RGB death burst + barrier collapse
    this._explode(ex, ey, [255, 40, 40],  50);
    this._explode(ex, ey, [40, 255, 40],  40);
    this._explode(ex, ey, [60, 120, 255], 40);
    this._explode(ex, ey, [255, 255, 255], 30);
    this._spawnWaveRing(ex, ey, { maxRadius: R * 1.05, color: 0xffffff, expandTime: 0.30 });
    this._spawnWaveRing(bx, by, { maxRadius: R,        color: 0xff2255, expandTime: 0.40 });
    this.cameras.main.flash(280, 255, 255, 255);
    this.cameras.main.shake(300, 0.020);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    this._clearAnomaly(true);

    // Barrier is gone — natural spawns resume; arm cooldown for the next one
    this._anomalyBarrierActive = false;
    this._anomalyCooldownT = C.ANO_COOLDOWN;
    this.spawnTimer = 0;

    // Free upgrade, independent of the kill-count threshold (which is untouched)
    var self = this;
    this.time.delayedCall(420, function () {
      if (!self._upgradeLevels) return;
      if (self._upgradeDraftOpen || self._upSlowMoPhase) return;
      if (self._upgradePool && self._upgradePool.length > 0) self._beginUpgradeSlowMo();
    });
  };

  /* ================================================================
     RENDER — chromatic-aberration body + firewall + shield + lasers
     ================================================================ */
  M._renderAnomaly = function (dt, pMs) {
    var a = this._anomaly;
    if (!a) return;
    var gt = this.gameTime, p = this.p;

    /* ---- Body: constantly-animated, trembling RGB split ----
       Even when nearly still it spins, breathes and wobbles so it never reads
       as a static sprite. The RGB channels each orbit on their own phase. */
    // Idle wobble — a small Lissajous drift driven by a.wob (always advancing)
    var wob = a.wob;
    var jx = Math.sin(wob * 1.7) * 2.6 + (Math.random() - 0.5) * 2.4;
    var jy = Math.cos(wob * 1.3) * 2.6 + (Math.random() - 0.5) * 2.4;
    if (Math.random() < 0.06) { jx += (Math.random() - 0.5) * 18; jy += (Math.random() - 0.5) * 12; }
    var cx = a.x + jx, cy = a.y + jy;

    var ca = 3.4 + 2.2 * Math.sin(gt * 22);     // chromatic split amount
    if (Math.random() < 0.08) ca += 6;
    var sc = 1.0 + 0.13 * Math.sin(gt * 14);    // breathing scale
    var spin = a.spin;                           // continuous rotation

    var solidRed = false, baseAlpha = 0.9;
    if (a.vulnerable) {
      // Panicked, defenceless: blinking red target (still spinning/breathing)
      var blink = Math.sin(gt * Math.PI * C.ANO_PANIC_BLINK) > -0.2;
      solidRed = true;
      baseAlpha = blink ? 0.95 : 0.30;
      ca *= 0.45;
      sc *= 1.0 + 0.08 * Math.sin(gt * 40);
    }
    if (a._hitFlash > 0) { solidRed = false; baseAlpha = 1.0; }

    var rTint = solidRed ? 0xff2222 : (a._hitFlash > 0 ? 0xffffff : 0xff0000);
    var gTint = solidRed ? 0xff2222 : (a._hitFlash > 0 ? 0xffffff : 0x00ff00);
    var bTint = solidRed ? 0xff2222 : (a._hitFlash > 0 ? 0xffffff : 0x0000ff);

    // Each channel orbits the centre on its own angle so the split shimmers.
    var rA = spin,             gA = spin + TAU / 3, bA = spin + 2 * TAU / 3;
    a.rSpr.setPosition(cx + Math.cos(rA) * ca,        cy + Math.sin(rA) * ca);
    a.rSpr.setTint(rTint); a.rSpr.setScale(sc); a.rSpr.setAlpha(baseAlpha); a.rSpr.setRotation(spin);
    a.gSpr.setPosition(cx + Math.cos(gA) * ca * 0.9,  cy + Math.sin(gA) * ca * 0.9);
    a.gSpr.setTint(gTint); a.gSpr.setScale(sc); a.gSpr.setAlpha(baseAlpha); a.gSpr.setRotation(-spin * 0.7);
    a.bSpr.setPosition(cx + Math.cos(bA) * ca,        cy + Math.sin(bA) * ca);
    a.bSpr.setTint(bTint); a.bSpr.setScale(sc); a.bSpr.setAlpha(baseAlpha); a.bSpr.setRotation(spin * 1.3);
    a.coreSpr.setPosition(cx, cy);
    a.coreSpr.setScale(sc * 0.9);
    a.coreSpr.setAlpha((solidRed ? baseAlpha : 0.5) + a._hitFlash * 0.5);
    a.coreSpr.setRotation(-spin * 1.6 + (Math.random() - 0.5) * 0.25);

    /* ---- Firewall barrier ---- */
    var bg = a.barrierGfx;
    bg.clear();
    if (a.phase === 'BARRIER') {
      var grow = a.barrierT;
      var rN   = a.R * grow;
      // Faint interior wash
      bg.fillStyle(0xff0033, 0.04 * grow);
      bg.fillCircle(a.bx, a.by, rN);
      // Outer glow + main ring
      bg.lineStyle(8, 0xff0033, 0.14 * grow);
      bg.strokeCircle(a.bx, a.by, rN * 1.01);
      bg.lineStyle(2.5, 0xff2a4d, 0.75 * grow);
      bg.strokeCircle(a.bx, a.by, rN);
      bg.lineStyle(1, 0xffffff, 0.30 * grow);
      bg.strokeCircle(a.bx, a.by, rN * 0.992);
      // Rotating "firewall" dashes (data ticks) — two counter-spinning rings
      var segs = 48, dash = (TAU / segs) * 0.55;
      var rot1 = gt * 0.6, rot2 = -gt * 0.9;
      for (var s = 0; s < segs; s++) {
        var a1 = rot1 + (TAU / segs) * s;
        bg.lineStyle(3, 0xff5577, (0.35 + 0.25 * Math.sin(gt * 8 + s)) * grow);
        bg.beginPath(); bg.arc(a.bx, a.by, rN, a1, a1 + dash); bg.strokePath();
        var a2 = rot2 + (TAU / segs) * s;
        bg.lineStyle(1.5, 0xffcccc, 0.22 * grow);
        bg.beginPath(); bg.arc(a.bx, a.by, rN * 0.95, a2, a2 + dash * 0.7); bg.strokePath();
      }
      // Faint radial grid spokes
      for (var k = 0; k < 12; k++) {
        var ga = rot1 * 0.5 + (TAU / 12) * k;
        bg.lineStyle(1, 0xff3355, 0.07 * grow);
        bg.beginPath();
        bg.moveTo(a.bx, a.by);
        bg.lineTo(a.bx + Math.cos(ga) * rN, a.by + Math.sin(ga) * rN);
        bg.strokePath();
      }
    }

    /* ---- Lasers ---- */
    var lg = a.laserGfx;
    lg.clear();
    for (var li = 0; li < a.lasers.length; li++) {
      var L = a.lasers[li];
      var ox = a.x, oy = a.y;                       // live origin — anchored to the body
      var ex = ox + Math.cos(L.ang) * L.len;
      var ey = oy + Math.sin(L.ang) * L.len;
      if (L.t < L.warn) {
        // Telegraph — thin harmless tracer, pulsing, with a running scan dot
        var wa = 0.35 + 0.45 * Math.abs(Math.sin(gt * 30));
        lg.lineStyle(1.4, 0xff3366, wa);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        lg.lineStyle(0.6, 0xffffff, wa * 0.5);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        var sdt = (gt * 1.6 % 1.0);
        lg.fillStyle(0xffffff, 0.8);
        lg.fillCircle(ox + Math.cos(L.ang) * L.len * sdt, oy + Math.sin(L.ang) * L.len * sdt, 2.2);
      } else {
        // Deadly beam — flickering thick magenta/red bolt
        var flick = 0.80 + 0.20 * Math.random();
        var bw = C.ANO_LASER_WIDTH;
        lg.lineStyle(bw * 2.4, 0xff0033, 0.18 * flick);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        lg.lineStyle(bw, 0xff2255, 0.72 * flick);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        lg.lineStyle(bw * 0.4, 0xffffff, 0.92 * flick);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        // Muzzle flash on the body
        lg.fillStyle(0xffffff, 0.6 * flick);
        lg.fillCircle(ox, oy, bw * 0.7);
      }
    }

    /* ---- Shield bubble + hint while invulnerable ---- */
    var sg = a.shieldGfx;
    sg.clear();
    if (a.phase === 'BARRIER' && a.shielded) {
      var sr = C.ANO_SIZE * 2.3 + 3 * Math.sin(gt * 4);
      var hit = a._shieldHitT;
      var sa  = 0.45 + 0.20 * Math.sin(gt * 5) + hit * 0.5;
      sg.lineStyle(7, 0x66ddff, 0.18 + hit * 0.4);
      sg.strokeCircle(a.x, a.y, sr * 1.08);
      sg.lineStyle(2.5, 0x99eeff, sa);
      sg.strokeCircle(a.x, a.y, sr);
      sg.lineStyle(1.2, 0xffffff, sa * (0.5 + hit));
      sg.strokeCircle(a.x, a.y, sr * 0.82);
      for (var ai = 0; ai < 4; ai++) {
        var arcA = gt * 1.5 + (Math.PI / 2) * ai;
        sg.lineStyle(2, 0xccf2ff, sa * 0.7);
        sg.beginPath(); sg.arc(a.x, a.y, sr + 4, arcA, arcA + 0.5); sg.strokePath();
      }
      if (hit > 0) { sg.fillStyle(0xffffff, hit * 0.25); sg.fillCircle(a.x, a.y, sr); }
    }

    // Hint text
    if (a.hintTxt) {
      if (a.phase === 'BARRIER') {
        a.hintTxt.setVisible(true);
        a.hintTxt.setPosition(a.x, a.y - C.ANO_SIZE * 2.6);
        if (a.shielded) {
          a.hintTxt.setText(LA.laGoT('laAnomalyShielded') + '  ' + this.enemies.length);
          a.hintTxt.setColor('#66ddff');
          a.hintTxt.setAlpha(0.92);
        } else {
          a.hintTxt.setText(LA.laGoT('laAnomalyVuln'));
          a.hintTxt.setColor('#ff3344');
          a.hintTxt.setAlpha(0.6 + 0.4 * Math.abs(Math.sin(gt * Math.PI * 6)));
        }
      } else {
        a.hintTxt.setVisible(false);
      }
    }
  };

  /* ================================================================
     PLAYER CONFINEMENT — keep the player inside the firewall
     ================================================================ */
  M._confinePlayerToBarrier = function () {
    var a = this._anomaly;
    if (!a || a.phase !== 'BARRIER' || a.dead) return;
    var p = this.p;
    var dx = p.x - a.bx, dy = p.y - a.by;
    var lim = a.R - C.SIZE * 1.4;
    var d2 = dx * dx + dy * dy;
    if (d2 <= lim * lim) return;
    var d = Math.sqrt(d2) || 1;
    p.x = a.bx + (dx / d) * lim;
    p.y = a.by + (dy / d) * lim;
    // Damp the outward velocity component (soft wall bounce)
    var nx = dx / d, ny = dy / d;
    var vdot = p.vx * nx + p.vy * ny;
    if (vdot > 0) { p.vx -= nx * vdot * 1.4; p.vy -= ny * vdot * 1.4; }
  };

})();
