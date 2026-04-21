/* ==========================================================================
   Light Again — Projectile Lifecycle (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._spawnProjectile = function (ex, ey, angle, spd, shooter) {
    if (this.projectiles.length >= C.MAX_PROJECTILES) return;
    var spr = this.add.image(ex, ey, '_proj');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(22);
    this.projectiles.push({
      spr: spr, x: ex, y: ey,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: C.PROJ_LIFE, isReflected: false, smashed: false,
      shooterRef: shooter || null,
      rotSpeed: 8,
      trailSlots: [],
    });
  };

  M._destroyProjectile = function (pr) {
    for (var si = 0; si < pr.trailSlots.length; si++) {
      pr.trailSlots[si].active = false;
      pr.trailSlots[si].spr.setVisible(false);
    }
    pr.trailSlots.length = 0;
    pr.spr.destroy();
  };

  M._updateProjectiles = function (dt, playerDt) {
    var ms = dt * 1000;
    var p = this.p;
    var pR = C.SIZE * 0.6;
    var isAtk = p.state === 'ATTACKING';
    var isDAtk = p.state === 'DASH_ATTACKING';
    var vuln = !isAtk && !isDAtk && p.state !== 'DASHING';
    var dashLvl = (this._upgradeLevels && this._upgradeLevels.dashAtk) || 0;
    var twActive = this._twActive;

    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var pr = this.projectiles[i];
      // Reflected projectiles use player timing during time stop
      var prDt = (twActive && pr.isReflected) ? (playerDt || dt) : dt;
      var prMs = prDt * 1000;

      // Frozen during TW: skip all movement/life drain
      if (pr._twFrozen) {
        pr.spr.setPosition(pr.x, pr.y);
        pr.spr.rotation += 0.5 * dt; // gentle spin to show it's alive
        continue;
      }

      pr.life -= prMs;
      pr.x += pr.vx * prDt; pr.y += pr.vy * prDt;
      pr.spr.setPosition(pr.x, pr.y);
      pr.spr.rotation += pr.rotSpeed * prDt;

      // Trail: inject a new slot into the global pool
      var spd = pr.vx * pr.vx + pr.vy * pr.vy;
      if (spd > 0.01) {
        var slot = this._projTrailPool[this._projTrailPoolW % this._projTrailPool.length];
        this._projTrailPoolW++;
        slot.x = pr.x;
        slot.y = pr.y;
        slot.alpha = pr.isReflected ? 0.85 : 0.55;
        slot.tint = pr.isReflected ? 0xaa44ff : 0xffaa22;
        slot.rot = pr.spr.rotation;
        slot.active = true;
        slot.spr.setVisible(true);
        pr.trailSlots.push(slot);
        var maxTrail = pr.isReflected ? this._PROJ_TRAIL_PER : Math.ceil(this._PROJ_TRAIL_PER * 0.45);
        if (pr.trailSlots.length > maxTrail) {
          pr.trailSlots.shift();
        }
      }

      // Visual boost on smashed reflected
      if (pr.isReflected && pr.smashed && Math.random() < 0.3) {
        this._emitter2.setParticleTint(0xaa44ff);
        this._emitter2.explode(1, pr.x, pr.y);
      }

      // OOB / expired
      if (pr.life <= 0 || Math.abs(pr.x) > C.WORLD_HALF || Math.abs(pr.y) > C.WORLD_HALF) {
        if (pr._twPending) this._twResolvePending();
        this._destroyProjectile(pr);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (pr.isReflected) {
        // Reflected projectile hits enemies
        for (var ei = this.enemies.length - 1; ei >= 0; ei--) {
          var e = this.enemies[ei];
          var edx = pr.x - e.x, edy = pr.y - e.y;
          var eThresh = C.PROJ_RADIUS + e.size * 0.5;
          if (edx * edx + edy * edy < eThresh * eThresh) {
            // Shield intercept
            if (e.tier === 3 && e.hasShield) {
              this._breakShield(e);
              if (pr._twPending) this._twResolvePending();
              this._destroyProjectile(pr);
              this.projectiles.splice(i, 1);
              break;
            }
            if (pr.smashed) {
              var pOwnBatch = !this._twBatchWindow;
              if (pOwnBatch) this._beginBatch('PARADE');
              var smashAoe = C.SHOCKWAVE_RADIUS * 1.1; // buffed vs 0.75 before, stays under nuke (×2.5)
              var smashAoeSq = smashAoe * smashAoe;
              var directDmg = (e.tier === 3) ? 2 : 2;
              e.hp -= directDmg;
              if (e.hp <= 0) {
                this._killEnemy(ei, { batch: true, reflected: true });
              } else {
                e.stunTimer = 300;
              }
              for (var si = this.enemies.length - 1; si >= 0; si--) {
                var se = this.enemies[si];
                var sdx2 = se.x - pr.x, sdy2 = se.y - pr.y;
                var sd2Sq = sdx2 * sdx2 + sdy2 * sdy2;
                if (sd2Sq < smashAoeSq && sd2Sq > 0.01) {
                  var sd2 = Math.sqrt(sd2Sq);
                  if (se.tier === 3 && se.hasShield) {
                    this._breakShield(se);
                  } else {
                    var aoeDmg = (se.tier === 3) ? 1 : 1;
                    se.hp -= aoeDmg;
                    if (se.hp <= 0) { this._killEnemy(si, { batch: true, reflected: true }); }
                  }
                  var sf = 1.0 - sd2 / smashAoe;
                  se.vx += (sdx2 / sd2) * C.SHOCKWAVE_FORCE * 1.5 * sf;
                  se.vy += (sdy2 / sd2) * C.SHOCKWAVE_FORCE * 1.5 * sf;
                  se.stunTimer = Math.max(se.stunTimer, 250 * sf);
                }
              }
              if (pOwnBatch) this._endBatch();
              this._explode(pr.x, pr.y, [170, 68, 255], 30);
              this._explode(pr.x, pr.y, [255, 255, 255], 15);
              this._explode(pr.x, pr.y, [200, 120, 255], 10);
              this._triggerHitstop(C.DEFLECT_HEAVY_HS);
              this.cameras.main.shake(80, 0.008);
              this._spawnWaveRing(pr.x, pr.y, { maxRadius: smashAoe, color: 0xaa44ff, expandTime: 0.26 });
            } else {
              e.hp -= 1;
              if (e.hp <= 0) {
                this._killEnemy(ei, { reflected: true });
              } else {
                e.stunTimer = 200;
                this._explode(e.x, e.y, [0, 255, 255], 6);
              }
            }
            if (pr._twPending) this._twResolvePending();
            this._destroyProjectile(pr);
            this.projectiles.splice(i, 1);
            break;
          }
        }
      } else {
        // Enemy projectile hits player — suppressed during time stop
        if (vuln && !p.invincible && !twActive) {
          var pdx = p.x - pr.x, pdy = p.y - pr.y;
          var pdSq = pdx * pdx + pdy * pdy;
          var prThresh = pR + C.PROJ_RADIUS;
          if (pdSq < prThresh * prThresh) {
            var pd = Math.sqrt(pdSq);
            var pnx = pd > 0.1 ? pdx / pd : 0;
            var pny = pd > 0.1 ? pdy / pd : 0;
            this._damagePlayer(pnx, pny);
            this._destroyProjectile(pr);
            this.projectiles.splice(i, 1);
            continue;
          }
        }

        // Deflect: only dash attack can reflect projectiles
        // Lv2 extended vacuum is disabled during TW to avoid re-catching frozen reflected projectiles
        if (isDAtk) {
          var ddx = p.x - pr.x, ddy = p.y - pr.y;
          // Parrybox: generous base, diminishes as arrow grows (combo + star buff arrow size)
          var cm = this.comboMultiplier;
          var arrowScale;
          if      (cm >= 50) arrowScale = 1.34;
          else if (cm >= 25) arrowScale = 1.17;
          else if (cm >= 10) arrowScale = 1.08;
          else if (cm >= 5)  arrowScale = 1.035;
          else               arrowScale = 1.0;
          arrowScale *= 1.08; // always DASH_ATTACKING here
          if (this.isStarPowered) arrowScale *= 1.25;
          var parryBonus = (pR * 1.5) / arrowScale; // ~16px at base, shrinks with bigger arrow
          if (dashLvl >= 2) parryBonus += 55;  // Lv2: magnetic vacuum catch zone
          var ddThresh = pR + C.PROJ_RADIUS + parryBonus;
          if (ddx * ddx + ddy * ddy < ddThresh * ddThresh) {
            var refSpd = C.PROJ_SPEED * C.PROJ_REFLECT_MULT;

            var refAng;
            if (pr.shooterRef && pr.shooterRef.hp > 0) {
              refAng = Phaser.Math.Angle.Between(pr.x, pr.y, pr.shooterRef.x, pr.shooterRef.y);
            } else {
              var bestD = Infinity, bestE = null;
              for (var hi = 0; hi < this.enemies.length; hi++) {
                var he = this.enemies[hi];
                if (he.tier < 2) continue;
                var hdx = he.x - pr.x, hdy = he.y - pr.y;
                var hd = Math.sqrt(hdx * hdx + hdy * hdy);
                if (hd < bestD) { bestD = hd; bestE = he; }
              }
              if (bestE) {
                refAng = Phaser.Math.Angle.Between(pr.x, pr.y, bestE.x, bestE.y);
              } else {
                refAng = Phaser.Math.Angle.Between(p.x, p.y, pr.x, pr.y);
              }
            }
            pr.vx = Math.cos(refAng) * refSpd;
            pr.vy = Math.sin(refAng) * refSpd;
            pr.isReflected = true;
            pr._reflectedThisAtk = true;  // show tether only for this dash-attack
            pr.smashed = true;
            pr.life = C.PROJ_LIFE;
            pr.rotSpeed = 28;
            pr.spr.setTint(0xaa44ff);

            // During TW: freeze reflected projectile in place
            if (twActive) {
              this._twFreezeProjectile(pr);
            }

            p.hasHitDuringDashAttack = true;
            this._triggerHitstop(C.DEFLECT_HEAVY_HS);
            this.cameras.main.shake(80, 0.008);
            this._explode(pr.x, pr.y, [170, 68, 255], 15);
          }
        }
      }
    }
  };

})();
