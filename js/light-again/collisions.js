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
        if (me._twCondemned) continue;    // already condemned (TW) → no new mark, it's going to die
        if (me._snIntangible) continue;   // cloaked sniper — can't be dash-marked
        var mdx = p.x - me.x, mdy = p.y - me.y;
        var mThresh = C.DASH_MARK_RADIUS + me.size * 0.5;
        if (mdx * mdx + mdy * mdy < mThresh * mThresh) {
          this._applyMarkToEnemy(me);   // mark + cyan sparks + grayed texture
          p.dashHitCount++;
        }
      }
      // Nothing below is reachable while DASHING (isAtk/isDAtk false → vuln false),
      // so skip the whole main collision pass: it would run a distSq per enemy and
      // a sqrt for any in range, all dead work. The marking pass above is the job.
      return;
    }

    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];

      // Cloaked sniper (T4 between shots) is fully intangible: the arrow passes
      // through it harmlessly and it can't be hit. Only a CHARGING/firing sniper
      // (e._snIntangible false) is solid — the player's window to kill it.
      if (e._snIntangible) continue;

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
            if (this._tutEvent) this._tutEvent('basicKill');  // tutorial: a TRUE basic-attack kill
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
          var datkDmg = (e.tier === 3 || e.tier === 4) ? 2 : 1;   // dash-attack one-shots the 2-HP sniper
          var dex2 = e.x, dey2 = e.y;
          e.hp -= datkDmg;
          if (e.hp <= 0) {
            this._killEnemy(i);
          } else {
            e.stunTimer = 200;
            this._explode(e.x, e.y, [255, 200, 60], 8);
            this._triggerHitstop(C.HITSTOP_DUR);
          }
          this._maybeDashAtkDelayedExp(dex2, dey2);  // dashAtk Lv3: 1/3 → delayed explosion
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

  /* Bounce the player off a circular boundary they're pressed against, given its
     OUTWARD unit normal (nx, ny). Aggressive states (dash / dash-attack / torpedo
     attack) rebound FASTER (restitution > 1 + a flat kick, capped); a gentle drift
     just springs off. Shared by the map wall (scene.js) AND the Anomaly firewall
     (anomaly.js) so both edges bounce identically. Caller has already snapped the
     position onto the rim. The wall-FX throttle (p._wallFxCd) is decremented once
     per frame by the scene wall pass. */
  M._applyAggressiveRebound = function (nx, ny) {
    var p = this.p;
    var vd = p.vx * nx + p.vy * ny;                  // speed INTO the boundary (>0 = outward)
    if (vd <= 0) return;
    var aggressive = (p.state === 'DASHING' || p.state === 'DASH_ATTACKING' || p.state === 'ATTACKING');
    var rest = aggressive ? C.WALL_REBOUND_ATTACK : C.WALL_REBOUND_BASE;
    p.vx -= nx * vd * (1 + rest);
    p.vy -= ny * vd * (1 + rest);
    if (aggressive) { p.vx -= nx * C.WALL_REBOUND_KICK; p.vy -= ny * C.WALL_REBOUND_KICK; }
    // Cap the rebound so it can never run away (inward speed = -(v·n)).
    var back = -(p.vx * nx + p.vy * ny);
    if (back > C.WALL_REBOUND_MAX) {
      var ex = back - C.WALL_REBOUND_MAX;
      p.vx += nx * ex; p.vy += ny * ex;
    }
    if (!(p._wallFxCd > 0)) {
      this._spawnWallImpact(p.x, p.y, nx, ny, aggressive ? 1.0 : 0.45);
      if (aggressive) { this.cameras.main.shake(80, 0.006); this._triggerHitstop(40); }
      p._wallFxCd = C.WALL_FX_CD;
    }
  };

})();
