/* ==========================================================================
   Light Again — Mini Kamikaze Drones (6th upgrade)
   Allied guided bombs that orbit the player, dart at the nearest enemy and
   detonate in a small blast. Lv1 = 1 drone, Lv2 = 2 (faster cadence + rebuild),
   Lv3 = 3 drones whose blast MARKS survivors (feeds the Detonation combo).
   Self-contained on this._drones (plain data) + one shared graphics object
   this._droneGfx (created in scene.create). Runs on the gameplay clock (sDt) so
   it freezes during The World / hitstop like the rest of the world. The blast
   reuses the throttled serpent AoE + the cursedBlast curse radius multiplier.
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
      d.orbitAng += dt * C.DRONE_ORBIT_SPEED;

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
          this._droneDetonate(d);
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
          this._droneDetonate(d);
          this._drones.splice(i, 1);
          this._droneRespawnT = respawn0;
          continue;
        }
      }
    }

    this._renderDrones();
  };

  /* Small allied blast: damage + knockback. Lv2+ DOUBLES the radius; Lv3 also
     plants a delayed explosion at the spot once the blast resolves. */
  M._droneDetonate = function (d) {
    var lvl = (this._upgradeLevels && this._upgradeLevels.drone) || 0;
    var R   = C.DRONE_BLAST_R * (lvl >= 2 ? C.DRONE_BLAST_R_MULT_L2 : 1) * (this._blastMult || 1);
    var Rsq = R * R;
    var dmg = C.DRONE_BLAST_DMG;
    var x = d.x, y = d.y;

    var ownBatch = !this._twBatchWindow;
    if (ownBatch) this._beginBatch('DRONE');
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e   = this.enemies[i];
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
    this._explode(x, y, [120, 220, 255], 26);
    this._explode(x, y, [255, 255, 255], 14);
    this._spawnWaveRing(x, y, { maxRadius: R, color: 0x33ddff, expandTime: 0.22 });
    this.cameras.main.shake(70, 0.006);
    this._triggerHitstop(Math.round(C.HITSTOP_DUR * 0.6));

    // Lv3: the kamikaze blast leaves a delayed explosion behind (scales with the
    // Explosion-à-retardement branch, min Lv1) — a second wave a beat later.
    if (lvl >= 3) {
      this._spawnDelayedExplosion(x, y, Math.max(1, (this._upgradeLevels && this._upgradeLevels.baseAtk) || 0));
    }
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

      // Glow
      gfx.fillStyle(glowCol, 0.22);
      gfx.fillCircle(d.x, d.y, sz * 1.8);

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

      // White-hot center
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillCircle(d.x, d.y, sz * 0.32);

      // Diving: short exhaust streak behind the warhead
      if (diving) {
        var vmag = Math.sqrt(d.vx * d.vx + d.vy * d.vy) || 1;
        var tx = d.x - (d.vx / vmag) * sz * 1.7;
        var ty = d.y - (d.vy / vmag) * sz * 1.7;
        gfx.lineStyle(2, 0xffcc66, 0.7);
        gfx.beginPath(); gfx.moveTo(d.x, d.y); gfx.lineTo(tx, ty); gfx.strokePath();
      }
    }
  };

})();
