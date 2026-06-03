/* ==========================================================================
   Light Again — Player Input & State Machine (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  M._inputVec = function () {
    var dx = 0, dy = 0, k = this._keys;
    if (k['ArrowUp']    || k['KeyW'] || k['KeyZ']) dy -= 1;
    if (k['ArrowDown']  || k['KeyS'])              dy += 1;
    if (k['ArrowLeft']  || k['KeyA'] || k['KeyQ']) dx -= 1;
    if (k['ArrowRight'] || k['KeyD'])               dx += 1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.001) { dx /= len; dy /= len; }
    // Gamepad left stick (analog): add it to the keyboard vector, then clamp the
    // combined magnitude to 1 so a partial tilt walks slower while diagonals stay
    // correct. Stick-only input keeps its analog magnitude (slow/fast walking).
    var pm = this._padMove;
    if (pm && (pm.dx !== 0 || pm.dy !== 0)) {
      dx += pm.dx; dy += pm.dy;
      var cl = Math.sqrt(dx * dx + dy * dy);
      if (cl > 1) { dx /= cl; dy /= cl; }
    }
    return { dx: dx, dy: dy };
  };

  M._tryDash = function () {
    var p = this.p;
    if (!p.dashAvailable || p.state !== 'MOVING') return;
    var inp = this._inputVec();
    var dx = inp.dx, dy = inp.dy;
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      dx = Math.cos(p.angle); dy = Math.sin(p.angle);
    }
    var dashLvl = (this._upgradeLevels && this._upgradeLevels.dash) || 0;
    var impMult = dashLvl >= 1 ? 1.35 : 1.0;
    var durMult = dashLvl >= 1 ? 1.20 : 1.0;
    p.vx += dx * C.DASH_IMP * impMult;
    p.vy += dy * C.DASH_IMP * impMult;
    p.state = 'DASHING';
    p.dashAvailable = false;
    p.dashTimer = C.DASH_DUR * durMult;
    p.dashCooldown = 0;
    p.dashDx = dx; p.dashDy = dy;
    p.dashHitCount = 0;
  };

  M._tryAttack = function () {
    var p = this.p;
    if (p.state === 'DEAD') return;   // dead / mid-resurrection → input is fully frozen
    // Prism of Refraction: while the ship is charged inside the crystal, a left-click
    // FIRES the 3-arrow strike instead of a normal attack (and is otherwise swallowed,
    // so a click mid-flight does nothing). See prism.js.
    if (p.state === 'PRISM') {
      if (this._prism && this._prism.phase === 'CHARGING') this._prismLaunch();
      return;
    }
    if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') return;
    if (p.state === 'RECOVERY') return;
    if (p.state === 'DASHING') { this._triggerDashAtk(); return; }
    // Coyote time: clicked during post-dash iframes → still a Dash-Attack
    if (p.dashCoyote) { this._triggerDashAtk(); return; }

    // Star Power override — basic attack becomes dash-attack toward cursor
    if (this.isStarPowered) {
      this._triggerDashAtk();
      return;
    }

    var cam = this.cameras.main;
    var wmx = this._mouseX + cam.scrollX;
    var wmy = this._mouseY + cam.scrollY;
    var adx = wmx - p.x, ady = wmy - p.y;
    var al = Math.sqrt(adx * adx + ady * ady);
    if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
    else { adx /= al; ady /= al; }

    // Auto-aim: prioritise closest marked enemy in attack range, then follow mouse
    // During The World, skip condemned enemies (already hit, will die at resolution).
    var atkRange = C.SIZE * 0.6 + C.RUSHER_SIZE + C.ATK_DUR * 0.02 * C.ATK_IMP;
    var bestMarkDSq = atkRange * atkRange, bestMark = null;
    for (var ne = 0; ne < this.enemies.length; ne++) {
      var en = this.enemies[ne];
      if (!en.isMarked) continue;
      if (this._twActive && en._twCondemned) continue;
      var ndx = en.x - p.x, ndy = en.y - p.y;
      var ndSq = ndx * ndx + ndy * ndy;
      if (ndSq < bestMarkDSq) { bestMarkDSq = ndSq; bestMark = en; }
    }
    if (bestMark) {
      var mAdx = bestMark.x - p.x, mAdy = bestMark.y - p.y;
      var mAl = Math.sqrt(mAdx * mAdx + mAdy * mAdy);
      if (mAl > 0.1) { adx = mAdx / mAl; ady = mAdy / mAl; }
    }

    p.vx += adx * C.ATK_IMP; p.vy += ady * C.ATK_IMP;
    p.state = 'ATTACKING'; p.atkAvailable = false;
    p.atkTimer = C.ATK_DUR; p.atkCooldown = 0;
    p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
  };

  M._triggerDashAtk = function () {
    var p = this.p;
    var cam = this.cameras.main;
    var wmx = this._mouseX + cam.scrollX;
    var wmy = this._mouseY + cam.scrollY;
    var adx = wmx - p.x, ady = wmy - p.y;
    var al = Math.sqrt(adx * adx + ady * ady);
    if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
    else { adx /= al; ady /= al; }

    var dAtkLvl = (this._upgradeLevels && this._upgradeLevels.dashAtk) || 0;
    var impMult  = dAtkLvl >= 1 ? 1.45 : 1.0;
    var durMult  = dAtkLvl >= 1 ? 1.40 : 1.0;
    p.vx = adx * C.DASH_ATK_IMP * impMult; p.vy = ady * C.DASH_ATK_IMP * impMult;
    // Each dash attack gets a unique id so reflected projectiles spawned during
    // it can be grouped into a single PARADE big-score popup (count = number
    // of reflected projectiles that actually connected). Tagged on projectiles
    // at deflect time, drained in _destroyProjectile via _paradeFlushIfDone.
    this._dashAtkCounter   = (this._dashAtkCounter || 0) + 1;
    this._currentDashAtkId = this._dashAtkCounter;
    p.state = 'DASH_ATTACKING'; p.atkAvailable = false;
    p.atkTimer = C.DASH_ATK_DUR * durMult; p.atkCooldown = 0;
    p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
    p.hasHitDuringDashAttack = false; p.dashAtkExtended = 0;
    p._dashAtkExpSpawned = false;   // dashAtk Lv3: reset the once-per-attack delayed-exp cap
    // Dash Lv1 cuts the cooldown by 30% — apply it here too. A normal dash does
    // (scene.js), but omitting it after a dash-attack silently dropped the bonus
    // AND desynced the HUD gauge (which divides by the 0.70-scaled max).
    var dashUpLvl = (this._upgradeLevels && this._upgradeLevels.dash) || 0;
    p.dashTimer = 0;
    p.dashCooldown = C.DASH_CD * (dashUpLvl >= 1 ? 0.70 : 1.0) * (this._dashCdMult || 1);  // Dash Lv1 + dashRage curse
    p.dashCoyote = false; p.dashInvinc = false;
  };

  M._damagePlayer = function (nx, ny) {
    var p = this.p;
    if (p.invincible) return;
    if (this._highwayInvuln) return;  // riding a Data Highway → untouchable
    if (this._twActive) return;  // invulnerable during time stop

    if (this.playerShields > 0) {
      this.playerShields--;
      this._breakCombo();
      this._shieldSacrificeFlash();
      this._explode(p.x, p.y, [0, 255, 255], 18);
      this._explode(p.x, p.y, [255, 255, 255], 12);
      this.cameras.main.shake(200, 0.022);
      this._triggerHitstop(90);
      p.invincible = true; p.invincTimer = C.IFRAMES_DUR; p.dashInvinc = false;
      if (nx !== 0 || ny !== 0) { p.vx += nx * 8; p.vy += ny * 8; }
      // Shield Lv3: losing a shield plants a delayed explosion (retaliation).
      // Scales with the Explosion-à-retardement (baseAtk) branch, min Lv1.
      if (((this._upgradeLevels && this._upgradeLevels.shield) || 0) >= 3) {
        this._spawnDelayedExplosion(p.x, p.y, Math.max(1, (this._upgradeLevels && this._upgradeLevels.baseAtk) || 0));
      }
    } else {
      this._triggerGameOver();
    }
  };

  M._triggerGameOver = function () {
    var p = this.p;
    if (p.state === 'DEAD') return;
    // Cyber-Fairy extra life: if one is following, it takes the hit — dives onto
    // the ship, nukes the screen and resurrects. The player never dies here.
    if (this._fairyInterceptGameOver && this._fairyInterceptGameOver()) return;
    p.state = 'DEAD';
    p.invincible = true; p.invincTimer = 99999;
    this.timeScale = 0;
    this.hitstopTimer = 0;
    this._explode(p.x, p.y, [255, 60, 0], 60);
    this._explode(p.x, p.y, [255, 220, 50], 30);
    this._explode(p.x, p.y, [255, 255, 255], 20);
    this.cameras.main.shake(280, 0.016);
    this.cameras.main.flash(300, 255, 60, 0);
    this.playerSpr.setVisible(false);
    for (var ti = 0; ti < this.TRAIL_CAP; ti++) this._trail[ti].spr.setVisible(false);
    for (var oi = 0; oi < this._shieldOrbs.length; oi++) this._shieldOrbs[oi].setVisible(false);
    // NB: the anomaly is intentionally NOT cleared here — like the other enemies
    // it persists through death (and through sandbox respawn).
    this.spawnTimer = -999999;
    var self = this;
    this.time.delayedCall(900, function () {
      if (window.__laGameMode === 'sandbox') {
        self._sandboxRespawn();
      } else {
        self._showGameOverScreen();
      }
    });
  };

  M._sandboxRespawn = function () {
    var p = this.p;
    // Respawn in place (don't teleport to a fixed world point — that yanked the
    // follow-camera across the map; cam.width/2 was also a screen coord misused
    // as a world coord).
    p.vx = 0; p.vy = 0;
    p.state = 'MOVING';
    p.hp = 1;
    p.invincible = true;
    p.invincTimer = 2500;   // 2.5s of i-frames — invincTimer is in MILLISECONDS
    p.dashInvinc = false;
    p.dashAvailable = true; p.dashCooldown = 0;
    p.atkAvailable = true; p.atkCooldown = 0;
    this.timeScale = 1.0;
    this.spawnTimer = 0;
    // Dying is a setback: drop the combo, exactly like taking a hit that costs a
    // shield does. (No-op if the combo was already at x1.)
    this._breakCombo();
    this.playerSpr.setVisible(true);
    for (var ti = 0; ti < this.TRAIL_CAP; ti++) this._trail[ti].spr.setVisible(true);
    for (var oi = 0; oi < this._shieldOrbs.length; oi++) this._shieldOrbs[oi].setVisible(false);
    // Sandbox kindness: if the player died with 0 shields, gift one back on
    // respawn (capped by MAX_SHIELDS upgrades). Anything > 0 is left alone.
    if (this.playerShields < 1) this.playerShields = Math.min(1, this.MAX_SHIELDS);

    // Clear a safe bubble: shove nearby enemies outward and stun them, so the
    // player isn't instantly re-killed when the i-frames expire while standing
    // on a swarm (fixes the sandbox spawn-kill loop).
    this._safeBubblePush(p, 340);

    // Tutorial: re-arm the per-step freeze. Enemies stay live just long enough to
    // be flung away by the knockback above (the burst window), then they hold
    // still and wait for the player's next input — like the step just started.
    if (this._tutorialActive && !this._tutSandboxStep) {
      this._tutBurstT = 0.7;
      this._tutEnemiesFrozen = false;
    }
  };

  /* Safe-bubble push: shove every enemy within `clearR` of the player outward
     and stun them briefly, with a cyan flash + wave ring. Shared by the sandbox
     respawn, the anomaly's time-resume, and the upgrade-draft close — anywhere
     the player needs a clean beat to restart without being instantly swarmed. */
  M._safeBubblePush = function (p, clearR) {
    clearR = clearR || 340;
    var clearRSq = clearR * clearR;
    for (var k = 0; k < this.enemies.length; k++) {
      var o = this.enemies[k];
      var dx = o.x - p.x, dy = o.y - p.y;
      var dSq = dx * dx + dy * dy;
      if (dSq > clearRSq) continue;
      var d = Math.sqrt(dSq);
      var nx = d > 0.1 ? dx / d : Math.random() - 0.5;
      var ny = d > 0.1 ? dy / d : Math.random() - 0.5;
      var push = 30 * (o.tier === 3 ? 0.6 : 1.0);
      o.vx += nx * push;
      o.vy += ny * push;
      o.stunTimer = Math.max(o.stunTimer || 0, 1000);
    }

    this.cameras.main.flash(350, 0, 180, 255);
    this._explode(p.x, p.y, [0, 220, 255], 25);
    this._spawnWaveRing(p.x, p.y, { maxRadius: clearR, color: 0x00ccff, expandTime: 0.45 });
  };

})();