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
    // Parade bucket bookkeeping: one less reflected projectile in flight for
    // this dash attack. When the count hits zero, flush its popup immediately.
    if (pr._dashAtkId && this._paradeFlushIfDone) {
      this._paradeFlushIfDone(pr._dashAtkId);
    }
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

      // Anomaly glitch projectiles steer: toward the player while live, and
      // toward their assigned far enemy once reflected (chasing it down).
      // Reflected glitch projectiles stay slow but turn very hard so they
      // really land on their target — but each picks a DIFFERENT enemy so
      // the swarm spreads its damage out.
      if (pr.homing) {
        var htx, hty, hturn, hspd;
        // Age 0→1 over the projectile's lifetime → speed grows over life.
        var lifeMax = pr.isReflected ? C.PROJ_LIFE : C.ANO_PROJ_LIFE;
        var age = 1 - pr.life / lifeMax;
        if (age < 0) age = 0; else if (age > 1) age = 1;
        var accelMul = 1 + age * (pr.isReflected ? C.ANO_PROJ_ACCEL_REFL : C.ANO_PROJ_ACCEL);
        if (!pr.isReflected) {
          htx = p.x; hty = p.y;
          hturn = C.ANO_PROJ_TURN; hspd = C.ANO_PROJ_SPEED * accelMul;
        } else {
          if (pr.homeTarget && this.enemies.indexOf(pr.homeTarget) === -1) pr.homeTarget = null;
          if (!pr.homeTarget) {
            // Build the exclusion set of enemies already locked by sibling shots
            var ex2 = [];
            for (var ej = 0; ej < this.projectiles.length; ej++) {
              var pp2 = this.projectiles[ej];
              if (pp2 !== pr && pp2.homing && pp2.isReflected && pp2.homeTarget) ex2.push(pp2.homeTarget);
            }
            pr.homeTarget = this._pickDistantVisibleEnemy(ex2);
          }
          hturn = C.ANO_PROJ_TURN_REFL;
          hspd  = C.ANO_PROJ_SPEED * accelMul;            // starts slow, accelerates harder
          if (pr.homeTarget) { htx = pr.homeTarget.x; hty = pr.homeTarget.y; }
        }
        if (htx !== undefined) {
          var desA = Math.atan2(hty - pr.y, htx - pr.x);
          var curA = Math.atan2(pr.vy, pr.vx);
          var dA   = Phaser.Math.Angle.Wrap(desA - curA);
          var mT   = hturn * prDt;
          if (dA > mT) dA = mT; else if (dA < -mT) dA = -mT;
          var nA = curA + dA;
          pr.vx = Math.cos(nA) * hspd; pr.vy = Math.sin(nA) * hspd;
        }

        // Swarm separation — siblings of the same kind push each other so
        // they don't stack into a single dot when chasing the same target.
        var sepR = C.ANO_PROJ_SEP, sepRSq = sepR * sepR;
        var sepK = 60;  // px/s^2-ish push
        for (var sj = 0; sj < this.projectiles.length; sj++) {
          var pp = this.projectiles[sj];
          if (pp === pr || !pp.homing) continue;
          if (pp.isReflected !== pr.isReflected) continue;  // only same-team
          var sdx = pr.x - pp.x, sdy = pr.y - pp.y;
          var sd2 = sdx * sdx + sdy * sdy;
          if (sd2 > sepRSq || sd2 < 0.01) continue;
          var sd = Math.sqrt(sd2);
          var sf = (1 - sd / sepR) * sepK * prDt;
          pr.vx += (sdx / sd) * sf;
          pr.vy += (sdy / sd) * sf;
        }
      }

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
        slot.tint = pr.glitch
          ? (pr.isReflected
              ? (Math.random() < 0.5 ? 0x00ffff : 0xffffff)   // cyan-glitch trail
              : 0xffffff)                                       // pure white trail
          : pr.isReflected ? 0xaa44ff : 0xffaa22;
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
          var prR = pr.glitch ? C.ANO_PROJ_RADIUS : C.PROJ_RADIUS;
          var eThresh = prR + e.size * 0.5;
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
              if (pOwnBatch) this._beginBatch('PARADE', { dashAtkId: pr._dashAtkId });
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
              // Gold if released during TW resolution, orange-violet otherwise (distinct from nuke lv2 violet)
              var smashRingCol = pr._twPending ? 0xffc832 : 0xFF338B;
              this._spawnWaveRing(pr.x, pr.y, { maxRadius: smashAoe, color: smashRingCol, expandTime: 0.26 });
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
          var prR2 = pr.glitch ? C.ANO_PROJ_RADIUS : C.PROJ_RADIUS;
          var prThresh = pR + prR2;
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
          var ddThresh = pR + (pr.glitch ? C.ANO_PROJ_RADIUS : C.PROJ_RADIUS) + parryBonus;
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
            if (this._tutEvent) this._tutEvent('parade');  // tutorial: parry detected
            // Tag with the current dash-attack id so its eventual smash event is
            // attributed to the right popup bucket. Bumping pending count here
            // and decrementing on destroy lets us flush the parade popup the
            // instant the last reflected projectile resolves (no timeout wait).
            pr._dashAtkId = this._currentDashAtkId || 0;
            if (pr._dashAtkId) {
              this._paradePending = this._paradePending || {};
              this._paradePending[pr._dashAtkId] = (this._paradePending[pr._dashAtkId] || 0) + 1;
            }
            pr.smashed = true;
            pr.life = C.PROJ_LIFE;
            pr.rotSpeed = 28;
            pr.spr.setTint(0xaa44ff);

            // Glitch projectile: on parry it locks onto a random far on-screen
            // enemy (different from the ones its siblings already chose) and
            // chases it slowly with strong homing — steering above handles it.
            if (pr.homing && this._pickDistantVisibleEnemy) {
              var exGl = [];
              for (var eg = 0; eg < this.projectiles.length; eg++) {
                var pg = this.projectiles[eg];
                if (pg !== pr && pg.homing && pg.isReflected && pg.homeTarget) exGl.push(pg.homeTarget);
              }
              pr.homeTarget = this._pickDistantVisibleEnemy(exGl);
              if (pr.homeTarget) {
                var gha = Phaser.Math.Angle.Between(pr.x, pr.y, pr.homeTarget.x, pr.homeTarget.y);
                pr.vx = Math.cos(gha) * C.ANO_PROJ_SPEED;     // stays slow
                pr.vy = Math.sin(gha) * C.ANO_PROJ_SPEED;
              }
            }

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
