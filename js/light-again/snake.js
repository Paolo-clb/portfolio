/* ==========================================================================
   Light Again — The Serpent (4th mini-boss / a splitting snake)

   A slithering worm led by an INVULNERABLE armoured head and trailing a chain
   of body segments, each with its own HP (a chipped segment reddens + cracks so
   the damage is readable at a glance).

     • HEAD     — invulnerable. It's the ONLY part that hurts the player (touch
                  = damage, with a bigger bite mid-lunge). Hitting it just clinks.
     • BODY     — safe to dive into and carve up. Every damage source chips it:
                  melee, dash-attack, reflected projectiles, the nuke, delayed
                  explosions. Explosions are throttled (small fixed damage +
                  per-segment AoE i-frames + a per-blast cap) so the constant
                  storm of explosions only nibbles the worm instead of deleting it.
     • SPLIT    — break a body segment that ISN'T the tail and the worm SPLITS in
                  two: the chunk behind the cut grows its OWN new invulnerable
                  head and slithers off. Splits cascade into a writhing nest.
     • SCALING  — the SHORTER a worm is, the FRAGILER its segments (fewer hits to
                  break) and the FASTER it moves — small worms are quick darts.
     • DEATH    — a worm dies when reduced to a lone head; the boss dies when
                  every worm is gone, and (like the others) drops a free upgrade.

   Attacks: relentless slither-chase (the head hunts you and hurts on contact),
   plus reflectable VENOM volleys — each bolt is a writhing mini-serpent (one
   worm spits at a time so the swarm stays readable).

   Self-contained on `this._snake` (NOT in `this.enemies`), driven by scaled
   world-time so hitstop / slow-mo / The World freeze it like any other enemy.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* RGB lerp between two 0xRRGGBB colours (t: 0 → c1, 1 → c2). */
  function lerpC(c1, c2, t) {
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var r1 = (c1 >> 16) & 255, g1 = (c1 >> 8) & 255, b1 = c1 & 255;
    var r2 = (c2 >> 16) & 255, g2 = (c2 >> 8) & 255, b2 = c2 & 255;
    return ((Math.round(r1 + (r2 - r1) * t) << 16) |
            (Math.round(g1 + (g2 - g1) * t) << 8) |
             Math.round(b1 + (b2 - b1) * t));
  }

  var BODY_OK  = 0x2fe06e;   // healthy body colour
  var BODY_HURT = 0xff2a44;  // fully-damaged body colour
  var HEAD_COL = 0x179a55;   // armoured head fill

  /* ================================================================
     LENGTH-DRIVEN STATS — short worms are fragile + fast
     ================================================================ */
  M._snakeSegMaxHp = function (len) {
    var h = Math.round(len / C.SNAKE_HP_PER_LEN);
    if (h < 1) h = 1; else if (h > C.SNAKE_SEG_HP_MAX) h = C.SNAKE_SEG_HP_MAX;
    return h;
  };
  M._snakeSpeed = function (len) {
    var f = len / C.SNAKE_SPEED_LEN_REF;
    if (f > 1) f = 1; else if (f < 0) f = 0;
    return C.SNAKE_SPEED_BASE * (1 + C.SNAKE_SPEED_SHORT * (1 - f));
  };

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initSnake = function () {
    this._snake = null;
  };

  M._clearSnake = function (_silent) {
    var s = this._snake;
    this._snake = null;
    if (!s) return;
    if (s.gfx)   s.gfx.destroy();
    if (s.fxGfx) s.fxGfx.destroy();
  };

  /* ================================================================
     SPAWN — emerge from a rift in the player's field of view
     ================================================================ */
  M._spawnSnake = function () {
    if (this._snake || this._anomaly || this._gigaBruiser || this._mirror) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var p = this.p, cam = this.cameras.main;
    var view = cam.worldView, viewMin = Math.min(view.width, view.height);
    var dist = Math.max(C.SNAKE_HEAD_SIZE * 4, viewMin * 0.34);
    var ang  = p.angle;
    var hx = p.x + Math.cos(ang) * dist;
    var hy = p.y + Math.sin(ang) * dist;

    // Keep the head in-frame AND inside the arena.
    var m   = C.WORLD_HALF - C.SNAKE_HEAD_SIZE * 1.5;
    var pad = C.SNAKE_HEAD_SIZE * 2;
    var loX = Math.max(view.x + pad, -m), hiX = Math.min(view.right  - pad, m);
    var loY = Math.max(view.y + pad, -m), hiY = Math.min(view.bottom - pad, m);
    if (loX > hiX) loX = hiX = (view.x + view.right)  / 2;
    if (loY > hiY) loY = hiY = (view.y + view.bottom) / 2;
    hx = Math.min(hiX, Math.max(loX, hx));
    hy = Math.min(hiY, Math.max(loY, hy));

    // Body trails AWAY from the player (so the head faces them).
    var awx = hx - p.x, awy = hy - p.y, awl = Math.sqrt(awx * awx + awy * awy) || 1;
    var dx = awx / awl, dy = awy / awl;
    var wM = C.WORLD_HALF - C.SNAKE_SEG_SIZE;

    var segs = [];
    for (var i = 0; i < C.SNAKE_SEG_COUNT; i++) {
      var sx = hx + dx * C.SNAKE_SPACING * (i + 1);
      var sy = hy + dy * C.SNAKE_SPACING * (i + 1);
      if (sx < -wM) sx = -wM; else if (sx > wM) sx = wM;
      if (sy < -wM) sy = -wM; else if (sy > wM) sy = wM;
      segs.push({
        x: sx, y: sy, hp: 0, maxHp: 0, angle: Math.atan2(-dy, -dx),
        hitFlash: 0, aoeIframe: 0, lastDAtkId: -1, cracks: [], _dead: false,
      });
    }

    var worm = {
      hx: hx, hy: hy, hvx: 0, hvy: 0,
      hAngle: Math.atan2(p.y - hy, p.x - hx),
      segs: segs, segMaxHp: 0, speed: 0,
      slitherPhase: Math.random() * TAU,
      orbitSign: Math.random() < 0.5 ? -1 : 1,
      wanderAng: 0,
      spitCD: 700 + Math.random() * 900,
      whipCD: 1500 + Math.random() * 1800, whipT: 0, whipHit: false,
      whipDir: 0, whipSign: 1,
      headClink: 0, splitFlash: 0, introReveal: 0,
    };
    this._snakeInitWormStats(worm, true);

    var gfx = this.add.graphics(); gfx.setDepth(25);
    var fxGfx = this.add.graphics(); fxGfx.setDepth(33);
    fxGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._snake = {
      worms: [worm], dead: false,
      spawnPhase: 'EMERGE', introT: 0,
      gfx: gfx, fxGfx: fxGfx, splitFx: [],
      _lastX: hx, _lastY: hy,
    };

    // Rift entrance burst
    this._spawnWaveRing(hx, hy, { maxRadius: 170, color: 0x33ff88, expandTime: 0.42 });
    this._spawnWaveRing(hx, hy, { maxRadius: 90,  color: 0xffffff, expandTime: 0.28 });
    this._explode(hx, hy, [120, 255, 150], 26);
    this._explode(hx, hy, [255, 255, 255], 12);
    this.cameras.main.shake(150, 0.007);
  };

  /* Set segMaxHp + speed from the worm's current length. fresh=true also fills
     each segment to full HP (spawn); otherwise HP is only clamped DOWN so a
     freshly-split (shorter) worm becomes fragiler without being healed. */
  M._snakeInitWormStats = function (worm, fresh) {
    var len = worm.segs.length;
    worm.segMaxHp = this._snakeSegMaxHp(len);
    worm.speed    = this._snakeSpeed(len);
    for (var i = 0; i < worm.segs.length; i++) {
      var sg = worm.segs[i];
      sg.maxHp = worm.segMaxHp;
      if (fresh) { sg.hp = worm.segMaxHp; sg.cracks.length = 0; }
      else if (sg.hp > worm.segMaxHp) sg.hp = worm.segMaxHp;
      // Keep cracks consistent with the current damage so a clamped-down segment
      // doesn't render as healthy green while still wearing old crack lines.
      var want = Math.min(4, sg.maxHp - Math.max(0, sg.hp));
      if (sg.cracks.length > want) sg.cracks.length = want;
    }
  };

  /* ================================================================
     UPDATE — per-frame logic (scaled world-time sMs, player pMs, real dt)
     ================================================================ */
  M._updateSnake = function (sMs, pMs, dt) {
    if (!this._snake) return;
    var s = this._snake, p = this.p;
    if (p.state === 'DEAD') { this._renderSnake(dt); return; }

    // Cinematic entrance — driven on REAL dt, intangible while forming.
    if (s.spawnPhase === 'EMERGE') {
      this._snakeTickEmerge(dt);
      this._renderSnake(dt);
      return;
    }

    // Visual decays always tick (even while frozen) so flashes read.
    var w, sg, i, j;
    for (i = 0; i < s.worms.length; i++) {
      w = s.worms[i];
      w.headClink  = Math.max(0, w.headClink  - dt * 4);
      w.splitFlash = Math.max(0, w.splitFlash - dt * 3);
      for (j = 0; j < w.segs.length; j++) {
        w.segs[j].hitFlash = Math.max(0, w.segs[j].hitFlash - dt * 4);
      }
    }

    // Frozen during The World / hitstop / slow-mo — render only.
    if (this._twActive || sMs < 0.001) { this._renderSnake(dt); return; }

    // Gameplay timers + movement + per-worm venom spit.
    for (i = 0; i < s.worms.length; i++) {
      w = s.worms[i];
      for (j = 0; j < w.segs.length; j++) {
        sg = w.segs[j];
        if (sg.aoeIframe > 0) sg.aoeIframe = Math.max(0, sg.aoeIframe - sMs);
      }
      this._snakeMoveWorm(w, sMs, dt);
      // Every worm spits on its OWN cadence; shorter worms fire fewer bolts, less
      // often (per-worm spitCD + length-scaled count). Global cap keeps it sane.
      w.spitCD -= sMs;
      if (w.spitCD <= 0) {
        this._snakeWormSpit(w);
        w.spitCD = this._snakeSpitCD(w.segs.length);
      }
      // Defensive COUP DE QUEUE — a longer worm lashes its tail when attacked,
      // repelling the player + enemies (no damage). May reshape s.worms? No — the
      // whip never splits, so iterating s.worms here stays safe.
      this._snakeUpdateWhip(w, sMs);
    }

    if (s.worms.length) { s._lastX = s.worms[0].hx; s._lastY = s.worms[0].hy; }
    this._renderSnake(dt);
  };

  /* Entrance: head surfaces, then segments pop into being head→tail. */
  M._snakeTickEmerge = function (dt) {
    var s = this._snake;
    s.introT += dt * 1000;
    var w = s.worms[0];
    if (!w) { s.spawnPhase = null; return; }

    var total = w.segs.length;
    var t = s.introT / C.SNAKE_ARRIVE_DUR; if (t > 1) t = 1;
    var reveal = t * total;

    // Per-segment pop as each one crosses into existence — each newborn node
    // punches in with a `_pop` overshoot (scaled up + white-hot, decayed in the
    // renderer), so the body reads as ZIPPING into being head→tail rather than
    // blandly appearing.
    var prev = Math.floor(w.introReveal);
    var now  = Math.floor(reveal);
    for (var k = prev; k < now && k < total; k++) {
      var sg = w.segs[k];
      sg._pop = 1;
      this._explode(sg.x, sg.y, [150, 255, 180], 12);
      this._spawnWaveRing(sg.x, sg.y, { maxRadius: C.SNAKE_SEG_SIZE * 3.2, color: 0x33ff88, expandTime: 0.16 });
      this._explode(sg.x, sg.y, [255, 255, 255], 4);
    }
    w.introReveal = reveal;

    // Head writhes a little while it rises.
    w.hAngle += Math.sin(s.introT * 0.012) * dt * 1.2;
    if (Math.random() < 0.16) this._explode(w.hx, w.hy, [150, 255, 180], 4);

    if (t >= 1) {
      s.spawnPhase = null;
      w.introReveal = total + 1;
      // Fully-formed flourish.
      this._spawnWaveRing(w.hx, w.hy, { maxRadius: 260, color: 0x33ff88, expandTime: 0.30 });
      this._spawnWaveRing(w.hx, w.hy, { maxRadius: 160, color: 0xffffff, expandTime: 0.20 });
      this._explode(w.hx, w.hy, [120, 255, 150], 30);
      this._explode(w.hx, w.hy, [255, 255, 255], 16);
      this.cameras.main.flash(160, 120, 255, 160);
      this.cameras.main.shake(220, 0.013);
      this._triggerHitstop(C.HITSTOP_DUR);
    }
  };

  /* ----------------------------------------------------------------
     MOVEMENT — head AI (slither / lunge state machine) + body follow
     ---------------------------------------------------------------- */
  M._snakeMoveWorm = function (worm, sMs, dt) {
    var p = this.p;
    var sc60 = sMs / 16.7;
    var len  = worm.segs.length;
    var shortF = 1 - Math.min(1, len / C.SNAKE_SPEED_LEN_REF);   // 0 long → 1 tiny

    var tdx = p.x - worm.hx, tdy = p.y - worm.hy;
    var td  = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    var aim = Math.atan2(tdy, tdx);

    // Frantic slither-chase. Each worm weaves on its own fast sine wiggle PLUS a
    // drifting personal "wander" offset, so every worm hunts on an individual
    // path and approaches from its own angle instead of clumping onto one point.
    worm.slitherPhase += dt * C.SNAKE_SLITHER_FREQ * (1 + shortF * 1.1);
    worm.wanderAng += (Math.random() - 0.5) * dt * C.SNAKE_WANDER_RATE * (1 + shortF);
    if (worm.wanderAng >  C.SNAKE_WANDER_MAX) worm.wanderAng =  C.SNAKE_WANDER_MAX;
    else if (worm.wanderAng < -C.SNAKE_WANDER_MAX) worm.wanderAng = -C.SNAKE_WANDER_MAX;
    var wiggle = Math.sin(worm.slitherPhase) * C.SNAKE_SLITHER_AMP;
    var desired = aim + wiggle + worm.wanderAng;
    if (td < C.SNAKE_KEEP_DIST) desired = aim + worm.orbitSign * (Math.PI * 0.5) + wiggle + worm.wanderAng;

    // Separation: bend the head away from other worm heads so the pack spreads
    // out across the arena instead of stacking on top of each other.
    var sn = this._snake;
    var sepx = 0, sepy = 0, sepR = C.SNAKE_SEP_RADIUS, sepR2 = sepR * sepR;
    for (var wi = 0; wi < sn.worms.length; wi++) {
      var o = sn.worms[wi];
      if (o === worm) continue;
      var odx = worm.hx - o.hx, ody = worm.hy - o.hy;
      var od2 = odx * odx + ody * ody;
      if (od2 > sepR2 || od2 < 0.01) continue;
      var od = Math.sqrt(od2);
      var wgt = (1 - od / sepR) / od;
      sepx += odx * wgt; sepy += ody * wgt;
    }
    if (sepx !== 0 || sepy !== 0) {
      var dvx = Math.cos(desired) + sepx * C.SNAKE_SEP_FORCE;
      var dvy = Math.sin(desired) + sepy * C.SNAKE_SEP_FORCE;
      if (dvx !== 0 || dvy !== 0) desired = Math.atan2(dvy, dvx);
    }

    this._snakeSteer(worm, desired, C.SNAKE_TURN * dt);

    // Frantic speed surge — a throbbing variation so motion never reads steady.
    var speed = worm.speed * (1 + 0.14 * Math.sin(worm.slitherPhase * 0.6));

    // Integrate the head (snappy: velocity follows the steered heading).
    worm.hvx = Math.cos(worm.hAngle) * speed;
    worm.hvy = Math.sin(worm.hAngle) * speed;
    worm.hx += worm.hvx * sc60;
    worm.hy += worm.hvy * sc60;

    // Hard clamp to the arena so the boss is always reachable.
    var mw = C.WORLD_HALF - C.SNAKE_HEAD_SIZE * 1.1;
    if (worm.hx < -mw) { worm.hx = -mw; worm.hAngle = Math.PI - worm.hAngle; }
    else if (worm.hx > mw) { worm.hx = mw; worm.hAngle = Math.PI - worm.hAngle; }
    if (worm.hy < -mw) { worm.hy = -mw; worm.hAngle = -worm.hAngle; }
    else if (worm.hy > mw) { worm.hy = mw; worm.hAngle = -worm.hAngle; }

    // Body: distance-constraint follow (rope) → smooth slithering trail.
    // Each node is also clamped inside the arena so a body draped past a corner
    // can never leave the world and become unhittable.
    var sw = C.WORLD_HALF - C.SNAKE_SEG_SIZE;
    var prevX = worm.hx, prevY = worm.hy;
    for (var i = 0; i < worm.segs.length; i++) {
      var sg = worm.segs[i];
      var dx = sg.x - prevX, dy = sg.y - prevY;
      var d  = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      sg.x = prevX + (dx / d) * C.SNAKE_SPACING;
      sg.y = prevY + (dy / d) * C.SNAKE_SPACING;
      if (sg.x < -sw) sg.x = -sw; else if (sg.x > sw) sg.x = sw;
      if (sg.y < -sw) sg.y = -sw; else if (sg.y > sw) sg.y = sw;
      sg.angle = Math.atan2(prevY - sg.y, prevX - sg.x);
      prevX = sg.x; prevY = sg.y;
    }
  };

  /* Turn hAngle toward `target` by at most `maxStep` radians (shortest way). */
  M._snakeSteer = function (worm, target, maxStep) {
    var d = Phaser.Math.Angle.Wrap(target - worm.hAngle);
    if (d >  maxStep) d =  maxStep;
    else if (d < -maxStep) d = -maxStep;
    worm.hAngle = Phaser.Math.Angle.Wrap(worm.hAngle + d);
  };

  /* ----------------------------------------------------------------
     VENOM SPIT — EVERY worm fires on its own cadence; shorter worms fire
     fewer bolts, less often (scaled by length). The global MAX_PROJECTILES
     cap in _spawnProjectile keeps the total swarm bounded.
     ---------------------------------------------------------------- */
  M._snakeSpitCount = function (len) {
    var n = Math.round(len / C.SNAKE_SPIT_PER_LEN);
    if (n < 1) n = 1; else if (n > C.SNAKE_SPIT_COUNT) n = C.SNAKE_SPIT_COUNT;
    return n;
  };
  M._snakeSpitCD = function (len) {
    var f = len / C.SNAKE_SPEED_LEN_REF;
    if (f > 1) f = 1; else if (f < 0) f = 0;
    // Shorter worm → longer interval (spits less often), with jitter to desync.
    return C.SNAKE_SPIT_CD * (0.85 + (1 - f) * 1.7) * (0.7 + Math.random() * 0.6);
  };
  M._snakeWormSpit = function (worm) {
    var p = this.p;
    var n = this._snakeSpitCount(worm.segs.length);
    var base = Math.atan2(p.y - worm.hy, p.x - worm.hx);
    for (var k = 0; k < n; k++) {
      var t = n > 1 ? (k / (n - 1) - 0.5) : 0;
      var ang = base + t * 2 * C.SNAKE_SPIT_SPREAD;
      this._spawnSnakeSpit(worm.hx, worm.hy, ang);
    }
    this._explode(worm.hx, worm.hy, [120, 255, 150], 8);
    this._spawnWaveRing(worm.hx, worm.hy, { maxRadius: C.SNAKE_HEAD_SIZE * 2.2, color: 0x33ff88, expandTime: 0.16 });
  };

  /* A venom bolt rides the normal projectile system, but its PARRY is unique:
     instead of bouncing straight back as a lone shard, a dash-attack bursts it
     into a fan of tamed hatchlings (_snakeParrySplit, called from projectiles.js
     deflect branch). Drawn as a writhing mini-serpent both in flight (green) and
     when parried (cyan) by _renderSnakeVenom — the default shard sprite is hidden. */
  M._spawnSnakeSpit = function (ex, ey, angle) {
    var before = this.projectiles.length;
    this._spawnProjectile(ex, ey, angle, C.SNAKE_SPIT_SPEED, null);
    if (this.projectiles.length > before) {
      var pr = this.projectiles[this.projectiles.length - 1];
      pr.snakeSpit = true;
      pr.snakeWig  = Math.random() * TAU;   // per-bolt wiggle phase seed
      if (pr.spr) pr.spr.setVisible(false);
    }
  };

  /* PARRY → SPLIT. A dash-attack on a venom bolt (pr) bursts it into a forward
     fan of CYAN "hatchling" serpents that scatter along the player's dash heading
     (never homing back to the boss). Each hatchling is a LIGHT reflected projectile
     (smashed=false → clean cyan, no violet smash blast), so it carves the serpent's
     own segments (_snakeReflectedHit) AND chews the swarm while keeping the
     mini-serpent skin. The split itself is the payoff. The caller destroys the
     original bolt afterwards. */
  M._snakeParrySplit = function (pr) {
    var p = this.p;
    var ax = p.atkDx, ay = p.atkDy, al = Math.sqrt(ax * ax + ay * ay);
    if (al < 0.01) { ax = Math.cos(p.angle); ay = Math.sin(p.angle); al = 1; }
    ax /= al; ay /= al;
    var baseAng = Math.atan2(ay, ax);

    var n   = C.SNAKE_PARRY_SPLIT;
    var spd = C.PROJ_SPEED * C.PROJ_REFLECT_MULT;
    var twActive = this._twActive;

    for (var k = 0; k < n; k++) {
      var t   = n > 1 ? (k / (n - 1) - 0.5) : 0;                 // -0.5 … 0.5
      var ang = baseAng + t * 2 * C.SNAKE_PARRY_SPREAD + (Math.random() - 0.5) * 0.22;
      var before = this.projectiles.length;
      this._spawnProjectile(pr.x, pr.y, ang, spd, null);
      if (this.projectiles.length === before) break;            // hit MAX_PROJECTILES cap
      var c = this.projectiles[this.projectiles.length - 1];
      c.snakeSpit   = true;
      c.snakeWig    = Math.random() * TAU;
      c.isReflected = true;
      c.smashed     = false;          // a light spray — the SPLIT itself is the payoff
      c.rotSpeed    = 24;
      c.life        = C.PROJ_LIFE;
      if (c.spr) c.spr.setVisible(false);   // keep the serpent skin (cyan via _renderSnakeVenom)
      if (twActive) this._twFreezeProjectile(c);
    }

    p.hasHitDuringDashAttack = true;
    if (this._tutEvent) this._tutEvent('parade');
    this._triggerHitstop(C.DEFLECT_HEAVY_HS);
    this.cameras.main.shake(80, 0.008);
    // "burst into hatchlings" pop at the parry point.
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 78, color: 0x66ffff, expandTime: 0.18 });
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 40, color: 0xffffff, expandTime: 0.12 });
    this._explode(pr.x, pr.y, [120, 255, 230], 16);
    this._explode(pr.x, pr.y, [255, 255, 255], 8);
  };

  /* ================================================================
     COUP DE QUEUE — a defensive tail-whip. Does NO damage; instead it
     flings the player (breaking their attack) AND any nearby enemies
     outward, so a long worm can shake off an attacker. Only worms at least
     SNAKE_WHIP_MIN_LEN long can do it, on a per-worm cooldown, and ONLY when
     the player is actually attacking close by (so it reads as self-defence,
     not random shoving).
     ================================================================ */
  M._snakeWhipCD = function () {
    return C.SNAKE_WHIP_CD * (0.8 + Math.random() * 0.5);
  };

  /* The player is provoking this worm: in an offensive state AND close to its
     body. (The head always chases you, so the cooldown is what keeps the whip
     from firing every time you're merely near it.) */
  M._snakeWhipProvoked = function (worm) {
    var p = this.p;
    if (p.state !== 'ATTACKING' && p.state !== 'DASH_ATTACKING' && p.state !== 'DASHING') return false;
    var R2 = C.SNAKE_WHIP_TRIGGER_DIST * C.SNAKE_WHIP_TRIGGER_DIST;
    var segs = worm.segs;
    for (var i = 0; i < segs.length; i++) {
      var dx = p.x - segs[i].x, dy = p.y - segs[i].y;
      if (dx * dx + dy * dy < R2) return true;
    }
    return false;
  };

  /* Per-worm whip state machine: idle (cooldown) → windup (telegraph) → strike
     (one-shot knockback) → recover. Called once per worm per gameplay frame. */
  M._snakeUpdateWhip = function (worm, sMs) {
    if (worm.whipT > 0) {
      worm.whipT += sMs;
      if (!worm.whipHit && worm.whipT >= C.SNAKE_WHIP_WINDUP) {
        worm.whipHit = true;
        this._snakeTailWhipStrike(worm);
      }
      if (worm.whipT >= C.SNAKE_WHIP_DUR) {
        worm.whipT = 0; worm.whipHit = false;
        worm.whipCD = this._snakeWhipCD();
      }
      return;
    }
    worm.whipCD -= sMs;
    if (worm.whipCD > 0) return;
    if (worm.segs.length < C.SNAKE_WHIP_MIN_LEN) return;
    if (!this._snakeWhipProvoked(worm)) return;

    // Begin a whip: lock the sweep direction (toward the player) so the
    // telegraph is honest, pick a sweep side, and flash the tail.
    var p = this.p, tail = worm.segs[worm.segs.length - 1];
    worm.whipT    = 0.0001;
    worm.whipHit  = false;
    worm.whipDir  = Math.atan2(p.y - tail.y, p.x - tail.x);
    worm.whipSign = Math.random() < 0.5 ? -1 : 1;
    this._explode(tail.x, tail.y, [255, 224, 100], 10);
    this._spawnWaveRing(tail.x, tail.y, { maxRadius: C.SNAKE_SEG_SIZE * 2.4, color: 0xffe066, expandTime: 0.16 });
  };

  /* The strike instant: shove the player (no damage, breaks their attack) and
     every enemy within SNAKE_WHIP_RADIUS of the body, each pushed away from the
     nearest body node. Frozen states never reach here (gated in _updateSnake). */
  M._snakeTailWhipStrike = function (worm) {
    var segs = worm.segs;
    if (!segs.length) return;
    var R2 = C.SNAKE_WHIP_RADIUS * C.SNAKE_WHIP_RADIUS;
    var tail = segs[segs.length - 1];

    // ── PLAYER: flung outward, attack cancelled, brief i-frames (no damage) ──
    var p = this.p;
    if (p.state !== 'DEAD' && !this._twActive) {
      var pSeg = null, pBest = Infinity, i, dx, dy, d2;
      for (i = 0; i < segs.length; i++) {
        dx = p.x - segs[i].x; dy = p.y - segs[i].y; d2 = dx * dx + dy * dy;
        if (d2 < pBest) { pBest = d2; pSeg = segs[i]; }
      }
      if (pSeg && pBest < R2) {
        var pdx = p.x - pSeg.x, pdy = p.y - pSeg.y, pd = Math.sqrt(pBest);
        if (pd < 0.1) { var ra = Math.random() * TAU; pdx = Math.cos(ra); pdy = Math.sin(ra); pd = 1; }
        p.vx = (pdx / pd) * C.SNAKE_WHIP_PLAYER_FORCE;
        p.vy = (pdy / pd) * C.SNAKE_WHIP_PLAYER_FORCE;
        // Short i-frames so the shove doesn't immediately end on the deadly head.
        if (!p.invincible) { p.invincible = true; p.invincTimer = 240; p.dashInvinc = true; }
        // Cancel the player's swing/dash — that's the whole defensive point.
        if (p.state === 'ATTACKING' || p.state === 'DASH_ATTACKING' || p.state === 'DASHING') {
          p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
          p.atkAvailable = true; p.atkCooldown = 0;
        }
      }
    }

    // ── ENEMIES: shoved outward + briefly stunned ──
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      var eSeg = null, eBest = Infinity, j, edx, edy, ed2;
      for (j = 0; j < segs.length; j++) {
        edx = en.x - segs[j].x; edy = en.y - segs[j].y; ed2 = edx * edx + edy * edy;
        if (ed2 < eBest) { eBest = ed2; eSeg = segs[j]; }
      }
      if (!eSeg || eBest >= R2) continue;
      var ex = en.x - eSeg.x, ey = en.y - eSeg.y, ed = Math.sqrt(eBest);
      if (ed < 0.1) { ex = Math.random() - 0.5; ey = Math.random() - 0.5; ed = 1; }
      en.vx += (ex / ed) * C.SNAKE_WHIP_ENEMY_FORCE;
      en.vy += (ey / ed) * C.SNAKE_WHIP_ENEMY_FORCE;
      en.stunTimer = Math.max(en.stunTimer || 0, 300);
    }

    // ── FX: a hard crack of light + shock rings off the lashing tail ──
    this._spawnWaveRing(tail.x, tail.y, { maxRadius: C.SNAKE_WHIP_RADIUS * 1.15, color: 0x9dffc0, expandTime: 0.26 });
    this._spawnWaveRing(tail.x, tail.y, { maxRadius: C.SNAKE_WHIP_RADIUS * 0.66, color: 0xffffff, expandTime: 0.18 });
    this._explode(tail.x, tail.y, [150, 255, 190], 24);
    this._explode(tail.x, tail.y, [255, 255, 255], 12);
    this.cameras.main.shake(120, 0.009);
    this._triggerHitstop(C.HITSTOP_DUR);
  };

  /* Draw the whip: a coiling telegraph during windup, then a bright crescent
     blade sweeping across the player-facing side during the strike + recover. */
  M._renderSnakeWhip = function (w, gfx, fx) {
    if (!w.segs.length) return;
    var tail = w.segs[w.segs.length - 1];
    var wu  = C.SNAKE_WHIP_WINDUP, dur = C.SNAKE_WHIP_DUR;
    var arc = C.SNAKE_WHIP_ARC, R = C.SNAKE_WHIP_RADIUS;
    var dir = w.whipDir, sign = w.whipSign;

    if (w.whipT < wu) {
      // WIND-UP — a yellow coil winds back on the far side, brightening.
      var tg = w.whipT / wu;
      var a0 = dir - sign * arc * 0.5;
      fx.lineStyle(3 + tg * 4, 0xffe066, 0.30 + tg * 0.55);
      fx.beginPath();
      fx.arc(tail.x, tail.y, R * (0.34 + tg * 0.30), a0 - sign * 0.25, a0 + sign * 0.55, sign < 0);
      fx.strokePath();
      fx.fillStyle(0xffffff, tg * 0.55);
      fx.fillCircle(tail.x, tail.y, 6 + tg * 7);
    } else {
      // STRIKE + RECOVER — the crescent sweeps the full arc, fading out.
      var ts = (w.whipT - wu) / (dur - wu); if (ts > 1) ts = 1;
      var fade = 1 - ts;
      var swStart = dir - sign * arc * 0.5;
      var swEnd   = swStart + sign * arc * Math.min(1, ts * 1.7);
      var lo = Math.min(swStart, swEnd), hi = Math.max(swStart, swEnd);
      for (var r = 0; r < 3; r++) {
        var rr = R * (0.58 + r * 0.20);
        fx.lineStyle(6 - r * 1.6, r === 0 ? 0xffffff : 0x9dffc0, fade * (0.6 - r * 0.13));
        fx.beginPath();
        fx.arc(tail.x, tail.y, rr, lo, hi);
        fx.strokePath();
      }
      // Bright spark riding the leading edge of the blade.
      fx.fillStyle(0xffffff, fade * 0.85);
      fx.fillCircle(tail.x + Math.cos(swEnd) * R * 0.78, tail.y + Math.sin(swEnd) * R * 0.78, 5 + fade * 3);
    }
  };

  /* ================================================================
     DAMAGE — segments take hits from every source
     ================================================================ */

  /* Locate which worm holds a segment object (and its index). */
  M._snakeFindSeg = function (seg) {
    var s = this._snake;
    if (!s) return null;
    for (var i = 0; i < s.worms.length; i++) {
      var idx = s.worms[i].segs.indexOf(seg);
      if (idx !== -1) return { worm: s.worms[i], idx: idx };
    }
    return null;
  };

  /* Apply `amount` damage to a specific body segment. Breaking it may split the
     worm. Public entry used by melee, dash, reflected projectiles and AoE. */
  M._damageSnakeSegment = function (seg, amount, opts) {
    var s = this._snake;
    if (!s || s.dead || !seg || seg._dead) return;
    var loc = this._snakeFindSeg(seg);
    if (!loc) return;
    var explosion = opts && opts.explosion;

    seg.hp -= amount;
    seg.hitFlash = 1;
    // A persistent crack per point of damage so the wound stays visible.
    var cracksWanted = seg.maxHp - Math.max(0, seg.hp);
    while (seg.cracks.length < cracksWanted && seg.cracks.length < 4) {
      seg.cracks.push({ a: Math.random() * TAU, len: 0.55 + Math.random() * 0.4 });
    }

    this._explode(seg.x, seg.y, [180, 255, 200], explosion ? 4 : 8);
    if (!explosion) {
      this._explode(seg.x, seg.y, [255, 255, 255], 4);
      this._triggerHitstop(C.HITSTOP_DUR);
      this.cameras.main.shake(40, 0.004);
    }

    if (seg.hp <= 0) {
      seg._dead = true;
      this._breakSnakeSegment(loc.worm, loc.idx);
    }
  };

  /* Break the segment at `idx`. Tail → just shorten; otherwise SPLIT the worm. */
  M._breakSnakeSegment = function (worm, idx) {
    var s = this._snake;
    var segs = worm.segs;
    var broken = segs[idx];
    this._snakeSegBreakFx(broken);

    var back = segs.slice(idx + 1);   // chunk behind the cut
    worm.segs = segs.slice(0, idx);   // front keeps the original head

    if (back.length > 0) {
      // First node of the back chunk grows a NEW invulnerable head. Only form a
      // surviving worm if a body still trails it — a lone severed node simply
      // dies with the cut (the break burst already covers it), avoiding a
      // redundant split-then-poof double burst.
      var nh = back.shift();
      if (back.length > 0) {
        var nw = {
          hx: nh.x, hy: nh.y, hvx: 0, hvy: 0,
          hAngle: worm.hAngle + (Math.random() - 0.5) * 1.4,
          segs: back, segMaxHp: 0, speed: 0,
          slitherPhase: Math.random() * TAU,
          orbitSign: Math.random() < 0.5 ? -1 : 1,
          wanderAng: (Math.random() - 0.5) * 1.2,
          spitCD: 500 + Math.random() * 1100,
          whipCD: C.SNAKE_WHIP_CD * (0.6 + Math.random() * 0.6), whipT: 0,
          whipHit: false, whipDir: 0, whipSign: 1,
          headClink: 0, splitFlash: 1, introReveal: 999,
        };
        this._snakeInitWormStats(nw, false);
        s.worms.push(nw);

        // Split flash on the original too + a cinematic "tear" at the cut.
        worm.splitFlash = 1;
        this._snakeSplitBurst(nh.x, nh.y, nw.hAngle);
      }
    }

    this._snakeInitWormStats(worm, false);
    this._snakePruneWorms();
  };

  /* Drop any worm reduced to a lone head; end the boss when none remain. */
  M._snakePruneWorms = function () {
    var s = this._snake;
    if (!s) return;
    for (var i = s.worms.length - 1; i >= 0; i--) {
      if (s.worms[i].segs.length === 0) {
        this._snakeHeadPoof(s.worms[i]);
        s.worms.splice(i, 1);
      }
    }
    if (s.worms.length === 0) this._killSnake();
  };

  /* Throttled area damage — the single funnel every EXPLOSION routes through,
     so the constant storm of nukes / delayed blasts / parry smashes only chips
     a few segments (small fixed damage, per-segment i-frames, per-blast cap). */
  M._damageSnakeAoe = function (x, y, radius, amount) {
    var s = this._snake;
    if (!s || s.dead || s.spawnPhase === 'EMERGE') return;   // intangible while rising
    var r2 = radius * radius;
    var hits = [];
    for (var i = 0; i < s.worms.length; i++) {
      var segs = s.worms[i].segs;
      for (var j = 0; j < segs.length; j++) {
        var sg = segs[j];
        if (sg._dead || sg.aoeIframe > 0) continue;
        var dx = sg.x - x, dy = sg.y - y;
        var d2 = dx * dx + dy * dy;
        if (d2 < r2) hits.push({ seg: sg, d2: d2 });
      }
    }
    if (!hits.length) return;
    hits.sort(function (a, b) { return a.d2 - b.d2; });
    // I-frame EVERY segment caught in the blast (not just the few we damage) so
    // other explosions in the SAME storm-frame can't re-chip them — that is the
    // whole point of throttling: a barrage only nibbles SNAKE_AOE_MAX_SEG/blast.
    for (var k = 0; k < hits.length; k++) hits[k].seg.aoeIframe = C.SNAKE_AOE_IFRAME;
    var cap = Math.min(hits.length, C.SNAKE_AOE_MAX_SEG);
    for (var h = 0; h < cap; h++) {
      this._damageSnakeSegment(hits[h].seg, amount, { explosion: true });
      if (!this._snake || this._snake.dead) break;
    }
  };

  /* Reflected projectile vs the serpent — called from the projectile loop.
     Returns true if it struck a segment (so the projectile is consumed). The
     head is intangible to projectiles (they pass through). */
  M._snakeReflectedHit = function (pr) {
    var s = this._snake;
    if (!s || s.dead || s.spawnPhase === 'EMERGE') return false;   // intangible while rising
    var prR = pr.glitch ? C.ANO_PROJ_RADIUS : C.PROJ_RADIUS;
    var thr = prR + C.SNAKE_SEG_SIZE;
    var thr2 = thr * thr;
    var best = null, bestD2 = Infinity;
    for (var i = 0; i < s.worms.length; i++) {
      var segs = s.worms[i].segs;
      for (var j = 0; j < segs.length; j++) {
        var sg = segs[j];
        if (sg._dead) continue;
        var dx = pr.x - sg.x, dy = pr.y - sg.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < thr2 && d2 < bestD2) { bestD2 = d2; best = sg; }
      }
    }
    if (!best) return false;

    var dmg = pr.smashed ? C.SNAKE_DASH_DMG : C.SNAKE_PROJ_DMG;
    this._explode(pr.x, pr.y, [170, 220, 255], 12);
    this._damageSnakeSegment(best, dmg, {});
    // A smashed (charged) reflected bolt also splashes the throttled AoE — shield
    // the directly-hit segment from its own splash (a plain bolt has no splash,
    // so it must NOT hand out explosion i-frames).
    if (pr.smashed && this._snake && !this._snake.dead) {
      best.aoeIframe = C.SNAKE_AOE_IFRAME;
      this._damageSnakeAoe(pr.x, pr.y, C.SHOCKWAVE_RADIUS * 1.1, C.SNAKE_AOE_DMG);
    }
    return true;
  };

  /* ================================================================
     PLAYER MELEE vs SERPENT (head invulnerable, body carvable)
     ================================================================ */
  M._checkSnakeCollision = function () {
    var s = this._snake;
    if (!s || s.dead || s.spawnPhase === 'EMERGE') return;
    var p = this.p;
    var pR = C.SIZE * 0.6;
    var isAtk  = p.state === 'ATTACKING';
    var isDAtk = p.state === 'DASH_ATTACKING';
    var i, j, w, sg, dx, dy, d2;

    // 1) HEAD CONTACT → hurt the player (the head is the only dangerous part).
    var vuln = !isAtk && !isDAtk && p.state !== 'DASHING';
    if (vuln && !p.invincible && !this._twActive) {
      for (i = 0; i < s.worms.length; i++) {
        w = s.worms[i];
        var hitR = C.SNAKE_HEAD_HIT_R;
        dx = p.x - w.hx; dy = p.y - w.hy;
        var thr = pR + hitR;
        if (dx * dx + dy * dy < thr * thr) {
          var dd = Math.sqrt(dx * dx + dy * dy) || 1;
          this._damagePlayer(dx / dd, dy / dd);
          return;
        }
      }
    }

    if (!isAtk && !isDAtk) return;

    // 2) PLAYER ATTACK vs BODY SEGMENTS.
    var atkR = pR + C.SNAKE_SEG_SIZE + 4;
    var atkR2 = atkR * atkR;
    if (isDAtk) {
      // A dash-attack carves EVERY fresh segment it sweeps, each once per dash.
      var carved = false;
      for (i = 0; i < s.worms.length; i++) {
        w = s.worms[i];
        for (j = 0; j < w.segs.length; j++) {
          sg = w.segs[j];
          if (sg._dead || sg.lastDAtkId === this._currentDashAtkId) continue;
          dx = p.x - sg.x; dy = p.y - sg.y;
          if (dx * dx + dy * dy < atkR2) {
            sg.lastDAtkId = this._currentDashAtkId;
            p.hasHitDuringDashAttack = true;
            carved = true;
            this._damageSnakeSegment(sg, C.SNAKE_DASH_DMG, {});
            if (!this._snake || this._snake.dead) return;
            // worms array may have been reshaped by a split — restart safely.
            i = -1; break;
          }
        }
      }
      if (carved) return;
    } else {
      // Basic attack: hit the single closest segment, then consume the swing.
      var best = null, bestD2 = Infinity, bestWorm = null;
      for (i = 0; i < s.worms.length; i++) {
        w = s.worms[i];
        for (j = 0; j < w.segs.length; j++) {
          sg = w.segs[j];
          if (sg._dead) continue;
          dx = p.x - sg.x; dy = p.y - sg.y; d2 = dx * dx + dy * dy;
          if (d2 < atkR2 && d2 < bestD2) { bestD2 = d2; best = sg; bestWorm = w; }
        }
      }
      if (best) {
        this._damageSnakeSegment(best, C.SNAKE_MELEE_DMG, {});
        p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
        p.atkAvailable = true; p.atkCooldown = 0;
        p.vx *= 0.3; p.vy *= 0.3;
        if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
        return;
      }
    }

    // 3) HEAD CLINK — attacking the invulnerable head just bounces you off.
    //    BOTH a basic attack and a DASH-ATTACK rebound now (dash bounces harder,
    //    flips the venom, and gets extra ricochet juice so the armoured head
    //    reads clearly as "can't break this, you're knocked back").
    for (i = 0; i < s.worms.length; i++) {
      w = s.worms[i];
      dx = p.x - w.hx; dy = p.y - w.hy;
      var hthr = pR + C.SNAKE_HEAD_SIZE;
      if (dx * dx + dy * dy < hthr * hthr) {
        var hd = Math.sqrt(dx * dx + dy * dy) || 1;
        var hnx = dx / hd, hny = dy / hd;
        w.headClink = 1;
        this._explode(w.hx, w.hy, [150, 230, 255], 8);
        this._triggerHitstop(C.HITSTOP_DUR);
        if (isAtk || isDAtk) {
          var rimp = isDAtk ? C.REBOUND_IMP * 1.5 : C.REBOUND_IMP;
          p.vx = hnx * rimp; p.vy = hny * rimp;
          p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
          p.atkAvailable = true; p.atkCooldown = 0;
          if (isDAtk) {
            this._explode(w.hx, w.hy, [200, 240, 255], 16);
            this._explode(w.hx, w.hy, [255, 255, 255], 8);
            this._spawnWaveRing(w.hx, w.hy, { maxRadius: C.SNAKE_HEAD_SIZE * 2.6, color: 0x9fefff, expandTime: 0.22 });
            this.cameras.main.shake(80, 0.008);
          }
        }
        if (!p.invincible) { p.invincible = true; p.invincTimer = 140; p.dashInvinc = true; }
        return;
      }
    }
  };

  /* ================================================================
     FX bursts for a broken segment / a vanishing head
     ================================================================ */
  M._snakeSegBreakFx = function (seg) {
    this._explode(seg.x, seg.y, [120, 255, 150], 22);
    this._explode(seg.x, seg.y, [255, 255, 255], 10);
    this._spawnWaveRing(seg.x, seg.y, { maxRadius: C.SNAKE_SEG_SIZE * 3.2, color: 0x33ff88, expandTime: 0.20 });
  };

  /* Cinematic SPLIT burst at a cut — a flash of light that "tears" the worm in
     two. Layered instant FX (rings + sparks) PLUS a short animated slash pushed
     to s.splitFx (rendered in _renderSnakeSplits). Kept fast + with only a tiny
     hitstop/shake so cascading splits never bog the rhythm down. */
  M._snakeSplitBurst = function (x, y, ang) {
    var s = this._snake;
    if (s) s.splitFx.push({ x: x, y: y, ang: ang, t: 0, life: C.SNAKE_SPLIT_FX_LIFE });
    // Instant burst: gold tear ring + green guts + a white hot core.
    this._spawnWaveRing(x, y, { maxRadius: C.SNAKE_SEG_SIZE * 4.4, color: 0xffe066, expandTime: 0.22 });
    this._spawnWaveRing(x, y, { maxRadius: C.SNAKE_SEG_SIZE * 2.4, color: 0xffffff, expandTime: 0.14 });
    this._explode(x, y, [255, 224, 120], 18);
    this._explode(x, y, [120, 255, 160], 12);
    this._explode(x, y, [255, 255, 255], 8);
    this.cameras.main.shake(55, 0.006);     // lighter than before — splits are frequent
    this._triggerHitstop(C.HITSTOP_DUR);
  };

  /* Animate every live split-slash: a bright bar across the cut that lengthens
     then the two halves slide apart along the worm axis, plus a perpendicular
     shock streak — all fading out over SNAKE_SPLIT_FX_LIFE. */
  M._renderSnakeSplits = function (fx, dt) {
    var s = this._snake;
    if (!s) return;
    for (var i = s.splitFx.length - 1; i >= 0; i--) {
      var f = s.splitFx[i];
      f.t += dt;
      var u = f.t / f.life;
      if (u >= 1) { s.splitFx.splice(i, 1); continue; }
      var fade = 1 - u;
      var ca = Math.cos(f.ang), sa = Math.sin(f.ang);     // along the body axis
      var px = -sa, py = ca;                               // perpendicular (the cut line)

      // White-hot core flashing out.
      fx.fillStyle(0xffffff, fade * 0.9);
      fx.fillCircle(f.x, f.y, (C.SNAKE_SEG_SIZE * 0.5) * (1 + u * 1.4));
      fx.fillStyle(0xffe066, fade * 0.5);
      fx.fillCircle(f.x, f.y, (C.SNAKE_SEG_SIZE * 0.8) * (1 + u * 1.8));

      // The cut bar: a bright line across the body that grows.
      var barLen = C.SNAKE_SEG_SIZE * (1.1 + u * 1.8);
      fx.lineStyle(5 * fade + 1, 0xffffff, fade);
      fx.lineBetween(f.x - px * barLen, f.y - py * barLen, f.x + px * barLen, f.y + py * barLen);

      // The two halves recoil apart along the axis (sliding light streaks).
      var sep = C.SNAKE_SEG_SIZE * (0.4 + u * 2.6);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var hx = f.x + ca * sep * sgn, hy = f.y + sa * sep * sgn;
        fx.fillStyle(sgn < 0 ? 0xbfffd9 : 0xffe9a0, fade * 0.75);
        fx.fillCircle(hx, hy, (C.SNAKE_SEG_SIZE * 0.7) * fade + 2);
        fx.lineStyle(3 * fade + 0.5, 0xffffff, fade * 0.8);
        fx.lineBetween(f.x, f.y, hx, hy);
      }
    }
  };

  M._snakeHeadPoof = function (worm) {
    var s = this._snake;
    if (s) { s._lastX = worm.hx; s._lastY = worm.hy; }
    this._explode(worm.hx, worm.hy, [120, 255, 150], 24);
    this._explode(worm.hx, worm.hy, [255, 255, 255], 12);
    this._spawnWaveRing(worm.hx, worm.hy, { maxRadius: C.SNAKE_HEAD_SIZE * 3.4, color: 0x33ff88, expandTime: 0.22 });
    this.cameras.main.shake(70, 0.006);
  };

  /* ================================================================
     DEATH — every worm gone; free upgrade like the other bosses
     ================================================================ */
  M._killSnake = function () {
    var s = this._snake;
    if (!s || s.dead) return;
    s.dead = true;
    var ex = s._lastX != null ? s._lastX : this.p.x;
    var ey = s._lastY != null ? s._lastY : this.p.y;

    this._explode(ex, ey, [120, 255, 150], 60);
    this._explode(ex, ey, [180, 255, 200], 44);
    this._explode(ex, ey, [40, 200, 100],  32);
    this._explode(ex, ey, [255, 255, 255], 28);
    this._spawnWaveRing(ex, ey, { maxRadius: 360, color: 0xffffff, expandTime: 0.34 });
    this._spawnWaveRing(ex, ey, { maxRadius: 260, color: 0x5dff9b, expandTime: 0.26 });
    this._spawnWaveRing(ex, ey, { maxRadius: 160, color: 0x33ff88, expandTime: 0.20 });
    this.cameras.main.flash(280, 120, 255, 160);
    this.cameras.main.shake(300, 0.020);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    // Sweep the serpent's live venom so a dead boss can't keep tagging the
    // player. Parried hatchlings are SPARED (they're yours) — but the serpent
    // renderer dies with the boss, so reveal their default shard sprite (tinted
    // cyan) and drop the snakeSpit tag so they finish out as normal reflects.
    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      if (!pr.snakeSpit) continue;
      if (pr.isReflected) {
        if (pr.spr) { pr.spr.setVisible(true); pr.spr.setTint(0x66ffff); }
        pr.snakeSpit = false;
        continue;
      }
      this._explode(pr.x, pr.y, [120, 255, 150], 6);
      this._destroyProjectile(pr);
      this.projectiles.splice(pi, 1);
    }

    this._clearSnake(true);

    // Unified aftermath: green board-clear shockwave + score + power-up + 3-pick draft.
    this._bossDefeatSequence(ex, ey, { label: 'SERPENT SLAIN', color: '#5dff9b', glow: '#33ff88', ringColor: 0x5dff9b, expCol: [120, 255, 150] });
  };

  /* ================================================================
     RENDER — bodies (damage-coloured + cracked) + armoured heads
     ================================================================ */
  M._renderSnake = function (dt) {
    var s = this._snake;
    if (!s) return;
    var gfx = s.gfx, fx = s.fxGfx, gt = this.gameTime;
    gfx.clear(); fx.clear();
    var emerging = s.spawnPhase === 'EMERGE';

    for (var wi = 0; wi < s.worms.length; wi++) {
      var w = s.worms[wi];
      var revealCount = emerging ? Math.floor(w.introReveal) : w.segs.length;

      // ── BODY (tail → head so nearer nodes overlap on top) ──
      for (var i = w.segs.length - 1; i >= 0; i--) {
        if (i >= revealCount) continue;
        var sg = w.segs[i];
        var frac = sg.maxHp > 0 ? Math.max(0, Math.min(1, sg.hp / sg.maxHp)) : 1;
        var dmg  = 1 - frac;
        var baseR = C.SNAKE_SEG_SIZE * (0.74 + 0.26 * frac);
        // gentle taper toward the tail
        baseR *= 0.78 + 0.22 * (1 - i / Math.max(1, w.segs.length));
        // spawn-pop overshoot: a freshly-revealed node briefly swells + flashes
        // white-hot, then settles (decayed here so it's frame-rate independent).
        var pop = sg._pop || 0;
        if (pop > 0) { pop = Math.max(0, pop - dt * 6); sg._pop = pop; }
        baseR *= 1 + pop * 0.55;
        var col = lerpC(BODY_OK, BODY_HURT, dmg);
        if (sg.hitFlash > 0) col = lerpC(col, 0xffffff, sg.hitFlash);
        if (pop > 0) col = lerpC(col, 0xffffff, pop * 0.8);

        // soft additive glow under the body
        fx.fillStyle(col, 0.14 + sg.hitFlash * 0.4 + pop * 0.5);
        fx.fillCircle(sg.x, sg.y, baseR * (1.5 + pop * 0.6));

        // solid body + dark rim
        gfx.fillStyle(col, 1.0);
        gfx.fillCircle(sg.x, sg.y, baseR);
        gfx.lineStyle(2, 0x0b3a22, 0.85);
        gfx.strokeCircle(sg.x, sg.y, baseR);
        // belly highlight (offset toward the inside of the curve)
        gfx.fillStyle(0xffffff, 0.10);
        gfx.fillCircle(sg.x - Math.cos(sg.angle) * baseR * 0.3,
                       sg.y - Math.sin(sg.angle) * baseR * 0.3, baseR * 0.34);

        // persistent damage cracks
        for (var ck = 0; ck < sg.cracks.length; ck++) {
          var cr = sg.cracks[ck];
          var cx = Math.cos(cr.a), cy = Math.sin(cr.a);
          gfx.lineStyle(1.6, 0x1a0000, 0.8);
          gfx.lineBetween(
            sg.x - cx * baseR * cr.len, sg.y - cy * baseR * cr.len,
            sg.x + cx * baseR * cr.len, sg.y + cy * baseR * cr.len
          );
        }
      }

      // ── HEAD ──
      if (!emerging || revealCount >= 0) {
        this._renderSnakeHead(w, gfx, fx, gt, emerging ? Math.min(1, s.introT / (C.SNAKE_ARRIVE_DUR * 0.3)) : 1);
      }

      // ── TAIL WHIP (coup de queue) crescent ──
      if (!emerging && w.whipT > 0) this._renderSnakeWhip(w, gfx, fx);
    }

    // Venom volleys ride as procedural writhing mini-serpents.
    this._renderSnakeVenom(gfx, fx);

    // Cinematic split-slashes flashing over recent cuts.
    this._renderSnakeSplits(fx, dt);
  };

  /* Faceless armoured head — no eyes / no snout. A plated invulnerable orb,
     distinguished from the body by its metallic plating + a rotating shimmer
     ring that telegraphs "you can't damage this part". */
  M._renderSnakeHead = function (w, gfx, fx, gt, scale) {
    var hr = C.SNAKE_HEAD_SIZE * scale;
    var headCol = w.headClink > 0 ? lerpC(HEAD_COL, 0xcdefff, w.headClink) : HEAD_COL;

    // outer glow
    fx.fillStyle(0x33ff88, 0.18 + w.headClink * 0.45);
    fx.fillCircle(w.hx, w.hy, hr * 1.6);

    // dark armour base + main plate + bright metallic rim
    gfx.fillStyle(0x06281a, 1.0);
    gfx.fillCircle(w.hx, w.hy, hr * 1.10);
    gfx.fillStyle(headCol, 1.0);
    gfx.fillCircle(w.hx, w.hy, hr);
    gfx.lineStyle(3, 0xbfffd9, 0.8);
    gfx.strokeCircle(w.hx, w.hy, hr);

    // concentric armour plating rings (reads "armoured", unlike the soft body)
    gfx.lineStyle(2, 0x0c3a22, 0.7);
    gfx.strokeCircle(w.hx, w.hy, hr * 0.72);
    gfx.lineStyle(1.5, 0xa8ffce, 0.4);
    gfx.strokeCircle(w.hx, w.hy, hr * 0.46);

    // bright pulsing core
    var corePulse = 0.6 + 0.4 * Math.sin(gt * 4 + w.slitherPhase);
    fx.fillStyle(0xeafff2, 0.5 + w.headClink * 0.5);
    fx.fillCircle(w.hx, w.hy, hr * (0.20 + 0.05 * corePulse));

    // invulnerability shimmer — faint rotating dashes ringing the head
    var shA = 0.22 + w.headClink * 0.6;
    for (var k = 0; k < 6; k++) {
      var arcA = gt * 1.4 + (TAU / 6) * k;
      fx.lineStyle(2, 0x9fefff, shA);
      fx.beginPath();
      fx.arc(w.hx, w.hy, hr * 1.28, arcA, arcA + 0.42);
      fx.strokePath();
    }
  };

  /* Render each venom bolt as a small writhing serpent: a head node with a
     flicking tongue + a tapering body that slithers on a sine wave perpendicular
     to travel. ENEMY bolts are GREEN; a PARRIED bolt's hatchlings are CYAN +
     a little bigger/brighter ("tamed", now yours) so the split reads instantly. */
  M._renderSnakeVenom = function (gfx, fx) {
    var gt = this.gameTime;
    var N = C.SNAKE_SPIT_NODES;
    var spacing = 6.5, baseR = 6.2, amp = 3.4;
    for (var i = 0; i < this.projectiles.length; i++) {
      var pr = this.projectiles[i];
      if (!pr.snakeSpit) continue;
      var tamed = pr.isReflected;
      var headCol = tamed ? 0xd9ffff : 0x9dffc0;
      var bodyA   = tamed ? 0x57e3ff : 0x2fe06e;
      var bodyB   = tamed ? 0x1f86c4 : 0x119a4c;
      var tongCol = tamed ? 0xeaffff : 0xff3a5e;
      var rimCol  = tamed ? 0x06303a : 0x0b3a22;
      var sizeMul = tamed ? 1.14 : 1.0;
      var vx = pr.vx, vy = pr.vy;
      var vl = Math.sqrt(vx * vx + vy * vy) || 1;
      var dx = vx / vl, dy = vy / vl;     // forward
      var px = -dy, py = dx;              // perpendicular (lateral wiggle axis)
      var phase = gt * 13 + (pr.snakeWig || 0);

      for (var k = N - 1; k >= 0; k--) {  // tail → head so the head sits on top
        var along = -spacing * k;
        var lateral = k === 0 ? 0 : Math.sin(phase - k * 0.9) * amp * (k / N + 0.4);
        var nx = pr.x + dx * along + px * lateral;
        var ny = pr.y + dy * along + py * lateral;
        var r  = baseR * (1 - k * 0.12) * sizeMul;
        var head = k === 0;
        var col = head ? headCol : lerpC(bodyA, bodyB, k / N);
        fx.fillStyle(col, (head ? 0.45 : 0.24) + (tamed ? 0.18 : 0));
        fx.fillCircle(nx, ny, r * 1.7);
        gfx.fillStyle(col, 1.0);
        gfx.fillCircle(nx, ny, r);
        gfx.lineStyle(1.2, rimCol, 0.85);
        gfx.strokeCircle(nx, ny, r);
        if (head) {
          // flicking forked tongue
          var fa = Math.atan2(dy, dx);
          var flick = Math.sin(phase * 1.6) * 0.45;
          var tl = r * 2.1;
          gfx.lineStyle(1.4, tongCol, 0.85);
          gfx.lineBetween(nx, ny, nx + Math.cos(fa + flick) * tl, ny + Math.sin(fa + flick) * tl);
          gfx.lineBetween(nx, ny, nx + Math.cos(fa - flick) * tl, ny + Math.sin(fa - flick) * tl);
        }
      }
    }
  };

})();
