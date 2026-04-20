/* ==========================================================================
   Light Again — Collision Detection (scene method)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._checkCollisions = function () {
    var p = this.p;
    var pR = C.SIZE * 0.6;
    var isAtk = p.state === 'ATTACKING';
    var isDAtk = p.state === 'DASH_ATTACKING';
    var isDash = p.state === 'DASHING';
    var vuln = !isAtk && !isDAtk && !isDash;

    // Dash marks enemies instead of killing them
    if (isDash) {
      for (var mi = 0; mi < this.enemies.length; mi++) {
        var me = this.enemies[mi];
        if (me.isMarked) continue;
        var mdx = p.x - me.x, mdy = p.y - me.y;
        var mThresh = C.DASH_MARK_RADIUS + me.size * 0.5;
        if (mdx * mdx + mdy * mdy < mThresh * mThresh) {
          me.isMarked = true;
          var detoLvl = (this._upgradeLevels && this._upgradeLevels.detonation) || 0;
          me.markMaxTimer = detoLvl >= 1 ? 6000 : 3000;
          me.markTimer = me.markMaxTimer;
          me.stunTimer = 200;
          p.dashHitCount++;
          this._explode(me.x, me.y, [0, 255, 255], 8);
        }
      }
    }

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];

      // During TW, arrow passes through condemned enemies (already going to die)
      if (e._twCondemned && (isAtk || isDAtk)) continue;

      var dx = p.x - e.x, dy = p.y - e.y;
      var distSq = dx * dx + dy * dy;
      // Slightly larger hitbox for tier-3 shield vs dash-attack only
      var shieldBonus = (isDAtk && e.tier === 3 && e.hasShield) ? 10 : 0;
      var cThresh = pR + e.size * 0.5 + shieldBonus;
      if (distSq < cThresh * cThresh) {
        var dist = Math.sqrt(distSq);
        if (isAtk) {
          // Detonation on marked enemy — ignores shield entirely
          if (e.isMarked) {
            // During TW: defer detonation to resolution
            if (this._twActive) {
              this._twDeferDetonation(e);
              this._twDeferKill(i);
            } else {
              this._triggerDetonation(i);
            }
            p.state = 'MOVING';
            p.spinAngle = 0; p.atkTimer = 0;
            p.atkAvailable = true; p.atkCooldown = 0;
            return;
          }
          // Shield blocks basic attack — rebound
          if (e.tier === 3 && e.hasShield) {
            if (dist > 0.1) { p.vx = (dx / dist) * C.REBOUND_IMP; p.vy = (dy / dist) * C.REBOUND_IMP; }
            this._explode(e.x, e.y, [0, 255, 255], 6);
            this._triggerHitstop(C.HITSTOP_DUR);
            p.state = 'MOVING';
            p.spinAngle = 0; p.atkTimer = 0;
            p.atkAvailable = true; p.atkCooldown = 0;
            if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
            return;
          }
          var atkDmg = (e.tier === 3) ? 1 : 1;
          e.hp -= atkDmg;
          if (e.hp <= 0) {
            var dex = e.x, dey = e.y;
            this._killEnemy(i);
            this._trySpawnDelayedExplosion(dex, dey);
          } else {
            if (dist > 0.1) { e.vx -= (dx / dist) * 10; e.vy -= (dy / dist) * 10; }
            e.stunTimer = 300;
            this._explode(e.x, e.y, [255, 200, 60], 8);
            this._triggerHitstop(C.HITSTOP_DUR);
          }
          p.state = 'MOVING';
          p.spinAngle = 0; p.atkTimer = 0;
          p.atkAvailable = true; p.atkCooldown = 0;
          p.vx *= 0.3; p.vy *= 0.3;
          if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
          return;
        } else if (isDAtk) {
          if (e.tier === 3 && e.hasShield) {
            this._breakShield(e);
            p.vx = 0; p.vy = 0;
            if (dist > 0.1) {
              p.x = e.x + (dx / dist) * (e.size * 0.5 + pR + 2);
              p.y = e.y + (dy / dist) * (e.size * 0.5 + pR + 2);
            }
            p.hasHitDuringDashAttack = true;
            p.atkTimer = 0;
            p.state = 'MOVING';
            p.spinAngle = 0;
            this._triggerLandingBurst();
            // Star Power: instant reset after shield break
            if (this.isStarPowered) {
              p.atkAvailable = true; p.atkCooldown = 0;
              p.dashCooldown = 0; p.dashAvailable = true;
            }
            return;
          }
          var datkDmg = (e.tier === 3) ? 2 : 1;
          e.hp -= datkDmg;
          if (e.hp <= 0) {
            this._killEnemy(i);
          } else {
            e.stunTimer = 200;
            this._explode(e.x, e.y, [255, 200, 60], 8);
            this._triggerHitstop(C.HITSTOP_DUR);
          }
          p.hasHitDuringDashAttack = true;
          if (p.dashAtkExtended < C.DASHATK_MAX_EXT) {
            var ext = Math.min(C.DASHATK_CHAIN_EXT, C.DASHATK_MAX_EXT - p.dashAtkExtended);
            p.atkTimer += ext; p.dashAtkExtended += ext;
          }
        } else if (vuln && !p.invincible) {
          var cnx = dist > 0.1 ? dx / dist : 0;
          var cny = dist > 0.1 ? dy / dist : 0;
          this._damagePlayer(cnx, cny);
        }
      }
    }
  };

})();
