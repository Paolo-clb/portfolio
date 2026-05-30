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
      headClink: 0, splitFlash: 0, introReveal: 0,
    };
    this._snakeInitWormStats(worm, true);

    var gfx = this.add.graphics(); gfx.setDepth(25);
    var fxGfx = this.add.graphics(); fxGfx.setDepth(33);
    fxGfx.setBlendMode(Phaser.BlendModes.ADD);

    this._snake = {
      worms: [worm], dead: false,
      spawnPhase: 'EMERGE', introT: 0,
      gfx: gfx, fxGfx: fxGfx, _lastX: hx, _lastY: hy,
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

    // Per-segment pop as each one crosses into existence.
    var prev = Math.floor(w.introReveal);
    var now  = Math.floor(reveal);
    for (var k = prev; k < now && k < total; k++) {
      var sg = w.segs[k];
      this._explode(sg.x, sg.y, [120, 255, 150], 10);
      this._spawnWaveRing(sg.x, sg.y, { maxRadius: C.SNAKE_SEG_SIZE * 3, color: 0x33ff88, expandTime: 0.18 });
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

  /* A venom bolt rides the normal projectile system (so dash-attack can PARRY
     it back — a reflected venom bolt then chews other enemies / segments). */
  M._spawnSnakeSpit = function (ex, ey, angle) {
    var before = this.projectiles.length;
    this._spawnProjectile(ex, ey, angle, C.SNAKE_SPIT_SPEED, null);
    if (this.projectiles.length > before) {
      var pr = this.projectiles[this.projectiles.length - 1];
      pr.snakeSpit = true;
      pr.snakeWig  = Math.random() * TAU;   // per-bolt wiggle phase seed
      // Drawn as a procedural writhing mini-serpent by _renderSnakeVenom — hide
      // the default shard sprite (it reappears if the bolt is parried back).
      if (pr.spr) pr.spr.setVisible(false);
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
          headClink: 0, splitFlash: 1, introReveal: 999,
        };
        this._snakeInitWormStats(nw, false);
        s.worms.push(nw);

        // Split flash on the original too, + a divider burst at the cut.
        worm.splitFlash = 1;
        this._spawnWaveRing(nh.x, nh.y, { maxRadius: C.SNAKE_SEG_SIZE * 4, color: 0xffe066, expandTime: 0.22 });
        this._explode(nh.x, nh.y, [255, 220, 120], 16);
        this._explode(nh.x, nh.y, [120, 255, 150], 10);
        this.cameras.main.shake(90, 0.008);
        this._triggerHitstop(C.HITSTOP_DUR);
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

    // 3) HEAD CLINK — attacking into an invulnerable head just bounces.
    for (i = 0; i < s.worms.length; i++) {
      w = s.worms[i];
      dx = p.x - w.hx; dy = p.y - w.hy;
      var hthr = pR + C.SNAKE_HEAD_SIZE;
      if (dx * dx + dy * dy < hthr * hthr) {
        var hd = Math.sqrt(dx * dx + dy * dy) || 1;
        w.headClink = 1;
        this._explode(w.hx, w.hy, [150, 230, 255], 8);
        this._triggerHitstop(C.HITSTOP_DUR);
        if (isAtk) {
          p.vx = (dx / hd) * C.REBOUND_IMP; p.vy = (dy / hd) * C.REBOUND_IMP;
          p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
          p.atkAvailable = true; p.atkCooldown = 0;
        }
        if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
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

    this._bossKillBanner(ex, ey - C.SNAKE_HEAD_SIZE - 18, 'SERPENT SLAIN', '#5dff9b', '#33ff88');

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
    // player. Reflected bolts are spared — a parried venom bolt is now yours.
    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      if (!pr.snakeSpit || pr.isReflected) continue;
      this._explode(pr.x, pr.y, [120, 255, 150], 6);
      this._destroyProjectile(pr);
      this.projectiles.splice(pi, 1);
    }

    this._clearSnake(true);

    // Share the boss cooldown gate so bosses stay rare.
    this._anomalyCooldownT = C.ANO_COOLDOWN;

    // Free upgrade, independent of the kill-count threshold (same as the others).
    var self = this;
    this.time.delayedCall(420, function () {
      if (!self._upgradeLevels) return;
      if (self._upgradeDraftOpen || self._upSlowMoPhase) return;
      if (self._upgradePool && self._upgradePool.length > 0) self._beginUpgradeSlowMo();
    });
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
        var col = lerpC(BODY_OK, BODY_HURT, dmg);
        if (sg.hitFlash > 0) col = lerpC(col, 0xffffff, sg.hitFlash);

        // soft additive glow under the body
        fx.fillStyle(col, 0.14 + sg.hitFlash * 0.4);
        fx.fillCircle(sg.x, sg.y, baseR * 1.5);

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
    }

    // Venom volleys ride as procedural writhing mini-serpents.
    this._renderSnakeVenom(gfx, fx);
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

  /* Render each (un-parried) venom bolt as a small writhing serpent: a head
     node with a flicking tongue + a tapering body that slithers on a sine wave
     perpendicular to travel. Parried bolts revert to the normal reflected skin
     (their default sprite is re-shown at reflect time). */
  M._renderSnakeVenom = function (gfx, fx) {
    var gt = this.gameTime;
    var N = C.SNAKE_SPIT_NODES;
    var spacing = 6.5, baseR = 6.2, amp = 3.4;
    for (var i = 0; i < this.projectiles.length; i++) {
      var pr = this.projectiles[i];
      if (!pr.snakeSpit || pr.isReflected) continue;
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
        var r  = baseR * (1 - k * 0.12);
        var head = k === 0;
        var col = head ? 0x9dffc0 : lerpC(0x2fe06e, 0x119a4c, k / N);
        fx.fillStyle(col, head ? 0.45 : 0.24);
        fx.fillCircle(nx, ny, r * 1.7);
        gfx.fillStyle(col, 1.0);
        gfx.fillCircle(nx, ny, r);
        gfx.lineStyle(1.2, 0x0b3a22, 0.85);
        gfx.strokeCircle(nx, ny, r);
        if (head) {
          // flicking forked tongue
          var fa = Math.atan2(dy, dx);
          var flick = Math.sin(phase * 1.6) * 0.45;
          var tl = r * 2.1;
          gfx.lineStyle(1.4, 0xff3a5e, 0.85);
          gfx.lineBetween(nx, ny, nx + Math.cos(fa + flick) * tl, ny + Math.sin(fa + flick) * tl);
          gfx.lineBetween(nx, ny, nx + Math.cos(fa - flick) * tl, ny + Math.sin(fa - flick) * tl);
        }
      }
    }
  };

})();
