/* ==========================================================================
   Light Again — The Anomaly (rare "glitch" mini-boss / quarantine event)

   A data-moshed RGB-split entity that breaks the rules of the game:
     1. WANDER  — glitch-teleports around the arena, harmless, drifting toward
                  the player until it gets close.
     2. BARRIER — slams a circular "firewall" around the player, vacuums the
                  WHOLE board inside, halts natural spawns, and fires
                  telegraphed lasers while protected by an impenetrable shield.
                  The shield only drops once every trapped enemy is dead; then
                  it panics (blinking red, defenceless) and can be killed.
     3. DEATH   — shatters the barrier, resumes spawning, and drops a free
                  upgrade independently of the kill counter.

   Self-contained: the boss lives in `this._anomaly` (NOT in `this.enemies`),
   so the normal AI / separation / collision passes never touch it. Driven by
   scaled world-time so hitstop, slow-mo and The World all freeze it like any
   other enemy.
   ========================================================================== */
(function () {
  'use strict';

  var LA  = window.LightAgain;
  var C   = LA.C;
  var M   = LA.sceneMethods;
  var TAU = Math.PI * 2;

  /* Movement feel (smooth steering — no teleport; the "bug" is purely visual) */
  var MOVE_SPEED        = 2.7;   // px/frame target speed while approaching
  var MOVE_SPEED_INSIDE = 2.2;   // px/frame target speed inside the barrier
  var MOVE_EASE         = 0.085; // velocity lerp toward desired heading (per 60fps)
  var RETARGET_MIN      = 650;   // ms between waypoint re-picks
  var RETARGET_MAX      = 1500;

  /* ================================================================
     INIT / CLEANUP
     ================================================================ */
  M._initAnomaly = function () {
    this._anomaly             = null;
    this._anomalyBarrierActive = false;   // read by spawn-suppression + confinement
    this._anomalyIntroActive   = false;   // freezes player + world during the intro
    this._anomalyCooldownT    = 0;        // ms until a natural anomaly may appear
    this._anomalySpawnRollT   = 0;        // accumulates ms for the per-second roll
  };

  M._clearAnomaly = function (silent) {
    var a = this._anomaly;
    this._anomaly = null;
    this._anomalyBarrierActive = false;
    this._anomalyIntroActive   = false;
    if (!a) return;
    if (a.bannerR)    a.bannerR.destroy();
    if (a.bannerG)    a.bannerG.destroy();
    if (a.bannerB)    a.bannerB.destroy();
    if (a.bannerCore) a.bannerCore.destroy();
    if (a.rSpr)    a.rSpr.destroy();
    if (a.gSpr)    a.gSpr.destroy();
    if (a.bSpr)    a.bSpr.destroy();
    if (a.coreSpr) a.coreSpr.destroy();
    if (a.trail) { for (var ti = 0; ti < a.trail.length; ti++) a.trail[ti].destroy(); }
    if (a.barrierGfx) a.barrierGfx.destroy();
    if (a.shieldGfx)  a.shieldGfx.destroy();
    if (a.laserGfx)   a.laserGfx.destroy();
    if (a.pointerGfx) a.pointerGfx.destroy();
    if (a.hintTxt)    a.hintTxt.destroy();
  };

  /* ================================================================
     NATURAL SPAWN — rare, gated, works in BOTH modes (driven from update)
     ================================================================ */
  /* The canonical list of distinct boss types. Adding a new self-contained boss?
     Add its type key here (plus its usual spawn/update/clear wiring) and the team
     system scales automatically: team size caps at the number of types, and the
     "beaten every boss once" gate counts against this length. */
  M._BOSS_TYPES = ['anomaly', 'gigaBruiser', 'mirror', 'snake'];

  /* Boss "bag" — draw without replacement so the bosses cycle in a shuffled order
     (never the same one twice until the bag empties + refills). Used only in the
     SOLO phase (before every type has been beaten once). */
  M._drawBossFromBag = function () {
    if (!this._bossBag || this._bossBag.length === 0) {
      this._bossBag = M._BOSS_TYPES.slice();
    }
    var i = (Math.random() * this._bossBag.length) | 0;  // random remaining = shuffled draw
    return this._bossBag.splice(i, 1)[0];
  };

  /* Is ANY mini-boss currently alive (across every per-type list + the anomaly)? */
  M._anyBossAlive = function () {
    return !!(this._anomaly ||
              (this._gigaList   && this._gigaList.length) ||
              (this._mirrorList && this._mirrorList.length) ||
              (this._snakeList  && this._snakeList.length));
  };

  /* How many mini-bosses are LIVING right now (excludes ones already mid death-
     animation — they've left their lists). Feeds the HUD "BOSS x/N" team gauge. */
  M._countBossesAlive = function () {
    var n = 0;
    if (this._anomaly) n++;
    if (this._gigaList)   n += this._gigaList.length;
    if (this._mirrorList) n += this._mirrorList.length;
    if (this._snakeList)  n += this._snakeList.length;
    return n;
  };

  /* Has every distinct boss type fallen at least once this run? (Unlocks teams.) */
  M._allBossTypesDefeated = function () {
    var d = this._bossTypesDefeated || {};
    for (var i = 0; i < M._BOSS_TYPES.length; i++) {
      if (!d[M._BOSS_TYPES[i]]) return false;
    }
    return true;
  };

  /* Draw a team of `n` boss types WITH replacement (duplicates allowed — even all
     the same), EXCEPT the Anomaly which is capped at one per team (its barrier /
     quarantine doesn't stack). */
  M._drawBossTeam = function (n) {
    var team = [], anomalyUsed = false;
    var nonAno = [];
    for (var k = 0; k < M._BOSS_TYPES.length; k++) {
      if (M._BOSS_TYPES[k] !== 'anomaly') nonAno.push(M._BOSS_TYPES[k]);
    }
    for (var i = 0; i < n; i++) {
      var t = M._BOSS_TYPES[(Math.random() * M._BOSS_TYPES.length) | 0];
      if (t === 'anomaly' && (anomalyUsed || nonAno.length === 0)) {
        t = nonAno.length ? nonAno[(Math.random() * nonAno.length) | 0] : 'anomaly';
      }
      if (t === 'anomaly') anomalyUsed = true;
      team.push(t);
    }
    return team;
  };

  /* Spawn ONE boss of the given type at an optional placement (team members fan
     out around the player via opts.angle/opts.dist). */
  M._spawnBossOfType = function (type, opts) {
    if      (type === 'gigaBruiser') this._spawnGigaBruiser(opts);
    else if (type === 'mirror')      this._spawnMirror(opts);
    else if (type === 'snake')       this._spawnSnake(opts);
    else                             this._spawnAnomaly(opts);
  };

  M._maybeSpawnAnomaly = function (ms) {
    // Bosses are KILL-COUNT gated: an event fires once totalKills reaches the boss
    // threshold. No new event while ANY boss is alive, mid death-animation, during
    // the tutorial, a draft, or the post-boss board-clear. The HUD shows the count.
    if (this._tutorialActive) return;
    if (this._dimPortalActive) return;   // mid portal cinematic → it spawns the team itself
    if (this._anyBossAlive()) return;
    if (this._bossDeaths && this._bossDeaths.length) return;   // a boss is mid death-anim
    if (!this.p || this.p.state === 'DEAD') return;
    if (this._upgradeDraftOpen || this._upSlowMoPhase || this._bossDraftPending) return;
    if (this.totalKills < (this._bossKillThreshold || Infinity)) return;

    // SOLO phase — one boss from the shuffled bag — until every type has been
    // beaten once. Then escalate into TEAMS: 2, then 3, then 4 … capped at the
    // number of distinct boss types.
    if (!this._allBossTypesDefeated()) {
      this._spawnBossOfType(this._drawBossFromBag());
      return;
    }

    var NUM  = M._BOSS_TYPES.length;
    var size = Math.max(2, Math.min(this._bossTeamSize || 2, NUM));
    var team = this._drawBossTeam(size);

    // The FIRST team arrives through the PORTAL cinematic (board swept → vortex
    // engulfs → emerge in the altered dimension WITH the team). Subsequent teams
    // spawn directly into the already-fractured world.
    if (this._dimTransition && this._beginDimPortal) {
      this._dimPendingTeam     = team;
      this._dimPendingTeamSize = size;
      this._beginDimPortal();
      return;
    }

    this._spawnTeamNow(team);
    this._bossTeamSize = Math.min(size + 1, NUM);
  };

  /* Spawn a drawn team around the player (fanned out so entrances don't stack). */
  M._spawnTeamNow = function (team) {
    var base = Math.random() * TAU;
    for (var i = 0; i < team.length; i++) {
      var ang  = base + (i / team.length) * TAU + (Math.random() - 0.5) * 0.4;
      var dist = 720 + Math.random() * 220;
      this._spawnBossOfType(team[i], { angle: ang, dist: dist });
    }
  };

  /* Keep every team boss inside a live Anomaly firewall (spec: "un boss qui
     apparaît avec l'anomalie reste dans sa zone"). Mirrors the enemy clamp in
     enemies.js: clamp the body (or each serpent head) back to the barrier edge
     and bleed off any outward velocity so it doesn't keep ramming the wall. */
  M._confineBossesToAnomaly = function () {
    var a = this._anomaly;
    if (!a || !this._anomalyBarrierActive || a.phase === 'INTRO') return;
    var bx = a.bx, by = a.by, R = a.R;
    var clamp = function (obj, half) {
      var dx = obj.x - bx, dy = obj.y - by, lim = R - half;
      if (lim < 0) lim = 0;
      var d2 = dx * dx + dy * dy;
      if (d2 <= lim * lim) return;
      var d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d;
      obj.x = bx + nx * lim; obj.y = by + ny * lim;
      if (obj.vx != null) { var vd = obj.vx * nx + obj.vy * ny; if (vd > 0) { obj.vx -= vd * nx; obj.vy -= vd * ny; } }
    };
    var GL = this._gigaList;   if (GL) for (var i = 0; i < GL.length; i++) clamp(GL[i], C.GBR_SIZE * 1.2);
    var ML = this._mirrorList; if (ML) for (var j = 0; j < ML.length; j++) clamp(ML[j], C.MIR_SIZE * 1.2);
    var SL = this._snakeList;
    if (SL) for (var k = 0; k < SL.length; k++) {
      var s = SL[k]; if (!s.worms) continue;
      for (var w = 0; w < s.worms.length; w++) {
        var worm = s.worms[w], hd = { x: worm.hx, y: worm.hy };
        clamp(hd, C.SNAKE_HEAD_SIZE * 1.4);
        worm.hx = hd.x; worm.hy = hd.y;
      }
    }
  };

  /* DEBUG (KeyR): drive the whole end-game sequence for testing. First press (not
     yet fractured) ARMS a SHORT fracture ramp so the counter corruption + the map
     tearing open are quick to watch; once that ramp/the dimension is reached, a
     press drops the gate so the next TEAM spawns (+ the entry snap the first time).
     No-op while a boss / death-anim / draft is live. */
  M._forceBossTeam = function () {
    if (!this.p || this.p.state === 'DEAD') return;
    if (this._anyBossAlive() || (this._bossDeaths && this._bossDeaths.length)) return;
    if (this._bossDraftPending || this._upgradeDraftOpen || this._upSlowMoPhase) return;
    if (!this._bossTypesDefeated) this._bossTypesDefeated = {};
    for (var i = 0; i < M._BOSS_TYPES.length; i++) this._bossTypesDefeated[M._BOSS_TYPES[i]] = true;
    if (this._dimFractured || this._dimTransition) {
      this._bossKillThreshold = this.totalKills;   // already ramping / in the dimension → team next frame
    } else {
      // Arm a short ramp so the fracture build-up + snap are testable fast.
      this._dimTransition      = true;
      this._fractureStartKills = this.totalKills;
      this._bossKillThreshold  = this.totalKills + 30;
    }
  };

  /* ================================================================
     SPAWN — create the entity off in the distance (debug + natural)
     ================================================================ */
  M._spawnAnomaly = function (opts) {
    if (this._anomaly) return;   // only ever one anomaly (its quarantine can't stack)
    if (!this.p || this.p.state === 'DEAD') return;
    opts = opts || {};

    var ang  = opts.angle != null ? opts.angle : Math.random() * TAU;
    var dist = opts.dist  != null ? opts.dist  : 820;
    var aSp = LA.clampDisc(this.p.x + Math.cos(ang) * dist, this.p.y + Math.sin(ang) * dist, C.ANO_SIZE * 2);
    var x = aSp.x, y = aSp.y;

    var self = this;
    var mk = function (depth) {
      var s = self.add.image(x, y, '_anomaly');
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.setDepth(depth);
      return s;
    };

    // Glitch trail: pooled afterimages dropped along the body's path
    var TRAIL_N = 8;
    var trail = [], trailHist = [];
    for (var ti = 0; ti < TRAIL_N; ti++) {
      var ts = self.add.image(x, y, '_anomaly');
      ts.setBlendMode(Phaser.BlendModes.ADD);
      ts.setDepth(29);
      ts.setVisible(false);
      trail.push(ts);
      trailHist.push({ x: x, y: y });
    }

    var a = {
      x: x, y: y, vx: 0, vy: 0,
      phase: 'WANDER',
      shielded: false, vulnerable: false,
      hp: C.ANO_HP,
      tx: x, ty: y, retargetT: 0,        // smooth-steering waypoint
      spin: Math.random() * TAU,         // ever-rotating body
      wob: Math.random() * TAU,          // idle wobble phase
      bx: x, by: y, R: C.ANO_BARRIER_RADIUS, barrierT: 0,
      lasers: [], laserCD: C.ANO_LASER_CD * 0.8,
      projCD: C.ANO_PROJ_CD * 1.1,
      panicT: 0,
      chargeT: 0,                         // 0→1 energy charge while visible in WANDER
      _hitFlash: 0, _shieldHitT: 0,
      trail: trail, trailHist: trailHist, trailW: 0, trailTick: 0,
      // Intro cinematic state
      introState: null, introT: 0,
      vacQueue: null, vacRings: null, vacRingIdx: 0, vacNextT: 0, vacTotal: 0,
      bannerR: null, bannerG: null, bannerB: null, bannerCore: null,
      // per-channel chroma copies + white core
      rSpr: mk(31), gSpr: mk(31), bSpr: mk(31), coreSpr: mk(32),
      barrierGfx: null, shieldGfx: null, laserGfx: null,
      hintTxt: null,
    };
    a.rSpr.setTint(0xff0000);
    a.gSpr.setTint(0x00ff00);
    a.bSpr.setTint(0x0000ff);
    a.coreSpr.setTint(0xffffff);

    a.barrierGfx = this.add.graphics(); a.barrierGfx.setDepth(6);
    a.barrierGfx.setBlendMode(Phaser.BlendModes.ADD);
    a.shieldGfx  = this.add.graphics(); a.shieldGfx.setDepth(34);
    a.shieldGfx.setBlendMode(Phaser.BlendModes.ADD);
    a.laserGfx   = this.add.graphics(); a.laserGfx.setDepth(33);
    a.laserGfx.setBlendMode(Phaser.BlendModes.ADD);
    a.pointerGfx = this.add.graphics(); a.pointerGfx.setDepth(67);
    a.pointerGfx.setBlendMode(Phaser.BlendModes.ADD);

    a.hintTxt = this.add.text(x, y, '', {
      fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      color: '#ff3366', stroke: '#000000', strokeThickness: 3,
    });
    a.hintTxt.setOrigin(0.5, 1);
    a.hintTxt.setDepth(70);

    this._anomaly = a;

    // Arrival glitch
    this._spawnWaveRing(x, y, { maxRadius: 130, color: 0xff33cc, expandTime: 0.30 });
    this._explode(x, y, [255, 255, 255], 22);
    this._explode(x, y, [255, 40, 180], 16);
  };

  /* ================================================================
     UPDATE — main per-frame logic (scaled world-time sMs)
     ================================================================ */
  M._updateAnomaly = function (sMs, pMs, dt) {
    // Natural-spawn gate runs whether or not one is currently alive.
    if (!this._anomaly) { this._maybeSpawnAnomaly(sMs); return; }

    var a = this._anomaly, p = this.p;
    // On death the anomaly stays put (like the other enemies) — freeze, don't clear.
    if (p.state === 'DEAD') { this._renderAnomaly(dt, pMs); return; }

    // INTRO is a cinematic — drive it on REAL dt, regardless of the world
    // freeze that the intro itself imposes on player + enemies.
    if (a.phase === 'INTRO') {
      // Body still animates so the energy charge / time-stop reads.
      a.spin += dt * 60 * 0.32;
      a.wob  += dt * 60 * 0.10;
      this._anomalyTickIntro(a, p, dt);
      this._clampAnomalyToWorld(a);
      this._updateAnomalyTrail(a, dt);
      this._renderAnomaly(dt, pMs);
      return;
    }

    // The World: keep the hit-flash decaying on REAL dt so a white flash can't
    // freeze "stuck" on the boss for up to 4s — matches the Giga Bruiser's TW path.
    // A plain hitstop (sMs ≈ 0, no TW) still freezes it, symmetric with the Giga.
    if (this._twActive) {
      a._hitFlash   = Math.max(0, a._hitFlash   - dt * 4);
      a._shieldHitT = Math.max(0, a._shieldHitT - dt * 3);
      this._renderAnomaly(dt, pMs); return;
    }
    if (sMs < 0.001) { this._renderAnomaly(dt, pMs); return; }

    a._hitFlash    = Math.max(0, a._hitFlash    - dt * 4);
    a._shieldHitT  = Math.max(0, a._shieldHitT  - dt * 3);

    // Body always animates (spin + idle wobble), even when nearly still.
    // It whirls faster while spinning a rotating cross.
    var sc60 = sMs / 16.7;
    var spinning = false;
    for (var si = 0; si < a.lasers.length; si++) { if (a.lasers[si].rotRate) { spinning = true; break; } }
    a.spin += sc60 * (spinning ? 0.42 : 0.06);
    a.wob  += sc60 * 0.09;

    if (a.phase === 'WANDER') {
      // Energy charge: once visible on screen, ramp scale up like a building threat
      if (this.cameras.main.worldView.contains(a.x, a.y)) {
        a.chargeT = Math.min(1, a.chargeT + dt * 1000 / C.ANO_CHARGE_DUR);
      }
      this._anomalyMove(a, p, sMs, false, 1.0);
      var ddx = p.x - a.x, ddy = p.y - a.y;
      if (ddx * ddx + ddy * ddy < C.ANO_TRIGGER_RANGE_SQ) this._anomalySlamBarrier();
    } else {
      // BARRIER phase
      a.barrierT = Math.min(1, a.barrierT + dt * 3.2);   // firewall expand-in

      if (a.shielded) {
        // Slow right down while firing (esp. the cross) so beams read as "from him".
        var firing = a.lasers.length > 0;
        this._anomalyMove(a, p, sMs, true, firing ? (spinning ? 0.12 : 0.35) : 1.0);
        if (this.enemies.length === 0) {
          this._anomalyBreakShield();
        } else {
          a.laserCD -= sMs;
          if (a.laserCD <= 0) { this._anomalyFireLaser(); a.laserCD = C.ANO_LASER_CD; }
          a.projCD -= sMs;
          if (a.projCD <= 0) { this._anomalyFireProjectiles(); a.projCD = C.ANO_PROJ_CD * (0.8 + Math.random() * 0.5); }
        }
      } else {
        // Panicked / vulnerable — keeps stumbling around (never frozen), no lasers
        a.panicT += sMs;
        this._anomalyMove(a, p, sMs, true, 0.55);
      }
      this._confineAnomalyToBarrier(a);
    }

    this._clampAnomalyToWorld(a);   // never leave the arena → always reachable
    this._updateAnomalyLasers(sMs);
    this._updateAnomalyTrail(a, dt);
    this._renderAnomaly(dt, pMs);
  };

  /* Hard clamp to the disc arena (both phases) so the boss can never slip
     through the border and become unkillable. */
  M._clampAnomalyToWorld = function (a) {
    var ac = LA.clampDisc(a.x, a.y, C.ANO_SIZE * 1.2); a.x = ac.x; a.y = ac.y;
  };

  /* Sample the body's position into the after-image ring buffer (~33 Hz). */
  M._updateAnomalyTrail = function (a, dt) {
    a.trailTick += dt;
    if (a.trailTick < 0.03) return;
    a.trailTick = 0;
    a.trailHist[a.trailW % a.trailHist.length] = { x: a.x, y: a.y };
    a.trailW++;
  };

  /* ---- Smooth steering toward a roaming waypoint -------------------------
     No teleport: velocity eases toward the heading so the path is fluid and
     readable. The "buggy" feel is conveyed by the visual (RGB split, shard
     jitter, micro stutters), not by warping the position. ------------------ */
  M._anomalyMove = function (a, p, sMs, inside, speedMul) {
    var sc60 = sMs / 16.7;

    // Re-pick a waypoint periodically (or once the current one is reached).
    a.retargetT -= sMs;
    var tdx = a.tx - a.x, tdy = a.ty - a.y;
    var td  = Math.sqrt(tdx * tdx + tdy * tdy);
    if (a.retargetT <= 0 || td < 36) {
      a.retargetT = RETARGET_MIN + Math.random() * (RETARGET_MAX - RETARGET_MIN);
      if (inside) {
        // Roam the quarantine, but keep clear of the player at the centre.
        var ia = Math.random() * TAU;
        var ir = a.R * (0.42 + Math.random() * 0.5);
        a.tx = a.bx + Math.cos(ia) * ir;
        a.ty = a.by + Math.sin(ia) * ir;
      } else {
        // Approach the player with a little lateral offset so it weaves in.
        a.tx = p.x + (Math.random() - 0.5) * 240;
        a.ty = p.y + (Math.random() - 0.5) * 240;
      }
      tdx = a.tx - a.x; tdy = a.ty - a.y;
      td  = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    }
    td = td || 1;

    var spd   = (inside ? MOVE_SPEED_INSIDE : MOVE_SPEED) * (speedMul || 1);
    var desVx = (tdx / td) * spd, desVy = (tdy / td) * spd;
    var k = 1 - Math.pow(1 - MOVE_EASE, sc60);
    a.vx += (desVx - a.vx) * k;
    a.vy += (desVy - a.vy) * k;

    // Micro "stutter": a rare brief brake — glitchy hitch without warping.
    if (Math.random() < 0.03) { a.vx *= 0.45; a.vy *= 0.45; }

    a.x += a.vx * sc60;
    a.y += a.vy * sc60;
    // World clamp is applied centrally in _clampAnomalyToWorld (both phases).
  };

  M._confineAnomalyToBarrier = function (a) {
    var dx = a.x - a.bx, dy = a.y - a.by;
    var lim = a.R - C.ANO_SIZE * 1.6;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > lim) {
      a.x = a.bx + (dx / d) * lim;
      a.y = a.by + (dy / d) * lim;
    }
  };

  /* ================================================================
     SLAM — enter the INTRO cinematic that culminates in the quarantine
     barrier. The intro: time-stop flash → slow barrier rise → enemies
     get vacuumed in one by one (staggered, "encircled"), then the big
     "kill them all" banner slides into the small hint above the boss.
     ================================================================ */
  M._anomalySlamBarrier = function () {
    var a = this._anomaly, p = this.p, self = this;
    a.phase = 'INTRO';
    a.introState = 'STOP';
    a.introT = 0;
    a.shielded = true; a.vulnerable = false;
    a.barrierT = 0;
    a.bx = p.x; a.by = p.y;
    a.laserCD = C.ANO_LASER_CD * 1.15;
    a.retargetT = 0;
    this._anomalyBarrierActive = true;
    this._anomalyIntroActive   = true;     // tells scene.js to freeze player + world

    // Floor for the zone radius — final R is set AFTER the rings are built
    // so the barrier always contains the outermost ring (even near the map
    // edge where many slots get skipped and rings have to grow further).
    var trapCount = 0;
    for (var ci = 0; ci < this.enemies.length; ci++) {
      var ce = this.enemies[ci];
      var cdx = ce.x - a.bx, cdy = ce.y - a.by;
      if (cdx * cdx + cdy * cdy <= C.ANO_VACUUM_RADIUS_SQ) trapCount++;
    }
    var effCount = Math.max(trapCount, C.ANO_MIN_TRAPPED);
    var minBarrierR = Math.min(
      C.ANO_BARRIER_MAX,
      C.ANO_BARRIER_RADIUS + (effCount - C.ANO_MIN_TRAPPED) * C.ANO_BARRIER_PER_ENEMY
    );
    // NB: barrier center stays on the player — the slice past the world
    // border is just unused playable space (player + enemies are world-clamped).

    // Snapshot the live crowd by tier, then WIPE every enemy silently.
    // The time-stop literally makes them vanish; they reappear in a clean
    // circle around the player during VACUUM.
    var cam = this.cameras.main;
    var tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };   // tier 4 = the Sniper (re-materialised with the crowd, not despawned)
    for (var ci = 0; ci < this.enemies.length; ci++) {
      var tt = this.enemies[ci].tier;
      tierCounts[tt] = (tierCounts[tt] || 0) + 1;
    }
    var realTotal = tierCounts[1] + tierCounts[2] + tierCounts[3] + tierCounts[4];
    // Pad up to ANO_MIN_TRAPPED with rushers / shooters
    var need = Math.max(0, C.ANO_MIN_TRAPPED - realTotal);
    for (var k = 0; k < need; k++) {
      var t = (Math.random() < 0.28) ? 2 : 1;
      tierCounts[t]++;
    }
    // Wipe — silent destroy so it costs no score / no combo
    for (var di = this.enemies.length - 1; di >= 0; di--) {
      this._destroyEnemyNoScore(di, true);
    }
    // Sweep every projectile on the map too — the time-stop scrubs the board.
    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      this._explode(pr.x, pr.y, [255, 255, 255], 6);
      this._destroyProjectile(pr);
      this.projectiles.splice(pi, 1);
    }

    // Build the queue from the tier mix (incl. tier 4 snipers)
    a.vacQueue = [];
    for (var tIdx = 1; tIdx <= 4; tIdx++) {
      for (var nn = 0; nn < tierCounts[tIdx]; nn++) a.vacQueue.push({ tier: tIdx });
    }
    // Shuffle so the appearance ORDER is random (the final layout is still a
    // perfect circle — angles are assigned by index after shuffling).
    for (var sh = a.vacQueue.length - 1; sh > 0; sh--) {
      var rj = (Math.random() * (sh + 1)) | 0;
      var tmp = a.vacQueue[sh]; a.vacQueue[sh] = a.vacQueue[rj]; a.vacQueue[rj] = tmp;
    }

    // Concentric rings — each ring spawns as one beat (one batch). Rings
    // keep growing OUTWARD without a cap so enemies never stack on the
    // same diameter. Slots that fall outside the world border are skipped
    // (the player can be at a corner: half the ring is just "unused").
    var N = a.vacQueue.length;

    // Hard cap so rings never grow past the barrier max — we keep the zone
    // tight, but we PRE-CALIBRATE the radial step + per-ring spacing so the
    // whole crowd fits with visibly distinct rings (rather than stacking
    // forever on the outer one, which freezes the spawn animation).
    var ringMaxR = Math.max(C.ANO_VAC_RING_BASE, C.ANO_BARRIER_MAX - 80);
    var STEP_MIN    = 20;   // floor on ring-to-ring gap (still visually readable)
    var SPACING_MIN = 32;   // floor on per-ring spacing (enemies can touch a bit)
    var step    = C.ANO_VAC_RING_STEP;
    var spacing = C.ANO_VAC_RING_SPACING;
    var capacityFor = function (st, sp) {
      var cap = 0;
      for (var r = C.ANO_VAC_RING_BASE; r <= ringMaxR + 0.001; r += st) {
        cap += Math.max(5, Math.floor(2 * Math.PI * r / sp));
      }
      return cap;
    };
    // Phase 1 — shrink the RADIAL gap so more rings fit in the available span
    var ssafe = 24;
    while (capacityFor(step, spacing) < N && step > STEP_MIN && ssafe-- > 0) {
      step = Math.max(STEP_MIN, step * 0.78);
    }
    // Phase 2 — if rings are already as close as they get, densify each ring
    ssafe = 24;
    while (capacityFor(step, spacing) < N && spacing > SPACING_MIN && ssafe-- > 0) {
      spacing = Math.max(SPACING_MIN, spacing * 0.85);
    }

    var rings = [];
    var ringR = C.ANO_VAC_RING_BASE;
    var qi = 0;
    var safety = 80;
    var outerUsedR = ringR;
    while (qi < N && safety-- > 0) {
      if (ringR > ringMaxR) ringR = ringMaxR;        // cap so barrier stays tight
      var slots = Math.max(5, Math.floor(2 * Math.PI * ringR / spacing));
      var baseAng = Math.random() * TAU;
      var validPos = [];
      for (var s = 0; s < slots; s++) {
        var ang = baseAng + (s / slots) * TAU;
        var x = a.bx + Math.cos(ang) * ringR;
        var y = a.by + Math.sin(ang) * ringR;
        if (LA.inDisc(x, y, 28)) validPos.push({ x: x, y: y });
      }
      if (validPos.length > 0) {
        var take = Math.min(validPos.length, N - qi);
        var items = a.vacQueue.slice(qi, qi + take);
        for (var ii = 0; ii < take; ii++) {
          items[ii].dstX = validPos[ii].x;
          items[ii].dstY = validPos[ii].y;
        }
        rings.push({ R: ringR, items: items });
        outerUsedR = ringR;
        qi += take;
      }
      ringR += step;
    }

    // Final barrier radius: contain every ring (+ margin), with the hard cap.
    a.R = Math.min(C.ANO_BARRIER_MAX, Math.max(minBarrierR, outerUsedR + 90));

    // Count what actually landed in rings — slots outside the disc (player pinned
    // at the rim) can be skipped, so the raw queue length N would over-report.
    var placed = 0;
    for (var rci = 0; rci < rings.length; rci++) placed += rings[rci].items.length;
    a.vacTotal   = placed;
    a.vacRings   = rings;
    a.vacRingIdx = 0;
    a.vacNextT   = 0;     // first ring fires the moment VACUUM begins

    // White-glitch banner: 4 chroma-split texts (R/G/B) + a white core copy.
    // Updated together by _anomalyTickIntro so it shimmers like the boss body.
    var mkBan = function (tint, depth) {
      var t = self.add.text(cam.width / 2, cam.height * 0.40, '', {
        fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 3, align: 'center',
      });
      t.setScrollFactor(0); t.setOrigin(0.5); t.setDepth(depth);
      t.setBlendMode(Phaser.BlendModes.ADD);
      t.setTint(tint); t.setAlpha(0); t.setScale(0.6);
      return t;
    };
    a.bannerR    = mkBan(0xff0000, 109);
    a.bannerG    = mkBan(0x00ff00, 109);
    a.bannerB    = mkBan(0x0000ff, 109);
    a.bannerCore = mkBan(0xffffff, 110);

    // Time-stop shockwave — boss-style: layered chroma wave sweeps the screen.
    this._spawnWaveRing(a.x, a.y, { maxRadius: 1800, color: 0xffffff, expandTime: 0.55 });
    this._spawnWaveRing(a.x, a.y, { maxRadius: 1500, color: 0xff66cc, expandTime: 0.45 });
    this._spawnWaveRing(a.x, a.y, { maxRadius: 1100, color: 0x66ffff, expandTime: 0.38 });
    this._spawnWaveRing(a.x, a.y, { maxRadius: 700,  color: 0xffffff, expandTime: 0.30 });
    this._spawnWaveRing(a.x, a.y, { maxRadius: 350,  color: 0xff44ff, expandTime: 0.22 });
    this.cameras.main.flash(380, 220, 120, 255);
    this.cameras.main.shake(320, 0.018);
    this._explode(a.x, a.y, [255, 255, 255], 50);
    this._explode(a.x, a.y, [255, 60, 220], 36);
    this._explode(a.x, a.y, [80, 200, 255], 28);
  };

  /* Update the 4-text glitch banner together — same base pos/scale/alpha,
     RGB copies orbit on chroma offsets with jitter (matches the body). */
  M._setAnomalyBanner = function (a, baseX, baseY, baseScale, baseAlpha, text) {
    if (!a.bannerCore) return;
    var gt = this.gameTime;
    var ca = 3.2 + 2.0 * Math.sin(gt * 22);
    if (Math.random() < 0.08) ca += 5;
    var jx = (Math.random() - 0.5) * 2.4, jy = (Math.random() - 0.5) * 2.4;
    var spin = a.spin || 0;
    var rA = spin, gA = spin + TAU / 3, bA = spin + 2 * TAU / 3;
    var apply = function (t, x, y, alphaMul) {
      t.setText(text);
      t.setPosition(x, y);
      t.setScale(baseScale);
      t.setAlpha(baseAlpha * (alphaMul || 1));
    };
    apply(a.bannerR,    baseX + Math.cos(rA) * ca + jx,        baseY + Math.sin(rA) * ca + jy, 0.85);
    apply(a.bannerG,    baseX + Math.cos(gA) * ca * 0.9 + jx,  baseY + Math.sin(gA) * ca * 0.9 + jy, 0.85);
    apply(a.bannerB,    baseX + Math.cos(bA) * ca + jx,        baseY + Math.sin(bA) * ca + jy, 0.85);
    apply(a.bannerCore, baseX + jx, baseY + jy, 1.0);
  };

  /* The intro state machine — drives on REAL dt while world + player are frozen
     externally by scene.js (via this._anomalyIntroActive). */
  M._anomalyTickIntro = function (a, p, dt) {
    a.introT += dt * 1000;
    var cam = this.cameras.main;
    var sx0 = cam.width / 2, sy0 = cam.height * 0.40;
    var bigText = LA.laGoT('laAnomalyBigHint') + '   ' + a.vacTotal;

    if (a.introState === 'STOP') {
      // Banner pops in (overshoot) + full glitch chroma
      var sp = Math.min(1, a.introT / C.ANO_INTRO_STOP);
      var bScale = 0.6 + 0.5 * Math.min(1, sp * 1.35);
      this._setAnomalyBanner(a, sx0, sy0, bScale, sp, bigText);
      if (a.introT >= C.ANO_INTRO_STOP) { a.introState = 'RAISE'; a.introT = 0; }
      return;
    }

    if (a.introState === 'RAISE') {
      a.barrierT = Math.min(1, a.introT / C.ANO_INTRO_RAISE);
      var rScale = 1.10 + 0.04 * Math.sin(this.gameTime * Math.PI * 4);
      this._setAnomalyBanner(a, sx0, sy0, rScale, 1, bigText);
      if (a.introT >= C.ANO_INTRO_RAISE) { a.introState = 'VACUUM'; a.introT = 0; a.vacNextT = 0; }
      return;
    }

    if (a.introState === 'VACUUM') {
      a.vacNextT -= dt * 1000;
      this._setAnomalyBanner(a, sx0, sy0, 1.10 + 0.04 * Math.sin(this.gameTime * Math.PI * 4), 1, bigText);
      // One whole ring per beat — many spawns at once at different angles,
      // each ring is bigger than the previous (concentric circles).
      while (a.vacNextT <= 0 && a.vacRingIdx < a.vacRings.length) {
        a.vacNextT += C.ANO_INTRO_RING_GAP;
        var ring = a.vacRings[a.vacRingIdx++];
        for (var si = 0; si < ring.items.length; si++) {
          if (this.enemies.length >= C.MAX_ENEMIES) break;
          var it = ring.items[si];
          this._spawnTierAt(it.tier, it.dstX, it.dstY);
          // Face the player at spawn so the entire ring looks inward (otherwise
          // they all default to angle 0 until the AI runs on the next frame).
          var spawned = this.enemies[this.enemies.length - 1];
          if (spawned) spawned.angle = Math.atan2(p.y - spawned.y, p.x - spawned.x);
        }
      }
      if (a.vacRingIdx >= a.vacRings.length && a.introT > 220) {
        a.introState = 'SLIDE'; a.introT = 0;
      }
      return;
    }

    if (a.introState === 'SLIDE') {
      var t = Math.min(1, a.introT / C.ANO_INTRO_SLIDE);
      var e2 = t * t * (3 - 2 * t);                  // smoothstep
      var bossSx = (a.x - cam.scrollX) * (cam.zoom || 1);
      var bossSy = (a.y - C.ANO_SIZE * 2.6 - cam.scrollY) * (cam.zoom || 1);
      var nx = sx0 + (bossSx - sx0) * e2;
      var ny = sy0 + (bossSy - sy0) * e2;
      var ns = 1.10 + (0.40 - 1.10) * e2;
      var na = 1 - 0.5 * e2;
      this._setAnomalyBanner(a, nx, ny, ns, na, bigText);
      if (a.introT >= C.ANO_INTRO_SLIDE) {
        if (a.bannerR)    { a.bannerR.destroy();    a.bannerR    = null; }
        if (a.bannerG)    { a.bannerG.destroy();    a.bannerG    = null; }
        if (a.bannerB)    { a.bannerB.destroy();    a.bannerB    = null; }
        if (a.bannerCore) { a.bannerCore.destroy(); a.bannerCore = null; }
        // Reset the player to a neutral state so they don't resume mid-attack /
        // mid-dash and don't carry over any pre-slam inertia — the fight starts
        // with the ship completely under control and standing still.
        p.vx = 0; p.vy = 0;
        p.state = 'MOVING';
        p.spinAngle = 0;
        p.atkTimer = 0;     p.atkAvailable  = true; p.atkCooldown  = 0;
        p.dashTimer = 0;    p.dashAvailable = true; p.dashCooldown = 0;
        p.dashCoyote = false; p.dashInvinc = false;
        p.hasHitDuringDashAttack = false; p.dashAtkExtended = 0;
        p.recoveryTimer = 0; p.recoveryWhiff = false;
        // Brief grace i-frames so the encircling crowd can't tag the player
        // in the very first frame of resumed time.
        p.invincible = true; p.invincTimer = 600;

        // Pushback when time resumes — same wave the sandbox respawn uses,
        // so the encircling crowd is shoved outward as the fight begins.
        this._anomalyResumeShockwave(p);
        a.phase = 'BARRIER';
        a.introState = null;
        this._anomalyIntroActive = false;
      }
    }
  };

  /* Mirror of _sandboxRespawn's safe-bubble push: shoves nearby enemies away
     from the player and stuns them briefly so the fight starts on a clean beat. */
  M._anomalyResumeShockwave = function (p) {
    this._safeBubblePush(p, 340);
  };

  /* ================================================================
     LASERS — telegraphed beams (thin warning → deadly beam)
     Patterns: single / triple-fan (each either AIMED at the player or
     OFFSET to harass), and a rotating CROSS (2 perpendicular diameters that
     spin with the body). Beams emanate live from the body and stop at the
     barrier edge.
     ================================================================ */
  M._anomalyFireLaser = function () {
    var a = this._anomaly, p = this.p;
    var aimAng = Math.atan2(p.y - a.y, p.x - a.x);
    var W = C.ANO_LASER_WARN, F = C.ANO_LASER_FIRE;
    var roll = Math.random();

    if (roll < 0.24) {
      // Rotating CROSS — 4 arms (2 perpendicular diameters) sweeping together
      var base = Math.random() * TAU;
      var rr   = C.ANO_CROSS_ROT * (Math.random() < 0.5 ? 1 : -1);
      for (var c = 0; c < 4; c++) {
        a.lasers.push({ ang: base + c * (Math.PI / 2), rotRate: rr, t: 0, warn: W, fire: C.ANO_CROSS_FIRE });
      }
    } else {
      // Sometimes dead-on, sometimes deliberately off to the side (no direct aim).
      var aimed  = Math.random() < 0.58;
      var center = aimed ? aimAng
                         : aimAng + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.8);
      a.lasers.push({ ang: center, rotRate: 0, t: 0, warn: W, fire: F });
      if (roll > 0.62) {  // triple fan
        a.lasers.push({ ang: center + 0.42, rotRate: 0, t: 0, warn: W, fire: F });
        a.lasers.push({ ang: center - 0.42, rotRate: 0, t: 0, warn: W, fire: F });
      }
    }
    this._explode(a.x, a.y, [255, 60, 200], 8);
  };

  /* Distance from the body to the barrier edge along `ang` (beam never exits). */
  M._anomalyBeamLen = function (a, ang) {
    if (a.phase !== 'BARRIER') return a.R * 2.2;
    var fx = a.x - a.bx, fy = a.y - a.by;
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var fd = fx * dx + fy * dy;
    var disc = fd * fd - (fx * fx + fy * fy - a.R * a.R);  // body is inside → disc ≥ 0
    if (disc < 0) return 0;
    return Math.max(0, -fd + Math.sqrt(disc));
  };

  M._updateAnomalyLasers = function (sMs) {
    var a = this._anomaly, p = this.p;
    for (var i = a.lasers.length - 1; i >= 0; i--) {
      var L = a.lasers[i];
      L.t += sMs;
      if (L.rotRate) L.ang += L.rotRate * sMs;       // rotating cross
      if (L.t >= L.warn + L.fire) { a.lasers.splice(i, 1); continue; }
      if (L.t < L.warn) continue;                     // telegraph is harmless

      // Deadly phase — point-to-segment test. No per-beam hit latch: a hit grants
      // i-frames (which _damagePlayer respects), so a sweeping beam can threaten
      // again only after the i-frames lapse.
      var laserImmune = p.state === 'DASHING' || p.state === 'DASH_ATTACKING'
                     || p.invincible || this._twActive || p.state === 'DEAD';
      if (laserImmune) continue;

      var ox = a.x, oy = a.y;                          // live origin (on the body)
      var len = this._anomalyBeamLen(a, L.ang);
      var dx = Math.cos(L.ang), dy = Math.sin(L.ang);
      var rx = p.x - ox, ry = p.y - oy;
      var proj = rx * dx + ry * dy;                    // distance along the beam
      if (proj < 0 || proj > len) continue;
      var cx = ox + dx * proj, cy = oy + dy * proj;
      var pdx = p.x - cx, pdy = p.y - cy;
      var hitR = C.ANO_LASER_WIDTH + C.SIZE * 0.5;
      if (pdx * pdx + pdy * pdy < hitR * hitR) {
        var nx = (p.x - ox), ny = (p.y - oy);
        var nl = Math.sqrt(nx * nx + ny * ny) || 1;
        this._damagePlayer(nx / nl, ny / nl);
      }
    }
  };

  /* ================================================================
     HOMING GLITCH PROJECTILES — slower than T2, track the player, and are
     reflectable by the dash-attack (then chase a random far enemy).
     ================================================================ */
  M._anomalyFireProjectiles = function () {
    var a = this._anomaly, p = this.p;
    var span = C.ANO_PROJ_SWARM_MAX - C.ANO_PROJ_SWARM_MIN;
    var n = C.ANO_PROJ_SWARM_MIN + ((Math.random() * (span + 1)) | 0);
    var baseAng = Math.atan2(p.y - a.y, p.x - a.x);
    // Spawn the swarm fanned around the player heading; each projectile homes
    // from there with a high turn rate so the swarm really sticks to the player.
    for (var i = 0; i < n; i++) {
      var t = n > 1 ? (i / (n - 1) - 0.5) : 0;
      var ang = baseAng + t * 1.4 + (Math.random() - 0.5) * 0.25;
      this._spawnAnomalyProjectile(a.x, a.y, ang);
    }
    this._explode(a.x, a.y, [255, 255, 255], 6);
  };

  M._spawnAnomalyProjectile = function (ex, ey, angle) {
    if (this.projectiles.length >= C.MAX_PROJECTILES) return;
    var spr = this.add.image(ex, ey, '_anoproj');     // own skin
    spr.setBlendMode(Phaser.BlendModes.ADD);
    spr.setDepth(22);
    this.projectiles.push({
      spr: spr, x: ex, y: ey,
      vx: Math.cos(angle) * C.ANO_PROJ_SPEED, vy: Math.sin(angle) * C.ANO_PROJ_SPEED,
      life: C.ANO_PROJ_LIFE, isReflected: false, smashed: false,
      shooterRef: null, rotSpeed: 11, trailSlots: [],
      // Anomaly markers: homes on the player; turns into an enemy-seeker on parry.
      homing: true, glitch: true, homeTarget: null,
    });
  };

  /* Pick a random enemy that's on-screen but toward the edges (far from us) —
     the target a reflected glitch projectile will chase. If `exclude` is given
     (array of enemy refs), those are skipped so a swarm of reflected projectiles
     spreads across different enemies. Fallback tiers (most→least preferred):
       1. visible + far enough + not excluded            → random pick
       2. visible + not excluded (any distance)          → farthest non-excluded
       3. visible (every fresh target taken)             → farthest visible
     Returns null if nothing is visible. */
  M._pickDistantVisibleEnemy = function (exclude) {
    var cam = this.cameras.main, p = this.p;
    var wv = cam.worldView;
    var zoom = cam.zoom || 1;
    var minD = Math.min(cam.width, cam.height) / zoom * 0.50;  // "vers les extrémités"
    var minDSq = minD * minD;
    var hasExcl = exclude && exclude.length > 0;
    var cands = [];
    var farFresh = null, farFreshD = -1;     // farthest non-excluded
    var farAny   = null, farAnyD   = -1;     // farthest visible (last resort)
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.x < wv.x || e.x > wv.right || e.y < wv.y || e.y > wv.bottom) continue;
      var dx = e.x - p.x, dy = e.y - p.y, dSq = dx * dx + dy * dy;
      if (dSq > farAnyD) { farAnyD = dSq; farAny = e; }
      var excluded = hasExcl && exclude.indexOf(e) !== -1;
      if (excluded) continue;
      if (dSq > farFreshD) { farFreshD = dSq; farFresh = e; }
      if (dSq >= minDSq) cands.push(e);
    }
    if (cands.length)   return cands[(Math.random() * cands.length) | 0];
    if (farFresh)       return farFresh;     // no "far" candidate but still spread
    return farAny;                            // every visible enemy taken → reuse
  };


  /* ================================================================
     SHIELD BREAK — last sub-fifre died; the anomaly panics
     ================================================================ */
  M._anomalyBreakShield = function () {
    var a = this._anomaly;
    if (!a.shielded) return;
    a.shielded = false; a.vulnerable = true; a.panicT = 0;
    a.lasers.length = 0;

    // Sweep away every glitch projectile (live + reflected): the boss is
    // weakened, its guided shots collapse with it. Each one poofs in place.
    for (var pi = this.projectiles.length - 1; pi >= 0; pi--) {
      var pr = this.projectiles[pi];
      if (!pr.glitch) continue;
      this._explode(pr.x, pr.y, [255, 255, 255], 8);
      this._explode(pr.x, pr.y, [120, 220, 255], 4);
      this._destroyProjectile(pr);
      this.projectiles.splice(pi, 1);
    }

    // Glass-shatter burst
    this._explode(a.x, a.y, [255, 255, 255], 40);
    this._explode(a.x, a.y, [120, 220, 255], 24);
    this._spawnWaveRing(a.x, a.y, { maxRadius: C.ANO_SIZE * 6, color: 0xffffff, expandTime: 0.22 });
    this.cameras.main.flash(180, 255, 255, 255);
    this.cameras.main.shake(160, 0.012);
    this._triggerHitstop(C.HITSTOP_MAX);
  };

  /* ================================================================
     PLAYER MELEE vs ANOMALY (the boss is not in this.enemies)
     ================================================================ */
  M._checkAnomalyCollision = function () {
    var a = this._anomaly;
    if (!a || a.phase !== 'BARRIER') return;
    var p = this.p;
    var isAtk = p.state === 'ATTACKING', isDAtk = p.state === 'DASH_ATTACKING';
    if (!isAtk && !isDAtk) return;

    var dx = p.x - a.x, dy = p.y - a.y;
    var d2 = dx * dx + dy * dy;
    var thr = C.SIZE * 0.6 + C.ANO_SIZE + (a.shielded ? 16 : 6);
    if (d2 > thr * thr) return;
    var dist = Math.sqrt(d2) || 0.001;

    if (a.shielded) {
      // Impenetrable — tirs absorbés, rebond
      a._shieldHitT = 1.0;
      this._explode(a.x, a.y, [120, 220, 255], 6);
      this._triggerHitstop(C.HITSTOP_DUR);
      if (isAtk) {
        p.vx = (dx / dist) * C.REBOUND_IMP; p.vy = (dy / dist) * C.REBOUND_IMP;
        p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
        p.atkAvailable = true; p.atkCooldown = 0;
      }
      if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
      return;
    }

    // Vulnerable — deal damage
    a.hp -= isDAtk ? 2 : 1;
    a._hitFlash = 1.0;
    a.vx += (-dx / dist) * 10; a.vy += (-dy / dist) * 10;
    this._explode(a.x, a.y, [255, 60, 60], 16);
    this._explode(a.x, a.y, [255, 255, 255], 8);
    this._triggerHitstop(C.HITSTOP_DUR);
    this.cameras.main.shake(70, 0.008);

    if (isAtk) {
      p.state = 'MOVING'; p.spinAngle = 0; p.atkTimer = 0;
      p.atkAvailable = true; p.atkCooldown = 0;
      p.vx *= 0.3; p.vy *= 0.3;
      if (!p.invincible) { p.invincible = true; p.invincTimer = 120; p.dashInvinc = true; }
    } else {
      p.hasHitDuringDashAttack = true;
    }

    if (a.hp <= 0) this._killAnomaly();
  };

  /* ================================================================
     DEATH — shatter barrier, resume spawns, drop a free upgrade
     ================================================================ */
  /* ZONE COLLAPSE — the firewall "quarantine" field caving in the instant the
     Anomaly dies (fired HERE at kill-time, not in the ~2 s-delayed death blast,
     so destroying the boss visibly pops its zone right away). Deliberately its
     own visual language — a glitchy RGB-split ring that CONTRACTS inward and
     shreds into digital fragments, collapsing to a singularity at the centre —
     so it never reads like the round particle explosions or the white finisher
     star. Runs on the tween timeline → animates straight through the kill
     hitstop. Its own graphics object, so it survives _clearAnomaly. */
  M._anomalyZoneCollapse = function (bx, by, R) {
    if (!R || R < 1) return;
    var self = this;
    var gfx = this.add.graphics();
    gfx.setDepth(8);                       // floor-level field, beneath the action
    gfx.setBlendMode(Phaser.BlendModes.ADD);

    // Static tear pattern so the shredding arcs are stable across the collapse.
    var TEARS = 14, tears = [];
    for (var ti = 0; ti < TEARS; ti++) {
      tears.push({ a: Math.random() * TAU, w: 0.10 + Math.random() * 0.30, rf: 0.5 + Math.random() * 0.5 });
    }

    var state = { t: 0 };
    this.tweens.add({
      targets: state, t: 1, duration: 520, ease: 'Quart.easeIn',   // accelerates inward
      onUpdate: function () {
        if (!self._upgradeLevels) { gfx.clear(); return; }
        var t     = state.t;
        var a     = 1 - t * 0.8;                       // stays bright, fades late
        var rr    = R * (1 - t);                        // ring contracts to the centre
        var split = (3 + 20 * t) * (1 - t);             // chromatic split peaks mid-collapse
        var rot   = t * 7.0;
        gfx.clear();

        // Central singularity flash — swells as the field caves into a point.
        var coreA = t * t;
        gfx.fillStyle(0xff2266, coreA * 0.5);
        gfx.fillCircle(bx, by, 4 + 26 * coreA);
        gfx.fillStyle(0xffffff, coreA * 0.9);
        gfx.fillCircle(bx, by, 2 + 11 * coreA);
        if (rr < 2) return;                             // ring gone → only the core remains

        // Faint interior wash shrinking with the ring.
        gfx.fillStyle(0xff0033, 0.06 * (1 - t));
        gfx.fillCircle(bx, by, rr);

        // RGB-split main ring (chromatic aberration — the Anomaly's signature).
        gfx.lineStyle(3, 0xff0033, a * 0.85);
        gfx.strokeCircle(bx + split, by, rr);
        gfx.lineStyle(3, 0x00ff66, a * 0.7);
        gfx.strokeCircle(bx - split * 0.6, by + split * 0.5, rr);
        gfx.lineStyle(3, 0x3388ff, a * 0.7);
        gfx.strokeCircle(bx - split * 0.4, by - split * 0.6, rr);
        gfx.lineStyle(1.4, 0xffffff, a * 0.6);
        gfx.strokeCircle(bx, by, rr * 0.99);

        // Spinning firewall dashes, tightening as it implodes.
        var segs = 40, dash = (TAU / segs) * 0.5;
        for (var s = 0; s < segs; s++) {
          var a1 = rot + (TAU / segs) * s;
          gfx.lineStyle(2.5, 0xff5577, a * (0.3 + 0.3 * Math.sin(t * 30 + s)));
          gfx.beginPath(); gfx.arc(bx, by, rr, a1, a1 + dash); gfx.strokePath();
        }

        // Digital "tear" fragments — short arcs flickering at jittered radii.
        for (var k = 0; k < TEARS; k++) {
          if (Math.random() < 0.25) continue;           // flicker on/off
          var tr = tears[k];
          var fr = rr * tr.rf + (Math.random() - 0.5) * 10;
          if (fr < 2) continue;
          var aa = tr.a + rot * 0.4;
          gfx.lineStyle(2, Math.random() < 0.5 ? 0xffffff : 0x00ffcc, a * 0.8);
          gfx.beginPath(); gfx.arc(bx, by, fr, aa, aa + tr.w); gfx.strokePath();
        }

        // Inward-streaking spokes — energy sucked toward the singularity.
        for (var sp = 0; sp < 10; sp++) {
          var ga = rot * 0.5 + (TAU / 10) * sp;
          gfx.lineStyle(1.2, 0xff3355, a * 0.4);
          gfx.beginPath();
          gfx.moveTo(bx + Math.cos(ga) * rr, by + Math.sin(ga) * rr);
          gfx.lineTo(bx + Math.cos(ga) * rr * (0.55 - 0.3 * t), by + Math.sin(ga) * rr * (0.55 - 0.3 * t));
          gfx.strokePath();
        }
      },
      onComplete: function () { gfx.destroy(); },
    });
  };

  M._killAnomaly = function () {
    var a = this._anomaly;
    if (!a || a.dead) return;
    a.dead = true;
    var ex = a.x, ey = a.y, R = a.R, bx = a.bx, by = a.by;

    this._clearAnomaly(true);
    // Barrier gone → any confined team boss is freed. Spawns stay held only if
    // this was the LAST boss (set by _beginBossDeath via _bossDraftPending).
    this._anomalyBarrierActive = false;

    // Pop the quarantine zone NOW (at the killing blow), not at the delayed boss
    // blast — its glitch-implosion is distinct from both the finisher star and
    // the RGB death burst below.
    this._anomalyZoneCollapse(bx, by, R);

    this._beginBossDeath(ex, ey, {
      type: 'anomaly', label: 'ANOMALY PURGED',
      color: '#ff66cc', glow: '#ff66cc', ringColor: 0xff2255, coreColor: 0xff44aa, expCol: [255, 80, 180],
      explode: function (x, y) {
        // RGB death burst (the zone already collapsed at kill-time, so no
        // barrier-sized rings here — just the boss's own chromatic blast).
        this._explode(x, y, [255, 40, 40],  50);
        this._explode(x, y, [40, 255, 40],  40);
        this._explode(x, y, [60, 120, 255], 40);
        this._explode(x, y, [255, 255, 255], 30);
        this.cameras.main.flash(280, 255, 255, 255);
        this.cameras.main.shake(300, 0.020);
        this._triggerHitstop(C.DETONATION_HITSTOP);
      },
    });
  };

  /* ================================================================
     RENDER — chromatic-aberration body + firewall + shield + lasers
     ================================================================ */
  M._renderAnomaly = function (dt, pMs) {
    var a = this._anomaly;
    if (!a) return;
    var gt = this.gameTime, p = this.p;

    /* ---- Glitch trail: faded, jittered afterimages along the path ---- */
    var tN = a.trailHist.length;
    for (var ti = 0; ti < tN; ti++) {
      var ts = a.trail[ti];
      // age 0 = freshest sample, increasing with distance back in the ring
      var hi = (a.trailW - 1 - ti);
      if (hi < 0) { ts.setVisible(false); continue; }
      var node = a.trailHist[hi % tN];
      if (!node) { ts.setVisible(false); continue; }
      var fade = 1 - ti / tN;                       // 1 → 0 along the tail
      ts.setVisible(true);
      ts.setPosition(node.x + (Math.random() - 0.5) * 4, node.y + (Math.random() - 0.5) * 4);
      ts.setRotation(a.spin * (ti % 2 ? -1 : 1));
      ts.setScale((0.5 + fade * 0.5) * (1 + 0.15 * Math.sin(gt * 20 + ti)));
      ts.setAlpha(fade * 0.32);
      ts.setTint(ti % 2 ? 0xff33cc : 0x33ffff);     // alternating magenta / cyan ghosting
    }

    /* ---- Body: constantly-animated, trembling RGB split ----
       Even when nearly still it spins, breathes and wobbles so it never reads
       as a static sprite. The RGB channels each orbit on their own phase. */
    // Idle wobble — a small Lissajous drift driven by a.wob (always advancing)
    var wob = a.wob;
    var jx = Math.sin(wob * 1.7) * 2.6 + (Math.random() - 0.5) * 2.4;
    var jy = Math.cos(wob * 1.3) * 2.6 + (Math.random() - 0.5) * 2.4;
    if (Math.random() < 0.06) { jx += (Math.random() - 0.5) * 18; jy += (Math.random() - 0.5) * 12; }
    var cx = a.x + jx, cy = a.y + jy;

    var ca = 3.4 + 2.2 * Math.sin(gt * 22);     // chromatic split amount
    if (Math.random() < 0.08) ca += 6;
    var sc = 1.0 + 0.13 * Math.sin(gt * 14);    // breathing scale
    // Energy charge in WANDER swells the body (and crackles harder near full)
    if (a.chargeT > 0 && a.phase === 'WANDER') {
      sc *= 1.0 + a.chargeT * 0.75;
      ca += a.chargeT * 4;
    }
    var spin = a.spin;                           // continuous rotation

    var solidRed = false, baseAlpha = 0.9;
    if (a.vulnerable) {
      // Panicked, defenceless: blinking red target (still spinning/breathing)
      var blink = Math.sin(gt * Math.PI * C.ANO_PANIC_BLINK) > -0.2;
      solidRed = true;
      baseAlpha = blink ? 0.95 : 0.30;
      ca *= 0.45;
      sc *= 1.0 + 0.08 * Math.sin(gt * 40);
    }
    if (a._hitFlash > 0) { solidRed = false; baseAlpha = 1.0; }

    var rTint = solidRed ? 0xff2222 : (a._hitFlash > 0 ? 0xffffff : 0xff0000);
    var gTint = solidRed ? 0xff2222 : (a._hitFlash > 0 ? 0xffffff : 0x00ff00);
    var bTint = solidRed ? 0xff2222 : (a._hitFlash > 0 ? 0xffffff : 0x0000ff);
    // The World: drain the RGB-split channels to grey (frozen, like the enemies);
    // the offset sprites still overlap into a faint grey "glitch" ghost.
    if (this._twActive) { rTint = this._twGray(rTint); gTint = this._twGray(gTint); bTint = this._twGray(bTint); }

    // Each channel orbits the centre on its own angle so the split shimmers.
    var rA = spin,             gA = spin + TAU / 3, bA = spin + 2 * TAU / 3;
    a.rSpr.setPosition(cx + Math.cos(rA) * ca,        cy + Math.sin(rA) * ca);
    a.rSpr.setTint(rTint); a.rSpr.setScale(sc); a.rSpr.setAlpha(baseAlpha); a.rSpr.setRotation(spin);
    a.gSpr.setPosition(cx + Math.cos(gA) * ca * 0.9,  cy + Math.sin(gA) * ca * 0.9);
    a.gSpr.setTint(gTint); a.gSpr.setScale(sc); a.gSpr.setAlpha(baseAlpha); a.gSpr.setRotation(-spin * 0.7);
    a.bSpr.setPosition(cx + Math.cos(bA) * ca,        cy + Math.sin(bA) * ca);
    a.bSpr.setTint(bTint); a.bSpr.setScale(sc); a.bSpr.setAlpha(baseAlpha); a.bSpr.setRotation(spin * 1.3);
    a.coreSpr.setPosition(cx, cy);
    a.coreSpr.setScale(sc * 0.9);
    a.coreSpr.setTint(this._twActive ? 0xb0b0b0 : 0xffffff);   // grey the white-hot core during The World
    a.coreSpr.setAlpha((solidRed ? baseAlpha : 0.5) + a._hitFlash * 0.5);
    a.coreSpr.setRotation(-spin * 1.6 + (Math.random() - 0.5) * 0.25);

    /* ---- Firewall barrier ---- */
    var bg = a.barrierGfx;
    bg.clear();
    if ((a.phase === 'BARRIER' || a.phase === 'INTRO') && a.barrierT > 0) {
      var grow = a.barrierT;
      var rN   = a.R * grow;
      // Faint interior wash
      bg.fillStyle(0xff0033, 0.04 * grow);
      bg.fillCircle(a.bx, a.by, rN);
      // Outer glow + main ring
      bg.lineStyle(8, 0xff0033, 0.14 * grow);
      bg.strokeCircle(a.bx, a.by, rN * 1.01);
      bg.lineStyle(2.5, 0xff2a4d, 0.75 * grow);
      bg.strokeCircle(a.bx, a.by, rN);
      bg.lineStyle(1, 0xffffff, 0.30 * grow);
      bg.strokeCircle(a.bx, a.by, rN * 0.992);
      // Rotating "firewall" dashes (data ticks) — two counter-spinning rings
      var segs = 48, dash = (TAU / segs) * 0.55;
      var rot1 = gt * 0.6, rot2 = -gt * 0.9;
      for (var s = 0; s < segs; s++) {
        var a1 = rot1 + (TAU / segs) * s;
        bg.lineStyle(3, 0xff5577, (0.35 + 0.25 * Math.sin(gt * 8 + s)) * grow);
        bg.beginPath(); bg.arc(a.bx, a.by, rN, a1, a1 + dash); bg.strokePath();
        var a2 = rot2 + (TAU / segs) * s;
        bg.lineStyle(1.5, 0xffcccc, 0.22 * grow);
        bg.beginPath(); bg.arc(a.bx, a.by, rN * 0.95, a2, a2 + dash * 0.7); bg.strokePath();
      }
      // Faint radial grid spokes
      for (var k = 0; k < 12; k++) {
        var ga = rot1 * 0.5 + (TAU / 12) * k;
        bg.lineStyle(1, 0xff3355, 0.07 * grow);
        bg.beginPath();
        bg.moveTo(a.bx, a.by);
        bg.lineTo(a.bx + Math.cos(ga) * rN, a.by + Math.sin(ga) * rN);
        bg.strokePath();
      }
    }

    /* ---- Lasers ---- */
    var lg = a.laserGfx;
    lg.clear();
    for (var li = 0; li < a.lasers.length; li++) {
      var L = a.lasers[li];
      var ox = a.x, oy = a.y;                       // live origin — anchored to the body
      var len = this._anomalyBeamLen(a, L.ang);     // clipped at the barrier edge
      var ex = ox + Math.cos(L.ang) * len;
      var ey = oy + Math.sin(L.ang) * len;
      if (L.t < L.warn) {
        // Danger band: a translucent strip at the REAL beam width that swells as
        // the shot nears, so the player reads where (and how wide) the deadly bolt
        // lands — the old 1.4px tracer was easy to miss on the busy PCB.
        var warnP = L.t / L.warn;
        lg.lineStyle(C.ANO_LASER_WIDTH * 2.2, 0xff0033, 0.05 + 0.13 * warnP);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        // Telegraph — thin harmless tracer, pulsing, with a running scan dot
        var wa = 0.35 + 0.45 * Math.abs(Math.sin(gt * 30));
        lg.lineStyle(1.4, 0xff3366, wa);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        lg.lineStyle(0.6, 0xffffff, wa * 0.5);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        var sdt = (gt * 1.6 % 1.0);
        lg.fillStyle(0xffffff, 0.8);
        lg.fillCircle(ox + Math.cos(L.ang) * len * sdt, oy + Math.sin(L.ang) * len * sdt, 2.2);
      } else {
        // Deadly beam — flickering thick magenta/red bolt
        var flick = 0.80 + 0.20 * Math.random();
        var bw = C.ANO_LASER_WIDTH;
        lg.lineStyle(bw * 2.4, 0xff0033, 0.18 * flick);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        lg.lineStyle(bw, 0xff2255, 0.72 * flick);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        lg.lineStyle(bw * 0.4, 0xffffff, 0.92 * flick);
        lg.beginPath(); lg.moveTo(ox, oy); lg.lineTo(ex, ey); lg.strokePath();
        // Muzzle flash on the body
        lg.fillStyle(0xffffff, 0.6 * flick);
        lg.fillCircle(ox, oy, bw * 0.7);
      }
    }

    /* ---- Shield bubble + hint while invulnerable ---- */
    var sg = a.shieldGfx;
    sg.clear();
    if ((a.phase === 'BARRIER' || a.phase === 'INTRO') && a.shielded) {
      var sr = C.ANO_SIZE * 2.3 + 3 * Math.sin(gt * 4);
      var hit = a._shieldHitT;
      var sa  = 0.45 + 0.20 * Math.sin(gt * 5) + hit * 0.5;
      sg.lineStyle(7, 0x66ddff, 0.18 + hit * 0.4);
      sg.strokeCircle(a.x, a.y, sr * 1.08);
      sg.lineStyle(2.5, 0x99eeff, sa);
      sg.strokeCircle(a.x, a.y, sr);
      sg.lineStyle(1.2, 0xffffff, sa * (0.5 + hit));
      sg.strokeCircle(a.x, a.y, sr * 0.82);
      for (var ai = 0; ai < 4; ai++) {
        var arcA = gt * 1.5 + (Math.PI / 2) * ai;
        sg.lineStyle(2, 0xccf2ff, sa * 0.7);
        sg.beginPath(); sg.arc(a.x, a.y, sr + 4, arcA, arcA + 0.5); sg.strokePath();
      }
      if (hit > 0) { sg.fillStyle(0xffffff, hit * 0.25); sg.fillCircle(a.x, a.y, sr); }
    }

    // Hint text
    if (a.hintTxt) {
      if (a.phase === 'BARRIER') {
        a.hintTxt.setVisible(true);
        a.hintTxt.setPosition(a.x, a.y - C.ANO_SIZE * 2.6);
        if (a.shielded) {
          a.hintTxt.setText(LA.laGoT('laAnomalyShielded') + '  ' + this.enemies.length);
          a.hintTxt.setColor('#66ddff');
          a.hintTxt.setAlpha(0.92);
        } else {
          a.hintTxt.setText(LA.laGoT('laAnomalyVuln'));
          a.hintTxt.setColor('#ff3344');
          a.hintTxt.setAlpha(0.6 + 0.4 * Math.abs(Math.sin(gt * Math.PI * 6)));
        }
      } else {
        a.hintTxt.setVisible(false);
      }
    }

    /* ---- Boss pointer (chevron next to the player) ----
       Guides the player toward the anomaly while:
         - it is still wandering and looking for them
         - the firewall is still being raised (barrierT < 1)
         - the shield has just dropped (vulnerable → time to kill it)
       Hidden once the zone is sealed and the boss is invulnerable. */
    var pg = a.pointerGfx;
    pg.clear();
    var showPtr = (a.phase === 'WANDER')
               || (a.phase === 'BARRIER' && a.barrierT < 1.0)
               || (a.phase === 'BARRIER' && !a.shielded);
    if (showPtr && p && p.state !== 'DEAD') {
      var pdx = a.x - p.x, pdy = a.y - p.y;
      var pdd = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdd > 1) {
        var pAng = Math.atan2(pdy, pdx);
        var D    = 90;                                  // pointer stands ~90px from the player
        var px = p.x + Math.cos(pAng) * D;
        var py = p.y + Math.sin(pAng) * D;
        var pulse = 0.55 + 0.45 * Math.abs(Math.sin(gt * Math.PI * 3.2));
        var col   = a.vulnerable ? 0xff3344 : 0xff33cc;
        var size  = 18;

        var nose = { x: Math.cos(pAng) * size,         y: Math.sin(pAng) * size };
        var lwn  = { x: Math.cos(pAng + 2.5) * size,   y: Math.sin(pAng + 2.5) * size };
        var rwn  = { x: Math.cos(pAng - 2.5) * size,   y: Math.sin(pAng - 2.5) * size };

        // Soft outer glow
        pg.fillStyle(col, 0.18 * pulse);
        pg.fillTriangle(px + nose.x * 1.35, py + nose.y * 1.35,
                        px + lwn.x  * 1.35, py + lwn.y  * 1.35,
                        px + rwn.x  * 1.35, py + rwn.y  * 1.35);
        // Main fill
        pg.fillStyle(col, 0.85 * pulse);
        pg.fillTriangle(px + nose.x, py + nose.y,
                        px + lwn.x,  py + lwn.y,
                        px + rwn.x,  py + rwn.y);
        // White-hot inner core
        pg.fillStyle(0xffffff, 0.9 * pulse);
        pg.fillTriangle(px + nose.x * 0.55, py + nose.y * 0.55,
                        px + lwn.x  * 0.45, py + lwn.y  * 0.45,
                        px + rwn.x  * 0.45, py + rwn.y  * 0.45);
        // Outline pulse
        pg.lineStyle(1.5, 0xffffff, 0.9 * pulse);
        pg.beginPath();
        pg.moveTo(px + nose.x, py + nose.y);
        pg.lineTo(px + lwn.x,  py + lwn.y);
        pg.lineTo(px + rwn.x,  py + rwn.y);
        pg.closePath();
        pg.strokePath();
      }
    }
  };

  /* ================================================================
     PLAYER CONFINEMENT — keep the player inside the firewall
     ================================================================ */
  M._confinePlayerToBarrier = function () {
    var a = this._anomaly;
    if (!a || a.phase !== 'BARRIER' || a.dead) return;
    var p = this.p;
    var dx = p.x - a.bx, dy = p.y - a.by;
    var lim = a.R - C.SIZE * 1.4;
    var d2 = dx * dx + dy * dy;
    if (d2 > lim * lim) {
      var d = Math.sqrt(d2) || 1;
      p.x = a.bx + (dx / d) * lim;
      p.y = a.by + (dy / d) * lim;
      // Same aggressive rebound as the map wall: dash / dash-attack / torpedo
      // attack ricochet FAST off the firewall, a drift just springs off.
      this._applyAggressiveRebound(dx / d, dy / d);
    }
    // World wins over the barrier — if the firewall extends past the map,
    // the player can't be pushed through the disc wall.
    var pwc = LA.clampDisc(p.x, p.y, C.SIZE * 1.5);
    if (pwc.hit) {
      p.x = pwc.x; p.y = pwc.y;
      this._applyAggressiveRebound(pwc.nx, pwc.ny);
    }
  };

})();
