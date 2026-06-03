/* ==========================================================================
   Light Again — Spawning (scene methods)
   ========================================================================== */
(function () {
  'use strict';

  var LA = window.LightAgain;
  var C  = LA.C;
  var M  = LA.sceneMethods;

  // Spawn point at (ang, dist) from the player, kept inside the disc arena.
  // A spawn aimed past the rim otherwise lands out of bounds: the enemy snaps
  // back on its first update frame, but the spawn-ring VFX already fired in the
  // void outside the border. If the offset point is outside, flip it to the
  // opposite side of the player (preserving spawn distance, pointing inward),
  // then clamp to the disc as a backstop for the player hugging the wall.
  M._spawnPosNear = function (ang, dist, tier) {
    var eHalf = tier === 3 ? C.T3_SIZE : tier === 2 ? C.T2_SIZE : C.SIZE;
    var margin = eHalf * 1.2;
    var dx = Math.cos(ang) * dist;
    var dy = Math.sin(ang) * dist;
    var c = LA.clampDisc(this.p.x + dx, this.p.y + dy, margin);
    if (c.hit) c = LA.clampDisc(this.p.x - dx, this.p.y - dy, margin);
    return { x: c.x, y: c.y };
  };

  /* ---- Rarity "bag" -------------------------------------------------------
     The enemy TYPE is drawn from a shuffled bag (BAG_T1 simples, BAG_T2 shooters,
     BAG_T3 generators). Drawing removes one item; when the bag is empty it is
     rebuilt. This always respects the ratio and forbids long generator streaks
     (at most one generator per bag → never 3 in a row). Shared by both modes. */
  M._buildEnemyBag = function () {
    var bag = [], i;
    for (i = 0; i < C.BAG_T1; i++) bag.push(1);
    for (i = 0; i < C.BAG_T2; i++) bag.push(2);
    for (i = 0; i < C.BAG_T3; i++) bag.push(3);
    return bag;
  };

  M._drawFromBag = function () {
    if (!this._enemyBag || this._enemyBag.length === 0) this._enemyBag = this._buildEnemyBag();
    var i = (Math.random() * this._enemyBag.length) | 0; // random remaining = shuffled draw
    return this._enemyBag.splice(i, 1)[0];
  };

  /* Spawn one enemy of `tier` at (sx, sy) with its spawn-ring VFX. opts.ringColor
     overrides the default tier colour (e.g. Greed beacon spawns ring in mint). */
  M._spawnTierAt = function (tier, sx, sy, opts) {
    opts = opts || {};
    this._naturalSpawn = true;
    if (tier === 4) this._spawnSniperAt(sx, sy);
    else if (tier === 3) this._spawnBruiserAt(sx, sy);
    else if (tier === 2) this._spawnShooterAt(sx, sy);
    else this._spawnRusherAt(sx, sy);
    this._naturalSpawn = false;
    var ringColor = (opts.ringColor != null) ? opts.ringColor
      : (tier === 4 ? 0x8fe6ff : tier === 3 ? 0xaa00ff : tier === 2 ? 0xff7722 : 0xff0044);
    var ringR     = tier === 4 ? 84 : tier === 3 ? 90 : tier === 2 ? 72 : 55;
    this._spawnWaveRing(sx, sy, { maxRadius: ringR, color: ringColor, expandTime: 0.16 + Math.min(tier, 3) * 0.04 });
  };

  /* ---- Sandbox: a single enemy, drawn from the bag, around the player ---- */
  M._spawnSandboxOne = function () {
    if (this.enemies.length >= C.MAX_ENEMIES) return;
    var tier = this._drawFromBag();
    var ang  = Math.random() * Math.PI * 2;
    var dist = C.SPAWN_DIST + Math.random() * 120;
    var pos  = this._spawnPosNear(ang, dist, tier);
    this._spawnTierAt(tier, pos.x, pos.y);
  };

  /* ---- Hardcore: one burst wave; size grows with total kills ---- */
  M._hardcoreWaveSize = function () {
    return Math.min(C.HC_WAVE_BASE + Math.floor(this.totalKills / C.HC_WAVE_PER), C.HC_WAVE_MAX);
  };

  M._spawnHardcoreWave = function () {
    var slots = C.MAX_ENEMIES - this.enemies.length;
    if (slots <= 0) return;
    var size = Math.min(this._hardcoreWaveSize(), slots);
    var baseAng = Math.random() * Math.PI * 2;
    var spread  = size > 1 ? Math.PI * 1.2 : 0; // wider arc than sandbox
    for (var j = 0; j < size; j++) {
      var t    = size > 1 ? j / (size - 1) : 0.5;
      var ang  = baseAng + (t - 0.5) * spread + (Math.random() - 0.5) * 0.35;
      var dist = C.SPAWN_DIST + Math.random() * 160;
      var tier = this._drawFromBag();
      var pos  = this._spawnPosNear(ang, dist, tier);
      this._spawnTierAt(tier, pos.x, pos.y);
    }
  };

  /* ---- Sandbox spawn-rate control (mouse wheel) + floating speed slider ---- */
  M._adjustSandboxRate = function (dir) {
    var step = C.SANDBOX_RATE_STEP;
    var r = this._sandboxRate + dir * step;
    r = Math.round(r / step) * step;
    this._sandboxRate = Math.max(C.SANDBOX_RATE_MIN, Math.min(C.SANDBOX_RATE_MAX, r));
    this._spdUiTimer = C.SANDBOX_SPEED_UI_DUR; // (re)show the slider
  };

  M._updateSpeedUi = function (dt) {
    var g = this._spdBarGfx, txt = this._spdTxt;
    if (!g || !txt) return;
    if (this._spdUiTimer <= 0) {
      if (g.visible) { g.setVisible(false); txt.setVisible(false); }
      return;
    }
    this._spdUiTimer -= dt;
    var alpha = Math.max(0, Math.min(1, this._spdUiTimer / 0.45)); // fade over last 0.45s
    var frac = (this._sandboxRate - C.SANDBOX_RATE_MIN) / (C.SANDBOX_RATE_MAX - C.SANDBOX_RATE_MIN);
    var W = 84, H = 5;
    var cx = this.p.x, y0 = this.p.y - 52, x0 = cx - W / 2;
    g.clear();
    g.setVisible(true);
    g.fillStyle(0x081a26, 0.5 * alpha);  g.fillRoundedRect(x0 - 3, y0 - 3, W + 6, H + 6, 5);
    g.fillStyle(0x1b3a4c, 0.92 * alpha); g.fillRoundedRect(x0, y0, W, H, 3);
    g.fillStyle(0x39c6ff, alpha);        g.fillRoundedRect(x0, y0, Math.max(3, W * frac), H, 3);
    g.fillStyle(0xcdf2ff, alpha);        g.fillCircle(x0 + W * frac, y0 + H / 2, 4.5);
    var rate = this._sandboxRate;
    var rateStr = (rate % 1 === 0) ? String(rate) : rate.toFixed(1);
    txt.setText(LA.laGoT('laSpeed') + ' x' + rateStr);
    txt.setPosition(cx, y0 - 7);
    txt.setAlpha(alpha);
    txt.setVisible(true);
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
      texKey: '_enemy',
      _spawnAnimT: this._naturalSpawn ? 0.0 : 1.0,
    });
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
      texKey: '_shooter',
      _spawnAnimT: this._naturalSpawn ? 0.0 : 1.0,
    });
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
      _spawnPulseT: 0,   // birth-throb timer (set in _hiveEmitPulse on each spawn)
      targetWaypoint: { x: ex, y: ey },
      waypointTimer: 0,
      texKey: '_bruiser',
      _spawnAnimT: this._naturalSpawn ? 0.0 : 1.0,
    });
  };

  /* T4 Sniper ("Œil-scope") — spawns CLOAKED (invisible + invincible) and runs
     its own appear/charge/fire animation (sniper.js), so it skips the generic
     spawn-pop. It carries a per-enemy scopeGfx for the animated réticule. */
  M._spawnSniperAt = function (ex, ey) {
    var spr = this.add.image(ex, ey, '_sniper');
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(20);

    var trSpr = [], trData = [];
    for (var t = 0; t < this.ENEMY_TRAIL_N; t++) {
      var ts = this.add.image(ex, ey, '_sniper');
      ts.setBlendMode(Phaser.BlendModes.ADD);
      ts.setDepth(15); ts.setVisible(false);
      trSpr.push(ts);
      trData.push({ x: ex, y: ey, angle: 0 });
    }

    var scopeGfx = this.add.graphics();
    scopeGfx.setDepth(23);
    scopeGfx.setBlendMode(Phaser.BlendModes.ADD);

    // A sniper VACUUMED into the Anomaly zone must be VISIBLE the instant it's
    // teleported in (time is stopped during the wave — an invisible cloaked spawn
    // would look like nothing arrived). So it spawns as an already-OPEN charging
    // eye (snState CHARGE, snAppearT 1). After that first charge it resumes its
    // NORMAL cloak/charge cycle inside the zone — it is NOT permanently exposed.
    var trapped = !!this._anomalyBarrierActive;

    this.enemies.push({
      spr: spr, x: ex, y: ey, vx: 0, vy: 0,
      angle: 0, hp: C.T4_HP, size: C.T4_SIZE,
      speed: 0,
      stunTimer: 0, isMarked: false, markTimer: 0,
      trail: trData, trSpr: trSpr, _tw: 0, _tn: 0,
      tier: 4, fireCD: 0, chargeTimer: 0, isCharging: false, fireFlashTimer: 0,
      texKey: '_sniper',
      scopeGfx: scopeGfx,
      // Sniper state machine (see sniper.js)
      snState: trapped ? 'CHARGE' : 'CLOAK',
      snTimer: trapped ? C.T4_CHARGE_DUR : C.T4_CLOAK_DUR * (0.4 + Math.random() * 0.3),
      snChargeT: 0, snAppearT: trapped ? 1 : 0, snFireFlash: 0,   // trapped → eye OPEN at the teleport-in
      snOrbAng: null, snOrbDir: Math.random() < 0.5 ? -1 : 1, snAimAngle: 0,
      _snIntangible: !trapped,
      _spawnAnimT: 1.0,   // its own appear animation replaces the generic spawn pop
    });
  };

})();
