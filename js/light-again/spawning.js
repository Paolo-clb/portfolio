/* ==========================================================================
   Light Again — Spawning (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._spawnRusher = function () {
    if (this.enemies.length >= C.MAX_ENEMIES) return;
    var ang = Math.random() * Math.PI * 2;
    this._spawnRusherAt(
      this.p.x + Math.cos(ang) * C.SPAWN_DIST,
      this.p.y + Math.sin(ang) * C.SPAWN_DIST
    );
  };

  M._spawnWave = function () {
    var t1Progress = Math.min(this.totalKills / C.SPAWN_T1_RAMP_KILLS, 1.0);
    var minT1 = Math.floor(C.SPAWN_T1_MIN_BASE + t1Progress * C.SPAWN_T1_MIN_SPAN);
    var maxT1 = Math.floor(C.SPAWN_T1_MAX_BASE + t1Progress * C.SPAWN_T1_MAX_SPAN);
    if (maxT1 < minT1) maxT1 = minT1;
    var t1Count = Phaser.Math.Between(minT1, maxT1);

    var t2Progress = Math.min(this.totalKills / C.SPAWN_T2_RAMP_KILLS, 1.0);
    var chance1T2 = t2Progress * C.SPAWN_T2_CHANCE_1;
    var chance2T2 = t2Progress * C.SPAWN_T2_CHANCE_2;

    var t3Eff = Math.max(0, this.totalKills - C.SPAWN_T3_START_KILLS);
    var t3Progress = Math.min(t3Eff / C.SPAWN_T3_RAMP_KILLS, 1.0);
    var chance1T3 = t3Progress * C.SPAWN_T3_CHANCE_1;

    var spawnQueue = [];
    for (var i = 0; i < t1Count; i++) spawnQueue.push(1);

    var rollT2 = Math.random();
    if (rollT2 < chance2T2) {
      spawnQueue.push(2, 2);
    } else if (rollT2 < chance2T2 + chance1T2) {
      spawnQueue.push(2);
    }

    if (Math.random() < chance1T3) spawnQueue.push(3);

    var kills = this.totalKills;
    var lateP = 0;
    if (kills > C.SPAWN_LATE_START_KILLS) {
      lateP = Math.min(
        (kills - C.SPAWN_LATE_START_KILLS) / (C.SPAWN_LATE_END_KILLS - C.SPAWN_LATE_START_KILLS),
        1
      );
    }
    var lm1 = 1 + lateP * (C.SPAWN_LATE_MULT_T1 - 1);
    var lm2 = 1 + lateP * (C.SPAWN_LATE_MULT_T2 - 1);
    var lm3 = 1 + lateP * (C.SPAWN_LATE_MULT_T3 - 1);
    var cnt1 = 0, cnt2 = 0, cnt3 = 0;
    for (var si = 0; si < spawnQueue.length; si++) {
      if (spawnQueue[si] === 1) cnt1++;
      else if (spawnQueue[si] === 2) cnt2++;
      else if (spawnQueue[si] === 3) cnt3++;
    }
    var n1 = Math.max(1, Math.round(cnt1 * lm1));
    var n2 = Math.max(0, Math.round(cnt2 * lm2));
    var n3 = Math.max(0, Math.round(cnt3 * lm3));
    spawnQueue = [];
    for (var qi = 0; qi < n1; qi++) spawnQueue.push(1);
    for (var qj = 0; qj < n2; qj++) spawnQueue.push(2);
    for (var qk = 0; qk < n3; qk++) spawnQueue.push(3);

    var tk2 = this.totalKills;
    if (tk2 > C.SPAWN_DOUBLE_KILLS_START && spawnQueue.length > 0) {
      var dProg = Math.min(
        (tk2 - C.SPAWN_DOUBLE_KILLS_START) / (C.SPAWN_DOUBLE_KILLS_FULL - C.SPAWN_DOUBLE_KILLS_START),
        1
      );
      var pMax = dProg * C.SPAWN_DOUBLE_PROB_MAX;
      var emptyF = (C.MAX_ENEMIES - this.enemies.length) / C.MAX_ENEMIES;
      if (pMax > 0 && emptyF > 0 && Math.random() < pMax * emptyF) {
        spawnQueue = spawnQueue.concat(spawnQueue.slice());
      }
    }

    var slots = C.MAX_ENEMIES - this.enemies.length;
    if (slots <= 0) return;
    var finalCount = Math.min(spawnQueue.length, slots);

    var baseAng = Math.random() * Math.PI * 2;
    var spread = (finalCount > 1) ? (Math.PI * 0.9) : 0;
    for (var j = 0; j < finalCount; j++) {
      var t = finalCount > 1 ? j / (finalCount - 1) : 0.5;
      var ang = baseAng + (t - 0.5) * spread + (Math.random() - 0.5) * 0.3;
      var dist = C.SPAWN_DIST + Math.random() * 120;
      var sx = this.p.x + Math.cos(ang) * dist;
      var sy = this.p.y + Math.sin(ang) * dist;

      var tier = spawnQueue[j];
      if (tier === 3) this._spawnBruiserAt(sx, sy);
      else if (tier === 2) this._spawnShooterAt(sx, sy);
      else this._spawnRusherAt(sx, sy);
    }
  };

  M._debugSpawnTestTier = function (tier, want) {
    if (!this.p || this.p.state === 'DEAD') return;
    var slots = C.MAX_ENEMIES - this.enemies.length;
    var n = Math.min(want, slots);
    if (n <= 0) return;
    var baseAng = Math.random() * Math.PI * 2;
    var spread = n > 1 ? Math.PI * 0.9 : 0;
    for (var j = 0; j < n; j++) {
      var t = n > 1 ? j / (n - 1) : 0.5;
      var ang = baseAng + (t - 0.5) * spread + (Math.random() - 0.5) * 0.3;
      var dist = C.SPAWN_DIST + Math.random() * 120;
      var sx = this.p.x + Math.cos(ang) * dist;
      var sy = this.p.y + Math.sin(ang) * dist;
      if (tier === 3) this._spawnBruiserAt(sx, sy);
      else if (tier === 2) this._spawnShooterAt(sx, sy);
      else this._spawnRusherAt(sx, sy);
    }
  };

  M._spawnRusherAt = function (ex, ey) {
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
      angle: 0, hp: 1, size: C.RUSHER_SIZE,
      speed: C.RUSHER_SPEED + Math.random() * 0.8,
      stunTimer: 0, isMarked: false, markTimer: 0,
      trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
      tier: 1, fireCD: 0, chargeTimer: 0, isCharging: false,
    });
    // Queue enemy for deferred CM allocation (1 per frame in update loop)
    this._twCMSpawnQueue.push(this.enemies[this.enemies.length - 1]);
  };

  M._spawnShooterAt = function (ex, ey) {
    var spr = this.add.image(ex, ey, '_shooter');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(20);

    var trSpr = [], trData = [];
    for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
      var ts = this.add.image(ex, ey, '_shooter');
      ts.setBlendMode(Phaser.BlendModes.ADD);
      ts.setDepth(15); ts.setVisible(false);
      trSpr.push(ts);
      trData.push({ x: ex, y: ey, angle: 0 });
    }

    this.enemies.push({
      spr: spr, x: ex, y: ey, vx: 0, vy: 0,
      angle: 0, hp: 1, size: C.T2_SIZE,
      speed: C.T2_SPEED + Math.random() * 0.4,
      stunTimer: 0, isMarked: false, markTimer: 0,
      trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
      tier: 2, fireCD: C.T2_FIRE_CD * (0.8 + Math.random() * 0.4),
      chargeTimer: 0, isCharging: false, fireFlashTimer: 0,
    });
    this._twCMSpawnQueue.push(this.enemies[this.enemies.length - 1]);
  };

  M._spawnBruiserAt = function (ex, ey) {
    var spr = this.add.image(ex, ey, '_bruiser');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(20);

    var trSpr = [], trData = [];
    for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
      var ts = this.add.image(ex, ey, '_bruiser');
      ts.setBlendMode(Phaser.BlendModes.ADD);
      ts.setDepth(15); ts.setVisible(false);
      trSpr.push(ts);
      trData.push({ x: ex, y: ey, angle: 0 });
    }

    var shieldGfx = this.add.graphics();
    shieldGfx.setDepth(23);

    this.enemies.push({
      spr: spr, x: ex, y: ey, vx: 0, vy: 0,
      angle: 0, hp: 2, size: C.T3_SIZE,
      speed: C.T3_SPEED + Math.random() * 0.3,
      stunTimer: 0, isMarked: false, markTimer: 0,
      trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
      tier: 3, fireCD: 0, chargeTimer: 0, isCharging: false, fireFlashTimer: 0,
      hasShield: true,
      shieldGfx: shieldGfx,
      shieldRot: 0,
      spawnCD: C.T3_SPAWN_CD * (0.7 + Math.random() * 0.6),
      spawnCycle: 0,
      targetWaypoint: { x: ex, y: ey },
      waypointTimer: 0,
    });
    this._twCMSpawnQueue.push(this.enemies[this.enemies.length - 1]);
  };

})();
