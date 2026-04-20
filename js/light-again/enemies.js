/* ==========================================================================
   Light Again — Enemy AI & Separation (scene method)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._updateEnemies = function (dt) {
    var ms = dt * 1000, sc60 = dt * 60;
    var stDrg = Math.pow(0.92, sc60);
    var stK   = 1 - Math.pow(1 - 0.08, sc60);
    var p = this.p, en = this.enemies;

    // Sort by x for early-exit separation: O(n log n + n·k) vs O(n²)
    en.sort(function (a, b) { return a.x - b.x; });

    for (var i = 0; i < en.length; i++) {
      var a = en[i];
      for (var j = i + 1; j < en.length; j++) {
        var b = en[j];
        if (b.x - a.x > C.SEPARATION_RADIUS) break;
        var sdx = a.x - b.x, sdy = a.y - b.y;
        var sdSq = sdx * sdx + sdy * sdy;
        if (sdSq < C.SEPARATION_RADIUS_SQ && sdSq > 0.0001) {
          var sd = Math.sqrt(sdSq);
          var ov = (C.SEPARATION_RADIUS - sd) / C.SEPARATION_RADIUS;
          var fx = (sdx / sd) * C.SEPARATION_FORCE * ov * sc60;
          var fy = (sdy / sd) * C.SEPARATION_FORCE * ov * sc60;
          var massA = a.tier === 3 ? 6.0 : a.tier === 2 ? 2.5 : 1.0;
          var massB = b.tier === 3 ? 6.0 : b.tier === 2 ? 2.5 : 1.0;
          var total = massA + massB;
          a.vx += fx * (massB / total); a.vy += fy * (massB / total);
          b.vx -= fx * (massA / total); b.vy -= fy * (massA / total);
        }
      }
    }

    // Dash Lv2 tornados: pull all enemies in range toward each tornado center
    if (this._dashTornados && this._dashTornados.length) {
      for (var ti = 0; ti < this._dashTornados.length; ti++) {
        var tor = this._dashTornados[ti];
        if (!tor.active || tor.life <= 0) continue;
        var torRSq = C.DASH_TORNADO_RADIUS * C.DASH_TORNADO_RADIUS;
        for (var ei = 0; ei < en.length; ei++) {
          var te = en[ei];
          var tdx = tor.x - te.x, tdy = tor.y - te.y;
          var tdSq = tdx * tdx + tdy * tdy;
          if (tdSq > torRSq || tdSq < 0.01) continue;
          var td = Math.sqrt(tdSq);
          te.vx += (tdx / td) * C.DASH_TORNADO_PULL * dt;
          te.vy += (tdy / td) * C.DASH_TORNADO_PULL * dt;
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
      } else if (e.tier === 2) {
        if (e.fireFlashTimer > 0) e.fireFlashTimer -= ms;
        var dx2 = p.x - e.x, dy2 = p.y - e.y;
        var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (d2 > 0.1 && !this._twActive) e.angle = Math.atan2(dy2, dx2);

        if (d2 < C.T2_KEEP_DIST * 0.7) {
          var fx2 = d2 > 0.1 ? (-dx2 / d2) * e.speed * 1.5 : 0;
          var fy2 = d2 > 0.1 ? (-dy2 / d2) * e.speed * 1.5 : 0;
          e.vx += (fx2 - e.vx) * stK; e.vy += (fy2 - e.vy) * stK;
        } else if (d2 > C.T2_KEEP_DIST * 1.3) {
          var ax2 = (dx2 / d2) * e.speed, ay2 = (dy2 / d2) * e.speed;
          e.vx += (ax2 - e.vx) * stK; e.vy += (ay2 - e.vy) * stK;
        } else {
          e.vx *= stDrg; e.vy *= stDrg;
        }
        e.x += e.vx * sc60; e.y += e.vy * sc60;

        // Firing logic
        e.fireCD -= ms;
        if (e.fireCD <= 0 && !e.isCharging) {
          e.isCharging = true; e.chargeTimer = C.T2_CHARGE_DUR;
        }
        if (e.isCharging) {
          e.chargeTimer -= ms;
          if (e.chargeTimer <= 0) {
            var fAng = Math.atan2(p.y - e.y, p.x - e.x);
            this._spawnProjectile(e.x, e.y, fAng, C.PROJ_SPEED, e);
            e.vx -= Math.cos(fAng) * C.T2_RECOIL;
            e.vy -= Math.sin(fAng) * C.T2_RECOIL;
            e.isCharging = false;
            e.fireFlashTimer = 180;
            e.fireCD = C.T2_FIRE_CD * (0.8 + Math.random() * 0.4);
          }
        }
      } else if (e.tier === 3) {
        var dx3 = p.x - e.x, dy3 = p.y - e.y;
        var d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
        if (d3 > 0.1 && !this._twActive) e.angle = Math.atan2(dy3, dx3);

        e.waypointTimer -= ms;
        var wpDx = e.targetWaypoint.x - e.x;
        var wpDy = e.targetWaypoint.y - e.y;
        var wpD = Math.sqrt(wpDx * wpDx + wpDy * wpDy);

        if (wpD < 22 || e.waypointTimer <= 0) {
          var wpAng = Math.random() * Math.PI * 2;
          var wpR = 250 + Math.random() * 350;
          var candidateX = e.x + Math.cos(wpAng) * wpR;
          var candidateY = e.y + Math.sin(wpAng) * wpR;
          var candDx = candidateX - p.x, candDy = candidateY - p.y;
          var candD = Math.sqrt(candDx * candDx + candDy * candDy);
          if (candD > 700) {
            var pullAng = Math.random() * Math.PI * 2;
            var nearR = 350 + Math.random() * 200;
            candidateX = candidateX * 0.35 + (p.x + Math.cos(pullAng) * nearR) * 0.65;
            candidateY = candidateY * 0.35 + (p.y + Math.sin(pullAng) * nearR) * 0.65;
          }
          var wM3 = C.WORLD_HALF - C.T3_SIZE * 2;
          e.targetWaypoint.x = Math.max(-wM3, Math.min(wM3, candidateX));
          e.targetWaypoint.y = Math.max(-wM3, Math.min(wM3, candidateY));
          e.waypointTimer = 3500 + Math.random() * 2000;
          if (wpD < 22) { e.vx *= 0.05; e.vy *= 0.05; }
        } else {
          var T3_DRIFT_SPD = 1.4;
          var T3_ACCEL_K = 0.018;
          var wpNx = wpDx / wpD, wpNy = wpDy / wpD;
          var targetVx = wpNx * T3_DRIFT_SPD;
          var targetVy = wpNy * T3_DRIFT_SPD;
          e.vx += (targetVx - e.vx) * T3_ACCEL_K * sc60;
          e.vy += (targetVy - e.vy) * T3_ACCEL_K * sc60;
        }
        e.x += e.vx * sc60; e.y += e.vy * sc60;

        // Spawner logic
        e.spawnCD -= ms;
        if (e.spawnCD <= 0) {
          var hiveSlots = C.MAX_ENEMIES - this.enemies.length;
          if (hiveSlots <= 0) {
            e.spawnCD = 120;
          } else {
            e.spawnCD = C.T3_SPAWN_CD * (0.7 + Math.random() * 0.6);
            e.spawnCycle++;
            var hiveDid = false;
            if (e.spawnCycle % 3 === 0) {
              var sx2 = e.x + (Math.random() - 0.5) * 40;
              var sy2 = e.y + (Math.random() - 0.5) * 40;
              this._spawnShooterAt(sx2, sy2);
              hiveDid = true;
              this._hiveSpawnBeam(e.x, e.y, sx2, sy2);
              this._explode(sx2, sy2, [187, 0, 255], 14);
              this._explode(sx2, sy2, [255, 150, 255], 7);
            } else {
              for (var sw = 0; sw < 3; sw++) {
                if (this.enemies.length >= C.MAX_ENEMIES) break;
                var sAng = e.angle + Math.PI + (sw - 1) * 0.7;
                var spx = e.x + Math.cos(sAng) * 35;
                var spy = e.y + Math.sin(sAng) * 35;
                this._spawnRusherAt(spx, spy);
                var spawned = this.enemies[this.enemies.length - 1];
                spawned.vx = Math.cos(sAng) * 6;
                spawned.vy = Math.sin(sAng) * 6;
                this._hiveSpawnBeam(e.x, e.y, spx, spy);
                hiveDid = true;
              }
              if (hiveDid) {
                this._explode(e.x, e.y, [187, 0, 255], 12);
                this._explode(e.x, e.y, [255, 150, 255], 6);
              }
            }
            if (hiveDid) this.cameras.main.shake(40, 0.0015);
          }
        }
      } else {
        // Tier 1: rush toward player
        var dx = p.x - e.x, dy = p.y - e.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.1) {
          if (!this._twActive) e.angle = Math.atan2(dy, dx);
          var ax = (dx / d) * e.speed, ay = (dy / d) * e.speed;
          e.vx += (ax - e.vx) * stK; e.vy += (ay - e.vy) * stK;
        }
        e.x += e.vx * sc60; e.y += e.vy * sc60;
      }

      // World border clamp
      var eHalf = e.tier === 3 ? C.T3_SIZE : e.tier === 2 ? C.T2_SIZE : C.SIZE;
      var eMargin = C.WORLD_HALF - eHalf * 1.2;
      var BOUNCE = 0.55;
      if (e.x < -eMargin) { e.x = -eMargin; if (e.vx < 0) e.vx = Math.abs(e.vx) * BOUNCE; }
      if (e.x >  eMargin) { e.x =  eMargin; if (e.vx > 0) e.vx = -Math.abs(e.vx) * BOUNCE; }
      if (e.y < -eMargin) { e.y = -eMargin; if (e.vy < 0) e.vy = Math.abs(e.vy) * BOUNCE; }
      if (e.y >  eMargin) { e.y =  eMargin; if (e.vy > 0) e.vy = -Math.abs(e.vy) * BOUNCE; }
    }
  };

})();
