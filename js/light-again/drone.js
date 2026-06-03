/* ==========================================================================
   Light Again — Mini Kamikaze Drones (6th upgrade)
   Allied guided bombs that orbit the player, dart at the nearest enemy and
   detonate in a small blast. Lv1 = 1 drone, Lv2 = 2 (faster cadence + rebuild),
   Lv3 = 3 drones whose blast MARKS survivors (feeds the Detonation combo).
   Self-contained on this._drones (plain data) + one shared graphics object
   this._droneGfx (created in scene.create). Runs on the gameplay clock (sDt) so
   it freezes during hitstop / upgrade slow-mo like the rest of the world. The one
   exception is The World: there drones run on player time, keep diving at the
   frozen enemies and DEFER their blast (a retracting cyan charge ring) to TW
   resolution — see _twDeferDroneDetonation. The blast reuses the throttled serpent
   AoE + the cursedBlast curse radius multiplier.
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  /* Spawn a single orbiting drone, spread around the player. */
  M._spawnDrone = function (diveCD0) {
    if (!this._drones) this._drones = [];
    var p   = this.p;
    var ang = (this._drones.length) * (Math.PI * 2 / 3) + (this._droneAngSeed || 0);
    this._droneAngSeed = (this._droneAngSeed || 0) + 1.1;
    this._drones.push({
      state: 'ORBIT',
      orbitAng: ang,
      x: p.x + Math.cos(ang) * C.DRONE_ORBIT_R,
      y: p.y + Math.sin(ang) * C.DRONE_ORBIT_R,
      vx: 0, vy: 0,
      diveCD: diveCD0 * (0.6 + Math.random() * 0.6),  // jitter so drones don't all dive in sync
      diveT: 0, target: null,
      spin: Math.random() * 6.28,
    });
  };

  /* Top up the live drones to the current upgrade level (called on draft apply). */
  M._ensureDrones = function () {
    if (!this._drones) this._drones = [];
    var lvl = (this._upgradeLevels && this._upgradeLevels.drone) || 0;
    var diveCD0 = lvl >= 2 ? C.DRONE_DIVE_CD_L2 : C.DRONE_DIVE_CD_L1;
    while (this._drones.length < lvl) this._spawnDrone(diveCD0);
  };

  /* Nearest enemy to (x,y) within acquisition range, or null. */
  M._droneAcquire = function (x, y) {
    var best = null, bestD = C.DRONE_ACQUIRE_RANGE * C.DRONE_ACQUIRE_RANGE;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      var dx = e.x - x, dy = e.y - y;
      var d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = e; }
    }
    return best;
  };

  /* Per-frame: orbit, acquire + dive, contact → detonate, recharge. dt = sDt. */
  M._updateDrones = function (dt) {
    if (!this._drones) return;
    var lvl = (this._upgradeLevels && this._upgradeLevels.drone) || 0;
    if (lvl <= 0) {
      if (this._drones.length) this._drones.length = 0;
      if (this._droneGfx) this._droneGfx.clear();
      return;
    }

    var ms = dt * 1000;
    var p  = this.p;
    var maxDrones = lvl;                                           // 1 / 2 / 3
    var diveCD0  = lvl >= 2 ? C.DRONE_DIVE_CD_L2 : C.DRONE_DIVE_CD_L1;
    var respawn0 = lvl >= 2 ? C.DRONE_RESPAWN_L2 : C.DRONE_RESPAWN_L1;

    // Rebuild toward the target count on a recharge timer.
    if (this._drones.length < maxDrones) {
      this._droneRespawnT -= ms;
      if (this._droneRespawnT <= 0) {
        this._spawnDrone(diveCD0);
        this._droneRespawnT = respawn0;
      }
    }

    // Smart kamikaze: only ONE drone dives at a time. The others orbit and wait
    // until the current diver has detonated — so no blast is wasted on enemies a
    // sibling already cleared, and two drones never dive at the same target.
    var diverActive = false;
    for (var dq = 0; dq < this._drones.length; dq++) {
      if (this._drones[dq].state === 'DIVE') { diverActive = true; break; }
    }

    for (var i = this._drones.length - 1; i >= 0; i--) {
      var d = this._drones[i];
      d.spin += dt * 7;
      // Orbit the OPPOSITE way to the shield orbs (which advance _shieldAngle
      // positively) so the two rings visibly counter-rotate around the ship.
      d.orbitAng -= dt * C.DRONE_ORBIT_SPEED;

      if (d.state === 'ORBIT') {
        var ox = p.x + Math.cos(d.orbitAng) * C.DRONE_ORBIT_R;
        var oy = p.y + Math.sin(d.orbitAng) * C.DRONE_ORBIT_R;
        var k  = Math.min(1, 12 * dt);
        d.x += (ox - d.x) * k;
        d.y += (oy - d.y) * k;
        d.diveCD -= ms;
        if (d.diveCD <= 0 && !diverActive) {
          var tgt = this._droneAcquire(d.x, d.y);
          if (tgt) {
            d.state = 'DIVE'; d.diveT = 0; d.target = tgt;
            var a0 = Math.atan2(tgt.y - d.y, tgt.x - d.x);
            d.vx = Math.cos(a0) * C.DRONE_DIVE_SPEED;
            d.vy = Math.sin(a0) * C.DRONE_DIVE_SPEED;
            diverActive = true;   // claim the single kamikaze slot for this frame
          }
          // no target (or a sibling is mid-dive) → keep orbiting; retries next frame
        }
      } else {  // DIVE
        d.diveT += ms;
        var tg = d.target;
        if (!tg || this.enemies.indexOf(tg) === -1) {
          if (this._twActive) this._twDeferDroneDetonation(d);
          else this._droneDetonate(d);
          this._drones.splice(i, 1);
          this._droneRespawnT = respawn0;
          continue;
        }
        var age = Math.min(1, d.diveT / C.DRONE_DIVE_TIMEOUT);
        var spd = C.DRONE_DIVE_SPEED * (1 + age * C.DRONE_DIVE_ACCEL);
        var desA = Math.atan2(tg.y - d.y, tg.x - d.x);
        var curA = Math.atan2(d.vy, d.vx);
        var dA   = Phaser.Math.Angle.Wrap(desA - curA);
        var mT   = C.DRONE_DIVE_TURN * dt;
        if (dA > mT) dA = mT; else if (dA < -mT) dA = -mT;
        var nA = curA + dA;
        d.vx = Math.cos(nA) * spd;
        d.vy = Math.sin(nA) * spd;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        var hx = tg.x - d.x, hy = tg.y - d.y;
        var hitR = C.DRONE_HIT_R + tg.size * 0.5;
        if (hx * hx + hy * hy <= hitR * hitR || d.diveT >= C.DRONE_DIVE_TIMEOUT) {
          if (this._twActive) this._twDeferDroneDetonation(d);
          else this._droneDetonate(d);
          this._drones.splice(i, 1);
          this._droneRespawnT = respawn0;
          continue;
        }
      }
    }

    // Separation — keep orbiting drones from overlapping each other (or the
    // diver): gently shove any orbiter that drifts within SEP of another drone.
    var SEP = C.DRONE_SIZE * 4.2;        // min centre-to-centre spacing (px)
    var SEPSQ = SEP * SEP;
    for (var si = 0; si < this._drones.length; si++) {
      var sd = this._drones[si];
      if (sd.state !== 'ORBIT') continue;
      for (var sj = 0; sj < this._drones.length; sj++) {
        if (sj === si) continue;
        var so = this._drones[sj];
        var sdx = sd.x - so.x, sdy = sd.y - so.y;
        var sD2 = sdx * sdx + sdy * sdy;
        if (sD2 > 0.01 && sD2 < SEPSQ) {
          var sD = Math.sqrt(sD2);
          var push = (SEP - sD) * 0.5;
          sd.x += (sdx / sD) * push;
          sd.y += (sdy / sD) * push;
        }
      }
    }

    this._renderDrones();
  };

  /* Small allied blast: damage + knockback. Lv2+ DOUBLES the radius; Lv3 also
     plants a delayed explosion at the spot once the blast resolves.
     opts.prominent — louder FX (used when a deferred TW blast fires at resolution,
     so the cyan kamikaze pop reads clearly against the golden THE WORLD flash). */
  M._droneDetonate = function (d, opts) {
    var lvl = (this._upgradeLevels && this._upgradeLevels.drone) || 0;
    var R   = C.DRONE_BLAST_R * (lvl >= 2 ? C.DRONE_BLAST_R_MULT_L2 : 1) * (this._blastMult || 1);
    var Rsq = R * R;
    var dmg = C.DRONE_BLAST_DMG;
    var x = d.x, y = d.y;
    var prominent = !!(opts && opts.prominent);

    var ownBatch = !this._twBatchWindow;
    if (ownBatch) this._beginBatch('DRONE');
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e   = this.enemies[i];
      if (e._snIntangible) continue;   // cloaked sniper — immune to drone blasts
      var ex  = e.x - x, ey = e.y - y;
      var dsq = ex * ex + ey * ey;
      if (dsq >= Rsq) continue;
      var dist = Math.sqrt(dsq);
      if (e.tier === 3 && e.hasShield) {
        this._breakShield(e);
      } else {
        e.hp -= dmg;
        if (e.hp <= 0) {
          this._killEnemy(i, { batch: true });
        } else {
          e.stunTimer = Math.max(e.stunTimer, 220);
          this._explode(e.x, e.y, [120, 220, 255], 5);
        }
      }
      if (dist > 0.1) {
        var f = 1 - dist / R;
        e.vx += (ex / dist) * C.SHOCKWAVE_FORCE * 0.8 * f;
        e.vy += (ey / dist) * C.SHOCKWAVE_FORCE * 0.8 * f;
      }
    }
    if (ownBatch) this._endBatch();

    // Chip serpent segments around the blast (throttled, like every explosion).
    if (this._snake && !this._snake.dead) this._damageSnakeAoe(x, y, R, C.SNAKE_AOE_DMG);

    // FX — allied cyan, distinct from the red delayed explosion and cyan nuke.
    this._explode(x, y, [120, 220, 255], prominent ? 46 : 26);
    this._explode(x, y, [255, 255, 255], prominent ? 24 : 14);
    this._spawnWaveRing(x, y, { maxRadius: R, color: 0x33ddff, expandTime: 0.22 });
    if (prominent) {
      // Second, wider halo (slower expand) so the kamikaze pop stays legible while
      // the golden resolution flash fades over it.
      this._spawnWaveRing(x, y, { maxRadius: R * 1.4, color: 0x66e0ff, expandTime: 0.38 });
    }
    this.cameras.main.shake(prominent ? 110 : 70, prominent ? 0.008 : 0.006);
    this._triggerHitstop(Math.round(C.HITSTOP_DUR * (prominent ? 0.8 : 0.6)));

    // Lv3: the kamikaze blast leaves a delayed explosion behind (scales with the
    // Explosion-à-retardement branch, min Lv1) — a second wave a beat later.
    if (lvl >= 3) {
      this._spawnDelayedExplosion(x, y, Math.max(1, (this._upgradeLevels && this._upgradeLevels.baseAtk) || 0));
    }
  };

  /* The World: a drone that would detonate during the freeze instead arms a
     retracting cyan charge ring (mirrors the nuke's golden deferral) and snapshots
     its blast. The ring finishes shrinking exactly when time resumes; the actual
     explosion fires in _resolveTimeStop, inside the THE WORLD batch so its kills
     are tallied with everything else. The drone is removed by the caller, so the
     respawn timer rebuilds the ring of orbiters — even mid-freeze. */
  M._twDeferDroneDetonation = function (d) {
    var self = this;
    var lvl = (this._upgradeLevels && this._upgradeLevels.drone) || 0;
    var R   = C.DRONE_BLAST_R * (lvl >= 2 ? C.DRONE_BLAST_R_MULT_L2 : 1) * (this._blastMult || 1);
    var startR = R;
    var MAIN_COL = 0x33ddff;  // allied cyan — drone theme
    var SEC_COL  = 0x66e0ff;
    // Duration = time left until TW resolution (covers any still-running wave).
    var twTotalMs = (this._twWaveDurationMs || 0) + C.TW_DURATION;
    var duration  = Math.max(twTotalMs - (this._twTotalElapsed || 0), 100);

    var x = d.x, y = d.y;
    var gfx = this.add.graphics();
    gfx.setDepth(55);
    var state = { r: startR };

    // Cyan spark on arming, matching the allied blast colour.
    this._explode(x, y, [120, 220, 255], 12);

    var tweenRef = this.tweens.add({
      targets: state,
      r: 0,
      duration: duration,
      ease: 'Cubic.easeIn',
      onUpdate: function () {
        if (!self._upgradeLevels) { gfx.clear(); return; }
        var curR = state.r;
        if (curR <= 0) { gfx.clear(); return; }
        var prog    = 1.0 - curR / startR;
        var late    = prog * prog;
        var flicker = prog > 0.70 ? (0.78 + Math.random() * 0.22) : 1.0;

        gfx.clear();
        gfx.lineStyle(2.5, MAIN_COL, (0.30 + late * 0.60) * flicker);
        gfx.strokeCircle(x, y, curR);
        gfx.fillStyle(MAIN_COL, (0.015 + late * 0.035) * flicker);
        gfx.fillCircle(x, y, curR);
        if (curR > 8) {
          gfx.lineStyle(1.5, MAIN_COL, (0.15 + late * 0.50) * flicker);
          gfx.strokeCircle(x, y, curR * 0.55);
        }
        if (prog > 0.60) {
          var dotProg = (prog - 0.60) / 0.40;
          var dotR    = dotProg * 7 * flicker;
          gfx.fillStyle(0xffffff, late * 0.90 * flicker);
          gfx.fillCircle(x, y, dotR);
          gfx.fillStyle(SEC_COL, late * 0.55 * flicker);
          gfx.fillCircle(x, y, dotR * 1.5);
        }
      },
    });

    if (!this._twDeferredDroneBlasts) this._twDeferredDroneBlasts = [];
    this._twDeferredDroneBlasts.push({ x: x, y: y, gfx: gfx, tweenRef: tweenRef });
  };

  /* Draw every live drone into the shared graphics object. */
  M._renderDrones = function () {
    var gfx = this._droneGfx;
    if (!gfx) return;
    gfx.clear();
    if (!this._drones || !this._drones.length) return;
    var p  = this.p;
    var sz = C.DRONE_SIZE;
    var verts = [[0, -sz], [sz * 0.7, 0], [0, sz], [-sz * 0.7, 0]];

    for (var i = 0; i < this._drones.length; i++) {
      var d = this._drones[i];
      var diving = d.state === 'DIVE';

      // Subtle allied tether to the player while orbiting.
      if (!diving) {
        gfx.lineStyle(1, 0x33ddff, 0.18);
        gfx.beginPath(); gfx.moveTo(p.x, p.y); gfx.lineTo(d.x, d.y); gfx.strokePath();
      }

      var coreCol = diving ? 0xffaa33 : 0x66e0ff;
      var glowCol = diving ? 0xff7722 : 0x33ccff;

      // Layered glow — fades out softly instead of a hard flat disc.
      gfx.fillStyle(glowCol, 0.06); gfx.fillCircle(d.x, d.y, sz * 2.4);
      gfx.fillStyle(glowCol, 0.12); gfx.fillCircle(d.x, d.y, sz * 1.7);
      gfx.fillStyle(glowCol, 0.20); gfx.fillCircle(d.x, d.y, sz * 1.1);

      // Spinning diamond body
      var c = Math.cos(d.spin), s = Math.sin(d.spin);
      gfx.fillStyle(coreCol, 0.95);
      gfx.beginPath();
      for (var v = 0; v < verts.length; v++) {
        var vx = verts[v][0] * c - verts[v][1] * s;
        var vy = verts[v][0] * s + verts[v][1] * c;
        if (v === 0) gfx.moveTo(d.x + vx, d.y + vy);
        else         gfx.lineTo(d.x + vx, d.y + vy);
      }
      gfx.closePath(); gfx.fillPath();

      // Inner facet — a lit half-scale diamond for a sense of material/bevel.
      gfx.fillStyle(0xffffff, 0.30);
      gfx.beginPath();
      for (var v2 = 0; v2 < verts.length; v2++) {
        var fx = (verts[v2][0] * 0.5) * c - (verts[v2][1] * 0.5) * s;
        var fy = (verts[v2][0] * 0.5) * s + (verts[v2][1] * 0.5) * c;
        if (v2 === 0) gfx.moveTo(d.x + fx, d.y + fy);
        else          gfx.lineTo(d.x + fx, d.y + fy);
      }
      gfx.closePath(); gfx.fillPath();

      // White-hot center (pulses with spin)
      var corePulse = 0.7 + 0.3 * Math.abs(Math.sin(d.spin * 2));
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(d.x, d.y, sz * (0.26 + 0.10 * corePulse));

      // Diving: a conical propulsion flame (hot core → orange tongues) + sparks.
      if (diving) {
        var vmag = Math.sqrt(d.vx * d.vx + d.vy * d.vy) || 1;
        var bx = -(d.vx / vmag), by = -(d.vy / vmag);     // backward unit
        var perpx = -by, perpy = bx;
        for (var fl = 0; fl < 3; fl++) {
          var len = sz * (1.3 + fl * 0.85);
          var wob = (fl % 2 === 0 ? 1 : -1) * sz * 0.16 * (fl + 1);
          var ex = d.x + bx * len + perpx * wob, ey = d.y + by * len + perpy * wob;
          gfx.lineStyle(3 - fl, fl === 0 ? 0xfff0c0 : 0xff8822, 0.7 - fl * 0.2);
          gfx.beginPath(); gfx.moveTo(d.x, d.y); gfx.lineTo(ex, ey); gfx.strokePath();
        }
        if (this._emitter2 && Math.random() < 0.5) {
          this._emitter2.setParticleTint(0xffaa33);
          this._emitter2.explode(1, d.x + bx * sz * 1.5, d.y + by * sz * 1.5);
        }
      }
    }
  };

})();
