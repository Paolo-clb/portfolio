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
    p.vx += dx * C.DASH_IMP;
    p.vy += dy * C.DASH_IMP;
    p.state = 'DASHING';
    p.dashAvailable = false;
    p.dashTimer = C.DASH_DUR;
    p.dashCooldown = 0;
    p.dashDx = dx; p.dashDy = dy;
    p.dashHitCount = 0;
  };

  M._tryAttack = function () {
    var p = this.p;
    if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING') return;
    if (p.state === 'RECOVERY') return;
    if (p.state === 'DASHING') { this._triggerDashAtk(); return; }

    var cam = this.cameras.main;
    var wmx = this._mouseX + cam.scrollX;
    var wmy = this._mouseY + cam.scrollY;
    var adx = wmx - p.x, ady = wmy - p.y;
    var al = Math.sqrt(adx * adx + ady * ady);
    if (al < 1) { adx = Math.cos(p.angle); ady = Math.sin(p.angle); }
    else { adx /= al; ady /= al; }

    // Auto-aim: prioritise closest marked enemy in attack range, then follow mouse
    var atkRange = C.SIZE * 0.6 + C.RUSHER_SIZE + C.ATK_DUR * 0.02 * C.ATK_IMP;
    var bestMarkDSq = atkRange * atkRange, bestMark = null;
    for (var ne = 0; ne < this.enemies.length; ne++) {
      var en = this.enemies[ne];
      if (!en.isMarked) continue;
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

    p.vx = adx * C.DASH_ATK_IMP; p.vy = ady * C.DASH_ATK_IMP;
    p.state = 'DASH_ATTACKING'; p.atkAvailable = false;
    p.atkTimer = C.DASH_ATK_DUR; p.atkCooldown = 0;
    p.atkDx = adx; p.atkDy = ady; p.spinAngle = 0;
    p.hasHitDuringDashAttack = false; p.dashAtkExtended = 0;
    p.dashTimer = 0; p.dashCooldown = C.DASH_CD;
  };

  M._damagePlayer = function (nx, ny) {
    var p = this.p;
    if (p.invincible) return;

    if (this.playerShields > 0) {
      this.playerShields--;
      this._breakCombo();
      this._explode(p.x, p.y, [0, 255, 255], 18);
      this._explode(p.x, p.y, [255, 255, 255], 12);
      this.cameras.main.shake(200, 0.022);
      this._triggerHitstop(90);
      p.invincible = true; p.invincTimer = C.IFRAMES_DUR; p.dashInvinc = false;
      if (nx !== 0 || ny !== 0) { p.vx += nx * 8; p.vy += ny * 8; }
    } else {
      this._triggerGameOver();
    }
  };

  M._triggerGameOver = function () {
    var p = this.p;
    if (p.state === 'DEAD') return;
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
    this.spawnTimer = -999999;
    var self = this;
    this.time.delayedCall(900, function () {
      self._showGameOverScreen();
    });
  };

})();
