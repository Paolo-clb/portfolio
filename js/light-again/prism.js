/* ==========================================================================
   Light Again — The Prism of Refraction (Prisme de Réfraction)

   A floating crystalline prism sitting NEUTRAL in the arena. It is TERRAIN / a
   weapon, not an enemy, and it works very differently from the Unstable Core:
   here the PLAYER becomes the projectile.

     1. SPAWN   — present from the START, ONE at a time, placed FULLY at random
                  anywhere on the map (NO guidance arrow). After use it vanishes
                  and reappears somewhere else, also at random.
     2. DORMANT — the crystal turns slowly, refracting a rainbow dispersion fan;
                  a spectral hazard ring marks its trigger zone. Enemies ignore it.
     3. CAPTURE — DASH-ATTACK through it (and ONLY a dash-attack) and the ship is
                  CAUGHT inside: it freezes at the crystal's heart, invulnerable.
     4. CHARGING— a magic cannon winds up: the crystal blazes, a long spectral
                  AIMING LINE tracks the mouse and a 3-way fan is previewed. You are
                  the loaded super-bullet. (Safety auto-fire after PRISM_CHARGE_MAXHOLD.)
     5. STRIKE  — LEFT-CLICK and the ship is hurled out as THREE chromatic ghost
                  arrows in a fan (real ship = centre, red-shifted + blue-shifted
                  phantoms = the flanks). A super dash-attack: faster + farther,
                  ONE-SHOTS every enemy the trio sweeps, and deals a boss 3 dash-
                  attacks. The fan opens then converges...
     6. MERGE   — ...the clones fuse back into the ship at the endpoint, the whole
                  rampage lands as ONE "PRISME" big-score popup, and play resumes.

   Self-contained on this._prism (plain data) + one shared persistent ADD graphics
   layer (created in scene.create, cleared per-frame), mirroring unstable-core.js.
   While the ship is captured (CHARGING) or in flight (STRIKE), scene.update hands
   the ship over to us (the `prismCtl` guard skips the normal accel/integration/wall
   clamp): _tickPrismCharging / _tickPrismStrike own p.x/p.y/p.angle outright. The
   ship is kept p.invincible + p.dashInvinc so it reads as the glowing cyan/gold
   phantom (no i-frame blink) instead of taking damage. The strike rides world time
   (sDt) normally but DEFIES The World at PRISM_TW_SCALE × speed — its kills are
   exempted from the Time-Stop deferral (combat.js `ctx.prism`, like `ctx.core`) so
   every swept enemy dies at once and banks into this._prismScoreAccum.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Spectral palette — a refraction prism splits white light into the rainbow.
     Deliberately multi-hued so the prism never reads as any single-colour system
     (orange core, magenta dash-atk, cyan player, gold The World, green tree…). */
  var SPECTRUM = [0xff2e4d, 0xff7a1e, 0xffe23a, 0x37e05a, 0x2fd9ff, 0x3a6bff, 0xb152ff];
  var SPECTRUM_RGB = [];
  for (var _si = 0; _si < SPECTRUM.length; _si++) {
    var _c = SPECTRUM[_si];
    SPECTRUM_RGB.push([(_c >> 16) & 255, (_c >> 8) & 255, _c & 255]);
  }
  var WHITE    = 0xffffff;
  var ICE      = 0xcde9ff;   // cool white-blue (charged light)
  var TW_GOLD  = 0xffc832;   // The World theme gold
  var TW_GOLD2 = 0xffe06e;
  var CHROMA_C = 0x9ffcff;   // centre arrow aura (the real ship)
  var CHROMA_R = 0xff3a5a;   // red-shifted phantom (chromatic aberration)
  var CHROMA_B = 0x3a86ff;   // blue-shifted phantom

  /* Trace a rotated ship-arrow path (same proportions as the player texture:
     tip +s, wings ±0.55s at -0.6s, inner notch -0.25s). Caller fills/strokes. */
  function arrowPath(g, x, y, s, ang) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    function px(lx, ly) { return x + lx * ca - ly * sa; }
    function py(lx, ly) { return y + lx * sa + ly * ca; }
    g.beginPath();
    g.moveTo(px(s, 0),            py(s, 0));
    g.lineTo(px(-0.6 * s, -0.55 * s), py(-0.6 * s, -0.55 * s));
    g.lineTo(px(-0.25 * s, 0),    py(-0.25 * s, 0));
    g.lineTo(px(-0.6 * s, 0.55 * s),  py(-0.6 * s, 0.55 * s));
    g.closePath();
  }

  /* Trace a regular n-gon path (caller strokes/fills). */
  function polyPath(g, x, y, r, n, rot) {
    g.beginPath();
    for (var i = 0; i < n; i++) {
      var a = rot + (i / n) * TAU;
      var qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
    }
    g.closePath();
  }

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initPrism = function () {
    this._prism           = null;
    this._prismSpawnT     = 0;
    this._prismNextDelay  = C.PRISM_FIRST_DELAY;   // appear ≈ from the start
    this._prismScoreAccum = 0;                      // running tally for the launched strike

    // One shared persistent ADD layer at depth 27 (above the core/enemies, below
    // the ship at 30 so the real centre arrow always sits on top of its phantoms).
    this._prismGfx = this.add.graphics();
    this._prismGfx.setDepth(27);
    this._prismGfx.setBlendMode(Phaser.BlendModes.ADD);
  };

  /* Drop the live prism (graphics persist — just cleared). Also un-captures the
     ship if it was mid-charge/strike when this fires (e.g. a scene shutdown). */
  M._clearPrism = function (silent) {
    var p = this.p;
    if (p && p.state === 'PRISM') {
      p.state = 'MOVING';
      p.invincible = false; p.invincTimer = 0; p.dashInvinc = false;
      p.atkAvailable = true; p.dashAvailable = true;
    }
    this._prism = null;
    if (this._prismGfx) this._prismGfx.clear();
  };

  M._rollPrismNextDelay = function () {
    this._prismSpawnT    = 0;
    this._prismNextDelay = C.PRISM_RESPAWN_MIN +
      Math.random() * (C.PRISM_RESPAWN_MAX - C.PRISM_RESPAWN_MIN);
  };

  /* ================================================================
     SPAWN GATE — never pop in during curated / confined states. NOT blocked by
     The World (an existing prism stays usable). The anomaly confines the player,
     so capture is blocked while it's around (mirrors the core's suspension).
     ================================================================ */
  M._prismSpawnSuspended = function () {
    return !!(this._tutorialActive || this._upSlowMoPhase || this._bossDraftPending ||
              this._upgradeDraftOpen || this._anomaly || this._anomalyBarrierActive ||
              this._anomalyIntroActive || !this.p || this.p.state === 'DEAD');
  };

  M._maybeSpawnPrism = function (dt) {
    if (this._prism) return;
    this._prismSpawnT += dt * 1000;
    if (this._prismSpawnT < this._prismNextDelay) return;
    this._rollPrismNextDelay();
    this._spawnPrism({});
  };

  /* Place a dormant prism UNIFORMLY at random across the whole disc (not anchored
     to the player — "vraiment aléatoirement dans toute la map"), only re-rolling to
     keep it off the player and clear of the other live map features. */
  M._spawnPrism = function (opts) {
    opts = opts || {};
    if (this._prism) return;
    if (!this.p || this.p.state === 'DEAD') return;

    var inset = C.PRISM_RADIUS + C.PRISM_SPAWN_MARGIN;
    var sep2  = C.MAP_FEATURE_MIN_SEP * C.MAP_FEATURE_MIN_SEP;
    var minP2 = C.PRISM_MIN_PLAYER_DIST * C.PRISM_MIN_PLAYER_DIST;
    var avoid = [this._fount, this._tree, this._cache, this._core, this._greed];   // optional refs (may be null) — same generic gap the core uses for greed
    var x, y, tries = 0, ok;

    if (opts.near) {
      // Debug spawn: drop it a short hop from the player so it's instantly testable.
      var na = Math.random() * TAU, nd = 320 + Math.random() * 260;
      var nc = LA.clampDisc(this.p.x + Math.cos(na) * nd, this.p.y + Math.sin(na) * nd, inset);
      x = nc.x; y = nc.y;
    } else {
      do {
        var pt = LA.randInDisc(inset);
        x = pt.x; y = pt.y;
        ok = true;
        var pdx = x - this.p.x, pdy = y - this.p.y;
        if (pdx * pdx + pdy * pdy < minP2) { ok = false; }
        if (ok) {
          for (var ai = 0; ai < avoid.length; ai++) {
            var av = avoid[ai];
            if (av && (x - av.x) * (x - av.x) + (y - av.y) * (y - av.y) < sep2) { ok = false; break; }
          }
        }
        // Never surface the prism on a live Data Highway band (reciprocal of the
        // highway's own avoidance — the two must never overlap).
        if (ok && !this._pointClearsHighways(x, y, C.PRISM_TRIGGER_R)) ok = false;
        tries++;
      } while (!ok && tries < 40);
    }

    this._prism = {
      x: x, y: y,
      phase: 'DORMANT',
      age: 0,
      spin: Math.random() * TAU,
      pulse: Math.random() * TAU,
      seed: Math.random() * 1000,
      dispAng: Math.random() * TAU,        // dispersion-fan base heading
      // charging
      chargeT: 0, hold: 0, aimAng: 0,
      // strike
      origX: 0, origY: 0, dist: 0, travelled: 0, t: 0, perpX: 0, perpY: 0,
      arrows: [], bossHit: [],
    };
    this._prismScoreAccum = 0;

    // Arrival flourish — a clean white flash splitting into a spectral ring.
    this._spawnWaveRing(x, y, { maxRadius: 150, color: SPECTRUM[4], expandTime: 0.42 });
    this._spawnWaveRing(x, y, { maxRadius: 88,  color: WHITE,       expandTime: 0.30 });
    this._explode(x, y, [225, 240, 255], 18);
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(x, y, SPECTRUM_RGB[k], 5);
  };

  /* ================================================================
     UPDATE — spawn gate, tick the live prism, render. Called from update() with
     dt = real seconds, sDt = WORLD seconds (frozen during The World / hitstop).
     ================================================================ */
  M._updatePrism = function (dt, sDt) {
    if (!this._prismSpawnSuspended()) this._maybeSpawnPrism(dt);

    var pr = this._prism;
    if (pr) {
      if      (pr.phase === 'DORMANT')  this._tickPrismDormant(pr, dt);
      else if (pr.phase === 'CHARGING') this._tickPrismCharging(pr, dt);
      else if (pr.phase === 'STRIKE')   this._tickPrismStrike(pr, dt, sDt);
    }
    this._renderPrism(dt);
  };

  /* DORMANT: breathe, refract, and watch for a dash-attack biting into the field. */
  M._tickPrismDormant = function (pr, dt) {
    var p = this.p;
    pr.spin    += dt * 0.6;
    pr.pulse   += dt;
    pr.dispAng += dt * 0.28;
    pr.age     += dt * 1000;

    // CAPTURE: a dash-attack (and ONLY a dash-attack) that reaches the crystal.
    if (p && p.state === 'DASH_ATTACKING') {
      var dx = pr.x - p.x, dy = pr.y - p.y;
      var reach = C.PRISM_TRIGGER_R + C.SIZE * 0.6 + C.PRISM_TRIGGER_PAD;
      if (dx * dx + dy * dy < reach * reach) { this._prismCapture(pr); }
    }
    // No wither: the prism is a persistent fixture — it only leaves when USED.
  };

  /* ================================================================
     CAPTURE → CHARGING — the ship is caught inside; the cannon winds up.
     ================================================================ */
  M._prismCapture = function (pr) {
    var p   = this.p;
    var cam = this.cameras.main;
    var aim = Math.atan2((this._mouseY + cam.scrollY) - pr.y, (this._mouseX + cam.scrollX) - pr.x);

    pr.phase   = 'CHARGING';
    pr.chargeT = 0;
    pr.hold    = 0;
    pr.aimAng  = aim;

    // Snap the ship to the crystal's heart and freeze it there, invulnerable. The
    // dashInvinc flag makes _renderPlayer draw the glowing cyan phantom (no i-frame
    // blink) — exactly the "you are the loaded super-bullet" read.
    p.x = pr.x; p.y = pr.y; p.vx = 0; p.vy = 0;
    p.state = 'PRISM';
    p.hasHitDuringDashAttack = true;          // a successful dash-attack → no whiff punish
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;
    p.spinAngle = 0; p.angle = aim;

    // Capture juice — a hard white implosion fracturing into the spectrum.
    this._explode(pr.x, pr.y, [225, 245, 255], 30);
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(pr.x, pr.y, SPECTRUM_RGB[k], 8);
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 175, color: WHITE,       expandTime: 0.32 });
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 110, color: SPECTRUM[5], expandTime: 0.26 });
    this.cameras.main.flash(150, 215, 238, 255);
    this.cameras.main.shake(150, 0.012);
    this._triggerHitstop(80);
    this._floatLabel(pr.x, pr.y - C.PRISM_TRIGGER_R - 10, 'PRISME CHARGÉ', '#bfe9ff');
  };

  /* CHARGING: hold the ship, blaze the crystal, track the mouse. Real dt (the
     charge animation must keep flowing even while the world ticks around it). */
  M._tickPrismCharging = function (pr, dt) {
    var p   = this.p;
    var cam = this.cameras.main;

    // Pin the ship at the crystal heart, keep it invulnerable + glowing.
    p.x = pr.x; p.y = pr.y; p.vx = 0; p.vy = 0;
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;

    pr.spin    += dt * 2.6;     // spins UP while charging
    pr.pulse   += dt;
    pr.dispAng += dt * 0.6;
    pr.chargeT += dt * 1000;
    pr.hold    += dt * 1000;

    // Live aim toward the mouse (the big aiming line tracks the cursor).
    var aim = Math.atan2((this._mouseY + cam.scrollY) - pr.y, (this._mouseX + cam.scrollX) - pr.x);
    pr.aimAng = aim;
    p.angle   = aim;

    // Safety: never an indefinite invulnerable hold inside the prism.
    if (pr.hold >= C.PRISM_CHARGE_MAXHOLD) this._prismLaunch();
  };

  /* ================================================================
     LAUNCH — fired by a left-click (player.js intercept) or the safety auto-fire.
     ================================================================ */
  M._prismLaunch = function () {
    var pr = this._prism;
    if (!pr || pr.phase !== 'CHARGING') return;
    var p   = this.p;
    var cam = this.cameras.main;
    var aim = Math.atan2((this._mouseY + cam.scrollY) - pr.y, (this._mouseX + cam.scrollX) - pr.x);
    var ax  = Math.cos(aim), ay = Math.sin(aim);

    // Travel the FULL budget ("plus loin"); it stays in-bounds by BOUNCING off the
    // map disc + the Anomaly firewall (like a dash-attack / torpedo), not by capping.
    pr.phase     = 'STRIKE';
    pr.origX     = pr.x; pr.origY = pr.y;
    pr.cx        = pr.x; pr.cy   = pr.y;     // live centre of the fan (bounces)
    pr.dirX      = ax;   pr.dirY = ay;       // live heading (reflects at boundaries)
    pr.aimAng    = aim;  pr.dist = C.PRISM_STRIKE_DIST;
    pr.travelled = 0;    pr.t    = 0;
    pr.bossHit   = [];   pr.snakeHit = [];
    // Three arrows, coincident at the origin: centre (real ship) + two chromatic
    // phantoms that bloom out to ±FAN_LATERAL and converge again at the endpoint.
    pr.arrows = [
      { side:  0, x: pr.x, y: pr.y, px: pr.x, py: pr.y, ang: aim, col: CHROMA_C, trail: [] },
      { side:  1, x: pr.x, y: pr.y, px: pr.x, py: pr.y, ang: aim, col: CHROMA_R, trail: [] },
      { side: -1, x: pr.x, y: pr.y, px: pr.x, py: pr.y, ang: aim, col: CHROMA_B, trail: [] },
    ];
    this._prismScoreAccum = 0;

    // The crystal bursts and the ship becomes the bolt — big launch juice.
    this._explode(pr.x, pr.y, [255, 255, 255], 46);
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(pr.x, pr.y, SPECTRUM_RGB[k], 14);
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 240, color: WHITE,       expandTime: 0.36 });
    this._spawnWaveRing(pr.x, pr.y, { maxRadius: 150, color: SPECTRUM[4], expandTime: 0.30 });
    this.cameras.main.flash(180, 238, 248, 255);
    this.cameras.main.shake(220, 0.018);
    this._triggerHitstop(90);

    // The ship rides the centre arrow — stays PRISM (prismCtl) + invulnerable glow.
    p.state = 'PRISM';
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;
    p.angle = aim;
  };

  /* Greatest distance from (x,y) heading (ax,ay) that stays within the disc (minus
     the ship's wall margin). Solves |(x,y) + t(ax,ay)| = lim for the positive root. */
  M._prismMaxDist = function (x, y, ax, ay) {
    var lim = C.WORLD_HALF - C.SIZE * 1.5;
    var b   = x * ax + y * ay;
    var cc  = x * x + y * y - lim * lim;
    var disc = b * b - cc;
    if (disc <= 0) return 0;
    return Math.max(0, -b + Math.sqrt(disc));
  };

  /* ================================================================
     STRIKE — drive the 3-arrow fan, one-shot everything it sweeps, hit bosses.
     Spin/trail on real dt; the advance rides world time (sDt) but DEFIES The World
     at PRISM_TW_SCALE × speed (its kills resolve at once — combat.js ctx.prism).
     ================================================================ */
  M._tickPrismStrike = function (pr, dt, sDt) {
    var p = this.p;
    // Keep the ship glowing + invulnerable as it flies.
    p.invincible = true; p.invincTimer = 999999; p.dashInvinc = true;
    pr.pulse += dt;

    var stepDt = this._twActive ? (dt * C.PRISM_TW_SCALE) : sDt;
    var step60 = stepDt * 60;
    var moving = step60 > 0.0001;                 // genuinely paused (hitstop/draft)?
    if (moving) {
      this._prismAdvance(pr, C.PRISM_STRIKE_SPEED * step60);   // move the centre, bouncing off boundaries
      pr.travelled += C.PRISM_STRIKE_SPEED * step60;
    }

    var t = pr.dist > 0 ? Math.min(1, pr.travelled / pr.dist) : 1;
    pr.t = t;

    var lateral = Math.sin(t * Math.PI) * C.PRISM_FAN_LATERAL;   // 0 → peak → 0 (open then merge)
    var perpX = -pr.dirY, perpY = pr.dirX;                       // perpendicular to the LIVE heading

    for (var i = 0; i < pr.arrows.length; i++) {
      var a = pr.arrows[i];
      a.px = a.x; a.py = a.y;
      var off = a.side * lateral;
      a.x = pr.cx + perpX * off;
      a.y = pr.cy + perpY * off;
      var mvx = a.x - a.px, mvy = a.y - a.py;
      a.ang = (mvx * mvx + mvy * mvy > 1) ? Math.atan2(mvy, mvx) : Math.atan2(pr.dirY, pr.dirX);
      // Blazing chromatic streak (fades on real dt so it stays smooth through slow-mo).
      a.trail.push({ x: a.x, y: a.y, a: 1 });
      if (a.trail.length > 16) a.trail.shift();
      for (var k = 0; k < a.trail.length; k++) a.trail[k].a -= dt * 3.0;
    }

    // The real ship is the centre arrow.
    var c0 = pr.arrows[0];
    p.x = c0.x; p.y = c0.y; p.angle = c0.ang;
    p.vx = pr.dirX * C.PRISM_STRIKE_SPEED; p.vy = pr.dirY * C.PRISM_STRIKE_SPEED;   // cosmetic (movement is positional)

    // One-shot sweep + boss hits (only when actually advancing).
    if (moving) this._prismStrikeContact(pr);

    // Spectral embers off the centre.
    if (Math.random() < 0.7) {
      this._explode(pr.cx - pr.dirX * 6, pr.cy - pr.dirY * 6, SPECTRUM_RGB[(Math.floor(pr.pulse * 22)) % SPECTRUM_RGB.length], 3);
    }

    if (t >= 1) this._prismMerge(pr);
  };

  /* Advance the fan centre by `step` along the live heading, REFLECTING off the map
     disc and (when up) the Anomaly firewall — same boundaries the dash-attack /
     torpedo bounce off. Per-frame clamp-and-reflect (the step is small vs. the
     radii, so the snap is invisible), mirroring the player wall-bounce model. */
  M._prismAdvance = function (pr, step) {
    pr.cx += pr.dirX * step;
    pr.cy += pr.dirY * step;
    this._prismClampReflect(pr, 0, 0, C.WORLD_HALF - C.SIZE * 1.5);        // map disc
    var a = this._anomaly;
    if (a && this._anomalyBarrierActive && a.phase === 'BARRIER' && !a.dead) {
      this._prismClampReflect(pr, a.bx, a.by, a.R - C.SIZE * 1.4);          // Anomaly firewall
    }
  };

  /* Keep the centre inside the circle (cx,cy,lim); on contact, snap to the rim and
     mirror the heading about the boundary normal (with a little ricochet spark). */
  M._prismClampReflect = function (pr, cx, cy, lim) {
    var dx = pr.cx - cx, dy = pr.cy - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 <= lim * lim) return;
    var d = Math.sqrt(d2) || 1;
    var nx = dx / d, ny = dy / d;                 // outward normal
    pr.cx = cx + nx * lim; pr.cy = cy + ny * lim;
    var dot = pr.dirX * nx + pr.dirY * ny;
    if (dot > 0) {
      pr.dirX -= 2 * dot * nx; pr.dirY -= 2 * dot * ny;   // reflect heading
      this._prismBounceFx(pr.cx, pr.cy);
    }
  };

  M._prismBounceFx = function (x, y) {
    this._spawnWaveRing(x, y, { maxRadius: 90, color: WHITE, expandTime: 0.22 });
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(x, y, SPECTRUM_RGB[k], 3);
    this.cameras.main.shake(80, 0.008);
  };

  /* Kill every enemy within PRISM_KILL_R of ANY of the 3 arrows (step < radius, so
     no tunnelling), then deal bosses their 3-dash-attack hit. */
  M._prismStrikeContact = function (pr) {
    var enemies = this.enemies, kr = C.PRISM_KILL_R;
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e._spawnAnimT != null && e._spawnAnimT < 1) continue;   // still materialising → leave it
      if (e._snIntangible) continue;   // cloaked sniper — the strike passes through it
      var hit = false;
      for (var j = 0; j < pr.arrows.length; j++) {
        var a = pr.arrows[j];
        var rr = kr + e.size * 0.5;
        var dx = e.x - a.x, dy = e.y - a.y;
        if (dx * dx + dy * dy < rr * rr) { hit = true; break; }
      }
      if (hit) this._killEnemy(i, { prism: true });   // one-shots ALL tiers (ignores shields)
    }
    this._prismHitBosses(pr);
  };

  /* Bosses live OUTSIDE this.enemies — damage them through their own entry points. */
  M._prismHitBosses = function (pr) {
    this._prismCarveSnake(pr);   // serpent: carve like a single dash-attack (no one-shot)
    // Single-body bosses: a one-time hit when an arrow passes through them.
    this._prismMaybeHitBody('giga',    this._gigaBruiser, C.GBR_SIZE, pr);
    this._prismMaybeHitBody('mirror',  this._mirror,      C.MIR_SIZE, pr);
    this._prismMaybeHitBody('anomaly', this._anomaly,     C.ANO_SIZE, pr);
  };

  /* Serpent: carve every body segment the trio physically sweeps, but ONCE per
     strike (pr.snakeHit) and only by SNAKE_DASH_DMG each — exactly one dash-attack's
     worth, so a long strike chips the snake instead of one-shotting it. */
  M._prismCarveSnake = function (pr) {
    var s = this._snake;
    if (!s || s.dead || s.spawnPhase === 'EMERGE' || !this._damageSnakeSegment) return;
    var reach = C.PRISM_KILL_R + 20, r2 = reach * reach;
    var hits = [];
    for (var i = 0; i < s.worms.length; i++) {
      var segs = s.worms[i].segs;
      for (var j = 0; j < segs.length; j++) {
        var sg = segs[j];
        if (sg._dead || pr.snakeHit.indexOf(sg) >= 0) continue;
        for (var k = 0; k < pr.arrows.length; k++) {
          var a = pr.arrows[k];
          var dx = sg.x - a.x, dy = sg.y - a.y;
          if (dx * dx + dy * dy < r2) { hits.push(sg); break; }
        }
      }
    }
    // Apply after collecting (damage can split/mutate the worm arrays).
    for (var h = 0; h < hits.length; h++) {
      if (!this._snake || this._snake.dead) break;
      pr.snakeHit.push(hits[h]);
      this._damageSnakeSegment(hits[h], C.SNAKE_DASH_DMG, { explosion: true });
    }
  };

  M._prismMaybeHitBody = function (key, b, size, pr) {
    if (!b || b.dead) return;
    if (pr.bossHit.indexOf(key) >= 0) return;
    var reach = (size || 60) + C.PRISM_BOSS_REACH;
    var near = false;
    for (var j = 0; j < pr.arrows.length; j++) {
      var a = pr.arrows[j];
      var dx = b.x - a.x, dy = b.y - a.y;
      if (dx * dx + dy * dy < reach * reach) { near = true; break; }
    }
    if (!near) return;
    pr.bossHit.push(key);
    this._prismDealTriple(key, b);
  };

  /* Apply each boss's per-hit damage through its native damage model. */
  M._prismDealTriple = function (key, b) {
    if (key === 'giga') {
      // 1 dash would break the shield; the other 2 chip the body. Unshielded → full 3×.
      if (b.shielded) {
        this._breakGigaShield();
        if (this._gigaBruiser && !this._gigaBruiser.shielded) this._damageGigaBruiser(C.GBR_DASH_DMG * 2);
      } else {
        this._damageGigaBruiser(C.GBR_DASH_DMG * 3);
      }
    } else if (key === 'mirror') {
      // Exactly ONE strike — like a torpedo / dash-attack: removes a single shield
      // orb (or lands the finishing blow if it had none). No instakill-from-full.
      this._damageMirror(1);
    } else if (key === 'anomaly') {
      // Only vulnerable while its barrier is down (BARRIER phase). 3 dash = 6 HP.
      var a = this._anomaly;
      if (a && !a.dead && a.phase === 'BARRIER' && !a.shielded) {
        a.hp -= 6;
        a._hitFlash = 1.0;
        this._explode(a.x, a.y, [255, 60, 60], 18);
        this._explode(a.x, a.y, [255, 255, 255], 8);
        this.cameras.main.shake(70, 0.008);
        if (a.hp <= 0) this._killAnomaly();
      }
    }
  };

  /* ================================================================
     MERGE — the clones fuse back into the ship; the rampage banks as one popup.
     ================================================================ */
  M._prismMerge = function (pr) {
    var p  = this.p;
    var ex = p.x, ey = p.y;

    if (this._prismScoreAccum > 0) this._floatScoreBig('PRISME', this._prismScoreAccum);
    this._prismScoreAccum = 0;

    // Merge spectacle — a white re-fusion bursting back into the spectrum.
    this._spawnWaveRing(ex, ey, { maxRadius: 260, color: WHITE,       expandTime: 0.50 });
    this._spawnWaveRing(ex, ey, { maxRadius: 168, color: SPECTRUM[4], expandTime: 0.42 });
    for (var k = 0; k < SPECTRUM_RGB.length; k++) this._explode(ex, ey, SPECTRUM_RGB[k], 14);
    this._explode(ex, ey, [255, 255, 255], 40);
    this.cameras.main.flash(220, 238, 248, 255);
    this.cameras.main.shake(300, 0.02);
    this._triggerHitstop(C.DETONATION_HITSTOP);

    // Hand the ship back, gliding along its FINAL heading (post-bounces), with a
    // brief landing grace.
    p.state = 'MOVING';
    p.vx = (pr.dirX || Math.cos(pr.aimAng)) * 6; p.vy = (pr.dirY || Math.sin(pr.aimAng)) * 6;
    p.invincible = true; p.invincTimer = 420; p.dashInvinc = true; p.dashCoyote = false;
    p.atkAvailable = true; p.atkCooldown = 0;
    p.dashAvailable = true; p.dashCooldown = 0;
    p.hasHitDuringDashAttack = false; p.spinAngle = 0;

    // Clear any straggler that wandered onto the landing spot after the sweep.
    if (this._safeBubblePush) this._safeBubblePush(p, 280);

    // Consumed → reappear elsewhere at random after a short beat.
    this._prism = null;
    if (this._prismGfx) this._prismGfx.clear();
    this._rollPrismNextDelay();
  };

  /* ================================================================
     RENDER — one shared ADD layer; view-culled for the dormant/charging looks
     (the strike spans the map, so it always draws).
     ================================================================ */
  M._renderPrism = function (dt) {
    var g = this._prismGfx;
    if (!g) return;
    g.clear();
    var pr = this._prism;
    if (!pr) return;

    if (pr.phase === 'STRIKE') { this._renderPrismStrike(g, pr); return; }

    var view = this.cameras.main.worldView;
    var pad  = C.PRISM_TRIGGER_R + 140;
    if (pr.x < view.x - pad || pr.x > view.right + pad ||
        pr.y < view.y - pad || pr.y > view.bottom + pad) return;

    if (pr.phase === 'CHARGING') this._renderPrismCharging(g, pr);
    else                         this._renderPrismDormant(g, pr);
  };

  /* The dispersion fan: a single white ray entering the crystal and a rainbow
     splaying out the far side — the prism's signature "refraction". */
  M._drawPrismDispersion = function (g, x, y, r, baseAng, A) {
    // Incoming white beam (from behind the output side).
    var iax = Math.cos(baseAng + Math.PI), iay = Math.sin(baseAng + Math.PI);
    g.lineStyle(2.4, WHITE, 0.18 * A);
    g.beginPath();
    g.moveTo(x + iax * r * 2.6, y + iay * r * 2.6);
    g.lineTo(x + iax * r * 0.7, y + iay * r * 0.7);
    g.strokePath();
    // Outgoing rainbow, fanned ±26° across the spectrum.
    var spread = 0.92;     // total fan width (rad)
    var n = SPECTRUM.length;
    for (var i = 0; i < n; i++) {
      var fa  = baseAng - spread * 0.5 + (i / (n - 1)) * spread;
      var len = r * (2.0 + 0.5 * Math.sin(this.gameTime * 1.4 + i));
      g.lineStyle(2.2, SPECTRUM[i], 0.16 * A);
      g.beginPath();
      g.moveTo(x + Math.cos(baseAng) * r * 0.5, y + Math.sin(baseAng) * r * 0.5);
      g.lineTo(x + Math.cos(fa) * len, y + Math.sin(fa) * len);
      g.strokePath();
    }
  };

  /* The crystal: an upright hexagonal bipyramid (a faceted gem) whose girdle ring
     turns to read as a slow 3-D spin, facets washed in cycling spectral light.
     energy 0 (dormant) → 1 (fully charged) brightens + super-charges it. */
  M._drawPrismCrystal = function (g, x, y, r, spin, pulse, A, energy) {
    var glow = 0.6 + 0.4 * Math.sin(pulse * 3);
    // Halo.
    g.fillStyle(WHITE, (0.06 + 0.10 * energy) * A * glow); g.fillCircle(x, y, r * (1.7 + 0.5 * energy));
    g.fillStyle(SPECTRUM[4], 0.06 * A);                    g.fillCircle(x, y, r * 1.35);

    var topY = y - r * 1.3, botY = y + r * 1.3;
    // Girdle ring (squashed ellipse → fake perspective).
    var gp = [];
    for (var k = 0; k < 6; k++) {
      var a = spin + (k / 6) * TAU;
      gp.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.34, d: Math.sin(a) });
    }
    // Facets: upper apex → girdle edge, lower apex → girdle edge. Front (d>0) brighter.
    for (var i = 0; i < 6; i++) {
      var g0 = gp[i], g1 = gp[(i + 1) % 6];
      var depth = (g0.d + g1.d) * 0.5;                  // -1 back … +1 front
      var face  = 0.18 + 0.32 * (depth * 0.5 + 0.5);    // back dim, front bright
      var col   = SPECTRUM[(i + Math.floor(pulse * 1.5)) % SPECTRUM.length];
      // upper facet
      g.fillStyle(col, face * (0.5 + 0.5 * energy) * A);
      g.beginPath(); g.moveTo(x, topY); g.lineTo(g0.x, g0.y); g.lineTo(g1.x, g1.y); g.closePath(); g.fillPath();
      // lower facet
      g.fillStyle(col, face * 0.8 * (0.5 + 0.5 * energy) * A);
      g.beginPath(); g.moveTo(x, botY); g.lineTo(g0.x, g0.y); g.lineTo(g1.x, g1.y); g.closePath(); g.fillPath();
    }
    // Bright wireframe edges (apex spokes + girdle), front edges hotter.
    for (var e = 0; e < 6; e++) {
      var p0 = gp[e];
      var hot = 0.4 + 0.5 * (p0.d * 0.5 + 0.5);
      g.lineStyle(1.4, ICE, hot * A);
      g.beginPath(); g.moveTo(x, topY); g.lineTo(p0.x, p0.y); g.lineTo(x, botY); g.strokePath();
      var p1 = gp[(e + 1) % 6];
      g.lineStyle(1.2, WHITE, hot * 0.7 * A);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.strokePath();
    }
    // Apex points + a hot white heart.
    g.fillStyle(WHITE, 0.85 * A); g.fillCircle(x, topY, 2.2 + energy); g.fillCircle(x, botY, 2.2 + energy);
    var hr = r * 0.18 * (0.7 + 0.5 * glow) * (1 + energy);
    g.fillStyle(SPECTRUM[5], 0.5 * A); g.fillCircle(x, y, hr * 2.0);
    g.fillStyle(WHITE, (0.7 + 0.3 * energy) * A); g.fillCircle(x, y, hr);
  };

  /* Ground hazard decal — a faint pulse + rotating dashed spectral ring marking the
     dash-through trigger zone (mirrors the core's hazard pad, in the spectrum). */
  M._drawPrismDecal = function (g, x, y, R, spin, pulse, A) {
    g.fillStyle(SPECTRUM[4], 0.04 * A * (0.6 + 0.4 * Math.sin(pulse * 2.5)));
    g.fillCircle(x, y, R * 0.95);
    var dashN = 30;
    for (var d = 0; d < dashN; d++) {
      var a0 = spin + (d / dashN) * TAU;
      var a1 = a0 + (0.55 / dashN) * TAU;
      g.lineStyle(2, SPECTRUM[d % SPECTRUM.length], 0.22 * A);
      g.beginPath();
      g.moveTo(x + Math.cos(a0) * R, y + Math.sin(a0) * R);
      g.lineTo(x + Math.cos(a1) * R, y + Math.sin(a1) * R);
      g.strokePath();
    }
  };

  M._renderPrismDormant = function (g, pr) {
    var A = 1;
    this._drawPrismDecal(g, pr.x, pr.y, C.PRISM_TRIGGER_R * 1.05, -pr.spin * 0.7, pr.pulse, A);
    this._drawPrismDispersion(g, pr.x, pr.y, C.PRISM_RADIUS, pr.dispAng, A);
    this._drawPrismCrystal(g, pr.x, pr.y, C.PRISM_RADIUS, pr.spin, pr.pulse, A, 0);
  };

  M._renderPrismCharging = function (g, pr) {
    var x = pr.x, y = pr.y, gt = this.gameTime;
    var energy = Math.min(1, pr.chargeT / C.PRISM_CHARGE_RAMP);
    var ax = Math.cos(pr.aimAng), ay = Math.sin(pr.aimAng);
    var px = -ay, py = ax;                          // aim perpendicular

    // Decal + super-charged crystal.
    this._drawPrismDecal(g, x, y, C.PRISM_TRIGGER_R * 1.05, -pr.spin * 0.7, pr.pulse, 1);

    // ---- The big spectral AIMING LINE (the "loaded cannon") ----
    var beamLen = Math.min(this._prismMaxDist(x, y, ax, ay), C.PRISM_STRIKE_DIST);
    var ex = x + ax * beamLen, ey = y + ay * beamLen;
    // Layered glow → core.
    g.lineStyle(26, SPECTRUM[5], 0.05 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(14, SPECTRUM[4], 0.10 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(5,  ICE,        0.30 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(2,  WHITE,      0.65 * energy); g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.strokePath();
    // Scrolling spectral pips racing down the beam (telegraphs the launch direction).
    var pipN = Math.floor(beamLen / 60);
    for (var i = 0; i < pipN; i++) {
      var f = ((i / pipN) + (gt * 0.9 % 1)) % 1;
      var pxp = x + ax * beamLen * f, pyp = y + ay * beamLen * f;
      g.fillStyle(SPECTRUM[i % SPECTRUM.length], 0.5 * energy);
      g.fillCircle(pxp, pyp, 2.6 + 2.0 * (1 - f));
    }
    // Chevron arrowhead at the muzzle.
    var hd = 26 + 8 * Math.sin(gt * 10);
    g.lineStyle(3, WHITE, 0.8 * energy);
    g.beginPath();
    g.moveTo(ex - ax * hd + px * hd, ey - ay * hd + py * hd);
    g.lineTo(ex, ey);
    g.lineTo(ex - ax * hd - px * hd, ey - ay * hd - py * hd);
    g.strokePath();

    // ---- Fan preview: the two flanking guide lines the phantoms will take ----
    var previewLen = Math.min(beamLen, 360);
    for (var s = -1; s <= 1; s += 2) {
      g.lineStyle(1.5, s < 0 ? CHROMA_B : CHROMA_R, 0.30 * energy);
      g.beginPath();
      g.moveTo(x, y);
      // matches the strike's mid-fan offset for an honest preview
      g.lineTo(x + ax * previewLen + px * s * C.PRISM_FAN_LATERAL,
               y + ay * previewLen + py * s * C.PRISM_FAN_LATERAL);
      g.strokePath();
    }

    // ---- Energy gathering: spectral motes spiralling into the crystal ----
    for (var m = 0; m < 7; m++) {
      var ma = gt * 3 + m * (TAU / 7);
      var mr = C.PRISM_RADIUS * (2.6 - 2.0 * ((gt * 1.3 + m / 7) % 1));
      g.fillStyle(SPECTRUM[m % SPECTRUM.length], 0.6 * energy);
      g.fillCircle(x + Math.cos(ma) * mr, y + Math.sin(ma) * mr, 2.4);
    }

    this._drawPrismCrystal(g, x, y, C.PRISM_RADIUS * (1 + 0.12 * energy), pr.spin, pr.pulse, 1, energy);

    // A ring snapping to full as the cannon finishes charging.
    g.lineStyle(2.5, WHITE, 0.7 * energy);
    g.beginPath();
    g.arc(x, y, C.PRISM_RADIUS * 1.5, -Math.PI / 2, -Math.PI / 2 + energy * TAU, false);
    g.strokePath();
  };

  M._renderPrismStrike = function (g, pr) {
    var gt = this.gameTime;
    var tw = this._twActive;
    var as = C.SIZE * 1.5;     // phantom arrow size

    // (No straight origin→arrow wake: the strike can BOUNCE, so a straight ray would
    // cut across the map. The per-arrow chromatic trails trace the real path.)
    for (var i = 0; i < pr.arrows.length; i++) {
      var a = pr.arrows[i];

      // Blazing chromatic streak.
      for (var t = 0; t < a.trail.length; t++) {
        var tr = a.trail[t];
        if (tr.a <= 0) continue;
        var rr = (t / a.trail.length) * as * 0.9;
        g.fillStyle(a.col, tr.a * 0.22); g.fillCircle(tr.x, tr.y, rr);
        g.fillStyle(WHITE, tr.a * 0.10); g.fillCircle(tr.x, tr.y, rr * 0.5);
      }

      // The arrow itself — a glowing chromatic ship-glyph. The centre one sits
      // under the REAL ship sprite (depth 30) for a clean white-cyan core.
      g.fillStyle(a.col, 0.30); arrowPath(g, a.x, a.y, as * 1.25, a.ang); g.fillPath();
      g.fillStyle(a.col, 0.85); arrowPath(g, a.x, a.y, as, a.ang); g.fillPath();
      g.lineStyle(1.6, WHITE, 0.9); arrowPath(g, a.x, a.y, as, a.ang); g.strokePath();
    }

    // Hot white head flare on the centre arrow.
    var c0 = pr.arrows[0];
    var flare = 0.6 + 0.4 * Math.sin(gt * 30);
    g.fillStyle(WHITE, 0.4 * flare); g.fillCircle(c0.x, c0.y, as * 1.3);

    // The World: golden time-dilation ripples around the bolt (slow-mo dressing).
    if (tw) {
      for (var w = 0; w < 3; w++) {
        var wp = ((gt * 0.5) + w / 3) % 1;
        var wr = as * 1.2 + wp * as * 3.0;
        var wa = (1 - wp) * 0.4;
        g.lineStyle(2, TW_GOLD,  wa);       g.strokeCircle(c0.x, c0.y, wr);
        g.lineStyle(1, TW_GOLD2, wa * 0.7); g.strokeCircle(c0.x, c0.y, wr * 0.97);
      }
    }
  };

})();
